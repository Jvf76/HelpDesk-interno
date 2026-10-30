using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
namespace UaiSuporte.Agent;

// No file contents, process list, browsing history, keyboard or screen collection.
sealed class MonitoringCollector {
 [StructLayout(LayoutKind.Sequential)] struct FileTime {public uint Low,High;public ulong Value=>((ulong)High<<32)|Low;}
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetSystemTimes(out FileTime idle,out FileTime kernel,out FileTime user);
 [StructLayout(LayoutKind.Sequential)] sealed class Memory {public uint Length=(uint)Marshal.SizeOf<Memory>(),Load;public ulong Total,Available,PageTotal,PageAvailable,VirtualTotal,VirtualAvailable,Extended;}
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GlobalMemoryStatusEx([In,Out] Memory memory);
 ulong? previousIdle,previousTotal;
 public sealed record Disk(string Volume,long TotalBytes,long FreeBytes);
 public sealed record Sample(double? CpuPercent,long MemoryTotal,long MemoryAvailable,List<Disk> Disks);
 public Sample Collect(){
  double? cpu=null;
  if(GetSystemTimes(out var idle,out var kernel,out var user)) {
   ulong total=kernel.Value+user.Value;
   if(previousTotal.HasValue&&total>previousTotal.Value&&idle.Value>=previousIdle!.Value)cpu=Math.Clamp(100.0*(1-(double)(idle.Value-previousIdle.Value)/(total-previousTotal.Value)),0,100);
   previousTotal=total;previousIdle=idle.Value;
  }
  var memory=new Memory();if(!GlobalMemoryStatusEx(memory))throw new IOException("Contadores de memória indisponíveis.");
  var disks=new List<Disk>();
  foreach(var drive in DriveInfo.GetDrives()) {
   if(drive.DriveType!=DriveType.Fixed)continue;
   try{if(drive.IsReady&&drive.TotalSize>0)disks.Add(new(drive.Name.TrimEnd('\\'),drive.TotalSize,drive.TotalFreeSpace));}catch(IOException){}catch(UnauthorizedAccessException){}
   if(disks.Count>=32)break;
  }
  return new(cpu,checked((long)memory.Total),checked((long)memory.Available),disks);
 }
 public static string InternalIp(){
  try{return string.Join(",",NetworkInterface.GetAllNetworkInterfaces().Where(x=>x.OperationalStatus==OperationalStatus.Up&&x.NetworkInterfaceType!=NetworkInterfaceType.Loopback).SelectMany(x=>x.GetIPProperties().UnicastAddresses).Where(x=>x.Address.AddressFamily==System.Net.Sockets.AddressFamily.InterNetwork).Select(x=>x.Address.ToString()).Distinct().Take(8));}catch{return "";}
 }
}
