using UaiSuporte.Agent;
int count=0;void Check(bool v,string name){if(!v)throw new Exception(name);count++;}
var now=DateTimeOffset.UtcNow;var s=new MonitoringSchedule();Check(s.Due(now)&&s.MetricsDue(now),"initial collection");
s.Success(now,true,.1);Check(!s.Due(now.AddSeconds(20)),"no excessive presence");Check(!s.MetricsDue(now.AddSeconds(40)),"no excessive collection");Check(s.Due(now.AddSeconds(34)),"presence jitter bounded");Check(s.MetricsDue(now.AddSeconds(67)),"metric jitter bounded");
for(int i=0;i<30;i++){s.Failure(now,.1);Check(s.NextPresence<=now.AddSeconds(330.01),"bounded exponential backoff");Check(s.NextPresence>now,"no retry loop");now=s.NextPresence;}
s.Success(now,false,0);Check(s.NextPresence==now.AddSeconds(30),"recovery resets backoff");s.Configure(1,99999);Check(s.HeartbeatSeconds==15&&s.MetricsSeconds==600,"server intervals clamped");
Console.WriteLine($"{count} scheduling checks passed; Windows counter collection not executed.");
