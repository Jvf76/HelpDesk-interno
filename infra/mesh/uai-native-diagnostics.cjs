'use strict';
// Called only after the relay matches the authenticated node and the exact attempt.
// Diagnostic messages never grant consent or change the remote session lifecycle.
function recordNativeDiagnostic(s,event,log=console.info,clock=Date.now){
 if(event.msgid!==9100&&event.msgid!==9101)return false;
 if(!/ • Uai [0-9a-f-]{36}$/i.test(s.guest||'')||s.node!==event.nodeid||s.guest!==event.guestname)return true;
 if(!Array.isArray(event.msgArgs)||(s.nativeDiagCount||0)>=64)return true;
 let value;
 if(event.msgid===9100){
  if(event.msgArgs.length!==6)return true;
  const [stage,targetSession,engineSession,consoleSession,helperPid,helperSession]=event.msgArgs;
  if(!['REQUESTED','HELPER_CREATED','HELPER_READY','RESPONSE_ACCEPTED','RESPONSE_REJECTED'].includes(stage)||![targetSession,engineSession,consoleSession,helperPid,helperSession].every(x=>Number.isInteger(x)&&x>=-1&&x<=2147483647))return true;
  s.nativeDiagnostic={...s.nativeDiagnostic,stage,targetSession,engineSession,consoleSession};
  if(helperPid>0){s.nativeDiagnostic.helperPid=helperPid;s.nativeDiagnostic.helperSession=helperSession;}
  value=s.nativeDiagnostic;
 }else{
  if(event.msgArgs.length!==4)return true;
  const [stage,errorKind,codeField,numericCode]=event.msgArgs;
  if(!['CREATE_FAILED','PROMISE_REJECTED'].includes(stage)||!['Error','TypeError','RangeError','ReferenceError','SyntaxError','EvalError','URIError','UNKNOWN'].includes(errorKind)||!['win32Error','lastError','errorCode','errno','code','NONE'].includes(codeField)||![-1,2,3,5,6,8,87,1008,1314,1816,-2147024891].includes(numericCode))return true;
  value={stage,errorKind,codeField,numericCode};
 }
 s.nativeDiagCount=(s.nativeDiagCount||0)+1;
 log('UAI_NATIVE_CONSENT '+JSON.stringify({session:s.guest.slice(-36),...value,at:clock()}));
 return true;
}
module.exports={recordNativeDiagnostic};
