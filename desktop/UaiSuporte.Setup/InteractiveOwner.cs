using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;
namespace UaiSuporte.Setup;
internal static class InteractiveOwner {
 [DllImport("user32.dll")]static extern IntPtr GetShellWindow();
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr process,uint access,out SafeAccessTokenHandle token);
 internal static string Require(){
  var window=GetShellWindow();GetWindowThreadProcessId(window,out var pid);
  var process=OpenProcess(0x1000,false,pid);
  if(window==IntPtr.Zero||process==IntPtr.Zero)throw new InvalidOperationException("Instale na sessão interativa do usuário do laboratório.");
  try{
   if(!OpenProcessToken(process,8,out var token))throw new InvalidOperationException("Não foi possível confirmar o usuário da sessão.");
   using(token)using(var owner=new WindowsIdentity(token.DangerousGetHandle()))using(var current=WindowsIdentity.GetCurrent()){
    if(owner.User==null||owner.User!=current.User)throw new InvalidOperationException("A elevação usou outra conta Windows. Cadastro LAB deve ocorrer no mesmo usuário interativo; nenhuma identidade foi transferida entre contas.");
    return owner.User.Value;
   }
  }finally{CloseHandle(process);}
 }
}
