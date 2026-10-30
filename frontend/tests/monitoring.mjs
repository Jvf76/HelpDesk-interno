// Explicitly simulated API fixtures; no fabricated devices are inserted into the laboratory database.
import { chromium } from 'playwright';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});let checks=0;
try{for(const role of ['ADMIN','LEITURA']){
 const page=await browser.newPage({viewport:{width:1200,height:832}});const calls=[];const browserErrors=[];page.on('pageerror',e=>browserErrors.push(e.message));let responsible='Pessoa TESTE';
 const device={id:'11111111-1111-4111-8111-111111111111',public_code:'TEST00000001',name:'WINDOWS-TESTE',friendly_name:'Computador TESTE',responsible,city:'Cidade TESTE',department:'LAB',os:'Windows TESTE',online:true,revoked:false,state:'ONLINE',alerts:[],last_seen:new Date().toISOString(),cpu_pct:30,memory_pct:40,disk_free_pct:50,app_version:'teste',agent_version:'teste'};
 await page.route('**/*',async route=>{const url=new URL(route.request().url());assert.equal(url.origin,'https://support.test');
  if(!url.pathname.startsWith('/api/')){const f=path.join(path.resolve('dist'),url.pathname==='/'?'index.html':url.pathname);await route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'text/html'});return;}
  calls.push(url.pathname+url.search);let body={};const method=route.request().method();
  if(url.pathname==='/api/auth/me')body={id:'me',name:'Usuário TESTE',role,csrf:'test-csrf'};
  else if(url.pathname==='/api/inventory')body={items:[{...device,responsible}],total:26,page:Number(url.searchParams.get('page')),size:25};
  else if(url.pathname==='/api/monitoring/summary')body={counts:[{state:'ONLINE',count:1},{state:'OFFLINE',count:25}],totals:{total:26,alerts:0,silent:0},versions:[{version:'teste',count:26}]};
  else if(url.pathname==='/api/inventory/'+device.id&&method==='PUT'){assert.equal(role,'ADMIN');assert.equal(route.request().headers()['x-csrf-token'],'test-csrf');responsible=route.request().postDataJSON().responsible;}
  else if(url.pathname==='/api/inventory/'+device.id)body={device:{...device,responsible,windows_user:'WINDOWS/user'},latest:[],changes:[],connections:[],events:[],canConnect:role==='ADMIN'};
  else if(url.pathname==='/api/monitoring/series')body={points:Array.from({length:6},(_,i)=>({observed_at:new Date(Date.now()-(5-i)*600000).toISOString(),online:1+i,offline:25-i,cpu_pct:20+i*4,memory_pct:45+i*2})),resolution:'sample',truncated:false};
  else if(url.pathname==='/api/activation-tokens'){assert.equal(role,'ADMIN');assert.equal(route.request().headers()['x-csrf-token'],'test-csrf');assert.equal(route.request().postDataJSON().recoverDeviceId,device.id);body={id:'test-token',token:'TEST-FIXTURE-NOT-A-REAL-TOKEN'};}

  else if(url.pathname==='/api/users'||url.pathname.endsWith('/permissions'))body=[];
  else throw new Error('Unexpected endpoint '+url.pathname);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('https://support.test/');await page.getByRole('heading',{name:'Visão geral',exact:true}).waitFor();await page.getByRole('button',{name:device.public_code,exact:true}).waitFor();
 assert(calls.some(x=>x.startsWith('/api/inventory?page=0&size=25')));assert(!calls.some(x=>x==='/api/devices'));checks+=2;
 assert.equal(await page.getByRole('img',{name:'Uai Telecom'}).count(),1);
 await page.getByRole('img',{name:'Disponibilidade dos computadores'}).waitFor();
 assert.equal(await page.locator('.mon-charts').count(),1);
 assert(calls.some(x=>x.startsWith('/api/monitoring/series')));
 assert.equal(await page.getByRole('button',{name:'Ativar computador',exact:true}).count(),0);checks+=4;
 if(role==='ADMIN'){await fs.mkdir('../.tools/ui-redesign',{recursive:true});await page.screenshot({path:'../.tools/ui-redesign/light.png',fullPage:true});}
 await page.getByRole('button',{name:'Ativar tema escuro'}).click();
 assert.equal(await page.locator('.monitor').getAttribute('data-theme'),'dark');
 await page.reload();await page.getByRole('button',{name:device.public_code,exact:true}).waitFor();
 assert.equal(await page.locator('.monitor').getAttribute('data-theme'),'dark');checks+=2;

 if(role==='ADMIN'){await fs.mkdir('../.tools/ui-redesign',{recursive:true});await page.screenshot({path:'../.tools/ui-redesign/desktop.png',fullPage:true});}

 await page.getByRole('button',{name:'Computadores',exact:true}).click();
 assert.equal(await page.locator('.mon-stats').count(),0);assert.equal(await page.locator('.mon-charts').count(),0);
 assert.equal(await page.getByRole('button',{name:'Ativar computador',exact:true}).count(),role==='ADMIN'?1:0);checks+=3;
 await page.getByRole('button',{name:'Ações de '+device.name,exact:true}).click();
 await page.getByRole('button',{name:'Conectar',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Conectar',exact:true}).isEnabled(),role==='ADMIN');checks++;
 if(role==='ADMIN'){assert(await page.getByRole('button',{name:'Gerar ativação',exact:true}).isDisabled());await page.screenshot({path:'../.tools/ui-redesign/actions.png',fullPage:true});checks++;}
 else{assert.equal(await page.getByRole('button',{name:'Gerar ativação',exact:true}).count(),0);checks++;}
 await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('dialog').count(),0);checks++;
 if(role==='ADMIN'){await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'Ações de '+device.name,exact:true}).click();await page.getByRole('button',{name:'Copiar código',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),device.public_code);checks++;}
 await page.getByRole('button',{name:'Próxima',exact:true}).click();await page.getByText('Página 2 · 26 computadores').waitFor();checks++;
 await page.getByRole('button',{name:device.public_code,exact:true}).click();await page.getByRole('heading',{name:'Identificação e dados detectados',exact:true}).waitFor();checks++;
 await page.getByText('WINDOWS/user',{exact:true}).waitFor();checks++;
 if(role==='ADMIN'){await page.getByLabel('Colaborador responsável',{exact:true}).fill('Outra pessoa TESTE');await page.getByRole('button',{name:'Salvar dados administrativos',exact:true}).click();await page.getByRole('status').filter({hasText:'Código público preservado'}).waitFor();assert.equal(responsible,'Outra pessoa TESTE');checks++;}
 else{assert.equal(await page.getByRole('button',{name:'Salvar dados administrativos',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Revogar dispositivo',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Conectar',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Usuários',exact:true}).count(),0);checks+=4;}
 await page.getByRole('button',{name:'Visão geral',exact:true}).click();
 await page.getByRole('heading',{name:'Visão geral',exact:true}).waitFor();
 assert.equal(await page.locator('.mon-charts').count(),1);checks++;
 await page.getByRole('button',{name:'Filtros',exact:true}).click();
 await page.getByLabel('Cidade',{exact:true}).fill('Cidade TESTE');
 await page.waitForTimeout(400);
 assert(calls.some(x=>x.includes('city=Cidade+TESTE')));checks++;
 await page.setViewportSize({width:390,height:844});
 if(role==='ADMIN'){await page.screenshot({path:'../.tools/ui-redesign/mobile.png',fullPage:true});}
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks++;
 if(role==='ADMIN')await page.screenshot({path:'../.tools/ui-redesign/mobile.png',fullPage:true});
 if(role==='ADMIN'){
  device.revoked=true;device.online=false;device.state='DISABLED';
  await page.reload();await page.getByRole('button',{name:device.public_code,exact:true}).waitFor();
  await page.getByRole('button',{name:'Computadores',exact:true}).click();
  await page.getByRole('button',{name:'Ações de '+device.name,exact:true}).click();
  await page.getByRole('button',{name:'Gerar ativação',exact:true}).click();
  assert.equal(await page.getByLabel('Destino da ativação').inputValue(),device.id);
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Gerar token de ativação',exact:true}).click();
  await page.getByLabel('Token de ativação — copie e entregue com segurança').waitFor();
  assert.equal(await page.getByLabel('Token de ativação — copie e entregue com segurança').inputValue(),'TEST-FIXTURE-NOT-A-REAL-TOKEN');checks+=2;
  device.revoked=false;device.online=true;device.state='ONLINE';
 }
 assert.equal(browserErrors.length,0);checks++;
 await page.close();
}console.log(`${checks} monitoring UI checks passed with simulated API; no Windows collection validated.`);}finally{await browser.close();}
