import {useEffect,useRef,useState} from "react";
import {Monitor,Copy,KeyRound,ArrowUpRight,X} from "lucide-react";
import {api} from "./api";
type Row=Record<string,any>;
export function DeviceActions({device,anchor,admin,onClose,onDetail,onConnect,onActivation,onCopied}:{device:Row;anchor:{left:number;top:number};admin:boolean;onClose:()=>void;onDetail:()=>void;onConnect:()=>void;onActivation:()=>void;onCopied:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),[canConnect,setCanConnect]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{const el=ref.current!;el.showModal();let alive=true;void api<Row>("/inventory/"+device.id).then(d=>{if(alive)setCanConnect(d.canConnect&&d.device.online&&!d.device.revoked);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;el.close();};},[device.id]);
 return <dialog ref={ref} className="mon-action-menu" style={{left:Math.max(12,Math.min(anchor.left-260,window.innerWidth-292)),top:Math.max(12,Math.min(anchor.top,window.innerHeight-350))}} aria-label={"Ações de "+device.name} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
 <div className="mon-menu-heading"><b>{device.friendly_name||device.name}</b><button aria-label="Fechar ações" onClick={onClose}><X size={16}/></button></div>
 <button onClick={onDetail}><Monitor size={16}/>Ver detalhes</button>
 <button disabled={loading||!canConnect} onClick={onConnect}><ArrowUpRight size={16}/>{loading?"Verificando permissão…":"Conectar"}</button>
 <button onClick={()=>void navigator.clipboard.writeText(device.public_code||device.id).then(onCopied).catch(()=>setError("Não foi possível copiar. Consulte o código nos detalhes."))}><Copy size={16}/>Copiar código</button>
 {admin&&<button disabled={!device.revoked} title={!device.revoked?"A recuperação exige um cadastro revogado.":"Gerar token para recuperar este cadastro."} onClick={onActivation}><KeyRound size={16}/>Gerar ativação</button>}
 {admin&&!device.revoked&&<small>Este computador já está ativado. Uma nova ativação deste cadastro exige revogação administrativa.</small>}
 {!loading&&!canConnect&&<small>Conexão disponível somente com o computador online e permissão de acesso.</small>}
 {error&&<p role="alert">{error}</p>}</dialog>;
}
