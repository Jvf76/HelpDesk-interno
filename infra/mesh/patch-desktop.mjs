// Add a JSON-only bootstrap; never download/execute the remote sharing HTML.
import fs from 'node:fs';
const root=new URL('./node_modules/meshcentral/',import.meta.url);
const file=new URL('meshuser.js',root);
let code=fs.readFileSync(file,'utf8');
const marker="            case 'uaiViewerBootstrap':";
if(!code.includes(marker)) {
 const anchor="            case 'uaiSessionCapabilities':";
 if(code.split(anchor).length!==2)throw Error('Unexpected MeshCentral desktop patch anchor');
 code=code.replace(anchor,`${marker}
                const viewer = require('./uai-session.cjs').viewerCookie(user._id, command.publicid, domain.id, command.clientIp);
                ws.send(JSON.stringify(viewer ? { action:command.action,responseid:command.responseid,result:'OK',
                    authCookie:parent.parent.encodeCookie(viewer,parent.parent.loginCookieEncryptionKey),viewOnly:viewer.vo===1,expiresAt:viewer.expire
                } : {action:command.action,responseid:command.responseid,result:'Denied'}));
                break;
${anchor}`);
 fs.writeFileSync(file,code);
}
console.log('Uai: authenticated desktop viewer bootstrap installed.');
