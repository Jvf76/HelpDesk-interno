package br.com.uaitelecom.suporte;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import java.time.*;
import java.io.*;
import java.util.zip.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
class PrinterReports {
  final Db db;
  PrinterReports(Db db){this.db=db;}
  void staff(HttpServletRequest r){Security.require(Security.actor(r).staff(),"Acesso da equipe de TI necessário.");}

  @GetMapping("/printers")
  Map<String,Object> list(HttpServletRequest r){
    staff(r);
    var latest=db.list("SELECT batch FROM printer_job ORDER BY requested_at DESC LIMIT 1");
    return Map.of("printers",db.list("SELECT * FROM printer ORDER BY label"),
        "collectors",db.list("SELECT id,name FROM device WHERE revoked=FALSE AND agent_hash IS NOT NULL ORDER BY name"),
        "jobs",latest.isEmpty()?List.of():jobs(latest.getFirst().get("batch")));
  }
  List<Map<String,Object>> jobs(Object batch){
    return db.list("SELECT batch,printer_id,CASE WHEN status='WAITING' AND requested_at<? THEN 'EXPIRED' ELSE status END AS status,received_at FROM printer_job WHERE batch=? ORDER BY printer_id",OffsetDateTime.now().minusMinutes(15),batch);
  }
  record Binding(UUID collector){}
  @PutMapping("/printers/{id}/collector")
  void assign(HttpServletRequest r,@PathVariable String id,@RequestBody Binding b){
    staff(r);
    Security.require(b.collector()==null||db.exists("SELECT 1 FROM device WHERE id=? AND revoked=FALSE AND agent_hash IS NOT NULL",b.collector()),"Coletor inválido.");
    if(db.exec("UPDATE printer SET collector=? WHERE id=? AND supported=TRUE",b.collector(),id)!=1)throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  }
  @PostMapping("/printers/batches") @Transactional
  Map<String,Object> request(HttpServletRequest r){
    staff(r);UUID batch=UUID.randomUUID();var now=OffsetDateTime.now();
    for(var p:db.list("SELECT * FROM printer ORDER BY id FOR UPDATE")){
      var status=!Boolean.TRUE.equals(p.get("supported"))?"UNSUPPORTED":p.get("collector")==null?"UNASSIGNED":"WAITING";
      db.exec("INSERT INTO printer_job(id,batch,printer_id,collector,status,requested_at) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),batch,p.get("id"),p.get("collector"),status,now);
    }
    db.audit(Security.actor(r).id().toString(),"PRINTER_REPORTS_REQUESTED",batch);
    return Map.of("batch",batch);
  }
  @GetMapping("/desktop/printer-jobs")
  List<Map<String,Object>> pending(HttpServletRequest r){
    return db.list("SELECT j.id,p.serial FROM printer_job j JOIN printer p ON p.id=j.printer_id AND p.collector=j.collector WHERE j.collector=? AND j.status='WAITING' AND j.requested_at>=? ORDER BY j.requested_at LIMIT 1",Security.actor(r).id(),OffsetDateTime.now().minusMinutes(15));
  }
  @PostMapping("/desktop/printer-jobs/{id}")
  void finish(HttpServletRequest r,@PathVariable UUID id) throws IOException{
    UUID collector=Security.actor(r).id();
    byte[] pdf=r.getInputStream().readNBytes(65537);
    if(pdf.length>65536 || (pdf.length>0 && !new String(pdf,0,Math.min(5,pdf.length),java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    if(db.exec("UPDATE printer_job SET status=?,received_at=?,pdf=? WHERE id=? AND status='WAITING' AND collector=? AND requested_at>=? AND printer_id IN (SELECT id FROM printer WHERE collector=?)",pdf.length==0?"FAILED":"READY",OffsetDateTime.now(),pdf,id,collector,OffsetDateTime.now().minusMinutes(15),collector)!=1)throw new ResponseStatusException(HttpStatus.CONFLICT);
  }
  @GetMapping("/printers/batches/{batch}/download")
  ResponseEntity<byte[]> download(HttpServletRequest r,@PathVariable UUID batch) throws IOException{
    staff(r);var rows=db.list("SELECT printer_id,pdf FROM printer_job WHERE batch=? AND status='READY' ORDER BY printer_id",batch);
    if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    var bytes=new ByteArrayOutputStream();
    try(var zip=new ZipOutputStream(bytes)){for(var row:rows){
      zip.putNextEntry(new ZipEntry(row.get("printer_id")+".pdf"));zip.write((byte[])row.get("pdf"));zip.closeEntry();
    }}
    return ResponseEntity.ok().header("Content-Disposition","attachment; filename=relatorios-"+batch+".zip").contentType(MediaType.APPLICATION_OCTET_STREAM).body(bytes.toByteArray());
  }
}
