import {History} from "lucide-react";
import type {ReactNode} from "react";
import {useEffect,useId,useRef,useState} from "react";
import {api,date} from "./api";

type Kind="computers"|"printers";
type Event={actor_login?:string|null;action:string;changed_at:string;before_value:string|null;after_value:string|null};
type Removed={id:string;name:string;code?:string};
const actions:Record<string,string>={
 DEVICE_CREATED:"Computador cadastrado",DEVICE_ACTIVATED:"Computador cadastrado por ativação",DEVICE_REACTIVATED:"Computador reativado",
 DEVICE_REMOVED:"Computador removido",DEVICE_REVOKED:"Credencial revogada",DEVICE_RECOVERY_ISSUED:"Recuperação solicitada",
 DEVICE_UNREGISTERED_LOCALLY:"Cadastro desativado no computador",PERMISSION_GRANTED:"Permissão concedida",PERMISSION_REVOKED:"Permissão revogada",
 PRINTER_CREATED:"Impressora cadastrada",PRINTER_REMOVED:"Impressora removida",collector:"Coletor alterado",label:"Nome da impressora",serial:"Número de série",
 friendly_name:"Nome do computador",store_name:"Loja",responsible:"Colaborador",city:"Cidade",department:"Setor",notes:"Observações",owner_id:"Responsável"
};

type Equipment = {kind:Kind; id:string; name:string; code?:string|null};

export function EquipmentAudit({beforeAction,afterAction,shortLabel=false,...equipment}:Equipment & {
 beforeAction?:ReactNode; afterAction?:ReactNode; shortLabel?:boolean;
}){
 const [open,setOpen]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null);
 return <div className="equipment-audit-actions">{beforeAction}
  <button ref={trigger} aria-haspopup="dialog" aria-label={shortLabel?`Auditoria de ${equipment.name}`:undefined}
   onClick={()=>setOpen(true)}>{shortLabel?"Auditoria":"Auditoria do equipamento"}</button>
  {afterAction}
  {open&&<AuditDialog {...equipment} onClose={()=>{setOpen(false);trigger.current?.focus();}}/>}
 </div>;
}

function AuditEntry({event}:{event:Event}){
 const activation=["DEVICE_ACTIVATED","DEVICE_REACTIVATED"].includes(event.action);
 const account=event.actor_login||"Conta não registrada";
 const author=event.action==="DEVICE_UNREGISTERED_LOCALLY"?"Aplicativo local":activation?`Ativação local · Token autorizado por: ${account}`:account;
 return <>
      <strong>{actions[event.action]||event.action}</strong>
      <p><time dateTime={event.changed_at}>{date(event.changed_at)}</time> · {author}</p>
      {(event.before_value!==null||event.after_value!==null)&&<dl>
       <div><dt>Antes</dt><dd>{event.before_value||"—"}</dd></div>
       <div><dt>Depois</dt><dd>{event.after_value||"—"}</dd></div>
      </dl>}
 </>;
}

function AuditDialog({kind,id,name,code,onClose}:Equipment & {onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),title=useId();
 const [page,setPage]=useState(0),[rows,setRows]=useState<Event[]|null>(null);
 const [error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const element=dialog.current!;
  element.showModal();
  return ()=>element.close();
 },[]);
 useEffect(()=>{
  let live=true;setRows(null);setError(false);
  api<Event[]>(`/equipment-history/${kind}/${encodeURIComponent(id)}/events?page=${page}`)
   .then(data=>{if(live)setRows(data);}).catch(()=>{if(live)setError(true);});
  return ()=>{live=false;};
 },[page,kind,id,retry]);
 function close(){dialog.current?.close();onClose();}
 return <dialog ref={dialog} className="equipment-audit-dialog" aria-labelledby={title} onCancel={event=>{event.preventDefault();event.stopPropagation();close();}}>
  <header><div><small>{kind==="computers"?"Computador":"Impressora"} · {code||id}</small>
   <h2 id={title}>Auditoria de {name}</h2></div><button type="button" onClick={close}>Fechar</button></header>
  <div className="equipment-audit-body">
   {error?<p role="alert">Falha ao consultar a auditoria. <button onClick={()=>setRetry(x=>x+1)}>Tentar novamente</button></p>
    :rows===null?<p role="status">Carregando registros…</p>
    :!rows.length?<p>Nenhum evento de cadastro disponível.</p>
    :<ol>{rows.slice(0,50).map((event,index)=><li key={index}>
      <AuditEntry event={event}/>
     </li>)}</ol>}
  </div>
  {(page>0||(rows?.length??0)>50)&&<footer><button disabled={!page} onClick={()=>setPage(n=>n-1)}>Anterior</button>
   <span>Página {page+1}</span><button disabled={(rows?.length??0)<=50} onClick={()=>setPage(n=>n+1)}>Próxima</button></footer>}
 </dialog>;
}

