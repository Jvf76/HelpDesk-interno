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
      @NotNull @Pattern(regexp = "VIEW|CONTROL") String mode,
      UUID ticketId) {}

  @PostMapping
  Map<String, Object> create(@Valid @RequestBody Request b, HttpServletRequest r) {
    return service.request(Security.actor(r), b.deviceId(), b.mode(), b.ticketId());
  }

  @GetMapping("/{id}")
  Map<String, Object> get(@PathVariable UUID id, HttpServletRequest r) {
    service.sweep();
    return service.get(Security.actor(r), id);
  }

  @PostMapping("/{id}/launch")
  Map<String, String> launch(@PathVariable UUID id, HttpServletRequest r) {
    return service.launch(Security.actor(r), id);
  }

  @PostMapping("/{id}/stop")
  Map<String, Object> stop(@PathVariable UUID id, HttpServletRequest r) {
    service.stop(Security.actor(r), id);
    return service.get(Security.actor(r), id);
  }
}
