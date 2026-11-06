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
 assert.equal(events.length,2);
 assert.deepEqual(Array.from(events[1][1]),['REQUESTED',-1,-1,-1,-1,-1]); // unavailable fields stay unknown
});

test('synchronous native creation failure is logged without text and rethrown unchanged',async()=>{
 const {instrument}=await import('../patch-consent-diagnostics.mjs');
 const source=instrument(fs.readFileSync(require.resolve('meshcentral/agents/meshcore.js'),'utf8'));
 const snippet=source.slice(source.indexOf('function uaiConsentDiagnostic('),source.indexOf('function kvm_consentpromise_rejected'));
 const failure=Object.assign(new Error('secret-cookie-must-not-escape'),{code:5});
 const events=[];let nativeCalls=0;
 const context={
  process:{pid:42,platform:'win32'},currentTranslation:{desktopConsent:'Request from {0}'},
  require:name=>{
   if(name==='user-sessions')return {getProcessOwnerName:()=>({tsid:0}),consoleUid:()=>3};
   if(name==='message-box')return {create:()=>{nativeCalls++;throw failure;}};
   throw Error('Unexpected module');
  },
  MeshServerLogEx:(...args)=>events.push(args)
 };
 vm.runInNewContext(snippet,context);
 const ws={write:()=>{},httprequest:{oldStyle:true,consentTimeout:30,consentAutoAccept:false,guestname:'TI • Uai 11111111-1111-4111-8111-111111111111',realname:'LAB',username:'LAB'}};
 assert.throws(()=>context.kvm_consent_ask(ws),e=>e===failure);
 assert.equal(nativeCalls,1);
 assert.equal(events[0][0],9100);assert.equal(events[1][0],9101);
 assert.deepEqual(Array.from(events[1][1]),['CREATE_FAILED','Error','code',5]);
 assert(!JSON.stringify(events).includes('secret-cookie'));
});
test('relay diagnostic parser is bounded, sanitized and cannot authorize or revive sessions',()=>{
 const {recordNativeDiagnostic}=require('../uai-native-diagnostics.cjs');
 const guest='TI • Uai 11111111-1111-4111-8111-111111111111';
 const s={guest,node:'test',state:'AWAITING_CONSENT',consentAt:null};
 const event={guestname:guest,nodeid:'test',msgid:9101,msgArgs:['CREATE_FAILED','Error','code',5]};
 const lines=[];const log=line=>lines.push(line);
 assert.equal(recordNativeDiagnostic(s,event,log),true);
 assert.equal(s.state,'AWAITING_CONSENT');assert.equal(s.consentAt,null);
 recordNativeDiagnostic(s,{...event,nodeid:'other'},log);
 recordNativeDiagnostic(s,{...event,msgArgs:['CREATE_FAILED','secret','code',5]},log);
 assert.equal(lines.length,1);
 s.state='ENDED';
 for(let i=0;i<100;i++)recordNativeDiagnostic(s,event,log);
 assert.equal(lines.length,64);assert.equal(s.state,'ENDED');
 assert.equal(recordNativeDiagnostic(s,{...event,msgid:30},log),false);
});
test('patching a legacy relay adds only the logging hook; idempotent',async()=>{
 const {instrumentRelay}=await import('../patch-consent-diagnostics.mjs');
 const legacy="function agentEvent(event) {\n  for (const s of sessions.values()) {\n    if (s.node!==event.nodeid || s.guest!==event.guestname) continue;\n    // Native agent logs\n    original(event);\n  }\n}";
 const patched=instrumentRelay(legacy);
 assert.equal(instrumentRelay(patched),patched);new vm.Script(patched);
 assert.equal(patched.replace("\n    if (require('./uai-native-diagnostics.cjs').recordNativeDiagnostic(s,event)) return;",''),legacy);
 assert.throws(()=>instrumentRelay('unknown upstream'),/Unexpected relay/);
});
