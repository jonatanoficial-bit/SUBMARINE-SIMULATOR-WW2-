import test from 'node:test';
import assert from 'node:assert/strict';

import { SubmarinePhysicsSystem } from '../js/engine/physics/SubmarinePhysicsSystem.js';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const submarine = { id: 'qa-sub', stats: { speed: 64, range: 72, stealth: 68, depth: 70 } };
const mission = {
  id: 'physics-qa', targetType: 'merchant', targetStartX: 220, targetStartY: 18,
  escortStartX: 310, escortStartY: 42, escortSensitivity: 0,
  navigation: {
    mapBounds: { north: 50, south: 47, west: -18, east: -12 },
    origin: { lat: 48, lon: -16 }, heading: 90,
    patrolSector: { id: 'qa', labelKey: 'navigation.sectorAtlantic', north: 48.8, south: 48.3, west: -15, east: -14 },
    route: [{ id: 'qa-1', lat: 48, lon: -15.8, labelKey: 'navigation.waypointDeparture' }],
  },
};

function stepPhysics(system, count, ms = 1000, context = {}) {
  for (let index = 0; index < count; index += 1) system.update(ms, context);
  return system.snapshot();
}

test('submarine ratings derive safe and crush depth limits', () => {
  const system = new SubmarinePhysicsSystem({ submarine });
  const snapshot = system.snapshot();
  assert.ok(snapshot.maxOperationalDepth > 180, JSON.stringify(snapshot));
  assert.ok(snapshot.crushDepth > snapshot.maxOperationalDepth, JSON.stringify(snapshot));
  assert.ok(snapshot.crushDepth <= 310, JSON.stringify(snapshot));
});

test('depth order changes commanded depth before actual depth', () => {
  const system = new SubmarinePhysicsSystem({ submarine, initialDepth: 12 });
  system.adjustOrderedDepth(60);
  const ordered = system.snapshot();
  assert.equal(ordered.orderedDepth, 72);
  assert.equal(ordered.depth, 12);
  const progressed = stepPhysics(system, 20, 1000, { telegraphSpeed: 'slow', systems: { engines: 100 } });
  assert.ok(progressed.depth > 12, JSON.stringify(progressed));
  assert.ok(progressed.verticalSpeed > 0, JSON.stringify(progressed));
});

test('automatic depth hold converges without teleporting', () => {
  const system = new SubmarinePhysicsSystem({ submarine, initialDepth: 20 });
  system.setOrderedDepth(80);
  const after = stepPhysics(system, 140, 1000, { telegraphSpeed: 'half', systems: { engines: 100 } });
  assert.ok(after.depth > 65 && after.depth < 95, JSON.stringify(after));
  assert.ok(Math.abs(after.verticalSpeed) < 1.2, JSON.stringify(after));
});

test('manual flood and blow commands move ballast in the correct direction', () => {
  const system = new SubmarinePhysicsSystem({ submarine, initialDepth: 35 });
  const initial = system.snapshot().ballast;
  system.setBallastCommand('flood');
  const flooded = stepPhysics(system, 2, 1000, { telegraphSpeed: 'slow', systems: { engines: 100 } });
  assert.ok(flooded.ballast > initial, JSON.stringify(flooded));
  system.setBallastCommand('blow');
  const blown = stepPhysics(system, 4, 1000, { telegraphSpeed: 'slow', systems: { engines: 100 } });
  assert.ok(blown.ballast < flooded.ballast, JSON.stringify(blown));
  assert.ok(blown.verticalSpeed < flooded.verticalSpeed, JSON.stringify(blown));
});

test('trim controls affect vertical motion and level command restores hold', () => {
  const system = new SubmarinePhysicsSystem({ submarine, initialDepth: 50 });
  system.nudgeTrim(10);
  const down = stepPhysics(system, 3, 1000, { telegraphSpeed: 'slow', systems: { engines: 100 } });
  assert.ok(down.verticalSpeed > 0, JSON.stringify(down));
  system.levelTrim();
  const level = system.snapshot();
  assert.equal(level.trim, 0);
  assert.equal(level.depthHold, true);
  assert.equal(level.ballastCommand, 'auto');
});

