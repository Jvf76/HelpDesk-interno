package br.com.uaitelecom.suporte;

import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api")
class EquipmentHistory {
  final Db db;
  EquipmentHistory(Db db){this.db=db;}

  @DeleteMapping("/inventory/{id}") @Transactional
  void remove(@PathVariable UUID id,HttpServletRequest request){
    Security.require(Security.actor(request).admin(),"Apenas administrador.");
    var d=db.one("SELECT removed_at FROM device WHERE id=? FOR UPDATE",id);
    if(d.get("removed_at")!=null)return;
    if(db.exists("SELECT 1 FROM remote_session WHERE (device_id=? OR requester_device_id=?) AND ended_at IS NULL",id,id))
      throw new ResponseStatusException(HttpStatus.CONFLICT,"Encerre o atendimento antes de remover este computador.");
    if(db.exists("SELECT 1 FROM printer WHERE collector=? AND removed_at IS NULL",id))
      throw new ResponseStatusException(HttpStatus.CONFLICT,"Desvincule este computador das impressoras que o usam como coletor.");
    db.exec("UPDATE device SET removed_at=?,last_seen=NULL,revoked=TRUE,agent_hash=NULL,registration_hash=NULL,enrollment_hash=NULL,enrollment_receipt_hash=NULL WHERE id=?",OffsetDateTime.now(),id);
    db.audit(Security.actor(request).id().toString(),"DEVICE_REMOVED",id);
  }

  @GetMapping("/equipment-history/{kind}/removed")
  List<Map<String,Object>> removed(@PathVariable String kind,HttpServletRequest r){
    MonitoringService.reader(Security.actor(r));
    return switch(kind){
      case "computers" -> db.list("SELECT id,COALESCE(NULLIF(friendly_name,''),name) AS name,public_code AS code FROM device WHERE removed_at IS NOT NULL ORDER BY removed_at DESC,id");
      case "printers" -> {Security.require(Security.actor(r).staff(),"Acesso da TI necessário.");yield db.list("SELECT id,label AS name,serial AS code FROM printer WHERE removed_at IS NOT NULL ORDER BY removed_at DESC,id");}
      default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    };
  }

  @GetMapping("/equipment-history/{kind}/{id}/events")
  List<Map<String,Object>> events(@PathVariable String kind,@PathVariable String id,@RequestParam(defaultValue="0") int page,HttpServletRequest r){
    MonitoringService.reader(Security.actor(r));
    if(page<0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    if(kind.equals("printers")){
      Security.require(Security.actor(r).staff(),"Acesso da TI necessário.");
      return db.list("SELECT c.action,c.before_value,c.after_value,c.changed_at,u.login AS actor_login FROM printer_change c LEFT JOIN app_user u ON u.id=c.actor_id WHERE printer_id=? ORDER BY changed_at DESC,c.id LIMIT 51 OFFSET ?",id,page*50L);
    }
    if(!kind.equals("computers"))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return db.list("SELECT action,before_value,after_value,changed_at,u.login AS actor_login FROM ("+COMPUTER_EVENTS+
        ") h LEFT JOIN app_user u ON CAST(u.id AS VARCHAR)=h.actor_key WHERE device_key=? ORDER BY changed_at DESC,h.id LIMIT 51 OFFSET ?",UUID.fromString(id).toString(),page*50L);
  }

  @GetMapping("/equipment-history/computers/events")
  List<Map<String,Object>> computerEvents(@RequestParam(defaultValue="0") int page,HttpServletRequest r){
    MonitoringService.reader(Security.actor(r));
    if(page<0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    // Page by computer so all changes to one computer stay together.
    return db.list("WITH events AS ("+COMPUTER_EVENTS+"""
        ), ranked AS (
          SELECT device_key,DENSE_RANK() OVER (ORDER BY MAX(changed_at) DESC,device_key) AS pos
          FROM events GROUP BY device_key
        )
        SELECT d.id,COALESCE(NULLIF(d.friendly_name,''),d.name) AS name,d.public_code AS code,
               h.action,h.changed_at,h.before_value,h.after_value,u.login AS actor_login
        FROM ranked g JOIN events h ON h.device_key=g.device_key JOIN device d ON CAST(d.id AS VARCHAR)=g.device_key
        LEFT JOIN app_user u ON CAST(u.id AS VARCHAR)=h.actor_key
        WHERE g.pos>? AND g.pos<=? ORDER BY g.pos,h.changed_at DESC,h.id
        """,page*10L,page*10L+11);

  }

  private static final String COMPUTER_EVENTS="""
      SELECT resource_id AS device_key,action,NULL AS before_value,NULL AS after_value,created_at AS changed_at,id,actor AS actor_key
        FROM audit_event WHERE action IN
        ('DEVICE_CREATED','DEVICE_REMOVED','DEVICE_REVOKED','DEVICE_RECOVERY_ISSUED','DEVICE_UNREGISTERED_LOCALLY','PERMISSION_GRANTED','PERMISSION_REVOKED')
      UNION ALL
      SELECT CAST(device_id AS VARCHAR),field_name,old_value,new_value,changed_at,id,CAST(admin_id AS VARCHAR) FROM device_change
      UNION ALL
      SELECT CAST(t.device_id AS VARCHAR),CASE WHEN t.target_id IS NULL THEN 'DEVICE_ACTIVATED' ELSE 'DEVICE_REACTIVATED' END,NULL,NULL,a.created_at,a.id,CAST(t.issued_by AS VARCHAR)
        FROM activation_token t JOIN audit_event a ON a.resource_id=CAST(t.id AS VARCHAR) AND a.action='ACTIVATION_USED'
      """;
}
