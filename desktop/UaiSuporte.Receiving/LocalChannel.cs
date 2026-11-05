using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;
namespace UaiSuporte.Agent;
public static class LocalChannel {
 public static string ApplicationRoot=>Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"UaiTelecom","UaiSuporte","Application");
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeClientProcessId(SafePipeHandle pipe,out uint pid);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeServerProcessId(SafePipeHandle pipe,out uint pid);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr OpenSCManager(string? machine,string? database,uint access);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr OpenService(IntPtr manager,string name,uint access);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool QueryServiceStatusEx(IntPtr service,int level,[Out]byte[] data,int size,out int needed);
 [DllImport("advapi32.dll")]static extern bool CloseServiceHandle(IntPtr handle);
 [DllImport("wtsapi32.dll",CharSet=CharSet.Unicode)]static extern bool WTSEnumerateSessions(IntPtr server,int reserved,int version,out IntPtr info,out int count);
 [DllImport("wtsapi32.dll")]static extern void WTSFreeMemory(IntPtr info);
 [DllImport("wtsapi32.dll",CharSet=CharSet.Unicode)]static extern bool WTSQuerySessionInformation(IntPtr server,int session,int cls,out IntPtr buffer,out int bytes);
 [StructLayout(LayoutKind.Sequential)]struct WtsSession{public int Id;public IntPtr Name;public int State;}
 public static int ActiveSession(){
  if(!WTSEnumerateSessions(IntPtr.Zero,0,1,out var data,out int count))return -1;
  try{var sessions=new List<int>();for(int i=0;i<count;i++){var s=Marshal.PtrToStructure<WtsSession>(data+i*Marshal.SizeOf<WtsSession>());if(s.State==0&&s.Id>0)sessions.Add(s.Id);}return sessions.Count==1?sessions[0]:-1;}finally{WTSFreeMemory(data);}
 }
 public static string ActiveUser(){int id=ActiveSession();if(id<0)return "";string Part(int cls){if(!WTSQuerySessionInformation(IntPtr.Zero,id,cls,out var p,out _))return "";try{return Marshal.PtrToStringUni(p)??"";}finally{WTSFreeMemory(p);}}return Part(7)+"\\"+Part(5);}
 public static NamedPipeServerStream Server(bool emergency=false){
  var acl=new PipeSecurity();acl.SetAccessRuleProtection(true,false);
  acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier("S-1-5-2"),PipeAccessRights.FullControl,AccessControlType.Deny)); // NETWORK
  acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier("S-1-5-18"),PipeAccessRights.FullControl,AccessControlType.Allow));
  acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier("S-1-5-4"),PipeAccessRights.ReadWrite,AccessControlType.Allow)); // INTERACTIVE; authenticated again by OS PID below
  return NamedPipeServerStreamAcl.Create(ServiceProtocol.PipeName+(emergency?".stop":""),PipeDirection.InOut,4,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,4096,4096,acl,HandleInheritability.None,(PipeAccessRights)0);
 }
 static readonly Dictionary<int,long> verified=[];
 public static int Authenticate(NamedPipeServerStream pipe){
  if(!GetNamedPipeClientProcessId(pipe.SafePipeHandle,out uint raw))throw new UnauthorizedAccessException();
  using var p=Process.GetProcessById(checked((int)raw));
  if(p.SessionId!=ActiveSession()||p.SessionId==0)throw new UnauthorizedAccessException();
  string expected=Path.Combine(ApplicationRoot,"UaiSuporte.exe");
  if(!string.Equals(p.MainModule?.FileName,expected,StringComparison.OrdinalIgnoreCase))throw new UnauthorizedAccessException();
  if(!verified.TryGetValue(p.Id,out long started)||started!=p.StartTime.ToUniversalTime().Ticks){
   var manifest=JsonSerializer.Deserialize<Dictionary<string,string>>(File.ReadAllText(Path.Combine(ApplicationRoot,"ipc-integrity.json")))??throw new InvalidDataException();
   foreach(string file in new[]{"UaiSuporte.exe","UaiSuporte.dll","UaiSuporte.Receiving.dll","UaiSuporte.Transport.dll"}){
    using var input=File.OpenRead(Path.Combine(ApplicationRoot,file));if(!manifest.TryGetValue(file,out var hash)||!Convert.ToHexString(SHA256.HashData(input)).Equals(hash,StringComparison.OrdinalIgnoreCase))throw new UnauthorizedAccessException();
   }
   verified.Clear();verified[p.Id]=p.StartTime.ToUniversalTime().Ticks;
  }
  return p.Id;
 }
 public static bool PresenterCurrent(int pid){try{using var p=Process.GetProcessById(pid);return !p.HasExited&&p.SessionId==ActiveSession();}catch{return false;}}
 static void AuthenticateServer(NamedPipeClientStream pipe){
  if(!GetNamedPipeServerProcessId(pipe.SafePipeHandle,out var pid))throw new UnauthorizedAccessException();
  IntPtr manager=OpenSCManager(null,null,1),service=IntPtr.Zero;
  try{if(manager==IntPtr.Zero)throw new UnauthorizedAccessException();service=OpenService(manager,"UaiSuporte",4);byte[] data=new byte[36];if(service==IntPtr.Zero||!QueryServiceStatusEx(service,0,data,data.Length,out _)||BitConverter.ToUInt32(data,28)!=pid)throw new UnauthorizedAccessException();}
  finally{if(service!=IntPtr.Zero)CloseServiceHandle(service);if(manager!=IntPtr.Zero)CloseServiceHandle(manager);}
 }
 public static async Task<LocalReply> Send(LocalCommand command,CancellationToken ct=default){
  if(!ServiceProtocol.Allowed(command))throw new InvalidDataException();
  using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct);timeout.CancelAfter(command.Action=="activate"?90000:4000);
  using var pipe=new NamedPipeClientStream(".",ServiceProtocol.PipeName+(command.Action=="stop"?".stop":""),PipeAccessRights.ReadWrite,PipeOptions.Asynchronous,TokenImpersonationLevel.Identification,HandleInheritability.None);
  await pipe.ConnectAsync(timeout.Token);AuthenticateServer(pipe);
  await ServiceProtocol.Write(pipe,command,timeout.Token);return await ServiceProtocol.Read<LocalReply>(pipe,timeout.Token);
 }
}
