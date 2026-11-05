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
Console.WriteLine($"{count} service policy checks passed. No Windows SCM, pipes/ACL, DPAPI, UI or Mesh capture executed.");
