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
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct Startup{public int Size;public string? Reserved,Desktop,Title;public int X,Y,XSize,YSize,XChars,YChars,Fill,Flags;public short Show,ReservedSize;public IntPtr ReservedBytes,Input,Output,Error;}
 [StructLayout(LayoutKind.Sequential)]struct ProcessInfo{public IntPtr Process,Thread;public uint Pid,Tid;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcess(string application,System.Text.StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inherit,uint flags,IntPtr environment,string directory,ref Startup startup,out ProcessInfo info);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")]static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 public void Start(string exe,string expectedHash){
  if(Running)return;
  if(!expectedHash.Equals(Provisioning.MeshHash,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Componente de acesso remoto não corresponde à versão autorizada.");
  if(!Path.IsPathFullyQualified(exe)||!File.Exists(exe)||!Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(exe))).Equals(expectedHash,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Componente de acesso remoto difere do arquivo validado pela TI. Solicite revisão do pacote.");
  // A matching hash establishes identity, not Windows trust. Recheck signature/revocation before every start.
  UaiSuporte.Setup.Authenticode.RequireValid(exe);
  job=CreateJobObject(IntPtr.Zero,null);if(job.IsInvalid)throw new InvalidOperationException("Não foi possível criar isolamento local.");
  var limits=new Extended{Basic=new Basic{Flags=0x2000}};
  if(!SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf<Extended>())){job.Dispose();throw new InvalidOperationException("Não foi possível proteger o encerramento local.");}
  // Suspended creation prevents descendants escaping before assignment to the kill-on-close job.
  using var locked=new FileStream(exe,FileMode.Open,FileAccess.Read,FileShare.Read);
  UaiSuporte.Setup.Authenticode.RequireValid(exe);
  var startup=new Startup{Size=Marshal.SizeOf<Startup>()};
  if(!CreateProcess(exe,new System.Text.StringBuilder("\""+exe+"\" run -nocertstore"),IntPtr.Zero,IntPtr.Zero,false,0x08000004,IntPtr.Zero,Path.GetDirectoryName(exe)!,ref startup,out var child)){job.Dispose();throw new IOException("Falha ao iniciar componente interno.");}
  try{
   if(!AssignProcessToJobObject(job,child.Process))throw new IOException("Isolamento local não confirmado.");
   process=Process.GetProcessById(checked((int)child.Pid));
   if(ResumeThread(child.Thread)==uint.MaxValue)throw new IOException("Falha ao iniciar componente isolado.");
  }catch{TerminateProcess(child.Process,1);job.Dispose();process?.Dispose();process=null;throw;}
  finally{CloseHandle(child.Thread);CloseHandle(child.Process);}

 }
 public bool Stop(){
  job?.Dispose();job=null;
  if(process==null)return true;
  try{if(!process.HasExited&&!process.WaitForExit(2000))process.Kill(true);if(!process.WaitForExit(2000))return false;process.Dispose();process=null;return true;}catch{return false;}
 }
 public void Dispose()=>Stop();
}
