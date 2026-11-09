const allowed=new Set(['REQUEST_CREATED','LAUNCH_BEGIN','LAUNCH_OK','LAUNCH_FAILED','POLL_FAILED','POLL_BLOCKED','POLL_ENDED','USER_STOP','VIEWER_STOP','USER_CLOSE','COMPONENT_CLOSED','VIEWER_DISCONNECTED','VIEWER_TIMEOUT','NATIVE_TIMEOUT','MONITORS_REQUESTED','MONITORS_EMPTY','MONITORS_SINGLE','MONITORS_MULTIPLE','MONITOR_SELECTED','FRAME_DRAWN','VIEWER_ERROR','TRANSPORT_ERROR','TRANSPORT_CLOSE_NORMAL','TRANSPORT_CLOSE_ABNORMAL','TRANSPORT_CLOSE_OTHER']);
export function recordSessionDiagnostic(id:string|null,code:string){
 if(!id||!/^[a-f0-9-]{36}$/i.test(id)||!allowed.has(code))return;
 try{
  const key='uai.session-diagnostic',previous=JSON.parse(sessionStorage.getItem(key)||'null');
  const events=previous?.session===id&&Array.isArray(previous.events)?previous.events.filter((e:any)=>allowed.has(e.code)&&typeof e.at==='string').slice(-29).map((e:any)=>({at:e.at,code:e.code})):[];
  events.push({at:new Date().toISOString(),code});
  sessionStorage.setItem(key,JSON.stringify({session:id,events}));
 }catch{/* Diagnostics must never change authorization or transport. */}
}
export function sessionDiagnostic(id:string|null){
 if(!id||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))return '';
 try{
  const stored=JSON.parse(sessionStorage.getItem('uai.session-diagnostic')||'null');
  const events=stored?.session===id&&Array.isArray(stored.events)?stored.events.filter((e:any)=>allowed.has(e.code)&&typeof e.at==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(e.at)).slice(-30).map((e:any)=>({at:e.at,code:e.code})):[];
  return JSON.stringify({session:id,events},null,2);
 }catch{return JSON.stringify({session:id,events:[]});}
}
