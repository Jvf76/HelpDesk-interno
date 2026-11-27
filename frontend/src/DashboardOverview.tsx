import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleOff, Monitor, Radio, RefreshCw } from "lucide-react";
import { api } from "./api";
import { DashboardInsights } from "./DashboardInsights";
import { dashboardCounts, formatNumber as number, formatPercent as percent } from "./dashboardData";
import "./dashboard.css";

type Summary = { counts: {state:string; count:number}[]; totals:{total:number; alerts:number|null} };
type Snapshot = { summary:Summary; received:string };

function Failure({ children, retry }: { children: React.ReactNode; retry: () => void }) {
  return <div className="dash-error" role="alert"><AlertTriangle size={20}/><div>{children}</div><button onClick={retry}><RefreshCw size={16}/>Tentar novamente</button></div>;
}

export function DashboardOverview({onOpen}:{onOpen:(id:string)=>void}) {
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [refresh,setRefresh]=useState(0),[updating,setUpdating]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{
    let live=true,timer:ReturnType<typeof setTimeout>;
    async function load(){
      setUpdating(true);
      try {
        const summary=await api<Summary>("/monitoring/summary");
        if(live){setSnapshot({summary,received:new Date().toISOString()});setError(false);}
      } catch {if(live)setError(true);}
      finally {if(live){setUpdating(false);timer=setTimeout(load,30000);}}
    }
    void load();
    return()=>{live=false;clearTimeout(timer);};
  },[refresh]);
  const counts=dashboardCounts(snapshot?.summary.counts||[]);
  const availabilityTotal=counts.online+counts.offline;
  const onlineRatio=snapshot&&availabilityTotal>0?counts.online/availabilityTotal:null;
  const cards=[{label:"Total de computadores",value:snapshot?.summary.totals.total,Icon:Monitor,tone:"",note:"Equipamentos cadastrados"},{label:"Online",value:counts.online,Icon:CheckCircle2,tone:"good",note:"Inclui computadores em sessão"},{label:"Offline",value:counts.offline,Icon:CircleOff,tone:"muted",note:"Inclui cadastros desativados"},{label:"Sessões ativas",value:counts.active,Icon:Radio,tone:"info",note:"Computadores com sessão ativa"},{label:"Com alerta",value:snapshot?.summary.totals.alerts,Icon:AlertTriangle,tone:"warning",note:"Alertas informados pelo servidor"}];
  return <div className="uai-dashboard dash-operations dash-signature">
    <div className="dash-heading"><div><h1>Visão geral</h1><p>Inventário e monitoramento da Uai Telecom.</p></div><div className="dash-update"><span><span className="dash-update-label">Última atualização</span>{snapshot?new Date(snapshot.received).toLocaleTimeString("pt-BR"):"Aguardando dados"}</span><button onClick={()=>{setRefresh(v=>v+1);}} disabled={updating} aria-label="Atualizar dashboard"><RefreshCw size={17}/></button></div></div>
    {error&&<Failure retry={()=>setRefresh(v=>v+1)}>Não foi possível atualizar o dashboard.{snapshot?" Os últimos dados recebidos foram preservados e podem estar desatualizados.":" Verifique a conexão e tente novamente."}</Failure>}
    {!snapshot&&!error&&<p className="dash-loading" role="status">Carregando indicadores…</p>}
    <div className="dash-monitor-grid"><section className="dash-stats" aria-label="Resumo dos computadores" aria-busy={!snapshot&&!error}>{cards.map(({label,value,Icon,tone,note})=><div className={`dash-stat ${tone ? `dash-stat-${tone}` : "dash-stat-total"}`} key={label}><span><Icon size={18} className={tone}/>{label}</span>{snapshot?<strong className={tone}>{number(value)}</strong>:<strong className={!error?"dash-skeleton":""}>{error?"—":"\u00a0"}</strong>}<small className={tone==="good"?"dash-availability-visual":undefined}>{tone==="good"&&onlineRatio!==null?`${percent(onlineRatio*100)} dos computadores`:note}</small></div>)}</section>
<div className="dash-insights-region"><DashboardInsights refresh={refresh} onOpen={onOpen}/></div></div>
  </div>;
}
