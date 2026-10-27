package br.com.uaitelecom.suporte;

import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
class SessionService {
  final Db db;
  final Access access;
  final RemoteEngine engine;

  SessionService(Db db, Access a, RemoteEngine e) {
    this.db = db;
    access = a;
    engine = e;
  }

  static Map<String, Object> publicSession(Map<String, Object> s) {
    var copy = new LinkedHashMap<>(s);
    copy.remove("user_token_hash");
    copy.remove("share_id");
    return copy;
  }

  List<Map<String, Object>> history(UUID device) {
    return db
        .list("SELECT * FROM remote_session WHERE device_id=? ORDER BY requested_at DESC", device)
        .stream()
        .map(SessionService::publicSession)
        .toList();
  }

  List<Map<String, Object>> forDevice(UUID device) {
    sweep();
    return db.list(
        "SELECT s.id,s.mode,s.status,s.expires_at,u.name AS technician FROM remote_session s JOIN"
            + " app_user u ON u.id=s.technician_id WHERE s.device_id=? AND s.ended_at IS NULL",
        device);
  }

  synchronized Map<String, Object> request(
      Security.Actor a, UUID device, String mode, UUID ticket) {
    Security.require(a.staff(), "Apenas técnicos e administradores.");
    Security.require(Set.of("VIEW", "CONTROL").contains(mode), "Modo inválido.");
    var d = access.deviceRow(a, device, mode.equals("CONTROL"));
    Security.require(
        !Boolean.TRUE.equals(d.get("revoked"))
            && Db.instant(d.get("last_seen")).isAfter(Instant.now().minusSeconds(30)),
        "Computador offline ou revogado.");
    if (!engine.enabled())
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Prova remota ainda não configurada; nenhum acesso foi iniciado.");
    Security.require(d.get("mesh_node") != null, "Vincule o Node ID do MeshCentral no cadastro.");
    if (ticket != null) {
      var t = access.ticket(a, ticket);
      Security.require(
          device.equals(Db.id(t, "device_id")),
          "O chamado deve estar vinculado a este computador.");
    }
    sweep();
    Security.require(
        !db.exists("SELECT 1 FROM remote_session WHERE device_id=? AND ended_at IS NULL", device),
        "Já existe uma solicitação para este computador.");
    UUID id = UUID.randomUUID();
    db.exec(
        "INSERT INTO remote_session"
            + " (id,device_id,technician_id,user_token_hash,ticket_id,mode,status,requested_at,expires_at)"
            + " VALUES (?,?,?,?,?,?,'PENDING',?,?)",
        id,
        device,
        a.id(),
        a.tokenHash(),
        ticket,
        mode,
        OffsetDateTime.now(),
        OffsetDateTime.now().plusSeconds(60));
    db.audit(a.id().toString(), "SESSION_REQUESTED", id);
    return get(a, id);
  }

  Map<String, Object> get(Security.Actor a, UUID id) {
    var s = db.one("SELECT * FROM remote_session WHERE id=?", id);
    Security.require(
        a.admin() || a.id().equals(Db.id(s, "technician_id")), "Sessão não autorizada.");
    return publicSession(s);
  }

  synchronized void decide(UUID device, UUID id, String decision) {
    var s = db.one("SELECT * FROM remote_session WHERE id=? AND device_id=?", id, device);
    if (decision.equals("stop")) {
      close(s, "LOCAL_STOP");
      return;
    }
    Security.require(Set.of("accept", "reject").contains(decision), "Decisão inválida.");
    Security.require(
        s.get("status").equals("PENDING") && valid(s), "Solicitação encerrada ou expirada.");
    if (decision.equals("reject")) {
      close(s, "REJECTED");
      return;
    }
    db.exec("UPDATE remote_session SET status='CONSENTED' WHERE id=? AND status='PENDING'", id);
    db.audit(device.toString(), "LOCAL_CONSENT", id);
  }

