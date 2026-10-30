package br.com.uaitelecom.suporte;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.transaction.annotation.Transactional;

@RestController @Validated @RequestMapping("/api")
class MonitoringController {
 final MonitoringService service;final Db db;final DeviceController devices;final SessionService sessions;
 MonitoringController(MonitoringService s,Db db,DeviceController d,SessionService sessions){service=s;this.db=db;devices=d;this.sessions=sessions;}
 Security.Actor read(HttpServletRequest r,String resource){var a=Security.actor(r);MonitoringService.reader(a);db.audit(a.id().toString(),"INVENTORY_READ",resource);return a;}
 @PostMapping("/agent/presence") Map<String,Object> presence(@Valid @RequestBody MonitoringService.Report body,HttpServletRequest r){var d=devices.agent(r);Security.require(d.get("mesh_node")!=null,"Vínculo seguro pendente.");String ip=r.getRemoteAddr();String forwarded=r.getHeader("X-Forwarded-For");if((ip.equals("127.0.0.1")||ip.equals("0:0:0:0:0:0:0:1"))&&forwarded!=null&&forwarded.matches("[0-9a-fA-F:.]{2,45}"))ip=forwarded;return service.ingest(Db.id(d,"id"),body,ip);}
 record Event(@NotNull @Pattern(regexp="AGENT_START_FAILED|AGENT_STOP_FAILED|METRICS_UNAVAILABLE|AGENT_DISCONNECTED") String code) {}
 @PostMapping("/agent/events") void event(@Valid @RequestBody Event b,HttpServletRequest r){var d=devices.agent(r);var id=Db.id(d,"id");sessions.throttle("device-event:"+id,5);db.exec("INSERT INTO device_event VALUES (?,?,?,?)",UUID.randomUUID(),id,b.code(),OffsetDateTime.now());if(b.code().startsWith("AGENT_"))db.exec("UPDATE device SET agent_health='ERROR',error_since=COALESCE(error_since,?) WHERE id=?",OffsetDateTime.now(),id);}
 @GetMapping("/agent/requests") Map<String,Object> requests(HttpServletRequest r){var d=devices.agent(r);return Map.of("requests",sessions.forDevice(Db.id(d,"id")));}
 @GetMapping("/monitoring/config") Map<String,Object> config(HttpServletRequest r){read(r,"configuration");return service.config();}
 @PutMapping("/monitoring/config") void config(@Valid @RequestBody MonitoringService.Config c,HttpServletRequest r){service.configure(c,Security.actor(r));}
 @GetMapping("/inventory") Map<String,Object> list(HttpServletRequest r,
  @RequestParam(defaultValue="0") @Min(0) @Max(100000) int page,@RequestParam(defaultValue="25") @Min(1) @Max(100) int size,
  @RequestParam(defaultValue="") @Size(max=120) String q,@RequestParam(defaultValue="") @Size(max=120) String city,
  @RequestParam(defaultValue="") @Size(max=120) String department,@RequestParam(defaultValue="") @Size(max=40) String version,
  @RequestParam(defaultValue="") @Pattern(regexp="|ONLINE|OFFLINE|IN_SESSION|DISABLED|ERROR") String state,
  @RequestParam(defaultValue="false") boolean lowDisk,@RequestParam(defaultValue="false") boolean highCpu,@RequestParam(defaultValue="false") boolean highMemory){
  read(r,"inventory");var c=service.config();String base="SELECT d.*,"+service.stateSql()+" AS state FROM device d";var args=new ArrayList<Object>();args.add(MonitoringService.deadline(db));String where=" WHERE 1=1";
  if(!q.isBlank()){where+=" AND LOWER(CONCAT(COALESCE(public_code,''),' ',name,' ',friendly_name,' ',responsible,' ',city,' ',department)) LIKE ? ESCAPE '!'";args.add("%"+q.toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%");}
  for(var entry:List.of(Map.entry("city",city),Map.entry("department",department),Map.entry("app_version",version),Map.entry("state",state)))if(!entry.getValue().isBlank()){where+=" AND "+entry.getKey()+"=?";args.add(entry.getValue());}
  for(var entry:List.of(Map.entry("disk_low_since",lowDisk),Map.entry("cpu_high_since",highCpu),Map.entry("memory_high_since",highMemory)))if(entry.getValue()){where+=" AND "+entry.getKey()+"<=? AND last_seen>? AND metric_at>? AND revoked=FALSE";args.add(OffsetDateTime.now().minusSeconds(MonitoringService.number(c,"duration_seconds")));args.add(MonitoringService.deadline(db));args.add(OffsetDateTime.now().minusSeconds(MonitoringService.number(c,"metrics_seconds")*3L));}
  String from=" FROM ("+base+") inventory"+where;
  long total=((Number)db.one("SELECT COUNT(*) AS n"+from,args.toArray()).get("n")).longValue();args.add(size);args.add((long)page*size);
  var items=db.list("SELECT *"+from+" ORDER BY LOWER(name),id LIMIT ? OFFSET ?",args.toArray()).stream().map(d->service.display(d,c)).toList();return Map.of("items",items,"total",total,"page",page,"size",size);
 }
 @GetMapping("/inventory/{id}") Map<String,Object> detail(@PathVariable UUID id,HttpServletRequest r){
  var a=read(r,id.toString());var d=db.one("SELECT d.*,"+service.stateSql()+" AS state FROM device d WHERE d.id=?",MonitoringService.deadline(db),id);
  var latest=db.list("SELECT * FROM device_metric WHERE device_id=? ORDER BY observed_at DESC LIMIT 1",id);
  return Map.of("device",service.display(d,service.config()),"latest",latest,"connections",db.list("SELECT id,mode,status,requested_at,started_at,ended_at,result,requester_name,requester_device_id FROM remote_session WHERE device_id=? OR requester_device_id=? ORDER BY requested_at DESC LIMIT 100",id,id),"changes",db.list("SELECT c.*,u.name AS admin_name FROM device_change c JOIN app_user u ON u.id=c.admin_id WHERE c.device_id=? ORDER BY c.changed_at DESC LIMIT 100",id),"events",db.list("SELECT event_code,observed_at FROM device_event WHERE device_id=? ORDER BY observed_at DESC LIMIT 100",id),"canConnect",a.staff()&&sessions.access.device(a,id,false));
 }
 record Metadata(@NotNull @Size(max=120) String friendlyName,@NotNull @Size(max=120) String responsible,@NotNull @Size(max=120) String city,@NotNull @Size(max=120) String department,@NotNull @Size(max=2000) String notes,@Size(max=500) String reason) {}
 @PutMapping("/inventory/{id}") @Transactional
 void edit(@PathVariable UUID id,@Valid @RequestBody Metadata b,HttpServletRequest r){
  var a=Security.actor(r);Security.require(a.admin(),"Apenas administrador.");var old=db.one("SELECT * FROM device WHERE id=? FOR UPDATE",id);
  var values=Map.of("friendly_name",b.friendlyName(),"responsible",b.responsible(),"city",b.city(),"department",b.department(),"notes",b.notes());
  for(var e:values.entrySet())if(!Objects.equals(e.getValue(),old.get(e.getKey())))db.exec("INSERT INTO device_change VALUES (?,?,?,?,?,?,?,?)",UUID.randomUUID(),id,a.id(),e.getKey(),old.get(e.getKey()),e.getValue(),b.reason(),OffsetDateTime.now());
  db.exec("UPDATE device SET friendly_name=?,responsible=?,city=?,department=?,notes=? WHERE id=?",b.friendlyName(),b.responsible(),b.city(),b.department(),b.notes(),id);
  db.audit(a.id().toString(),"DEVICE_METADATA_CHANGED",id);
 }
 @GetMapping("/inventory/{id}/metrics") Map<String,Object> metrics(@PathVariable UUID id,@RequestParam OffsetDateTime from,@RequestParam OffsetDateTime to,HttpServletRequest r){
  read(r,id.toString());Security.require(from.isBefore(to)&&Duration.between(from,to).toDays()<=365&&!to.isAfter(OffsetDateTime.now().plusMinutes(1)),"Período inválido (máximo 365 dias).");
  boolean hourly=Duration.between(from,to).toHours()>6;
  List<Map<String,Object>> rows;
  if(!hourly)rows=db.list("SELECT observed_at,cpu_pct,memory_total,memory_available,memory_pct,disk_free_pct,disks FROM device_metric WHERE device_id=? AND observed_at>=? AND observed_at<=? ORDER BY observed_at LIMIT 1000",id,from,to);
  else {
   rows=new ArrayList<>(db.list("SELECT hour_at AS observed_at,cpu_pct,memory_total,memory_available,memory_pct,disk_free_pct,disks FROM device_metric_hour WHERE device_id=? AND hour_at>=? AND hour_at<=? ORDER BY hour_at LIMIT 1000",id,from,to));
   var after=rows.isEmpty()?from:OffsetDateTime.ofInstant(Db.instant(rows.getLast().get("observed_at")),ZoneOffset.UTC).plusHours(1);
   rows.addAll(db.list("SELECT g.observed_at,g.cpu_pct,g.memory_total,g.memory_available,g.memory_pct,g.disk_free_pct,x.disks FROM (SELECT device_id,DATE_TRUNC('hour',observed_at) AS observed_at,AVG(cpu_pct) AS cpu_pct,MAX(memory_total) AS memory_total,CAST(AVG(memory_available) AS BIGINT) AS memory_available,AVG(memory_pct) AS memory_pct,MIN(disk_free_pct) AS disk_free_pct,MAX(observed_at) AS latest FROM device_metric WHERE device_id=? AND observed_at>=? AND observed_at<=? GROUP BY device_id,DATE_TRUNC('hour',observed_at)) g JOIN device_metric x ON x.device_id=g.device_id AND x.observed_at=g.latest ORDER BY g.observed_at LIMIT ?",id,after,to,Math.max(0,1000-rows.size())));
  }
  return Map.of("resolution",hourly?"hour":"sample","points",rows,"limit",1000,"truncated",rows.size()==1000);
 }
 @GetMapping("/monitoring/series") Map<String,Object> fleetSeries(@RequestParam OffsetDateTime from,@RequestParam OffsetDateTime to,HttpServletRequest r){read(r,"fleet-series");Security.require(from.isBefore(to)&&Duration.between(from,to).toDays()<=365,"Período inválido.");boolean hourly=Duration.between(from,to).toHours()>6;var rows=hourly?db.list("SELECT DATE_TRUNC('hour',observed_at) AS observed_at,AVG(online) AS online,AVG(offline) AS offline,AVG(in_session) AS in_session,AVG(cpu_pct) AS cpu_pct,AVG(memory_pct) AS memory_pct FROM fleet_metric WHERE observed_at>=? AND observed_at<=? GROUP BY DATE_TRUNC('hour',observed_at) ORDER BY observed_at LIMIT 1000",from,to):db.list("SELECT * FROM fleet_metric WHERE observed_at>=? AND observed_at<=? ORDER BY observed_at LIMIT 1000",from,to);return Map.of("points",rows,"resolution",hourly?"hour":"sample","truncated",rows.size()==1000);}
 @GetMapping("/monitoring/summary") Map<String,Object> summary(HttpServletRequest r){
  read(r,"summary");var c=service.config();var deadline=MonitoringService.deadline(db);var stable=OffsetDateTime.now().minusSeconds(MonitoringService.number(c,"duration_seconds"));
  var counts=db.list("SELECT state,COUNT(*) AS count FROM (SELECT "+service.stateSql()+" AS state FROM device d) x GROUP BY state",deadline);
  var totals=db.one("SELECT COUNT(*) AS total,SUM(CASE WHEN last_seen IS NULL OR last_seen<? THEN 1 ELSE 0 END) AS silent,SUM(CASE WHEN revoked=TRUE OR last_seen IS NULL OR last_seen<? OR (last_seen>=? AND (error_since<=? OR (metric_at>=? AND (cpu_high_since<=? OR memory_high_since<=? OR disk_low_since<=?)))) OR (?<>'' AND COALESCE(app_version,'')<>?) OR (?<>'' AND COALESCE(agent_version,'')<>?) THEN 1 ELSE 0 END) AS alerts FROM device",OffsetDateTime.now().minusSeconds(MonitoringService.number(c,"silent_seconds")),deadline,deadline,stable,OffsetDateTime.now().minusSeconds(MonitoringService.number(c,"metrics_seconds")*3L),stable,stable,stable,c.get("expected_app"),c.get("expected_app"),c.get("expected_agent"),c.get("expected_agent"));
  return Map.of("counts",counts,"totals",totals,"versions",db.list("SELECT COALESCE(app_version,'Não informada') AS version,COUNT(*) AS count FROM device GROUP BY app_version ORDER BY count DESC LIMIT 100"));
 }
}
