import test from 'node:test';
import assert from 'node:assert/strict';
import { DamageControlSystem } from '../js/engine/damage/DamageControlSystem.js';

test('phase 21 damage control exposes emergency posture and internal stability metrics', () => {
  const damage = new DamageControlSystem({ initialHull: 86, initialSystems: { engines: 90, sonar: 88, periscope: 92, weapons: 94 } });
  const first = damage.snapshot();
  assert.equal(first.damageControlVersion, 2);
  assert.equal(first.emergencyPosture, 'normal');
  assert.equal(first.pressureIngress, 0);
  assert.equal(first.smokeLoad, 0);
  assert.equal(first.compartmentStability, 100);
});

test('brace posture reduces pressure ingress under depth and breach stress', () => {
  const open = new DamageControlSystem({ initialHull: 90 });
  const brace = new DamageControlSystem({ initialHull: 90 });
  open.applyImpact({ amount: 24, systemKey: 'engines', sourceType: 'depthCharge', seed: 'phase21-pressure' });
  brace.applyImpact({ amount: 24, systemKey: 'engines', sourceType: 'depthCharge', seed: 'phase21-pressure' });
  brace.setEmergencyPosture('brace');
  for (let i = 0; i < 28; i += 1) {
    open.update(250, { depth: 160, timeCompression: 4 });
    brace.update(250, { depth: 160, timeCompression: 4 });
  }
  assert.ok(open.snapshot().totalFlooding > brace.snapshot().totalFlooding);
  assert.equal(brace.snapshot().emergencyPosture, 'brace');
});

test('emergency ventilation lowers smoke when powered', () => {
  const damage = new DamageControlSystem({ initialHull: 82 });
  damage.applyImpact({ amount: 28, systemKey: 'sonar', sourceType: 'electrical', seed: 'phase21-smoke' });
  for (let i = 0; i < 60; i += 1) damage.update(250, { depth: 50, timeCompression: 4 });
  const before = damage.snapshot().smokeLoad;
  const result = damage.emergencyVentilation();
  assert.equal(result.ok, true);
  assert.ok(damage.snapshot().smokeLoad < before);
  assert.ok(damage.snapshot().metrics.ventilationCycles >= 1);
});

test('snapshot restore preserves phase 21 emergency damage state', () => {
  const damage = new DamageControlSystem({ initialHull: 77 });
  damage.setEmergencyPosture('evacuateForward');
  damage.applyImpact({ amount: 20, systemKey: 'weapons', sourceType: 'depthCharge', seed: 'phase21-restore' });
  damage.update(500, { depth: 145, timeCompression: 6 });
  const snapshot = damage.snapshot();
  const restored = new DamageControlSystem({ initialHull: 100 });
  assert.equal(restored.restore(snapshot), true);
  const after = restored.snapshot();
  assert.equal(after.emergencyPosture, 'evacuateForward');
  assert.equal(after.damageControlVersion, 2);
  assert.ok(after.pressureIngress >= 0);
  assert.ok(after.compartmentStability <= 100);
});
