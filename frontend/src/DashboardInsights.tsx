import { useEffect, useState } from "react";
import { History, Monitor, Printer } from "lucide-react";
import { api, date } from "./api";
import { formatPercent } from "./dashboardData";
import "./insights.css";

type Day = {day:string; cpu:number|null; ram:number|null};
type Insights = {
  daily:Day[];
  activity:{kind:keyof typeof events; name:string; at_time:string}[];
  top:{id:string; name:string; cpu_pct:number|null; memory_pct:number}[];
  health:{condition_name:string; count:number}[];
};
const events={requested:"Acesso solicitado",connected:"Conexão iniciada",report:"Relatório recebido",failed:"Falha na coleta",collection:"Coleta solicitada"};
const conditions=[
  {key:"normal",label:"Normal",color:"var(--health-normal)"},
  {key:"attention",label:"Atenção",color:"var(--health-attention)"},
  {key:"critical",label:"Crítico",color:"var(--health-critical)"},
  {key:"unknown",label:"Sem avaliação",color:"var(--health-unknown)"}
];
function Health({rows}:{rows:Insights["health"]}){
  const counts=new Map(rows.map(row=>[row.condition_name,Number(row.count)]));
  const total=rows.reduce((n,row)=>n+Number(row.count),0);
  let offset=0;
  return <><div className="health-summary"><div className="health-wheel">
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="41" fill="none" stroke="var(--dash-line)" strokeWidth="12"/>
      {conditions.map(c=>{const value=counts.get(c.key)??0;if(!value)return null;
        const length=value*100/total,start=offset;offset+=length;
        return <circle key={c.key} cx="50" cy="50" r="41" transform="rotate(-90 50 50)" pathLength="100" fill="none" stroke={c.color} strokeWidth="12" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start}/>;
      })}</svg><b>{total}</b></div>
    <ul>{conditions.map(c=><li key={c.key}><i style={{background:c.color}}/>{c.label}<b>{counts.get(c.key)??0}</b></li>)}</ul></div>
    <details><summary>Critérios de saúde</summary><p>Crítico indica erro persistente do agente. Atenção indica CPU, memória ou disco fora dos limites configurados. Equipamentos offline, desativados ou sem telemetria suficiente ficam sem avaliação.</p></details></>;
}
function DailyBars({rows}:{rows:Day[]}){
  if(!rows.some(d=>d.cpu!==null||d.ram!==null))return <p>Sem amostras no período.</p>;
  function peak(key:"cpu"|"ram"){
    const best=rows.reduce<Day|null>((highest,row)=>row[key]!==null&&(!highest||row[key]!>highest[key]!)?row:highest,null);
    return best?`${formatPercent(best[key])} em ${best.day.slice(8,10)}/${best.day.slice(5,7)}`:"Sem medição";
  }
  return <><div className="peaks-key"><span>CPU · {peak("cpu")}</span><span>RAM · {peak("ram")}</span></div>
    <div className="peak-plot"><div className="peak-axis" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div><div className="peaks-scroll" tabIndex={0} aria-label="Picos por data, em porcentagem">
    <div className="peaks-bars">{rows.map(d=><div className="peak-day" key={d.day} title={`${d.day} · CPU ${formatPercent(d.cpu)} · RAM ${formatPercent(d.ram)}`}>
      <div aria-hidden="true"><i style={{height:`${d.cpu??0}%`}}/><i style={{height:`${d.ram??0}%`}}/></div>
      <time dateTime={d.day}>{d.day.slice(8,10)}/{d.day.slice(5,7)}</time></div>)}</div></div></div>
    <details><summary>Valores por dia</summary><ul>{rows.map(d=><li key={d.day}>{d.day.slice(8,10)}/{d.day.slice(5,7)} · CPU {formatPercent(d.cpu)} · RAM {formatPercent(d.ram)}</li>)}</ul></details></>;
}
export function DashboardInsights({onOpen,refresh}:{refresh:number;onOpen:(id:string)=>void}){
  const [allEvents,setAllEvents]=useState(false);
  const [days,setDays]=useState(7),[reload,setReload]=useState(0);
  const [data,setData]=useState<Insights|null>(null),[error,setError]=useState(false);
  useEffect(()=>{
    let live=true,timer:ReturnType<typeof setTimeout>;
    setData(null);setError(false);
    async function load(){
      try{const result=await api<Insights>("/monitoring/insights?days="+days);if(live){setData(result);setError(false);}}
      catch{if(live)setError(true);}
      if(live)timer=setTimeout(load,30000);
    }
    void load();return()=>{live=false;clearTimeout(timer);};
  },[days,reload,refresh]);
  if(error)return <div className="dash-error" role="alert">Não foi possível atualizar atividades e indicadores. <button onClick={()=>setReload(n=>n+1)}>Tentar novamente</button></div>;
  if(!data)return <p role="status">Carregando atividades e indicadores…</p>;
  return <div className="overview-insights">
    <section className="insight-feed"><h2>Atividades recentes</h2><p>Acessos remotos e relatórios de impressoras</p>
      {data.activity.length?<ol>{data.activity.slice(0,allEvents?undefined:5).map((e,i)=><li key={e.at_time+i}>
        {e.kind==="connected"||e.kind==="requested"?<Monitor size={17}/>:<Printer size={17}/>}
        <div><strong>{events[e.kind]}</strong><span>{e.name}</span><time>{date(e.at_time)}</time></div></li>)}</ol>:<p><History size={16}/> Nenhuma atividade registrada.</p>}{data.activity.length>5&&<button className="feed-toggle" aria-expanded={allEvents} onClick={()=>setAllEvents(!allEvents)}>{allEvents?"Mostrar menos":`Ver todas as ${data.activity.length} atividades`}</button>}</section>
    <section className="insight-peaks"><div className="peaks-heading"><div><h2>Picos diários de CPU e RAM</h2><p>Maior média dos computadores registrada em cada dia · Brasília</p></div>
      <div className="peak-period" role="group" aria-label="Período dos picos diários">{[7,30].map(d=><button key={d} aria-pressed={days===d} onClick={()=>setDays(d)}>{d} dias</button>)}</div></div>
      <DailyBars rows={data.daily}/></section>
    <section className="insight-top"><h2>Maior uso de memória</h2><p>Até cinco computadores online · última coleta recente</p>
      {data.top.length?<ol>{data.top.map(d=><li key={d.id}><button onClick={()=>onOpen(d.id)}><span>{d.name}</span><b>{formatPercent(d.memory_pct)}</b></button></li>)}</ol>:<p>Sem medições recentes.</p>}</section>
    <section className="insight-health"><h2>Saúde dos computadores</h2><Health rows={data.health}/></section>
  </div>;
}
