using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
namespace UaiSuporte.Agent;
// Metadata only. Never reads window text, screen content, or modifies native consent.
public sealed record NativeConsentDiagnostic(string Stage,int TargetSession=-1,int EngineSession=-1,int ConsoleSession=-1,int HelperPid=-1,int HelperSession=-1) {
 public static NativeConsentDiagnostic? Parse(string? json){try {if(json==null||json.Length>1000)return null;var d=JsonSerializer.Deserialize<NativeConsentDiagnostic>(json,ServiceProtocol.Json);return d!=null&&d.Stage is "REQUESTED" or "HELPER_CREATED" or "HELPER_READY" or "RESPONSE_ACCEPTED" or "RESPONSE_REJECTED"?d:null;}catch{return null;}}
 public string Placement(int active)=>active<1?"ACTIVE_SESSION_UNKNOWN":TargetSession==0||HelperSession==0?"DIALOG_SESSION_ZERO":TargetSession>0&&TargetSession!=active||HelperSession>0&&HelperSession!=active?"DIALOG_WRONG_SESSION":"DIALOG_PLACEMENT_UNCONFIRMED";
}
public static class NativeConsentWindow {
 delegate bool WindowCallback(IntPtr window,IntPtr unused);
 [DllImport("user32.dll")]static extern bool EnumWindows(WindowCallback callback,IntPtr unused);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 public static bool Visible(int pid){if(pid<1)return false;bool found=false;EnumWindows((w,_)=>{GetWindowThreadProcessId(w,out var owner);if(owner==pid&&IsWindowVisible(w)){found=true;return false;}return true;},IntPtr.Zero);return found;}
 public static int VerifiedSession(int pid,string exe){try{using var process=Process.GetProcessById(pid);return Path.GetFullPath(process.MainModule!.FileName).Equals(Path.GetFullPath(exe),StringComparison.OrdinalIgnoreCase)?process.SessionId:-1;}catch{return -1;}}
}
