namespace UaiSuporte.Agent;
// Local terminal fence. A stop wins over delayed polls and consent HTTP responses.
public sealed class SessionStopFence {
 public long Epoch{get;private set;}
 readonly HashSet<Guid> ended=[];
 readonly Queue<Guid> order=[];
 public bool Allows(Guid id,long epoch)=>epoch==Epoch&&!ended.Contains(id);
 public void Stop(IEnumerable<Guid> ids){
  Epoch++;
  foreach(var id in ids)if(ended.Add(id)){order.Enqueue(id);if(order.Count>256)ended.Remove(order.Dequeue());}
 }
}
