// Local embedded React with simulated native bridge. Does not validate Windows DPAPI/WebView2.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
let checks=0;
try {
 for(const mode of ['new','activated','offline','tls','revoked']) {
  const page=await browser.newPage();const calls=[];let activated=mode==='activated';
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());assert.equal(url.origin,'https://uai-suporte.invalid');
   const file=path.join(path.resolve('dist'),url.pathname);await route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.exposeBinding('nativeTest',async(_,r)=>{
   calls.push(r.path);let status=200,body={};
   if(mode==='tls'){status=495;body={message:'Certificado TLS recusado.'};}
   else if(mode==='offline'){status=503;body={message:'Servidor indisponível.'};}
   else if(r.path==='/desktop/activate'){activated=true;}
   else if(r.path==='/identity') {status=activated?200:401;body=activated?{id:'test',name:'Windows TESTE',public_code:'ABCD12345678'}:{message:'Ativação necessária.'};}
   else if(r.path==='/desktop/device') body={state:'Online • TESTE SIMULADO'};
   else if(r.path==='/connections')body=[];
   return {id:r.id,status,body:JSON.stringify(body)};
  });
  await page.addInitScript(()=>{
   const listeners=[];window.chrome={webview:{addEventListener:(_,fn)=>listeners.push(fn),postMessage:async r=>{const reply=await window.nativeTest(r);listeners.forEach(fn=>fn({data:reply}));}}};
  });
  await page.goto('https://uai-suporte.invalid/index.html');
  if(mode==='activated')await page.getByRole('heading',{name:'Seu código',exact:true}).waitFor();
  else {
   await page.getByLabel('Token de ativação',{exact:true}).waitFor();
   if(mode==='new') {
    await page.getByLabel('Token de ativação',{exact:true}).fill('test-only-token');
    await page.getByRole('button',{name:'Ativar este computador',exact:true}).click();
    await page.getByRole('heading',{name:'Seu código',exact:true}).waitFor();checks++;
   }
   if(mode==='tls'||mode==='offline'){await page.getByRole('alert').waitFor();checks++;}
  }
  assert.equal(await page.getByLabel('Login',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Sair',exact:true}).count(),0);
  assert.equal(calls.some(p=>p.startsWith('/auth/')),false);
  assert.equal(await page.getByText('Sessão expirada. Entre novamente.',{exact:true}).count(),0);checks+=4;
  await page.close();
 }
 console.log(`${checks} verificações do aplicativo sem login (ponte simulada) passaram.`);
} finally {await browser.close();}
