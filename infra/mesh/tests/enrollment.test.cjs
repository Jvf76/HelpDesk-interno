const {test}=require('node:test'),assert=require('node:assert/strict');
const {Enrollment}=require('../uai-enrollment.cjs');
const owner='user//broker',device='12345678-1234-1234-1234-123456789012',group='mesh//lab';
const agent={authenticated:2,dbMeshKey:group,dbNodeKey:'node//actual'};
test('proof binds only authenticated agent and expected group; owner isolation and single identity',()=>{
 const e=new Enrollment(),p=e.begin(owner,device,group);
 assert.equal(e.prove({...agent,authenticated:1},p.secret),false);
 assert.equal(e.prove({...agent,dbMeshKey:'mesh//other'},p.secret),false);
 assert.equal(e.prove(agent,'f'.repeat(64)),false);
 assert.equal(e.prove(agent,{toString:42}),false);
 assert.equal(e.prove(agent,p.secret),true);
 assert.equal(e.prove({...agent,dbNodeKey:'node//stolen'},p.secret),false);
 assert.equal(e.status('user//other',device).node,null);
 assert.equal(e.status(owner,device).node,agent.dbNodeKey);
 e.cancel(owner,device);assert.equal(e.prove(agent,p.secret),false);
});
test('expiration and reissue invalidate old proof',()=>{
 let now=0;const e=new Enrollment(()=>now),p=e.begin(owner,device,group);
 now=120000;assert.equal(e.prove(agent,p.secret),false);
 const a=e.begin(owner,device,group),b=e.begin(owner,device,group);
 assert.equal(e.prove(agent,a.secret),false);assert.equal(e.prove(agent,b.secret),true);
});

test('served default core contains binding and mandatory consent patches',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.join(__dirname,'../node_modules/meshcentral/agents');
 const regular=fs.readFileSync(path.join(root,'meshcore.js'),'utf8'),preferred=fs.readFileSync(path.join(root,'meshcore.min.js'),'utf8');
 assert.equal(preferred,regular);assert.match(preferred,/uaiBindingProof/);assert.match(preferred,/connectionBar\) \{ ws.end/);
});
