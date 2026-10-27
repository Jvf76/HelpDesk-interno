// Provision only the dedicated lab group; no devices or remote sessions are created.
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const base = path.resolve(__dirname, '../.tools/lab');
const {WebSocket} = require(path.join(base, 'mesh-runtime/node_modules/ws'));
const human = JSON.parse(fs.readFileSync(path.join(base, 'secrets/admin-access.json')));
const service = JSON.parse(fs.readFileSync(path.join(base, 'secrets/service-secrets.json')));
function connect(login, password) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://127.0.0.1:14433/control.ashx', {
      ca: fs.readFileSync(path.join(base, 'tls/lab-ca.crt')),
      servername: 'mesh.internal',
      headers: {host:'mesh.internal:14433', 'x-meshauth': Buffer.from(login).toString('base64')+','+Buffer.from(password).toString('base64')}
    });
    const pending = new Map();
    const timer = setTimeout(()=>{ws.terminate();reject(Error('Mesh authentication timeout'));},10000);
    ws.on('error', ()=>{clearTimeout(timer); reject(Error('Mesh WSS/TLS failed'));});
    ws.on('message', raw => {
      const data = JSON.parse(raw);
      if(data.action === 'userinfo') {
        clearTimeout(timer);
        resolve({
          user: data.userinfo,
          close:()=>ws.close(),
          command:(body)=>new Promise((res,rej)=>{
            const id=randomUUID();
            const timeout=setTimeout(()=>{pending.delete(id);rej(Error('Mesh command timeout: '+body.action));},10000);
            pending.set(id,r=>{clearTimeout(timeout);res(r);});
            ws.send(JSON.stringify({...body,responseid:id,tag:id}));
          })
        });
      }
      const correlation=data.responseid || data.tag;
      if(pending.has(correlation)){pending.get(correlation)(data);pending.delete(correlation);}
    });
  });
}
(async()=>{
  const admin=await connect(human.mesh.login,human.mesh.password);
  const inventory=await admin.command({action:'meshes'});
  let group=inventory.meshes.find(m=>m.name==='Uai-Laboratorio');
  if(!group){
    const created=await admin.command({action:'createmesh',meshname:'Uai-Laboratorio',meshtype:2,desc:'Laboratorio autorizado; nenhum agente instalado',consent:72});
    if(created.result!=='ok'||!created.meshid)throw Error('Group creation failed');
    group={_id:created.meshid};
  }
  const rights=8|524288|512|1024|2048|4194304|8388608;
  const grant=await admin.command({action:'addmeshuser',meshid:group._id,usernames:[service.mesh_user],meshadmin:rights});
  if(grant.failed || (grant.success!==1 && grant.result!=='Nothing done'))throw Error('Integration permission setup failed');
  admin.close();
  const integration=await connect(service.mesh_user,service.mesh_password);
  const caps=await integration.command({action:'uaiSessionCapabilities'});
  if(caps.version!==1||!caps.oneConnection||caps.leaseSeconds!==12)throw Error('Missing Uai integration');
  const groups=await integration.command({action:'meshes'});
  if(groups.meshes.length!==1 || groups.meshes[0]._id!==group._id)throw Error('Unexpected integration groups');
  const link=groups.meshes[0].links['user//'+service.mesh_user];
  if(!link||link.rights!==rights)throw Error('Unexpected integration permissions');
  if(integration.user?.siteadmin===4294967295)throw Error('Integration must not be server administrator');
  integration.close();
  fs.writeFileSync(path.join(base,'mesh-group.json'),JSON.stringify({id:group._id,name:'Uai-Laboratorio',rights},null,2));
  console.log('Mesh WSS/TLS verificado; grupo vazio criado; integracao restrita e capacidades Uai confirmadas.');
})().catch(e=>{console.error(e.message);process.exit(1);});
