const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('core diagnostic patch preserves native acceptance callbacks and is idempotent',async()=>{
 const {instrument}=await import('../patch-consent-diagnostics.mjs');
 const file=require.resolve('meshcentral/agents/meshcore.js');const source=fs.readFileSync(file,'utf8');
 const patched=instrument(source);assert.equal(instrument(patched),patched);new vm.Script(patched);
 assert.ok(patched.includes("pr.then(kvm_consentpromise_resolved, kvm_consentpromise_rejected)"));
 const helper=patched.slice(patched.indexOf('function uaiConsentDiagnostic('),patched.indexOf('\nfunction kvm_consent_ask'));
 const events=[];const context={process:{pid:42},require:()=>({getProcessOwnerName:pid=>({tsid:pid===42?0:2}),consoleUid:()=>2}),MeshServerLogEx:(...x)=>events.push(x)};
 vm.runInNewContext(helper,context);context.uaiConsentDiagnostic({tsid:2,httprequest:{guestname:'TI • Uai 11111111-1111-4111-8111-111111111111'}},'HELPER_READY',{_ipc:{_proc:{pid:55}}});
 assert.equal(events[0][0],9100);assert.deepEqual(Array.from(events[0][1]),['HELPER_READY',2,0,2,55,2]);
 context.require=()=>{throw Error('unsupported legacy API')};
 assert.doesNotThrow(()=>context.uaiConsentDiagnostic({httprequest:{guestname:'TI • Uai 11111111-1111-4111-8111-111111111111'}},'REQUESTED',null));
 assert.equal(events.length,1); // no invented fallback evidence or consent changes
});
