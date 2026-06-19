import test from 'node:test';
import assert from 'node:assert/strict';

import { SubmarinePhysicsSystem } from '../js/engine/physics/SubmarinePhysicsSystem.js';

const submarine = { id: 'f16-qa', stats: { speed: 62, range: 70, stealth: 66, depth: 74 } };

function step(system, count, ms = 1000, context = {}) {
  for (let index = 0; index < count; index += 1) system.update(ms, context);
  return system.snapshot();
}

test('phase 16 exposes depth envelope, reserve buoyancy and buoyancy state', () => {
  const system = new SubmarinePhysicsSystem({ submarine, initialDepth: 12 });
  let snapshot = system.snapshot();
  assert.equal(snapshot.physicsVersion, 1);
  assert.ok(snapshot.pressureEnvelope);
  assert.equal(snapshot.depthZone, 'periscope');
  assert.ok(snapshot.reserveBuoyancy >= 0 && snapshot.reserveBuoyancy <= 100);
  system.setBallastCommand('flood');
  snapshot = step(system, 8, 1000, { telegraphSpeed: 'half', systems: { engines: 100 } });
  assert.ok(['negative', 'neutral'].includes(snapshot.buoyancyState));
  assert.ok(snapshot.descentRate >= 0);
  assert.ok(snapshot.pressureEnvelope.maxOperationalDepth > 120);
});

test('phase 16 depth zones move from surface to operational depths deterministically', () => {
  const system = new SubmarinePhysicsSystem({ submarine, initialDepth: 2 });
  assert.equal(system.snapshot().depthZone, 'surface');
  system.setOrderedDepth(40);
  const snapshot = step(system, 25, 1000, { telegraphSpeed: 'slow', systems: { engines: 100 } });
  assert.ok(['periscope', 'patrol', 'deep'].includes(snapshot.depthZone));
  assert.notEqual(snapshot.buoyancyState, undefined);
  assert.ok(snapshot.pressureEnvelope.crushDepth > snapshot.pressureEnvelope.maxOperationalDepth);
});