type ComputerEvent = Removed & Event;

export function ComputerHistory({revision}:{revision:number}){
 const [open,setOpen]=useState(false);
 return <div className="mon-actions"><button aria-haspopup="dialog" onClick={()=>setOpen(true)}>
  <History size={18} aria-hidden="true"/>Histórico de alterações
 </button>{open&&<ComputerHistoryDialog revision={revision} onClose={()=>setOpen(false)}/>}</div>;
}

function ComputerHistoryDialog({revision,onClose}:{revision:number;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),title=useId();
 const [page,setPage]=useState(0),[retry,setRetry]=useState(0);
 const [rows,setRows]=useState<ComputerEvent[]|null>(null),[error,setError]=useState(false);
 useEffect(()=>{
  const element=dialog.current!;
  element.showModal();
  return ()=>element.close();
 },[]);
 useEffect(()=>{
  let live=true;setRows(null);setError(false);
  api<ComputerEvent[]>(`/equipment-history/computers/events?page=${page}`)
   .then(data=>{if(live)setRows(data);}).catch(()=>{if(live)setError(true);});
  return ()=>{live=false;};
 },[page,revision,retry]);
 const grouped=new Map<string,ComputerEvent[]>();
 for(const row of rows??[]){
  const events=grouped.get(row.id);
  if(events)events.push(row);else grouped.set(row.id,[row]);
 }
 function close(){dialog.current?.close();onClose();}
 return <dialog ref={dialog} className="equipment-audit-dialog" aria-labelledby={title} onCancel={e=>{e.preventDefault();close();}}>
  <header><div><small>Computadores</small><h2 id={title}>Histórico de alterações</h2></div><button onClick={close}>Fechar</button></header>
  <div className="equipment-audit-body">
   {error?<p role="alert">Falha ao carregar o histórico. <button onClick={()=>setRetry(n=>n+1)}>Tentar novamente</button></p>
    :rows===null?<p role="status">Carregando alterações…</p>
    :!rows.length?<p>Nenhuma alteração registrada.</p>
    :Array.from(grouped.entries()).slice(0,10).map(([id,events])=><section className="computer-change-group" key={id}>
      <h3>{events[0].name}</h3><small>{events[0].code||id}</small>
      <ol>{events.map((event,index)=><li key={index}><AuditEntry event={event}/></li>)}</ol>
     </section>)}
  </div>
  {(page>0||grouped.size>10)&&<footer><button disabled={!page} onClick={()=>setPage(n=>n-1)}>Anterior</button>
   <span>Página {page+1}</span><button disabled={grouped.size<=10} onClick={()=>setPage(n=>n+1)}>Próxima</button></footer>}
 </dialog>;
}

export function RemovedEquipment({kind,revision=0}:{kind:Kind;revision?:number}){
 const [open,setOpen]=useState(false),[rows,setRows]=useState<Removed[]|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!open)return;let live=true;setRows(null);setError(false);
  api<Removed[]>('/equipment-history/'+kind+'/removed').then(data=>{if(live)setRows(data);}).catch(()=>{if(live)setError(true);});
  return()=>{live=false;};
 },[kind,open,revision,retry]);
 return <div className="mon-actions"><div><button aria-expanded={open} onClick={()=>setOpen(!open)}>{kind==="computers"?"Computadores removidos":"Impressoras removidas"}</button>
 {open&&(error?<p role="alert">Falha ao consultar equipamentos removidos. <button onClick={()=>setRetry(x=>x+1)}>Tentar novamente</button></p>:rows===null?<p>Carregando…</p>:rows.length?<ul>{rows.map(row=><li key={row.id}><b>{row.name}</b> {row.code}<EquipmentAudit kind={kind} id={row.id} name={row.name} code={row.code} shortLabel/></li>)}</ul>:<p>Nenhum equipamento removido.</p>)}</div></div>;
}
