namespace UaiSuporte.Agent;
// At most one in-flight report, no persistent or growing queue. Only the next fresh sample is sent.
public sealed class MonitoringSchedule {
 public int HeartbeatSeconds{get;private set;}=30;
 public int MetricsSeconds{get;private set;}=60;
 public DateTimeOffset NextPresence{get;private set;}=DateTimeOffset.MinValue;
 public DateTimeOffset NextMetrics{get;private set;}=DateTimeOffset.MinValue;
 int failures;
 public void Configure(int presence,int metrics){HeartbeatSeconds=Math.Clamp(presence,15,120);MetricsSeconds=Math.Clamp(metrics,30,600);}
 public bool Due(DateTimeOffset now)=>now>=NextPresence;
 public bool MetricsDue(DateTimeOffset now)=>now>=NextMetrics;
 public void Success(DateTimeOffset now,bool metrics,double jitter){failures=0;NextPresence=now.AddSeconds(HeartbeatSeconds*(1+Math.Clamp(jitter,-.1,.1)));if(metrics)NextMetrics=now.AddSeconds(MetricsSeconds*(1+Math.Clamp(jitter,-.1,.1)));}
 public void Failure(DateTimeOffset now,double jitter){failures=Math.Min(failures+1,7);NextPresence=now.AddSeconds(Math.Min(300,5*Math.Pow(2,failures-1))*(1+Math.Clamp(jitter,-.1,.1)));}
}
