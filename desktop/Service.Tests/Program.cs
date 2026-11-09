using UaiSuporte.Agent;
using System.Buffers.Binary;
int count=0;void Check(bool v,string message){if(!v)throw new Exception(message);count++;}
Check(!new LocalCommand("activate",Token:"secret-test-only").ToString().Contains("secret-test-only"),"diagnostic redaction");
var lease=new PresenterLease();var id=Guid.NewGuid();
Check(!lease.CanAccept(42,0,id),"no presenter cannot consent");lease.Pulse(42,100,true,null);Check(!lease.CanAccept(42,101,id),"indicator mandatory");lease.Pulse(42,100,true,id);
Check(lease.CanAccept(42,101,id),"specific display acknowledged");Check(!lease.CanAccept(43,101,id),"another process cannot consent");Check(!lease.CanAccept(42,101,Guid.NewGuid()),"another request cannot consent");Check(!lease.CanAccept(42,5100,id),"frozen UI lease expires");lease.Pulse(42,200,false,id);Check(!lease.Live(42,201),"locked session stops access");
foreach(var c in new[]{new LocalCommand("shell"),new("credentials"),new("activate",Token:new string('x',101)),new("consent",RequestId:id,Decision:"auto"),new("status",Token:"secret")})Check(!ServiceProtocol.Allowed(c),"invalid IPC rejected");
foreach(var c in new[]{new LocalCommand("activate",Token:"once"),new("consent",RequestId:id,Decision:"reject"),new("pulse",RequestId:id,Indicator:true),new("stop"),new("history")})Check(ServiceProtocol.Allowed(c),"allowed IPC");
using var stream=new MemoryStream();await ServiceProtocol.Write(stream,new LocalCommand("status"),default);stream.Position=0;Check((await ServiceProtocol.Read<LocalCommand>(stream,default)).Action=="status","bounded frame roundtrip");
foreach(int n in new[]{-1,0,ServiceProtocol.Maximum+1,int.MaxValue}){byte[] prefix=new byte[4];BinaryPrimitives.WriteInt32LittleEndian(prefix,n);try{await ServiceProtocol.Read<LocalCommand>(new MemoryStream(prefix),default);throw new Exception("accepted invalid frame");}catch(InvalidDataException){count++;}}
var schedule=new MonitoringSchedule();var now=DateTimeOffset.UtcNow;for(int i=0;i<100;i++){schedule.Failure(now,.1);Check(schedule.NextPresence>now&&schedule.NextPresence<=now.AddSeconds(330.001),"bounded retry, no busy loop");now=schedule.NextPresence;}schedule.Success(now,true,0);Check(!schedule.MetricsDue(now.AddSeconds(59)),"no metric queue replay");Check(schedule.MetricsDue(now.AddSeconds(60)),"next fresh metric only");
string root=Path.Combine(Path.GetTempPath(),"uai-update-test-"+Guid.NewGuid());Directory.CreateDirectory(root);
try{
 string live=Path.Combine(root,"Application");Directory.CreateDirectory(live);File.WriteAllText(Path.Combine(live,"version"),"old");
 string credential=Path.Combine(root,"identity.bin");File.WriteAllBytes(credential,[1,2,3,4]);
 var swap=new UaiSuporte.Setup.ApplicationSwap(live);Directory.CreateDirectory(swap.Staged);File.WriteAllText(Path.Combine(swap.Staged,"version"),"new");swap.Swap();
 Check(File.ReadAllText(Path.Combine(live,"version"))=="new","update swaps application");Check(File.ReadAllBytes(credential).SequenceEqual(new byte[]{1,2,3,4}),"update leaves protected identity untouched");
 swap.Rollback();Check(File.ReadAllText(Path.Combine(live,"version"))=="old","failed service start restores old application");Check(!Directory.Exists(swap.Staged)&&!Directory.Exists(swap.Previous),"rollback cleans partial files");
 Directory.CreateDirectory(swap.Staged);File.WriteAllText(Path.Combine(swap.Staged,"version"),"new");swap.Swap();swap.Commit();Check(!Directory.Exists(swap.Previous),"commit removes owned backup");Check(File.ReadAllBytes(credential).SequenceEqual(new byte[]{1,2,3,4}),"commit preserves identity");
}finally{Directory.Delete(root,true);}
var fence=new SessionStopFence();var attempt=Guid.NewGuid();long epoch=fence.Epoch;
Check(fence.Allows(attempt,epoch),"fresh attempt");fence.Stop(new[]{attempt});
Check(!fence.Allows(attempt,epoch),"stop wins over delayed HTTP consent and poll");
Check(!fence.Allows(attempt,fence.Epoch),"stopped attempt cannot resume after backend recovery");
Check(fence.Allows(Guid.NewGuid(),fence.Epoch),"new attempt requires separate identity");
lease.Pulse(42,100,true,attempt);lease.Clear();Check(!lease.CanAccept(42,101,attempt),"lost interface and indicator deny access");

