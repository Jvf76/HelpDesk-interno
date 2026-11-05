// Diagnostic-only instrumentation of the version-pinned JS core. Never approves a prompt.
import fs from 'node:fs';import {fileURLToPath} from 'node:url';
export function instrument(source){
 let s=source.replaceAll('\r\n','\n');
 if(s.includes('// UAI consent diagnostics v1'))return s;
 function edit(from,to){if(s.split(from).length!==2)throw Error('Unexpected consent diagnostic anchor');s=s.replace(from,to);}
 const helper=`// UAI consent diagnostics v1
function uaiConsentDiagnostic(ws, stage, promise) {
    if (!ws || !ws.httprequest || !/ • Uai [0-9a-f-]{36}$/i.test(ws.httprequest.guestname || '')) return;
    try {
        var users = require('user-sessions');
        var target = typeof ws.tsid == 'number' ? ws.tsid : -1;
        var own = -1; try { own = users.getProcessOwnerName(process.pid).tsid; } catch (ignore) { }
        var active = -1; try { active = users.consoleUid(); } catch (ignore) { }
        var child = promise && promise._ipc && promise._ipc._proc;
        var pid = child && typeof child.pid == 'number' ? child.pid : -1;
        var actual = -1; if (pid > 0) { try { actual = users.getProcessOwnerName(pid).tsid; } catch (ignore) { } }
        MeshServerLogEx(9100, [stage, target, own, active, pid, actual], 'UAI_NATIVE_CONSENT', ws.httprequest);
    } catch (ignore) { /* Diagnostic failure never resolves or rejects consent. */ }
}
`;
 edit('function kvm_consent_ask(ws){',helper+"\nfunction kvm_consent_ask(ws){\n    uaiConsentDiagnostic(ws, 'REQUESTED', null);");
 edit("    pr.then(kvm_consentpromise_resolved, kvm_consentpromise_rejected);",`    uaiConsentDiagnostic(ws, 'HELPER_CREATED', pr);
    if (pr._ipc && typeof pr._ipc.on == 'function') {
        pr._ipc.on('ready', function () { uaiConsentDiagnostic(this.master && this.master.ws, 'HELPER_READY', this.master); });
    }
    pr.then(kvm_consentpromise_resolved, kvm_consentpromise_rejected);`);
 edit('function kvm_consentpromise_rejected(e)\n{','function kvm_consentpromise_rejected(e)\n{\n    uaiConsentDiagnostic(this.ws, \'RESPONSE_REJECTED\', this);');
 edit('function kvm_consentpromise_resolved(always)\n{','function kvm_consentpromise_resolved(always)\n{\n    uaiConsentDiagnostic(this.ws, \'RESPONSE_ACCEPTED\', this);');
 return s;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=new URL('./node_modules/meshcentral/',import.meta.url);
 if(JSON.parse(fs.readFileSync(new URL('package.json',root))).version!=='1.3.1')throw Error('Unsupported core version');
 const file=new URL('agents/meshcore.js',root);fs.writeFileSync(file,instrument(fs.readFileSync(file,'utf8')));
 fs.copyFileSync(file,new URL('agents/meshcore.min.js',root));
 console.log('Uai: native consent diagnostic hooks installed; no approval policy changed.');
}
