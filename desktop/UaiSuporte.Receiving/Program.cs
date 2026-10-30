using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Win32;
namespace UaiSuporte.Agent;
record Setup(string Server,string MeshExe,string MeshSha256,string? EnrollmentCode);
record Identity(string Server,string Token,string DeviceId,string? Code=null);
record Enrollment(string DeviceId,string Token);
record PendingEnrollment(string CodeHash,string Credential);
record Request(Guid Id,string Mode,string Status,DateTimeOffset Expires_At,string Technician);
record Heartbeat(List<Request> Requests);
public sealed class ReceiverWindow:Form {
 static readonly string Storage=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"UaiTelecom","UaiSuporte");
 static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web){PropertyNameCaseInsensitive=true};
 readonly HttpClient http=new(new HttpClientHandler{AllowAutoRedirect=false}){Timeout=TimeSpan.FromSeconds(10)};
 readonly MonitoringCollector collector=new();
 readonly MonitoringSchedule schedule=new();
 bool reconnecting,authBlocked;
 readonly ManagedMesh mesh=new();readonly System.Windows.Forms.Timer timer=new(){Interval=3000};
 readonly Label status=new(){AutoSize=true,MaximumSize=new(570,0),Text="Preparando conexão…"};
 readonly Label identification=new(){AutoSize=true,MaximumSize=new(570,0)};
 readonly Button stop=new(){Text="ENCERRAR AGORA",AutoSize=true,BackColor=Color.Firebrick,ForeColor=Color.White};
 readonly Button resume=new(){Text="Retomar disponibilidade",AutoSize=true,Enabled=false};
 SessionIndicator? indicator;
 Setup? setup;Identity? identity;List<Request> current=[];HashSet<Guid> prompted=[];bool paused=true,polling,closing,locked;
 static void Log(string code){try{Directory.CreateDirectory(Storage);var p=Path.Combine(Storage,"client.log");if(File.Exists(p)&&new FileInfo(p).Length>1048576)File.Move(p,p+".1",true);File.AppendAllText(p,$"{DateTimeOffset.UtcNow:O} {code}\n");}catch{}}
 static byte[] Entropy() {
  using var key=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
  string machine=key?.GetValue("MachineGuid") as string??throw new InvalidDataException("Identidade Windows indisponível.");
  return SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("UaiSuporte:v2:"+machine));
 }
 internal static T? Read<T>(string file) {
  byte[] data=File.ReadAllBytes(Path.Combine(Storage,file));bool version2=data.Length>4&&data.AsSpan(0,4).SequenceEqual("UAI2"u8);
  byte[] clear=ProtectedData.Unprotect(version2?data[4..]:data,version2?Entropy():null,DataProtectionScope.CurrentUser);
  try {var value=JsonSerializer.Deserialize<T>(clear,Json);if(!version2&&value!=null)Save(file,value);return value;}finally{CryptographicOperations.ZeroMemory(clear);}
 }
 internal static void Save<T>(string file,T data) {
  var folder=Directory.CreateDirectory(Storage);
  var acl=new System.Security.AccessControl.DirectorySecurity();acl.SetAccessRuleProtection(true,false);
  using var user=System.Security.Principal.WindowsIdentity.GetCurrent();var owner=user.User??throw new InvalidOperationException();acl.SetOwner(owner);
  foreach(var sid in new[]{owner,new System.Security.Principal.SecurityIdentifier("S-1-5-18"),new System.Security.Principal.SecurityIdentifier("S-1-5-32-544")})
   acl.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(sid,System.Security.AccessControl.FileSystemRights.FullControl,System.Security.AccessControl.InheritanceFlags.ContainerInherit|System.Security.AccessControl.InheritanceFlags.ObjectInherit,System.Security.AccessControl.PropagationFlags.None,System.Security.AccessControl.AccessControlType.Allow));
  System.IO.FileSystemAclExtensions.SetAccessControl(folder,acl);
  var destination=Path.Combine(Storage,file);var temp=destination+".new";
  byte[] clear=JsonSerializer.SerializeToUtf8Bytes(data,Json);
  try {byte[] encrypted=ProtectedData.Protect(clear,Entropy(),DataProtectionScope.CurrentUser);File.WriteAllBytes(temp,[.."UAI2"u8.ToArray(),..encrypted]);File.Move(temp,destination,true);}
  finally{CryptographicOperations.ZeroMemory(clear);}
 }
 public ReceiverWindow(){
  Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);
  Text="Uai Suporte • computador atendido";Size=new(640,430);MinimumSize=Size;StartPosition=FormStartPosition.CenterScreen;Font=new("Segoe UI",11);BackColor=Color.White;
  var layout=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,Padding=new(24),AutoScroll=true};
  layout.Controls.Add(new Label{Text="Este computador",Font=new("Segoe UI",22,FontStyle.Bold),AutoSize=true});
  identification.Text=Environment.MachineName;layout.Controls.Add(identification);layout.Controls.Add(status);layout.Controls.Add(stop);layout.Controls.Add(resume);
  layout.Controls.Add(new Label{Text="Nenhum acesso sem consentimento.\nEncerrar interrompe o acesso remoto a este computador,\nmesmo sem rede. Fechar este aplicativo também encerra o acesso.",AutoSize=true});Controls.Add(layout);
  timer.Tick+=async(_,_)=>await Poll();
  stop.Click+=async(_,_)=>await StopLocal();resume.Click+=async(_,_)=>await Resume();
  SystemEvents.SessionSwitch+=SessionChanged;
  FormClosing+=async(_,e)=>{if(closing)return;e.Cancel=true;await Shutdown();Close();};
 }
 public async Task Initialize(){try{
  Provisioning.RequireCommittedInstallation();
  setup=Read<Setup>("setup.bin")??throw new Exception();
  if(setup.Server!="https://suporte.internal")throw new InvalidOperationException("Servidor não autorizado no pacote.");
  if(http.BaseAddress==null)http.BaseAddress=new Uri(setup.Server+"/");
  if(File.Exists(Path.Combine(Storage,"identity.bin")))identity=Read<Identity>("identity.bin");
  else { status.Text="Ative este computador usando o token fornecido pela administração."; return; }
  if(identity==null||identity.Server!=setup.Server)throw new InvalidOperationException("Identidade não corresponde ao servidor configurado.");
  DeviceCode=identity.Code??identity.DeviceId;
  http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",identity.Token);
  using(var check=await http.GetAsync("api/agent/identity")){
   if(!check.IsSuccessStatusCode)throw new InvalidOperationException("Credencial revogada ou inválida. A TI deve recuperar o mesmo cadastro; nenhum dispositivo duplicado foi criado.");
   using var data=JsonDocument.Parse(await check.Content.ReadAsStringAsync());
   if(data.RootElement.GetProperty("deviceId").GetString()!=identity.DeviceId)throw new InvalidOperationException("Identidade do dispositivo divergente.");
   DeviceCode=data.RootElement.GetProperty("code").GetString();
   identity=identity with {Code=DeviceCode};Save("identity.bin",identity);
   if(!data.RootElement.GetProperty("bound").GetBoolean()){status.Text="Cadastro incompleto. Retome a ativação para concluir o vínculo.";return;}
  }
  setup=setup with {EnrollmentCode=null};Save("setup.bin",setup);
  File.Delete(Path.Combine(Storage,"pending-enrollment.bin"));
  identification.Text=$"{Environment.MachineName}\nIdentificação: {DeviceCode}";
  NeedsRegistration=false;authBlocked=false;
  await Resume();
  if(!paused) {
   try { StartupRegistration.EnsureVisibleStartup(Application.ExecutablePath);Log("VISIBLE_USER_STARTUP_REGISTERED"); }
   catch { await StopLocal();throw new InvalidOperationException("Inicialização automática não confirmada. A TI deve revisar o atalho; novas conexões suspensas."); }
  }
  timer.Start();Log("CLIENT_READY");
 }catch(HttpRequestException e){status.Text=e.HttpRequestError==HttpRequestError.SecureConnectionError?"Certificado TLS recusado. Solicite à TI a conferência da CA.":"Servidor indisponível. Feche e reabra quando a conexão voltar.";Log("INITIAL_NETWORK_OR_TLS_FAILED");if(identity!=null&&e.HttpRequestError!=HttpRequestError.SecureConnectionError){reconnecting=true;schedule.Failure(DateTimeOffset.UtcNow,0);timer.Start();}}
 catch(Exception e){status.Text=e is FileNotFoundException?"Preparação pela TI pendente. Nenhuma configuração é exigida do funcionário.":"Não foi possível preparar o cliente. "+e.Message;Log("SETUP_REQUIRED");}}
 public bool NeedsRegistration { get; private set; } = true;
 public void PreparationStatus(string message) { if(!closing) status.Text=message; }
 public string? DeviceCode {get;private set;}
 public bool SessionActive => current.Any(r=>r.Status=="ACTIVE");
 public string ConnectionState => status.Text;
 public async Task Shutdown(){if(closing)return;closing=true;await StopLocal();SystemEvents.SessionSwitch-=SessionChanged;mesh.Dispose();http.Dispose();timer.Dispose();}
 async Task ReportEvent(string code){try{if(identity!=null){using var r=await http.PostAsJsonAsync("api/agent/events",new{code});}}catch{}}
 async Task Resume(){if(setup==null||identity==null||locked||authBlocked)return;resume.Enabled=false;try{
  using(var check=await http.GetAsync("api/agent/identity")){if(check.StatusCode==System.Net.HttpStatusCode.Unauthorized){authBlocked=true;throw new InvalidOperationException();}check.EnsureSuccessStatusCode();using var data=JsonDocument.Parse(await check.Content.ReadAsStringAsync());if(!data.RootElement.GetProperty("bound").GetBoolean())throw new InvalidOperationException();}
  // Clear all previous authorizations before creating a new native transport.
  using var off=await http.PostAsJsonAsync("api/agent/offline",new{});off.EnsureSuccessStatusCode();
  if(!mesh.Stop())throw new InvalidOperationException("Encerramento local anterior não confirmado.");
  mesh.Start(setup.MeshExe,setup.MeshSha256);paused=false;prompted.Clear();await Poll();
 }catch{paused=true;mesh.Stop();await ReportEvent("AGENT_START_FAILED");status.Text="Indisponível. Verifique a conexão ou solicite ajuda à TI.";resume.Enabled=true;}}
 public async Task StopLocal(){reconnecting=false;paused=true;timer.Stop();TopMost=false;BackColor=Color.White;
  bool stopped=mesh.Stop();if(!stopped)await ReportEvent("AGENT_STOP_FAILED");if(stopped){indicator?.Dispose();indicator=null;}Log(stopped?"LOCAL_PROCESS_STOP_CONFIRMED":"LOCAL_PROCESS_STOP_FAILED");
  status.Text=stopped?"Acesso local interrompido. Confirmando registro no servidor…":"Falha ao confirmar parada local. Use o botão de encerramento da barra de acesso e acione a TI.";
  try{if(identity!=null){using var response=await http.PostAsJsonAsync("api/agent/offline",new{});response.EnsureSuccessStatusCode();status.Text=stopped?"Atendimento encerrado. Computador indisponível até você retomar.":status.Text;}}
  catch{if(stopped)status.Text="Componente de acesso remoto encerrado. Servidor inacessível; registro de término ainda não confirmado.";}
  current.Clear();resume.Enabled=!closing&&!locked&&stopped;timer.Start();
 }
 async Task Poll(){
  if(identity==null||polling||closing||locked)return;
  if(paused){if(reconnecting&&!authBlocked&&schedule.Due(DateTimeOffset.UtcNow)){reconnecting=false;await Resume();if(paused){reconnecting=true;schedule.Failure(DateTimeOffset.UtcNow,Random.Shared.NextDouble()*.2-.1);}}return;}
  polling=true;try{
  if(!mesh.Running){await ReportEvent("AGENT_DISCONNECTED");throw new IOException("Motor local desconectado");}
  var now=DateTimeOffset.UtcNow;
  if(schedule.Due(now)) {
   bool collect=schedule.MetricsDue(now);
   MonitoringCollector.Sample? metrics=null;
   if(collect){try{metrics=await Task.Run(()=>collector.Collect());}catch{Log("METRICS_UNAVAILABLE");}}
   if(paused||closing||locked)return;
   using var presence=await http.PostAsJsonAsync("api/agent/presence",new {
    machineName=Environment.MachineName,os=System.Runtime.InteropServices.RuntimeInformation.OSDescription,
    windowsUser=Environment.UserDomainName+"\\"+Environment.UserName,
    appVersion=typeof(ReceiverWindow).Assembly.GetName().Version?.ToString()??"unknown",
    agentVersion="legacy-1.2.6 LAB",internalIp=MonitoringCollector.InternalIp(),uptimeSeconds=Environment.TickCount64/1000,
    health=mesh.Running?"OK":"STOPPED",metrics});
   presence.EnsureSuccessStatusCode();
   using var config=JsonDocument.Parse(await presence.Content.ReadAsStringAsync());
   schedule.Configure(config.RootElement.GetProperty("heartbeatSeconds").GetInt32(),config.RootElement.GetProperty("metricsSeconds").GetInt32());
   schedule.Success(now,collect,Random.Shared.NextDouble()*.2-.1);
  }
  using var response=await http.GetAsync("api/agent/requests");response.EnsureSuccessStatusCode();
  if(paused||closing||locked)return;
  current=(await response.Content.ReadFromJsonAsync<Heartbeat>(Json))?.Requests??[];
  if(!current.Any(r=>r.Status!="PENDING")){indicator?.Dispose();indicator=null;}
  bool active=current.Any(r=>r.Status=="ACTIVE");TopMost=active;BackColor=active?Color.Moccasin:Color.White;
  status.Text=active?"ATENDIMENTO ATIVO • sua tela está sendo compartilhada":current.Count>0?"Solicitação em andamento • confirme a autorização do Uai Suporte":"Online • aguardando solicitação de acesso";
  foreach(var r in current.Where(x=>x.Status=="PENDING"&&x.Expires_At>DateTimeOffset.UtcNow)){
   if(!prompted.Add(r.Id))continue;Activate();
   using var consent=new ConsentDialog(r);consent.ShowDialog(this);
   var decision=locked||paused?"reject":consent.Decision;
   if(decision is "accept" or "accept-view") {
    indicator?.Dispose();
    indicator=new SessionIndicator(r.Technician,decision=="accept-view"?"VIEW":r.Mode,()=>{if(!IsDisposed)BeginInvoke((Action)(async()=>await StopLocal()));});
   }
   using var result=await http.PostAsJsonAsync($"api/agent/sessions/{r.Id}/{decision}",new{});result.EnsureSuccessStatusCode();Log("CONSENT_"+decision.ToUpperInvariant());
  }
 }catch(HttpRequestException e){bool retry=!paused&&!closing&&!locked;authBlocked=e.StatusCode==System.Net.HttpStatusCode.Unauthorized||e.StatusCode==System.Net.HttpStatusCode.Forbidden||e.HttpRequestError==HttpRequestError.SecureConnectionError;await StopLocal();reconnecting=retry&&!authBlocked;schedule.Failure(DateTimeOffset.UtcNow,Random.Shared.NextDouble()*.2-.1);if(!closing)status.Text+=" Novas conexões suspensas.";}
 catch{bool retry=!paused&&!closing&&!locked;await StopLocal();reconnecting=retry;schedule.Failure(DateTimeOffset.UtcNow,Random.Shared.NextDouble()*.2-.1);}finally{polling=false;}}
 void SessionChanged(object? sender,SessionSwitchEventArgs e){if(IsDisposed)return;BeginInvoke((Action)(async()=>{if(e.Reason==SessionSwitchReason.SessionLock){locked=true;await StopLocal();}else if(e.Reason==SessionSwitchReason.SessionUnlock){locked=false;resume.Enabled=true;}}));}
}
sealed class ConsentDialog:Form {
 public string Decision{get;private set;}="reject";
 public ConsentDialog(Request r){Text="Uai Telecom • consentimento local";Size=new(550,280);StartPosition=FormStartPosition.CenterParent;TopMost=true;ControlBox=true;
 var panel=new FlowLayoutPanel{Dock=DockStyle.Fill,Padding=new(20),FlowDirection=FlowDirection.TopDown};
 panel.Controls.Add(new Label{Text=$"{r.Technician} solicita {(r.Mode=="VIEW"?"visualizar sua tela":"visualização e controle")}.\nPrazo máximo de laboratório: 60 segundos.\nConfirme a autorização de acesso antes da transmissão.",AutoSize=true,MaximumSize=new(480,0)});
 void Add(string text,string value){var button=new Button{Text=text,AutoSize=true};button.Click+=(_,_)=>{Decision=value;Close();};panel.Controls.Add(button);}
 Add("Recusar","reject");Add("Permitir somente visualização","accept-view");if(r.Mode=="CONTROL")Add("Permitir visualização e controle","accept");Controls.Add(panel);
 }
}
