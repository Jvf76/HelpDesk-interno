// Explicitly simulated API fixtures; no fabricated devices are inserted into the laboratory database.
import { chromium } from 'playwright';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});let checks=0;
try{for(const role of ['ADMIN','LEITURA']){
 const page=await browser.newPage({viewport:{width:1200,height:832}});const calls=[];const browserErrors=[];page.on('pageerror',e=>browserErrors.push(e.message));const directory=[];let responsible='Pessoa TESTE';let sessionPhase='PENDING',launches=0,releaseLaunch;
 const device={id:'11111111-1111-4111-8111-111111111111',public_code:'TEST00000001',name:'WINDOWS-TESTE',friendly_name:'Computador TESTE',responsible,city:'Cidade TESTE',department:'LAB',os:'Windows TESTE',online:true,revoked:false,state:'ONLINE',alerts:[],last_seen:new Date().toISOString(),cpu_pct:30,memory_pct:40,disk_free_pct:50,app_version:'teste',agent_version:'teste'};
 await page.route('**/*',async route=>{const url=new URL(route.request().url());assert.equal(url.origin,'https://support.test');
  if(url.pathname==='/remote-viewer/index.html'){await route.fulfill({contentType:'text/html',body:'<html><body>Controlador simulado</body></html>'});return;}
  if(!url.pathname.startsWith('/api/')){const f=path.join(path.resolve('dist'),url.pathname==='/'?'index.html':url.pathname);await route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'text/html'});return;}
  calls.push(url.pathname+url.search);let body={};const method=route.request().method();
  if(url.pathname==='/api/auth/me')body={id:'me',name:'Usuário TESTE',role,csrf:'test-csrf'};
  else if(url.pathname==='/api/printers')body={printers:[{id:'lex',label:'Lexmark laboratório'},{id:'ric',label:'Ricoh laboratório'}],collectors:[],jobs:[]};
  else if(url.pathname==='/api/equipment-history/computers/events')body=[{id:device.id,name:device.friendly_name,code:device.public_code,action:'responsible',actor_login:'ti.teste',before_value:'Ana',after_value:'Bruna',changed_at:'2026-01-20T14:00:00Z'}];
  else if(url.pathname==='/api/equipment-history/computers/'+device.id+'/events')body=[{action:'DEVICE_CREATED',before_value:null,after_value:null,changed_at:'2026-01-20T14:00:00Z'}];
  else if(url.pathname==='/api/equipment-history/printers/lex/events')body=[{action:'label',before_value:'Anterior',after_value:'Lexmark laboratório',changed_at:'2026-01-20T14:00:00Z'}];
  else if(url.pathname==='/api/equipment-history/printers/ric/events')body=[];
  else if(url.pathname==='/api/inventory')body={items:[{...device,responsible}],total:26,page:Number(url.searchParams.get('page')),size:25};
  else if(url.pathname==='/api/monitoring/insights')body={daily:[],health:[],activity:[],top:[]};
  else if(url.pathname==='/api/monitoring/summary')body={counts:[{state:'ONLINE',count:1},{state:'OFFLINE',count:25}],totals:{total:26,alerts:0,silent:0},versions:[{version:'teste',count:26}]};
  else if(url.pathname==='/api/inventory/'+device.id&&method==='PUT'){assert.equal(role,'ADMIN');assert.equal(route.request().headers()['x-csrf-token'],'test-csrf');responsible=route.request().postDataJSON().responsible;}
  else if(url.pathname==='/api/inventory/'+device.id)body={device:{...device,responsible,windows_user:'WINDOWS/user'},latest:[],changes:[],connections:[],events:[],canConnect:role==='ADMIN'};
  else if(url.pathname==='/api/inventory/'+device.id+'/metrics')body={points:[{observed_at:new Date().toISOString(),cpu_pct:30,memory_pct:40,disk_free_pct:50}],resolution:'sample',truncated:false};
  else if(url.pathname==='/api/monitoring/series')body={points:Array.from({length:6},(_,i)=>({observed_at:new Date(Date.parse(url.searchParams.get("from"))+(Date.parse(url.searchParams.get("to"))-Date.parse(url.searchParams.get("from")))*i/5).toISOString(),online:1+i,offline:25-i,cpu_pct:20+i*4,memory_pct:45+i*2})),resolution:'sample',truncated:false};
  else if(url.pathname==='/api/activation-tokens'){assert.equal(role,'ADMIN');assert.equal(route.request().headers()['x-csrf-token'],'test-csrf');assert.equal(route.request().postDataJSON().recoverDeviceId,device.id);assert.equal(route.request().postDataJSON().responsible,"Ana Silva");assert.equal(route.request().postDataJSON().storeName,"Loja Centro");body={id:'test-token',token:'TEST-FIXTURE-NOT-A-REAL-TOKEN'};}

  else if(url.pathname==='/api/connections'&&method==='POST'){assert.equal(role,'ADMIN');assert.deepEqual(route.request().postDataJSON(),{code:device.public_code,mode:'CONTROL'});body={id:'e27d74a7-cf0d-4c8f-b42a-dc13779242c4',status:'PENDING',mode:'CONTROL'};}
  else if(url.pathname==='/api/sessions/e27d74a7-cf0d-4c8f-b42a-dc13779242c4/stop')body={id:'e27d74a7-cf0d-4c8f-b42a-dc13779242c4',status:'ENDED',ended_at:new Date().toISOString()};
  else if(url.pathname==='/api/sessions/e27d74a7-cf0d-4c8f-b42a-dc13779242c4/launch'){launches++;assert.equal(sessionPhase,'CONSENTED');sessionPhase='READY';if(launches===2)await new Promise(resolve=>releaseLaunch=resolve);body={authCookie:'fixture-only',viewOnly:false,expiresAt:Date.now()+60000};}
  else if(url.pathname==='/api/sessions/e27d74a7-cf0d-4c8f-b42a-dc13779242c4')body={id:'e27d74a7-cf0d-4c8f-b42a-dc13779242c4',status:sessionPhase,mode:'CONTROL'};
  else if(url.pathname==='/api/users'&&method==='POST'){
   assert.equal(role,'ADMIN');const u=route.request().postDataJSON();assert.equal(u.role,'LEITURA');
   directory.push({id:'fixture',name:u.name,login:u.login,role:u.role,active:true});body={id:'fixture'};
  }
  else if(url.pathname==='/api/users')body=directory;
  else if(url.pathname.endsWith('/permissions'))body=[];
  else throw new Error('Unexpected endpoint '+url.pathname);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('https://support.test/');await page.getByRole('heading',{name:'Visão geral',exact:true}).waitFor();
 assert(!calls.some(x=>x.startsWith('/api/inventory')));assert(!calls.some(x=>x==='/api/devices'));checks+=2;
 assert.equal(await page.getByRole('img',{name:'Uai Telecom'}).count(),1);
 await page.getByRole('heading',{name:'Picos diários de CPU e RAM'}).waitFor();
 assert.equal(await page.locator('.dash-monitor-grid').count(),1);
 assert(calls.some(x=>x.startsWith('/api/monitoring/insights')));checks+=2;
 if(role==='ADMIN'){await fs.mkdir('../.tools/ui-redesign',{recursive:true});process.env.UAI_CAPTURE_UI === "1" && await page.screenshot({path:'../.tools/ui-redesign/light.png',fullPage:true});}
 await page.getByRole('button',{name:'Ativar tema escuro'}).click();
 assert.equal(await page.locator('.monitor').getAttribute('data-theme'),'dark');
 await page.reload();await page.getByRole('heading',{name:'Visão geral'}).waitFor();
 assert.equal(await page.locator('.monitor').getAttribute('data-theme'),'dark');checks+=2;

 if(role==='ADMIN'){await fs.mkdir('../.tools/ui-redesign',{recursive:true});process.env.UAI_CAPTURE_UI === "1" && await page.screenshot({path:'../.tools/ui-redesign/desktop.png',fullPage:true});}

 if(role==='ADMIN'){
  await page.getByRole('button',{name:'Usuários',exact:true}).click();
  await page.getByRole('button',{name:'Criar usuário',exact:true}).click();
  await page.getByLabel('Nome completo').fill('Pessoa de teste');
  await page.getByLabel('Login',{exact:true}).fill('pessoa.teste');
  await page.getByLabel('Senha inicial',{exact:false}).fill('fixture-only-test-value');
  await page.getByRole('button',{name:'Salvar usuário'}).click();
  await page.getByRole('cell',{name:'pessoa.teste'}).waitFor();checks++;
 }
 await page.getByRole('button',{name:'Computadores',exact:true}).click();
 await page.getByRole('button',{name:'Histórico de alterações'}).click();
 const changes=page.getByRole('dialog',{name:'Histórico de alterações'});
 await changes.getByText('Colaborador',{exact:true}).waitFor();
 await changes.getByRole('heading',{name:device.friendly_name}).waitFor();
 await changes.getByText('Bruna',{exact:true}).waitFor();
 await changes.getByText(/ti\.teste/).waitFor();
 assert.equal(await changes.getByRole('button',{name:/Auditoria de/}).count(),0);
 await changes.getByRole('button',{name:'Fechar',exact:true}).click();checks+=2;
 const auditButton=page.getByRole('button',{name:'Auditoria de '+device.friendly_name,exact:true});
 await auditButton.click();
 const audit=page.getByRole('dialog',{name:'Auditoria de '+device.friendly_name});
 await audit.getByText('Computador cadastrado',{exact:true}).waitFor();
 await page.keyboard.press('Escape');
 await audit.waitFor({state:'detached'});
 assert(await auditButton.evaluate(button=>document.activeElement===button));checks++;
 if(role==='ADMIN'){
  await page.getByRole('button',{name:'Impressoras',exact:true}).click();
  for(const [name,event] of [['Lexmark laboratório','Nome da impressora'],['Ricoh laboratório','Nenhum evento de cadastro disponível.']]){
   await page.getByRole('button',{name:'Auditoria de '+name}).click();
   const modal=page.getByRole('dialog',{name:'Auditoria de '+name});
   await modal.getByText(event,{exact:true}).waitFor();
   if(name.startsWith('Ricoh'))assert.equal(await modal.getByText('Nome da impressora').count(),0);
   await modal.getByRole('button',{name:'Fechar'}).click();checks++;
  }
  await page.getByRole('button',{name:'Computadores',exact:true}).click();
 }
 assert.equal(await page.locator('.mon-stats').count(),0);assert.equal(await page.locator('.mon-charts').count(),0);
 assert.equal(await page.getByRole('button',{name:'Ativar computador',exact:true}).count(),role==='ADMIN'?1:0);checks+=3;
 await page.getByRole('button',{name:'Ações de '+device.name,exact:true}).click();
 await page.getByRole('button',{name:'Conectar',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Conectar',exact:true}).isEnabled(),role==='ADMIN');checks++;
 if(role==='ADMIN'){assert(await page.getByRole('button',{name:'Gerar ativação',exact:true}).isDisabled());process.env.UAI_CAPTURE_UI === "1" && await page.screenshot({path:'../.tools/ui-redesign/actions.png',fullPage:true});checks++;}
 else{assert.equal(await page.getByRole('button',{name:'Gerar ativação',exact:true}).count(),0);checks++;}
 await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('dialog').count(),0);checks++;
 if(role==='ADMIN'){await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'Ações de '+device.name,exact:true}).click();await page.getByRole('button',{name:'Copiar código',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),device.public_code);checks++;}
 await page.getByRole('button',{name:'Próxima',exact:true}).click();await page.getByText('Página 2 · 26 computadores').waitFor();checks++;
 await page.getByRole('button',{name:device.public_code,exact:true}).click();await page.getByRole('heading',{name:'Identificação e dados detectados',exact:true}).waitFor();checks++;
 await page.getByText('WINDOWS/user',{exact:true}).waitFor();checks++;
 await page.getByRole('img',{name:'CPU e memória RAM',exact:true}).waitFor();await page.getByRole('img',{name:'Espaço livre em disco',exact:true}).waitFor();assert(calls.some(x=>x.startsWith('/api/inventory/'+device.id+'/metrics?')));checks+=3;
 const resourceHistory=page.getByRole('region',{name:'Histórico de recursos'});
 assert.equal(await resourceHistory.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 assert.equal(await page.getByLabel('Período do histórico — CPU e memória RAM').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(34, 43, 57)');
 if(role==='ADMIN'){
  process.env.UAI_CAPTURE_UI === "1" && await resourceHistory.screenshot({path:'../.tools/ui-redesign/history-dark.png'});
  await page.getByRole('button',{name:'Ativar tema claro'}).click();
  assert.equal(await page.getByLabel('Período do histórico — CPU e memória RAM').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  process.env.UAI_CAPTURE_UI === "1" && await resourceHistory.screenshot({path:'../.tools/ui-redesign/history-light.png'});
  await page.getByRole('button',{name:'Ativar tema escuro'}).click();
 }
 checks+=2;
 if(role==='ADMIN'){
 await page.getByRole('button',{name:'Conectar',exact:true}).click();
 const card=page.locator('.remote-session');
 assert.equal(await card.getByRole('combobox').count(),0);
 assert.equal(await card.getByRole('button',{name:'Solicitar consentimento'}).count(),0);
 assert.equal(await card.getByRole('button',{name:'Conectar',exact:true}).count(),0);
 await card.getByText('Aguardando consentimento no computador acessado',{exact:true}).waitFor();
 assert.equal(launches,0);sessionPhase='CONSENTED';
 await page.getByTitle('Atendimento remoto').waitFor();assert.equal(launches,1);
 assert.equal(await page.getByRole('button',{name:'Abrir visualizador',exact:true}).count(),0);
 sessionPhase='ACTIVE';await page.waitForTimeout(2200);assert.equal(launches,1);
 assert.equal(await page.getByTitle('Atendimento remoto').count(),1);
 assert.equal(calls.filter(x=>x==='/api/sessions/e27d74a7-cf0d-4c8f-b42a-dc13779242c4/stop').length,0);
 await card.getByRole('button',{name:'Copiar diagnóstico',exact:true}).click();
 const diagnostic=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));
 assert(diagnostic.events.some(e=>e.code==='LAUNCH_OK'));assert(!JSON.stringify(diagnostic).includes('fixture-only'));checks+=2;
 await card.getByRole('button',{name:'Encerrar acesso',exact:true}).click();
 await page.getByTitle('Atendimento remoto').waitFor({state:'detached'});
 await card.getByRole('button',{name:'Fechar atendimento'}).click();checks+=8;
 // A late bootstrap must not reopen a viewer after local requester stop.
 sessionPhase='CONSENTED';await page.getByRole('button',{name:'Conectar',exact:true}).click();
 await page.waitForTimeout(2500);
 assert.equal(launches,2);assert(releaseLaunch);
 await card.getByRole('button',{name:'Encerrar acesso',exact:true}).click();releaseLaunch();
 await page.waitForTimeout(200);assert.equal(await page.getByTitle('Atendimento remoto').count(),0);
 await card.getByRole('button',{name:'Fechar atendimento'}).click();checks+=3;
 const actionButtons=page.locator('.equipment-audit-actions button');
 assert.deepEqual(await actionButtons.allTextContents(),['Gerar nova ativação','Auditoria do equipamento','Remover computador']);
 for(const width of [1200,390]){
  await page.setViewportSize({width,height:832});
  const boxes=await actionButtons.evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().toJSON()));
  for(let i=1;i<boxes.length;i++){
   const prev=boxes[i-1],next=boxes[i];
   if(width===1200)assert.equal(prev.top,next.top);
   assert(next.left>=prev.right+11 || next.top>=prev.bottom+11);
  }
 }
 await page.setViewportSize({width:1200,height:832});checks+=3;
 await page.getByLabel('Colaborador responsável' ,{exact:true}).fill('Outra pessoa TESTE');await page.getByRole('button',{name:'Salvar dados administrativos',exact:true}).click();await page.getByRole('status').filter({hasText:'Código público preservado'}).waitFor();assert.equal(responsible,'Outra pessoa TESTE');checks++;}
 else{assert.equal(await page.getByRole('button',{name:'Salvar dados administrativos',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Revogar dispositivo',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Conectar',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Usuários',exact:true}).count(),0);checks+=4;}
 await page.getByRole('button',{name:'Visão geral',exact:true}).click();
 await page.getByRole('heading',{name:'Visão geral',exact:true}).waitFor();
 assert.equal(await page.locator('.dash-monitor-grid').count(),1);checks++;
 await page.getByRole('button',{name:'Computadores',exact:true}).click();
 await page.getByRole('button',{name:'Filtros',exact:true}).click();
 await page.getByLabel('Cidade',{exact:true}).fill('Cidade TESTE');
 await page.waitForTimeout(400);
 assert(calls.some(x=>x.includes('city=Cidade+TESTE')));checks++;
 await page.setViewportSize({width:390,height:844});
 if(role==='ADMIN'){process.env.UAI_CAPTURE_UI === "1" && await page.screenshot({path:'../.tools/ui-redesign/mobile.png',fullPage:true});}
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks++;
 if(role==='ADMIN')process.env.UAI_CAPTURE_UI === "1" && await page.screenshot({path:'../.tools/ui-redesign/mobile.png',fullPage:true});
 if(role==='ADMIN'){
  device.revoked=true;device.online=false;device.state='DISABLED';
  await page.reload();await page.getByRole('heading',{name:'Visão geral'}).waitFor();
  await page.getByRole('button',{name:'Computadores',exact:true}).click();
  await page.getByRole('button',{name:'Ações de '+device.name,exact:true}).click();
  await page.getByRole('button',{name:'Gerar ativação',exact:true}).click();
  assert.equal(await page.getByLabel('Destino da ativação').inputValue(),device.id);
  await page.getByLabel('Nome do colaborador').fill('Ana Silva');
  await page.getByLabel('Loja',{exact:true}).fill('Loja Centro');
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Gerar token de ativação',exact:true}).click();
  await page.getByLabel('Token de ativação — copie e entregue com segurança').waitFor();
  assert.equal(await page.getByLabel('Token de ativação — copie e entregue com segurança').inputValue(),'TEST-FIXTURE-NOT-A-REAL-TOKEN');checks+=2;
  device.revoked=false;device.online=true;device.state='ONLINE';
 }
 assert.equal(browserErrors.length,0);checks++;
 await page.close();
}console.log(`${checks} monitoring UI checks passed with simulated API; no Windows collection validated.`);}finally{await browser.close();}