test('submerged propulsion drains battery and atmosphere resources', () => {
  const system = new SubmarinePhysicsSystem({ submarine, initialDepth: 60 });
  const before = system.snapshot();
  const after = system.update(3600000, { telegraphSpeed: 'full', systems: { engines: 100 }, timeCompression: 1 });
  assert.ok(after.battery < before.battery, JSON.stringify(after));
  assert.ok(after.oxygen < before.oxygen, JSON.stringify(after));
  assert.ok(after.co2 > before.co2, JSON.stringify(after));
  assert.equal(after.propulsionMode, 'electric');
});

test('surface diesel propulsion consumes fuel and restores atmosphere and battery', () => {
  const system = new SubmarinePhysicsSystem({ submarine, initialDepth: 0 });
  system.restore({ depth: 0, orderedDepth: 0, battery: 40, oxygen: 50, co2: 45, fuel: 100 });
  const after = system.update(3600000, { telegraphSpeed: 'slow', systems: { engines: 100 } });
  assert.ok(after.fuel < 100, JSON.stringify(after));
  assert.ok(after.battery > 40, JSON.stringify(after));
  assert.ok(after.oxygen > 50, JSON.stringify(after));
  assert.ok(after.co2 < 45, JSON.stringify(after));
  assert.equal(after.propulsionMode, 'diesel');
});

test('shallow flank speed creates more cavitation than deep slow speed', () => {
  const shallow = new SubmarinePhysicsSystem({ submarine, initialDepth: 14 });
  let shallowSnapshot; for (let i = 0; i < 16; i += 1) shallowSnapshot = shallow.update(1000, { telegraphSpeed: 'flank', systems: { engines: 100 } });
  const deep = new SubmarinePhysicsSystem({ submarine, initialDepth: 90 });
  let deepSnapshot; for (let i = 0; i < 16; i += 1) deepSnapshot = deep.update(1000, { telegraphSpeed: 'slow', systems: { engines: 100 } });
  assert.ok(shallowSnapshot.cavitation > 30, JSON.stringify(shallowSnapshot));
  assert.ok(shallowSnapshot.noise > deepSnapshot.noise, `${shallowSnapshot.noise} / ${deepSnapshot.noise}`);
});

test('depleted battery reduces real speed while telegraph remains a command', () => {
  const system = new SubmarinePhysicsSystem({ submarine, initialDepth: 50 });
  system.restore({ depth: 50, orderedDepth: 50, battery: 2 });
  let low; for (let i = 0; i < 20; i += 1) low = system.update(1000, { telegraphSpeed: 'flank', systems: { engines: 100 } });
  const healthySystem = new SubmarinePhysicsSystem({ submarine, initialDepth: 50 });
  let healthy; for (let i = 0; i < 20; i += 1) healthy = healthySystem.update(1000, { telegraphSpeed: 'flank', systems: { engines: 100 } });
  assert.ok(low.actualSpeedKnots < healthy.actualSpeedKnots * 0.6, `${low.actualSpeedKnots} / ${healthy.actualSpeedKnots}`);
});

test('pressure beyond the operating depth raises a critical flag', () => {
  const system = new SubmarinePhysicsSystem({ submarine, initialDepth: 12 });
  const limits = system.snapshot();
  system.restore({ depth: limits.maxOperationalDepth + 12, orderedDepth: limits.maxOperationalDepth + 12 });
  const snapshot = system.update(1000, { telegraphSpeed: 'stop', systems: { engines: 100 } });
  assert.ok(snapshot.pressurePercent > 100, JSON.stringify(snapshot));
  assert.ok(snapshot.criticalFlags.includes('pressure'), JSON.stringify(snapshot));
  assert.equal(snapshot.status, 'critical');
});

