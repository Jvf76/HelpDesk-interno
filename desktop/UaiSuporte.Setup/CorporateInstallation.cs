using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Win32;
using UaiSuporte.Agent;
namespace UaiSuporte.Setup;
internal static class CorporateInstallation {
 const string RunKey=@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
 static string ServiceExe=>Path.Combine(Installation.App,"Service","UaiSuporte.Service.exe");
 static void Sc(params string[] args){
  var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"sc.exe")){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};foreach(var a in args)info.ArgumentList.Add(a);
  using var p=Process.Start(info)??throw new IOException();var output=p.StandardOutput.ReadToEndAsync();var error=p.StandardError.ReadToEndAsync();if(!p.WaitForExit(15000)||p.ExitCode!=0)throw new IOException("Operação do serviço não confirmada.");
 }
 public static bool Exists(){using var key=Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\UaiSuporte");return key!=null;}
 public static void VerifyOwnership(){using var key=Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\UaiSuporte");if(key!=null&&!string.Equals((key.GetValue("ImagePath") as string)?.Trim('"'),ServiceExe,StringComparison.OrdinalIgnoreCase))throw new IOException("Serviço homônimo não pertence a esta instalação.");}
 static void RestrictData(){
  DeviceStore.SecureDirectory(DeviceStore.Root);
  // CopyFile can preserve source security metadata: harden every migrated child, not just its parent.
  void Protect(string directory){
   DeviceStore.SecureDirectory(directory);
   foreach(string path in Directory.EnumerateFileSystemEntries(directory)){
    if(File.GetAttributes(path).HasFlag(FileAttributes.ReparsePoint))throw new IOException("Dados do serviço redirecionados.");
    if(Directory.Exists(path)){Protect(path);continue;}
    var acl=new System.Security.AccessControl.FileSecurity();acl.SetAccessRuleProtection(true,false);
    acl.SetOwner(new System.Security.Principal.SecurityIdentifier("S-1-5-32-544"));
    foreach(string sid in new[]{"S-1-5-18","S-1-5-32-544"})acl.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(new System.Security.Principal.SecurityIdentifier(sid),System.Security.AccessControl.FileSystemRights.FullControl,System.Security.AccessControl.AccessControlType.Allow));
    System.IO.FileSystemAclExtensions.SetAccessControl(new FileInfo(path),acl);
   }
  }
  Protect(DeviceStore.Root);
 }
 public static void Register(){
  if(!File.Exists(ServiceExe))throw new IOException("Serviço não incluído no pacote.");
  VerifyOwnership();RestrictData();
  if(!Exists())Sc("create","UaiSuporte","binPath=","\""+ServiceExe+"\"","start=","auto","obj=","LocalSystem","DisplayName=","Uai Suporte");
  Sc("description","UaiSuporte","Presença e monitoramento do Uai Suporte. Acesso remoto exige consentimento na sessão Windows.");
  // SCM default permits ordinary users to query, not change, stop or reconfigure the service.
  Sc("failure","UaiSuporte","reset=","86400","actions=","restart/10000/restart/30000/restart/60000");
  using var key=Registry.LocalMachine.CreateSubKey(RunKey);string startup="\""+Installation.Executable+"\" --background";if(key.GetValue("Uai Suporte") is object previous&&!Equals(previous,startup))throw new IOException("Inicialização preexistente de outro destino; preservada.");key.SetValue("Uai Suporte",startup);
 }
 public static void Start(){Sc("start","UaiSuporte");using var service=new System.ServiceProcess.ServiceController("UaiSuporte");service.WaitForStatus(System.ServiceProcess.ServiceControllerStatus.Running,TimeSpan.FromSeconds(25));}
 public static void Stop(){
  if(!Exists())return;VerifyOwnership();
  using var controller=new System.ServiceProcess.ServiceController("UaiSuporte");
  if(controller.Status!=System.ServiceProcess.ServiceControllerStatus.Stopped){controller.Stop();controller.WaitForStatus(System.ServiceProcess.ServiceControllerStatus.Stopped,TimeSpan.FromSeconds(25));}
 }
 public static void StopInterfaces(){foreach(var p in Process.GetProcessesByName("UaiSuporte")){using(p){if(!string.Equals(p.MainModule?.FileName,Installation.Executable,StringComparison.OrdinalIgnoreCase))continue;p.Kill(true);if(!p.WaitForExit(5000))throw new IOException("Interface não encerrou.");}}}
 public static void Remove(){Stop();StopInterfaces();if(Exists())Sc("delete","UaiSuporte");using var run=Registry.LocalMachine.OpenSubKey(RunKey,true);if((run?.GetValue("Uai Suporte") as string)=="\""+Installation.Executable+"\" --background")run.DeleteValue("Uai Suporte",false);}
 public static void Manifest(){
  var files=new Dictionary<string,string>();foreach(string name in new[]{"UaiSuporte.exe","UaiSuporte.dll","UaiSuporte.Receiving.dll","UaiSuporte.Transport.dll"}){using var f=File.OpenRead(Path.Combine(Installation.App,name));files[name]=Convert.ToHexString(SHA256.HashData(f));}
  File.WriteAllText(Path.Combine(Installation.App,"ipc-integrity.json"),JsonSerializer.Serialize(files));
 }
}
