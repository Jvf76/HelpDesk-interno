import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashboardCounts,formatPercent} from '../src/dashboardData.ts';
test('active sessions do not remove devices from online availability',()=>{
 const counts=dashboardCounts([{state:'ONLINE',count:220},{state:'IN_SESSION',count:8},{state:'ERROR',count:3},{state:'OFFLINE',count:15},{state:'DISABLED',count:2}]);
 assert.deepEqual(counts,{online:231,offline:17,active:8});
 assert.equal(counts.online+counts.offline,248);
});
test('missing state groups are zero, unknown session phases are not active',()=>{
 assert.deepEqual(dashboardCounts([]),{online:0,offline:0,active:0});
 assert.deepEqual(dashboardCounts([{state:'ONLINE',count:1},{state:'PENDING',count:8}]),{online:1,offline:0,active:0});
});
test('absence of measurement is distinct from a real zero measurement',()=>{
 assert.equal(formatPercent(0),'0%');
 for(const value of [null,undefined,NaN,Infinity]) assert.equal(formatPercent(value),'Sem medição');
 assert.equal(formatPercent(42.5),'42,5%');
});