test('pressure and atmosphere generate deterministic damage events', () => {
  const system = new SubmarinePhysicsSystem({ submarine });
  const limits = system.snapshot();
  system.restore({ depth: limits.crushDepth - 2, orderedDepth: limits.crushDepth - 2, oxygen: 4, co2: 96 });
  system.update(3600000, { telegraphSpeed: 'stop', systems: { engines: 100 } });
  const events = system.drainDamageEvents();
  assert.ok(events.some((event) => event.reason === 'pressure'), JSON.stringify(events));
  assert.ok(events.some((event) => event.reason === 'atmosphere'), JSON.stringify(events));
  assert.equal(system.drainDamageEvents().length, 0);
});

test('physics snapshot restores all live gauges', () => {
  const source = new SubmarinePhysicsSystem({ submarine, initialDepth: 30 });
  source.restore({ depth: 44, orderedDepth: 90, verticalSpeed: 1.1, ballast: 71, trim: 5, fuel: 82, battery: 66, oxygen: 75, co2: 22 });
  const snapshot = source.snapshot();
  const restored = new SubmarinePhysicsSystem({ submarine, initialSnapshot: snapshot }).snapshot();
  for (const key of ['depth', 'orderedDepth', 'verticalSpeed', 'ballast', 'trim', 'fuel', 'battery', 'oxygen', 'co2']) {
    assert.equal(restored[key], snapshot[key], `${key}: ${restored[key]} / ${snapshot[key]}`);
  }
});

test('SimulationEngine snapshots include physics and progressive depth', () => {
  const engine = new SimulationEngine({ mission, submarine });
  const initial = engine.snapshot();
  assert.equal(initial.snapshotVersion, 10);
  assert.equal(initial.physics.physicsVersion, 1);
  engine.adjustDepth(60);
  assert.equal(engine.snapshot().depth, initial.depth);
  assert.equal(engine.snapshot().physics.orderedDepth, initial.depth + 60);
  for (let index = 0; index < 80; index += 1) engine.step(80);
  assert.ok(engine.snapshot().depth > initial.depth, JSON.stringify(engine.snapshot().physics));
  engine.dispose();
});

test('SimulationEngine operation autosave restores physics gauges', () => {
  const engine = new SimulationEngine({ mission, submarine });
  engine.physics.restore({ depth: 72, orderedDepth: 105, battery: 63, fuel: 84, oxygen: 77, co2: 19, ballast: 67, trim: 4 });
  engine.player.setDepth(72, 300);
  const snapshot = engine.snapshot();
  const restored = new SimulationEngine({ mission, submarine, initialSnapshot: snapshot }).snapshot();
  assert.equal(restored.depth, 72);
  assert.equal(restored.physics.orderedDepth, 105);
  assert.equal(restored.physics.battery, 63);
  assert.equal(restored.physics.ballast, 67);
  engine.dispose();
});

test('critical atmosphere and pressure force safe time compression', () => {
  const engine = new SimulationEngine({ mission, submarine });
  assert.equal(engine.requestTimeCompression(16).value, 16);
  engine.physics.restore({ depth: 220, orderedDepth: 220, oxygen: 10, co2: 85 });
  engine.player.setDepth(220, 300);
  engine.step(80);
  assert.equal(engine.snapshot().navigation.timeCompression, 1);
  assert.equal(engine.snapshot().navigation.safetyLimited, true);
  engine.dispose();
});

test('navigation uses actual physics speed instead of telegraph label', () => {
  const engine = new SimulationEngine({ mission, submarine });
  engine.setSpeed('flank');
  engine.physics.restore({ depth: 50, orderedDepth: 50, battery: 1 });
  engine.step(80);
  const snapshot = engine.snapshot();
  assert.equal(snapshot.speed, 'flank');
  assert.ok(snapshot.navigation.speedKnots < 7, JSON.stringify(snapshot.physics));
  assert.equal(snapshot.navigation.speedKnots, snapshot.physics.actualSpeedKnots);
  engine.dispose();
});
