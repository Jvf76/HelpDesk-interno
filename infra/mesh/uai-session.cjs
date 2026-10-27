'use strict';
// Uai Telecom: metadata and lease enforcement around the existing MeshCentral relay.
// No image/input contents are retained. No cryptographic or desktop protocol replacement.
const sessions = new Map();
const LEASE_MS = 12000;
const RETAIN_MS = 15 * 60 * 1000;
const marker = / • Uai [0-9a-f-]{36}$/i;
const now = () => Date.now();
function finish(s, reason) {
  if (!s || s.state === 'ENDED') return;
  s.state = 'ENDED';
  // Terminate transport before reporting completion, including half-open sockets.
  for (const endpoint of [s.relay, s.relay && s.relay.peer]) {
    try { endpoint?.ws?.terminate(); } catch {}
  }
  s.reason = reason; s.endedAt = now();
  for (const close of s.closers) { try { close(); } catch {} }
  s.closers.clear();
}
function alive(s) {
  if (!s || s.state === 'ENDED') return false;
  if (s.expiresAt <= now()) finish(s, 'EXPIRED');
  else if (s.leaseUntil <= now()) finish(s, 'LEASE_LOST');
  return s.state !== 'ENDED';
}
function register(entry) {
  if (!marker.test(entry.guestName || '')) return;
  if (entry.p !== 2 || entry.consent !== 72 || !Number.isFinite(entry.expireTime) || entry.expireTime > now() + 61000) throw Error('Invalid Uai share policy');
  sessions.set(entry.publicid, {id:entry.publicid, owner:entry.userid, node:entry.nodeid,
    guest:entry.guestName, viewOnly:entry.viewOnly === true, expiresAt:entry.expireTime,
    leaseUntil:now()+LEASE_MS, state:'READY', reason:null, startedAt:null, endedAt:null,
    consentAt:null, privacy:false, relay:null, closers:new Set()});
}
function snapshot(s) {
  return {state:s.state,reason:s.reason,startedAt:s.startedAt,endedAt:s.endedAt,
    consentAt:s.consentAt,privacyBar:s.privacy,observedAt:now(),expiresAt:s.expiresAt};
}
function status(userId, id, renew, stop) {
  const s=sessions.get(id);
  if (!s || s.owner!==userId) return {state:'UNKNOWN',observedAt:now()};
  if (alive(s) && renew===true) s.leaseUntil=Math.min(now()+LEASE_MS,s.expiresAt);
  if (stop===true) finish(s,'SERVER_STOP');
  return snapshot(s);
}
function attach(obj,cookie,close) {
  if (!cookie || !marker.test(cookie.gn || '')) return true;
  const s=sessions.get(cookie.pid);
  // Old links fail closed after restart. A link binds to one viewer connection only.
  if (!alive(s) || s.node!==cookie.nid || s.relay!==null || Number(obj.req.query.p || cookie.p)!==2) return false;
  s.relay=obj; s.state='CONNECTING'; s.closers.add(close); obj.uaiShare=s;
  return true;
}
function sessionFor(obj) { return obj.uaiShare || (obj.peer && obj.peer.uaiShare); }
function disconnected(obj) {
  const s=sessionFor(obj);
  if (s) finish(s,'DISCONNECTED');
}
function agentEvent(event) {
  if (!marker.test(event.guestname || '')) return;
  for (const s of sessions.values()) {
    if (s.node!==event.nodeid || s.guest!==event.guestname) continue;
    // Native agent logs can arrive just after relay close. Refine the reason only.
    if (event.msgid===29 || event.msgid===34 || event.msgid===32) {
      const reason=event.msgid===29?'LOCAL_STOP':event.msgid===34?'REJECTED':'PRIVACY_BAR_FAILED';
      if (s.state==='ENDED' && ['DISCONNECTED','REJECTED'].includes(s.reason)) s.reason=reason;
      else finish(s,reason);
    } else if (alive(s)) {
      if (event.msgid===30) {s.consentAt=now(); if(s.state!=='ACTIVE')s.state='CONSENTED';}
      if (event.msgid===31) s.privacy=true;
    }
  }
}
// Incremental inspection of only existing KVM headers; counts complete image tiles.
// Keeps at most 12 bytes, even for jumbo images and fragmented WebSocket messages.
class TileObserver {
  constructor(){this.header=Buffer.alloc(12);this.reset();}
  reset(){this.have=0;this.need=4;this.remaining=null;this.tile=false;}
  feed(data){let offset=0,complete=false;
    while(offset<data.length){
      if(this.remaining===null){
        const take=Math.min(this.need-this.have,data.length-offset);
        data.copy(this.header,this.have,offset,offset+take);this.have+=take;offset+=take;
        if(this.have<this.need)continue;
        if(this.need===4&&this.header.readUInt16BE(0)===27&&this.header.readUInt16BE(2)===8){this.need=12;continue;}
        const jumbo=this.need===12;const length=jumbo?8+this.header.readUInt32BE(4):this.header.readUInt16BE(2);
        const command=this.header.readUInt16BE(jumbo?8:0);
        if(length<this.need||length>32*1024*1024)throw Error('Invalid KVM size');
        this.tile=command===3&&length>=(jumbo?16:8);this.remaining=length-this.have;
      }
      const take=Math.min(this.remaining,data.length-offset);offset+=take;this.remaining-=take;
      if(this.remaining===0){complete=complete||this.tile;this.reset();}
    }
    return complete;
  }
}
function viewerBinaryAllowed(data,s){
  // Display settings/refresh and monitor selection; no files, clipboard or command channels.
  const displaySizes=new Map([[5,10],[6,4],[8,5],[11,4],[12,6],[14,4]]);
  for(let p=0;p<data.length;){
    if(data.length-p<4)return false;const cmd=data.readUInt16BE(p),size=data.readUInt16BE(p+2);
    if(size<4||p+size>data.length)return false;
    const input=(cmd===1&&size===6)||(cmd===2&&[10,12].includes(size))||(cmd===85&&size===7);
    const query=cmd===87&&size===5&&data[p+4]===2;
    if(displaySizes.get(cmd)!==size&&!query&&!(input&&!s.viewOnly&&s.state==='ACTIVE'))return false;
    p+=size;
  }return true;
}
function data(obj,packet){
  const s=sessionFor(obj);if(!s)return true;
  if(!alive(s))return false;
  const fromViewer=obj===s.relay;
  const b=Buffer.isBuffer(packet)?packet:Buffer.from(packet);
  if(b.length===0)return false;
  if(b[0]===123){
    if(b.length>16384)return false;
    let msg;try{msg=JSON.parse(b.toString('utf8'));}catch{return false;}
    if(fromViewer){
      if(['ping','pong','rtt'].includes(msg.type))return true;
      // Stock viewer negotiates desktop options. No WebRTC or alternate transport.
      if(msg.type==='options')return Object.keys(msg).every(k=>['type','ctrlChannel','consent'].includes(k)) && (msg.consent===undefined || (Number.isInteger(msg.consent) && msg.consent>=0));
      return false;
    }
    if(msg.ctrlChannel=='102938'&&msg.type==='console'){
      if(msg.msgid===1)s.state='AWAITING_CONSENT';
      if(msg.msgid===0){s.consentAt=now();s.state='CONSENTED';}
      if(msg.msgid===2){finish(s,'REJECTED');return false;}
    }
    return ['console','rtt','ping','pong','metadata'].includes(msg.type);
  }
  if(fromViewer){
    if(b.length===1&&b[0]===50)return true; // Existing desktop protocol negotiation "2".
    return viewerBinaryAllowed(b,s);
  }
  if(!s.consentAt){finish(s,'CONSENT_MISSING');return false;}
  try{
    if(!obj.uaiTiles)obj.uaiTiles=new TileObserver();
    if(obj.uaiTiles.feed(b)){if(!s.startedAt)s.startedAt=now();s.state='ACTIVE';}
  }catch{finish(s,'PROTOCOL_ERROR');return false;}
  return true;
}
function probe(s) {
  for (const endpoint of [s.relay, s.relay && s.relay.peer]) {
    const ws=endpoint?.ws;
    if (!ws || typeof ws.ping!=='function') continue;
    if (!endpoint.uaiHealth) {
      endpoint.uaiHealth={pong:now(),ping:0};
      ws.on('pong',()=>{endpoint.uaiHealth.pong=now();});
    }
    const health=endpoint.uaiHealth;
    if(now()-health.pong>10000){finish(s,'CONNECTION_LOST');return;}
    if(now()-health.ping>3000){health.ping=now();try{ws.ping();}catch{finish(s,'CONNECTION_LOST');}}
  }
}
const timer=setInterval(()=>{for(const [id,s] of sessions){if(alive(s))probe(s);if(s.endedAt&&now()-s.endedAt>RETAIN_MS)sessions.delete(id);}},500);timer.unref();
module.exports={register,status,attach,data,disconnected,agentEvent,TileObserver,
  capabilities:()=>({version:1,leaseSeconds:LEASE_MS/1000,oneConnection:true,relayTelemetry:true})};
