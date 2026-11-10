import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, CircleOff, Cpu, HardDrive, MemoryStick, Monitor, RefreshCw, Radio } from "lucide-react";
import { api, date } from "./api";
import "./dashboard.css";
import { dashboardCounts, formatNumber as number, formatPercent as percent } from "./dashboardData";

type Computer = { id: string; name: string; friendly_name?: string; public_code?: string; responsible?: string; city?: string; department?: string; online: boolean; revoked?: boolean; cpu_pct?: number | null; memory_pct?: number | null; disk_free_pct?: number | null; metric_at?: string; alerts?: string[] };
type Inventory = { items: Computer[]; total: number };
type Summary = { counts: { state: string; count: number }[]; totals: { total: number; alerts: number | null } };
type Point = { observed_at: string; cpu_pct: number | null; memory_pct: number | null };
type Series = { points: Point[]; resolution: string; truncated: boolean };
type Snapshot = { summary: Summary; inventory: Inventory; disks: Inventory; cpu: Inventory; memory: Inventory; received: string };

function Failure({ children, retry }: { children: React.ReactNode; retry: () => void }) {
  return <div className="dash-error" role="alert"><AlertTriangle size={20}/><div>{children}</div><button onClick={retry}><RefreshCw size={16}/>Tentar novamente</button></div>;
}

