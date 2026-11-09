using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;
namespace UaiSuporte.Agent;

// Only the LocalSystem service may duplicate its own identity into the verified
// interactive session. No user password, user token or credential crosses IPC.
// Keep SYSTEM access to the private Mesh store; do not widen its filesystem ACL.
static class InteractiveSystemToken {
 const uint Query=0x8,Duplicate=0x2,AdjustPrivileges=0x20;
 [StructLayout(LayoutKind.Sequential)]struct Luid {public uint Low;public int High;}
 [StructLayout(LayoutKind.Sequential)]struct Privilege {public uint Count;public Luid Id;public uint Attributes;}
 [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr process,uint access,out SafeAccessTokenHandle token);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool DuplicateTokenEx(SafeAccessTokenHandle token,uint access,IntPtr attributes,int impersonation,int type,out SafeAccessTokenHandle copy);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool SetTokenInformation(SafeAccessTokenHandle token,int information,ref int session,int length);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool GetTokenInformation(SafeAccessTokenHandle token,int information,out int session,int length,out int returned);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool LookupPrivilegeValue(string? system,string name,out Luid luid);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool AdjustTokenPrivileges(SafeAccessTokenHandle token,bool disableAll,ref Privilege desired,uint length,out Privilege previous,out uint returned);
 public static SafeAccessTokenHandle ForSession(int session){
  using var identity=WindowsIdentity.GetCurrent();
  if(session<=0||!identity.IsSystem)throw new UnauthorizedAccessException("SYSTEM_SERVICE_REQUIRED");
  if(!OpenProcessToken(GetCurrentProcess(),Query|Duplicate|AdjustPrivileges,out var original))throw Failure("TOKEN_OPEN");
  using(original){
   var operations=new NativeOperations(original);
   try{InteractiveTokenPolicy.Prepare(session,operations);}
   catch(MeshLaunchException e){
    e.RequestedTokenAccess=InteractiveTokenPolicy.PrimaryTokenAccess;
    e.CallerTcbInitiallyEnabled=operations.TcbInitiallyEnabled;
    e.CallerPrimaryInitiallyEnabled=operations.PrimaryInitiallyEnabled;
    throw;
   }
   return operations.Prepared;
  }
 }
 sealed class NativeOperations(SafeAccessTokenHandle original):IInteractiveTokenOperations {
  readonly List<Privilege> previous=[];
  SafeAccessTokenHandle? copy;
  public bool? TcbInitiallyEnabled {get;private set;}
  public bool? PrimaryInitiallyEnabled {get;private set;}
  public SafeAccessTokenHandle Prepared=>copy??throw new InvalidOperationException("TOKEN_NOT_PREPARED");
  public void EnableCallerPrivileges(){
   // Both requested handle rights are privilege-gated during duplication:
   // ADJUST_SESSIONID requires TCB; ASSIGN_PRIMARY requires AssignPrimaryToken.
   foreach(var (name,stage) in new[]{("SeTcbPrivilege","SESSION_PRIVILEGE"),("SeAssignPrimaryTokenPrivilege","PRIMARY_PRIVILEGE")}){
    if(!LookupPrivilegeValue(null,name,out var luid))throw Failure(stage+"_LOOKUP");
    var enable=new Privilege{Count=1,Id=luid,Attributes=2};
    bool adjusted=AdjustTokenPrivileges(original,false,ref enable,(uint)Marshal.SizeOf<Privilege>(),out var prior,out _);
    int error=Marshal.GetLastPInvokeError();
    // Preserve every successful partial change for the finally block, including
    // success + ERROR_NOT_ALL_ASSIGNED. No new privilege is granted to the account.
    if(adjusted)previous.Add(prior);
    if(!adjusted||error!=0)throw new MeshLaunchException(stage+"_ENABLE",error);
    if(name=="SeTcbPrivilege")TcbInitiallyEnabled=prior.Count==0;else PrimaryInitiallyEnabled=prior.Count==0;
   }
  }
  public void DuplicatePrimary(){
   // ADJUST_PRIVILEGES only restores the primary copy's inherited temporary
   // privileges. No TOKEN_ALL_ACCESS, MAXIMUM_ALLOWED, WRITE_DAC or ACL changes.
   if(!DuplicateTokenEx(original,InteractiveTokenPolicy.PrimaryTokenAccess,IntPtr.Zero,2,1,out var result)){
    var error=Failure("TOKEN_DUPLICATE");result?.Dispose();throw error;
   }
   copy=result;
  }
  public void RestorePrimaryPrivileges()=>Restore(Prepared,"TOKEN_PRIVILEGE_RESTORE");
  public void SetSession(int session){if(!SetTokenInformation(Prepared,12,ref session,sizeof(int)))throw Failure("TOKEN_SESSION_SET");}
  public int SessionId { get {
   if(!GetTokenInformation(Prepared,12,out int actual,sizeof(int),out int length))throw Failure("TOKEN_SESSION_READ");
   if(length!=sizeof(int))throw new InvalidOperationException("TOKEN_SESSION_SIZE");return actual;
  }}
  void Restore(SafeAccessTokenHandle token,string stage){
   MeshLaunchException? first=null;
   for(int i=previous.Count-1;i>=0;i--){
    var prior=previous[i];if(prior.Count==0)continue; // already enabled: preserve original state
    bool restored=AdjustTokenPrivileges(token,false,ref prior,(uint)Marshal.SizeOf<Privilege>(),out _,out _);
    int error=Marshal.GetLastPInvokeError();
    if(!restored||error!=0)first??=new MeshLaunchException(stage,error);
   }
   if(first!=null)throw first;
  }
  public void RestoreCallerPrivileges()=>Restore(original,"SESSION_PRIVILEGE_RESTORE");
  public void DiscardPrimary(){copy?.Dispose();copy=null;}
 }
 internal static MeshLaunchException Failure(string stage)=>new(stage,Marshal.GetLastPInvokeError());
}
public sealed class MeshLaunchException(string stage,int nativeCode):Win32Exception(nativeCode,"Falha ao iniciar o componente na sessão autorizada.") {
 public string Stage {get;}=stage;
 public uint? RequestedTokenAccess {get;internal set;}
 public bool? CallerTcbInitiallyEnabled {get;internal set;}
 public bool? CallerPrimaryInitiallyEnabled {get;internal set;}
}
