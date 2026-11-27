import {useEffect,useRef,useState} from "react";
import {KeyRound} from "lucide-react";
import {api,type User} from "./api";

export function ResetUserPassword({user}:{user:User}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [temporary,setTemporary]=useState(""),[feedback,setFeedback]=useState("");
 useEffect(()=>{
  if(!open)return;
  const element=dialog.current!;
  element.showModal();
  return ()=>element.close();
 },[open]);
 function close(){
  dialog.current?.close();setOpen(false);setTemporary("");setFeedback("");
 }
 async function reset(){
  setBusy(true);setFeedback("");
  try{
   const result=await api<{temporaryPassword:string}>("/users/"+user.id+"/reset-password","POST");
   setTemporary(result.temporaryPassword);
  }catch(e){setFeedback((e as Error).message);}
  finally{setBusy(false);}
 }
 async function copy(){
  try{await navigator.clipboard.writeText(temporary);setFeedback("Senha temporária copiada.");}
  catch{setFeedback("Selecione a senha e copie manualmente.");}
 }
 return <>
  <button aria-haspopup="dialog" onClick={()=>setOpen(true)}><KeyRound size={16} aria-hidden="true"/>Redefinir senha</button>
  {open&&<dialog ref={dialog} className="equipment-audit-dialog password-reset-dialog" aria-labelledby={'reset-'+user.id}
   onCancel={e=>{e.preventDefault();if(!busy)close();}}>
   <header><h2 id={'reset-'+user.id}>Redefinir senha de {user.login}</h2></header>
   <div className="equipment-audit-body">{temporary?<>
    <p>Copie a senha e entregue a {user.name}. Ela só aparece nesta janela. No próximo acesso, o usuário deverá escolher uma nova senha.</p>
    <label>Senha temporária<input readOnly value={temporary} onFocus={e=>e.target.select()} autoComplete="off" spellCheck={false}/></label>
   </>:<p>A senha atual deixará de funcionar e os logins ativos dessa conta serão encerrados.</p>}
   {feedback&&<p role="status">{feedback}</p>}</div>
   <footer>{temporary?<><button onClick={close}>Fechar</button><button className="user-primary" onClick={()=>void copy()}>Copiar senha</button></>
    :<><button disabled={busy} onClick={close}>Cancelar</button><button className="user-primary" disabled={busy} onClick={()=>void reset()}>{busy?"Gerando…":"Gerar senha temporária"}</button></>}</footer>
  </dialog>}
 </>;
}
