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
foreach(var source in new[]{"https://evil.invalid/index.html", "https://uai-technician.invalid.evil/index.html", "http://uai-technician.invalid/index.html", "https://x@uai-technician.invalid/index.html",origin+"?url=evil", "https://uai-technician.invalid/other.html"})
 Check(!ApiSession.TrustedSource(source),"origem indevida rejeitada");
foreach(var path in new[]{"//evil/api", "https://evil/api", "/../auth/me", "/devices?url=x", "/devices/%2e%2e", "/agent/heartbeat", "/sessions"})
 Check(!ApiSession.Allowed("POST",path),"rota indevida rejeitada");
Check(!ApiSession.Allowed("POST","/sessions/00000000-0000-0000-0000-000000000001/launch"),"launch remoto bloqueado nesta prova");
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
 var names=metadata.ManifestResources.Select(h=>metadata.GetString(metadata.GetManifestResource(h).Name)).ToArray();
 Check(names.Contains("ui/index.html") && names.Any(n=>n.StartsWith("ui/assets/")&&n.EndsWith(".js")) && names.Any(n=>n.EndsWith(".css")),"HTML JS CSS incorporados no assembly publicado");
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