  synchronized Map<String, String> launch(Security.Actor a, UUID id) {
    var s = db.one("SELECT * FROM remote_session WHERE id=?", id);
    Security.require(
        a.id().equals(Db.id(s, "technician_id")) && a.tokenHash().equals(s.get("user_token_hash")),
        "Sessão não autorizada.");
    Security.require(
        s.get("status").equals("CONSENTED") && valid(s),
        "Aguarde o consentimento ou solicite uma nova sessão.");
    var d = db.one("SELECT * FROM device WHERE id=?", s.get("device_id"));
    // Persist deadline BEFORE requesting a share. A crashed backend cannot leave an unbounded
    // share.
    db.exec(
        "UPDATE remote_session SET status='ISSUING',expires_at=? WHERE id=?",
        OffsetDateTime.now().plusSeconds(60),
        id);
    try {
      var share =
          engine.create(
              d.get("mesh_node").toString(),
              a.name().substring(0, Math.min(a.name().length(), 60)) + " • Uai " + id,
              s.get("mode").equals("VIEW"));
      db.exec("UPDATE remote_session SET status='READY',share_id=? WHERE id=?", share.id(), id);
      var issued = db.one("SELECT * FROM remote_session WHERE id=?", id);
      if (!valid(issued)) {
        close(issued, "REVOKED_DURING_LAUNCH");
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN, "Autorização revogada durante a abertura.");
      }
      db.audit(a.id().toString(), "REMOTE_LINK_ISSUED", id);
      return Map.of("url", share.url());
    } catch (RuntimeException e) {
      close(db.one("SELECT * FROM remote_session WHERE id=?", id), "ENGINE_ERROR");
      throw e;
    }
  }

  boolean valid(Map<String, Object> s) {
    if (!Db.instant(s.get("expires_at")).isAfter(Instant.now())) return false;
    if (!db.exists(
        "SELECT 1 FROM device WHERE id=? AND revoked=FALSE AND last_seen>?",
        s.get("device_id"),
        OffsetDateTime.now().minusSeconds(30))) return false;
    var users =
        db.list(
            "SELECT u.* FROM app_user u JOIN user_session x ON x.user_id=u.id WHERE u.id=? AND"
                + " u.active=TRUE AND x.token_hash=? AND x.expires_at>?",
            s.get("technician_id"),
            s.get("user_token_hash"),
            OffsetDateTime.now());
    if (users.isEmpty()) return false;
    var u = users.getFirst();
    return access.device(
        new Security.Actor(
            Db.id(u, "id"),
            u.get("name").toString(),
            u.get("role").toString(),
            s.get("user_token_hash").toString()),
        Db.id(s, "device_id"),
        s.get("mode").equals("CONTROL"));
  }

  synchronized void stop(Security.Actor a, UUID id) {
    get(a, id);
    close(db.one("SELECT * FROM remote_session WHERE id=?", id), "TECHNICIAN_STOP");
  }

  synchronized void close(Map<String, Object> s, String result) {
    if (s.get("ended_at") != null) return;
    if (s.get("share_id") != null) {
      try {
        var d = db.one("SELECT * FROM device WHERE id=?", s.get("device_id"));
        engine.remove(d.get("mesh_node").toString(), s.get("share_id").toString());
      } catch (RuntimeException e) {
        db.exec(
            "UPDATE remote_session SET status='STOPPING',result=? WHERE id=?", result, s.get("id"));
        return;
      }
    }
    db.exec(
        "UPDATE remote_session SET status='ENDED',ended_at=?,result=? WHERE id=?",
        OffsetDateTime.now(),
        result,
        s.get("id"));
    db.audit(s.get("technician_id").toString(), "SESSION_" + result, s.get("id"));
  }

  @Scheduled(fixedDelay = 3000)
  synchronized void sweep() {
    for (var s : db.list("SELECT * FROM remote_session WHERE ended_at IS NULL")) {
      if (s.get("status").equals("STOPPING")) {
        if (Instant.now().isAfter(Db.instant(s.get("expires_at")).plusSeconds(30))) {
          db.exec(
              "UPDATE remote_session SET status='ENDED',ended_at=?,result='EXPIRED_UNCONFIRMED'"
                  + " WHERE id=?",
              OffsetDateTime.now(),
              s.get("id"));
        } else close(s, Objects.toString(s.get("result"), "STOP"));
      } else if (!valid(s)) close(s, "EXPIRED_OR_REVOKED");
    }
  }
}
