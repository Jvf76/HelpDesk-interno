package br.com.uaitelecom.suporte;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/desktop")
class DesktopController {
 final SessionService sessions; final Db db;
 DesktopController(SessionService s,Db db) {sessions=s;this.db=db;}
 @GetMapping("/identity") Map<String,Object> identity(HttpServletRequest r) {
  var a=Security.actor(r);return DeviceController.publicDevice(db.one("SELECT * FROM device WHERE id=?",a.id()));
 }
 record Request(@NotBlank @Size(max=64) String code,@NotNull @Pattern(regexp="VIEW|CONTROL") String mode,@Size(max=120) String windowsUser) {}
 @PostMapping("/connections") Map<String,Object> request(@Valid @RequestBody Request b,HttpServletRequest r) {
  var a=Security.actor(r);
  Security.require(db.exists("SELECT 1 FROM device WHERE id=? AND mesh_node IS NOT NULL AND (agent_health IS NULL OR agent_health='OK') AND last_seen>?",a.id(),MonitoringService.deadline(db)),"Ative a disponibilidade deste computador.");
  var s=sessions.requestAssisted(a,b.code(),b.mode(),r.getRemoteAddr());
  db.exec("UPDATE remote_session SET windows_user=? WHERE id=?",b.windowsUser(),s.get("id"));
  return s;
 }
 @GetMapping("/connections") List<Map<String,Object>> history(HttpServletRequest r) {
  return db.list("SELECT * FROM remote_session WHERE requester_device_id=? ORDER BY requested_at DESC LIMIT 100",Security.actor(r).id()).stream().map(SessionService::publicSession).toList();
 }
 @GetMapping("/sessions/{id}") Map<String,Object> get(@PathVariable UUID id,HttpServletRequest r) {sessions.sweep();return sessions.get(Security.actor(r),id);}
 @PostMapping("/sessions/{id}/stop") Map<String,Object> stop(@PathVariable UUID id,HttpServletRequest r) {sessions.stop(Security.actor(r),id);return sessions.get(Security.actor(r),id);}
 @PostMapping("/sessions/{id}/launch") Map<String,Object> launch(@PathVariable UUID id,HttpServletRequest r) {
  String ip=r.getRemoteAddr();
  if((ip.equals("127.0.0.1")||ip.equals("0:0:0:0:0:0:0:1"))&&r.getHeader("X-Forwarded-For")!=null) ip=r.getHeader("X-Forwarded-For");
  return sessions.viewer(Security.actor(r),id,ip);
 }
}
