package br.com.uaitelecom.suporte;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/desktop")
class DesktopController {
 final Db db;
 DesktopController(Db db){this.db=db;}
 @GetMapping("/identity") Map<String,Object> identity(HttpServletRequest r){
  return DeviceController.publicDevice(db.one("SELECT * FROM device WHERE id=?",Security.actor(r).id()));
 }
 @GetMapping("/connections") List<Map<String,Object>> history(HttpServletRequest r){
  return db.list("SELECT * FROM remote_session WHERE device_id=? ORDER BY requested_at DESC LIMIT 100",Security.actor(r).id()).stream().map(SessionService::publicSession).toList();
 }
 // Receive-only identities cannot create, inspect another session, or obtain a viewer bootstrap.
 @RequestMapping(value={"/connections","/sessions/{id}/launch","/sessions/{id}/stop"},method=RequestMethod.POST)
 void forbidden(){throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN,"Este aplicativo somente recebe suporte. Utilize o painel web autorizado.");}
}
