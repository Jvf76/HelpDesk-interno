package br.com.uaitelecom.suporte;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tickets")
class TicketController {
  final Db db;
  final Access access;

  TicketController(Db db, Access a) {
    this.db = db;
    access = a;
  }

  record Create(
      @NotBlank @Size(max = 200) String title,
      @NotBlank @Size(max = 8000) String description,
      @NotBlank @Size(max = 80) String category,
      @NotNull @Pattern(regexp = "BAIXA|NORMAL|ALTA|URGENTE") String priority,
      UUID deviceId) {}

  record Update(
      @NotNull @Pattern(regexp = "ABERTO|EM_ATENDIMENTO|AGUARDANDO|RESOLVIDO") String status,
      @NotNull @Pattern(regexp = "BAIXA|NORMAL|ALTA|URGENTE") String priority,
      UUID technicianId) {}

  record Comment(@NotBlank @Size(max = 8000) String body) {}

  @GetMapping
  List<Map<String, Object>> list(
      HttpServletRequest r,
      @RequestParam(defaultValue = "") String status,
      @RequestParam(defaultValue = "") String priority,
      @RequestParam(required = false) UUID technician,
      @RequestParam(defaultValue = "") String location) {
    var a = Security.actor(r);
    return db
        .list(
            "SELECT t.*,d.name AS device_name,d.location,u.name AS requester_name,v.name AS"
                + " technician_name FROM ticket t LEFT JOIN device d ON d.id=t.device_id JOIN"
                + " app_user u ON u.id=t.requester_id LEFT JOIN app_user v ON v.id=t.technician_id"
                + " WHERE (?=TRUE OR t.requester_id=?) ORDER BY t.created_at DESC LIMIT 500",
            a.staff(),
            a.id())
        .stream()
        .filter(
            t ->
                (status.isEmpty() || status.equals(t.get("status")))
                    && (priority.isEmpty() || priority.equals(t.get("priority")))
                    && (technician == null || technician.equals(Db.id(t, "technician_id")))
                    && (location.isEmpty()
                        || Objects.toString(t.get("location"), "").contains(location)))
        .toList();
  }

  @GetMapping("/{id}")
  Map<String, Object> get(@PathVariable UUID id, HttpServletRequest r) {
    var a = Security.actor(r);
    var ticket = access.ticket(a, id);
    var result = new LinkedHashMap<>(ticket);
    result.put(
        "events",
        db.list(
            "SELECT e.*,u.name AS author FROM ticket_event e JOIN app_user u ON u.id=e.actor_id"
                + " WHERE ticket_id=? ORDER BY created_at,id",
            id));
    result.put(
        "sessions",
        db.list(
            "SELECT id,status,mode,requested_at,ended_at,result FROM remote_session WHERE"
                + " ticket_id=? ORDER BY requested_at",
            id));
    return result;
  }

  @PostMapping
  @Transactional
  Map<String, UUID> create(@Valid @RequestBody Create t, HttpServletRequest r) {
    var a = Security.actor(r);
    access.linkDevice(a, t.deviceId());
    UUID id = UUID.randomUUID();
    db.exec(
        "INSERT INTO ticket"
            + " (id,title,description,category,priority,status,requester_id,device_id,created_at)"
            + " VALUES (?,?,?,?,?,'ABERTO',?,?,?)",
        id,
        t.title(),
        t.description(),
        t.category(),
        t.priority(),
        a.id(),
        t.deviceId(),
        OffsetDateTime.now());
    event(id, a, "CREATED", "Chamado aberto.");
    return Map.of("id", id);
  }

  @PutMapping("/{id}")
  @Transactional
  void update(@PathVariable UUID id, @Valid @RequestBody Update t, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.staff(), "Apenas equipe de suporte.");
    var old = access.ticket(a, id);
    if (t.technicianId() != null)
      Security.require(
          db.exists(
              "SELECT 1 FROM app_user WHERE id=? AND role IN ('TECNICO','ADMIN') AND active=TRUE",
              t.technicianId()),
          "Técnico inválido.");
    db.exec(
        "UPDATE ticket SET status=?,priority=?,technician_id=? WHERE id=?",
        t.status(),
        t.priority(),
        t.technicianId(),
        id);
    event(
        id,
        a,
        "UPDATED",
        "Estado: "
            + old.get("status")
            + " → "
            + t.status()
            + "; prioridade: "
            + old.get("priority")
            + " → "
            + t.priority()
            + "; técnico: "
            + Objects.toString(old.get("technician_id"), "sem responsável")
            + " → "
            + Objects.toString(t.technicianId(), "sem responsável"));
  }

  @PostMapping("/{id}/comments")
  @Transactional
  void comment(@PathVariable UUID id, @Valid @RequestBody Comment c, HttpServletRequest r) {
    var a = Security.actor(r);
    access.ticket(a, id);
    event(id, a, "COMMENT", c.body());
  }

  private void event(UUID id, Security.Actor a, String kind, String body) {
    db.exec(
        "INSERT INTO ticket_event VALUES (?,?,?,?,?,?)",
        UUID.randomUUID(),
        id,
        a.id(),
        kind,
        body,
        OffsetDateTime.now());
    db.audit(a.id().toString(), "TICKET_" + kind, id);
  }
}
