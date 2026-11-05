using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using UaiSuporte.Transport;
namespace UaiSuporte.App;
internal static class Program
{
    [STAThread] static void Main(string[] args) {
        ApplicationConfiguration.Initialize();
        try { UaiSuporte.Agent.Provisioning.RequireCommittedInstallation(); } catch { MessageBox.Show("Instalação incompleta. Conclua o assistente ou a reversão pelo desinstalador antes de abrir o Uai Suporte."); return; }
        using var mutex = new Mutex(true,"Local\\UaiSuporteUnified-"+Environment.UserName,out bool first);
        if (!first) { MessageBox.Show("O Uai Suporte já está em execução. Abra pelo ícone junto ao relógio do Windows."); return; }
        try{Application.Run(new SupportWindow(args.Contains("--background")));}
        catch{MessageBox.Show("Não foi possível abrir a interface. Preserve o cadastro e solicite revisão dos arquivos da instalação à TI.","Uai Suporte");}
    }
}
sealed class SupportWindow : Form
{
    readonly WebView2 view = new() { Dock = DockStyle.Fill };

    readonly UaiSuporte.Agent.ReceiverWindow receiver = new(){TopLevel=false,FormBorderStyle=FormBorderStyle.None,Dock=DockStyle.Fill};
    readonly ToolStripStatusLabel status = new("Interface incorporada • API: suporte.internal • somente receber suporte");
    readonly string profile = Path.Combine(UiData.Root,"WebView2");
    bool ready, closing, exitRequested, initializing;
    readonly NotifyIcon tray=new();
    Task registrationTask=Task.CompletedTask;
    CancellationTokenSource registrationCancel=new();
    readonly System.Windows.Forms.Timer receivingMonitor = new(){Interval=1000};
    readonly ToolStripStatusLabel receivingStatus = new("Recepção: verificando cadastro local");
    readonly ToolStripButton stopReceiving = new("ENCERRAR ACESSO A ESTE COMPUTADOR");
    readonly TabControl tabs=new(){Dock=DockStyle.Fill};
    readonly StatusStrip bar=new();
    readonly TabPage receiving=new("Este computador • consentimento e encerramento");
    void ShowMain(){if(closing)return;ShowInTaskbar=true;Show();WindowState=FormWindowState.Normal;Activate();if(!ready)_=Initialize();}
    void Background(){Hide();ShowInTaskbar=false;}
    static void Log(string code) {
        try {
            var directory=UiData.Root;
            Directory.CreateDirectory(directory);
            var file=Path.Combine(directory,"app.log");
            if(File.Exists(file) && new FileInfo(file).Length>1048576) File.Move(file,file+".1",true);
            File.AppendAllText(file,$"{DateTimeOffset.UtcNow:O} {code}{Environment.NewLine}");
        } catch { /* Diagnostics never alter TLS or prevent the application from closing. */ }
    }
    public SupportWindow(bool background) {
        Log("APP_START_RECEIVE_ONLY");
        Text="Uai Suporte • Uai Telecom"; Size=new(1250,850); MinimumSize=new(950,650);
        using var icon=Assembly.GetExecutingAssembly().GetManifestResourceStream("app.ico");
        Icon=new Icon(icon!);
        var panel=new TabPage("Início"); panel.Controls.Add(view); tabs.TabPages.Add(panel);
        receiving.Controls.Add(receiver);tabs.TabPages.Add(receiving);receiver.Show();
        tray.Icon=Icon;tray.Text="Uai Suporte • verificando conexão";tray.Visible=true;
        var menu=new ContextMenuStrip();
        menu.Items.Add("Abrir Uai Suporte",null,(_,_)=>ShowMain());
        menu.Items.Add("Copiar Meu código",null,(_,_)=>{if(!string.IsNullOrWhiteSpace(receiver.DeviceCode))Clipboard.SetText(receiver.DeviceCode);});
        var trayState=menu.Items.Add("Conectando");trayState.Enabled=false;
        menu.Opening+=(_,_)=>trayState.Text=receiver.ConnectionState;
        menu.Items.Add("Ver versão",null,(_,_)=>MessageBox.Show(this,"Uai Suporte "+Assembly.GetExecutingAssembly().GetName().Version,"Uai Suporte"));
        menu.Items.Add("Sair da interface",null,(_,_)=>{if(receiver.SessionActive&&MessageBox.Show(this,"O atendimento será encerrado. O monitoramento continuará pelo serviço. Sair da interface?","Uai Suporte",MessageBoxButtons.YesNo)!=DialogResult.Yes)return;exitRequested=true;Close();});
        tray.ContextMenuStrip=menu;tray.DoubleClick+=(_,_)=>ShowMain();
        receiver.AttentionRequested+=()=>{ShowMain();if(tabs.TabPages.Contains(receiving))tabs.SelectedTab=receiving;};
        FormClosing+=async(_,e)=>{
          if(closing)return;
          if(e.CloseReason==CloseReason.UserClosing&&!exitRequested&&receiver.Registered){e.Cancel=true;Background();return;}
          closing=true;registrationCancel.Cancel();
          if(e.CloseReason is CloseReason.WindowsShutDown or CloseReason.TaskManagerClosing){await receiver.Shutdown();return;}
          e.Cancel=true;try{await registrationTask;}catch{}await receiver.Shutdown();Close();
        };
        bar.Items.Add(status); bar.Items.Add(receivingStatus); bar.Items.Add(stopReceiving);
        stopReceiving.Click+=async(_,_)=>await receiver.StopLocal();
        receivingMonitor.Tick+=(_,_)=>{receivingStatus.Text=receiver.ConnectionState;bar.BackColor=receiver.SessionActive?Color.Moccasin:SystemColors.Control;tray.Text=("Uai Suporte • "+receiver.ConnectionState)[..Math.Min(63,("Uai Suporte • "+receiver.ConnectionState).Length)];};
        receivingMonitor.Start();
        Controls.Add(tabs); Controls.Add(bar);
        Shown+=async (_,_)=>{if(background)Background();await receiver.Initialize();UpdateActivationChrome();if(receiver.Registered&&background)Background();else{ShowMain();}};
        FormClosed+=(_,_)=>{closing=true;receivingMonitor.Dispose();tray.Visible=false;tray.Dispose();view.Dispose();};
    }
    void UpdateActivationChrome() {
      bool available=receiver.Registered;
      foreach(var page in new[]{receiving}) {
        if(available&&!tabs.TabPages.Contains(page))tabs.TabPages.Add(page);
        else if(!available&&tabs.TabPages.Contains(page))tabs.TabPages.Remove(page);
      }
      bar.Visible=available;
    }
    async Task Initialize() {
        if(initializing||ready)return;initializing=true;
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
            ApiReply reply;
            if(path=="/desktop/device"&&method=="GET") reply=new(200,JsonSerializer.Serialize(new{code=receiver.DeviceCode,state=receiver.ConnectionState,name=Environment.MachineName,registered=receiver.Registered,error=receiver.ActivationError}));
            else if(path=="/desktop/activate"&&method=="POST") {
              if(!registrationTask.IsCompleted)reply=ApiSession.Error(409,"Ativação em andamento.");
              else {
                string token=r.GetProperty("body").GetProperty("token").GetString()??"";
                try {
                  var activation=UaiSuporte.Agent.LocalChannel.Send(new("activate",Token:token),registrationCancel.Token);
                  registrationTask=activation;var result=await activation;reply=new(result.Status,result.Body);
                  await receiver.Initialize();UpdateActivationChrome();if(result.Status==200)Background();
                } catch(HttpRequestException ex) { reply=ApiSession.Error(ex.HttpRequestError==HttpRequestError.SecureConnectionError?495:503,ex.HttpRequestError==HttpRequestError.SecureConnectionError?"Certificado TLS recusado.":"Servidor indisponível. Tente novamente mantendo o mesmo token."); }
                catch(InvalidOperationException ex) {reply=ApiSession.Error(400,ex.Message);}
                catch {reply=ApiSession.Error(400,"Cadastro incompleto ou corrompido. Solicite recuperação administrativa.");}
                finally {token="";}
              }
            }
            else if(path=="/desktop/receiving"&&method=="POST"){if(tabs.TabPages.Contains(receiving)){tabs.SelectedTab=receiving;reply=new(200,"{}");}else reply=ApiSession.Error(409,"Ative este computador primeiro.");}
            else if(path=="/desktop/background"&&method=="POST") {if(receiver.Registered){Background();reply=new(200,"{}");}else reply=ApiSession.Error(409,"Ative este computador primeiro.");}
            else {
              string? body=r.TryGetProperty("body",out var b)&&b.ValueKind!=JsonValueKind.Null?b.GetRawText():null;
              string? action=method=="GET"?path switch {"/identity"=>"identity","/connections"=>"history",_=>null}:null;
              if(action==null)reply=ApiSession.Error(403,"Operação não permitida.");
              else {try{var response=await UaiSuporte.Agent.LocalChannel.Send(new(action));reply=new(response.Status,response.Body);}catch{reply=ApiSession.Error(503,"Serviço indisponível. Cadastro preservado.");}}
            }
            Log("API_STATUS_"+reply.Status);
            if(closing || !ApiSession.TrustedSource(view.CoreWebView2.Source)) return;
            view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new {id,status=reply.Status,body=reply.Body}));

        } catch { if(!closing) status.Text="Requisição inválida bloqueada. Nenhum conteúdo sensível foi registrado."; }
    }
}
