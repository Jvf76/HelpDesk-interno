// Local adapter around MeshCentral's existing codec and input implementation.
var urlargs={};let desktop=null,expiry=null,watch=null,painted=false,quality=null;
const send=(kind)=>window.chrome.webview.postMessage({kind});
function stop(notify=true){clearTimeout(expiry);clearInterval(watch);if(desktop){const d=desktop;desktop=null;clearInterval(d.latency.lastSend);d.latency.lastSend=null;d.latency.callback=null;d.m.UnGrabKeyInput();d.m.UnGrabMouseInput();d.Stop();}const c=document.getElementById('Desk');c.getContext('2d').clearRect(0,0,c.width,c.height);document.getElementById('state').textContent='Sessão encerrada • imagem e controle desativados';if(notify)send('stop');}
document.getElementById('stop').onclick=()=>stop();
window.addEventListener('beforeunload',()=>stop(false));
window.addEventListener('blur',()=>{if(desktop)desktop.m.UnGrabKeyInput();});
window.chrome.webview.addEventListener('message',({data})=>{
 if(data.action==='stop'){stop(false);return;}
 if(data.action!=='start'||desktop||typeof data.authCookie!=='string'||data.expiresAt<=Date.now())return;
 document.getElementById('mode').textContent=data.viewOnly?'Somente visualização':'Controle autorizado • clique na tela para teclado e mouse';
 painted=false;
 desktop=CreateAgentRedirect(null,CreateAgentRemoteDesktop('Desk'),'mesh.internal',data.authCookie,null,'/');
 desktop.attemptWebRTC=false;desktop.debugmode=0;desktop.m.debugmode=0;desktop.options={};
 desktop.m.UseExtendedKeyFlag=true;desktop.m.stopInput=data.viewOnly;desktop.m.CompressionLevel=50;desktop.m.ScalingLevel=1024;
 quality=UaiQuality.create({apply:p=>{if(desktop?.State===3)desktop.m.SendCompressionLevel(1,p.jpeg,p.scale,p.interval);}});
 quality.select(document.getElementById('quality').value);
 desktop.m.CompressionLevel=quality.profile.jpeg;desktop.m.ScalingLevel=quality.profile.scale;desktop.m.FrameRateTimer=quality.profile.interval;
 desktop.latency.callback=ms=>{if(desktop)quality.sample(ms,desktop.socket?.bufferedAmount||0,desktop.m.PendingOperations.length);};
 const activeDesktop=desktop;
 const ctx=desktop.m.Canvas,draw=CanvasRenderingContext2D.prototype.drawImage.bind(ctx);
 ctx.drawImage=(...args)=>{if(desktop!==activeDesktop)return;draw(...args);if(!painted){painted=true;send('frame');}};
 desktop.onStateChanged=(_,state)=>{document.getElementById('state').textContent=state===3?'Conectado • aguardando imagem e consentimento':'Conectando';if(state===0&&desktop){stop(false);send('disconnected');}};
 desktop.onConsoleMessageChange=()=>{document.getElementById('state').textContent='Aguardando confirmação no computador atendido';};
 document.getElementById('Desk').onfocus=()=>{if(desktop&&!data.viewOnly)desktop.m.GrabKeyInput();};
 document.getElementById('Desk').onclick=()=>{document.getElementById('Desk').focus();if(desktop&&!data.viewOnly)desktop.m.GrabKeyInput();};
 // Do not install input handlers in VIEW. The relay independently rejects input packets.
 if(!data.viewOnly)desktop.m.GrabMouseInput();
 if(data.viewOnly){desktop.m.SendKeyMsgKC=()=>{};desktop.m.SendMouseMsg=()=>{};}
 desktop.Start(null);
 expiry=setTimeout(()=>stop(),Math.max(0,data.expiresAt-Date.now()));
 watch=setInterval(()=>{if(painted)document.getElementById('state').textContent='Imagem recebida • sessão ativa';document.getElementById('metrics').textContent=quality.status();},1000);
});

document.getElementById('quality').onchange=e=>quality?.select(e.target.value);
