package br.com.uaitelecom.suporte;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
class AdminController {
  final Db db;
  final BCryptPasswordEncoder passwords;
  final SessionService sessions;

  AdminController(Db db, BCryptPasswordEncoder p, SessionService s) {
    this.db = db;
    passwords = p;
    sessions = s;
  }

  record UserInput(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Pattern(regexp = "[a-zA-Z0-9._@-]{3,120}") String login,
      @NotBlank @Size(min = 14, max = 72) String password,
      @NotNull @Pattern(regexp = "ADMIN|TECNICO|SOLICITANTE|OPERADOR|LEITURA") String role) {}

  record Update(
      @NotNull @Pattern(regexp = "ADMIN|TECNICO|SOLICITANTE|OPERADOR|LEITURA") String role, boolean active) {}

  @GetMapping
  List<Map<String, Object>> list(HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    db.audit(a.id().toString(),"USER_DIRECTORY_READ","users");
    return db.list("SELECT id,name,login,COALESCE(panel_role,role) AS role,active FROM app_user ORDER BY name");
  }

  @PostMapping
  @org.springframework.transaction.annotation.Transactional
  Map<String, UUID> create(@Valid @RequestBody UserInput u, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    Security.require(
        u.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 72,
        "Senha excede 72 bytes.");
    UUID id = UUID.randomUUID();
    db.exec(
        "INSERT INTO app_user(id,name,login,password_hash,role,active) VALUES (?,?,?,?,?,TRUE)",
        id,
        u.name(),
        u.login().toLowerCase(Locale.ROOT),
        passwords.encode(u.password()),
        legacy(u.role()));
    db.exec("UPDATE app_user SET panel_role=? WHERE id=?",panel(u.role()),id);
    db.audit(a.id().toString(), "USER_CREATED", id);
    return Map.of("id", id);
  }

  @PutMapping("/{id}")
  @org.springframework.transaction.annotation.Transactional
  void update(@PathVariable UUID id, @Valid @RequestBody Update u, HttpServletRequest r) {
    var a = Security.actor(r);
    Security.require(a.admin(), "Apenas administrador.");
    Security.require(!a.id().equals(id), "Não altere o próprio perfil por esta operação.");
    db.exec("UPDATE app_user SET role=?,active=? WHERE id=?", legacy(u.role()), u.active(), id);
    db.exec("UPDATE app_user SET panel_role=? WHERE id=?",panel(u.role()),id);
    db.exec("DELETE FROM user_session WHERE user_id=?", id);
    sessions.sweep();
    db.audit(a.id().toString(), "USER_UPDATED", id);
  }
  static String legacy(String role){return switch(role){case "OPERADOR"->"TECNICO";case "LEITURA"->"SOLICITANTE";default->role;};}
  static String panel(String role){return Set.of("ADMIN","OPERADOR","LEITURA").contains(role)?role:null;}
}
