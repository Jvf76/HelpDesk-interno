// Local adapter around MeshCentral's existing codec and input implementation.
var urlargs={};let desktop=null,expiry=null,connectionTimer=null,watch=null,painted=false,quality=null,nativePromptSeen=false,activeDeadlineSet=false,activeUntil=0;
const send=(kind)=>window.chrome.webview.postMessage({kind});
function stop(notify=true){activeDeadlineSet=false;activeUntil=0;document.getElementById('mode').textContent='Entrada bloqueada';clearTimeout(expiry);clearTimeout(connectionTimer);clearInterval(watch);if(desktop){const d=desktop;desktop=null;clearInterval(d.latency.lastSend);d.latency.lastSend=null;d.latency.callback=null;d.m.stopInput=true;d.m.UnGrabKeyInput();d.m.UnGrabMouseInput();d.Stop();}const c=document.getElementById('Desk');c.getContext('2d').clearRect(0,0,c.width,c.height);document.getElementById('state').textContent='Sessão encerrada • imagem e controle desativados';if(notify)send('stop');}
document.getElementById('stop').onclick=()=>stop();
window.addEventListener('beforeunload',()=>stop(false));
window.addEventListener('blur',()=>{if(desktop)desktop.m.UnGrabKeyInput();});
window.chrome.webview.addEventListener('message',({data})=>{
 if(data.action==='stop'){stop(false);return;}
 if(data.action!=='start'||desktop||typeof data.authCookie!=='string'||data.expiresAt<=Date.now())return;
 document.getElementById('mode').textContent=data.viewOnly?'Visualização solicitada — aguardando confirmação no computador acessado':'Controle solicitado — aguardando confirmação no computador acessado';
 painted=false;nativePromptSeen=false;activeDeadlineSet=false;activeUntil=0;
 desktop=CreateAgentRedirect(null,CreateAgentRemoteDesktop('Desk'),'mesh.internal',data.authCookie,null,'/');
 desktop.attemptWebRTC=false;desktop.debugmode=0;desktop.m.debugmode=0;desktop.options={};
 desktop.m.UseExtendedKeyFlag=true;desktop.m.stopInput=true;desktop.m.CompressionLevel=50;desktop.m.ScalingLevel=1024;
 quality=UaiQuality.create({apply:p=>{if(desktop?.State===3)desktop.m.SendCompressionLevel(1,p.jpeg,p.scale,p.interval);}});
 quality.select(document.getElementById('quality').value);
 desktop.m.CompressionLevel=quality.profile.jpeg;desktop.m.ScalingLevel=quality.profile.scale;desktop.m.FrameRateTimer=quality.profile.interval;
 desktop.latency.callback=ms=>{if(desktop)quality.sample(ms,desktop.socket?.bufferedAmount||0,desktop.m.PendingOperations.length);};
 const activeDesktop=desktop;
 UaiMonitors.attach(desktop,()=>desktop===activeDesktop&&activeDeadlineSet&&Date.now()<activeUntil);
 const ctx=desktop.m.Canvas,draw=CanvasRenderingContext2D.prototype.drawImage.bind(ctx);
 function inputReady(){return desktop===activeDesktop&&painted&&activeDeadlineSet&&Date.now()<activeUntil&&!data.viewOnly;}
 // The SDK also emits key-up packets on screen-size messages. Gate its wire send,
 // not only DOM handlers, so even these packets cannot precede CONTROL authorization.
 const sdkSend=desktop.m.send.bind(desktop.m);
 desktop.m.send=packet=>{
  if(typeof packet!=='string')return;
  const displaySizes=new Map([[5,10],[6,4],[8,5],[11,4],[12,6],[14,4]]);
  for(let p=0;p<packet.length;){
   if(packet.length-p<4)return;
   const cmd=(packet.charCodeAt(p)<<8)|packet.charCodeAt(p+1),size=(packet.charCodeAt(p+2)<<8)|packet.charCodeAt(p+3);
   if(size<4||p+size>packet.length)return;
   const input=(cmd===1&&size===6)||(cmd===2&&[10,12].includes(size))||(cmd===85&&size===7);
   const query=cmd===87&&size===5&&packet.charCodeAt(p+4)===2;
   if(displaySizes.get(cmd)!==size&&!query&&!(input&&inputReady()))return;
   p+=size;
  }
  sdkSend(packet);
 };
 function connectionDeadline(ms,kind='connection-timeout'){
  clearTimeout(connectionTimer);
  connectionTimer=setTimeout(()=>{
   if(!activeDeadlineSet&&desktop===activeDesktop){
    stop(false);
    document.getElementById('state').textContent=kind==='engine-consent-timeout'?'A confirmação no computador acessado expirou. Tentativa encerrada.':'Não foi possível confirmar a imagem. Tentativa encerrada.';
    send(kind);
   }
  },Math.min(ms,Math.max(0,data.expiresAt-Date.now())));
 }
 ctx.drawImage=(...args)=>{
  if(desktop!==activeDesktop)return;
  draw(...args);
  if(!painted){
   painted=true;
   document.getElementById('state').textContent='Imagem desenhada — aguardando confirmação do canal autorizado';
   connectionDeadline(10000);
   desktop.sendCtrlMsg(JSON.stringify({ctrlChannel:'102938',type:'uai-rendered'}));
   send('frame');
  }
 };
 desktop.onMetadataChange=metadata=>{
  if(desktop!==activeDesktop||!painted||activeDeadlineSet||!Number.isSafeInteger(metadata.uaiActiveUntil)||metadata.uaiActiveUntil<=Date.now()||metadata.uaiActiveUntil>data.expiresAt)return;
  // Only the relay issues this acknowledgment after native consent, privacy bar and render.
  activeDeadlineSet=true;activeUntil=metadata.uaiActiveUntil;
  desktop.m.GetDisplayNumbers();
  clearTimeout(connectionTimer);clearTimeout(expiry);expiry=setTimeout(()=>stop(),activeUntil-Date.now());
  desktop.m.stopInput=data.viewOnly;
  if(!data.viewOnly)desktop.m.GrabMouseInput();
  document.getElementById('state').textContent=data.viewOnly?'Visualização ativa':'Controle ativo';
  document.getElementById('mode').textContent=data.viewOnly?'Somente visualização — entrada bloqueada':'Controle ativo • clique na tela para teclado e mouse';
  send('active');
 };
 desktop.onStateChanged=(_,state)=>{
  if(desktop!==activeDesktop)return;
  if(state===0){stop(false);send('disconnected');return;}
  if(!activeDeadlineSet)document.getElementById('state').textContent=state===3?'Transporte conectado — aguardando autorização e imagem':'Conectando transporte';
 };
 desktop.onConsoleMessageChange=(_,message,id)=>{
  if(desktop!==activeDesktop||activeDeadlineSet)return;
  if(id===1){
   document.getElementById('state').textContent='Aguardando confirmação no computador acessado';
   if(!nativePromptSeen){nativePromptSeen=true;connectionDeadline(35000,'engine-consent-timeout');}
  }else if(id===0&&nativePromptSeen&&!painted){
   document.getElementById('state').textContent='Acesso autorizado — aguardando imagem';connectionDeadline(15000);
  }
 };
 document.getElementById('Desk').onfocus=()=>{if(inputReady())desktop.m.GrabKeyInput();};
 document.getElementById('Desk').onclick=()=>{document.getElementById('Desk').focus();if(inputReady())desktop.m.GrabKeyInput();};
 // Do not install input handlers in VIEW. The relay independently rejects input packets.

 if(data.viewOnly){desktop.m.SendKeyMsgKC=()=>{};desktop.m.SendMouseMsg=()=>{};}
 desktop.Start(null);
 connectionDeadline(15000);
 expiry=setTimeout(()=>stop(),Math.max(0,data.expiresAt-Date.now()));
 watch=setInterval(()=>{document.getElementById('metrics').textContent=quality.status();},1000);
});

document.getElementById('quality').onchange=e=>quality?.select(e.target.value);
