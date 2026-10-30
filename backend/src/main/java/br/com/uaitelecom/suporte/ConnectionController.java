package br.com.uaitelecom.suporte;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/connections")
class ConnectionController {
  final SessionService sessions;
  ConnectionController(SessionService sessions) { this.sessions = sessions; }
  record Request(@NotBlank @Size(max=64) String code, @Pattern(regexp="VIEW|CONTROL") @NotNull String mode) {}
  @PostMapping
  Map<String,Object> request(@Valid @RequestBody Request request, HttpServletRequest r) {
    // The authenticated user identity, never a caller-supplied display name, is shown to the recipient.
    return sessions.requestAssisted(Security.actor(r), request.code(), request.mode(), r.getRemoteAddr());
  }
  @GetMapping
  List<Map<String,Object>> history(HttpServletRequest r) {
    var actor = Security.actor(r);
    return sessions.db.list("SELECT s.*,u.name AS requester_name FROM remote_session s JOIN app_user u ON u.id=s.technician_id WHERE s.technician_id=? ORDER BY s.requested_at DESC LIMIT 100", actor.id()).stream().map(SessionService::publicSession).toList();
  }
}
