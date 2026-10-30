package br.com.uaitelecom.suporte;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;

@Configuration
class Security {
  static final SecureRandom RANDOM = new SecureRandom();

  static String token() {
    byte[] b = new byte[32];
    RANDOM.nextBytes(b);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }

  static String hash(String text) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  static void require(boolean condition, String message) {
    if (!condition) throw new ResponseStatusException(HttpStatus.FORBIDDEN, message);
  }

  record Actor(UUID id, String name, String role, String tokenHash) {
    boolean device() { return role.equals("DEVICE"); }

    boolean admin() {
      return role.equals("ADMIN");
    }

    boolean staff() {
      return Set.of("ADMIN","TECNICO","OPERADOR").contains(role);
    }
  }

  static Actor actor(HttpServletRequest r) {
    return (Actor) r.getAttribute("actor");
  }

  @Bean
  BCryptPasswordEncoder passwords() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  SecurityFilterChain chain(HttpSecurity http, Db db) throws Exception {
    var guard =
        new OncePerRequestFilter() {
          protected void doFilterInternal(
              HttpServletRequest r, HttpServletResponse s, FilterChain chain)
              throws ServletException, IOException {
            s.setHeader("Cache-Control", "no-store");
            s.setHeader("Referrer-Policy", "no-referrer");
            String path = r.getRequestURI();
            if (path.equals("/api/auth/login")
                || path.startsWith("/api/agent/")
                || path.equals("/error")) {
              chain.doFilter(r, s);
              return;
            }
            if(path.startsWith("/api/desktop/")) {
              String bearer=Objects.toString(r.getHeader("Authorization"),"");
              var devices=db.list("SELECT * FROM device WHERE agent_hash=? AND revoked=FALSE AND organization='UAI_TELECOM'",hash(bearer.startsWith("Bearer ")?bearer.substring(7):""));
              if(devices.isEmpty()) { s.setStatus(401);s.setContentType("application/json");s.getWriter().write("{\"message\":\"Credencial revogada ou inválida. Solicite reativação administrativa.\"}"); return; }
              var d=devices.getFirst();
              if(!d.get("id").toString().equals(r.getHeader("X-Uai-Device"))) {s.sendError(403);return;}
              r.setAttribute("actor",new Actor(Db.id(d,"id"),d.get("name").toString(),"DEVICE",d.get("agent_hash").toString()));
              chain.doFilter(r,s);return;
            }
            String token = "";
            if (r.getCookies() != null)
              for (var c : r.getCookies())
                if (c.getName().equals("UAI_SESSION")) token = c.getValue();
            var rows =
                db.list(
                    "SELECT u.*,s.csrf,s.token_hash FROM user_session s JOIN app_user u ON"
                        + " u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND"
                        + " u.active=TRUE",
                    hash(token),
                    OffsetDateTime.now());
            if (rows.isEmpty()) {
              s.setStatus(401);
              s.setContentType("application/json");
              s.getWriter().write("{\"message\":\"Entre novamente para continuar.\"}");
              return;
            }
            var u = rows.getFirst();
            if (!Set.of("GET", "HEAD", "OPTIONS").contains(r.getMethod())
                && !MessageDigest.isEqual(
                    u.get("csrf").toString().getBytes(StandardCharsets.UTF_8),
                    Objects.toString(r.getHeader("X-CSRF-Token"), "")
                        .getBytes(StandardCharsets.UTF_8))) {
              s.sendError(403);
              return;
            }
            r.setAttribute(
                "actor",
                new Actor(
                    Db.id(u, "id"),
                    u.get("name").toString(),
                    Objects.toString(u.get("panel_role"),u.get("role").toString()),
                    u.get("token_hash").toString()));
            r.setAttribute("csrf", u.get("csrf"));
            chain.doFilter(r, s);
          }
        };
    return http.csrf(c -> c.disable())
        .sessionManagement(
            c ->
                c.sessionCreationPolicy(
                    org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(c -> c.anyRequest().permitAll())
        .addFilterBefore(guard, UsernamePasswordAuthenticationFilter.class)
        .headers(
            h ->
                h.contentSecurityPolicy(
                    c -> c.policyDirectives("default-src 'none'; frame-ancestors 'none'")))
        .build();
  }
}
