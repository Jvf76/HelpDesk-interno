import { useEffect,useRef,useState } from "react";
import { api,type RemoteSession } from "./api";
function sessionMessage(s:RemoteSession){
 if(s.result==="ENGINE_CONSENT_TIMEOUT")return "A confirmação no computador acessado expirou. Solicite uma nova tentativa.";
 const states:Record<string,string>={
  ENGINE_CONSENT_PENDING:"Aguardando confirmação no computador acessado",
  AWAITING_CONSENT:"Aguardando confirmação no computador acessado",
  AWAITING_FIRST_FRAME:"Acesso autorizado — aguardando imagem",
  AWAITING_FRAME:"Acesso autorizado — aguardando imagem",
  VIEWING:"Visualização ativa",CONTROLLING:"Controle ativo"
 };
 return states[s.phase||s.status]||s.safe_message||(s.ended_at?"Encerrada · "+s.result:s.status==="PENDING"?"Aguardando consentimento no computador acessado":s.status==="CONSENTED"?"Consentimento Uai recebido; aguardando o motor":s.status);
}
export function WebSession({code,csrf,onClose}:{code:string;csrf:string;onClose:()=>void}){
 const [session,setSession]=useState<RemoteSession|null>(null),[bootstrap,setBootstrap]=useState<Record<string,unknown>|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const frame=useRef<HTMLIFrameElement>(null),id=useRef<string|null>(null),launching=useRef(false),stopped=useRef(false);
 async function stop(){stopped.current=true;setBootstrap(null);if(id.current)try{setSession(await api<RemoteSession>("/sessions/"+id.current+"/stop","POST",{}));}catch{setError("Visualizador fechado. A confirmação do encerramento no servidor está pendente.");}}
 useEffect(()=>()=>{stopped.current=true;if(id.current)void fetch("/api/sessions/"+id.current+"/stop",{method:"POST",credentials:"same-origin",keepalive:true,headers:{"Content-Type":"application/json","X-CSRF-Token":csrf},body:"{}"}).catch(()=>{});},[csrf]);
 useEffect(()=>{if(!session||session.ended_at)return;const timer=setInterval(()=>void api<RemoteSession>("/sessions/"+session.id).then(s=>{
  setSession(s);if(s.ended_at||["STOPPING","UNVERIFIED"].includes(s.status)||["FAILED","EXPIRED","REVOKED","CONSENT_REJECTED","STOP_REQUESTED","ENGINE_STOPPING"].includes(s.phase||"")){stopped.current=true;setBootstrap(null);}
 }).catch(()=>{setError("Comunicação com o servidor perdida. Tentativa encerrada.");void stop();}),2000);return()=>clearInterval(timer);},[session?.id,session?.ended_at]);
 // One launch per attempt; a delayed HTTP response cannot reopen a stopped viewer.
 useEffect(()=>{if(session?.status!=="CONSENTED"||launching.current||stopped.current)return;
  launching.current=true;setBusy(true);
  void api<Record<string,unknown>>("/sessions/"+session.id+"/launch","POST",{}).then(data=>{if(!stopped.current)setBootstrap(data);}).catch(()=>{setError("Não foi possível autorizar o motor remoto. Solicite uma nova tentativa.");void stop();}).finally(()=>setBusy(false));
 },[session?.id,session?.status]);
 useEffect(()=>{const message=(e:MessageEvent)=>{if(e.origin!==location.origin||e.source!==frame.current?.contentWindow||!e.data?.uaiViewer)return;
  if(e.data.kind==="engine-consent-timeout"){setError("A confirmação no computador acessado expirou. Solicite uma nova tentativa.");void stop();}
  else if(e.data.kind==="connection-timeout"){setError("A etapa de conexão excedeu o prazo. Consulte o diagnóstico desta tentativa.");void stop();}
  else if(["stop","disconnected"].includes(e.data.kind))void stop();
 };window.addEventListener("message",message);return()=>window.removeEventListener("message",message);},[]);
 return <section className="mon-card"><h2>Atendimento remoto · {code}</h2><p>O computador acessado precisa estar ativado e aceitar localmente. Este navegador somente controla a sessão.</p>{error&&<p role="alert">{error}</p>}
 {!session&&<button disabled={busy} onClick={()=>{stopped.current=false;setBusy(true);void api<RemoteSession>("/connections","POST",{code,mode:"CONTROL"}).then(s=>{id.current=s.id;setSession(s);}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Conectar</button>}
 {session&&<><p role="status">{sessionMessage(session)}</p><small>Tentativa: {session.id}</small></>}
 {bootstrap&&<iframe title="Atendimento remoto" ref={frame} src="/remote-viewer/index.html" sandbox="allow-scripts allow-same-origin" allow="fullscreen" onLoad={()=>frame.current?.contentWindow?.postMessage({uaiViewer:true,payload:{action:"start",...bootstrap}},location.origin)}/>}
 <button onClick={()=>void stop()}>Encerrar acesso</button><button onClick={()=>{void stop();onClose();}}>Fechar atendimento</button></section>;
}
