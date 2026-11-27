import type {ReactNode} from "react";
import {useEffect,useState} from "react";
import {api,date} from "./api";

type Kind="computers"|"printers";
type Event={action:string;changed_at:string;before_value:string|null;after_value:string|null};
type Removed={id:string;name:string;code?:string};
const actions:Record<string,string>={
 DEVICE_CREATED:"Computador cadastrado",DEVICE_ACTIVATED:"Computador cadastrado por ativação",DEVICE_REACTIVATED:"Computador reativado",
 DEVICE_REMOVED:"Computador removido",DEVICE_REVOKED:"Credencial revogada",DEVICE_RECOVERY_ISSUED:"Recuperação solicitada",
 DEVICE_UNREGISTERED_LOCALLY:"Cadastro desativado no computador",PERMISSION_GRANTED:"Permissão concedida",PERMISSION_REVOKED:"Permissão revogada",
 PRINTER_CREATED:"Impressora cadastrada",PRINTER_REMOVED:"Impressora removida",collector:"Coletor alterado",label:"Nome da impressora",serial:"Número de série",
 friendly_name:"Nome do computador",store_name:"Loja",responsible:"Colaborador",city:"Cidade",department:"Setor",notes:"Observações",owner_id:"Responsável"
};

export function EquipmentAudit({kind,id,beforeAction,afterAction}:{kind:Kind;id:string;beforeAction?:ReactNode;afterAction?:ReactNode}){
 const [open,setOpen]=useState(false),[page,setPage]=useState(0),[rows,setRows]=useState<Event[]|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!open)return;
  let live=true;setRows(null);setError(false);
  api<Event[]>(`/equipment-history/${kind}/${encodeURIComponent(id)}/events?page=${page}`).then(data=>{if(live)setRows(data);}).catch(()=>{if(live)setError(true);});
  return()=>{live=false;};
 },[open,page,kind,id,retry]);
 return <div><div className="equipment-audit-actions">{beforeAction}<button aria-expanded={open} onClick={()=>{setOpen(!open);setPage(0);}}>Auditoria do equipamento</button>{afterAction}</div>
 {open&&<div>{error?<p role="alert">Falha ao consultar a auditoria. <button onClick={()=>setRetry(x=>x+1)}>Tentar novamente</button></p>:rows===null?<p role="status">Carregando registros…</p>:<>
 {rows.length?<ol>{rows.slice(0,50).map((e,i)=><li key={i}><strong>{actions[e.action]||e.action}</strong> · {date(e.changed_at)}
 <small>{e.action==="DEVICE_UNREGISTERED_LOCALLY"?"Aplicativo local":"Equipe de TI"}</small>
 {(e.before_value!==null||e.after_value!==null)&&<div>{e.before_value||"—"} → {e.after_value||"—"}</div>}</li>)}</ol>:<p>Nenhum evento de cadastro disponível.</p>}
 {(page>0||rows.length>50)&&<div><button disabled={!page} onClick={()=>setPage(x=>x-1)}>Anterior</button><button disabled={rows.length<=50} onClick={()=>setPage(x=>x+1)}>Próxima</button></div>}</>}</div>}</div>;
}

export function RemovedEquipment({kind,revision=0}:{kind:Kind;revision?:number}){
 const [open,setOpen]=useState(false),[rows,setRows]=useState<Removed[]|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!open)return;let live=true;setRows(null);setError(false);
  api<Removed[]>('/equipment-history/'+kind+'/removed').then(data=>{if(live)setRows(data);}).catch(()=>{if(live)setError(true);});
  return()=>{live=false;};
 },[kind,open,revision,retry]);
 return <div className="mon-actions"><div><button aria-expanded={open} onClick={()=>setOpen(!open)}>{kind==="computers"?"Computadores removidos":"Impressoras removidas"}</button>
 {open&&(error?<p role="alert">Falha ao consultar equipamentos removidos. <button onClick={()=>setRetry(x=>x+1)}>Tentar novamente</button></p>:rows===null?<p>Carregando…</p>:rows.length?<ul>{rows.map(row=><li key={row.id}><b>{row.name}</b> {row.code}<EquipmentAudit kind={kind} id={row.id}/></li>)}</ul>:<p>Nenhum equipamento removido.</p>)}</div></div>;
}
