import {useState,type FormEvent} from "react";
import {UserPlus} from "lucide-react";
import {api} from "./api";

export function CreateUser({onCreated}:{onCreated:()=>void}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const values=Object.fromEntries(new FormData(e.currentTarget));
  setBusy(true);setError("");
  try{
   await api("/users","POST",values);
   setMessage(`Usuário ${values.login} criado.`);setOpen(false);onCreated();
  }catch(e){
   const err=e as Error & {status?:number};
   setError(err.status===409?"Esse login já está cadastrado. Escolha outro.":err.message);
  }finally{setBusy(false);}
 }
 return <div className="user-editor"><div className="user-editor-heading"><h1>Usuários</h1>{!open&&<button className="user-primary" onClick={()=>{setMessage("");setError("");setOpen(true);}}><UserPlus size={18} aria-hidden="true"/>Criar usuário</button>}</div>
 {message&&<p role="status">{message}</p>}
 {open&&<form className="user-editor-form" onSubmit={submit}><h2>Novo usuário</h2><div className="mon-filters">
  <label>Nome completo<input name="name" required maxLength={120}/></label>
  <label>Login<input name="login" required autoCapitalize="none" autoComplete="off" pattern="[A-Za-z0-9._@\-]{3,120}" title="De 3 a 120 letras, números ou caracteres . _ @ -"/></label>
  <label>Senha inicial (mínimo de 14 caracteres)<input name="password" type="password" required minLength={14} maxLength={72} autoComplete="new-password"/></label>
  <label>Perfil<select name="role" defaultValue="LEITURA"><option value="LEITURA">Somente leitura</option><option value="OPERADOR">Operador</option><option value="ADMIN">Administrador</option></select></label>
 </div>{error&&<p role="alert">{error}</p>}<div className="user-form-actions">
  <button className="user-primary" disabled={busy}>{busy?"Criando…":"Salvar usuário"}</button>
  <button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</button>
 </div></form>}</div>;
}
