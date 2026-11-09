using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using UaiSuporte.Agent;
namespace UaiSuporte.Service;
// No Form, WebView, screen or input APIs in this process. Mesh owns its Windows capture integration.
sealed class ServiceRuntime:IDisposable {
 readonly HttpClient http=new(new HttpClientHandler{AllowAutoRedirect=false}){BaseAddress=new("https://suporte.internal/"),Timeout=TimeSpan.FromSeconds(10)};
 readonly MonitoringSchedule schedule=new();readonly MonitoringCollector collector=new();readonly ManagedMesh mesh=new();
 readonly SemaphoreSlim gate=new(1,1);readonly object motorLock=new();readonly PresenterLease lease=new();readonly SessionStopFence stopFence=new();
 Identity? identity;UaiSuporte.Agent.Setup? setup;Request[] requests=[];string state="Conectando",fault="";bool blocked,bound,offPending,identityChecked;Guid? accepted;long nextRequests;
 readonly HashSet<string> nativeSeen=[];
 int strikes;long nextActivation;long stopEpoch;string stopReason="LOCAL_STOP";
 static readonly JsonSerializerOptions Json=ServiceProtocol.Json;
 static LocalReply Reply(int status,object body)=>new(status,JsonSerializer.Serialize(body,Json));
 static void Log(string code){try{string p=Path.Combine(DeviceStore.Root,"service.log");if(File.Exists(p)&&new FileInfo(p).Length>1048576)File.Move(p,p+".1",true);File.AppendAllText(p,$"{DateTimeOffset.UtcNow:O} {code}\n");}catch{}}
 void Load(){setup=DeviceStore.Read<UaiSuporte.Agent.Setup>("setup.bin");identity=Provisioning.HasIdentity?DeviceStore.Read<Identity>("identity.bin"):null;if(identity!=null){if(identity.Server!="https://suporte.internal")throw new InvalidDataException();http.DefaultRequestHeaders.Authorization=new("Bearer",identity.Token);http.DefaultRequestHeaders.Remove("X-Uai-Device");http.DefaultRequestHeaders.Add("X-Uai-Device",identity.DeviceId);}}
 public void Start(CancellationToken ct){try{Provisioning.RequireCommittedInstallation();Load();if(identity!=null)offPending=true;}catch{fault="Cadastro corrompido ou incompleto. Solicite recuperação administrativa.";blocked=true;}Log("SERVICE_START");_=NetworkLoop(ct);_=PipeLoop(ct);_=EmergencyLoop(ct);_=Watchdog(ct);}
 public void SessionChanged(){StopMotor("WINDOWS_SESSION_CHANGED");lock(motorLock)lease.Clear();}
 bool StopMotor(string reason){lock(motorLock){
  foreach(var r in requests.Where(r=>r.Id==accepted||r.Status=="PENDING"))Log("UAI_LOCAL_TRANSITION "+JsonSerializer.Serialize(new{session=r.Id,target=identity?.DeviceId,mode=r.Mode,previous=r.Status,next="STOP_REQUESTED",component="WINDOWS_SERVICE",at=DateTimeOffset.UtcNow,code=reason}));
  stopFence.Stop(requests.Select(r=>r.Id).Concat(accepted.HasValue?new[]{accepted.Value}:Array.Empty<Guid>()));
  bool stopped=true;
  if(mesh.Running||accepted!=null){stopped=mesh.Stop();if(!stopped)Log("MOTOR_STOP_FAILED");offPending=true;stopEpoch++;stopReason=reason.Contains("PRESENTER")?"PRESENTER_LOST":reason.Contains("SESSION_CHANGED")||reason.Contains("LOCKED")?"SESSION_CHANGED":reason.Contains("NETWORK")?"NETWORK_FAILURE":reason=="SERVICE_STOP"?"SERVICE_STOP":"LOCAL_STOP";Log(reason);}
  if(stopped)accepted=null;else lease.Clear();
  requests=[];return stopped;
 }}
 async Task Watchdog(CancellationToken ct){try{while(!ct.IsCancellationRequested){lock(motorLock){if((mesh.Running||accepted.HasValue)&&(!lease.Live(lease.Pid,Environment.TickCount64)||!LocalChannel.PresenterCurrent(lease.Pid)||(mesh.Running&&mesh.SessionId!=LocalChannel.ActiveSession())||(accepted.HasValue&&lease.Displayed!=accepted)))StopMotor("PRESENTER_LOST_STOP");}await Task.Delay(500,ct);}}catch(OperationCanceledException){}catch{StopMotor("WATCHDOG_FAILED");}}
 async Task NetworkLoop(CancellationToken ct){try{while(!ct.IsCancellationRequested){await gate.WaitAsync(ct);try{await Tick(ct);}catch(HttpRequestException e){blocked=e.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden;fault=e.HttpRequestError==HttpRequestError.SecureConnectionError?"Certificado TLS recusado.":blocked?"Credencial revogada. Solicite reativação administrativa.":"Servidor indisponível.";state="Offline";StopMotor("NETWORK_FAILED_STOP");schedule.Failure(DateTimeOffset.UtcNow,Random.Shared.NextDouble()*.2-.1);nextRequests=Environment.TickCount64+5000;}catch(Exception e) when(e is not OperationCanceledException){state="Offline";fault="Componente interno indisponível. Consulte a TI.";StopMotor("LOCAL_COMPONENT_FAILED");schedule.Failure(DateTimeOffset.UtcNow,0);}finally{gate.Release();}await Task.Delay(1000,ct);}}catch(OperationCanceledException){}finally{StopMotor("SERVICE_STOP");}}
 async Task Tick(CancellationToken ct){
  if(identity==null||blocked)return;
  var now=DateTimeOffset.UtcNow;bool due=schedule.Due(now);
  if(!due&&state=="Offline")return;
  if(offPending){long epoch;string reason;lock(motorLock){epoch=stopEpoch;reason=stopReason;}using var off=await http.PostAsJsonAsync("api/agent/stop-access",new{reason},ct);off.EnsureSuccessStatusCode();lock(motorLock){if(epoch==stopEpoch)offPending=false;}}
  if(due&&!identityChecked){
   using var check=await http.GetAsync("api/agent/identity",ct);check.EnsureSuccessStatusCode();using var data=JsonDocument.Parse(await check.Content.ReadAsStringAsync(ct));
   if(data.RootElement.GetProperty("deviceId").GetString()!=identity.DeviceId)throw new InvalidDataException();
   identityChecked=true;bound=data.RootElement.GetProperty("bound").GetBoolean();string? code=data.RootElement.GetProperty("code").GetString();if(code!=identity.Code){identity=identity with{Code=code};DeviceStore.Save("identity.bin",identity);}
  }
  lock(motorLock){if(!offPending&&bound&&setup!=null&&lease.Live(lease.Pid,Environment.TickCount64)&&LocalChannel.PresenterCurrent(lease.Pid)&&!mesh.Running){
   int session=LocalChannel.ActiveSession(),presenter=lease.Pid;
   bool Authorized()=>!offPending&&bound&&lease.Pid==presenter&&lease.Live(presenter,Environment.TickCount64)&&LocalChannel.PresenterCurrent(presenter)&&LocalChannel.ActiveSession()==session;
   try{mesh.StartInteractive(setup.MeshExe,setup.MeshSha256,session,Authorized);}
   catch(MeshLaunchException e){Log("MOTOR_START_FAILED "+JsonSerializer.Serialize(new{stage=e.Stage,win32Code=e.NativeErrorCode,targetSession=session,requestedTokenAccess=e.RequestedTokenAccess,tcbInitiallyEnabled=e.CallerTcbInitiallyEnabled,primaryInitiallyEnabled=e.CallerPrimaryInitiallyEnabled}));throw;}
   Log("MOTOR_STARTED");Log("MOTOR_PLACEMENT "+JsonSerializer.Serialize(new{enginePid=mesh.ProcessId,engineSession=mesh.SessionId,activeSession=session,killOnJobClose=true}));
  }}
  if(due){
   bool collect=schedule.MetricsDue(now);MonitoringCollector.Sample? sample=collect?collector.Collect():null;
   using var response=await http.PostAsJsonAsync("api/agent/presence",new{machineName=Environment.MachineName,os=System.Runtime.InteropServices.RuntimeInformation.OSDescription,windowsUser=LocalChannel.ActiveUser(),appVersion=typeof(ReceiverWindow).Assembly.GetName().Version!.ToString(),agentVersion="legacy-1.2.6 LAB",internalIp=MonitoringCollector.InternalIp(),uptimeSeconds=Environment.TickCount64/1000,health=bound?mesh.Running?"OK":"STOPPED":"UNBOUND",serviceState="RUNNING",observedAt=now,metrics=sample},ct);
   response.EnsureSuccessStatusCode();using var config=JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));schedule.Configure(config.RootElement.GetProperty("heartbeatSeconds").GetInt32(),config.RootElement.GetProperty("metricsSeconds").GetInt32());schedule.Success(now,collect,Random.Shared.NextDouble()*.2-.1);state="Online";fault="";
  }
  if(!mesh.Running||Environment.TickCount64<nextRequests)return;
  nextRequests=Environment.TickCount64+5000;
  long pollEpoch;lock(motorLock)pollEpoch=stopFence.Epoch;
  using var pending=await http.GetAsync("api/agent/requests",ct);pending.EnsureSuccessStatusCode();var received=(await pending.Content.ReadFromJsonAsync<Heartbeat>(Json,ct))?.Requests.ToArray()??[];
  lock(motorLock){if(pollEpoch!=stopFence.Epoch)return;requests=received.Where(r=>stopFence.Allows(r.Id,pollEpoch)).ToArray();}
  if(accepted.HasValue&&!requests.Any(x=>x.Id==accepted.Value&&x.Expires_At>DateTimeOffset.UtcNow)){StopMotor("SESSION_ENDED");}
  foreach(var r in requests.ToArray()){
   var diagnostic=NativeConsentDiagnostic.Parse(r.Native_Diagnostic);if(diagnostic==null)continue;
   int active=LocalChannel.ActiveSession();
   int actual=diagnostic.HelperPid>0&&setup!=null?NativeConsentWindow.VerifiedSession(diagnostic.HelperPid,setup.MeshExe):-1;
   var placement=(actual>=0?diagnostic with{HelperSession=actual}:diagnostic).Placement(active);
   string key=r.Id+":"+r.Native_Diagnostic+":"+active+":"+actual;
   if(nativeSeen.Count>512)nativeSeen.Clear();
   if(nativeSeen.Add(key))Log("UAI_NATIVE_CONSENT "+JsonSerializer.Serialize(new{session=r.Id,stage=diagnostic.Stage,targetSession=diagnostic.TargetSession,engineSession=diagnostic.EngineSession,consoleSession=diagnostic.ConsoleSession,helperPid=diagnostic.HelperPid,helperSession=diagnostic.HelperSession,verifiedHelperSession=actual,activeSession=active,code=placement,at=DateTimeOffset.UtcNow}));
   if(placement is "DIALOG_SESSION_ZERO" or "DIALOG_WRONG_SESSION"){StopMotor(placement);break;}
  }
  state=requests.Any(x=>x.Status=="ACTIVE")?"Em atendimento":"Online";
 }
 async Task EmergencyLoop(CancellationToken ct){while(!ct.IsCancellationRequested){try{
  using var pipe=LocalChannel.Server(true);await pipe.WaitForConnectionAsync(ct);LocalChannel.Authenticate(pipe);
  using var deadline=CancellationTokenSource.CreateLinkedTokenSource(ct);deadline.CancelAfter(1500);
  var command=await ServiceProtocol.Read<LocalCommand>(pipe,deadline.Token);
  if(command.Action!="stop"||!ServiceProtocol.Allowed(command))throw new UnauthorizedAccessException();
  bool stopped=StopMotor("LOCAL_STOP_PRIORITY");Log(stopped?"LOCAL_STOP_CONFIRMED":"LOCAL_STOP_UNCONFIRMED");using var replyDeadline=CancellationTokenSource.CreateLinkedTokenSource(ct);replyDeadline.CancelAfter(1500);await ServiceProtocol.Write(pipe,Reply(stopped?200:503,new{}),replyDeadline.Token);
 }catch(OperationCanceledException) when(ct.IsCancellationRequested){break;}catch{try{await Task.Delay(100,ct);}catch(OperationCanceledException){break;}}}}
 readonly SemaphoreSlim clients=new(3,3);
 async Task PipeLoop(CancellationToken ct){while(!ct.IsCancellationRequested){try{await clients.WaitAsync(ct);var pipe=LocalChannel.Server();await pipe.WaitForConnectionAsync(ct);_=Serve(pipe,ct);}catch(OperationCanceledException){break;}catch{clients.Release();await Task.Delay(1000,ct);}}}
 async Task Serve(System.IO.Pipes.NamedPipeServerStream pipe,CancellationToken ct){try{int pid=LocalChannel.Authenticate(pipe);
  using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct);timeout.CancelAfter(3000);
  var command=await ServiceProtocol.Read<LocalCommand>(pipe,timeout.Token);
  LocalReply result;
  if(!ServiceProtocol.Allowed(command))result=Reply(403,new{message="Operação local não permitida."});
  else if(command.Action=="pulse"){
   lock(motorLock){lease.Pulse(pid,Environment.TickCount64,command.Unlocked,command.Indicator?command.RequestId:null);if(!command.Unlocked)StopMotor("DESKTOP_LOCKED");}
   result=Snapshot();
  }else if(command.Action=="status")result=Snapshot();
  else if(command.Action=="stop"){result=Reply(StopMotor("LOCAL_STOP")?200:503,new{});}
  else {await gate.WaitAsync(ct);try{result=await Handle(command,pid,ct);}finally{gate.Release();}}
  using var write=CancellationTokenSource.CreateLinkedTokenSource(ct);write.CancelAfter(3000);await ServiceProtocol.Write(pipe,result,write.Token);
 }catch(Exception){Log("IPC_REQUEST_REJECTED");try{await Task.Delay(100,ct);}catch(OperationCanceledException){}}finally{pipe.Dispose();clients.Release();}}
 LocalReply Snapshot()=>Reply(200,new{code=identity?.Code,name=Environment.MachineName,registered=identity!=null,state,error=fault,blocked,bound,requests,active=accepted,version=typeof(ReceiverWindow).Assembly.GetName().Version!.ToString()});
 async Task<LocalReply> Handle(LocalCommand c,int pid,CancellationToken ct){
  try{
   if(c.Action=="activate"){
    if(Environment.TickCount64<nextActivation)return Reply(429,new{message="Aguarde antes de tentar outra ativação."});
    StopMotor("ACTIVATION_BEGIN");nextActivation=Environment.TickCount64+Math.Min(60000,1000*(1<<Math.Min(++strikes,6)));
    await Provisioning.Activate(c.Token!,ct);Load();blocked=false;bound=true;identityChecked=true;strikes=0;schedule.Configure(30,60);state="Conectando";fault="";Log("DEVICE_ACTIVATED");return Reply(200,new{});
   }
   if(identity==null||blocked)return Reply(401,new{message=blocked?fault:"Ativação necessária."});
   if(c.Action=="identity"&&(state=="Offline"||!identityChecked))return Reply(fault.StartsWith("Certificado TLS")?495:503,new{message=fault.Length>0?fault:"Conectando ao servidor. Cadastro preservado."});
   if(c.Action=="identity")return Reply(200,new{id=identity.DeviceId,name=Environment.MachineName,public_code=identity.Code,revoked=false,mesh_node=bound?"bound":null});
   if(c.Action=="history"){using var h=await http.GetAsync("api/desktop/connections",ct);h.EnsureSuccessStatusCode();using var history=JsonDocument.Parse(await h.Content.ReadAsStringAsync(ct));return Reply(200,history.RootElement.EnumerateArray().Take(20).Select(x=>x.Clone()).ToArray());}
   if(c.Action=="native-dialog"){
    lock(motorLock){
     var request=requests.SingleOrDefault(r=>r.Id==c.RequestId&&r.Id==accepted);
     var diagnostic=NativeConsentDiagnostic.Parse(request?.Native_Diagnostic);
     int active=LocalChannel.ActiveSession();
     if(setup==null||diagnostic==null||diagnostic.HelperPid!=c.DialogPid||active<1||!lease.CanAccept(pid,Environment.TickCount64,c.RequestId!.Value)||NativeConsentWindow.VerifiedSession(c.DialogPid!.Value,setup.MeshExe)!=active)return Reply(403,new{});
     Log("UAI_NATIVE_CONSENT "+JsonSerializer.Serialize(new{session=c.RequestId,stage="WINDOW_VISIBLE_REPORTED",helperPid=c.DialogPid,activeSession=active,reporterPid=pid,at=DateTimeOffset.UtcNow}));
     return Reply(200,new{});
    }
   }
   if(c.Action=="consent"){
    long decisionEpoch;lock(motorLock)decisionEpoch=stopFence.Epoch;
    var r=requests.SingleOrDefault(x=>x.Id==c.RequestId&&x.Status=="PENDING"&&x.Expires_At>DateTimeOffset.UtcNow);
    lock(motorLock){if(r==null||!stopFence.Allows(r.Id,decisionEpoch)||!lease.Live(pid,Environment.TickCount64)||!mesh.Running||accepted.HasValue||(c.Decision!="reject"&&!lease.CanAccept(pid,Environment.TickCount64,r.Id))||c.Decision=="accept"&&r.Mode!="CONTROL")return Reply(403,new{message="Consentimento não confirmado."});if(c.Decision!="reject")accepted=r.Id;}
    using var reply=await http.PostAsJsonAsync($"api/agent/sessions/{r!.Id}/{c.Decision}",new{},ct);reply.EnsureSuccessStatusCode();lock(motorLock){if(!stopFence.Allows(r.Id,decisionEpoch)){offPending=true;return Reply(409,new{message="Tentativa encerrada localmente."});}}Log("UAI_LOCAL_CONSENT "+JsonSerializer.Serialize(new{session=r.Id,decision=c.Decision,activeSession=LocalChannel.ActiveSession(),at=DateTimeOffset.UtcNow}));return Reply(200,new{});
   }
   return Reply(403,new{message="Operação local não permitida."});
  }catch(HttpRequestException e){StopMotor("IPC_NETWORK_FAILURE");return Reply(e.HttpRequestError==HttpRequestError.SecureConnectionError?495:503,new{message=e.HttpRequestError==HttpRequestError.SecureConnectionError?"Certificado TLS recusado.":"Servidor indisponível. Cadastro preservado."});}
  catch(InvalidOperationException e){StopMotor("ACTIVATION_FAILED");var safe=new[]{"Token inválido.","Token expirado.","Token revogado.","Token já utilizado.","Use o token autorizado para este cadastro."};return Reply(400,new{message=safe.Contains(e.Message)?e.Message:"Não foi possível concluir. Cadastro preservado para recuperação."});}
 }
 public void Dispose(){StopMotor("SERVICE_STOP");Log("SERVICE_STOP");}
}
