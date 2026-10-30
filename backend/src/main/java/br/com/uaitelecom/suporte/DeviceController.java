package br.com.uaitelecom.suporte;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
class DeviceController {
  final Db db;
  final Access access;
  final SessionService sessions;
  final MeshEngine mesh;

  DeviceController(Db db, Access a, SessionService s, MeshEngine mesh) {
    this.db = db;
    access = a;
    sessions = s;
    this.mesh = mesh;
  }

  record DeviceInput(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Size(max = 120) String location,
      @NotBlank @Size(max = 120) String department,
      UUID ownerId,
      @Pattern(regexp = "node//[A-Za-z0-9@$]{1,128}") String meshNode) {}

  record Permission(UUID userId, boolean control) {}

  record Enrollment(@NotBlank @Size(max = 100) String code, @NotBlank @Size(max = 200) String os,
      @Pattern(regexp="[A-Za-z0-9_-]{43}") String credential) {}

  record Heartbeat(@NotBlank @Size(max = 200) String os) {}

  static Map<String, Object> publicDevice(Map<String, Object> d) {
    var x = new LinkedHashMap<>(d);
    x.remove("agent_hash");
    x.remove("registration_id");
    x.remove("registration_hash");
    x.remove("enrollment_hash");
    x.remove("enrollment_expires");
    x.remove("enrollment_receipt_hash");
    x.remove("enrollment_receipt_expires");
    x.put(
        "online",
        !Boolean.TRUE.equals(d.get("revoked"))
            && Db.instant(d.get("last_seen")).isAfter(Instant.now().minusSeconds(100)));
    return x;
  }

