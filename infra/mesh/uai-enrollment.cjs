// Uai Telecom: ephemeral binding proofs. No commands, desktop access or credentials issued here.
'use strict';
const crypto=require('node:crypto');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
class Enrollment {
 constructor(now=Date.now){this.now=now;this.pending=new Map();}
 prune(){for(const [id,x] of this.pending)if(x.expires<=this.now())this.pending.delete(id);}
 begin(owner,device,meshid){
  this.prune();if(!/^user\//.test(owner)||!/^mesh\//.test(meshid)||! /^[0-9a-f-]{36}$/.test(device))throw Error('Invalid binding');
  const key=owner+':'+device;
  if(this.pending.size>=1000&&!this.pending.has(key))throw Error('Capacity');
  const secret=crypto.randomBytes(32).toString('hex'),expires=this.now()+120000;
  this.pending.set(key,{owner,device,meshid,hash:digest(secret),expires,node:null});
  return {secret,expires};
 }
 prove(agent,secret){
  this.prune();if(agent.authenticated!==2||!/^node\//.test(agent.dbNodeKey||'')||typeof secret!=='string'||! /^[a-f0-9]{64}$/.test(secret))return false;
  const hash=digest(secret);
  for(const x of this.pending.values())if(x.meshid===agent.dbMeshKey&&x.hash===hash){
   if(x.node&&x.node!==agent.dbNodeKey)return false;
   x.node=agent.dbNodeKey;return true;
  }
  return false;
 }
 status(owner,device){this.prune();const x=this.pending.get(owner+':'+device);return x?{node:x.node,expires:x.expires}:{node:null,expires:0};}
 cancel(owner,device){this.pending.delete(owner+':'+device);}
}
module.exports=new Enrollment();module.exports.Enrollment=Enrollment;
