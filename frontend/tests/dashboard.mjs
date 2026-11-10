// Real built React UI; every API response is simulated and isolated from the lab.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const browser=await chromium.launch({headless:true});
const out=path.resolve('../.tools/dashboard-review');
await fs.mkdir(out,{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 let mode='normal',hold=false,release;let calls=[];
 const devices=Array.from({length:5},(_,i)=>({id:`00000000-0000-4000-8000-00000000000${i}`,name:`UAI-LAB-00${i+1}`,public_code:`EXEMPLO-00${i+1}`,responsible:`Colaborador TESTE ${i+1}`,city:i%2?'Uberlândia':'Patos de Minas',department:'LAB',online:i!==4,state:i===1?'IN_SESSION':i===4?'OFFLINE':'ONLINE',cpu_pct:30+i,memory_pct:50+i,disk_free_pct:7+i,metric_at:new Date().toISOString(),alerts:[]}));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());assert.equal(u.origin,'https://dashboard.test');
  if(!u.pathname.startsWith('/api/')){const f=path.join(path.resolve('dist'),u.pathname==='/'?'index.html':u.pathname);await route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'text/html'});return;}
  calls.push(u.pathname+u.search);let body={};
  if(u.pathname==='/api/auth/me')body={id:'fixture-user',name:'TESTE',role:'ADMIN'};
  else {
   if(hold)await new Promise(r=>{release=r;});
   if(mode==='error'){await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Falha simulada"}'});return;}
   if(u.pathname==='/api/monitoring/summary')body={counts:mode==='empty'?[]:[{state:'ONLINE',count:220},{state:'IN_SESSION',count:8},{state:'ERROR',count:3},{state:'OFFLINE',count:15},{state:'DISABLED',count:2}],totals:{total:mode==='empty'?0:248,alerts:12}};
   else if(u.pathname==='/api/inventory'){const filtered=u.searchParams.has('lowDisk')||u.searchParams.has('highCpu')||u.searchParams.has('highMemory');body={items:mode==='empty'?[]:devices.slice(0,Number(u.searchParams.get('size'))),total:mode==='empty'?0:filtered?6:248};}
   else if(u.pathname==='/api/monitoring/series')body={points:mode==='empty'?[]:Array.from({length:12},(_,i)=>({observed_at:new Date(Date.now()-(11-i)*1800000).toISOString(),cpu_pct:23+i,memory_pct:48+i})),resolution:'sample',truncated:false};
   else if(u.pathname===`/api/inventory/${devices[0].id}`)body={device:devices[0],latest:[],changes:[],connections:[],events:[],canConnect:true};
   else if(u.pathname.endsWith('/metrics'))body={points:[],resolution:'sample',truncated:false};
   else if(u.pathname.endsWith('/permissions')||u.pathname==='/api/users')body=[];
   else throw new Error('Unexpected API: '+u.pathname);
  }
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('https://dashboard.test');await page.getByRole('button',{name:devices[0].name,exact:true}).waitFor();
 assert.equal(await page.getByRole('textbox').count(),0);
 assert.equal(await page.getByRole('button',{name:'Localizar computador'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Configurações',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Auditoria',exact:true}).count(),0);
 assert.equal(await page.getByText('Em atendimento',{exact:true}).count(),0);
 assert.match(await page.locator('.dash-stats').innerText(),/231/);
 assert.match(await page.locator('.dash-stats').innerText(),/17/);
 assert.equal(await page.getByRole('button',{name:'Detalhes',exact:true}).count(),0);
 assert(await page.getByRole('button',{name:/Histórico de acessos/}).isDisabled());
 await page.getByRole('img',{name:/Uso médio de CPU e memória/}).waitFor();
 await page.getByLabel('Período dos gráficos').selectOption('24');
 await page.getByRole('img',{name:/Uso médio de CPU e memória/}).waitFor();
 assert(calls.some(x=>x.startsWith('/api/monitoring/series?')));
 await page.screenshot({path:path.join(out,'desktop-light.png'),fullPage:true});
 await page.getByRole('button',{name:'Ativar tema escuro'}).click();await page.screenshot({path:path.join(out,'desktop-dark.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(out,'mobile-dark.png'),fullPage:true});
 await page.getByRole('button',{name:'Ativar tema claro'}).click();await page.screenshot({path:path.join(out,'mobile-light.png'),fullPage:true});
 const first=page.getByRole('button',{name:devices[0].name,exact:true});await first.focus();await page.keyboard.press('Enter');
 await page.getByRole('heading',{name:'Identificação e dados detectados'}).waitFor();
 mode='empty';await page.reload();await page.getByRole('heading',{name:'Nenhum computador cadastrado'}).waitFor();await page.getByRole('heading',{name:'Sem métricas neste período'}).waitFor();await page.screenshot({path:path.join(out,'empty.png'),fullPage:true});
 mode='error';await page.reload();await page.getByText('Não foi possível atualizar o dashboard.',{exact:false}).waitFor();assert(await page.getByRole('button',{name:'Tentar novamente',exact:true}).count()>0);await page.screenshot({path:path.join(out,'error.png'),fullPage:true});
 mode='normal';await page.getByRole('button',{name:'Tentar novamente',exact:true}).first().click();await page.getByRole('button',{name:devices[0].name,exact:true}).waitFor();
 // Reload in a delayed state to prove loading is not presented as empty or zero.
 await page.route('**/api/inventory?**',async route=>{await new Promise(r=>setTimeout(r,1000));await route.fallback();});
 await page.reload();await page.getByText('Carregando resumo e computadores…').waitFor();await page.screenshot({path:path.join(out,'loading.png'),fullPage:true});
 await page.getByRole('button',{name:devices[0].name,exact:true}).waitFor();
 // Deliberate 503s produce browser network console errors; no other errors allowed.
 assert.deepEqual(errors.filter(e=>!e.includes('503')),[]);
 console.log('Dashboard: normal/empty/error/retry/loading, keyboard, themes and responsive checks passed. API simulated. Captures: '+out);
} finally {await browser.close();}
