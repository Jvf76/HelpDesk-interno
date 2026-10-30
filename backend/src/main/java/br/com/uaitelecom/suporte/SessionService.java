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
    copy.remove("ticket_id");
    if ("ACTIVE".equals(copy.get("status"))
        && (copy.get("engine_seen_at") == null
            || Db.instant(copy.get("engine_seen_at")).isBefore(Instant.now().minusSeconds(10))))
      copy.put("status", "UNVERIFIED");
    return copy;
  }

  List<Map<String, Object>> history(UUID device) {
    return db
        .list("SELECT s.*,u.name AS technician_name FROM remote_session s LEFT JOIN app_user u ON u.id=s.technician_id WHERE s.device_id=? ORDER BY s.requested_at DESC", device)
        .stream()
        .map(SessionService::publicSession)
        .toList();
  }

  List<Map<String, Object>> forDevice(UUID device) {
    sweep();
    return db.list(
        "SELECT s.id,s.mode,s.status,s.expires_at,COALESCE(s.requester_name,u.name) AS technician FROM remote_session s LEFT JOIN"
            + " app_user u ON u.id=s.technician_id WHERE s.device_id=? AND s.ended_at IS NULL",
        device);
  }

  synchronized Map<String, Object> request(
      Security.Actor a, UUID device, String mode) {
    Security.require(a.staff(), "Apenas técnicos e administradores.");
    Security.require(Set.of("VIEW", "CONTROL").contains(mode), "Modo inválido.");
    var d = access.deviceRow(a, device, mode.equals("CONTROL"));
    return create(a, device, mode, d, false);
  }

  synchronized Map<String,Object> requestAssisted(Security.Actor a, String code, String mode, String ip) {
    Security.require(!a.role().equals("LEITURA"),"Perfil de leitura não pode iniciar conexões.");
    throttle("user:" + a.id(), 5);
    throttle("ip:" + ip, 60);
    Security.require(Set.of("VIEW", "CONTROL").contains(mode), "Modo inválido.");
    var rows=db.list("SELECT * FROM device WHERE (public_code=? OR CAST(id AS VARCHAR)=?) AND revoked=FALSE AND (agent_health IS NULL OR agent_health='OK') AND last_seen>?",code.trim().replace(" ","").toUpperCase(Locale.ROOT),code.trim(),MonitoringService.deadline(db));
    if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Código indisponível.");
    UUID device=Db.id(rows.getFirst(),"id");
    if(a.role().equals("OPERADOR"))Security.require(access.device(a,device,mode.equals("CONTROL")),"Dispositivo não autorizado para este operador.");
    throttle("target:"+device,5);
    Security.require(!a.device() || !a.id().equals(device),"Selecione outro computador.");
    return create(a, device, mode, rows.getFirst(), true);
  }

  synchronized void throttle(String key, int limit) {
    db.exec("DELETE FROM connection_attempt WHERE window_start<?", OffsetDateTime.now().minusMinutes(1));
    String hash = Security.hash(key);
    if (db.exists("SELECT 1 FROM connection_attempt WHERE attempt_key=? AND attempts>=?", hash, limit)) {
      db.audit("connection", "CONNECTION_RATE_LIMIT", hash);
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Muitas solicitações. Aguarde um minuto.");
    }
    if(db.exec("UPDATE connection_attempt SET attempts=attempts+1 WHERE attempt_key=?",hash)==0)
      db.exec("INSERT INTO connection_attempt VALUES (?,1,?)",hash,OffsetDateTime.now());
  }

  private Map<String,Object> create(Security.Actor a, UUID device, String mode, Map<String,Object> d, boolean consentOnly) {
    Security.require(
        !Boolean.TRUE.equals(d.get("revoked"))
            && (d.get("agent_health")==null||"OK".equals(d.get("agent_health")))
            && Db.instant(d.get("last_seen")).isAfter(MonitoringService.deadline(db).toInstant()),
        "Computador offline ou revogado.");
    if (!engine.enabled())
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Prova remota ainda não configurada; nenhum acesso foi iniciado.");
    Security.require(d.get("mesh_node") != null, "Vincule o Node ID do MeshCentral no cadastro.");
    sweep();
    Security.require(
        !db.exists("SELECT 1 FROM remote_session WHERE device_id=? AND ended_at IS NULL", device),
        "Já existe uma solicitação para este computador.");
    UUID id = UUID.randomUUID();
    db.exec(
        "INSERT INTO remote_session"
            + " (id,device_id,technician_id,user_token_hash,mode,status,requested_at,expires_at,consent_only,requester_device_id,requester_name,requester_code)"
            + " VALUES (?,?,?,?,?,'PENDING',?,?,?,?,?,?)",
        id,
        device,
        a.device()?null:a.id(),
        a.tokenHash(),
        mode,
        OffsetDateTime.now(),
        OffsetDateTime.now().plusSeconds(60), consentOnly, a.device()?a.id():null,a.name(),a.device()?db.one("SELECT public_code FROM device WHERE id=?",a.id()).get("public_code"):null);
    db.audit(a.id().toString(), "SESSION_REQUESTED", id);
    return get(a, id);
  }

  Map<String, Object> get(Security.Actor a, UUID id) {
    var s = db.one("SELECT * FROM remote_session WHERE id=?", id);
    Security.require(
        a.admin() || a.id().equals(Db.id(s, a.device()?"requester_device_id":"technician_id")), "Sessão não autorizada.");
    return publicSession(s);
  }

  synchronized void decide(UUID device, UUID id, String decision) {
    var s = db.one("SELECT * FROM remote_session WHERE id=? AND device_id=?", id, device);
    if (decision.equals("stop")) {
      close(s, "LOCAL_STOP");
      return;
    }
    Security.require(Set.of("accept", "accept-view", "reject").contains(decision), "Decisão inválida.");
    Security.require(
        s.get("status").equals("PENDING") && valid(s), "Solicitação encerrada ou expirada.");
    if (decision.equals("reject")) {
      close(s, "REJECTED");
      return;
    }
    if(decision.equals("accept-view")) db.exec("UPDATE remote_session SET mode='VIEW' WHERE id=?",id);
    db.exec("UPDATE remote_session SET status='CONSENTED' WHERE id=? AND status='PENDING'", id);
    db.audit(device.toString(), "LOCAL_CONSENT", id);
  }

  synchronized Map<String, String> launch(Security.Actor a, UUID id) {
    var s = db.one("SELECT * FROM remote_session WHERE id=?", id);
    Security.require(
        a.id().equals(Db.id(s, a.device()?"requester_device_id":"technician_id")) && a.tokenHash().equals(s.get("user_token_hash")),
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

  synchronized Map<String,Object> viewer(Security.Actor actor, UUID id, String clientIp) {
    launch(actor,id);
    var session=db.one("SELECT * FROM remote_session WHERE id=?",id);
    try {
      Security.require(valid(session),"Sessão revogada ou expirada.");
      return engine.viewer(session.get("share_id").toString(),clientIp);
    } catch(RuntimeException e) { close(session,"VIEWER_BOOTSTRAP_FAILED"); throw e; }
  }

  boolean valid(Map<String, Object> s) {
    if (!Db.instant(s.get("expires_at")).isAfter(Instant.now())) return false;
    if (!db.exists(
        "SELECT 1 FROM device WHERE id=? AND revoked=FALSE AND (agent_health IS NULL OR agent_health='OK') AND last_seen>?",
        s.get("device_id"),
        MonitoringService.deadline(db))) return false;
    if(s.get("requester_device_id")!=null) return db.exists("SELECT 1 FROM device WHERE id=? AND agent_hash=? AND revoked=FALSE AND (agent_health IS NULL OR agent_health='OK') AND last_seen>?",s.get("requester_device_id"),s.get("user_token_hash"),MonitoringService.deadline(db));
    var users =
        db.list(
            "SELECT u.* FROM app_user u JOIN user_session x ON x.user_id=u.id WHERE u.id=? AND"
                + " u.active=TRUE AND x.token_hash=? AND x.expires_at>?",
            s.get("technician_id"),
            s.get("user_token_hash"),
            OffsetDateTime.now());
    if (users.isEmpty()) return false;
    if ("LEITURA".equals(users.getFirst().get("panel_role"))) return false;
    if (Boolean.TRUE.equals(s.get("consent_only")) && !"OPERADOR".equals(users.getFirst().get("panel_role"))) return true;
    var u = users.getFirst();
    return access.device(
        new Security.Actor(
            Db.id(u, "id"),
            u.get("name").toString(),
            Objects.toString(u.get("panel_role"),u.get("role").toString()),
            s.get("user_token_hash").toString()),
        Db.id(s, "device_id"),
        s.get("mode").equals("CONTROL"));
  }

  synchronized void stop(Security.Actor a, UUID id) {
    get(a, id);
    close(db.one("SELECT * FROM remote_session WHERE id=?", id), "REQUESTER_STOP");
  }

  synchronized void close(Map<String, Object> s, String result) {
    if (s.get("ended_at") != null) return;
    OffsetDateTime confirmedEnd = OffsetDateTime.now();
    if (s.get("share_id") != null) {
      try {
        var d = db.one("SELECT * FROM device WHERE id=?", s.get("device_id"));
        var finalState = engine.remove(d.get("mesh_node").toString(), s.get("share_id").toString());
        if (finalState != null) {
          db.exec(
              "UPDATE remote_session SET started_at=COALESCE(started_at,?),"
                  + " engine_consent_at=COALESCE(engine_consent_at,?),engine_seen_at=? WHERE id=?",
              timestamp(finalState.startedAt()),
              timestamp(finalState.consentAt()),
              OffsetDateTime.now(),
              s.get("id"));
          if (finalState.endedAt() != null) confirmedEnd = timestamp(finalState.endedAt());
        }
      } catch (RuntimeException e) {
        db.exec(
            "UPDATE remote_session SET status='STOPPING',result=? WHERE id=?", result, s.get("id"));
        return;
      }
    }
    db.exec(
        "UPDATE remote_session SET status='ENDED',ended_at=?,result=? WHERE id=?",
        confirmedEnd,
        result,
        s.get("id"));
    db.audit(Objects.toString(s.get("requester_device_id"),Objects.toString(s.get("technician_id"),"unknown")), "SESSION_" + result, s.get("id"));
  }

  void observe(Map<String, Object> s) {
    try {
      var observation = engine.observe(s.get("share_id").toString(), true, false);
      String state = observation.state();
      if ("UNKNOWN".equals(state)) {
        close(s, "ENGINE_STATE_LOST");
        return;
      }
      db.exec(
          "UPDATE remote_session SET engine_seen_at=?, started_at=COALESCE(started_at,?),"
              + " engine_consent_at=COALESCE(engine_consent_at,?) WHERE id=?",
          OffsetDateTime.now(),
          timestamp(observation.startedAt()),
          timestamp(observation.consentAt()),
          s.get("id"));
      if ("ENDED".equals(state)) {
        String reason =
            Set.of(
                        "LOCAL_STOP",
                        "REJECTED",
                        "PRIVACY_BAR_FAILED",
                        "DISCONNECTED",
                        "CONNECTION_LOST",
                        "EXPIRED",
                        "LEASE_LOST",
                        "CONSENT_MISSING",
                        "PROTOCOL_ERROR",
                        "SERVER_STOP")
                    .contains(Objects.toString(observation.reason(), ""))
                ? observation.reason()
                : "ENGINE_ENDED";
        close(s, reason);
      } else {
        db.exec(
            "UPDATE remote_session SET status=? WHERE id=?",
            "CONSENTED".equals(state) ? "AWAITING_FRAME" : state,
            s.get("id"));
      }
    } catch (RuntimeException e) {
      // Never retain ACTIVE while engine state is unknown. Stop renewing and request closure.
      close(s, "ENGINE_UNREACHABLE");
    }
  }

  static OffsetDateTime timestamp(Long value) {
    return value == null ? null : Instant.ofEpochMilli(value).atOffset(ZoneOffset.UTC);
  }

  @Scheduled(fixedDelay = 3000)
  synchronized void sweep() {
    for (var ended :
        db.list(
            "SELECT * FROM remote_session WHERE result='DISCONNECTED' AND ended_at>?",
            OffsetDateTime.now().minusSeconds(15))) {
      try {
        var state = engine.observe(ended.get("share_id").toString(), false, false);
        if (Set.of("LOCAL_STOP", "REJECTED", "PRIVACY_BAR_FAILED")
            .contains(Objects.toString(state.reason(), ""))) {
          db.exec("UPDATE remote_session SET result=? WHERE id=?", state.reason(), ended.get("id"));
          db.audit(
              Objects.toString(ended.get("requester_device_id"),Objects.toString(ended.get("technician_id"),"unknown")), "SESSION_" + state.reason(), ended.get("id"));
        }
      } catch (RuntimeException ignored) {
        /* Keep confirmed disconnect, never invent a reason. */
      }
    }
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
      else if (s.get("share_id") != null) observe(s);
    }
  }
}
