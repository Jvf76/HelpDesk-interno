// Read-only authenticated WebSocket check. Never prints credentials or tokens.
const fs=require('node:fs'),path=require('node:path');
const lab=path.resolve(__dirname,'../.tools/lab');
const {WebSocket}=require(path.join(lab,'mesh-runtime/node_modules/ws'));
const manifest=JSON.parse(fs.readFileSync(path.join(lab,'manifest.json')));
const target=new URL(process.env.UAI_TEST_MESH_URL||manifest.mesh_url);
const service=JSON.parse(fs.readFileSync(path.join(lab,'secrets/service-secrets.json')));
const ws=new WebSocket('wss://127.0.0.1:'+ (target.port||443)+'/control.ashx',{
 ca:fs.readFileSync(path.join(lab,'tls/lab-ca.crt')),servername:'mesh.internal',
 headers:{host:target.host,origin:target.origin,'x-meshauth':Buffer.from(service.mesh_user).toString('base64')+','+Buffer.from(service.mesh_password).toString('base64')}
});
const timeout=setTimeout(()=>{console.error('Timeout WSS');ws.terminate();process.exitCode=1;},10000);
ws.on('error',()=>{clearTimeout(timeout);console.error('Falha WSS/TLS/autenticacao');process.exitCode=1;});
ws.on('message',raw=>{
 const m=JSON.parse(raw);
 if(m.action==='userinfo') ws.send(JSON.stringify({action:'uaiSessionCapabilities',responseid:'probe'}));
 if(m.action==='uaiSessionCapabilities'){
  clearTimeout(timeout);
  if(m.version!==1||!m.oneConnection||m.leaseSeconds!==12){console.error('Capacidades inesperadas');process.exitCode=1;}
  else console.log('WSS autenticado e capacidades Uai verificadas com TLS validado.');
  ws.close();
 }
});
