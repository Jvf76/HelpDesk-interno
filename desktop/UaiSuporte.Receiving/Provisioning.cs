using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
namespace UaiSuporte.Agent;

// Interactive-user scope. Installer rejects elevation under a different Windows account.
public static class Provisioning {
 public const string MeshHash="4cb9aab0e6f9d90249f29bf15e46e66c702a282bc9f991bbb9b6ef0b78478019";
 public static string Storage=>Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"UaiTelecom","UaiSuporte");
 static HttpClient Client()=>new(new HttpClientHandler{AllowAutoRedirect=false}){BaseAddress=new("https://suporte.internal/"),Timeout=TimeSpan.FromSeconds(10)};
 static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web);
 public static void RequireCommittedInstallation(){
  var state=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"UaiTelecom","UaiSuporte","install-state.json");
  if(!File.Exists(state))return;
  UaiSuporte.Setup.Policy.RequireCommitted(File.ReadAllText(state));
 }
 public static bool HasIdentity=>File.Exists(Path.Combine(Storage,"identity.bin"));
 public static async Task Install(string code,string source,Action<string> report){
  if(HasIdentity)throw new InvalidOperationException("Já existe identidade local. Use a desinstalação ou recuperação da TI; não será criado outro cadastro.");
  if(!Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(source))).Equals(MeshHash,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Hash do MeshAgent recusado.");
  UaiSuporte.Setup.Authenticode.RequireValid(source);
  var folder=Path.Combine(Storage,"Mesh");
  if(Directory.Exists(folder))throw new InvalidOperationException("Pasta Mesh existente; preservada para revisão da TI.");
  var directory=Directory.CreateDirectory(folder);
  var acl=new System.Security.AccessControl.DirectorySecurity();
  acl.SetAccessRuleProtection(true,false);
  using(var current=System.Security.Principal.WindowsIdentity.GetCurrent()){
   var owner=current.User??throw new InvalidOperationException("Identidade Windows indisponível.");acl.SetOwner(owner);
   foreach(var sid in new[]{owner,new System.Security.Principal.SecurityIdentifier("S-1-5-18"),new System.Security.Principal.SecurityIdentifier("S-1-5-32-544")})
    acl.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(sid,System.Security.AccessControl.FileSystemRights.FullControl,System.Security.AccessControl.InheritanceFlags.ContainerInherit|System.Security.AccessControl.InheritanceFlags.ObjectInherit,System.Security.AccessControl.PropagationFlags.None,System.Security.AccessControl.AccessControlType.Allow));
  }
  System.IO.FileSystemAclExtensions.SetAccessControl(directory,acl);
  var exe=Path.Combine(folder,"MeshAgent.exe");File.Copy(source,exe,false);
  using var http=Client();using var mesh=new ManagedMesh();
  string token=Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+','-').Replace('/','_');
  // Persist before HTTP so rollback can revoke even if the enrollment response is lost.
  ReceiverWindow.Save("pending-enrollment.bin",new PendingEnrollment(Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(code))),token));
  http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",token);
  try {
   report("Cadastrando este computador com código de uso único…");
   using var enroll=await http.PostAsJsonAsync("api/agent/enroll",new{code,credential=token,os=Environment.OSVersion.VersionString});enroll.EnsureSuccessStatusCode();
   var identity=await enroll.Content.ReadFromJsonAsync<Enrollment>(Json)??throw new InvalidDataException("Resposta de cadastro inválida.");
   if(identity.Token!=token||!Guid.TryParse(identity.DeviceId,out _))throw new InvalidDataException("Identidade inesperada.");
   ReceiverWindow.Save("identity.bin",new Identity("https://suporte.internal",token,identity.DeviceId));
   using var begin=await http.PostAsJsonAsync("api/agent/binding",new{});begin.EnsureSuccessStatusCode();
   using var proof=JsonDocument.Parse(await begin.Content.ReadAsStringAsync());
   var msh=proof.RootElement.GetProperty("msh").GetString()??"";
   UaiSuporte.Setup.Policy.CheckMeshSettings(msh);
   File.WriteAllText(Path.ChangeExtension(exe,".msh"),msh);
   var secret=proof.RootElement.GetProperty("secret").GetString();var expires=proof.RootElement.GetProperty("expires").GetInt64();
   if(secret==null||!System.Text.RegularExpressions.Regex.IsMatch(secret,"\\A[a-f0-9]{64}\\z")||expires<=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())throw new InvalidDataException("Desafio inválido.");
   File.WriteAllText(exe+".uai-binding.json",JsonSerializer.Serialize(new{secret,expires}));
   report("Confirmando identidade do MeshAgent pelo canal autenticado. Acesso remoto ainda indisponível…");
   mesh.Start(exe,MeshHash);
   bool bound=false;
   for(int i=0;i<25;i++){
    await Task.Delay(2000);
    if(!mesh.Running)throw new InvalidOperationException("MeshAgent não permaneceu em execução durante o vínculo.");
    using var confirm=await http.PostAsJsonAsync("api/agent/binding/confirm",new{});confirm.EnsureSuccessStatusCode();
    using var result=JsonDocument.Parse(await confirm.Content.ReadAsStringAsync());
    if(result.RootElement.GetProperty("bound").GetBoolean()){bound=true;break;}
   }
   if(!bound)throw new InvalidOperationException("Motor não confirmou o vínculo no prazo. Nenhum acesso foi habilitado.");
   if(!mesh.Stop())throw new InvalidOperationException("Encerramento do processo de cadastro não confirmado.");
   File.Delete(exe+".uai-binding.json");
   ReceiverWindow.Save("setup.bin",new Setup("https://suporte.internal",exe,MeshHash,null));
   File.Delete(Path.Combine(Storage,"pending-enrollment.bin"));
   report("Cadastro e identidade Mesh confirmados. Abra o aplicativo pelo menu Iniciar para disponibilizar este computador.");
  } finally {mesh.Stop();}
 }
 // Installation prepares signed local components only. First activation claims the device.
 public static void PrepareForActivation(string source) {
  if(HasIdentity || Directory.Exists(Path.Combine(Storage,"Mesh"))) throw new InvalidOperationException("Cadastro local existente; nenhum arquivo foi substituído.");
  if(!Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(source))).Equals(MeshHash,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Hash do MeshAgent recusado.");
  UaiSuporte.Setup.Authenticode.RequireValid(source);
  var folder=Directory.CreateDirectory(Path.Combine(Storage,"Mesh"));
  var acl=new System.Security.AccessControl.DirectorySecurity();acl.SetAccessRuleProtection(true,false);
  using var user=System.Security.Principal.WindowsIdentity.GetCurrent();
  var owner=user.User??throw new InvalidOperationException();acl.SetOwner(owner);
  foreach(var sid in new[]{owner,new System.Security.Principal.SecurityIdentifier("S-1-5-18"),new System.Security.Principal.SecurityIdentifier("S-1-5-32-544")})
   acl.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(sid,System.Security.AccessControl.FileSystemRights.FullControl,System.Security.AccessControl.InheritanceFlags.ContainerInherit|System.Security.AccessControl.InheritanceFlags.ObjectInherit,System.Security.AccessControl.PropagationFlags.None,System.Security.AccessControl.AccessControlType.Allow));
  System.IO.FileSystemAclExtensions.SetAccessControl(folder,acl);
  string exe=Path.Combine(folder.FullName,"MeshAgent.exe");File.Copy(source,exe,false);
  ReceiverWindow.Save("setup.bin",new Setup("https://suporte.internal",exe,MeshHash,null));
 }
 public static async Task CompleteBinding(Func<string,string,Task<string>> register, CancellationToken cancellation) {
  cancellation.ThrowIfCancellationRequested();
  RequireCommittedInstallation();
  var settings=ReceiverWindow.Read<Setup>("setup.bin")??throw new InvalidOperationException("Instalação não preparada.");
  if(settings.Server!="https://suporte.internal"||settings.MeshSha256!=MeshHash)throw new InvalidDataException();
  if(HasIdentity) {
   using var check=Client();var existing=ReceiverWindow.Read<Identity>("identity.bin")??throw new InvalidDataException();
   check.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",existing.Token);
   using var response=await check.GetAsync("api/agent/identity");response.EnsureSuccessStatusCode();
   using var result=JsonDocument.Parse(await response.Content.ReadAsStringAsync());
   if(result.RootElement.GetProperty("deviceId").GetString()!=existing.DeviceId)throw new InvalidDataException();
   if(result.RootElement.GetProperty("bound").GetBoolean())return;
  }
  var pendingPath=Path.Combine(Storage,"account-registration.bin");
  var pending=File.Exists(pendingPath)?ReceiverWindow.Read<AccountRegistration>("account-registration.bin"):null;
  if(pending==null){pending=new(Guid.NewGuid().ToString(),Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+','-').Replace('/','_'));ReceiverWindow.Save("account-registration.bin",pending);}
  // Persisted BEFORE HTTP: timeout retries reuse identity; uninstall can revoke a lost response.
  string deviceId=HasIdentity?(ReceiverWindow.Read<Identity>("identity.bin")??throw new InvalidDataException()).DeviceId:await register(pending.InstallationId,pending.Credential);
  cancellation.ThrowIfCancellationRequested();
  if(!Guid.TryParse(deviceId,out _))throw new InvalidDataException();
  if(!HasIdentity)ReceiverWindow.Save("identity.bin",new Identity(settings.Server,pending.Credential,deviceId));
  var linked=ReceiverWindow.Read<Identity>("identity.bin")??throw new InvalidDataException();
  using var http=Client();http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",linked.Token);
  using var begin=await http.PostAsJsonAsync("api/agent/binding",new{});begin.EnsureSuccessStatusCode();
  using var proof=JsonDocument.Parse(await begin.Content.ReadAsStringAsync());
  string msh=proof.RootElement.GetProperty("msh").GetString()??"";UaiSuporte.Setup.Policy.CheckMeshSettings(msh);
  var secret=proof.RootElement.GetProperty("secret").GetString();var expires=proof.RootElement.GetProperty("expires").GetInt64();
  if(secret==null||!System.Text.RegularExpressions.Regex.IsMatch(secret,"\\A[a-f0-9]{64}\\z")||expires<=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())throw new InvalidDataException();
  string exe=settings.MeshExe;File.WriteAllText(Path.ChangeExtension(exe,".msh"),msh);
  File.WriteAllText(exe+".uai-binding.json",JsonSerializer.Serialize(new{secret,expires}));
  using var mesh=new ManagedMesh();
  try {
   cancellation.ThrowIfCancellationRequested();
   mesh.Start(exe,MeshHash);
   bool bound=false;
   for(int i=0;i<25;i++){
    await Task.Delay(2000,cancellation);if(!mesh.Running)throw new InvalidOperationException("Vínculo interrompido.");
    using var confirm=await http.PostAsJsonAsync("api/agent/binding/confirm",new{});confirm.EnsureSuccessStatusCode();
    using var response=JsonDocument.Parse(await confirm.Content.ReadAsStringAsync());
    if(response.RootElement.GetProperty("bound").GetBoolean()){bound=true;break;}
   }
   if(!bound)throw new InvalidOperationException("Vínculo não confirmado. Tente novamente para retomar.");
   if(!mesh.Stop())throw new InvalidOperationException("Parada do processo não confirmada.");
  } finally {mesh.Stop();File.Delete(exe+".uai-binding.json");}
 }
 public static (string Id,string Credential)? DeviceIdentity() {
  if(!HasIdentity)return null;
  var i=ReceiverWindow.Read<Identity>("identity.bin")??throw new InvalidDataException();
  if(i.Server!="https://suporte.internal")throw new InvalidDataException();
  return (i.DeviceId,i.Token);
 }
 public static async Task Activate(string token,CancellationToken cancellation) {
  RequireCommittedInstallation();
  Identity? existing=HasIdentity?ReceiverWindow.Read<Identity>("identity.bin"):null;
  bool recover=false;
  if(existing!=null) {
   using var check=Client();check.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",existing.Token);
   using var response=await check.GetAsync("api/agent/identity",cancellation);
   if(response.StatusCode==System.Net.HttpStatusCode.Unauthorized)recover=true;
   else response.EnsureSuccessStatusCode();
  }
  if(existing==null||recover) {
   string file=recover?"activation-recovery.bin":"account-registration.bin";
   var pending=File.Exists(Path.Combine(Storage,file))?ReceiverWindow.Read<AccountRegistration>(file):null;
   if(pending==null){pending=new(Guid.NewGuid().ToString(),Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+','-').Replace('/','_'));ReceiverWindow.Save(file,pending);}
   using var http=Client();
   using var response=await http.PostAsJsonAsync("api/agent/activate",new{token,installationId=pending.InstallationId,credential=pending.Credential,name=Environment.MachineName,os=Environment.OSVersion.VersionString,recoverDeviceId=recover?existing?.DeviceId:null},cancellation);
   if(!response.IsSuccessStatusCode) {
    using var error=JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
    string message=error.RootElement.TryGetProperty("message",out var m)?m.GetString()??"":"";
    var safe=new[]{"Token inválido.","Token expirado.","Token revogado.","Token já utilizado.","Credencial revogada. Solicite reativação administrativa.","Muitas solicitações. Aguarde um minuto.","Use o token autorizado para este cadastro."};
    throw new InvalidOperationException(safe.Contains(message)?message:"Ativação recusada. Solicite orientação administrativa.");
   }
   using var result=JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
   string id=result.RootElement.GetProperty("deviceId").GetString()??"";
   if(!Guid.TryParse(id,out _)||(recover&&id!=existing?.DeviceId))throw new InvalidDataException();
   ReceiverWindow.Save("identity.bin",new Identity("https://suporte.internal",pending.Credential,id,result.RootElement.GetProperty("code").GetString()));
   ReceiverWindow.Save("account-registration.bin",pending);
   if(recover)File.Delete(Path.Combine(Storage,"activation-recovery.bin"));
  }
  await CompleteBinding((_,_)=>throw new InvalidOperationException("Cadastro pendente."),cancellation);
 }
 record AccountRegistration(string InstallationId,string Credential);
 public static async Task Revoke(){
  var tokens=new HashSet<string>();
  if(HasIdentity) {var identity=ReceiverWindow.Read<Identity>("identity.bin");if(identity!=null)tokens.Add(identity.Token);}
  if(File.Exists(Path.Combine(Storage,"pending-enrollment.bin"))){var p=ReceiverWindow.Read<PendingEnrollment>("pending-enrollment.bin");if(p!=null)tokens.Add(p.Credential);}
  foreach(string file in new[]{"account-registration.bin","activation-recovery.bin"}) {
   if(File.Exists(Path.Combine(Storage,file))){var p=ReceiverWindow.Read<AccountRegistration>(file);if(p!=null)tokens.Add(p.Credential);}
  }
  foreach(string token in tokens) {
   using var http=Client();http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",token);
   using var response=await http.PostAsJsonAsync("api/agent/unregister",new{});
   if(response.StatusCode!=System.Net.HttpStatusCode.Unauthorized)response.EnsureSuccessStatusCode();
  }
 }
}