Check(NativeConsentDiagnostic.Parse("""{"stage":"REQUESTED"}""")!.Placement(2)=="DIALOG_PLACEMENT_UNCONFIRMED","missing helper metadata is unknown, not session zero");
Check(new NativeConsentDiagnostic("HELPER_READY",2,0,2,123,2).Placement(2)=="DIALOG_PLACEMENT_UNCONFIRMED","service session zero is normal");
Check(new NativeConsentDiagnostic("HELPER_READY",2,0,2,123,0).Placement(2)=="DIALOG_SESSION_ZERO","helper session zero detected");
Check(new NativeConsentDiagnostic("HELPER_READY",3,0,2,123,3).Placement(2)=="DIALOG_WRONG_SESSION","wrong interactive session detected");
Check(!ServiceProtocol.Allowed(new("native-dialog",RequestId:id,DialogPid:0)),"invalid PID rejected");
Check(!ServiceProtocol.Allowed(new("consent",RequestId:id,Decision:"accept",DialogPid:123)),"diagnostics cannot carry consent");
Check(ServiceProtocol.Allowed(new("native-dialog",RequestId:id,DialogPid:123)),"bounded diagnostic report");

var launch=new FakeMeshLaunch();MeshLaunchPolicy.Run(3,()=>true,launch);
Check(string.Join(",",launch.Events)=="create,session,job,session,resume","interactive engine stays suspended until session and job verified");
foreach(int invalidSession in new[]{-1,0}){
 var fake=new FakeMeshLaunch();try{MeshLaunchPolicy.Run(invalidSession,()=>true,fake);throw new Exception("session zero accepted");}catch(InvalidOperationException){Check(fake.Events.Count==0,"no process without positive target session");}
}
foreach(string failAt in new[]{"create","job","resume"}){
 var fake=new FakeMeshLaunch{FailAt=failAt};try{MeshLaunchPolicy.Run(3,()=>true,fake);throw new Exception("failure accepted");}catch(IOException){Check(fake.Events.Last()=="abort","native launch failure terminates owned process/job");if(failAt!="resume")Check(!fake.Events.Contains("resume"),"no running child before successful assignment");}
}
var wrongSession=new FakeMeshLaunch{ActualSession=0};try{MeshLaunchPolicy.Run(3,()=>true,wrongSession);throw new Exception("wrong session accepted");}catch(InvalidOperationException){Check(wrongSession.Events.Last()=="abort"&&!wrongSession.Events.Contains("job"),"wrong-session suspended child terminated");}
for(int expiresAt=1;expiresAt<=4;expiresAt++){
 int authorizationCalls=0;var fake=new FakeMeshLaunch();
 try{MeshLaunchPolicy.Run(3,()=>++authorizationCalls<expiresAt,fake);throw new Exception("expired presenter accepted");}
 catch(InvalidOperationException){
  if(expiresAt==1)Check(fake.Events.Count==0,"missing presenter blocks process creation");
  else Check(fake.Events.Last()=="abort","presenter loss wins during creation, assignment or resume");
  if(expiresAt<4)Check(!fake.Events.Contains("resume"),"stale session never resumes suspended engine");
 }
}
// Regression model of Windows' documented privilege-gated token handle rights.
// This models the contract; it does not execute SetTokenInformation on Linux.
var oldOrder=new FakeTokenOperations();oldOrder.DuplicatePrimary();oldOrder.EnableCallerPrivileges();
try{oldOrder.SetSession(1);throw new Exception("legacy ordering unexpectedly worked");}
catch(System.ComponentModel.Win32Exception e){Check(e.NativeErrorCode==5,"legacy duplicate-before-enable reproduces missing session right in model");}
finally{oldOrder.RestoreCallerPrivileges();oldOrder.DiscardPrimary();}
var incompleteAccess=new FakeTokenOperations(true,false){Access=0x10b};
try{InteractiveTokenPolicy.Prepare(1,incompleteAccess);throw new Exception("incomplete adjustment access accepted");}
catch(System.ComponentModel.Win32Exception e){Check(e.NativeErrorCode==5&&incompleteAccess.Discarded,"legacy access lacks default adjustment even with TCB already enabled in compatibility model");}
Check((InteractiveTokenPolicy.PrimaryTokenAccess&0x180)==0x180,"combined default/session access requested");
Check((InteractiveTokenPolicy.PrimaryTokenAccess&0xfffe0000)==0,"no maximum allowed, ACL or owner write rights requested");
foreach(bool tcb in new[]{false,true})foreach(bool primary in new[]{false,true}){
 var native=new FakeTokenOperations(tcb,primary);InteractiveTokenPolicy.Prepare(1,native);
 Check(native.SessionId==1&&!native.Discarded,"prepared primary belongs to requested session");
 Check(native.CallerTcb==tcb&&native.CallerPrimary==primary,"caller privilege state restored exactly");
 Check(native.CopyTcb==tcb&&native.CopyPrimary==primary,"temporary privilege enables not inherited by engine");
 Check(native.Events.IndexOf("enable-primary")<native.Events.IndexOf("duplicate"),"rights requested only after caller privileges enabled");
 Check(native.Events.IndexOf("restore-copy")<native.Events.IndexOf("set-session"),"caller performs session adjustment without extra privilege enabled in child");
 Check(native.Events.IndexOf("get-session")<native.Events.IndexOf("restore-caller"),"session verified before releasing caller privilege scope");
}
foreach(string failAt in new[]{"enable-tcb","enable-primary","duplicate","restore-copy","set-session","get-session","restore-caller"}){
 var native=new FakeTokenOperations{FailAt=failAt};
 try{InteractiveTokenPolicy.Prepare(1,native);throw new Exception("failed token preparation accepted");}
 catch(IOException){
  Check(native.Discarded&&native.Events.Last()=="discard","failure never returns a usable primary token");
  Check(native.Events.Contains("restore-caller"),"caller restoration attempted even after partial enable");
  if(failAt!="restore-caller")Check(!native.CallerTcb&&!native.CallerPrimary,"caller privileges restored after native failure");
 }
}
var mismatched=new FakeTokenOperations{WrongSession=true};
try{InteractiveTokenPolicy.Prepare(1,mismatched);throw new Exception("wrong token session accepted");}
catch(InvalidOperationException){Check(mismatched.Discarded&&!mismatched.CallerTcb&&!mismatched.CallerPrimary,"wrong-session token discarded and caller restored");}
foreach(int invalidSession in new[]{0,-1}){
 var native=new FakeTokenOperations();
 try{InteractiveTokenPolicy.Prepare(invalidSession,native);throw new Exception("invalid token session accepted");}
 catch(InvalidOperationException){Check(native.Events.Count==0,"invalid session rejected before touching privileges");}
}
Console.WriteLine($"{count} service policy checks passed. No Windows SCM, pipes/ACL, DPAPI, UI or Mesh capture executed.");

