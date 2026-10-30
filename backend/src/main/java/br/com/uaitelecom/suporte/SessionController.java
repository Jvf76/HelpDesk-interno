package br.com.uaitelecom.suporte;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
class SessionController {
  final SessionService service;

  SessionController(SessionService s) {
    service = s;
  }

  record Request(
      @NotNull UUID deviceId,
      @NotNull @Pattern(regexp = "VIEW|CONTROL") String mode) {}

  @PostMapping
  Map<String, Object> create(@Valid @RequestBody Request b, HttpServletRequest r) {
    return service.request(Security.actor(r), b.deviceId(), b.mode());
  }

  @GetMapping("/{id}")
  Map<String, Object> get(@PathVariable UUID id, HttpServletRequest r) {
    service.sweep();
    return service.get(Security.actor(r), id);
  }

  @PostMapping("/{id}/launch")
  Map<String, Object> launch(@PathVariable UUID id, HttpServletRequest r) {
    String ip=r.getRemoteAddr();
    // Lab API binds to loopback; both reverse proxies overwrite the forwarding header.
    if ((ip.equals("127.0.0.1") || ip.equals("0:0:0:0:0:0:0:1")) && r.getHeader("X-Forwarded-For")!=null)
      ip=r.getHeader("X-Forwarded-For");
    return service.viewer(Security.actor(r), id, ip);
  }

  @PostMapping("/{id}/stop")
  Map<String, Object> stop(@PathVariable UUID id, HttpServletRequest r) {
    service.stop(Security.actor(r), id);
    return service.get(Security.actor(r), id);
  }
}
