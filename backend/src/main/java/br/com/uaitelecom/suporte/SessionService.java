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
  final org.springframework.transaction.support.TransactionTemplate lifecycleTransaction;
  final Access access;
  final RemoteEngine engine;
  final org.springframework.transaction.support.TransactionTemplate rateTransaction;

  SessionService(Db db, Access a, RemoteEngine e,org.springframework.transaction.PlatformTransactionManager transactions) {
    this.db = db;
    lifecycleTransaction=new org.springframework.transaction.support.TransactionTemplate(transactions);
    access = a;
    engine = e;
    rateTransaction=new org.springframework.transaction.support.TransactionTemplate(transactions);
    rateTransaction.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }

  static Map<String, Object> publicSession(Map<String, Object> s) {
    var copy = new LinkedHashMap<>(s);
    copy.remove("user_token_hash");
    copy.remove("share_id");
    copy.remove("ticket_id");
    copy.put("correlation_id",s.get("id"));
    copy.put("safe_message",SessionLifecycle.message(Objects.toString(s.get("phase"),"REQUESTED")));
    if("ENGINE_CONSENT_TIMEOUT".equals(s.get("result")))copy.put("safe_message","A confirmação no computador acessado expirou. Solicite uma nova tentativa.");
    if ("ACTIVE".equals(copy.get("status"))
        && (copy.get("engine_seen_at") == null
            || Db.instant(copy.get("engine_seen_at")).isBefore(Instant.now().minusSeconds(10))))
      copy.put("status", "UNVERIFIED");
    if("UNVERIFIED".equals(copy.get("status")))copy.put("safe_message","Estado do motor não confirmado. Bloqueando o visualizador.");
    return copy;
  }

  List<Map<String, Object>> history(UUID device) {
    return db
        .list("SELECT s.*,u.name AS technician_name FROM remote_session s LEFT JOIN app_user u ON u.id=s.technician_id WHERE s.device_id=? ORDER BY s.requested_at DESC", device)
        .stream()
        .map(SessionService::publicSession)
        .toList();
  }

  synchronized List<Map<String, Object>> forDevice(UUID device) {
    sweep();
    for(var row:db.list("SELECT id,phase FROM remote_session WHERE device_id=? AND ended_at IS NULL",device)) {
      if("REQUESTED".equals(row.get("phase"))) {
        phase(Db.id(row,"id"),"TARGET_NOTIFIED","AGENT_POLL",null);
        phase(Db.id(row,"id"),"CONSENT_PENDING","BACKEND",null);
      }
    }
    return db.list(
        "SELECT s.id,s.mode,s.status,s.expires_at,s.native_diagnostic,COALESCE(s.requester_name,u.name) AS technician FROM remote_session s LEFT JOIN"
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
    Security.require(a.staff(),"Somente contas autorizadas do painel podem iniciar conexões.");
    throttle("user:" + a.id(), 5);
    throttle("ip:" + ip, 60);
    Security.require(Set.of("VIEW", "CONTROL").contains(mode), "Modo inválido.");
    var rows=db.list("SELECT * FROM device WHERE (public_code=? OR CAST(id AS VARCHAR)=?) AND revoked=FALSE AND (agent_health IS NULL OR agent_health='OK') AND last_seen>?",code.trim().replace(" ","").toUpperCase(Locale.ROOT),code.trim(),MonitoringService.deadline(db));
    if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Código indisponível.");
    UUID device=Db.id(rows.getFirst(),"id");
    Security.require(access.device(a,device,mode.equals("CONTROL")),"Dispositivo não autorizado para este operador.");
    throttle("target:"+device,5);
    Security.require(!a.device() || !a.id().equals(device),"Selecione outro computador.");
    return create(a, device, mode, rows.getFirst(), true);
  }

  synchronized void throttle(String key, int limit) {
    // Commit the limiter inside this monitor, independent of the caller's enrollment transaction.
    // Otherwise two outer transactions can both observe an absent row before the first commit.
    boolean allowed=Boolean.TRUE.equals(rateTransaction.execute(status->{
      db.exec("DELETE FROM connection_attempt WHERE window_start<?",OffsetDateTime.now().minusMinutes(1));
      String hash=Security.hash(key);
      if(db.exists("SELECT 1 FROM connection_attempt WHERE attempt_key=? AND attempts>=?",hash,limit)){
        db.audit("connection","CONNECTION_RATE_LIMIT",hash);return false;
      }
      if(db.exec("UPDATE connection_attempt SET attempts=attempts+1 WHERE attempt_key=?",hash)==0)
        db.exec("INSERT INTO connection_attempt VALUES (?,1,?)",hash,OffsetDateTime.now());
      return true;
    }));
    if(!allowed)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Muitas solicitações. Aguarde um minuto.");
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
    db.exec("UPDATE remote_session SET requested_mode=?,phase_at=?,phase_deadline=? WHERE id=?",mode,OffsetDateTime.now(),OffsetDateTime.now().plusSeconds(60),id);
    db.exec("INSERT INTO remote_transition VALUES (?,?,NULL,'REQUESTED','BACKEND',?,0,NULL,?)",UUID.randomUUID(),id,OffsetDateTime.now(),SessionLifecycle.message("REQUESTED"));
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
        s.get("status").equals("PENDING") && valid(s) && !deadlinePassed(s), "Solicitação encerrada ou expirada.");
    if("REQUESTED".equals(s.get("phase"))) {phase(id,"TARGET_NOTIFIED","AGENT_DECISION",null);phase(id,"CONSENT_PENDING","BACKEND",null);}
    if (decision.equals("reject")) {
      phase(id,"CONSENT_REJECTED","LOCAL_UI",null);
      close(s, "REJECTED");
      return;
    }
    if(decision.equals("accept-view")) db.exec("UPDATE remote_session SET mode='VIEW' WHERE id=?",id);
    db.exec("UPDATE remote_session SET status='CONSENTED' WHERE id=? AND status='PENDING'", id);
    phase(id,decision.equals("accept-view")||s.get("mode").equals("VIEW")?"CONSENT_ACCEPTED_VIEW":"CONSENT_ACCEPTED_CONTROL","LOCAL_UI",null);
    db.audit(device.toString(), "LOCAL_CONSENT", id);
  }

  synchronized Map<String, String> launch(Security.Actor a, UUID id) {
    var s = db.one("SELECT * FROM remote_session WHERE id=?", id);
    Security.require(
        a.id().equals(Db.id(s, a.device()?"requester_device_id":"technician_id")) && a.tokenHash().equals(s.get("user_token_hash")),
        "Sessão não autorizada.");
    Security.require(
        s.get("status").equals("CONSENTED") && valid(s) && !deadlinePassed(s),
        "Aguarde o consentimento ou solicite uma nova sessão.");
    var d = db.one("SELECT * FROM device WHERE id=?", s.get("device_id"));
    // Persist deadline BEFORE requesting a share. A crashed backend cannot leave an unbounded
    // share.
    db.exec(
        "UPDATE remote_session SET status='ISSUING',expires_at=? WHERE id=?",
        OffsetDateTime.now().plusSeconds(120),
        id);
    phase(id,"ENGINE_AUTHORIZING","BACKEND",null);
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
      if(deadlinePassed(issued)) { close(issued,"AUTHORIZATION_TIMEOUT");throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT,"Prazo de autorização excedido."); }
      phase(id,"TRANSPORT_CONNECTING","MESH_CONTROL",null);
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
    if(s.get("ended_at")!=null||SessionLifecycle.TERMINAL.contains(Objects.toString(s.get("phase"),""))||Set.of("STOP_REQUESTED","ENGINE_STOPPING").contains(Objects.toString(s.get("phase"),"")))return false;
    if (!Db.instant(s.get("expires_at")).isAfter(Instant.now())) return false;
    if (!db.exists(
        "SELECT 1 FROM device WHERE id=? AND revoked=FALSE AND (agent_health IS NULL OR agent_health='OK') AND last_seen>?",
        s.get("device_id"),
        MonitoringService.deadline(db))) return false;
    if(s.get("requester_device_id")!=null) return false; // Retired device-to-device controller sessions.
    var users =
        db.list(
            "SELECT u.* FROM app_user u JOIN user_session x ON x.user_id=u.id WHERE u.id=? AND"
                + " u.active=TRUE AND x.token_hash=? AND x.expires_at>?",
            s.get("technician_id"),
            s.get("user_token_hash"),
            OffsetDateTime.now());
    if (users.isEmpty()) return false;
    if ("LEITURA".equals(users.getFirst().get("panel_role"))) return false;
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
    s=db.one("SELECT * FROM remote_session WHERE id=?",s.get("id"));
    if (s.get("ended_at") != null) return;
    UUID sid=Db.id(s,"id");String current=Objects.toString(s.get("phase"),"REQUESTED");
    if(!SessionLifecycle.TERMINAL.contains(current)&&!current.equals("ENGINE_STOPPING")) {
      phase(sid,"STOP_REQUESTED","BACKEND",null);phase(sid,"ENGINE_STOPPING","BACKEND",null);
    }
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
    var closing=db.one("SELECT * FROM remote_session WHERE id=?",sid);
    if(!SessionLifecycle.TERMINAL.contains(Objects.toString(closing.get("phase"))))phase(sid,terminal(result),"BACKEND",safeCode(result));
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
      if(observation.nativeDiagnostic()!=null&&!observation.nativeDiagnostic().isEmpty()) {
        try {db.exec("UPDATE remote_session SET native_diagnostic=? WHERE id=?",new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(observation.nativeDiagnostic()),s.get("id"));}catch(com.fasterxml.jackson.core.JsonProcessingException ignored){}
      }
      // The relay is authoritative for activation time. Never restart an existing timer.
      if("ACTIVE".equals(state)&&s.get("active_until")==null&&observation.startedAt()!=null&&observation.consentAt()!=null) {
        var activeUntil=timestamp(observation.startedAt()).plusSeconds(60);
        db.exec("UPDATE remote_session SET active_until=?,expires_at=? WHERE id=? AND active_until IS NULL",activeUntil,activeUntil,s.get("id"));
      }

      if("ACTIVE".equals(state)&&(observation.startedAt()==null||observation.consentAt()==null)){close(s,"ENGINE_STATE_INVALID");return;}
      if(Set.of("VIEWING","CONTROLLING").contains(Objects.toString(s.get("phase")))&&!Set.of("ACTIVE","ENDED").contains(state)){close(s,"ENGINE_STATE_REGRESSION");return;}
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
                        "SERVER_STOP","TRANSPORT_TIMEOUT","ENGINE_CONSENT_TIMEOUT","FIRST_FRAME_TIMEOUT","RENDER_TIMEOUT")
                    .contains(Objects.toString(observation.reason(), ""))
                ? observation.reason()
                : "ENGINE_ENDED";
        close(s, reason);
      } else {
        UUID sid=Db.id(s,"id");String phaseNow=Objects.toString(db.one("SELECT phase FROM remote_session WHERE id=?",sid).get("phase"));
        if("AWAITING_CONSENT".equals(state)&&phaseNow.equals("TRANSPORT_CONNECTING"))phase(sid,"ENGINE_CONSENT_PENDING","MESH_RELAY",null);
        if(Set.of("CONSENTED","AWAITING_RENDER","ACTIVE").contains(state)) {
          if(Set.of("TRANSPORT_CONNECTING","ENGINE_CONSENT_PENDING").contains(phaseNow))phase(sid,"AWAITING_FIRST_FRAME","MESH_RELAY",null);
          if("ACTIVE".equals(state)&&observation.startedAt()!=null&&observation.consentAt()!=null) {
            String latest=Objects.toString(db.one("SELECT phase FROM remote_session WHERE id=?",sid).get("phase"));
            if(latest.equals("AWAITING_FIRST_FRAME")){phase(sid,"FIRST_FRAME_RECEIVED","MESH_RELAY",null);phase(sid,s.get("mode").equals("VIEW")?"VIEWING":"CONTROLLING","MESH_RELAY",null);}
          }
        }
        db.exec(
            "UPDATE remote_session SET status=? WHERE id=?",
            Set.of("CONSENTED","AWAITING_RENDER").contains(state) ? "AWAITING_FRAME" : state,
            s.get("id"));
      }
    } catch (RuntimeException e) {
      // Never retain ACTIVE while engine state is unknown. Stop renewing and request closure.
      close(s, "ENGINE_UNREACHABLE");
    }
  }

  static boolean deadlinePassed(Map<String,Object> s) {return s.get("phase_deadline")!=null&&!Db.instant(s.get("phase_deadline")).isAfter(Instant.now());}
  static String safeCode(String code) {return Set.of("LOCAL_STOP","REQUESTER_STOP","REJECTED","EXPIRED","REVOKED","STAGE_TIMEOUT","AUTHORIZATION_TIMEOUT","ENGINE_ERROR","ENGINE_UNREACHABLE","STOP_UNCONFIRMED","TRANSPORT_TIMEOUT","ENGINE_CONSENT_TIMEOUT","FIRST_FRAME_TIMEOUT","RENDER_TIMEOUT","DISCONNECTED","CONNECTION_LOST","PRIVACY_BAR_FAILED","CONSENT_MISSING","PROTOCOL_ERROR","LEASE_LOST","SERVER_STOP","ENGINE_STATE_INVALID","ENGINE_STATE_REGRESSION","ENGINE_STATE_LOST","VIEWER_BOOTSTRAP_FAILED","REVOKED_DURING_LAUNCH").contains(code)?code:"SESSION_CLOSED";}
  static String terminal(String result) {
    if(result.equals("REJECTED"))return "CONSENT_REJECTED";
    if(result.equals("EXPIRED"))return "EXPIRED";
    if(result.contains("REVOKED"))return "REVOKED";
    if(Set.of("LOCAL_STOP","REQUESTER_STOP","SERVER_STOP").contains(result))return "TERMINATED";
    return "FAILED";
  }
  synchronized void phase(UUID id,String next,String component,String code) {
    lifecycleTransaction.executeWithoutResult(tx->{
      var row=db.one("SELECT * FROM remote_session WHERE id=? FOR UPDATE",id);
      String previous=Objects.toString(row.get("phase"),"REQUESTED");
      if(previous.equals(next))return;
      if(!SessionLifecycle.allows(previous,next))throw new IllegalStateException("Invalid remote lifecycle transition");
      var at=OffsetDateTime.now();int timeout=SessionLifecycle.timeout(next);
      // Delivery milestones do not extend the original consent deadline.
      Object deadline=Set.of("TARGET_NOTIFIED","CONSENT_PENDING").contains(next)?row.get("phase_deadline"):timeout==0?null:at.plusSeconds(timeout);
      long elapsed=Math.max(0,Duration.between(Db.instant(row.get("phase_at")),at.toInstant()).toMillis());
      db.exec("UPDATE remote_session SET phase=?,phase_at=?,phase_deadline=? WHERE id=?",next,at,deadline,id);
      db.exec("INSERT INTO remote_transition VALUES (?,?,?,?,?,?,?,?,?)",UUID.randomUUID(),id,previous,next,component,at,elapsed,code==null?null:safeCode(code),SessionLifecycle.message(next));
    });
  }
  List<Map<String,Object>> trace(Security.Actor actor,UUID id) {
    get(actor,id);
    return db.list("SELECT t.*,s.device_id AS target_device_id,s.requester_device_id,s.technician_id AS requester_user_id,s.requested_mode,s.mode AS granted_mode FROM remote_transition t JOIN remote_session s ON s.id=t.session_id WHERE t.session_id=? ORDER BY t.occurred_at",id);
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
        if (deadlinePassed(s)) {
          if(!SessionLifecycle.TERMINAL.contains(Objects.toString(s.get("phase"))))phase(Db.id(s,"id"),"FAILED","BACKEND","STOP_UNCONFIRMED");
          db.exec(
              "UPDATE remote_session SET status='ENDED',ended_at=?,result='EXPIRED_UNCONFIRMED'"
                  + " WHERE id=?",
              OffsetDateTime.now(),
              s.get("id"));
        } else close(s, Objects.toString(s.get("result"), "STOP"));
      } else if (!Db.instant(s.get("expires_at")).isAfter(Instant.now())) close(s,"EXPIRED");
      else if(deadlinePassed(s)) close(s,"ENGINE_CONSENT_PENDING".equals(s.get("phase"))?"ENGINE_CONSENT_TIMEOUT":"STAGE_TIMEOUT");
      else if (!valid(s)) close(s, "REVOKED");
      else if (s.get("share_id") != null) observe(s);
    }
  }
}
