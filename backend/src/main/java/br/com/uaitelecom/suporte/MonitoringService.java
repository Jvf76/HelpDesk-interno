package br.com.uaitelecom.suporte;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;

@Service
class MonitoringService {
 final Db db; final ObjectMapper json;
 MonitoringService(Db db,ObjectMapper json){this.db=db;this.json=json;}
 record Disk(@NotBlank @Pattern(regexp="[A-Za-z]:") String volume,@Positive long totalBytes,@PositiveOrZero long freeBytes) {}
 record Sample(@DecimalMin("0") @DecimalMax("100") Double cpuPercent,@Positive long memoryTotal,@PositiveOrZero long memoryAvailable,@NotNull @Size(max=32) List<@Valid Disk> disks) {}
 record Report(@NotBlank @Size(max=120) String machineName,@NotBlank @Size(max=200) String os,@Size(max=200) String windowsUser,@NotBlank @Size(max=40) String appVersion,@NotBlank @Size(max=80) String agentVersion,@Size(max=200) @Pattern(regexp="[0-9a-fA-F:., ]*") String internalIp,@PositiveOrZero long uptimeSeconds,@NotNull @Pattern(regexp="OK|MISSING|INVALID|UNBOUND|STOPPED|ERROR") String health,@Valid Sample metrics) {}
 record Config(@Min(15) @Max(120) int heartbeatSeconds,@Min(30) @Max(600) int metricsSeconds,@Min(45) @Max(600) int offlineSeconds,@Min(1) @Max(100) double cpuLimit,@Min(1) @Max(100) double memoryLimit,@Min(1) @Max(99) double diskFreeLimit,@Min(60) @Max(3600) int durationSeconds,@Min(120) @Max(604800) int silentSeconds,@Min(1) @Max(7) int detailDays,@Min(7) @Max(365) int hourlyDays,@Min(30) @Max(3650) int eventDays,@NotNull @Size(max=40) String expectedApp,@NotNull @Size(max=80) String expectedAgent) {}
 Map<String,Object> config(){var c=new LinkedHashMap<>(db.one("SELECT * FROM monitoring_config WHERE id=1"));c.remove("rollup_until");return c;}
 static int number(Map<String,Object> r,String key){return ((Number)r.get(key)).intValue();}
 static OffsetDateTime deadline(Db db){return OffsetDateTime.now().minusSeconds(number(db.one("SELECT offline_seconds FROM monitoring_config WHERE id=1"),"offline_seconds"));}
 static void reader(Security.Actor a){Security.require(a!=null&&Set.of("ADMIN","OPERADOR","TECNICO","LEITURA").contains(a.role()),"Permissão de inventário necessária.");}
 @Transactional
 public Map<String,Object> ingest(UUID id,Report r,String publicIp) {
  var d=db.one("SELECT * FROM device WHERE id=? FOR UPDATE",id);
  Security.require(!Boolean.TRUE.equals(d.get("revoked")),"Dispositivo revogado.");
  var c=config();var now=OffsetDateTime.now();
  // A row lock makes concurrent samples obey the same per-device admission interval.
  if(!Db.instant(d.get("last_seen")).isBefore(now.toInstant().minusSeconds(5)))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,"Aguarde antes de enviar outra presença.");
  boolean gap=Db.instant(d.get("last_seen")).isBefore(now.toInstant().minusSeconds(number(c,"offline_seconds")));
  if(gap)db.exec("UPDATE device SET online_since=?,cpu_high_since=NULL,memory_high_since=NULL,disk_low_since=NULL,error_since=NULL WHERE id=?",now,id);
  if(!Objects.equals(r.health(),d.get("agent_health")))db.exec("INSERT INTO device_event VALUES (?,?,?,?)",UUID.randomUUID(),id,"AGENT_"+r.health(),now);
  db.exec("UPDATE device SET name=?,os=?,windows_user=?,app_version=?,agent_version=?,internal_ip=?,public_ip=?,uptime_seconds=?,boot_at=?,last_seen=?,agent_health=?,error_since=CASE WHEN ?='OK' THEN NULL ELSE COALESCE(error_since,?) END WHERE id=? AND revoked=FALSE",r.machineName(),r.os(),r.windowsUser(),r.appVersion(),r.agentVersion(),r.internalIp(),publicIp,r.uptimeSeconds(),now.minusSeconds(Math.min(r.uptimeSeconds(),315576000L)),now,r.health(),r.health(),now,id);
  Sample m=r.metrics();
  if(m!=null&&Db.instant(d.get("metric_at")).isBefore(now.toInstant().minusSeconds(Math.max(15,number(c,"metrics_seconds")/2)))) {
   Security.require(m.cpuPercent()==null||Double.isFinite(m.cpuPercent()),"CPU inválida.");
   Security.require(m.memoryAvailable()<=m.memoryTotal(),"Memória inválida.");
   Set<String> volumes=new HashSet<>();Double disk=null;
   for(var x:m.disks()){Security.require(x.freeBytes()<=x.totalBytes()&&volumes.add(x.volume()),"Disco inválido.");double pct=100.0*x.freeBytes()/x.totalBytes();disk=disk==null?pct:Math.min(disk,pct);}
   double mem=100.0*(m.memoryTotal()-m.memoryAvailable())/m.memoryTotal();String disks;
   try{disks=json.writeValueAsString(m.disks());}catch(Exception e){throw new IllegalArgumentException();}
   db.exec("INSERT INTO device_metric VALUES (?,?,?,?,?,?,?,?)",id,now,m.cpuPercent(),m.memoryTotal(),m.memoryAvailable(),mem,disk,disks);
   if(gap||Db.instant(d.get("metric_at")).isBefore(now.toInstant().minusSeconds(number(c,"metrics_seconds")*3L)))db.exec("UPDATE device SET cpu_high_since=NULL,memory_high_since=NULL,disk_low_since=NULL WHERE id=?",id);
   db.exec("UPDATE device SET metric_at=?,cpu_pct=?,memory_pct=?,disk_free_pct=? WHERE id=?",now,m.cpuPercent(),mem,disk,id);
   threshold(id,"cpu_high_since",m.cpuPercent()!=null&&m.cpuPercent()>=((Number)c.get("cpu_limit")).doubleValue(),now);
   threshold(id,"memory_high_since",mem>=((Number)c.get("memory_limit")).doubleValue(),now);
   threshold(id,"disk_low_since",disk!=null&&disk<=((Number)c.get("disk_free_limit")).doubleValue(),now);
  }
  return Map.of("heartbeatSeconds",c.get("heartbeat_seconds"),"metricsSeconds",c.get("metrics_seconds"));
 }
 void threshold(UUID id,String column,boolean high,OffsetDateTime now){db.exec("UPDATE device SET "+column+"="+(high?"COALESCE("+column+",?)":"NULL")+" WHERE id=?",high?new Object[]{now,id}:new Object[]{id});}
 String stateSql(){return "CASE WHEN d.revoked=TRUE THEN 'DISABLED' WHEN d.last_seen IS NULL OR d.last_seen < ? THEN 'OFFLINE' WHEN EXISTS(SELECT 1 FROM remote_session rs WHERE rs.device_id=d.id AND rs.ended_at IS NULL AND rs.status='ACTIVE') THEN 'IN_SESSION' WHEN d.agent_health IS NOT NULL AND d.agent_health<>'OK' THEN 'ERROR' ELSE 'ONLINE' END";}
 List<String> alerts(Map<String,Object> d,Map<String,Object> c){
  var out=new ArrayList<String>();Instant stable=Instant.now().minusSeconds(number(c,"duration_seconds"));
  boolean fresh=Db.instant(d.get("last_seen")).isAfter(Instant.now().minusSeconds(number(c,"offline_seconds")));
  if(Boolean.TRUE.equals(d.get("revoked")))out.add("REVOKED");
  if(!fresh)out.add("NO_HEARTBEAT");
  if(fresh&&Db.instant(d.get("metric_at")).isAfter(Instant.now().minusSeconds(number(c,"metrics_seconds")*3L)))for(var pair:List.of(new String[]{"cpu_high_since","CPU_HIGH"},new String[]{"memory_high_since","MEMORY_HIGH"},new String[]{"disk_low_since","DISK_LOW"}))if(d.get(pair[0])!=null&&Db.instant(d.get(pair[0])).isBefore(stable))out.add(pair[1]);
  if(d.get("error_since")!=null&&Db.instant(d.get("error_since")).isBefore(stable))out.add("AGENT_ERROR");
  if(!Objects.toString(c.get("expected_app"),"").isBlank()&&!Objects.equals(c.get("expected_app"),d.get("app_version")))out.add("APP_VERSION");
  if(!Objects.toString(c.get("expected_agent"),"").isBlank()&&!Objects.equals(c.get("expected_agent"),d.get("agent_version")))out.add("AGENT_VERSION");
  return out;
 }
 Map<String,Object> display(Map<String,Object> d,Map<String,Object> c){var x=DeviceController.publicDevice(d);x.put("online",!Boolean.TRUE.equals(d.get("revoked"))&&Db.instant(d.get("last_seen")).isAfter(Instant.now().minusSeconds(number(c,"offline_seconds"))));x.put("alerts",alerts(d,c));return x;}
 @Transactional public void configure(Config c,Security.Actor a){Security.require(a.admin(),"Apenas administrador.");Security.require(c.offlineSeconds()>=c.heartbeatSeconds()*3,"Prazo offline deve cobrir três heartbeats.");db.exec("UPDATE monitoring_config SET heartbeat_seconds=?,metrics_seconds=?,offline_seconds=?,cpu_limit=?,memory_limit=?,disk_free_limit=?,duration_seconds=?,silent_seconds=?,detail_days=?,hourly_days=?,event_days=?,expected_app=?,expected_agent=? WHERE id=1",c.heartbeatSeconds(),c.metricsSeconds(),c.offlineSeconds(),c.cpuLimit(),c.memoryLimit(),c.diskFreeLimit(),c.durationSeconds(),c.silentSeconds(),c.detailDays(),c.hourlyDays(),c.eventDays(),c.expectedApp(),c.expectedAgent());db.exec("UPDATE device SET cpu_high_since=NULL,memory_high_since=NULL,disk_low_since=NULL,error_since=NULL");db.audit(a.id().toString(),"MONITORING_CONFIG_CHANGED","1");}
 @Scheduled(fixedDelay=3600000,initialDelay=60000) @Transactional
 public void retain(){
  var c=db.one("SELECT * FROM monitoring_config WHERE id=1 FOR UPDATE");var until=OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.HOURS);
  var since=c.get("rollup_until");if(since==null)since=OffsetDateTime.ofInstant(Instant.EPOCH,ZoneOffset.UTC);
  db.exec("INSERT INTO device_metric_hour SELECT g.device_id,g.hour_at,g.samples,g.cpu_pct,g.cpu_max,g.memory_pct,g.memory_total,g.memory_available,g.disk_free_pct,x.disks FROM (SELECT device_id,DATE_TRUNC('hour',observed_at) AS hour_at,COUNT(*) AS samples,AVG(cpu_pct) AS cpu_pct,MAX(cpu_pct) AS cpu_max,AVG(memory_pct) AS memory_pct,MAX(memory_total) AS memory_total,CAST(AVG(memory_available) AS BIGINT) AS memory_available,MIN(disk_free_pct) AS disk_free_pct,MAX(observed_at) AS latest FROM device_metric WHERE observed_at>=? AND observed_at<? GROUP BY device_id,DATE_TRUNC('hour',observed_at)) g JOIN device_metric x ON x.device_id=g.device_id AND x.observed_at=g.latest",since,until);
  db.exec("UPDATE monitoring_config SET rollup_until=? WHERE id=1",until);
  db.exec("DELETE FROM device_metric WHERE observed_at<?",OffsetDateTime.now().minusDays(number(c,"detail_days")));
  db.exec("DELETE FROM device_metric_hour WHERE hour_at<?",OffsetDateTime.now().minusDays(number(c,"hourly_days")));
  db.exec("DELETE FROM fleet_metric WHERE observed_at<?",OffsetDateTime.now().minusDays(number(c,"hourly_days")));
  db.exec("DELETE FROM device_event WHERE observed_at<?",OffsetDateTime.now().minusDays(number(c,"event_days")));
  // Administrative/access audit is never deleted by the metrics retention job.
 }
 @Scheduled(fixedDelay=60000,initialDelay=60000)
 public void fleet(){var cutoff=deadline(db);db.exec("INSERT INTO fleet_metric SELECT ?,COUNT(*),COALESCE(SUM(CASE WHEN revoked=FALSE AND last_seen>=? THEN 1 ELSE 0 END),0),COALESCE(SUM(CASE WHEN revoked=FALSE AND (last_seen IS NULL OR last_seen<?) THEN 1 ELSE 0 END),0),(SELECT COUNT(DISTINCT device_id) FROM remote_session WHERE status='ACTIVE' AND ended_at IS NULL),AVG(CASE WHEN revoked=FALSE AND last_seen>=? AND metric_at>=? THEN cpu_pct ELSE NULL END),AVG(CASE WHEN revoked=FALSE AND last_seen>=? AND metric_at>=? THEN memory_pct ELSE NULL END) FROM device",OffsetDateTime.now(),cutoff,cutoff,cutoff,cutoff,cutoff,cutoff);}
}
