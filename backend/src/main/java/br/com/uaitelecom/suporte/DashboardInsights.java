package br.com.uaitelecom.suporte;

import jakarta.servlet.http.HttpServletRequest;
import java.time.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
class DashboardInsights {
  private final Db db;
  private final MonitoringService monitoring;
  DashboardInsights(Db db, MonitoringService monitoring) {
    this.db=db;
    this.monitoring=monitoring;
  }

  @GetMapping("/api/monitoring/insights")
  Map<String,Object> insights(@RequestParam(defaultValue="7") int days,HttpServletRequest request) {
    var actor=Security.actor(request);
    Security.require(actor!=null && actor.staff(),"Acesso da equipe de TI necessário.");
    Security.require(days==7 || days==30,"Período inválido.");
    var zone=ZoneId.of("America/Sao_Paulo");
    var now=OffsetDateTime.now();
    var from=LocalDate.now(zone).minusDays(days-1L).atStartOfDay(zone).toOffsetDateTime();
    var daily=db.list("""
        SELECT CAST(CAST(observed_at AT TIME ZONE 'America/Sao_Paulo' AS DATE) AS VARCHAR) AS "day",
               MAX(cpu_pct) AS cpu, MAX(memory_pct) AS ram
        FROM fleet_metric WHERE observed_at BETWEEN ? AND ?
        GROUP BY CAST(CAST(observed_at AT TIME ZONE 'America/Sao_Paulo' AS DATE) AS VARCHAR) ORDER BY "day"
        """,from,now);
    var cfg=monitoring.config();
    var fresh=now.minusSeconds(MonitoringService.number(cfg,"metrics_seconds")*3L);
    var online=MonitoringService.deadline(db);
    var stable=now.minusSeconds(MonitoringService.number(cfg,"duration_seconds"));
    var health=db.list("""
        SELECT condition_name,COUNT(*) AS count FROM (SELECT CASE
          WHEN revoked OR last_seen IS NULL OR last_seen<? THEN 'unknown'
          WHEN error_since<=? THEN 'critical'
          WHEN metric_at IS NULL OR metric_at<? THEN 'unknown'
          WHEN cpu_high_since<=? OR memory_high_since<=? OR disk_low_since<=? THEN 'attention'
          WHEN cpu_pct IS NULL OR memory_pct IS NULL OR disk_free_pct IS NULL THEN 'unknown'
          ELSE 'normal' END AS condition_name FROM device WHERE removed_at IS NULL) h GROUP BY condition_name
        """,online,stable,fresh,stable,stable,stable);
    var top=db.list("""
        SELECT id,COALESCE(NULLIF(friendly_name,''),name) AS name,memory_pct,cpu_pct
        FROM device WHERE revoked=FALSE AND last_seen>=? AND metric_at>=? AND memory_pct IS NOT NULL
        ORDER BY memory_pct DESC,id LIMIT 5
        """,online,fresh);
    var activity=db.list("""
        SELECT kind,name,at_time FROM (
          SELECT CASE WHEN s.started_at IS NULL THEN 'requested' ELSE 'connected' END AS kind,
            COALESCE(NULLIF(d.friendly_name,''),d.name) AS name,COALESCE(s.started_at,s.requested_at) AS at_time
            FROM remote_session s JOIN device d ON d.id=s.device_id
          UNION ALL
          SELECT CASE WHEN j.status='READY' THEN 'report' WHEN j.status='FAILED' THEN 'failed' ELSE 'collection' END,
            p.label,COALESCE(j.received_at,j.requested_at)
            FROM printer_job j JOIN printer p ON p.id=j.printer_id WHERE j.status IN ('WAITING','READY','FAILED')
        ) a ORDER BY at_time DESC,name,kind LIMIT 8
        """);
    return Map.of("daily",daily,"health",health,"top",top,"activity",activity);
  }
}
