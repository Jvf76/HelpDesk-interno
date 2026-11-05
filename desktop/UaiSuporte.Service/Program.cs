using System.ServiceProcess;
using UaiSuporte.Agent;
namespace UaiSuporte.Service;
static class Program {
 static void Main(){ServiceBase.Run(new CorporateService());}
}
sealed class CorporateService:ServiceBase {
 readonly CancellationTokenSource cancellation=new();
 ServiceRuntime? runtime;
 public CorporateService(){ServiceName="UaiSuporte";CanStop=true;CanShutdown=true;CanHandleSessionChangeEvent=true;AutoLog=false;}
 protected override void OnStart(string[] args){DeviceStore.SecureDirectory(DeviceStore.Root);runtime=new();runtime.Start(cancellation.Token);}
 protected override void OnSessionChange(SessionChangeDescription change){runtime?.SessionChanged();}
 protected override void OnStop(){cancellation.Cancel();runtime?.Dispose();}
 protected override void OnShutdown()=>OnStop();
}
