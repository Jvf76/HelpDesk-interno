package br.com.uaitelecom.suporte;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
class Db {
  final JdbcTemplate jdbc;

  Db(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  List<Map<String, Object>> list(String sql, Object... args) {
    return jdbc.queryForList(sql, args);
  }

  Map<String, Object> one(String sql, Object... args) {
    var rows = list(sql, args);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Registro não encontrado");
    return rows.getFirst();
  }

  boolean exists(String sql, Object... args) {
    return !list(sql, args).isEmpty();
  }

  int exec(String sql, Object... args) {
    return jdbc.update(sql, args);
  }

  static Instant instant(Object value) {
    if (value == null) return Instant.EPOCH;
    if (value instanceof OffsetDateTime x) return x.toInstant();
    if (value instanceof Timestamp x) return x.toInstant();
    return Instant.parse(value.toString());
  }

  static UUID id(Map<String, Object> row, String field) {
    var v = row.get(field);
    return v == null ? null : UUID.fromString(v.toString());
  }

  void audit(String actor, String action, Object id) {
    exec(
        "INSERT INTO audit_event VALUES (?,?,?,?,?)",
        UUID.randomUUID(),
        actor,
        action,
        String.valueOf(id),
        OffsetDateTime.now());
  }
}