sealed class FakeTokenOperations:IInteractiveTokenOperations {
 readonly bool originalTcb,originalPrimary;
 public FakeTokenOperations(bool originalTcb=false,bool originalPrimary=false){this.originalTcb=originalTcb;this.originalPrimary=originalPrimary;CallerTcb=originalTcb;CallerPrimary=originalPrimary;}
 public List<string> Events {get;}=[];
 public string? FailAt {get;init;}
 public bool WrongSession {get;init;}
 public uint Access {get;init;}=InteractiveTokenPolicy.PrimaryTokenAccess;
 public bool CallerTcb {get;private set;}
 public bool CallerPrimary {get;private set;}
 public bool CopyTcb {get;private set;}
 public bool CopyPrimary {get;private set;}
 public bool Discarded {get;private set;}
 bool sessionRight;int actualSession;
 void Event(string name){Events.Add(name);if(FailAt==name)throw new IOException("injected native failure");}
 public void EnableCallerPrivileges(){Event("enable-tcb");CallerTcb=true;Event("enable-primary");CallerPrimary=true;}
 public void DuplicatePrimary(){Event("duplicate");sessionRight=CallerTcb&&(Access&0x180)==0x180;CopyTcb=CallerTcb;CopyPrimary=CallerPrimary;}
 public void RestorePrimaryPrivileges(){Event("restore-copy");CopyTcb=originalTcb;CopyPrimary=originalPrimary;}
 public void SetSession(int session){Event("set-session");if(!sessionRight||!CallerTcb)throw new System.ComponentModel.Win32Exception(5);actualSession=WrongSession?0:session;}
 public int SessionId{get{Event("get-session");return actualSession;}}
 public void RestoreCallerPrivileges(){Event("restore-caller");CallerTcb=originalTcb;CallerPrimary=originalPrimary;}
 public void DiscardPrimary(){Event("discard");Discarded=true;}
}

sealed class FakeMeshLaunch:ISuspendedMeshLaunch {
 public List<string> Events {get;}=[];
 public string? FailAt {get;init;}
 public int ActualSession {get;init;}=3;
 void Event(string name){Events.Add(name);if(name==FailAt)throw new IOException("injected native failure");}
 public void CreateSuspended()=>Event("create");
 public int SessionId{get{Event("session");return ActualSession;}}
 public void AssignJob()=>Event("job");
 public void Resume()=>Event("resume");
 public void Abort()=>Event("abort");
}
