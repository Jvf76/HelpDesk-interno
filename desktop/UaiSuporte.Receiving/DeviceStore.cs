using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text.Json;
using Microsoft.Win32;
namespace UaiSuporte.Agent;
// Machine DPAPI is only meaningful together with an ACL excluding ordinary users.
public static class DeviceStore {
 public static string Root=>Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"UaiTelecom","UaiSuporte","Service");
 public static string Legacy=>Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"UaiTelecom","UaiSuporte");
 static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web){PropertyNameCaseInsensitive=true};
 static byte[] Entropy(){using var key=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");return SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("UaiSuporte:v2:"+(key?.GetValue("MachineGuid") as string??throw new InvalidDataException())));}
 public static void SecureDirectory(string path){
  for(var p=new DirectoryInfo(path);p!=null;p=p.Parent)if(p.Exists&&p.Attributes.HasFlag(FileAttributes.ReparsePoint))throw new IOException("Destino redirecionado.");
  var acl=new DirectorySecurity();acl.SetAccessRuleProtection(true,false);acl.SetOwner(new SecurityIdentifier("S-1-5-32-544"));
  foreach(string sid in new[]{"S-1-5-18","S-1-5-32-544"})acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid),FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
  var d=Directory.CreateDirectory(path);d.SetAccessControl(acl);
 }
 public static T? Read<T>(string file)=>ReadAt<T>(Root,file,DataProtectionScope.LocalMachine,"UAI3");
 static T? ReadAt<T>(string root,string file,DataProtectionScope scope,string magic){
  byte[] data=File.ReadAllBytes(Path.Combine(root,file));
  if(data.Length<5||!data.AsSpan(0,4).SequenceEqual(System.Text.Encoding.ASCII.GetBytes(magic)))throw new InvalidDataException("Cadastro protegido inválido.");
  byte[] clear=ProtectedData.Unprotect(data[4..],Entropy(),scope);
  try{return JsonSerializer.Deserialize<T>(clear,Json);}finally{CryptographicOperations.ZeroMemory(clear);}
 }
 public static void Save<T>(string file,T value){
  SecureDirectory(Root);byte[] clear=JsonSerializer.SerializeToUtf8Bytes(value,Json);string path=Path.Combine(Root,file);
  try{var encrypted=ProtectedData.Protect(clear,Entropy(),DataProtectionScope.LocalMachine);File.WriteAllBytes(path+".new",[.."UAI3"u8.ToArray(),..encrypted]);File.Move(path+".new",path,true);}finally{CryptographicOperations.ZeroMemory(clear);}
 }
 // Elevated installer must run under the original enrollment owner. Source retained until commit.
 public static void MigrateLegacy(){
  SecureDirectory(Root);
  foreach(string file in new[]{"identity.bin","setup.bin","pending-enrollment.bin","account-registration.bin","activation-recovery.bin"}){
   if(!File.Exists(Path.Combine(Legacy,file)))continue;
   var value=ReadAt<JsonElement>(Legacy,file,DataProtectionScope.CurrentUser,"UAI2");
   if(File.Exists(Path.Combine(Root,file))){if(Read<JsonElement>(file).GetRawText()!=value.GetRawText())throw new InvalidDataException("Identidades divergentes; migração bloqueada.");continue;}
   if(file=="setup.bin"){
    var settings=value.Deserialize<Setup>(Json)??throw new InvalidDataException();
    string source=Path.Combine(Legacy,"Mesh"),destination=Path.Combine(Root,"Mesh");
    if(!Path.GetFullPath(settings.MeshExe).Equals(Path.Combine(source,"MeshAgent.exe"),StringComparison.OrdinalIgnoreCase))throw new InvalidDataException();
    SecureDirectory(destination);
    foreach(string path in Directory.EnumerateFiles(source,"*",SearchOption.TopDirectoryOnly)){
     if(File.GetAttributes(path).HasFlag(FileAttributes.ReparsePoint))throw new IOException();
     File.Copy(path,Path.Combine(destination,Path.GetFileName(path)),false);
    }
    Save(file,settings with{MeshExe=Path.Combine(destination,"MeshAgent.exe")});
   }else {
    Save(file,value);
    if(Read<JsonElement>(file).GetRawText()!=value.GetRawText())throw new InvalidDataException("Falha na preservação do cadastro.");
   }
  }
 }
}
