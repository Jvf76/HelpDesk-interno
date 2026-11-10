import {useEffect,useState} from "react";
import {Monitor, CircleOff, RefreshCw} from "lucide-react";
import {api} from "./api";
import {dashboardCounts,type StateCount} from "./dashboardData";
export function ComputerAvailability(){
 const [snapshot,setSnapshot]=useState<{online:number;offline:number;received:string}|null>(null);
 const [error,setError]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true,running=false;const load=async()=>{if(running)return;running=true;try{const result=await api<{counts:StateCount[]}>("/monitoring/summary");if(!Array.isArray(result.counts)||result.counts.some(c=>!Number.isSafeInteger(c.count)||c.count<0))throw new Error("Invalid counts");const counts=dashboardCounts(result.counts);if(alive){setSnapshot({...counts,received:new Date().toLocaleTimeString("pt-BR")});setError(false);}}catch{if(alive)setError(true);}finally{running=false;if(alive)setLoading(false);}};void load();const timer=setInterval(()=>void load(),30000);return()=>{alive=false;clearInterval(timer);};},[retry]);
 return <section className="mon-card mon-current-availability" aria-label="Computadores online e offline"><div className="mon-list-title"><div><h2>Computadores online e offline</h2><p>Estado atual dos equipamentos cadastrados. Atualização a cada 30 segundos.</p></div><button aria-label="Atualizar disponibilidade" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={17}/>Atualizar</button></div>
 {error&&<p role="alert">Não foi possível atualizar a disponibilidade. {snapshot?"As contagens abaixo são da última atualização recebida.":"Tente novamente para consultar as contagens."} <button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></p>}
 <div className="mon-availability-counts" aria-busy={loading}><div><span><Monitor size={22}/>Online</span><strong>{snapshot?snapshot.online.toLocaleString("pt-BR"):"—"}</strong><p>Computadores com comunicação recente, incluindo os que estão em sessão.</p></div><div><span><CircleOff size={22}/>Offline</span><strong>{snapshot?snapshot.offline.toLocaleString("pt-BR"):"—"}</strong><p>Computadores sem comunicação recente ou com cadastro desativado.</p></div></div>
 <p className="mon-availability-updated" role="status">{snapshot?`Última atualização recebida às ${snapshot.received}.`:loading?"Carregando disponibilidade…":"Contagens indisponíveis."}</p>
 </section>;
}
