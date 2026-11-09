'use strict';
const UaiMonitors={attach(desktop,ready){
 const select=document.getElementById('monitor');
 select.replaceChildren(new Option('Aguardando monitores',''));select.disabled=true;
 let known=new Set();
 desktop.m.onDisplayinfo=(_,displays,selected)=>{
  const ids=Object.keys(displays||{}).filter(k=>/^\d{1,5}$/.test(k)&&Number(k)<=65535).slice(0,64);
  known=new Set(ids);select.replaceChildren();
  for(const id of ids)select.add(new Option(id==='65535'?'Todos os monitores':'Monitor '+id,id));
  if(!ids.length)select.add(new Option('Monitor principal',''));
  if(known.has(String(selected)))select.value=String(selected);
  select.disabled=ids.length<2;
 };
 select.onchange=()=>{if(ready()&&known.has(select.value))desktop.m.SetDisplay(Number(select.value));};
}};