function ResourceChart({ series }: { series: Series }) {
  const points = series.points.filter(p => Number.isFinite(Date.parse(p.observed_at))).sort((a,b) => Date.parse(a.observed_at)-Date.parse(b.observed_at));
  const hasValues = points.some(p => typeof p.cpu_pct === "number" || typeof p.memory_pct === "number");
  if (!hasValues) return <div className="dash-empty"><Cpu size={26}/><h3>Sem métricas neste período</h3><p>As coletas de CPU e memória aparecerão aqui quando forem recebidas.</p></div>;
  const start = Date.parse(points[0].observed_at), end = Date.parse(points.at(-1)!.observed_at), span = Math.max(1, end-start);
  const x = (p: Point) => 48 + (Date.parse(p.observed_at)-start)/span*672;
  const y = (v: number) => 170 - Math.max(0,Math.min(100,v))*1.4;
  const path = (key: "cpu_pct" | "memory_pct") => { let fresh=true; return points.map(p => { const value=p[key]; if(typeof value!=="number"||!Number.isFinite(value)){fresh=true;return "";} const command=fresh?"M":"L";fresh=false;return `${command}${x(p)},${y(value)}`;}).join(" "); };
  return <><div className="dash-chart" tabIndex={0} role="region" aria-label="Gráfico de recursos; deslize horizontalmente em telas pequenas"><svg viewBox="0 0 750 210" role="img" aria-label="Uso médio de CPU e memória ao longo do período. Valores disponíveis na tabela abaixo.">
    {[0,25,50,75,100].map(v=><g key={v}><line x1="48" x2="720" y1={y(v)} y2={y(v)}/><text x="38" y={y(v)+4} textAnchor="end">{v}%</text></g>)}
    <path className="dash-cpu-line" d={path("cpu_pct")}/><path className="dash-memory-line" d={path("memory_pct")}/>
    {points.length===1&&["cpu_pct","memory_pct"].map(k=>{const v=points[0][k as "cpu_pct"];return typeof v==="number"?<circle key={k} cx={48} cy={y(v)} r="4" className={k==="cpu_pct"?"dash-cpu-dot":"dash-memory-dot"}/>:null;})}
    {[0,.5,1].map(f=><text key={f} x={48+672*f} y="198" textAnchor={f===0?"start":f===1?"end":"middle"}>{new Date(start+span*f).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</text>)}
  </svg></div><details className="dash-chart-data"><summary>Consultar valores do gráfico</summary><div className="dash-scroll" tabIndex={0} aria-label="Valores de CPU e memória"><table><caption>Coletas do período selecionado</caption><thead><tr><th>Data e hora</th><th>CPU</th><th>Memória</th></tr></thead><tbody>{points.map((p,i)=><tr key={i}><td>{date(p.observed_at)}</td><td>{percent(p.cpu_pct)}</td><td>{percent(p.memory_pct)}</td></tr>)}</tbody></table></div></details></>;
}

function ResourceValue({value, online, kind}: {value: number | null | undefined; online: boolean; kind: string}) {
  const measured=typeof value==="number"&&Number.isFinite(value);
  return <span className={`dash-resource-value dash-resource-${kind}`}><span>{online?percent(value):"—"}</span>{online&&measured&&<span className="dash-resource-track" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></span>}</span>;
}

export function DashboardOverview({ onOpen, onComputers }: { onOpen: (id:string)=>void; onComputers:()=>void }) {
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(false),[refresh,setRefresh]=useState(0),[updating,setUpdating]=useState(false);
  const [period,setPeriod]=useState("6"),[series,setSeries]=useState<Series|null>(null),[chartError,setChartError]=useState(false),[chartLoading,setChartLoading]=useState(true),[chartRefresh,setChartRefresh]=useState(0);
  useEffect(()=>{let alive=true, running=false; const load=async()=>{if(running)return;running=true;setUpdating(true);try{
    const [summary,inventory,disks,cpu,memory]=await Promise.all([
      api<Summary>("/monitoring/summary"),api<Inventory>("/inventory?page=0&size=5"),
      api<Inventory>("/inventory?page=0&size=3&lowDisk=true"),api<Inventory>("/inventory?page=0&size=1&highCpu=true"),api<Inventory>("/inventory?page=0&size=1&highMemory=true")
    ]);if(alive){setSnapshot({summary,inventory,disks,cpu,memory,received:new Date().toISOString()});setError(false);}
  }catch{if(alive)setError(true);}finally{running=false;if(alive)setUpdating(false);}};void load();const timer=setInterval(()=>void load(),30000);return()=>{alive=false;clearInterval(timer);};},[refresh]);
  useEffect(()=>{let alive=true,running=false;setSeries(null);setChartLoading(true);setChartError(false);const load=async()=>{if(running)return;running=true;try{const to=new Date(),from=new Date(+to-Number(period)*3600000);const result=await api<Series>("/monitoring/series?"+new URLSearchParams({from:from.toISOString(),to:to.toISOString()}));if(alive){setSeries(result);setChartError(false);}}catch{if(alive)setChartError(true);}finally{running=false;if(alive)setChartLoading(false);}};void load();const timer=setInterval(()=>void load(),30000);return()=>{alive=false;clearInterval(timer);};},[period,chartRefresh]);
  const counts=dashboardCounts(snapshot?.summary.counts||[]);
  const latest=series?.points.filter(p=>Number.isFinite(Date.parse(p.observed_at))).sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at)).at(-1);
  const cards=[{label:"Total de computadores",value:snapshot?.summary.totals.total,Icon:Monitor,tone:"",note:"Equipamentos cadastrados"},{label:"Online",value:counts.online,Icon:CheckCircle2,tone:"good",note:"Inclui computadores em sessão"},{label:"Offline",value:counts.offline,Icon:CircleOff,tone:"muted",note:"Inclui cadastros desativados"},{label:"Sessões ativas",value:counts.active,Icon:Radio,tone:"info",note:"Computadores com sessão ativa"},{label:"Com alerta",value:snapshot?.summary.totals.alerts??0,Icon:AlertTriangle,tone:"warning",note:"Alertas informados pelo servidor"}];
  return <div className="uai-dashboard dash-operations">
    <div className="dash-heading"><div><h1>Visão geral</h1><p>Disponibilidade e saúde dos computadores da Uai Telecom.</p></div><div className="dash-update"><span><span className="dash-update-label">Última atualização</span>{snapshot?new Date(snapshot.received).toLocaleTimeString("pt-BR"):"Aguardando dados"}</span><button onClick={()=>{setRefresh(v=>v+1);setChartRefresh(v=>v+1);}} disabled={updating} aria-label="Atualizar dashboard"><RefreshCw size={17}/></button></div></div>
    {error&&<Failure retry={()=>setRefresh(v=>v+1)}>Não foi possível atualizar o dashboard.{snapshot?" Os últimos dados recebidos foram preservados e podem estar desatualizados.":" Verifique a conexão e tente novamente."}</Failure>}
    <section className="dash-stats" aria-label="Resumo dos computadores" aria-busy={!snapshot&&!error}>{cards.map(({label,value,Icon,tone,note})=><div className={`dash-stat ${tone ? `dash-stat-${tone}` : "dash-stat-total"}`} key={label}><span><Icon size={18} className={tone}/>{label}</span>{snapshot?<strong className={tone}>{number(value)}</strong>:<strong className={!error?"dash-skeleton":""}>{error?"—":"\u00a0"}</strong>}<small>{note}</small></div>)}</section>
    {!snapshot&&!error&&<p className="dash-loading" role="status">Carregando resumo e computadores…</p>}
    <div className="dash-monitor-grid"><section className="dash-panel dash-performance" aria-label="CPU e memória">
    <div className="dash-monitor-heading"><div><h2>Desempenho dos computadores</h2><p>CPU e memória · médias da frota no período</p></div><label>Período dos gráficos<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="0.25">Últimos 15 minutos</option><option value="1">Última hora</option><option value="6">Últimas 6 horas</option><option value="24">Últimas 24 horas</option><option value="168">Últimos 7 dias</option></select></label></div>
      <div className="dash-resources"><div><span><Cpu size={17}/>Uso médio de CPU</span><strong>{percent(latest?.cpu_pct)}</strong><small>Última amostra do período</small></div><div><span><MemoryStick size={17}/>Uso médio de memória</span><strong>{percent(latest?.memory_pct)}</strong><small>Última amostra do período</small></div></div>
      <div className="dash-legend"><span>CPU</span><span>Memória</span></div>
      {chartError&&<Failure retry={()=>setChartRefresh(v=>v+1)}>Não foi possível carregar o gráfico.{series?" Os dados exibidos podem estar desatualizados.":" Tente novamente."}</Failure>}
      {chartLoading?<div className="dash-chart-loading" role="status"><div className="dash-skeleton"/>Carregando métricas…</div>:series?<ResourceChart series={series}/>:null}
      {latest&&<p className="dash-caption">Última amostra do período: {date(latest.observed_at)}. {series?.resolution==="hour"?"Médias por hora.":"Médias dos computadores com coleta recente."} Ausência de coleta não é 0%.</p>}
      {series?.truncated&&<p className="dash-caption">Limite de amostras atingido. Selecione um período menor.</p>}
    </section><div role="complementary" className="dash-attention" aria-label="Computadores que precisam de atenção"><div className="dash-attention-title"><AlertTriangle size={19}/><h2>Precisam de atenção</h2></div><p>Consumo elevado e espaço disponível, além das médias da frota.</p>
      <div className="dash-pressure">{[{label:"CPU acima do limite",data:snapshot?.cpu,Icon:Cpu},{label:"Memória acima do limite",data:snapshot?.memory,Icon:MemoryStick}].map(({label,data,Icon})=><div className="dash-pressure-item" key={label}><div><Icon size={17}/><span>{label}</span><strong>{data?number(data.total):"—"}</strong></div>{data?.items[0]?<button onClick={()=>onOpen(data.items[0].id)}><span>{data.items[0].friendly_name||data.items[0].name}<small>{data.items[0].city||"Cidade não informada"}</small></span><ChevronRight size={16}/></button>:<small>{data?"Nenhum alerta recebido":"Aguardando dados"}</small>}{data&&data.total>1&&<small>Exibindo 1 de {number(data.total)} computadores.</small>}</div>)}</div>
      <section className="dash-panel dash-storage"><div className="dash-storage-heading"><HardDrive size={20}/><h2>Armazenamento</h2><span>Alertas</span></div><div className="dash-storage-count"><strong>{snapshot?number(snapshot.disks.total):"—"}</strong><span>computadores<br/>com pouco espaço</span></div><p>Unidades abaixo do limite de espaço livre definido no servidor.</p>
      {!snapshot?<p role="status">{error?"Dados indisponíveis.":"Carregando alertas…"}</p>:snapshot.disks.total===0?<div className="dash-storage-empty"><CheckCircle2 size={24}/><span>Nenhum alerta de armazenamento recebido.</span></div>:<ul>{snapshot.disks.items.map(d=><li key={d.id}><button onClick={()=>onOpen(d.id)}><div><b>{d.friendly_name||d.name}</b><small>{d.city||"Cidade não informada"}</small><small>{d.responsible||"Colaborador não informado"}</small></div><span>{percent(d.disk_free_pct)} livre<ChevronRight size={16}/></span></button></li>)}</ul>}
      {snapshot&&snapshot.disks.total>snapshot.disks.items.length&&<p className="dash-caption">Exibindo {snapshot.disks.items.length} de {snapshot.disks.total} computadores com alerta.</p>}
    </section></div>
    <section className="dash-panel dash-inventory"><div className="dash-inventory-heading"><div><h2>Computadores <span className="dash-total-label">{snapshot?number(snapshot.inventory.total):"—"}</span></h2><p>Resumo da frota. Selecione um equipamento para abrir os detalhes.</p></div><button onClick={onComputers}>Ver computadores<ArrowRight size={16}/></button></div>
      {!snapshot?<div className="dash-empty" role="status">{error?"A lista de computadores não pôde ser carregada.":"Carregando computadores…"}</div>:snapshot.inventory.total===0?<div className="dash-empty"><Monitor size={28}/><h3>Nenhum computador cadastrado</h3><p>Os equipamentos aparecerão aqui após a ativação.</p></div>:<><div className="dash-scroll"><table><caption className="sr-only">Resumo dos computadores cadastrados</caption><thead><tr><th>Computador / código</th><th>Colaborador / cidade</th><th>Estado</th><th>CPU</th><th>Memória</th><th>Disco livre</th><th><span className="sr-only">Abrir</span></th></tr></thead><tbody>{snapshot.inventory.items.map(d=><tr key={d.id} onClick={()=>onOpen(d.id)}><td><div className="dash-device-cell"><span className="dash-device-symbol"><Monitor size={19}/></span><div><button className="dash-device-name" onClick={e=>{e.stopPropagation();onOpen(d.id);}}>{d.friendly_name||d.name}</button><small className="dash-code">{d.public_code||d.id}</small></div></div></td><td>{d.responsible||"Colaborador não informado"}<small>{d.city||"Cidade não informada"}{d.department?` · ${d.department}`:""}</small></td><td><span className={`dash-state ${d.online?"good":"muted"}`}>{d.online?<CheckCircle2 size={16}/>:<CircleOff size={16}/ >}{d.online?"Online":"Offline"}</span></td><td><ResourceValue value={d.online?d.cpu_pct:null} online={d.online} kind="cpu"/></td><td><ResourceValue value={d.online?d.memory_pct:null} online={d.online} kind="memory"/></td><td><ResourceValue value={d.online?d.disk_free_pct:null} online={d.online} kind="disk"/></td><td><ChevronRight size={18} aria-hidden="true"/></td></tr>)}</tbody></table></div><div className="dash-table-foot"><span>{snapshot.inventory.items.length} de {number(snapshot.inventory.total)} computadores</span><span>Recursos da última coleta; consulte data e validade nos detalhes.</span></div></>}
    </section></div>
  </div>;
}
