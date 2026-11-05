namespace UaiSuporte.Setup;
// Only application files participate. DeviceStore is deliberately outside this transaction.
public sealed class ApplicationSwap {
 public string Live{get;}public string Staged=>Live+".next";public string Previous=>Live+".previous";
 public ApplicationSwap(string live){Live=Path.GetFullPath(live);Check(Live);}
 static void Check(string path){for(var d=new DirectoryInfo(path);d!=null;d=d.Parent)if(d.Exists&&d.Attributes.HasFlag(FileAttributes.ReparsePoint))throw new IOException("Diretório redirecionado.");}
 static void Delete(string path){if(!Directory.Exists(path))return;Check(path);foreach(string p in Directory.EnumerateFileSystemEntries(path)){if(File.GetAttributes(p).HasFlag(FileAttributes.ReparsePoint))throw new IOException("Link inesperado.");if(Directory.Exists(p))Delete(p);else File.Delete(p);}Directory.Delete(path);}
 public void Swap(){Check(Live);Check(Staged);Check(Previous);if(Directory.Exists(Previous)||!Directory.Exists(Staged))throw new IOException("Transação pendente ou pacote ausente.");Directory.Move(Live,Previous);try{Directory.Move(Staged,Live);}catch{Directory.Move(Previous,Live);throw;}}
 public void Rollback(){if(Directory.Exists(Previous)){Delete(Live);Directory.Move(Previous,Live);}Delete(Staged);}
 public void Commit(){Delete(Previous);}
}
