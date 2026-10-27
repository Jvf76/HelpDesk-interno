// Version-pinned patches; fail instead of silently installing incomplete session enforcement.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=new URL('./node_modules/meshcentral/',import.meta.url);
if(require('./node_modules/meshcentral/package.json').version!=='1.3.1')throw Error('Review session patch for this MeshCentral version');
const marker='// Uai Telecom session integration v1, 2026-10-27. Original Apache-2.0 notices preserved.\n';
function patch(file,edits){const path=new URL(file,root);let s=fs.readFileSync(path,'utf8').replaceAll('\r\n','\n');const notice=file.endsWith('.handlebars')?'<!-- Uai Telecom: sharing controls limited for laboratory MVP, Apache-2.0 notices preserved. -->\n':marker;if(s.startsWith(notice))return;
 for(const [from,to]of edits){if(s.split(from).length!==2)throw Error(`Unexpected upstream anchor in ${file}: ${from.slice(0,70)}`);s=s.replace(from,to);}fs.writeFileSync(path,notice+s);}
fs.copyFileSync(new URL('./uai-session.cjs',import.meta.url),new URL('uai-session.cjs',root));
patch('meshuser.js',[
 ["        switch (command.action) {",`        switch (command.action) {
            case 'uaiSessionCapabilities':
                ws.send(JSON.stringify({ action: command.action, responseid: command.responseid, result: 'OK', ...require('./uai-session.cjs').capabilities() }));
                break;
            case 'uaiSessionState':
                ws.send(JSON.stringify({ action: command.action, responseid: command.responseid, result: 'OK', session: require('./uai-session.cjs').status(user._id, command.publicid, command.renew === true, command.stop === true) }));
                break;`],
 ["                    parent.db.Set(shareEntry);","                    try { require('./uai-session.cjs').register(shareEntry); } catch (e) { ws.send(JSON.stringify({action:command.action,responseid:command.responseid,result:'Invalid Uai share policy'})); return; }\n                    parent.db.Set(shareEntry);"]
]);
patch('meshrelay.js',[
 ["    // Setup subscription for desktop sharing public identifier","    if (!require('./uai-session.cjs').attach(obj, cookie, closeBothSides)) { ws.close(); return; }\n\n    // Setup subscription for desktop sharing public identifier"],
 ["    ws.on('message', function (data) {\n","    ws.on('message', function (data) {\n        if (!require('./uai-session.cjs').data(obj, data)) return;"],
 ["    function closeBothSides() {","    function closeBothSides() {\n        require('./uai-session.cjs').disconnected(obj);"]
]);
patch('meshagent.js',[
 ["                            if ((typeof command.sessionid == 'string') && (command.sessionid.length < 500)) { event.sessionid = command.sessionid; }", "                            if ((typeof command.sessionid == 'string') && (command.sessionid.length < 500)) { event.sessionid = command.sessionid; }\n                            require('./uai-session.cjs').agentEvent(event);"]
]);
patch('agents/meshcore.js',[
 ["if (server_check_consentTimer(tunnel.userid))", "if (!/ • Uai [0-9a-f-]{36}$/i.test(tunnel.guestname || '') && server_check_consentTimer(tunnel.userid))"],
 ["    ws.httprequest.desktop.kvm.pipe(ws, { dataTypeSkip: 1 });", "    if (/ • Uai [0-9a-f-]{36}$/i.test(ws.httprequest.guestname || '') && !ws.httprequest.desktop.kvm.connectionBar) { ws.end(); return; }\n    ws.httprequest.desktop.kvm.pipe(ws, { dataTypeSkip: 1 });"],
 ["    this.ws.httprequest.desktop.kvm.pipe(this.ws, { dataTypeSkip: 1 });", "    if (/ • Uai [0-9a-f-]{36}$/i.test(this.ws.httprequest.guestname || '') && !this.ws.httprequest.desktop.kvm.connectionBar) { this.ws.end(); return; }\n    this.ws.httprequest.desktop.kvm.pipe(this.ws, { dataTypeSkip: 1 });"]
]);
console.log('Uai: relay telemetry, single connection, lease and mandatory privacy bar installed.');

patch('views/sharing.handlebars',[
 ["QV('DeskSaveImageButton', (deskState == 3) && (Q('Desk')['toBlob'] != null));", "QV('DeskSaveImageButton', false); // Screenshot export outside Uai MVP"],
 ["        function deskSaveImage() {","        function deskSaveImage() { return; // Export outside Uai MVP"],
 ['                        <option value=10>Ctrl+Alt+Del</option>', '                        <!-- Secure desktop control is outside the Uai MVP. -->']
]);