  @GetMapping("/devices")
  List<Map<String, Object>> list(
      HttpServletRequest r,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "") String location) {
    var a = Security.actor(r);
    return db.list("SELECT d.*,u.name AS owner_name FROM device d LEFT JOIN app_user u ON u.id=d.owner_id ORDER BY d.name").stream()
        .filter(d -> access.device(a, Db.id(d, "id"), false) || a.id().equals(Db.id(d, "owner_id")))
        .map(DeviceController::publicDevice)
        .filter(
            d ->
                (d.get("id") + " " + d.get("name") + " " + d.get("department") + " " + d.get("owner_name"))
                        .toLowerCase(Locale.ROOT)
                        .contains(q.toLowerCase(Locale.ROOT))
                    && d.get("location").toString().contains(location))
        .toList();
  }

  record AccountRegistration(@NotNull UUID installationId,
      @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String credential,
      @NotBlank @Size(max=120) String name, @NotBlank @Size(max=200) String os) {}

  @PostMapping("/devices/register")
  @org.springframework.transaction.annotation.Transactional
  synchronized Map<String,Object> register(@Valid @RequestBody AccountRegistration input, HttpServletRequest r) {
    throw new ResponseStatusException(HttpStatus.GONE,"Cadastro por login descontinuado. Use ativação administrativa no aplicativo.");
  }

  @PostMapping("/devices")
  Map<String, Object> create(@Valid @RequestBody DeviceInput d, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    Security.require(d.meshNode()==null,"Node ID é confirmado pelo vínculo autenticado, não pelo formulário.");
    UUID id = UUID.randomUUID();
    String code = Security.token();
    db.exec(
        "INSERT INTO device"
            + " (id,name,location,department,owner_id,mesh_node,enrollment_hash,enrollment_expires)"
            + " VALUES (?,?,?,?,?,?,?,?)",
        id,
        d.name(),
        d.location(),
        d.department(),
        d.ownerId(),
        d.meshNode(),
        Security.hash(code),
        OffsetDateTime.now().plusMinutes(10));
    db.audit(a.id().toString(), "DEVICE_CREATED", id);
    return Map.of("id", id, "code", code, "expiresIn", 600);
  }

  @PutMapping("/devices/{id}")
  @org.springframework.transaction.annotation.Transactional
  void update(@PathVariable UUID id, @Valid @RequestBody DeviceInput d, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    Security.require(
        !db.exists("SELECT 1 FROM remote_session WHERE device_id=? AND ended_at IS NULL", id),
        "Encerre as sessões antes de editar o dispositivo.");
    var existing=db.one("SELECT * FROM device WHERE id=?",id);
    Security.require(d.meshNode()==null||Objects.equals(d.meshNode(),existing.get("mesh_node")),"Não altere a identidade do motor por formulário; use recuperação.");
    java.util.function.BiConsumer<String,Object> change=(field,value)->{Object old=existing.get(field);if(!Objects.equals(old,value))db.exec("INSERT INTO device_change VALUES (?,?,?,?,?,?,?,?)",UUID.randomUUID(),id,a.id(),field,old==null?null:old.toString(),value==null?null:value.toString(),"Edição pela API de dispositivos",OffsetDateTime.now());};
    change.accept("friendly_name",d.name());change.accept("city",d.location());change.accept("department",d.department());change.accept("owner_id",d.ownerId());
    db.exec(
        "UPDATE device SET friendly_name=?,city=?,department=?,owner_id=? WHERE id=?",
        d.name(),
        d.location(),
        d.department(),
        d.ownerId(),
        id);
    db.audit(a.id().toString(), "DEVICE_UPDATED", id);
  }

  @PostMapping("/devices/{id}/enrollment")
  Map<String, Object> enrollCode(@PathVariable UUID id, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    var d = db.one("SELECT * FROM device WHERE id=?", id);
    Security.require(
        d.get("agent_hash") == null && !Boolean.TRUE.equals(d.get("revoked")),
        "Use recuperação administrativa para preservar o código de um cadastro existente.");
    String code = Security.token();
    db.exec(
        "UPDATE device SET enrollment_hash=?,enrollment_expires=?,enrollment_receipt_hash=NULL,enrollment_receipt_expires=NULL WHERE id=?",
        Security.hash(code),
        OffsetDateTime.now().plusMinutes(10),
        id);
    return Map.of("code", code, "expiresIn", 600);
  }

  @PostMapping("/devices/{id}/revoke")
  void revoke(@PathVariable UUID id, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    db.exec("UPDATE device SET revoked=TRUE,agent_hash=NULL,enrollment_hash=NULL,enrollment_receipt_hash=NULL,enrollment_receipt_expires=NULL WHERE id=?", id);
    sessions.sweep();
    db.audit(a.id().toString(), "DEVICE_REVOKED", id);
  }

  // Explicit administrative recovery preserves the public code while invalidating the old installation.
  @PostMapping("/devices/{id}/recovery")
  synchronized Map<String,Object> recovery(@PathVariable UUID id, HttpServletRequest r) {
    var a=Security.actor(r); Security.require(a.admin(),"Apenas administrador.");
    db.one("SELECT id FROM device WHERE id=?",id);
    String code=Security.token();
    db.exec("UPDATE device SET agent_hash=NULL,last_seen=NULL,mesh_node=NULL,mesh_bound_at=NULL,revoked=FALSE,enrollment_hash=?,enrollment_expires=?,enrollment_receipt_hash=NULL,enrollment_receipt_expires=NULL WHERE id=?",Security.hash(code),OffsetDateTime.now().plusMinutes(10),id);
    sessions.sweep();
    db.audit(a.id().toString(),"DEVICE_RECOVERY_ISSUED",id);
    return Map.of("deviceId",id,"code",code,"expiresIn",600);
  }

  @GetMapping("/devices/{id}/permissions")
  List<Map<String, Object>> permissions(@PathVariable UUID id, HttpServletRequest r) {
    Security.require(Security.actor(r).admin(), "Apenas administrador.");
    return db.list(
        "SELECT p.*,u.name FROM device_permission p JOIN app_user u ON p.user_id=u.id WHERE"
            + " device_id=?",
        id);
  }

  @PutMapping("/devices/{id}/permissions")
  synchronized void permit(@PathVariable UUID id, @RequestBody Permission p, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    Security.require(
        p.userId() != null
            && db.exists(
                "SELECT 1 FROM app_user WHERE id=? AND role='TECNICO' AND (panel_role IS NULL OR panel_role='OPERADOR') AND active=TRUE", p.userId()),
        "Selecione um técnico ativo.");
    db.exec("DELETE FROM device_permission WHERE device_id=? AND user_id=?", id, p.userId());
    db.exec("INSERT INTO device_permission VALUES (?,?,?)", id, p.userId(), p.control());
    sessions.sweep();
    db.audit(a.id().toString(), "PERMISSION_GRANTED", id);
  }

  @DeleteMapping("/devices/{id}/permissions/{userId}")
  void unpermit(@PathVariable UUID id, @PathVariable UUID userId, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    db.exec("DELETE FROM device_permission WHERE device_id=? AND user_id=?", id, userId);
    sessions.sweep();
    db.audit(a.id().toString(), "PERMISSION_REVOKED", id);
  }

  @PostMapping("/agent/enroll")
  synchronized Map<String, Object> enroll(@Valid @RequestBody Enrollment body, HttpServletRequest request) {
    sessions.throttle("enrollment-ip:"+request.getRemoteAddr(),30);
    // A client-generated random credential can be persisted before sending, so a lost HTTP
    // response does not require a duplicate device. Retrying requires the same private credential.
    String token = body.credential()==null ? Security.token() : body.credential();
    String receipt=Security.hash(body.code()+":"+token);
    if(body.credential()!=null) {
      var previous=db.list("SELECT id FROM device WHERE enrollment_receipt_hash=? AND enrollment_receipt_expires>? AND agent_hash=? AND revoked=FALSE",receipt,OffsetDateTime.now(),Security.hash(token));
      if(!previous.isEmpty()) return Map.of("deviceId",previous.getFirst().get("id"),"token",token);
    }
    var rows =
        db.list(
            "SELECT id FROM device WHERE enrollment_hash=? AND enrollment_expires>? AND agent_hash"
                + " IS NULL AND revoked=FALSE",
            Security.hash(body.code()),
            OffsetDateTime.now());
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vínculo inválido ou expirado.");
    Object id = rows.getFirst().get("id");
    int changed =
        db.exec(
            "UPDATE device SET"
                + " agent_hash=?,enrollment_hash=NULL,enrollment_expires=NULL,os=?,last_seen=NULL,enrollment_receipt_hash=?,enrollment_receipt_expires=?"
                + " WHERE id=? AND agent_hash IS NULL AND revoked=FALSE AND enrollment_hash=? AND enrollment_expires>?",
            Security.hash(token),
            body.os(),
            receipt,
            OffsetDateTime.now().plusMinutes(10),
            id,Security.hash(body.code()),OffsetDateTime.now());
    Security.require(changed == 1, "Código já utilizado.");
    db.audit(id.toString(), "AGENT_ENROLLED", id);
    return Map.of("deviceId", id, "token", token);
  }

  Map<String, Object> agent(HttpServletRequest r) {
    String h = Objects.toString(r.getHeader("Authorization"), "");
    var rows =
        db.list(
            "SELECT * FROM device WHERE agent_hash=? AND revoked=FALSE",
            Security.hash(h.startsWith("Bearer ") ? h.substring(7) : ""));
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Agente não autorizado.");
    return rows.getFirst();
  }

  @GetMapping("/agent/identity")
  Map<String,Object> identity(HttpServletRequest r) {
    var d=agent(r);
    return Map.of("deviceId",d.get("id"),"name",d.get("name"),"code",Objects.toString(d.get("public_code"),d.get("id").toString()),"bound",d.get("mesh_node")!=null);
  }

  @PostMapping("/agent/binding")
  synchronized Map<String,Object> beginBinding(HttpServletRequest r) {
    var d=agent(r);var id=Db.id(d,"id");
    Security.require(d.get("mesh_node")==null,"Dispositivo já vinculado. Recuperação exige administrador.");
    sessions.throttle("binding:"+id,5);
    var proof=mesh.enrollment("begin",id);
    db.audit(id.toString(),"MESH_BINDING_REQUESTED",id);
    return proof;
  }

  @PostMapping("/agent/binding/confirm")
  synchronized Map<String,Object> confirmBinding(HttpServletRequest r) {
    var d=agent(r);var id=Db.id(d,"id");
    if(d.get("mesh_node")!=null)return Map.of("bound",true,"deviceId",id);
    var proof=mesh.enrollment("status",id);Object node=proof.get("node");
    if(node==null)return Map.of("bound",false);
    Security.require(node instanceof String&&node.toString().matches("node//[A-Za-z0-9@$]{1,128}"),"Identidade do motor inválida.");
    Security.require(!db.exists("SELECT 1 FROM device WHERE mesh_node=?",node),"Identidade do motor já vinculada.");
    db.exec("UPDATE device SET mesh_node=?,mesh_bound_at=? WHERE id=? AND revoked=FALSE AND mesh_node IS NULL",node,OffsetDateTime.now(),id);
    mesh.enrollment("cancel",id);
    db.audit(id.toString(),"MESH_IDENTITY_BOUND",id);
    return Map.of("bound",true,"deviceId",id);
  }

  @PostMapping("/agent/unregister")
  synchronized void unregister(HttpServletRequest r) {
    var d=agent(r);var id=Db.id(d,"id");
    db.exec("UPDATE device SET revoked=TRUE,last_seen=NULL,agent_hash=NULL,enrollment_hash=NULL,enrollment_receipt_hash=NULL,enrollment_receipt_expires=NULL WHERE id=?",id);
    sessions.sweep();
    try{mesh.enrollment("cancel",id);}catch(RuntimeException ignored){}
    db.audit(id.toString(),"DEVICE_UNREGISTERED_LOCALLY",id);
  }

  @PostMapping("/agent/heartbeat")
  Map<String, Object> heartbeat(@Valid @RequestBody Heartbeat b, HttpServletRequest r) {
    var d = agent(r);
    Security.require(d.get("mesh_node")!=null,"Vínculo do MeshAgent pendente.");
    db.exec(
        "UPDATE device SET last_seen=?,os=? WHERE id=? AND revoked=FALSE",
        OffsetDateTime.now(),
        b.os(),
        d.get("id"));
    return Map.of("requests", sessions.forDevice(Db.id(d, "id")), "serverTime", Instant.now());
  }

  @PostMapping("/agent/offline")
  void offline(HttpServletRequest r) {
    var d=agent(r);
    for(var session:db.list("SELECT id FROM remote_session WHERE device_id=? AND ended_at IS NULL",d.get("id")))
      sessions.decide(Db.id(d,"id"),Db.id(session,"id"),"stop");
    db.exec("UPDATE remote_session SET result='LOCAL_STOP' WHERE device_id=? AND result='DISCONNECTED' AND ended_at>?",d.get("id"),OffsetDateTime.now().minusSeconds(15));
    db.audit(d.get("id").toString(),"CLIENT_OFFLINE",d.get("id"));
    db.exec("UPDATE device SET last_seen=NULL WHERE id=?",d.get("id"));
  }

  @PostMapping("/agent/sessions/{id}/{decision}")
  void decision(@PathVariable UUID id, @PathVariable String decision, HttpServletRequest r) {
    var d = agent(r);
    sessions.decide(Db.id(d, "id"), id, decision);
  }

  @GetMapping("/devices/{id}/history")
  Map<String, Object> history(@PathVariable UUID id, HttpServletRequest r) {
    var a = Security.actor(r);
    access.deviceRow(a, id, false);
    return Map.of(
        "sessions",
        sessions.history(id));
  }
}
