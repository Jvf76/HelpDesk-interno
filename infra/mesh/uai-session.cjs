// Uai bounded KVM diagnostics v1
'use strict';
// Uai Telecom: metadata and lease enforcement around the existing MeshCentral relay.
// No image/input contents are retained. No cryptographic or desktop protocol replacement.
const sessions = new Map();
const LEASE_MS = 12000;
const RETAIN_MS = 15 * 60 * 1000;
const marker = / • Uai [0-9a-f-]{36}$/i;
const now = () => Date.now();
const PHASE_MS={READY:15000,CONNECTING:15000,AWAITING_CONSENT:35000,CONSENTED:15000,AWAITING_RENDER:10000};
function transition(s,next){
 if(s.state===next)return;
 const allowed={READY:['CONNECTING'],CONNECTING:['AWAITING_CONSENT','CONSENTED'],AWAITING_CONSENT:['CONSENTED'],CONSENTED:['AWAITING_RENDER'],AWAITING_RENDER:['ACTIVE'],ACTIVE:[]};
 if(!allowed[s.state]?.includes(next))return false;
 const previous=s.state,at=now();s.state=next;
 console.info('UAI_RELAY_TRANSITION '+JSON.stringify({session:s.guest.slice(-36),previous,next,component:'MESH_RELAY',at,elapsedMs:at-s.phaseAt,mode:s.viewOnly?'VIEW':'CONTROL'}));
 if(next==='ACTIVE'&&!s.activatedAt){s.activatedAt=at;s.activeUntil=at+60000;s.expiresAt=s.activeUntil;try{s.relay.ws.send(JSON.stringify({ctrlChannel:'102938',type:'metadata',uaiActiveUntil:s.activeUntil}));}catch{finish(s,'CONNECTION_LOST');return false;}}
 s.phaseAt=at;s.phaseDeadline=PHASE_MS[next]?at+PHASE_MS[next]:null;return true;
}
function nativeAccepted(s){if(!s.consentAt)s.consentAt=now();if(['CONNECTING','AWAITING_CONSENT'].includes(s.state))transition(s,'CONSENTED');}
function activate(s){if(s.renderedAt&&s.privacy&&s.consentAt&&s.tileAt)transition(s,'ACTIVE');}

