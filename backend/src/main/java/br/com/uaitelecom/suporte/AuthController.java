package br.com.uaitelecom.suporte;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.http.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
class AuthController {
  final Db db;
  final BCryptPasswordEncoder passwords;
  final SessionService sessions;
  final boolean secure;
  final String dummy;

  AuthController(
      Db db,
      BCryptPasswordEncoder passwords,
      SessionService sessions,
      @Value("${uai.secure-cookie}") boolean secure) {
    this.db = db;
    this.passwords = passwords;
    this.sessions = sessions;
    this.secure = secure;
    dummy = passwords.encode(Security.token());
  }

  record Login(
      @NotBlank @Size(max = 120) String login, @NotBlank @Size(max = 72) String password) {}

  @PostMapping("/login")
  synchronized Map<String, Object> login(
      @Valid @RequestBody Login body, HttpServletRequest r, HttpServletResponse response) {
    String login = body.login().trim().toLowerCase(Locale.ROOT);
    String key = Security.hash("ip:" + r.getRemoteAddr()),
        accountKey = Security.hash("account:" + login);
    var now = OffsetDateTime.now();
    db.exec("DELETE FROM login_attempt WHERE window_start<?", now.minusMinutes(15));
    for (String k : List.of(key, accountKey)) {
      if (db.exists("SELECT 1 FROM login_attempt WHERE attempt_key=? AND failures>=10", k))
        throw new ResponseStatusException(
            HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas. Aguarde 15 minutos.");
    }
    var rows = db.list("SELECT * FROM app_user WHERE login=? AND active=TRUE", login);
    boolean valid =
        passwords.matches(
            body.password(),
            rows.isEmpty() ? dummy : rows.getFirst().get("password_hash").toString());
    if (!valid || rows.isEmpty()) {
      for (String k : List.of(key, accountKey)) {
        if (db.exec("UPDATE login_attempt SET failures=failures+1 WHERE attempt_key=?", k) == 0)
          db.exec("INSERT INTO login_attempt VALUES (?,1,?)", k, now);
      }
      db.audit("anonymous", "LOGIN_FAILED", "login");
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login ou senha inválidos.");
    }
    var u = rows.getFirst();
    String token = Security.token(), csrf = Security.token();
    db.exec(
        "INSERT INTO user_session VALUES (?,?,?,?)",
        Security.hash(token),
        u.get("id"),
        csrf,
        now.plusHours(8));
    response.addHeader(
        "Set-Cookie",
        ResponseCookie.from("UAI_SESSION", token)
            .httpOnly(true)
            .secure(secure)
            .sameSite("Strict")
            .path("/api")
            .maxAge(Duration.ofHours(8))
            .build()
            .toString());
    db.audit(u.get("id").toString(), "LOGIN", "session");
    return Map.of("id", u.get("id"), "name", u.get("name"), "role", u.get("role"), "csrf", csrf);
  }

  @GetMapping("/me")
  Map<String, Object> me(HttpServletRequest r) {
    var a = Security.actor(r);
    return Map.of("id", a.id(), "name", a.name(), "role", a.role(), "csrf", r.getAttribute("csrf"));
  }

  @PostMapping("/logout")
  void logout(HttpServletRequest r, HttpServletResponse s) {
    var a = Security.actor(r);
    db.exec("DELETE FROM user_session WHERE token_hash=?", a.tokenHash());
    sessions.sweep();
    s.addHeader(
        "Set-Cookie",
        ResponseCookie.from("UAI_SESSION", "")
            .path("/api")
            .httpOnly(true)
            .secure(secure)
            .sameSite("Strict")
            .maxAge(0)
            .build()
            .toString());
    db.audit(a.id().toString(), "LOGOUT", "session");
  }

  @Bean
  ApplicationRunner bootstrap(
      @Value("${uai.bootstrap-login}") String login,
      @Value("${uai.bootstrap-password}") String password) {
    return args -> {
      if (db.exists("SELECT 1 FROM app_user")) return;
      if (login.isBlank()
          || password.length() < 14
          || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
        throw new IllegalStateException(
            "Defina BOOTSTRAP_LOGIN e BOOTSTRAP_PASSWORD (14 a 72 bytes) para o primeiro"
                + " administrador.");
      db.exec(
          "INSERT INTO app_user VALUES (?,?,?,?,?,TRUE)",
          UUID.randomUUID(),
          "Administrador",
          login.trim().toLowerCase(Locale.ROOT),
          passwords.encode(password),
          "ADMIN");
    };
  }
}
