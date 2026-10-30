import { useState } from "react";
import { api, type Device } from "./api";
export function ActivationAdmin({devices,initialRecovery}:{devices:Device[];initialRecovery?:string}) {
 const [recovery,setRecovery]=useState(initialRecovery||"");
 const [minutes,setMinutes]=useState(10),[token,setToken]=useState(""),[id,setId]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 return <section className="card"><h2>Ativação de computadores</h2><p>Uso administrativo. Entregue o token somente à pessoa autorizada. Ele será exibido uma vez e não é o código público do computador.</p>
 {error&&<p role="alert">{error}</p>}<label>Destino da ativação<select disabled={!!initialRecovery} value={recovery} onChange={e=>setRecovery(e.target.value)}><option value="">Novo computador</option>{devices.filter(d=>d.revoked).map(d=><option key={d.id} value={d.id}>Recuperar {d.name} — preservar código</option>)}</select></label><label>Validade em minutos<input type="number" min={1} max={60} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label>
 <button disabled={busy} onClick={()=>{if(recovery&&!window.confirm("Gerar ativação de uso único para recuperar este cadastro e preservar seu código público?"))return;setBusy(true);setError("");setToken("");void api<{id:string;token:string}>("/activation-tokens","POST",{lifetimeSeconds:minutes*60,...(recovery?{recoverDeviceId:recovery}:{})}).then(r=>{setToken(r.token);setId(r.id);}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Gerar token de ativação</button>
 {token&&<><label>Token de ativação — copie e entregue com segurança<input readOnly value={token} autoComplete="off" spellCheck={false}/></label><button onClick={()=>setToken("")}>Ocultar token</button></>}
 {id&&<button disabled={busy} onClick={()=>{setBusy(true);void api("/activation-tokens/"+id+"/revoke","POST",{}).then(()=>{setToken("");setId("");}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Revogar token emitido</button>}
 </section>;
}
