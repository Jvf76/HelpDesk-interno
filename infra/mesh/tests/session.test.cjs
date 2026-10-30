const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {EventEmitter}=require('node:events');
const engine=require('../uai-session.cjs');
function fixture(viewOnly=false){
  const id=randomUUID(),guest='Técnico • Uai '+randomUUID();
  const entry={publicid:id,userid:'user//integration',nodeid:'node//test',guestName:guest,p:2,consent:72,expireTime:Date.now()+60000,viewOnly};
  engine.register(entry);
  const viewer={req:{query:{p:'2'}}},agent={peer:viewer};viewer.peer=agent;
  let closed=0;
  assert.equal(engine.attach(viewer,{gn:guest,pid:id,nid:entry.nodeid,p:2},()=>closed++),true);
  const status=(renew=false,stop=false)=>engine.status(entry.userid,id,renew,stop);
  const event=msgid=>engine.agentEvent({nodeid:entry.nodeid,guestname:guest,msgid});
  return {id,guest,entry,viewer,agent,status,event,closed:()=>closed};
}
const tile=Buffer.from([0,3,0,10,0,0,0,0,255,217]);
const key=Buffer.from([0,1,0,6,0,65]);
test('no frame before consent and both paths close',()=>{
  const f=fixture(); assert.equal(engine.data(f.agent,tile),false);
  assert.equal(f.status().reason,'CONSENT_MISSING');assert.equal(f.closed(),1);
  assert.equal(engine.data(f.viewer,key),false);
});
test('final rejection never becomes active; reconnect forbidden',()=>{
  const f=fixture();f.event(34);
  assert.equal(f.status().reason,'REJECTED');assert.equal(f.status().startedAt,null);
  assert.equal(engine.data(f.agent,tile),false);
  assert.equal(engine.attach({}, {gn:f.guest,pid:f.id,nid:f.entry.nodeid},()=>{}),false);
});
test('consent is not transmission; complete image tile is required; CONTROL permits input',()=>{
  const f=fixture();f.event(30);f.event(31);
  assert.equal(f.status().state,'CONSENTED');assert.equal(engine.data(f.viewer,key),false);
  assert.equal(engine.data(f.agent,tile.subarray(0,5)),true);
  assert.equal(f.status().startedAt,null);
  assert.equal(engine.data(f.agent,tile.subarray(5)),true);
  assert.equal(f.status().state,'ACTIVE');assert.equal(engine.data(f.viewer,key),true);
  f.status(false,true);assert.equal(engine.data(f.viewer,key),false);assert.equal(f.closed(),1);
});
test('VIEW refuses keyboard, clipboard, files and alternate WebRTC transport',()=>{
  const f=fixture(true);f.event(30);engine.data(f.agent,tile);
  assert.equal(engine.data(f.viewer,key),false);
  for(const type of ['clipboard','webrtc0','offer','url','autolock'])assert.equal(engine.data(f.viewer,JSON.stringify({type})),false);
  assert.equal(engine.data(f.viewer,JSON.stringify({type:'options',file:'secret',consent:0})),false);
  assert.equal(engine.data(f.viewer,Buffer.from([0,17,0,5,65])),false);
});
test('local stop and privacy bar failure terminate and refuse further traffic',()=>{
  for(const [msgid,reason]of [[29,'LOCAL_STOP'],[32,'PRIVACY_BAR_FAILED']]){
    const f=fixture();f.event(30);engine.data(f.agent,tile);f.event(msgid);
    assert.equal(f.status().reason,reason);assert.equal(f.closed(),1);
    assert.equal(engine.data(f.viewer,key),false);assert.equal(engine.data(f.agent,tile),false);
  }
});
test('share owner, node correlation, single viewer and restart missing state',()=>{
  const f=fixture();assert.equal(engine.status('user//other',f.id,true,true).state,'UNKNOWN');
  engine.agentEvent({nodeid:'node//other',guestname:f.guest,msgid:30});
  assert.equal(f.status().consentAt,null);
  assert.equal(engine.attach({req:{query:{p:2}}},{gn:f.guest,pid:f.id,nid:f.entry.nodeid},()=>{}),false);
  assert.equal(engine.attach({req:{query:{p:2}}},{gn:f.guest,pid:'missing',nid:f.entry.nodeid},()=>{}),false);
  f.status(false,true);
});
test('lease expires without backend; absolute expiry cannot be renewed',t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.now()});
  let f=fixture();t.mock.timers.tick(12001);
  assert.equal(f.status(true).reason,'LEASE_LOST');assert.equal(f.closed(),1);
  f=fixture();
  for(let i=0;i<5;i++){t.mock.timers.tick(10000);assert.notEqual(f.status(true).state,'ENDED');}
  t.mock.timers.tick(10001);assert.equal(f.status(true).reason,'EXPIRED');
});
test('disconnect terminates, late native local reason refines metadata',()=>{
  const f=fixture();f.event(30);engine.data(f.agent,tile);engine.disconnected(f.agent);
  assert.equal(f.status().reason,'DISCONNECTED');f.event(29);assert.equal(f.status().reason,'LOCAL_STOP');
});
test('jumbo and fragmented tiles do not retain screen content',()=>{
  const observer=new engine.TileObserver();const packet=Buffer.alloc(100008);
  packet.writeUInt16BE(27);packet.writeUInt16BE(8,2);packet.writeUInt32BE(100000,4);packet.writeUInt16BE(3,8);
  assert.equal(observer.feed(packet.subarray(0,11)),false);
  assert.equal(observer.feed(packet.subarray(11,50000)),false);
  assert.equal(observer.feed(packet.subarray(50000)),true);
  assert.equal(observer.header.length,12);
  assert.throws(()=>new engine.TileObserver().feed(Buffer.from([0,3,0,1])));
});
test('half-open socket loses session despite backend lease renewals',t=>{
  t.mock.timers.enable({apis:['Date','setInterval'],now:Date.now()});
  delete require.cache[require.resolve('../uai-session.cjs')];
  const fresh=require('../uai-session.cjs');
  const guest='Técnico • Uai '+randomUUID();
  fresh.register({publicid:'probe',userid:'owner',nodeid:'node',guestName:guest,p:2,consent:72,expireTime:Date.now()+60000});
  const socket=new EventEmitter();let killed=0,pings=0;
  socket.ping=()=>pings++;socket.terminate=()=>killed++;
  const viewer={req:{query:{p:2}},ws:socket};
  fresh.attach(viewer,{gn:guest,pid:'probe',nid:'node'},()=>{});
  t.mock.timers.tick(500);
  t.mock.timers.tick(5000);fresh.status('owner','probe',true,false);
  t.mock.timers.tick(5000);fresh.status('owner','probe',true,false);
  t.mock.timers.tick(500);
  assert.equal(fresh.status('owner','probe',false,false).reason,'CONNECTION_LOST');
  assert.ok(pings>0);assert.equal(killed,1);
});
test('desktop bootstrap binds owner, consent, mode, expiry and client IP; closed sessions denied',()=>{
 const entry={publicid:randomUUID(),userid:'user//integration',nodeid:'node//test',guestName:'TI • Uai '+randomUUID(),p:2,consent:72,expireTime:Date.now()+60000,viewOnly:true};
 engine.register(entry);
 assert.equal(engine.viewerCookie('user//other',entry.publicid,'','127.0.0.1'),null);
 assert.equal(engine.viewerCookie(entry.userid,entry.publicid,'','not-an-ip'),null);
 const c=engine.viewerCookie(entry.userid,entry.publicid,'','127.0.0.1');
 assert.equal(c.vo,1);assert.equal(c.cf,72);assert.equal(c.expire,entry.expireTime);assert.equal(c.ip,'127.0.0.1');assert.equal(c.p,2);
 engine.status(entry.userid,entry.publicid,false,true);
 assert.equal(engine.viewerCookie(entry.userid,entry.publicid,'','127.0.0.1'),null);
});
