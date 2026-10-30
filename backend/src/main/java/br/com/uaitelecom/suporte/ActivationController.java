package br.com.uaitelecom.suporte;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api")
class ActivationController {
  final Db db; final SessionService sessions;
  ActivationController(Db db, SessionService sessions) { this.db=db; this.sessions=sessions; }
  record Issue(@Min(30) @Max(3600) int lifetimeSeconds, UUID recoverDeviceId) {}
  // Secret fields deliberately have redacted toString implementations.
  record Activate(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String token,
      @NotNull UUID installationId,
      @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String credential,
      @NotBlank @Size(max=120) String name, @NotBlank @Size(max=200) String os, UUID recoverDeviceId) {
    @Override public String toString() { return "Activate[REDACTED]"; }
  }
  @PostMapping("/activation-tokens")
  Map<String,Object> issue(@Valid @RequestBody Issue input,HttpServletRequest r) {
    var a=Security.actor(r); Security.require(a.admin(),"Apenas administrador.");
    if(input.recoverDeviceId()!=null) Security.require(db.exists("SELECT 1 FROM device WHERE id=? AND revoked=TRUE AND organization='UAI_TELECOM'",input.recoverDeviceId()),"Recuperação exige cadastro revogado.");
    String token=Security.token();UUID id=UUID.randomUUID();
    db.exec("INSERT INTO activation_token(id,token_hash,organization,issued_by,expires_at,state,target_id) VALUES (?,?,'UAI_TELECOM',?,?,'ISSUED',?)",id,Security.hash(token),a.id(),OffsetDateTime.now().plusSeconds(input.lifetimeSeconds()),input.recoverDeviceId());
    db.audit(a.id().toString(),"ACTIVATION_ISSUED",id);
    return Map.of("id",id,"token",token,"expiresIn",input.lifetimeSeconds());
  }
  @PostMapping("/activation-tokens/{id}/revoke")
  void revoke(@PathVariable UUID id,HttpServletRequest r) {
    var a=Security.actor(r);Security.require(a.admin(),"Apenas administrador.");
    db.exec("UPDATE activation_token SET state='REVOKED' WHERE id=? AND state='ISSUED'",id);
    db.audit(a.id().toString(),"ACTIVATION_REVOKED",id);
  }
  @PostMapping("/agent/activate")
  @Transactional(noRollbackFor=ResponseStatusException.class)
  synchronized Map<String,Object> activate(@Valid @RequestBody Activate input,HttpServletRequest r) {
    sessions.throttle("activation:"+r.getRemoteAddr(),10);
    var rows=db.list("SELECT * FROM activation_token WHERE token_hash=? FOR UPDATE",Security.hash(input.token()));
    if(rows.isEmpty()) { db.audit("activation","ACTIVATION_INVALID","none"); throw failure("Token inválido."); }
    var t=rows.getFirst();String hash=Security.hash(input.credential());
    if("USED".equals(t.get("state"))) {
      if(input.installationId().equals(Db.id(t,"installation_id")) && hash.equals(t.get("credential_hash"))) {
        var d=db.one("SELECT * FROM device WHERE id=?",t.get("device_id"));
        if(!Boolean.TRUE.equals(d.get("revoked")) && hash.equals(d.get("agent_hash"))) return result(d);
        throw failure("Credencial revogada. Solicite reativação administrativa.");
      }
      throw failure("Token já utilizado.");
    }
    if("REVOKED".equals(t.get("state"))) throw failure("Token revogado.");
    if(!Db.instant(t.get("expires_at")).isAfter(Instant.now())) {
      if(db.exec("UPDATE activation_token SET state='EXPIRED' WHERE id=? AND state='ISSUED'",t.get("id"))==1) db.audit("activation","ACTIVATION_EXPIRED",t.get("id"));
      throw failure("Token expirado.");
    }
    Security.require("UAI_TELECOM".equals(t.get("organization")),"Organização inválida.");
    Security.require(!db.exists("SELECT 1 FROM device WHERE registration_id=? OR registration_hash=? OR agent_hash=?",input.installationId(),hash,hash),"Identidade existente. Recupere o cadastro original.");
    UUID id=Db.id(t,"target_id");
    Security.require(Objects.equals(id,input.recoverDeviceId()),"Use o token autorizado para este cadastro.");
    if(id==null) {
      id=UUID.randomUUID();String code;
      do {code=Security.token().replace("-","").replace("_","").substring(0,12).toUpperCase(Locale.ROOT);} while(db.exists("SELECT 1 FROM device WHERE public_code=?",code));
      db.exec("INSERT INTO device(id,name,os,location,department,registration_id,registration_hash,agent_hash,public_code) VALUES (?,?,?,'Não informado','Não informado',?,?,?,?)",id,input.name(),input.os(),input.installationId(),hash,hash,code);
    } else {
      Security.require(db.exec("UPDATE device SET revoked=FALSE,name=?,os=?,registration_id=?,registration_hash=?,agent_hash=?,last_seen=NULL,mesh_node=NULL,mesh_bound_at=NULL WHERE id=? AND revoked=TRUE",input.name(),input.os(),input.installationId(),hash,hash,id)==1,"Recuperação já utilizada.");
    }
    db.exec("UPDATE activation_token SET state='USED',installation_id=?,credential_hash=?,device_id=? WHERE id=?",input.installationId(),hash,id,t.get("id"));
    db.audit(id.toString(),"ACTIVATION_USED",t.get("id"));
    return result(db.one("SELECT * FROM device WHERE id=?",id));
  }
  @org.springframework.scheduling.annotation.Scheduled(fixedDelay=30000)
  @Transactional
  public void expire() {
    for(var t:db.list("SELECT id FROM activation_token WHERE state='ISSUED' AND expires_at<=?",OffsetDateTime.now()))
      if(db.exec("UPDATE activation_token SET state='EXPIRED' WHERE id=? AND state='ISSUED'",t.get("id"))==1)db.audit("activation","ACTIVATION_EXPIRED",t.get("id"));
  }
  static ResponseStatusException failure(String message) {return new ResponseStatusException(HttpStatus.UNAUTHORIZED,message);}
  static Map<String,Object> result(Map<String,Object> d) {return Map.of("deviceId",d.get("id"),"code",d.get("public_code"));}
}
