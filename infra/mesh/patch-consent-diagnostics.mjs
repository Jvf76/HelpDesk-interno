// Diagnostic-only instrumentation of the version-pinned JS core. Never approves a prompt.
import fs from 'node:fs';import {fileURLToPath} from 'node:url';
function instrumentV2(source){
 let s=source.replaceAll('\r\n','\n');
 if(s.includes('// UAI consent diagnostics v2'))return s;
 const upgrade=s.includes('// UAI consent diagnostics v1');
 function edit(from,to){if(s.split(from).length!==2)throw Error('Unexpected consent diagnostic anchor');s=s.replace(from,to);}
 const helper=`// UAI consent diagnostics v2
function uaiConsentDiagnostic(ws, stage, promise) {
    if (!ws || !ws.httprequest || !/ • Uai [0-9a-f-]{36}$/i.test(ws.httprequest.guestname || '')) return;
    try {
        var users = null; try { users = require('user-sessions'); } catch (ignore) { }
        var target = typeof ws.tsid == 'number' ? ws.tsid : -1;
        var own = -1; try { own = users.getProcessOwnerName(process.pid).tsid; } catch (ignore) { }
        var active = -1; try { active = users.consoleUid(); } catch (ignore) { }
        var child = promise && promise._ipc && promise._ipc._proc;
        var pid = child && typeof child.pid == 'number' ? child.pid : -1;
        var actual = -1; if (pid > 0) { try { actual = users.getProcessOwnerName(pid).tsid; } catch (ignore) { } }
        MeshServerLogEx(9100, [stage, target, own, active, pid, actual], 'UAI_NATIVE_CONSENT', ws.httprequest);
    } catch (ignore) { /* Diagnostic failure never resolves or rejects consent. */ }
}
function uaiConsentFailure(ws, stage, error) {
    if (!ws || !ws.httprequest || !/ • Uai [0-9a-f-]{36}$/i.test(ws.httprequest.guestname || '')) return;
    try {
        var kind = 'UNKNOWN', field = 'NONE', code = -1;
        if (error && ['Error','TypeError','RangeError','ReferenceError','SyntaxError','EvalError','URIError'].indexOf(error.name) >= 0) kind = error.name;
        var fields = ['win32Error','lastError','errorCode','errno','code'];
        var codes = [2,3,5,6,8,87,1008,1314,1816,-2147024891];
        for (var i=0; error && i<fields.length; ++i) {
            if (typeof error[fields[i]] == 'number' && codes.indexOf(error[fields[i]]) >= 0) { field=fields[i]; code=error[field]; break; }
        }
        MeshServerLogEx(9101, [stage,kind,field,code], 'UAI_NATIVE_CONSENT_FAILURE', ws.httprequest);
    } catch (ignore) { /* Never serialize error text, stack, or arbitrary properties. */ }
}
`;
 if(upgrade) {
  const start=s.indexOf('// UAI consent diagnostics v1');
  const end=s.indexOf('function kvm_consent_ask(ws){',start);
  if(end<0)throw Error('Missing v1 diagnostic boundary');
  s=s.slice(0,start)+helper+'\n'+s.slice(end);
 }else {
 edit('function kvm_consent_ask(ws){',helper+"\nfunction kvm_consent_ask(ws){\n    uaiConsentDiagnostic(ws, 'REQUESTED', null);");
 edit("    pr.then(kvm_consentpromise_resolved, kvm_consentpromise_rejected);",`    uaiConsentDiagnostic(ws, 'HELPER_CREATED', pr);
    if (pr._ipc && typeof pr._ipc.on == 'function') {
        pr._ipc.on('ready', function () { uaiConsentDiagnostic(this.master && this.master.ws, 'HELPER_READY', this.master); });
    }
    pr.then(kvm_consentpromise_resolved, kvm_consentpromise_rejected);`);
 edit('function kvm_consentpromise_rejected(e)\n{','function kvm_consentpromise_rejected(e)\n{\n    uaiConsentDiagnostic(this.ws, \'RESPONSE_REJECTED\', this);');
 edit('function kvm_consentpromise_resolved(always)\n{','function kvm_consentpromise_resolved(always)\n{\n    uaiConsentDiagnostic(this.ws, \'RESPONSE_ACCEPTED\', this);');
 }
 edit("    uaiConsentDiagnostic(ws, 'REQUESTED', null);", "    uaiConsentDiagnostic(ws, 'REQUESTED', null);\n    try {");
 edit("    pr.then(kvm_consentpromise_resolved, kvm_consentpromise_rejected);\n}", "    pr.then(kvm_consentpromise_resolved, kvm_consentpromise_rejected);\n    } catch (uaiCreateError) {\n        uaiConsentFailure(ws, 'CREATE_FAILED', uaiCreateError);\n        throw uaiCreateError; // Preserve upstream failure; never continue without consent.\n    }\n}");
 edit("    uaiConsentDiagnostic(this.ws, 'RESPONSE_REJECTED', this);", "    uaiConsentDiagnostic(this.ws, 'RESPONSE_REJECTED', this);\n    uaiConsentFailure(this.ws, 'PROMISE_REJECTED', e);");
 return s;
}
// Retain v2 events and the exact native calls. Locate a synchronous failure without
// exporting its message, path, arguments or stack, and without reading GetLastError
// after intervening calls (which would not reliably describe the failed operation).
export function instrument(source){
 let s=source.replaceAll('\r\n','\n');
 if(s.includes('// UAI consent diagnostics v3'))return s;
 s=instrumentV2(s);
 function edit(from,to){if(s.split(from).length!==2)throw Error('Unexpected v3 diagnostic anchor');s=s.replace(from,to);}
 edit('// UAI consent diagnostics v2','// UAI consent diagnostics v3');
 const helper=`function uaiConsentFailureStep(ws, step, error) {
    if (!ws || !ws.httprequest || !/ • Uai [0-9a-f-]{36}$/i.test(ws.httprequest.guestname || '')) return;
    try {
        var shape = error === null ? 'null' : typeof error;
        if (['null','string','object','undefined','number','boolean'].indexOf(shape) < 0) shape = 'OTHER';
        var text = typeof error == 'string' ? error : (error && typeof error.message == 'string' ? error.message : '');
        var category = 'UNCLASSIFIED';
        if (text.length <= 4096) {
            if (/^(?:Error: )?child_process\\.execFile\\(\\): Could not exec \\[[^\\r\\n]{1,2048}\\]$/.test(text)) category = 'CHILD_EXEC_FAILED';
            else if (text === 'Invalid Parameters') category = 'CHILD_ARGUMENTS_INVALID';
            else if (text === 'Insufficient permission to run as this user') category = 'CHILD_USER_PERMISSION';
            else if (text === 'invalid user format') category = 'CHILD_USER_FORMAT';
            else if (text === 'Not Connected') category = 'CHILD_IPC_DISCONNECTED';
        }
        MeshServerLogEx(9102, ['CREATE_FAILED',step,shape,category], 'UAI_NATIVE_CONSENT_FAILURE_STEP', ws.httprequest);
    } catch (ignore) { /* Preserve the original exception even if diagnostics fail. */ }
}
`;
 edit('function kvm_consent_ask(ws){',helper+'\nfunction kvm_consent_ask(ws){');
 const start=s.indexOf('function kvm_consent_ask(ws){'),end=s.indexOf('function kvm_consentpromise_rejected',start);
 if(end<0)throw Error('Missing consent function boundary');
 let body=s.slice(start,end);
 function locate(from,to,count=1){if(body.split(from).length!==count+1)throw Error('Unexpected native consent step anchor');body=body.replaceAll(from,to);}
 locate("    try {\n    // Send a console message", "    var uaiStep = 'WAITING_NOTIFICATION';\n    try {\n    // Send a console message");
 locate("    var consentMessage =", "    uaiStep = 'PROMPT_TEXT';\n    var consentMessage =");
 locate("    var pr;", "    uaiStep = 'ENGINE_SELECTION';\n    var pr;");
 locate("            var ipr = server_getUserImage", "            uaiStep = 'ENHANCED_USER_IMAGE';\n            var ipr = server_getUserImage");
 locate("            pr = ipr.then", "            uaiStep = 'ENHANCED_PROMISE';\n            pr = ipr.then");
 locate("pr = require('message-box').create(consentTitle, consentMessage, ws.httprequest.consentTimeout, null, ws.tsid);", "uaiStep = 'CLASSIC_MODULE';\n            var uaiMessageBox = require('message-box');\n            uaiStep = 'CLASSIC_CREATE';\n            pr = uaiMessageBox.create(consentTitle, consentMessage, ws.httprequest.consentTimeout, null, ws.tsid);",2);
 locate('    pr.ws = ws;', "    uaiStep = 'PROMISE_ATTACH';\n    pr.ws = ws;");
 locate('    ws.pause();', "    uaiStep = 'STREAM_PAUSE';\n    ws.pause();");
 locate("    ws.prependOnceListener('end'", "    uaiStep = 'END_HANDLER';\n    ws.prependOnceListener('end'");
 locate('    pr.then(kvm_consentpromise_resolved, kvm_consentpromise_rejected);', "    uaiStep = 'CONSENT_CALLBACKS';\n    pr.then(kvm_consentpromise_resolved, kvm_consentpromise_rejected);");
 locate("        uaiConsentFailure(ws, 'CREATE_FAILED', uaiCreateError);", "        uaiConsentFailure(ws, 'CREATE_FAILED', uaiCreateError);\n        uaiConsentFailureStep(ws, uaiStep, uaiCreateError);");
 return s.slice(0,start)+body+s.slice(end);
}
// Adds logging only to an existing relay, including the older LAB implementation.
// Does not replace its policy, state machine, deadlines or capability version.
export function instrumentRelay(source){
 const call="    if (require('./uai-native-diagnostics.cjs').recordNativeDiagnostic(s,event)) return;";
 if(source.includes(call))return source;
 let s=source;
 const oldStart=s.indexOf('    if(event.msgid===9100&&');
 if(oldStart>=0){
  const oldEnd=s.indexOf('    // Native agent logs',oldStart);
  if(oldEnd<0)throw Error('Missing old diagnostic boundary');
  s=s.slice(0,oldStart)+s.slice(oldEnd);
 }
 const anchor="    if (s.node!==event.nodeid || s.guest!==event.guestname) continue;";
 if(s.split(anchor).length!==2)throw Error('Unexpected relay diagnostic anchor');
 return s.replace(anchor,anchor+'\n'+call);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=new URL('./node_modules/meshcentral/',import.meta.url);
 if(JSON.parse(fs.readFileSync(new URL('package.json',root))).version!=='1.3.1')throw Error('Unsupported core version');
 const file=new URL('agents/meshcore.js',root);fs.writeFileSync(file,instrument(fs.readFileSync(file,'utf8')));
 fs.copyFileSync(file,new URL('agents/meshcore.min.js',root));
 const relay=new URL('uai-session.cjs',root);fs.writeFileSync(relay,instrumentRelay(fs.readFileSync(relay,'utf8')));
 fs.copyFileSync(new URL('./uai-native-diagnostics.cjs',import.meta.url),new URL('uai-native-diagnostics.cjs',root));
 console.log('Uai: native consent diagnostic hooks installed; no approval policy changed.');
}
