import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const mission = {
  id: 'balance-m1',
  year: '1939',
  difficulty: 'I',
  theatreKey: 'mission.theatre.convoy',
  targetType: 'merchant',
  targetStartX: 230,
  targetStartY: 18,
  escortStartX: 320,
  escortStartY: 42,
  escortSensitivity: 1,
  targetDrift: 0.7,
  targetWave: 0.35,
  targetBob: 6,
  torpedoes: 8,
};

const submarine = {
  id: 'de_type_viia_starter',
  nation: 'de',
  stats: { torpedoes: 8, maxSpeed: 17, maxDepth: 220 },
};

function createEngine() {
  const engine = new SimulationEngine({ mission, submarine });
  engine.stop();
  engine.physics.restore({
    ...engine.snapshot().physics,
    depth: 5,
    orderedDepth: 5,
    verticalSpeed: 0,
    battery: 100,
    oxygen: 100,
    co2: 1,
    noise: 2,
    cavitation: 0,
  });
  engine.player.setDepth(5, 300);
  return engine;
}

function simulate(engine, seconds) {
  const steps = Math.ceil((seconds * 1000) / 80);
  for (let index = 0; index < steps; index += 1) engine.step(80);
  return engine.snapshot();
}

function firstDamageTime(engine, maxSeconds = 180) {
  const steps = Math.ceil((maxSeconds * 1000) / 80);
  for (let index = 0; index < steps; index += 1) {
    engine.step(80);
    if (engine.snapshot().metrics.damageTaken > 0) return (index + 1) * 0.08;
  }
  return null;
}

test('quiet initial patrol does not trigger an instant alert or attack', () => {
  const engine = createEngine();
  const snapshot = simulate(engine, 60);
  assert.ok(snapshot.detectionScore < 28);
  assert.equal(snapshot.navalAI.metrics.patternsDropped, 0);
  assert.equal(snapshot.metrics.damageTaken, 0);
  assert.equal(snapshot.hull, 100);
  engine.dispose();
});

test('continuous periscope exposure warns the player before the first damaging attack', () => {
  const engine = createEngine();
  assert.equal(engine.openPeriscope().ok, true);
  const damageAt = firstDamageTime(engine, 120);
  assert.ok(damageAt !== null && damageAt >= 50, `first damage at ${damageAt}s`);
  assert.ok(damageAt <= 115, `first damage at ${damageAt}s`);
  engine.dispose();
});

test('torpedo wake provokes immediate hunting but not instant damage', () => {
  const engine = createEngine();
  engine.target.moveTo(100, 0);
  engine.escort.moveTo(320, 40);
  engine.session.view = { x: 100, y: 0 };
  assert.equal(engine.openPeriscope().ok, true);
  assert.equal(engine.syncTdcSolution().ok, true);
  assert.equal(engine.setSalvoSize(1).ok, true);
  assert.equal(engine.fireTorpedo().ok, true);
  assert.equal(engine.snapshot().navalAI.globalState, 'hunt');
  const damageAt = firstDamageTime(engine, 90);
  assert.ok(damageAt !== null && damageAt >= 34, `first damage at ${damageAt}s`);
  engine.dispose();
});

test('depth order and actual depth remain separate progressive instrument values', () => {
  const engine = createEngine();
  const before = engine.snapshot();
  engine.adjustDepth(60);
  const ordered = engine.snapshot();
  assert.equal(ordered.depth, before.depth);
  assert.equal(ordered.physics.orderedDepth, before.physics.orderedDepth + 60);
  const after = simulate(engine, 8);
  assert.ok(after.depth > before.depth);
  assert.ok(after.depth < after.physics.orderedDepth);
  assert.notEqual(after.physics.verticalSpeed, 0);
  engine.dispose();
});

test('telegraph command and actual speed are separate physical values', () => {
  const engine = createEngine();
  assert.equal(engine.setSpeed('flank').ok, true);
  const immediate = engine.snapshot();
  assert.equal(immediate.speed, 'flank');
  assert.equal(immediate.physics.actualSpeedKnots, 0);
  const after = simulate(engine, 4);
  assert.ok(after.physics.actualSpeedKnots > immediate.physics.actualSpeedKnots);
  assert.ok(after.physics.actualSpeedKnots < 25);
  engine.dispose();
});
