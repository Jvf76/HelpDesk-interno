using System.Reflection;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using UaiSuporte.Transport;
namespace UaiSuporte.App;
sealed class RemoteViewer : UserControl {
 readonly WebView2 web=new(){Dock=DockStyle.Fill};
 readonly Action<string> report;
 public RemoteViewer(Action<string> report){this.report=report;Dock=DockStyle.Fill;Controls.Add(web);}
 public async Task Start(JsonElement bootstrap,string profile){
  var env=await CoreWebView2Environment.CreateAsync(Path.Combine(AppContext.BaseDirectory,"Runtime"),profile);
  await web.EnsureCoreWebView2Async(env);
  if(IsDisposed)throw new ObjectDisposedException(nameof(RemoteViewer));
  var core=web.CoreWebView2;
  core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.AreBrowserAcceleratorKeysEnabled=false;core.Settings.AreHostObjectsAllowed=false;core.Settings.IsPasswordAutosaveEnabled=false;core.Settings.IsGeneralAutofillEnabled=false;
  core.NewWindowRequested+=(_,e)=>e.Handled=true;
  core.DownloadStarting+=(_,e)=>e.Cancel=true;
  core.PermissionRequested+=(_,e)=>e.State=CoreWebView2PermissionState.Deny;
  core.ServerCertificateErrorDetected+=(_,e)=>{e.Action=CoreWebView2ServerCertificateErrorAction.Cancel;report("tls");};
  core.NavigationStarting+=(_,e)=>e.Cancel=!ViewerPolicy.Navigation(e.Uri);
  core.FrameNavigationStarting+=(_,e)=>e.Cancel=true;
  core.ProcessFailed+=(_,_)=>report("disconnected");
  core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
  core.WebResourceRequested+=(_,e)=>{
   if(ViewerPolicy.Relay(e.Request.Uri))return;
   Stream? stream=null;
   if(ViewerPolicy.Asset(e.Request.Uri)&&e.Request.Method=="GET"){
    var file=new Uri(e.Request.Uri).AbsolutePath["/uai-viewer/".Length..];
    var assembly=Assembly.GetExecutingAssembly();
    var resource=assembly.GetManifestResourceNames().FirstOrDefault(n=>n.Replace('\\','/')=="viewer/"+file);
    if(resource!=null)stream=assembly.GetManifestResourceStream(resource);
   }
   string mime=Path.GetExtension(new Uri(e.Request.Uri).AbsolutePath) switch {".js"=>"text/javascript",".css"=>"text/css",".html"=>"text/html; charset=utf-8",_=>"application/octet-stream"};
   e.Response=env.CreateWebResourceResponse(stream??new MemoryStream(),stream==null?403:200,stream==null?"Forbidden":"OK",$"Content-Type: {mime}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src data: blob:; connect-src wss://mesh.internal/meshrelay.ashx; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\r\n");
  };
  core.WebMessageReceived+=(_,e)=>{
   if(e.Source!=ViewerPolicy.Page)return;
   try{using var d=JsonDocument.Parse(e.WebMessageAsJson);var kind=d.RootElement.GetProperty("kind").GetString();if(kind is "frame" or "stop" or "disconnected")report(kind);}catch{}
  };
  core.NavigationCompleted+=(_,e)=>{
   if(!e.IsSuccess){report("disconnected");return;}
   core.PostWebMessageAsJson(JsonSerializer.Serialize(new{action="start",authCookie=bootstrap.GetProperty("authCookie").GetString(),viewOnly=bootstrap.GetProperty("viewOnly").GetBoolean(),expiresAt=bootstrap.GetProperty("expiresAt").GetInt64()}));
  };
  core.Navigate(ViewerPolicy.Page);
 }
 protected override void Dispose(bool disposing){if(disposing)web.Dispose();base.Dispose(disposing);}
}
