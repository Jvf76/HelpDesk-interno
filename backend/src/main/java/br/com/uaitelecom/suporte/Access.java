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

}
