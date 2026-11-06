using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;
namespace UaiSuporte.Agent;

// Only the LocalSystem service may duplicate its own identity into the verified
// interactive session. No user password, user token or credential crosses IPC.
// Keep SYSTEM access to the private Mesh store; do not widen its filesystem ACL.
static class InteractiveSystemToken {
 const uint Query=0x8,Duplicate=0x2,AdjustPrivileges=0x20,AssignPrimary=0x1,AdjustSession=0x100;
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
   if(!DuplicateTokenEx(original,Query|Duplicate|AssignPrimary|AdjustSession,IntPtr.Zero,2,1,out var copy))throw Failure("TOKEN_DUPLICATE");
   try {
    if(!LookupPrivilegeValue(null,"SeTcbPrivilege",out var luid))throw Failure("SESSION_PRIVILEGE_LOOKUP");
    var enable=new Privilege{Count=1,Id=luid,Attributes=2};
    bool adjusted=AdjustTokenPrivileges(original,false,ref enable,(uint)Marshal.SizeOf<Privilege>(),out var prior,out _);
    int adjustError=Marshal.GetLastPInvokeError();
    if(!adjusted||adjustError!=0)throw new MeshLaunchException("SESSION_PRIVILEGE_ENABLE",adjustError);
    try {
     if(!SetTokenInformation(copy,12,ref session,sizeof(int)))throw Failure("TOKEN_SESSION_SET");
     if(!GetTokenInformation(copy,12,out int actual,sizeof(int),out int length))throw Failure("TOKEN_SESSION_READ");
     if(length!=sizeof(int)||actual!=session)throw new InvalidOperationException("TOKEN_SESSION_MISMATCH");
    } finally {
     // Restore the caller's privilege state, including the already-enabled case.
     bool restored=AdjustTokenPrivileges(original,false,ref prior,(uint)Marshal.SizeOf<Privilege>(),out _,out _);
     int restoreError=Marshal.GetLastPInvokeError();
     if(!restored||restoreError!=0)throw new MeshLaunchException("SESSION_PRIVILEGE_RESTORE",restoreError);
    }
    return copy;
   } catch {copy.Dispose();throw;}
  }
 }
 internal static MeshLaunchException Failure(string stage)=>new(stage,Marshal.GetLastPInvokeError());
}
public sealed class MeshLaunchException(string stage,int nativeCode):Win32Exception(nativeCode,"Falha ao iniciar o componente na sessão autorizada.") {
 public string Stage {get;}=stage;
}
