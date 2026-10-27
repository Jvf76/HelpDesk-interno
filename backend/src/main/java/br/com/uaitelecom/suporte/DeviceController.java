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

  DeviceController(Db db, Access a, SessionService s) {
    this.db = db;
    access = a;
    sessions = s;
  }

  record DeviceInput(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Size(max = 120) String location,
      @NotBlank @Size(max = 120) String department,
      UUID ownerId,
      @Pattern(regexp = "node//[A-Za-z0-9@$]{1,128}") String meshNode) {}

  record Permission(UUID userId, boolean control) {}

  record Enrollment(@NotBlank @Size(max = 100) String code, @NotBlank @Size(max = 200) String os) {}

  record Heartbeat(@NotBlank @Size(max = 200) String os) {}

  static Map<String, Object> publicDevice(Map<String, Object> d) {
    var x = new LinkedHashMap<>(d);
    x.remove("agent_hash");
    x.remove("enrollment_hash");
    x.remove("enrollment_expires");
    x.put(
        "online",
        !Boolean.TRUE.equals(d.get("revoked"))
            && Db.instant(d.get("last_seen")).isAfter(Instant.now().minusSeconds(30)));
    return x;
  }

  @GetMapping("/devices")
  List<Map<String, Object>> list(
      HttpServletRequest r,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "") String location) {
    var a = Security.actor(r);
    return db.list("SELECT * FROM device ORDER BY name").stream()
        .filter(d -> access.device(a, Db.id(d, "id"), false) || a.id().equals(Db.id(d, "owner_id")))
        .map(DeviceController::publicDevice)
        .filter(
            d ->
                (d.get("name") + " " + d.get("department"))
                        .toLowerCase(Locale.ROOT)
                        .contains(q.toLowerCase(Locale.ROOT))
                    && d.get("location").toString().contains(location))
        .toList();
  }

  @PostMapping("/devices")
  Map<String, Object> create(@Valid @RequestBody DeviceInput d, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
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
  void update(@PathVariable UUID id, @Valid @RequestBody DeviceInput d, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    Security.require(
        !db.exists("SELECT 1 FROM remote_session WHERE device_id=? AND ended_at IS NULL", id),
        "Encerre as sessões antes de editar o dispositivo.");
    db.exec(
        "UPDATE device SET name=?,location=?,department=?,owner_id=?,mesh_node=? WHERE id=?",
        d.name(),
        d.location(),
        d.department(),
        d.ownerId(),
        d.meshNode(),
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
        "Crie um novo cadastro para um agente revogado.");
    String code = Security.token();
    db.exec(
        "UPDATE device SET enrollment_hash=?,enrollment_expires=? WHERE id=?",
        Security.hash(code),
        OffsetDateTime.now().plusMinutes(10),
        id);
    return Map.of("code", code, "expiresIn", 600);
  }

  @PostMapping("/devices/{id}/revoke")
  void revoke(@PathVariable UUID id, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    db.exec("UPDATE device SET revoked=TRUE,agent_hash=NULL,enrollment_hash=NULL WHERE id=?", id);
    sessions.sweep();
    db.audit(a.id().toString(), "DEVICE_REVOKED", id);
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
                "SELECT 1 FROM app_user WHERE id=? AND role='TECNICO' AND active=TRUE", p.userId()),
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
  synchronized Map<String, Object> enroll(@Valid @RequestBody Enrollment body) {
    String token = Security.token();
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
                + " agent_hash=?,enrollment_hash=NULL,enrollment_expires=NULL,os=?,last_seen=?"
                + " WHERE id=? AND agent_hash IS NULL AND revoked=FALSE",
            Security.hash(token),
            body.os(),
            OffsetDateTime.now(),
            id);
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

  @PostMapping("/agent/heartbeat")
  Map<String, Object> heartbeat(@Valid @RequestBody Heartbeat b, HttpServletRequest r) {
    var d = agent(r);
    db.exec(
        "UPDATE device SET last_seen=?,os=? WHERE id=? AND revoked=FALSE",
        OffsetDateTime.now(),
        b.os(),
        d.get("id"));
    return Map.of("requests", sessions.forDevice(Db.id(d, "id")), "serverTime", Instant.now());
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
        "tickets",
        db.list("SELECT * FROM ticket WHERE device_id=? ORDER BY created_at DESC", id),
        "sessions",
        sessions.history(id));
  }
}
