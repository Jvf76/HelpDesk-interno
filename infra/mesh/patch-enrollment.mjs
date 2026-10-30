import fs from 'node:fs';
const root=new URL('./node_modules/meshcentral/',import.meta.url);
if(JSON.parse(fs.readFileSync(new URL('package.json',root))).version!=='1.3.1')throw Error('Review enrollment patch');
fs.copyFileSync(new URL('./uai-enrollment.cjs',import.meta.url),new URL('uai-enrollment.cjs',root));
function patch(file,anchor,addition){const p=new URL(file,root);let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');if(s.includes(addition))return;if(s.split(anchor).length!==2)throw Error('Enrollment anchor: '+file);fs.writeFileSync(p,s.replace(anchor,addition+anchor));}
patch('meshuser.js',"            case 'uaiSessionCapabilities':",`            case 'uaiEnrollment': {
                const enrollment=require('./uai-enrollment.cjs');
                const group=Object.values(parent.meshes).find(m=>m.name==='Uai-Laboratorio'&&m.domain===domain.id&&m.mtype===2&&(parent.GetMeshRights(user,m)&8));
                let result={result:'Denied'};
                if(group&&typeof command.device==='string'&&/^[0-9a-f-]{36}$/.test(command.device))try {
                    if(command.operation==='begin'){
                        const proof=enrollment.begin(user._id,command.device,group._id);
                        const meshhex=Buffer.from(group._id.split('/')[2].replace(/@/g,'+').replace(/\\$/g,'/'),'base64').toString('hex');
                        const serverhex=Buffer.from(parent.agentCertificateHashBase64.replace(/@/g,'+').replace(/\\$/g,'/'),'base64').toString('hex');
                        result={result:'OK',...proof,msh:'MeshType=2\\r\\nMeshName=Uai-Laboratorio\\r\\nMeshID=0x'+meshhex+'\\r\\nServerID='+serverhex+'\\r\\nMeshServer=wss://mesh.internal:443/agent.ashx\\r\\n'};
                    }else if(command.operation==='status')result={result:'OK',...enrollment.status(user._id,command.device)};
                    else if(command.operation==='cancel'){enrollment.cancel(user._id,command.device);result={result:'OK'};}
                } catch {}
                ws.send(JSON.stringify({action:command.action,responseid:command.responseid,...result}));
                break;
            }
`);
patch('meshagent.js',"            switch (command.action) {",`            // Binding uses the authenticated native connection, never a node ID supplied by JSON.
            if(command.action==='uaiBindingProof'){require('./uai-enrollment.cjs').prove(obj,command.secret);return;}
`);
patch('agents/meshcore.js',"        // Server connected, send mesh core information",`        // Uai: one-use local proof file; only the dedicated receiver directory contains it.
        try {
            var uaiProofPath=process.execPath+'.uai-binding.json';
            var uaiProof=JSON.parse(require('fs').readFileSync(uaiProofPath).toString());
            if(typeof uaiProof.secret==='string'&&/^[a-f0-9]{64}$/.test(uaiProof.secret)&&uaiProof.expires>Date.now())
                mesh.SendCommand({action:'uaiBindingProof',secret:uaiProof.secret});
        } catch (uaiProofError) {} // No proof/secret in logs. Backend times out if proof is missing.
`);
console.log('Uai: authenticated MeshAgent binding proof installed.');

// MeshCentral prefers meshcore.min.js. Serve the reviewed patched core on both paths.
fs.copyFileSync(new URL('agents/meshcore.js',root),new URL('agents/meshcore.min.js',root));
