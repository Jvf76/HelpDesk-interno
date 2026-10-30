using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;
namespace UaiSuporte.Agent;
// Only owns the explicitly provisioned child; never searches for or kills other MeshAgents.
sealed class ManagedMesh : IDisposable {
 SafeFileHandle? job;Process? process;
 public bool Running=>process!=null&&!process.HasExited;
 [StructLayout(LayoutKind.Sequential)]struct Basic{public long ProcessTime,JobTime;public uint Flags;public UIntPtr Min,Max;public uint Active;public UIntPtr Affinity;public uint Priority,Scheduling;}
 [StructLayout(LayoutKind.Sequential)]struct Counters{public ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes;}
 [StructLayout(LayoutKind.Sequential)]struct Extended{public Basic Basic;public Counters Io;public UIntPtr ProcessMemory,JobMemory,PeakProcess,PeakJob;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern SafeFileHandle CreateJobObject(IntPtr attributes,string? name);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetInformationJobObject(SafeFileHandle job,int type,ref Extended information,uint length);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool AssignProcessToJobObject(SafeFileHandle job,IntPtr process);
 public void Start(string exe,string expectedHash){
  if(Running)return;
  if(!expectedHash.Equals(Provisioning.MeshHash,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Componente de acesso remoto não corresponde à versão autorizada.");
  if(!Path.IsPathFullyQualified(exe)||!File.Exists(exe)||!Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(exe))).Equals(expectedHash,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Componente de acesso remoto difere do arquivo validado pela TI. Solicite revisão do pacote.");
  // A matching hash establishes identity, not Windows trust. Recheck signature/revocation before every start.
  UaiSuporte.Setup.Authenticode.RequireValid(exe);
  job=CreateJobObject(IntPtr.Zero,null);if(job.IsInvalid)throw new InvalidOperationException("Não foi possível criar isolamento local.");
  var limits=new Extended{Basic=new Basic{Flags=0x2000}};
  if(!SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf<Extended>())){job.Dispose();throw new InvalidOperationException("Não foi possível proteger o encerramento local.");}
  process=Process.Start(new ProcessStartInfo(exe,"run -nocertstore"){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=Path.GetDirectoryName(exe)!});
  if(process==null||!AssignProcessToJobObject(job,process.Handle)){process?.Kill(true);job.Dispose();throw new InvalidOperationException("Não foi possível proteger o encerramento do acesso remoto.");}
 }
 public bool Stop(){
  job?.Dispose();job=null;
  if(process==null)return true;
  try{if(!process.HasExited&&!process.WaitForExit(2000))process.Kill(true);if(!process.WaitForExit(2000))return false;process.Dispose();process=null;return true;}catch{return false;}
 }
 public void Dispose()=>Stop();
}
