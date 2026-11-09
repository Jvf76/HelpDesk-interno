// Diagnostics only. Never changes frame acceptance, consent, input or timeouts.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function patchKvmDiagnostics(code){
 if(code.includes('// Uai bounded KVM diagnostics v1'))return code;
 const edits=[
  ["privacyBar:s.privacy,firstFrame:!!s.startedAt", "privacyBar:s.privacy,firstFrame:!!s.startedAt,kvmFailure:s.kvmFailure||null"],
  ["if(length<this.need||length>32*1024*1024)throw Error('Invalid KVM size');", "if(length<this.need)throw Error('KVM_LENGTH_BELOW_HEADER');\n        if(length>32*1024*1024)throw Error('KVM_LENGTH_ABOVE_LIMIT');"],
  ["}catch{finish(s,'PROTOCOL_ERROR');return false;}", "}catch(e){s.kvmFailure=['KVM_LENGTH_BELOW_HEADER','KVM_LENGTH_ABOVE_LIMIT'].includes(e?.message)?e.message:'KVM_OBSERVER_EXCEPTION';finish(s,'PROTOCOL_ERROR');return false;}"]
 ];
 for(const [from,to] of edits){if(code.split(from).length!==2)throw Error('Unexpected KVM diagnostic anchor');code=code.replace(from,to);}
 return '// Uai bounded KVM diagnostics v1\n'+code;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2];if(!file)throw Error('Explicit relay path required');
 fs.writeFileSync(file,patchKvmDiagnostics(fs.readFileSync(file,'utf8')));
}
