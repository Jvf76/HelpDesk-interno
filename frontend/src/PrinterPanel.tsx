import {EquipmentAudit,RemovedEquipment} from "./EquipmentAudit";
import { useEffect, useRef, useState } from "react";
import { api, date } from "./api";

type Panel = {
  printers: {id:string; label:string; serial:string|null; supported:boolean; collector:string|null}[];
  collectors: {id:string; name:string}[];
  jobs: {batch:string; printer_id:string; status:string; received_at:string|null}[];
};
const labels:Record<string,string> = {UNSUPPORTED:"Coleta em desenvolvimento",UNASSIGNED:"Sem coletor",WAITING:"Aguardando o coletor",EXPIRED:"Tempo de coleta expirado",FAILED:"Falha na coleta",READY:"PDF disponível"};

export function PrinterPanel({admin}:{admin:boolean}){
  const [editor,setEditor]=useState<string|null>(null);
  const requestedBatch=useRef<string|null>(null);
  const [data,setData]=useState<Panel|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [revision,refresh]=useState(0);
  useEffect(()=>{
    let live=true;
    let timer:ReturnType<typeof setTimeout>;
    async function load(){
      try {
        const next=await api<Panel>("/printers");
        if(live){setData(next);setError("");}
      }catch{if(live)setError("Não foi possível atualizar os relatórios.");}
      if(live)timer=setTimeout(load,5000);
    }
    void load();
    return ()=>{live=false;clearTimeout(timer);};
  },[revision]);
  useEffect(()=>{
    const jobs=data?.jobs;
    if(!jobs?.length || requestedBatch.current!==jobs[0].batch || jobs.some(job=>job.status==="WAITING"))return;
    requestedBatch.current=null;
    if(jobs.some(job=>job.status==="READY")){
      const link=document.createElement("a");
      link.href="/api/printers/batches/"+jobs[0].batch+"/download";
      link.download="relatorios-"+jobs[0].batch+".zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  },[data]);
  async function change(path:string,method:string,body?:unknown){
    setBusy(true);
    try{const result=await api<{batch:string}|undefined>(path,method,body);if(result?.batch)requestedBatch.current=result.batch;setEditor(null);setData(await api<Panel>("/printers"));refresh(x=>x+1);}
    catch{setError("Não foi possível concluir a operação. Confira o estado da coleta antes de tentar novamente.");}
    finally{setBusy(false);}
  }
  const ready=data?.jobs.filter(j=>j.status==="READY")??[];
  const waiting=data?.jobs.some(j=>j.status==="WAITING");
  return <section className="mon-card"><div className="mon-page-title"><div><h1>Impressoras</h1><p>Solicite uma leitura nas lojas e baixe os relatórios em um arquivo ZIP.</p></div></div>
    {error&&<p role="alert">{error} <button onClick={()=>refresh(x=>x+1)}>Tentar novamente</button></p>}
    {!data&&!error&&<p role="status">Carregando impressoras…</p>}
    {data&&<><RemovedEquipment kind="printers" revision={revision}/>
    {admin&&<button onClick={()=>setEditor("new")}>Cadastrar impressora</button>}
    {admin&&editor&&<form key={editor} onSubmit={e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));void change(editor==="new"?"/printers":"/printers/"+editor,editor==="new"?"POST":"PUT",values);}}>
     <label>Nome da impressora<input name="label" required maxLength={100} defaultValue={data.printers.find(p=>p.id===editor)?.label}/></label>
     <label>Número de série<input name="serial" maxLength={60} readOnly={data.printers.some(p=>p.id===editor&&p.supported)} defaultValue={data.printers.find(p=>p.id===editor)?.serial||""}/></label>
     <button disabled={busy}>Salvar cadastro</button><button type="button" onClick={()=>setEditor(null)}>Cancelar</button>
    </form>}
    <div className="mon-actions"><button disabled={busy||waiting||!data.printers.some(p=>p.supported&&p.collector)} onClick={()=>void change("/printers/batches","POST")}>Solicitar relatórios de todas as impressoras</button>
    {ready.length>0&&<a href={'/api/printers/batches/'+ready[0].batch+'/download'}>Baixar ZIP ({ready.length} de {data.printers.length} disponíveis)</a>}</div>
    <div className="mon-table"><table><thead><tr><th>Equipamento</th><th>Computador coletor</th><th>Última solicitação</th><th>Cadastro</th></tr></thead><tbody>
    {data.printers.map(p=>{const job=data.jobs.find(j=>j.printer_id===p.id);return <tr key={p.id}><td><strong>{p.label}</strong><br/>{p.serial??"Série a confirmar"}</td><td>{p.supported?<select aria-label={'Coletor de '+p.label} value={p.collector??""} disabled={busy||waiting} onChange={e=>void change('/printers/'+p.id+'/collector','PUT',{collector:e.target.value||null})}><option value="">Selecione o computador da loja</option>{data.collectors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>:"Coleta em desenvolvimento"}</td><td>{job?labels[job.status]:"Sem solicitação"}{job?.received_at&&<div>{date(job.received_at)}</div>}</td><td><EquipmentAudit kind="printers" id={p.id}/>{admin&&<><button onClick={()=>setEditor(p.id)}>Editar</button><button disabled={busy} onClick={()=>{if(window.confirm("Remover "+p.label+" e cancelar coletas pendentes? O histórico será preservado."))void change("/printers/"+p.id,"DELETE");}}>Remover impressora</button></>}</td></tr>;})}
    </tbody></table></div>{!data.printers.length&&<p>Nenhuma impressora cadastrada.</p>}</>}</section>;
}
