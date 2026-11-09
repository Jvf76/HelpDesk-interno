'use strict';
const UaiMonitors={attach(desktop,ready,notify=()=>{}){
 const select=document.getElementById('monitor');
 const refreshButton=document.getElementById('refresh-monitors'),status=document.getElementById('monitor-status');
 select.replaceChildren(new Option('Aguardando monitores',''));select.disabled=true;
 let known=new Set(),requestedAt=-Infinity,waiting=false;
 const update=()=>{
  const available=ready();select.disabled=!available||known.size<2;
  if(refreshButton)refreshButton.disabled=!available||performance.now()-requestedAt<1000;
  if(waiting&&performance.now()-requestedAt>5000&&status){status.textContent='Lista de monitores não recebida. Tente Atualizar monitores.';waiting=false;}
 };
 const refresh=()=>{
  if(!ready()||performance.now()-requestedAt<1000)return;
  requestedAt=performance.now();waiting=true;if(status)status.textContent='Consultando monitores do computador…';
  desktop.m.GetDisplayNumbers();notify('monitors-requested');update();
 };
 desktop.m.onDisplayinfo=(_,displays,selected)=>{
  const ids=Object.keys(displays||{}).filter(k=>/^\d{1,5}$/.test(k)&&Number(k)<=65535).slice(0,64);
  known=new Set(ids);select.replaceChildren();
  for(const id of ids)select.add(new Option(id==='65535'?'Todos os monitores':'Monitor '+id,id));
  if(!ids.length)select.add(new Option('Monitor principal',''));
  if(known.has(String(selected)))select.value=String(selected);
  waiting=false;const count=ids.filter(id=>id!=='65535').length;
  if(status)status.textContent=count?`${count} monitor${count===1?'':'es'} informado${count===1?'':'s'} pelo computador`:'O computador não informou uma lista de monitores.';
  notify(count>1?'monitors-multiple':count===1?'monitors-single':'monitors-empty');update();
 };
 select.onchange=()=>{if(ready()&&known.has(select.value)){desktop.m.SetDisplay(Number(select.value));notify('monitor-selected');}};
 if(refreshButton)refreshButton.onclick=refresh;
 update();return {refresh,update};
}};
