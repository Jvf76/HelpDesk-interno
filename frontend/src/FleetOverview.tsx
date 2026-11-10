import {useEffect,useState} from "react";
import {api,date} from "./api";
type Point=Record<string,any>;
type Series={key:string;label:string;color:string};
export type ChartRange={from:string;to:string};
export function SeriesChart({title,points,series,percent=false,onZoom,range}:{title:string;points:Point[];series:Series[];percent?:boolean;onZoom?:(range:ChartRange)=>void;range?:ChartRange|null}){
 const [hover,setHover]=useState<Point|null>(null);
 useEffect(()=>setHover(null),[points]);
 const valid=points.filter(p=>Number.isFinite(Date.parse(p.observed_at))).sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at));
 const all=valid.flatMap(p=>series.map(s=>p[s.key]).filter(v=>typeof v==="number"&&Number.isFinite(v)));
 const max=percent?100:Math.max(1,...all),start=range?Date.parse(range.from):valid.length?Date.parse(valid[0].observed_at):0,end=range?Date.parse(range.to):valid.length?Date.parse(valid.at(-1)!.observed_at):start,span=Math.max(1,end-start);
 const x=(p:Point)=>64+(Date.parse(p.observed_at)-start)/span*664,y=(v:number)=>232-v/max*200;
 const timestamp=(v:string)=>new Date(v).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
 const zoom=(p:Point)=>{if(!onZoom||span<=60000)return;const width=Math.max(60000,span/4),center=Date.parse(p.observed_at),from=Math.max(start,Math.min(center-width/2,end-width));onZoom({from:new Date(from).toISOString(),to:new Date(from+width).toISOString()});};
 const nearest=(e:React.MouseEvent<SVGSVGElement>)=>{const matrix=e.currentTarget.getScreenCTM();if(!matrix)return null;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()),time=start+(point.x-64)/664*span;return valid.reduce<Point|null>((best,p)=>!best||Math.abs(Date.parse(p.observed_at)-time)<Math.abs(Date.parse(best.observed_at)-time)?p:best,null);};

 return <section className="mon-card mon-series"><h3>{title}</h3><div className="mon-legend">{series.map(s=><span key={s.key}><i style={{borderTop:`3px ${s.key==="memory_pct"?"dashed":"solid"} ${s.color}`}}/>{s.label}</span>)}</div>
 {all.length===0?<p className="mon-series-empty">Sem dados recebidos neste período.</p>:<><svg viewBox="0 0 760 280" role="img" aria-label={title} onMouseMove={e=>setHover(nearest(e))} onMouseLeave={()=>setHover(null)} onClick={e=>{const p=nearest(e);if(p)zoom(p);}}>
 {[0,.25,.5,.75,1].map(f=><g key={f}><line className="mon-grid-line" x1="64" x2="728" y1={y(max*f)} y2={y(max*f)}/><text x="54" y={y(max*f)+4} textAnchor="end">{(max*f).toLocaleString("pt-BR",{maximumFractionDigits:1})}{percent?"%":""}</text></g>)}
 {hover&&<line x1={x(hover)} x2={x(hover)} y1="32" y2="232" stroke="currentColor" opacity=".4" strokeDasharray="4 4"/>}
 {series.map(s=>{let fresh=true;const path=valid.map(p=>{if(typeof p[s.key]!=="number"){fresh=true;return "";}const command=fresh?"M":"L";fresh=false;return command+x(p)+","+y(p[s.key]);}).join(" ");return <g key={s.key}><path d={path} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.key==="memory_pct"?"6 4":undefined}/>{valid.map((p,i)=>typeof p[s.key]==="number"?<circle key={i} cx={x(p)} cy={y(p[s.key])} r="4" fill={s.color} tabIndex={0} role="button" aria-label={timestamp(p.observed_at)+" · "+s.label+": "+p[s.key]+". Ampliar período"} onFocus={()=>setHover(p)} onBlur={()=>setHover(null)} onClick={e=>{e.stopPropagation();zoom(p);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();zoom(p);}}}><title>{timestamp(p.observed_at)} · {s.label}: {p[s.key]}{percent?"%":" computadores"}</title></circle>:null)}</g>;})}
 <text x="64" y="266">{new Date(start).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</text><text x="728" y="266" textAnchor="end">{new Date(end).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</text></svg><div className="mon-chart-reading" role="status">{hover?<><strong>{timestamp(hover.observed_at)}</strong><br/>{series.map(s=>s.label+": "+(typeof hover[s.key]==="number"?hover[s.key].toLocaleString("pt-BR",{maximumFractionDigits:1})+(percent?"%":" computadores"):"sem dados")).join(" · ")}</>:"Passe o cursor para consultar data, hora e valores. Clique ou pressione Enter em um ponto para ampliar."}</div></>}</section>;
}
export function ChartNavigation({range,onBack,onReset}:{range:ChartRange|null;onBack:()=>void;onReset:()=>void}){return range?<div className="mon-actions"><span>Período ampliado: {date(range.from)} — {date(range.to)} (horário local)</span><button onClick={onBack}>Voltar período</button><button onClick={onReset}>Restaurar período completo</button></div>:null;}
export function MetricHistoryChart({endpoint,title,series,percent=false,periodLabel="Período"}:{endpoint:string;title:string;series:Series[];percent?:boolean;periodLabel?:string}) {
 const [period,setPeriod]=useState("1"),[ranges,setRanges]=useState<ChartRange[]>([]),[retry,setRetry]=useState(0);
 const range=ranges.at(-1)||null;
 const [data,setData]=useState<{points:Point[];range:ChartRange;resolution:string;truncated:boolean}|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(false);
 useEffect(()=>{
  let alive=true,running=false;setLoading(true);setError(false);
  const load=async()=>{if(running)return;running=true;try{
   const to=range?new Date(range.to):new Date(),from=range?new Date(range.from):new Date(+to-Number(period)*3600000);
   const query={from:from.toISOString(),to:to.toISOString()};
   const result=await api<{points:Point[];resolution:string;truncated:boolean}>(endpoint+"?"+new URLSearchParams(query));
   if(alive){setData({...result,range:query});setError(false);}
  }catch{if(alive)setError(true);}finally{running=false;if(alive)setLoading(false);}};
  void load();const timer=setInterval(()=>void load(),30000);return()=>{alive=false;clearInterval(timer);};
 },[endpoint,period,range,retry]);
 return <div className="mon-metric-panel" role="region" aria-label={title+" — período independente"}>
  <div className="mon-metric-controls"><label>{periodLabel}<select aria-label={periodLabel+" — "+title} value={period} onChange={e=>{setPeriod(e.target.value);setRanges([]);}}>{[["0.25","Últimos 15 minutos"],["1","Última hora"],["6","Últimas 6 horas"],["24","Últimas 24 horas"],["168","Últimos 7 dias"]].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><div className="mon-metric-buttons"><button disabled={!range||loading} onClick={()=>setRanges(v=>v.slice(0,-1))}>Voltar período</button><button disabled={!range||loading} onClick={()=>setRanges([])}>Restaurar período completo</button></div></div>
  <div className="mon-metric-status" aria-live="polite">{error?<span role="alert">Não foi possível atualizar. {data?"Últimos dados preservados.":"Sem dados disponíveis."} <button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></span>:loading?"Atualizando período…":data?.truncated?"Limite de amostras atingido. Reduza o período.":data?.resolution==="hour"?"Médias por hora; contagens consolidadas podem ser fracionárias.":"Selecione uma amostra para ampliar apenas este gráfico."}</div>
  <SeriesChart title={title} points={data?.points||[]} series={series} percent={percent} range={data?.range} onZoom={!loading&&!error?r=>setRanges(v=>[...v,r]):undefined}/>
 </div>;
}
export function FleetOverview(){
 return <section className="mon-observability" aria-label="Monitoramento geral"><div className="mon-charts">
 <MetricHistoryChart endpoint="/monitoring/series" title="Disponibilidade dos computadores" series={[{key:"online",label:"Online",color:"#83e0cf"},{key:"offline",label:"Offline",color:"#c2cbd5"},{key:"silent",label:"Sem comunicação prolongada",color:"#d2b5ff"},{key:"high_usage",label:"Utilização elevada",color:"#ffaaaa"}]}/>
 <MetricHistoryChart endpoint="/monitoring/series" title="Uso médio de recursos" percent series={[{key:"cpu_pct",label:"CPU",color:"#83e0cf"},{key:"memory_pct",label:"Memória",color:"#d2b5ff"}]}/>
 </div></section>;
}
