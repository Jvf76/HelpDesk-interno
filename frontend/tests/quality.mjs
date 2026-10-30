import { test } from 'node:test';
import assert from 'node:assert/strict';
await import('../../desktop/UaiSuporte.App/Viewer/quality.js');
const { create } = globalThis.UaiQuality;
test('adaptation uses hysteresis; stale RTT is not presented as current', () => {
  let time = 0; const applied = [];
  const q = create({ apply: p => applied.push(p.label), now: () => time });
  assert.match(q.status(), /sem medição/);
  q.sample(NaN); q.sample(-1); assert.match(q.status(), /sem medição/);
  q.sample(400); assert.equal(applied.length, 0);
  q.sample(400); assert.deepEqual(applied, ['Economia']);
  for (let i=0;i<3;i++) q.sample(50);
  assert.equal(applied.length, 1, 'must not oscillate immediately');
  time = 21000; q.sample(50); assert.deepEqual(applied, ['Economia', 'Equilibrada']);
  time = 47000; assert.match(q.status(), /sem medição recente/);
});
test('manual profile is bounded and queue congestion reduces automatic quality', () => {
  const q = create({ apply: () => {} });
  q.sample(10, 70000); q.sample(10, 70000); assert.equal(q.profile.jpeg, 30);
  q.select('clarity'); q.sample(1000); q.sample(1000); assert.equal(q.profile.jpeg, 75);
  assert.throws(() => q.select('unbounded'));
  q.select('auto'); q.sample(10, 0, 10); q.sample(10, 0, 10);
  assert.equal(q.profile.jpeg, 50, 'cooldown still applies after manual change');
});
