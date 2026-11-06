namespace UaiSuporte.Agent;

// OS-independent ordering contract, exercised with fault injection in Service.Tests.
// The engine cannot run until its session and its kill-on-close job are verified.
public interface ISuspendedMeshLaunch {
 void CreateSuspended();
 int SessionId { get; }
 void AssignJob();
 void Resume();
 void Abort();
}
public static class MeshLaunchPolicy {
 public static void Run(int targetSession,Func<bool> authorized,ISuspendedMeshLaunch launch){
  if(targetSession<=0||!authorized())throw new InvalidOperationException("INTERACTIVE_SESSION_REQUIRED");
  try {
   launch.CreateSuspended();
   if(launch.SessionId!=targetSession||!authorized())throw new InvalidOperationException("INTERACTIVE_SESSION_CHANGED");
   launch.AssignJob();
   if(launch.SessionId!=targetSession||!authorized())throw new InvalidOperationException("INTERACTIVE_SESSION_CHANGED");
   launch.Resume();
   if(!authorized())throw new InvalidOperationException("INTERACTIVE_SESSION_CHANGED");
  } catch { launch.Abort();throw; }
 }
}
