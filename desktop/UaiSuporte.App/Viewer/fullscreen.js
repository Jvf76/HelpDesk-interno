// Keep the session controls and monitor selector accessible in fullscreen.
'use strict';
const fullscreenButton=document.getElementById('fullscreen');
fullscreenButton.onclick=async()=>{
 try {
  if(document.fullscreenElement)await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
  document.getElementById('fullscreen-status').textContent='';
 } catch {
  document.getElementById('fullscreen-status').textContent='Tela cheia indisponível neste ambiente. No navegador, utilize F11.';
 }
};
document.addEventListener('fullscreenchange',()=>{
 fullscreenButton.textContent=document.fullscreenElement?'Sair da tela cheia':'Tela cheia';
});
