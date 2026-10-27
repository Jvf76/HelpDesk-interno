// Real loopback sockets around the relay guard; fixtures are NOT Windows agents.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {randomUUID}=require('node:crypto');
const {WebSocketServer,WebSocket}=require('../node_modules/ws');
const guard=require('../uai-session.cjs');
async function connect(t,viewOnly=false){
  const id=randomUUID(), guest='Teste de transporte • Uai '+randomUUID();
  guard.register({publicid:id,userid:'test',nodeid:'test-node',guestName:guest,p:2,consent:72,expireTime:Date.now()+60000,viewOnly});
  const server=new WebSocketServer({host:'127.0.0.1',port:0});
  await once(server,'listening');const ends={};
  server.on('connection',(ws,req)=>{
    const role=req.url==='/viewer'?'viewer':'agent';
    const obj=ends[role]={ws,req:{query:{p:2}}};
    if(role==='viewer')guard.attach(obj,{pid:id,gn:guest,nid:'test-node',p:2},()=>{ends.agent?.ws.terminate();ws.terminate();});
    if(ends.viewer&&ends.agent){ends.viewer.peer=ends.agent;ends.agent.peer=ends.viewer;}
    ws.on('message',data=>{if(guard.data(obj,data))obj.peer?.ws.send(data);});
    ws.on('close',()=>guard.disconnected(obj));
  });
  const url='ws://127.0.0.1:'+server.address().port;
  const viewer=new WebSocket(url+'/viewer');await once(viewer,'open');
  const agent=new WebSocket(url+'/agent');await once(agent,'open');
  t.after(()=>{viewer.terminate();agent.terminate();server.close();});
  return {viewer,agent,event:msgid=>guard.agentEvent({nodeid:'test-node',guestname:guest,msgid}),
    status:()=>guard.status('test',id,false,false)};
}
test('real sockets carry frame/input after consent and both close on local stop',async t=>{
  const f=await connect(t);f.event(30);f.event(31);
  const tile=Buffer.from([0,3,0,10,0,0,0,0,255,217]);
  let delivery=once(f.viewer,'message');f.agent.send(tile);
  assert.deepEqual((await delivery)[0],tile);assert.equal(f.status().state,'ACTIVE');
  const key=Buffer.from([0,1,0,6,0,65]);
  delivery=once(f.agent,'message');f.viewer.send(key);assert.deepEqual((await delivery)[0],key);
  const closed=[once(f.viewer,'close'),once(f.agent,'close')];f.event(29);
  await Promise.all(closed);assert.equal(f.status().reason,'LOCAL_STOP');
});
test('real sockets close on native refusal without delivering an image',async t=>{
  const f=await connect(t);let images=0;f.viewer.on('message',()=>images++);
  const closed=[once(f.viewer,'close'),once(f.agent,'close')];f.event(34);
  await Promise.all(closed);assert.equal(images,0);assert.equal(f.status().startedAt,null);
});
