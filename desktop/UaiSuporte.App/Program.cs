using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using UaiSuporte.Transport;
namespace UaiSuporte.App;
internal static class Program
{
    [STAThread] static void Main() {
        ApplicationConfiguration.Initialize();
        try { UaiSuporte.Agent.Provisioning.RequireCommittedInstallation(); } catch { MessageBox.Show("Instalação incompleta. Conclua o assistente ou a reversão pelo desinstalador antes de abrir o Uai Suporte."); return; }
        using var mutex = new Mutex(true,"Local\\UaiSuporteUnified-"+Environment.UserName,out bool first);
        if (!first) { MessageBox.Show("O Uai Suporte já está aberto."); return; }
        Application.Run(new SupportWindow());
    }
}
sealed class SupportWindow : Form
{
    readonly WebView2 view = new() { Dock = DockStyle.Fill };
    readonly ApiSession api = new(deviceIdentity:UaiSuporte.Agent.Provisioning.DeviceIdentity);
    readonly UaiSuporte.Agent.ReceiverWindow receiver = new(){TopLevel=false,FormBorderStyle=FormBorderStyle.None,Dock=DockStyle.Fill};
    readonly ToolStripStatusLabel status = new("Interface incorporada • API: suporte.internal • laboratório 0.6.0");
    readonly string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"UaiTelecom","UaiSuporte","WebView2");
    bool ready, closing, polling;
    Task registrationTask=Task.CompletedTask;
    CancellationTokenSource registrationCancel=new();
    readonly System.Windows.Forms.Timer receivingMonitor = new(){Interval=1000};
    readonly ToolStripStatusLabel receivingStatus = new("Recepção: verificando cadastro local");
    readonly ToolStripButton stopReceiving = new("ENCERRAR ACESSO A ESTE COMPUTADOR");
    readonly TabControl tabs=new(){Dock=DockStyle.Fill};
    readonly StatusStrip bar=new();
    readonly TabPage receiving=new("Este computador • consentimento e encerramento");
    readonly TabPage remote=new("Atendimento remoto");
    readonly System.Windows.Forms.Timer monitor=new(){Interval=2000};
    RemoteViewer? viewer;
    string? activeSession;
    string csrf="";
    void CloseViewer(){monitor.Stop();var v=viewer;viewer=null;if(v!=null){remote.Controls.Remove(v);v.Dispose();status.Text="Visualizador fechado • imagem e controle desativados";}}
    async Task StopSession(){CloseViewer();var id=activeSession;activeSession=null;if(id!=null)await api.Send(ApiSession.LocalOrigin+"/index.html","/sessions/"+id+"/stop","POST","{}",csrf);}
    async Task MonitorSession(){
      if(polling||activeSession==null)return;polling=true;
      try{var r=await api.Send(ApiSession.LocalOrigin+"/index.html","/sessions/"+activeSession,"GET",null,null);
       if(r.Status!=200){await StopSession();status.Text="Sessão interrompida: autorização ou conexão não confirmada.";return;}
       using var d=JsonDocument.Parse(r.Body);var s=d.RootElement;
       if(s.GetProperty("ended_at").ValueKind!=JsonValueKind.Null||s.GetProperty("status").GetString() is "STOPPING" or "UNVERIFIED"){CloseViewer();activeSession=null;}
      }catch{await StopSession();}finally{polling=false;}
    }
    static void Log(string code) {
        try {
            var directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"UaiTelecom","UaiSuporte");
            Directory.CreateDirectory(directory);
            var file=Path.Combine(directory,"app.log");
            if(File.Exists(file) && new FileInfo(file).Length>1048576) File.Move(file,file+".1",true);
            File.AppendAllText(file,$"{DateTimeOffset.UtcNow:O} {code}{Environment.NewLine}");
        } catch { /* Diagnostics never alter TLS or prevent the application from closing. */ }
    }
    public SupportWindow() {
        Log("APP_START_0.6.0");
        Text="Uai Suporte • Uai Telecom"; Size=new(1250,850); MinimumSize=new(950,650);
        using var icon=Assembly.GetExecutingAssembly().GetManifestResourceStream("app.ico");
        Icon=new Icon(icon!);
        var panel=new TabPage("Início"); panel.Controls.Add(view); tabs.TabPages.Add(panel);
        receiving.Controls.Add(receiver);tabs.TabPages.Add(receiving);receiver.Show();
        tabs.TabPages.Add(remote);
        monitor.Tick+=async(_,_)=>await MonitorSession();
        FormClosing+=async(_,e)=>{if(closing)return;e.Cancel=true;closing=true;registrationCancel.Cancel();try{await registrationTask;}catch{}await receiver.Shutdown();await StopSession();Close();};
        bar.Items.Add(status); bar.Items.Add(receivingStatus); bar.Items.Add(stopReceiving);
        stopReceiving.Click+=async(_,_)=>await receiver.StopLocal();
        receivingMonitor.Tick+=(_,_)=>{receivingStatus.Text=receiver.ConnectionState;bar.BackColor=receiver.SessionActive?Color.Moccasin:SystemColors.Control;TopMost=receiver.SessionActive;};
        receivingMonitor.Start();
        Controls.Add(tabs); Controls.Add(bar);
        Shown+=async (_,_)=>{await receiver.Initialize();UpdateActivationChrome();await Initialize();};
        FormClosed+=(_,_)=>{closing=true;receivingMonitor.Dispose();monitor.Dispose();CloseViewer();view.Dispose();api.Dispose();};
    }
    void UpdateActivationChrome() {
      bool available=UaiSuporte.Agent.Provisioning.HasIdentity;
      foreach(var page in new[]{receiving,remote}) {
        if(available&&!tabs.TabPages.Contains(page))tabs.TabPages.Add(page);
        else if(!available&&tabs.TabPages.Contains(page))tabs.TabPages.Remove(page);
      }
      bar.Visible=available;
    }
    async Task Initialize() {
        try {
            var env=await CoreWebView2Environment.CreateAsync(Path.Combine(AppContext.BaseDirectory,"Runtime"),profile);
            await view.EnsureCoreWebView2Async(env);
            var core=view.CoreWebView2;
            core.Settings.AreDevToolsEnabled=false;
            core.Settings.AreDefaultContextMenusEnabled=false;
            core.Settings.AreBrowserAcceleratorKeysEnabled=false;
            core.Settings.IsStatusBarEnabled=false;
            core.Settings.IsPasswordAutosaveEnabled=false;
            core.Settings.IsGeneralAutofillEnabled=false;
            core.Settings.AreHostObjectsAllowed=false;
            core.Settings.IsBuiltInErrorPageEnabled=false;
            core.NewWindowRequested+=(_,e)=>e.Handled=true;
            core.DownloadStarting+=(_,e)=>e.Cancel=true;
            core.PermissionRequested+=(_,e)=>e.State=CoreWebView2PermissionState.Deny;
            core.ServerCertificateErrorDetected+=(_,e)=>e.Action=CoreWebView2ServerCertificateErrorAction.Cancel;
            core.NavigationStarting+=(_,e)=>{ if(!ApiSession.TrustedSource(e.Uri)) e.Cancel=true; };
            core.FrameNavigationStarting+=(_,e)=>e.Cancel=true;
            core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
            core.WebResourceRequested+=Resource;
            core.WebMessageReceived+=Message;
            core.ProcessFailed+=(_,_)=>status.Text="Falha no componente WebView2. Feche e abra o aplicativo.";
            Log("LOCAL_UI_READY");
            ready=true;
            core.Navigate(ApiSession.LocalOrigin+"/index.html");
        } catch (WebView2RuntimeNotFoundException) {
            Log("WEBVIEW2_RUNTIME_MISSING");
            status.Text="WebView2 Runtime ausente.";
            MessageBox.Show(this,"Instale o Microsoft Edge WebView2 Runtime Evergreen x64 pelo canal oficial da Microsoft ou da TI. O .NET já está incluído no pacote.","Dependência necessária");
        } catch { Log("WEBVIEW2_START_FAILED"); status.Text="Não foi possível iniciar a interface local. Verifique permissões e o WebView2 Runtime."; }
    }
    void Resource(object? sender,CoreWebView2WebResourceRequestedEventArgs e) {
        var uri=new Uri(e.Request.Uri);
        Stream? content=null;
        if(uri.GetLeftPart(UriPartial.Authority)==ApiSession.LocalOrigin && e.Request.Method=="GET" && uri.Query.Length==0) {
            string file=Uri.UnescapeDataString(uri.AbsolutePath).TrimStart('/');
            if(!file.Contains("..") && !file.Contains('\\')) {
                var assembly=Assembly.GetExecutingAssembly();
                var resource=assembly.GetManifestResourceNames().FirstOrDefault(n=>n.Replace('\\','/')=="ui/"+file);
                if(resource!=null)content=assembly.GetManifestResourceStream(resource);
            }
        }
        string type=Path.GetExtension(uri.AbsolutePath) switch {".html"=>"text/html; charset=utf-8",".js"=>"text/javascript; charset=utf-8",".css"=>"text/css; charset=utf-8",".svg"=>"image/svg+xml",".png"=>"image/png",".woff2"=>"font/woff2",_=>"application/octet-stream"};
        const string csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'";
        e.Response=view.CoreWebView2.Environment.CreateWebResourceResponse(content??new MemoryStream(),content==null?403:200,content==null?"Forbidden":"OK",$"Content-Type: {type}\r\nContent-Security-Policy: {csp}\r\nX-Content-Type-Options: nosniff\r\nCache-Control: no-store\r\n");
    }
    async void Message(object? sender,CoreWebView2WebMessageReceivedEventArgs e) {
        if(!ready || closing || !ApiSession.TrustedSource(e.Source)) return;
        string? id=null;
        try {
            if(e.WebMessageAsJson.Length>140000) return;
            using var doc=JsonDocument.Parse(e.WebMessageAsJson);
            var r=doc.RootElement;
            id=r.GetProperty("id").GetString();
            if(!Guid.TryParse(id,out _)) return;
            string path=r.GetProperty("path").GetString()??"";
            string method=r.GetProperty("method").GetString()??"";
            if(r.TryGetProperty("csrf",out var c)&&c.ValueKind==JsonValueKind.String&&!string.IsNullOrEmpty(c.GetString()))csrf=c.GetString()!;
            ApiReply reply;
            if(path=="/desktop/device"&&method=="GET") reply=new(200,JsonSerializer.Serialize(new{code=receiver.DeviceCode,state=receiver.ConnectionState,name=Environment.MachineName,registered=UaiSuporte.Agent.Provisioning.HasIdentity}));
            else if(path=="/desktop/activate"&&method=="POST") {
              if(!registrationTask.IsCompleted)reply=ApiSession.Error(409,"Ativação em andamento.");
              else {
                string token=r.GetProperty("body").GetProperty("token").GetString()??"";
                try {
                  registrationTask=UaiSuporte.Agent.Provisioning.Activate(token,registrationCancel.Token);
                  await registrationTask;await receiver.Initialize();UpdateActivationChrome();reply=new(200,"{}");
                } catch(HttpRequestException ex) { reply=ApiSession.Error(ex.HttpRequestError==HttpRequestError.SecureConnectionError?495:503,ex.HttpRequestError==HttpRequestError.SecureConnectionError?"Certificado TLS recusado.":"Servidor indisponível. Tente novamente mantendo o mesmo token."); }
                catch(InvalidOperationException ex) {reply=ApiSession.Error(400,ex.Message);}
                catch {reply=ApiSession.Error(400,"Cadastro incompleto ou corrompido. Solicite recuperação administrativa.");}
                finally {token="";}
              }
            }
            else if(path=="/desktop/receiving"&&method=="POST"){if(tabs.TabPages.Contains(receiving)){tabs.SelectedTab=receiving;reply=new(200,"{}");}else reply=ApiSession.Error(409,"Ative este computador primeiro.");}
            else if(path=="/desktop/viewer/close"&&method=="POST") {await StopSession();reply=new(200,"{}");}
            else {
              if(path.EndsWith("/stop"))await StopSession();
              string? body=r.TryGetProperty("body",out var b)&&b.ValueKind!=JsonValueKind.Null?b.GetRawText():null;
              if(path=="/connections"&&method=="POST") {
                using var request=JsonDocument.Parse(body??"{}");
                body=JsonSerializer.Serialize(new{code=request.RootElement.GetProperty("code").GetString(),mode=request.RootElement.GetProperty("mode").GetString(),windowsUser=Environment.UserDomainName+"\\"+Environment.UserName});
              }
              reply=await api.Send(e.Source,path,method,body,csrf);
              if(path.EndsWith("/launch")&&reply.Status==200){
                await StopSession();activeSession=path.Split('/')[2];
                try {
                  using var data=JsonDocument.Parse(reply.Body);
                  viewer=new RemoteViewer(kind=>{
                    if(closing||IsDisposed)return;
                    if(kind=="frame")status.Text="Imagem renderizada no aplicativo • sessão autorizada";
                    else {BeginInvoke((Action)(async()=>{if(kind=="disconnected"){CloseViewer();activeSession=null;}else await StopSession();status.Text=kind=="tls"?"Certificado do motor remoto recusado.":"Conexão remota encerrada • imagem e controle desativados.";}));}
                  });
                  remote.Controls.Add(viewer);tabs.SelectedTab=remote;status.Text="Conectando • aguardando consentimento e imagem";
                  await viewer.Start(data.RootElement.Clone(),profile+"-viewer");
                  monitor.Start();reply=new(200,"{}");
                } catch {await StopSession();reply=ApiSession.Error(502,"Não foi possível abrir o visualizador interno.");}
              }
            }
            Log("API_STATUS_"+reply.Status);
            if(closing || !ApiSession.TrustedSource(view.CoreWebView2.Source)) return;
            view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new {id,status=reply.Status,body=reply.Body}));

        } catch { if(!closing) status.Text="Requisição inválida bloqueada. Nenhum conteúdo sensível foi registrado."; }
    }
}
