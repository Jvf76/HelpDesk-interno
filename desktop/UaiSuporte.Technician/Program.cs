using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using UaiSuporte.Transport;
namespace UaiSuporte.Technician;
internal static class Program
{
    [STAThread] static void Main() {
        ApplicationConfiguration.Initialize();
        using var mutex = new Mutex(true,"Local\\UaiSuporteTechnician-"+Environment.UserName,out bool first);
        if (!first) { MessageBox.Show("O Uai Suporte Técnico já está aberto."); return; }
        Application.Run(new TechnicianWindow());
    }
}
sealed class TechnicianWindow : Form
{
    readonly WebView2 view = new() { Dock = DockStyle.Fill };
    readonly ApiSession api = new();
    readonly ToolStripStatusLabel status = new("Interface incorporada • API: suporte.internal • laboratório 0.2.0");
    readonly string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"UaiTelecom","Technician","WebView2");
    bool ready, closing;
    static void Log(string code) {
        try {
            var directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"UaiTelecom","Technician");
            Directory.CreateDirectory(directory);
            var file=Path.Combine(directory,"technician.log");
            if(File.Exists(file) && new FileInfo(file).Length>1048576) File.Move(file,file+".1",true);
            File.AppendAllText(file,$"{DateTimeOffset.UtcNow:O} {code}{Environment.NewLine}");
        } catch { /* Diagnostics never alter TLS or prevent the application from closing. */ }
    }
    public TechnicianWindow() {
        Log("APP_START_0.2.0");
        Text="Uai Suporte Técnico • Uai Telecom"; Size=new(1250,850); MinimumSize=new(950,650);
        using var icon=Assembly.GetExecutingAssembly().GetManifestResourceStream("app.ico");
        Icon=new Icon(icon!);
        var tabs=new TabControl {Dock=DockStyle.Fill};
        var panel=new TabPage("Central de suporte"); panel.Controls.Add(view); tabs.TabPages.Add(panel);
        var remote=new TabPage("Atendimento remoto");
        remote.Controls.Add(new Label {Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleCenter,
            Text="Visualizador remoto interno\n\nÁrea reservada para MeshCentral.\nNesta prova, valide login e logout. Nenhuma sessão remota será iniciada.",Font=new("Segoe UI",13)});
        tabs.TabPages.Add(remote);
        var bar=new StatusStrip(); bar.Items.Add(status);
        Controls.Add(tabs); Controls.Add(bar);
        Shown+=async (_,_)=>await Initialize();
        FormClosed+=(_,_)=>{closing=true;view.Dispose();api.Dispose();};
    }
    async Task Initialize() {
        try {
            var env=await CoreWebView2Environment.CreateAsync(null,profile);
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
            if(!file.Contains("..") && !file.Contains('\\')) content=Assembly.GetExecutingAssembly().GetManifestResourceStream("ui/"+file);
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
            var reply=await api.Send(e.Source,r.GetProperty("path").GetString()??"",r.GetProperty("method").GetString()??"",
                r.TryGetProperty("body",out var b)&&b.ValueKind!=JsonValueKind.Null?b.GetRawText():null,
                r.TryGetProperty("csrf",out var c)&&c.ValueKind==JsonValueKind.String?c.GetString():null);
            Log("API_STATUS_"+reply.Status);
            if(closing || !ApiSession.TrustedSource(view.CoreWebView2.Source)) return;
            view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new {id,status=reply.Status,body=reply.Body}));
        } catch { if(!closing) status.Text="Requisição inválida bloqueada. Nenhum conteúdo sensível foi registrado."; }
    }
}
