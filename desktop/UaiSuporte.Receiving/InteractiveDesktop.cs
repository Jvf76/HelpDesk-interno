using System.Runtime.InteropServices;
using System.Text;
namespace UaiSuporte.Agent;
// Called only by the process in the user's session, never by the session-0 service.
static class InteractiveDesktop {
 [DllImport("user32.dll",SetLastError=true)]static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool GetUserObjectInformation(IntPtr handle,int index,StringBuilder text,uint length,out uint needed);
 [DllImport("user32.dll")]static extern bool CloseDesktop(IntPtr desktop);
 public static bool Available(){var desktop=OpenInputDesktop(0,false,1);if(desktop==IntPtr.Zero)return false;try{var name=new StringBuilder(256);return GetUserObjectInformation(desktop,2,name,512,out _)&&name.ToString().Equals("Default",StringComparison.OrdinalIgnoreCase);}finally{CloseDesktop(desktop);}}
}
