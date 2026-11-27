package br.com.uaitelecom.suporte;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
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
    return Map.of("printers",db.list("SELECT * FROM printer WHERE removed_at IS NULL ORDER BY label"),
        "collectors",db.list("SELECT id,name FROM device WHERE revoked=FALSE AND agent_hash IS NOT NULL ORDER BY name"),
        "jobs",latest.isEmpty()?List.of():jobs(latest.getFirst().get("batch")));
  }
  List<Map<String,Object>> jobs(Object batch){
    return db.list("SELECT batch,printer_id,CASE WHEN status='WAITING' AND requested_at<? THEN 'EXPIRED' ELSE status END AS status,received_at FROM printer_job WHERE batch=? AND printer_id IN (SELECT id FROM printer WHERE removed_at IS NULL) ORDER BY printer_id",OffsetDateTime.now().minusMinutes(15),batch);
  }
  record PrinterInput(@NotBlank @Size(max=100) String label,@Size(max=60) String serial){}
  void admin(HttpServletRequest r){Security.require(Security.actor(r).admin(),"Apenas administrador.");}
  void log(HttpServletRequest r,String id,String action,Object before,Object after){
    db.exec("INSERT INTO printer_change(id,printer_id,action,before_value,after_value,changed_at,actor_id) VALUES (?,?,?,?,?,?,?)",UUID.randomUUID(),id,action,Objects.toString(before,null),Objects.toString(after,null),OffsetDateTime.now(),Security.actor(r).id());
  }
  @PostMapping("/printers") @Transactional
  Map<String,String> create(@Valid @RequestBody PrinterInput input,HttpServletRequest r){
    admin(r);String id=UUID.randomUUID().toString();
    db.exec("INSERT INTO printer(id,label,serial,supported) VALUES(?,?,?,FALSE)",id,input.label().strip(),ActivationController.optional(input.serial()));
    log(r,id,"PRINTER_CREATED",null,input.label().strip());return Map.of("id",id);
  }
  @PutMapping("/printers/{id}") @Transactional
  void edit(@PathVariable String id,@Valid @RequestBody PrinterInput input,HttpServletRequest r){
    admin(r);var p=db.one("SELECT * FROM printer WHERE id=? AND removed_at IS NULL FOR UPDATE",id);
    String label=input.label().strip(),serial=ActivationController.optional(input.serial());
    Security.require(!Boolean.TRUE.equals(p.get("supported"))||Objects.equals(serial,p.get("serial")),"A série identifica o equipamento homologado.");
    if(!Objects.equals(p.get("label"),label))log(r,id,"label",p.get("label"),label);
    if(!Objects.equals(p.get("serial"),serial))log(r,id,"serial",p.get("serial"),serial);
    db.exec("UPDATE printer SET label=?,serial=? WHERE id=?",label,serial,id);
  }
  @DeleteMapping("/printers/{id}") @Transactional
  void remove(@PathVariable String id,HttpServletRequest r){
    admin(r);var p=db.one("SELECT label,removed_at FROM printer WHERE id=? FOR UPDATE",id);
    if(p.get("removed_at")!=null)return;
    db.exec("UPDATE printer SET collector=NULL,removed_at=? WHERE id=?",OffsetDateTime.now(),id);
    db.exec("UPDATE printer_job SET status='CANCELLED' WHERE printer_id=? AND status='WAITING'",id);
    log(r,id,"PRINTER_REMOVED",p.get("label"),null);
  }
  record Binding(UUID collector){}
  @PutMapping("/printers/{id}/collector") @Transactional
  void assign(HttpServletRequest r,@PathVariable String id,@RequestBody Binding b){
    staff(r);
    if(b.collector()!=null)db.one("SELECT id FROM device WHERE id=? AND revoked=FALSE AND agent_hash IS NOT NULL FOR UPDATE",b.collector());
    var p=db.one("SELECT collector FROM printer WHERE id=? AND removed_at IS NULL AND supported=TRUE FOR UPDATE",id);
    if(Objects.equals(p.get("collector"),b.collector()))return;
    db.exec("UPDATE printer SET collector=? WHERE id=?",b.collector(),id);
    log(r,id,"collector",p.get("collector"),b.collector());
  }
  @PostMapping("/printers/batches") @Transactional
  Map<String,Object> request(HttpServletRequest r){
    staff(r);UUID batch=UUID.randomUUID();var now=OffsetDateTime.now();
    for(var p:db.list("SELECT * FROM printer WHERE removed_at IS NULL ORDER BY id FOR UPDATE")){
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
