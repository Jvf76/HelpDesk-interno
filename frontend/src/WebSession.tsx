import "./remote-session.css";
import {recordSessionDiagnostic,sessionDiagnostic} from "./sessionDiagnostics";
import { useEffect,useRef,useState } from "react";
import { api,type RemoteSession } from "./api";
function sessionMessage(s:RemoteSession){
 if(s.result==="RENDER_TIMEOUT")return "O computador autorizou o acesso, mas o visualizador não confirmou a exibição da imagem a tempo. A sessão foi encerrada.";
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
 const [diagnosticNotice,setDiagnosticNotice]=useState("");
 const [session,setSession]=useState<RemoteSession|null>(null),[bootstrap,setBootstrap]=useState<Record<string,unknown>|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const viewerActive=useRef(false);
 const [retrying,setRetrying]=useState(false);
 const frame=useRef<HTMLIFrameElement>(null),id=useRef<string|null>(null),launching=useRef(false),stopped=useRef(false),created=useRef(false);
 useEffect(()=>{
  const timer=setTimeout(()=>{
   if(created.current)return;created.current=true;stopped.current=false;setBusy(true);
   void api<RemoteSession>("/connections","POST",{code,mode:"CONTROL"}).then(s=>{
    id.current=s.id;recordSessionDiagnostic(s.id,"REQUEST_CREATED");
    if(stopped.current){void api("/sessions/"+s.id+"/stop","POST",{}).catch(()=>{});return;}
    setSession(s);
   }).catch(()=>setError("Não foi possível solicitar a conexão. Feche o atendimento e tente novamente.")).finally(()=>setBusy(false));
  },0);
  return()=>clearTimeout(timer);
 },[code]);
 async function stop(origin="USER_STOP"){recordSessionDiagnostic(id.current,origin);stopped.current=true;setBootstrap(null);if(id.current)try{setSession(await api<RemoteSession>("/sessions/"+id.current+"/stop","POST",{}));}catch{setError("Visualizador fechado. A confirmação do encerramento no servidor está pendente.");}}
 useEffect(()=>()=>{recordSessionDiagnostic(id.current,"COMPONENT_CLOSED");stopped.current=true;if(id.current)void fetch("/api/sessions/"+id.current+"/stop",{method:"POST",credentials:"same-origin",keepalive:true,headers:{"Content-Type":"application/json","X-CSRF-Token":csrf},body:"{}"}).catch(()=>{});},[csrf]);
 useEffect(()=>{
  if(!session||session.ended_at)return;
  const sessionId=session.id;
  let cancelled=false,pending=false,lastSuccess=performance.now();
  function fail(){
   setRetrying(false);
   setError("Comunicação com o servidor perdida. Tentativa encerrada.");
   void stop("POLL_FAILED");
  }
  const timer=setInterval(async()=>{
   if(cancelled||stopped.current)return;
   if(viewerActive.current&&performance.now()-lastSuccess>=20000){fail();return;}
   if(pending)return;
   pending=true;
   try{
    const s=await api<RemoteSession>("/sessions/"+sessionId);
    if(cancelled||stopped.current)return;
    lastSuccess=performance.now();setRetrying(false);setSession(s);
    if(s.ended_at||["STOPPING","UNVERIFIED"].includes(s.status)||["FAILED","EXPIRED","REVOKED","CONSENT_REJECTED","STOP_REQUESTED","ENGINE_STOPPING"].includes(s.phase||"")){
     recordSessionDiagnostic(sessionId,s.ended_at?"POLL_ENDED":"POLL_BLOCKED");
     stopped.current=true;setBootstrap(null);
    }
   }catch(err){
    if(cancelled||stopped.current)return;
    const status=(err as {status?:number})?.status;
    if(viewerActive.current&&(err instanceof TypeError||[502,503,504].includes(status??0)))setRetrying(true);
    else fail();
   }finally{pending=false;}
  },2000);
  return()=>{cancelled=true;clearInterval(timer);};
 },[session?.id,session?.ended_at]);
 // One launch per attempt; a delayed HTTP response cannot reopen a stopped viewer.
 useEffect(()=>{if(session?.status!=="CONSENTED"||launching.current||stopped.current)return;
  launching.current=true;recordSessionDiagnostic(id.current,"LAUNCH_BEGIN");setBusy(true);
  void api<Record<string,unknown>>("/sessions/"+session.id+"/launch","POST",{}).then(data=>{recordSessionDiagnostic(id.current,"LAUNCH_OK");if(!stopped.current)setBootstrap(data);}).catch(()=>{setError("Não foi possível autorizar o motor remoto. Solicite uma nova tentativa.");void stop("LAUNCH_FAILED");}).finally(()=>setBusy(false));
 },[session?.id,session?.status]);
 useEffect(()=>{const message=(e:MessageEvent)=>{if(e.origin!==location.origin||e.source!==frame.current?.contentWindow||!e.data?.uaiViewer)return;
  if(e.data.kind==="engine-consent-timeout"){setError("A confirmação no computador acessado expirou. Solicite uma nova tentativa.");void stop("NATIVE_TIMEOUT");}
  else if(e.data.kind==="connection-timeout"){setError("A etapa de conexão excedeu o prazo. Consulte o diagnóstico desta tentativa.");void stop("VIEWER_TIMEOUT");}
  else if(['monitors-requested','monitors-empty','monitors-single','monitors-multiple','monitor-selected'].includes(e.data.kind))recordSessionDiagnostic(id.current,e.data.kind.replaceAll('-','_').toUpperCase());
  else if(e.data.kind==="active")viewerActive.current=true;
  else if(e.data.kind==="frame")recordSessionDiagnostic(id.current,"FRAME_DRAWN");
  else if(e.data.kind==="viewer-error"){setError("O controlador encontrou uma falha local. Consulte o diagnóstico desta tentativa.");void stop("VIEWER_ERROR");}
  else if(e.data.kind==="transport-error")recordSessionDiagnostic(id.current,"TRANSPORT_ERROR");
  else if(e.data.kind==="transport-close-normal")recordSessionDiagnostic(id.current,"TRANSPORT_CLOSE_NORMAL");
  else if(e.data.kind==="transport-close-abnormal")recordSessionDiagnostic(id.current,"TRANSPORT_CLOSE_ABNORMAL");
  else if(e.data.kind==="transport-close-other")recordSessionDiagnostic(id.current,"TRANSPORT_CLOSE_OTHER");
  else if(["stop","disconnected"].includes(e.data.kind))void stop(e.data.kind==="stop"?"VIEWER_STOP":"VIEWER_DISCONNECTED");
 };window.addEventListener("message",message);return()=>window.removeEventListener("message",message);},[]);
 return <section className="mon-card remote-session"><div className="remote-session-heading"><div><span className="remote-session-kicker">ÁREA DE ATENDIMENTO</span><h2>Conexão remota</h2></div><span className="remote-session-device">Computador · {code}</span></div>{error&&<p role="alert">{error}</p>}
 {!session&&!error&&<p role="status">Solicitando conexão…</p>}
 {session&&<><p role="status">{sessionMessage(session)}</p><small>Tentativa: {session.id}</small></>}
 {retrying&&bootstrap&&<p role="status">Conexão instável. Tentando confirmar o estado da sessão…</p>}
 {bootstrap&&<iframe title="Atendimento remoto" ref={frame} src={`/remote-viewer/index.html?attempt=${session?.id}`} sandbox="allow-scripts allow-same-origin" allow="fullscreen" onLoad={()=>frame.current?.contentWindow?.postMessage({uaiViewer:true,payload:{action:"start",...bootstrap}},location.origin)}/>}
 <div className="remote-session-actions"><button onClick={()=>void stop()}>Encerrar acesso</button><button onClick={()=>{void stop("USER_CLOSE");onClose();}}>Fechar atendimento</button>
 {session&&<button onClick={()=>void navigator.clipboard.writeText(sessionDiagnostic(id.current)).then(()=>setDiagnosticNotice("Diagnóstico copiado: somente UUID, horários e códigos de evento.")).catch(()=>setDiagnosticNotice("Não foi possível copiar o diagnóstico. Verifique a permissão de área de transferência do navegador."))}>Copiar diagnóstico</button>}
 </div>{diagnosticNotice&&<p role="status">{diagnosticNotice}</p>}</section>;
}
