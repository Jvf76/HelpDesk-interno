import { useEffect, useState } from "react";
import { api, date, type RemoteSession } from "./api";
import { desktopRequest } from "./desktop";

type Identity = { id: string; name: string; public_code: string; revoked: boolean; mesh_node?:string|null };
export function DeviceApp() {
  const [identity,setIdentity]=useState<Identity|null>(null);
  const [token,setToken]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [incomplete,setIncomplete]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [unavailable,setUnavailable]=useState(false);
  const [connection,setConnection]=useState("Conectando");
  const [history,setHistory]=useState<RemoteSession[]>([]);
  async function refresh() {
    try {
      setUnavailable(false);
      const me=await api<Identity>("/identity","GET",undefined,false);
      setIncomplete(me.mesh_node===null);
      setIdentity(me.mesh_node===null?null:me);
      const local=await desktopRequest("/desktop/device","GET",null,"");
      if(local.ok)setConnection((await local.json()).state);
    } catch(e) {
      const problem=e as Error & {status?:number};
      if(problem.status===401||problem.status===403){setIdentity(null);}
      setConnection("Offline");
      if(problem.status===503||problem.status===495) {
        const local=await desktopRequest("/desktop/device","GET",null,"");
        if(local.ok){const d=await local.json();if(d.registered&&d.code)setIdentity({id:"local-offline",name:d.name,public_code:d.code,revoked:false});else setUnavailable(true);}else setUnavailable(true);
      }
      if(problem.status===401) {
        const local=await desktopRequest("/desktop/device","GET",null,"");
        if(local.ok){const d=await local.json();if(d.error)setError(d.error);else if(d.registered)setError("Credencial revogada ou inválida. Novas conexões estão bloqueadas. Solicite um token de recuperação à administração.");}
      } else setError(problem.message);
    } finally {setLoaded(true);}
  }
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer);},[]);
  async function act(work:()=>Promise<void>) {setBusy(true);setError("");try{await work();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const alert=error&&<div role="alert" className="alert">{error}</div>;
  if(!loaded)return <main className="login"><p>Verificando ativação deste computador…</p></main>;
  if(!identity&&unavailable)return <main className="login"><section className="card"><h1>Uai Suporte</h1>{alert}<p>Não foi possível verificar o cadastro. Nenhuma identidade foi apagada. Verifique o serviço e a conexão antes de tentar novamente.</p><button onClick={()=>void refresh()}>Tentar novamente</button></section></main>;
  if(!identity)return <main className="login"><section className="card">
    <h1>Uai Suporte</h1><p>{incomplete?"Cadastro recebido. Retome o vínculo seguro do componente de acesso remoto.":"Ative este computador. O token é necessário somente uma vez."}</p>
    {alert}<form onSubmit={e=>{e.preventDefault();void act(async()=>{
      const value=token;setToken("");
      const response=await desktopRequest("/desktop/activate","POST",{token:value},"");
      if(!response.ok)throw new Error((await response.json()).message);
      await refresh();
    });}}>
      <label>Token de ativação<input type="password" autoComplete="off" spellCheck={false} value={token} onChange={e=>setToken(e.target.value)} required={!incomplete} maxLength={100}/></label>
      <button disabled={busy||(!token&&!incomplete)}>{busy?"Ativando este computador…":incomplete?"Concluir ativação":"Ativar este computador"}</button>
    </form><p>Se o cadastro foi revogado, solicite um novo token de recuperação à administração.</p>
  </section></main>;
  return <main className="device-app"><header><h1>Uai Suporte</h1><p>{identity.name} · {connection}</p></header>{alert}
    <div className="connection-grid"><section className="card"><h2>Seu código</h2><p className="device-code">{identity.public_code?.match(/.{1,4}/g)?.join(" ")}</p><p>Compartilhe este código. Todo acesso exige sua autorização neste computador.</p><button onClick={()=>void desktopRequest("/desktop/receiving","POST",null,"")}>Consentimento e encerramento local</button></section>
    </div><section className="card"><h2>Suporte em segundo plano</h2><p>Este aplicativo permite que a equipe autorizada preste suporte a este computador pelo painel web. Você sempre poderá aceitar, recusar e encerrar o acesso.</p><button onClick={()=>void desktopRequest("/desktop/background","POST",null,"")}>Manter na bandeja</button><p>Fechar a janela mantém o Uai Suporte junto ao relógio. Sair da interface mantém o monitoramento pelo serviço. Um atendimento exige a interface aberta na sessão do Windows.</p></section>
    <section className="card"><h2>Histórico deste computador</h2><button onClick={()=>void act(async()=>setHistory(await api<RemoteSession[]>("/connections")))}>Consultar histórico</button>{history.map(s=><p key={s.id}>{date(s.requested_at)} · {s.mode==="VIEW"?"Visualização":"Controle"} · {s.result||s.status}</p>)}</section>
  </main>;
}
