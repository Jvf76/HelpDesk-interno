const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('KVM diagnostic preserves parsing, exposes only closed error codes and is idempotent',async()=>{
 const {patchKvmDiagnostics}=await import('../patch-kvm-diagnostics.mjs');
 const original=fs.readFileSync(require.resolve('../uai-session.cjs'),'utf8');
 const patched=patchKvmDiagnostics(original);
 assert.equal(patchKvmDiagnostics(patched),patched);
 const source=patched.slice(patched.indexOf('class TileObserver {'),patched.indexOf('function viewerBinaryAllowed'));
 const Observer=vm.runInNewContext(source+';TileObserver',{Buffer});
 assert.throws(()=>new Observer().feed(Buffer.from([0,3,0,1])),/KVM_LENGTH_BELOW_HEADER/);
 const huge=Buffer.alloc(12);huge.writeUInt16BE(27);huge.writeUInt16BE(8,2);huge.writeUInt32BE(40*1024*1024,4);
 assert.throws(()=>new Observer().feed(huge),/KVM_LENGTH_ABOVE_LIMIT/);
 const tile=Buffer.from([0,3,0,10,0,0,0,0,255,217]);
 assert.equal(new Observer().feed(tile),true);
 // Reproduce a possible framing mismatch, not a capture from the real computer.
 assert.equal(new Observer().feed(Buffer.concat([tile,Buffer.alloc(6)])),true);
 assert(patched.includes("finish(s,'PROTOCOL_ERROR');return false;"));
 assert.throws(()=>patchKvmDiagnostics('unexpected upstream'),/Unexpected/);
});
