// Read-only preparation against a running LAB installation. Never deploys or restarts it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {instrument,instrumentRelay} from '../infra/mesh/patch-consent-diagnostics.mjs';
const [liveArg,outArg]=process.argv.slice(2);
if(!liveArg||!outArg)throw Error('Usage: node prepare-native-consent-diagnostic.mjs LIVE_PACKAGE NEW_OUTPUT');
const live=fs.realpathSync(liveArg),out=path.resolve(outArg);
if(fs.existsSync(out)||out===live||out.startsWith(live+path.sep))throw Error('Output must be a new directory outside the live runtime');
if(JSON.parse(fs.readFileSync(path.join(live,'package.json'),'utf8')).version!=='1.3.1')throw Error('Unsupported MeshCentral version');
const regular=fs.readFileSync(path.join(live,'agents/meshcore.js'),'utf8');
const preferred=fs.readFileSync(path.join(live,'agents/meshcore.min.js'),'utf8');
if(regular!==preferred)throw Error('Live core variants differ; investigate before staging');
const oldRelay=fs.readFileSync(path.join(live,'uai-session.cjs'),'utf8');
const newRelay=instrumentRelay(oldRelay),newCore=instrument(regular);
for(const source of [newRelay,newCore])new vm.Script(source);
const files={
 'agents/meshcore.js':newCore,
 'agents/meshcore.min.js':newCore,
 'uai-session.cjs':newRelay,
 'uai-native-diagnostics.cjs':fs.readFileSync(new URL('../infra/mesh/uai-native-diagnostics.cjs',import.meta.url),'utf8')
};
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const manifest={status:'PREPARED_NOT_DEPLOYED',meshCentral:'1.3.1',createdAt:new Date().toISOString(),live,files:[],effects:['Native core delivered to connected agents after a future authorized deployment.','Only diagnostics change; existing relay policy and deadlines remain.','No backend, database, frontend, EXE, signature, service or Job Object change.']};
fs.mkdirSync(out,{recursive:true,mode:0o700});
for(const [name,source] of Object.entries(files)){
 const old=path.join(live,name),candidate=path.join(out,'candidate',name),backup=path.join(out,'backup',name);
 const before=fs.existsSync(old)?fs.readFileSync(old):null;
 fs.mkdirSync(path.dirname(candidate),{recursive:true});fs.writeFileSync(candidate,source);
 if(before!==null){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,before);}
 manifest.files.push({name,before:before===null?null:sha(before),after:sha(Buffer.from(source))});
}
for(const file of manifest.files){
 const original=path.join(live,file.name);
 if((fs.existsSync(original)?sha(fs.readFileSync(original)):null)!==file.before)throw Error('Live file changed during snapshot; do not deploy');
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared, not deployed:',out);
console.log('Candidate files:',manifest.files.length);
