import test from 'node:test';
import assert from 'node:assert/strict';
import { DamageControlSystem } from '../js/engine/damage/DamageControlSystem.js';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const submarine = { id: 'test-sub', nation: 'de', stats: { depth: 70, range: 65, torpedoes: 6 } };
const mission = { id: 'm-damage', year: '1942', difficulty: 'III', targetStartX: 180, targetStartY: 10, escortStartX: 220, escortStartY: 20, escortSensitivity: 0 };

test('damage control initializes seven watertight compartments and three teams', () => {
  const system = new DamageControlSystem({ submarine });
  const snapshot = system.snapshot();
  assert.equal(snapshot.compartments.length, 7);
  assert.equal(snapshot.teams.length, 3);
  assert.equal(snapshot.casualtyTotals.fit, 44);
  assert.equal(snapshot.totalFlooding, 0);
});

test('impact creates deterministic compartment damage, flooding and casualties', () => {
  const first = new DamageControlSystem({ submarine, initialHull: 100 });
  const second = new DamageControlSystem({ submarine, initialHull: 100 });
  const a = first.applyImpact({ amount: 24, systemKey: 'engines', sourceType: 'depthCharge', seed: 'same' });
  const b = second.applyImpact({ amount: 24, systemKey: 'engines', sourceType: 'depthCharge', seed: 'same' });
  assert.deepEqual(a, b);
  assert.equal(first.snapshot().hullIntegrity, 76);
  assert.ok(first.compartment(a.compartmentId).flooding > 0);
});

test('watertight doors reduce progressive flooding spread', () => {
  const open = new DamageControlSystem({ submarine });
  const closed = new DamageControlSystem({ submarine });
  open.compartment('controlRoom').flooding = 82;
  closed.compartment('controlRoom').flooding = 82;
  closed.toggleWatertightDoors(true);
  open.togglePumps(false);
  closed.togglePumps(false);
  open.update(8000, { timeCompression: 1 });
  closed.update(8000, { timeCompression: 1 });
  assert.ok(open.compartment('sonarRoom').flooding > closed.compartment('sonarRoom').flooding);
});

test('pump team reduces flooding faster than unattended pumps', () => {
  const unattended = new DamageControlSystem({ submarine });
  const attended = new DamageControlSystem({ submarine });
  unattended.compartment('engineRoom').flooding = 70;
  attended.compartment('engineRoom').flooding = 70;
  assert.equal(attended.assignTeam('dc-team-1', 'engineRoom', 'pump').ok, true);
  unattended.update(12000, { timeCompression: 1 });
  attended.update(12000, { timeCompression: 1 });
  assert.ok(attended.compartment('engineRoom').flooding < unattended.compartment('engineRoom').flooding);
});

test('fire team suppresses fire and consumes local oxygen', () => {
  const system = new DamageControlSystem({ submarine });
  const room = system.compartment('forwardBattery');
  room.fire = 65;
  assert.equal(system.assignTeam('dc-team-1', room.id, 'fire').ok, true);
  system.update(10000, { timeCompression: 1 });
  assert.ok(room.fire < 65);
  assert.ok(room.oxygen < 100);
});

test('repair team restores compartment integrity and mapped system', () => {
  const system = new DamageControlSystem({ submarine });
  const room = system.compartment('sonarRoom');
  room.integrity = 45;
  room.electricalDamage = 60;
  system.state.systems.sonar = 35;
  assert.equal(system.assignTeam('dc-team-2', room.id, 'repair').ok, true);
  system.update(12000, { timeCompression: 1 });
  assert.ok(room.integrity > 45);
  assert.ok(room.electricalDamage < 60);
  assert.ok(system.snapshot().systems.sonar > 35);
});

test('medical team returns injured crew to fit duty without reviving dead crew', () => {
  const system = new DamageControlSystem({ submarine });
  const room = system.compartment('controlRoom');
  room.casualties.fit -= 2;
  room.casualties.injured = 1;
  room.casualties.dead = 1;
  system.recalculate();
  assert.equal(system.assignTeam('dc-team-3', room.id, 'medical').ok, true);
  for (let i = 0; i < 20; i += 1) system.update(1000, { timeCompression: 1 });
  assert.equal(room.casualties.injured, 0);
  assert.equal(room.casualties.dead, 1);
});

test('loss of main power disables pumps until emergency power is enabled', () => {
  const system = new DamageControlSystem({ submarine });
  system.compartment('engineRoom').electricalDamage = 100;
  system.update(1000, { timeCompression: 1 });
  assert.equal(system.snapshot().mainPower, false);
  assert.equal(system.snapshot().pumpsActive, false);
  assert.equal(system.togglePumps(true).reason, 'damageNoPower');
  system.toggleEmergencyPower(true);
  assert.equal(system.togglePumps(true).ok, true);
});

test('damage control snapshot restores compartments, teams, power and casualties', () => {
  const original = new DamageControlSystem({ submarine });
  original.applyImpact({ amount: 18, systemKey: 'sonar', sourceType: 'depthCharge', seed: 'restore' });
  original.assignTeam('dc-team-2', 'sonarRoom', 'repair');
  original.toggleWatertightDoors(true);
  original.toggleEmergencyPower(true);
  original.update(4000, { timeCompression: 2 });
  const saved = original.snapshot();
  const restored = new DamageControlSystem({ submarine });
  assert.equal(restored.restore(saved), true);
  assert.deepEqual(restored.snapshot(), saved);
});

test('critical flooding produces progressive hull damage events', () => {
  const system = new DamageControlSystem({ submarine });
  const room = system.compartment('engineRoom');
  room.integrity = 20;
  room.flooding = 92;
  system.togglePumps(false);
  for (let i = 0; i < 40; i += 1) system.update(1000, { timeCompression: 1 });
  assert.ok(system.drainHullDamageEvents().length > 0);
});

test('SimulationEngine routes damage through compartments and exports snapshot v10', () => {
  const engine = new SimulationEngine({ mission, submarine, initialHull: 100 });
  engine.applyDamage(15, 'engines', 'gameplay.hintDepthCharge', 'depthCharge');
  const snapshot = engine.snapshot();
  assert.equal(snapshot.snapshotVersion, 10);
  assert.equal(snapshot.hull, 85);
  assert.ok(snapshot.damageControl.totalFlooding > 0);
  assert.equal(snapshot.damageControl.compartments.length, 7);
  engine.dispose();
});

test('SimulationEngine restores damage-control teams and gauges from operation snapshot', () => {
  const original = new SimulationEngine({ mission, submarine });
  original.applyDamage(12, 'sonar', 'gameplay.hintDepthCharge', 'depthCharge');
  original.assignDamageControlTeam('dc-team-1', 'sonarRoom', 'repair');
  original.toggleWatertightDoors(true);
  for (let i = 0; i < 12; i += 1) original.step(80);
  const saved = original.snapshot();
  const restored = new SimulationEngine({ mission, submarine, initialSnapshot: saved });
  assert.deepEqual(restored.snapshot().damageControl, saved.damageControl);
  assert.equal(restored.snapshot().systems.sonar, saved.systems.sonar);
  original.dispose();
  restored.dispose();
});
