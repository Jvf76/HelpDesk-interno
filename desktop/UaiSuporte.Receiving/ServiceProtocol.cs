using System.Buffers.Binary;
using System.Text.Json;
namespace UaiSuporte.Agent;
public record LocalCommand(string Action,string? Token=null,Guid? RequestId=null,string? Decision=null,bool Indicator=false,bool Unlocked=true,int? DialogPid=null){public override string ToString()=>"LocalCommand["+Action+", REDACTED]";}
public record LocalReply(int Status,string Body);
public static class ServiceProtocol {
 public const int Maximum=32768;
 public const string PipeName="UaiSuporte.Corporate.v1";
 public static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web){PropertyNameCaseInsensitive=true};
 public static bool Allowed(LocalCommand c)=> (c.Action=="native-dialog"||c.DialogPid==null)&&c.Action switch {
  "native-dialog"=>c.Token==null&&c.RequestId.HasValue&&c.Decision==null&&c.DialogPid is >0,
  "status" or "history" or "identity" or "stop"=>c.Token==null&&c.RequestId==null&&c.Decision==null,
  "pulse"=>c.Token==null&&c.Decision==null,
  "activate"=>c.Token is {Length:<=100}&&c.RequestId==null&&c.Decision==null,
  "consent"=>c.Token==null&&c.RequestId.HasValue&&c.Decision is "accept" or "accept-view" or "reject",
  _=>false};
 public static async Task Write<T>(Stream stream,T value,CancellationToken ct){var bytes=JsonSerializer.SerializeToUtf8Bytes(value,Json);if(bytes.Length>Maximum)throw new InvalidDataException();byte[] prefix=new byte[4];BinaryPrimitives.WriteInt32LittleEndian(prefix,bytes.Length);try{await stream.WriteAsync(prefix,ct);await stream.WriteAsync(bytes,ct);await stream.FlushAsync(ct);}finally{System.Security.Cryptography.CryptographicOperations.ZeroMemory(bytes);}}
 public static async Task<T> Read<T>(Stream stream,CancellationToken ct){byte[] prefix=new byte[4];await stream.ReadExactlyAsync(prefix,ct);int size=BinaryPrimitives.ReadInt32LittleEndian(prefix);if(size is <2 or >Maximum)throw new InvalidDataException();byte[] bytes=new byte[size];await stream.ReadExactlyAsync(bytes,ct);try{return JsonSerializer.Deserialize<T>(bytes,Json)??throw new InvalidDataException();}finally{System.Security.Cryptography.CryptographicOperations.ZeroMemory(bytes);}}
}
// Pure policy: a display acknowledgment is tied to the same active-session process and request.
public sealed class PresenterLease {
 public int Pid{get;private set;}=-1;
 public long Until{get;private set;}
 public Guid? Displayed{get;private set;}
 public void Pulse(int pid,long now,bool unlocked,Guid? displayed){if(!unlocked){Clear();return;}Pid=pid;Until=now+5000;Displayed=displayed;}
 public bool Live(int pid,long now)=>pid==Pid&&now<Until;
 public bool CanAccept(int pid,long now,Guid id)=>Live(pid,now)&&Displayed==id;
 public void Clear(){Pid=-1;Until=0;Displayed=null;}
}
