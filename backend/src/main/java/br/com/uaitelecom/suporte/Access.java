package br.com.uaitelecom.suporte;

import java.util.*;
import org.springframework.stereotype.Component;

@Component
class Access {
  final Db db;

  Access(Db db) {
    this.db = db;
  }

  boolean device(Security.Actor a, UUID id, boolean control) {
    return a.admin()
        || (a.staff()
            && db.exists(
                "SELECT 1 FROM device_permission WHERE device_id=? AND user_id=?"
                    + (control ? " AND can_control=TRUE" : ""),
                id,
                a.id()));
  }

  Map<String, Object> deviceRow(Security.Actor a, UUID id, boolean control) {
    Security.require(device(a, id, control), "Dispositivo não autorizado.");
    return db.one("SELECT * FROM device WHERE id=?", id);
  }

  Map<String, Object> ticket(Security.Actor a, UUID id) {
    var t = db.one("SELECT * FROM ticket WHERE id=?", id);
    Security.require(
        a.staff() || a.id().equals(Db.id(t, "requester_id")), "Chamado não autorizado.");
    return t;
  }

  void linkDevice(Security.Actor a, UUID id) {
    if (id == null) return;
    var d = db.one("SELECT * FROM device WHERE id=?", id);
    Security.require(!Boolean.TRUE.equals(d.get("revoked")), "Dispositivo revogado.");
    Security.require(
        device(a, id, false) || a.id().equals(Db.id(d, "owner_id")), "Dispositivo não autorizado.");
  }
}
