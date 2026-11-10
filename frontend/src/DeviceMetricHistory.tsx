import {MetricHistoryChart} from "./FleetOverview";
export function DeviceMetricHistory({id}:{id:string}){
 return <section className="mon-resource-history" aria-label="Histórico de recursos"><div className="mon-charts">
 <MetricHistoryChart key={id+"cpu"} endpoint={`/inventory/${id}/metrics`} title="CPU e memória RAM" periodLabel="Período do histórico" percent series={[{key:"cpu_pct",label:"CPU",color:"#83e0cf"},{key:"memory_pct",label:"RAM",color:"#d2b5ff"}]}/>
 <MetricHistoryChart key={id+"disk"} endpoint={`/inventory/${id}/metrics`} title="Espaço livre em disco" periodLabel="Período do disco" percent series={[{key:"disk_free_pct",label:"Menor percentual livre entre discos",color:"#83e0cf"}]}/>
 </div></section>;
}
