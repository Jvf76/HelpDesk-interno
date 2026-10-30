using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Reflection.PortableExecutable;
using System.Reflection.Metadata;
using UaiSuporte.Transport;
const string origin=ApiSession.LocalOrigin+"/index.html";
int count=0;
void Check(bool value,string name) { if(!value) throw new Exception("FAIL: "+name); count++; Console.WriteLine("OK: "+name); }
Check(ApiSession.TrustedSource(origin),"origem local aceita");
foreach(var source in new[]{"https://evil.invalid/index.html", "https://uai-suporte.invalid.evil/index.html", "http://uai-technician.invalid/index.html", "https://x@uai-technician.invalid/index.html",origin+"?url=evil", "https://uai-suporte.invalid/other.html"})
 Check(!ApiSession.TrustedSource(source),"origem indevida rejeitada");
foreach(var path in new[]{"//evil/api", "https://evil/api", "/../auth/me", "/devices?url=x", "/devices/%2e%2e", "/agent/heartbeat" , "/tickets"})
 Check(!ApiSession.Allowed("POST",path),"rota indevida rejeitada");
Check(ApiSession.Allowed("POST","/sessions/00000000-0000-0000-0000-000000000001/launch"),"launch remoto autorizado somente pela API");
Check(ViewerPolicy.Navigation(ViewerPolicy.Page),"viewer local permitido");
Check(!ViewerPolicy.Navigation("https://mesh.internal/sharing?c=x"),"HTML remoto bloqueado");
Check(ViewerPolicy.Relay("wss://mesh.internal/meshrelay.ashx?auth=test"),"relay exato permitido");
Check(!ViewerPolicy.Relay("wss://mesh.internal.evil/meshrelay.ashx"),"relay externo bloqueado");
Check(!ViewerPolicy.Asset("https://mesh.internal/uai-viewer/%2e%2e/secrets"),"travessia bloqueada");
Check(!ApiSession.Allowed("GET","/tickets"),"chamados removidos da ponte");
using(var api=new ApiSession(new Stub())) {
 Check((await api.Send("https://evil.invalid", "/auth/me","GET",null,null)).Status==403,"ponte rejeita fonte externa");
 Check((await api.Send(origin,"/auth/logout","POST","{}",null)).Status==403,"mutacao sem CSRF bloqueada");
 Check((await api.Send(origin,"/auth/me","GET",null,null)).Status==401,"401 preservado");
}
foreach(var (mode,status) in new[]{("redirect",502),("html",502),("tls",495),("offline",503)}) {
 using var api=new ApiSession(new Stub(mode));
 Check((await api.Send(origin,"/auth/me","GET",null,null)).Status==status,mode+" tratado com seguranca");
}
if(args.Length>0 && args[0]=="resources") {
 using var pe=new PEReader(File.OpenRead(args[1]));var metadata=pe.GetMetadataReader();
 var names=metadata.ManifestResources.Select(h=>metadata.GetString(metadata.GetManifestResource(h).Name).Replace('\\','/')).ToArray();
 Check(names.Contains("ui/index.html") && names.Contains("viewer/index.html") && names.Contains("viewer/viewer.js") && names.Any(n=>n.StartsWith("ui/assets/")&&n.EndsWith(".js")) && names.Any(n=>n.EndsWith(".css")),"HTML JS CSS incorporados no assembly publicado");
}
if(args.Length>0 && (args[0]=="live"||args[0]=="untrusted")) {
 var handler=new SocketsHttpHandler {AllowAutoRedirect=false,UseCookies=true,CookieContainer=new CookieContainer(),UseProxy=false,
 ConnectCallback=async(ctx,token)=> {
  if(ctx.DnsEndPoint.Host!="suporte.internal" || ctx.DnsEndPoint.Port!=443) throw new Exception("Unexpected destination");
  var socket=new Socket(SocketType.Stream,ProtocolType.Tcp);
  try {await socket.ConnectAsync(IPAddress.Loopback,443,token);return new NetworkStream(socket,true);} catch {socket.Dispose();throw;}
 }};
 using var api=new ApiSession(handler);
 var initial=await api.Send(origin,"/auth/me","GET",null,null);
 if(args[0]=="untrusted") Check(initial.Status==495,"CA nao confiada rejeitada pelo .NET real");
 else {
  Check(initial.Status==401,"API real: sem cookie recebe401");
  var credentials=JsonDocument.Parse(File.ReadAllText(args[1])).RootElement.GetProperty("panel").GetRawText();
  var login=await api.Send(origin,"/auth/login","POST",credentials,null);
  Check(login.Status==200,"API real: login");
  var user=JsonDocument.Parse(login.Body).RootElement;
  string csrf=user.GetProperty("csrf").GetString()!;
  Check(user.GetProperty("role").GetString()=="ADMIN","API real: perfil administrativo retornado");
  try {
   Check((await api.Send(origin,"/auth/me","GET",null,null)).Status==200,"API real: cookie conservado nativamente");
   Check((await api.Send(origin,"/devices","GET",null,null)).Status==200,"API real: lista autorizada");
   Check((await api.Send(origin,"/auth/logout","POST","{}","invalid")).Status==403,"API real: CSRF incorreto rejeitado no backend");
  } finally {Check((await api.Send(origin,"/auth/logout","POST","{}",csrf)).Status==200,"API real: logout com CSRF");}
  Check((await api.Send(origin,"/auth/me","GET",null,null)).Status==401,"API real: logout invalida cookie");
 }
}
Check(!ApiSession.AllowedDevice("POST","/auth/login"),"device bridge excludes user login");
Check(!ApiSession.AllowedDevice("POST","/users"),"device bridge excludes admin");
Check(ApiSession.AllowedDevice("POST","/connections"),"device connection route allowed");
using(var deviceApi=new ApiSession(new DeviceStub(),()=> ("device-test","private-test"))) {
 Check((await deviceApi.Send(origin,"/identity","GET",null,null)).Status==200,"device startup authenticates without user login");
 Check((await deviceApi.Send(origin,"/connections","POST","{}",null)).Status==200,"device request does not depend on user CSRF cookie");
 Check((await deviceApi.Send(origin,"/auth/login","POST","{}",null)).Status==403,"native login forbidden");
}
using(var unactivated=new ApiSession(new DeviceStub(),()=>null)) Check((await unactivated.Send(origin,"/identity","GET",null,null)).Status==401,"unactivated device does not contact API");
foreach(var (mode,status) in new[]{("tls",495),("offline",503)}) {
 using var deviceApi=new ApiSession(new Stub(mode),()=> ("device-test","private-test"));
 Check((await deviceApi.Send(origin,"/identity","GET",null,null)).Status==status,"device "+mode+" fails closed");
}
Console.WriteLine($"{count} verificacoes passaram; nao representam execucao do WebView2 no Windows.");
sealed class Stub(string mode="401"):HttpMessageHandler {
 protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token) {
  if(mode=="tls") throw new HttpRequestException(HttpRequestError.SecureConnectionError,"test");
  if(mode=="offline") throw new HttpRequestException(HttpRequestError.ConnectionError,"test");
  var result=new HttpResponseMessage(mode=="redirect"?HttpStatusCode.Redirect: mode=="html"?HttpStatusCode.OK:HttpStatusCode.Unauthorized);
  result.Content=new StringContent(mode=="html"?"<html>blocked</html>":"{}",System.Text.Encoding.UTF8,mode=="html"?"text/html":"application/json");
  return Task.FromResult(result);
 }
}

sealed class DeviceStub:HttpMessageHandler {
 protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token) {
  if(request.Headers.Authorization?.Parameter!="private-test"||request.Headers.GetValues("X-Uai-Device").Single()!="device-test"||!request.RequestUri!.AbsolutePath.StartsWith("/api/desktop/"))throw new Exception("Incorrect device authentication");
  return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=new StringContent("{}",System.Text.Encoding.UTF8,"application/json")});
 }
}