function finish(s, reason) {
  if (!s || s.state === 'ENDED') return;
  const lastState=s.state;
  s.state = 'ENDED';
  // Terminate transport before reporting completion, including half-open sockets.
  for (const endpoint of [s.relay, s.relay && s.relay.peer]) {
    try { endpoint?.ws?.terminate(); } catch {}
  }
  s.reason = reason; s.endedAt = now();
  for (const close of s.closers) { try { close(); } catch {} }
  s.closers.clear();
  // One bounded metadata record per session. Never log cookies, URLs, names or packet contents.
  console.info('UAI_RELAY_DIAGNOSTIC '+JSON.stringify({session:s.guest.slice(-36),lastState,reason,
    viewerAttached:!!s.relay,peerPaired:!!s.relay?.peer,viewerMessages:s.viewerMessages,
    agentMessages:s.agentMessages,protocolRequested:s.protocolRequested,
    nativeConsentRequested:s.nativeConsentRequested,nativeConsentGranted:!!s.consentAt,
    privacyBar:s.privacy,firstFrame:!!s.startedAt,kvmFailure:s.kvmFailure||null}));
}
function alive(s) {
  if (!s || s.state === 'ENDED') return false;
  if (s.expiresAt <= now()) finish(s, 'EXPIRED');
  else if (s.leaseUntil <= now()) finish(s, 'LEASE_LOST');
  else if(s.phaseDeadline&&s.phaseDeadline<=now())finish(s,({READY:'TRANSPORT_TIMEOUT',CONNECTING:'TRANSPORT_TIMEOUT',AWAITING_CONSENT:'ENGINE_CONSENT_TIMEOUT',CONSENTED:'FIRST_FRAME_TIMEOUT',AWAITING_RENDER:'RENDER_TIMEOUT'})[s.state]||'PROTOCOL_ERROR');
  return s.state !== 'ENDED';
}
function register(entry) {
  if (!marker.test(entry.guestName || '')) return;
  if (entry.p !== 2 || entry.consent !== 72 || !Number.isFinite(entry.expireTime) || entry.expireTime > now() + 181000) throw Error('Invalid Uai share policy');
  if(sessions.has(entry.publicid))throw Error('Attempt already registered');
  sessions.set(entry.publicid, {id:entry.publicid, owner:entry.userid, node:entry.nodeid,
    guest:entry.guestName, viewOnly:entry.viewOnly === true, expiresAt:Math.min(entry.expireTime-60000,now()+120000),authorizationUntil:entry.expireTime,activeUntil:null,nativeDiagnostic:{},
    leaseUntil:now()+LEASE_MS,phaseAt:now(),phaseDeadline:now()+PHASE_MS.READY,tileAt:null,renderedAt:null, state:'READY', reason:null, startedAt:null, endedAt:null,
    consentAt:null, privacy:false, relay:null, closers:new Set(), viewerMessages:0,agentMessages:0,protocolRequested:false,nativeConsentRequested:false});
}
function snapshot(s) {
  return {state:s.state,reason:s.reason,startedAt:s.activatedAt||null,endedAt:s.endedAt,
    consentAt:s.consentAt,privacyBar:s.privacy,tileAt:s.tileAt,renderedAt:s.renderedAt,nativeDiagnostic:s.nativeDiagnostic,activeUntil:s.activeUntil,observedAt:now(),expiresAt:s.expiresAt};
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
  s.relay=obj; transition(s,'CONNECTING'); s.closers.add(close); obj.uaiShare=s;
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
    if (require('./uai-native-diagnostics.cjs').recordNativeDiagnostic(s,event)) return;
    // Native agent logs can arrive just after relay close. Refine the reason only.
    if (event.msgid===29 || event.msgid===34 || event.msgid===32) {
      const reason=event.msgid===29?'LOCAL_STOP':event.msgid===34?'REJECTED':'PRIVACY_BAR_FAILED';
      if (s.state==='ENDED' && ['DISCONNECTED','REJECTED'].includes(s.reason)) s.reason=reason;
      else finish(s,reason);
    } else if (alive(s)) {
      if (event.msgid===30) nativeAccepted(s);
      if (event.msgid===31) {s.privacy=true;activate(s);}
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
        if(length<this.need)throw Error('KVM_LENGTH_BELOW_HEADER');
        if(length>32*1024*1024)throw Error('KVM_LENGTH_ABOVE_LIMIT');
        this.packetLength=length;
        this.tile=command===3&&length>=(jumbo?16:8);this.remaining=length-this.have;
      }
      const take=Math.min(this.remaining,data.length-offset);offset+=take;this.remaining-=take;
      if(this.remaining===0){
        complete=complete||this.tile;
        // Match the existing viewer: allocation alignment bytes are not another
        // KVM command. Only skip the exact <=7 byte suffix at this message end.
        const padding=(8-(this.packetLength%8))%8;
        this.reset();
        if(padding>0&&data.length-offset===padding)return complete;
      }
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
    if(displaySizes.get(cmd)!==size&&!query&&!(input&&!s.viewOnly&&s.state==='ACTIVE'&&s.privacy&&s.consentAt))return false;
    p+=size;
  }return true;
}
function data(obj,packet){
  const s=sessionFor(obj);if(!s)return true;
  if(!alive(s))return false;
  const fromViewer=obj===s.relay;
  if(fromViewer)s.viewerMessages=Math.min(1000000,s.viewerMessages+1);else s.agentMessages=Math.min(1000000,s.agentMessages+1);
  const b=Buffer.isBuffer(packet)?packet:Buffer.from(packet);
  if(b.length===0)return false;
  if(b[0]===123){
    if(b.length>16384)return false;
    let msg;try{msg=JSON.parse(b.toString('utf8'));}catch{return false;}
    if(fromViewer){
      // Consumed here, never forwarded to the engine. No image contents or arbitrary telemetry.
      if(msg.type==='uai-rendered'){
        if(Object.keys(msg).some(k=>!['type','ctrlChannel'].includes(k))||!s.tileAt||!s.consentAt)return false;
        if(!s.renderedAt)s.renderedAt=now();activate(s);return false;
      }
      if(['ping','pong','rtt'].includes(msg.type))return true;
      // Stock viewer negotiates desktop options. No WebRTC or alternate transport.
      if(msg.type==='options')return Object.keys(msg).every(k=>['type','ctrlChannel','consent'].includes(k)) && (msg.consent===undefined || (Number.isInteger(msg.consent) && msg.consent===72));
      return false;
    }
    if(msg.type==='metadata'&&Object.hasOwn(msg,'uaiActiveUntil'))return false;
    if(msg.ctrlChannel=='102938'&&msg.type==='console'){
      if(msg.msgid===1){if(s.state==='CONNECTING')transition(s,'AWAITING_CONSENT');s.nativeConsentRequested=true;}
      if(msg.msgid===0&&s.nativeConsentRequested&&s.protocolRequested)nativeAccepted(s);
      if(msg.msgid===2){finish(s,'REJECTED');return false;}
    }
    return ['console','rtt','ping','pong','metadata'].includes(msg.type);
  }
  if(fromViewer){
    if(b.length===1&&b[0]===50){s.protocolRequested=true;return true;} // Existing desktop protocol negotiation "2".
    return viewerBinaryAllowed(b,s);
  }
  if(!s.consentAt){finish(s,'CONSENT_MISSING');return false;}
  try{
    if(!obj.uaiTiles)obj.uaiTiles=new TileObserver();
    if(obj.uaiTiles.feed(b)){if(!s.tileAt){s.tileAt=now();s.startedAt=s.tileAt;transition(s,'AWAITING_RENDER');}}
  }catch(e){s.kvmFailure=['KVM_LENGTH_BELOW_HEADER','KVM_LENGTH_ABOVE_LIMIT'].includes(e?.message)?e.message:'KVM_OBSERVER_EXCEPTION';finish(s,'PROTOCOL_ERROR');return false;}
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
  capabilities:()=>({version:3,renderAck:true,activeSeconds:60,setupSeconds:120,leaseSeconds:LEASE_MS/1000,oneConnection:true,relayTelemetry:true})};
// Desktop bootstrap uses the same guest-cookie fields as MeshCentral sharing.
// Only the owner of a live, not-yet-connected Uai share can obtain it.
module.exports.viewerCookie = function(owner,id,domain,ip) {
 const s=sessions.get(id);
 if(!alive(s)||s.owner!==owner||s.relay!==null||require('node:net').isIP(ip)===0) return null;
 return {userid:owner,domainid:domain,nid:s.node,ip,p:2,gn:s.guest,cf:72,r:8,
   expire:s.authorizationUntil,pid:s.id,vo:s.viewOnly?1:0};
};
