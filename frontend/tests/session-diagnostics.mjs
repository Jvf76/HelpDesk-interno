import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordSessionDiagnostic as record,sessionDiagnostic} from '../src/sessionDiagnostics.ts';
const id='e27d74a7-cf0d-4c8f-b42a-dc13779242c4';
test('browser diagnosis only retains a bounded UUID/time/code history',()=>{
 let data=null;Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>data,setItem:(_,v)=>data=v}});
 record(null,'USER_STOP');record('secret','USER_STOP');record(id,'cookie=SECRET');assert.equal(data,null);
 for(let i=0;i<50;i++)record(id,'FRAME_DRAWN');
 let parsed=JSON.parse(data);assert.equal(parsed.events.length,30);assert.equal(parsed.session,id);
 assert.deepEqual(Object.keys(parsed.events[0]),['at','code']);assert(!data.includes('SECRET'));
 record('f25aff99-4a3f-407a-9943-154cbdfc0b74','REQUEST_CREATED');assert.equal(JSON.parse(data).events.length,1);
});
test('unavailable storage does not break session operation',()=>{
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw Error('blocked');}});
 assert.doesNotThrow(()=>record(id,'USER_STOP'));
});

test('export excludes arbitrary fields, errors, URLs and malformed timestamps',()=>{
 const raw=JSON.stringify({session:id,cookie:'SECRET',events:[{at:'SECRET',code:'USER_STOP'},{at:'2026-11-09T14:28:00.000Z',code:'USER_STOP',secret:'SECRET'}]});
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>raw}});
 const text=sessionDiagnostic(id);assert(!text.includes('SECRET'));assert.equal(JSON.parse(text).events.length,1);
 assert.equal(sessionDiagnostic('not-a-session'),'');
});
