import test from 'node:test';
import assert from 'node:assert/strict';

import { TacticalEncounterSystem } from '../js/engine/tactical/TacticalEncounterSystem.js';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const mission = {
  id: 'tactical-qa',
  year: '1941',
  difficulty: 'I',
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
  bonusReward: 500,
  bonusXp: 80,
};

const submarine = {
  id: 'de_type_viia_starter',
  nation: 'de',
  stats: { torpedoes: 8, maxSpeed: 17, maxDepth: 220 },
};

function context(overrides = {}) {
  return {
    missionFailed: false,
    targetDestroyed: false,
    torpedoActive: false,
    detectionScore: 8,
    periscopeOpen: false,
    depth: 12,
    silentRunning: false,
    timeCompression: 1,
    metrics: { shots: 0 },
    physics: { noise: 18 },
    sensors: {
      contacts: {
        target: {
          detected: true,
          confidence: 72,
          stale: false,
          rangeKnown: true,
          rangeMeters: 1800,
        },
      },
    },
    weapons: { tdc: { solutionQuality: 68 } },
    navalAI: {
      globalState: 'formation',
      nearestEscortRange: 240,
      contactConfidence: 8,
      attackSolution: 0,
      depthChargePatterns: [],
    },
    ...overrides,
  };
}

function createEngine() {
  const engine = new SimulationEngine({ mission, submarine });
  engine.stop();
  engine.physics.restore({
    ...engine.snapshot().physics,
    depth: 90,
    orderedDepth: 90,
    verticalSpeed: 0,
    battery: 100,
    oxygen: 100,
    co2: 1,
    noise: 2,
    cavitation: 0,
  });
  engine.player.setDepth(90, 300);
  engine.setSpeed('slow');
  engine.activateSilentRunning();
  return engine;
}

function simulate(engine, seconds) {
  const steps = Math.ceil((seconds * 1000) / 80);
  for (let index = 0; index < steps; index += 1) engine.step(80);
  return engine.snapshot();
}

test('tactical encounter accepts only supported doctrines', () => {
  const system = new TacticalEncounterSystem({ mission });
  assert.equal(system.setDoctrine('attack').ok, true);
  assert.equal(system.snapshot().doctrine, 'attack');
  assert.deepEqual(system.setDoctrine('arcade'), {
    ok: false,
    reason: 'invalidDoctrine',
    key: 'encounter.invalidDoctrine',
  });
});

test('contact quality and TDC solution open a tactical attack window', () => {
  const system = new TacticalEncounterSystem({ mission });
  system.setDoctrine('attack');
  const snapshot = system.update(80, context({
    sensors: { contacts: { target: { detected: true, confidence: 92, stale: false, rangeKnown: true, rangeMeters: 620 } } },
    weapons: { tdc: { solutionQuality: 90 } },
  }));
  assert.equal(snapshot.phase, 'attack');
  assert.ok(snapshot.attackReadiness >= 70, `readiness ${snapshot.attackReadiness}`);
});

test('periscope exposure accumulates and produces a lower-scope recommendation', () => {
  const system = new TacticalEncounterSystem({ mission });
  for (let index = 0; index < 240; index += 1) {
    system.update(80, context({ periscopeOpen: true }));
  }
  const snapshot = system.snapshot();
  assert.ok(snapshot.periscopeExposureMs >= 19000);
  assert.equal(snapshot.recommendedKey, 'encounter.recommendLowerScope');
  assert.ok(snapshot.metrics.longestExposureMs >= snapshot.periscopeExposureMs);
});

test('enemy solution is derived from contact confidence, ASW solution and detection', () => {
  const system = new TacticalEncounterSystem({ mission });
  const low = system.update(80, context()).enemySolution;
  const high = system.update(80, context({
    detectionScore: 82,
    navalAI: {
      globalState: 'hunt',
      nearestEscortRange: 80,
      contactConfidence: 88,
      attackSolution: 91,
      depthChargePatterns: [{ id: 'pattern-1' }],
    },
  })).enemySolution;
  assert.ok(high > low + 50, `low ${low}, high ${high}`);
});

test('destroying the objective never authorizes immediate completion', () => {
  const system = new TacticalEncounterSystem({ mission });
  const snapshot = system.update(80, context({
    targetDestroyed: true,
    detectionScore: 70,
    metrics: { shots: 1 },
    navalAI: {
      globalState: 'hunt',
      nearestEscortRange: 80,
      contactConfidence: 90,
      attackSolution: 75,
      depthChargePatterns: [],
    },
  }));
  assert.equal(snapshot.phase, 'evade');
  assert.equal(snapshot.completionAuthorized, false);
  assert.equal(snapshot.escapeProgress, 0);
});

test('safe disengagement requires a continuous verified safety window', () => {
  const system = new TacticalEncounterSystem({ mission });
  const safeContext = context({
    targetDestroyed: true,
    depth: 90,
    silentRunning: true,
    detectionScore: 0,
    metrics: { shots: 1 },
    navalAI: {
      globalState: 'regroup',
      nearestEscortRange: 240,
      contactConfidence: 4,
      attackSolution: 0,
      depthChargePatterns: [],
    },
  });
  for (let index = 0; index < 274; index += 1) system.update(80, safeContext);
  assert.equal(system.snapshot().completionAuthorized, false);
  assert.ok(system.snapshot().escapeProgress < 100);
  system.update(80, safeContext);
  assert.equal(system.snapshot().phase, 'complete');
  assert.equal(system.snapshot().completionAuthorized, true);
  assert.equal(system.snapshot().escapeProgress, 100);
});

test('an unsafe exposure drains accumulated disengagement progress', () => {
  const system = new TacticalEncounterSystem({ mission });
  const safeContext = context({
    targetDestroyed: true,
    depth: 90,
    silentRunning: true,
    detectionScore: 0,
    metrics: { shots: 1 },
    navalAI: { globalState: 'regroup', nearestEscortRange: 240, contactConfidence: 4, attackSolution: 0, depthChargePatterns: [] },
  });
  for (let index = 0; index < 150; index += 1) system.update(80, safeContext);
  const before = system.snapshot().safeTimerMs;
  for (let index = 0; index < 50; index += 1) system.update(80, { ...safeContext, periscopeOpen: true });
  const after = system.snapshot().safeTimerMs;
  assert.ok(before > after, `before ${before}, after ${after}`);
  assert.equal(system.snapshot().completionAuthorized, false);
});

test('encounter snapshot restores phase, doctrine, exposure and escape state', () => {
  const original = new TacticalEncounterSystem({ mission });
  original.setDoctrine('evade');
  for (let index = 0; index < 120; index += 1) {
    original.update(80, context({
      targetDestroyed: true,
      depth: 90,
      silentRunning: true,
      detectionScore: 0,
      metrics: { shots: 1 },
      navalAI: { globalState: 'regroup', nearestEscortRange: 240, contactConfidence: 4, attackSolution: 0, depthChargePatterns: [] },
    }));
  }
  const restored = new TacticalEncounterSystem({ mission, initialSnapshot: original.snapshot() });
  assert.deepEqual(restored.snapshot(), original.snapshot());
});

test('SimulationEngine operation snapshot v10 preserves tactical encounter state', () => {
  const original = createEngine();
  original.resolveWeaponShot({ targetRole: 'target', outcome: 'hit' });
  simulate(original, 10);
  const saved = original.snapshot();
  assert.equal(saved.snapshotVersion, 10);
  assert.equal(saved.encounter.encounterVersion, 1);
  const restored = new SimulationEngine({ mission, submarine, initialSnapshot: saved });
  restored.stop();
  assert.equal(restored.snapshot().encounter.phase, original.snapshot().encounter.phase);
  assert.equal(restored.snapshot().encounter.safeTimerMs, original.snapshot().encounter.safeTimerMs);
  assert.equal(restored.snapshot().targetDestroyed, true);
  original.dispose();
  restored.dispose();
});

test('integrated post-attack evasion loses contact before mission completion', () => {
  const engine = createEngine();
  engine.session.detectionScore = 38;
  engine.navalAI.notifyTorpedoLaunch([]);
  engine.resolveWeaponShot({ targetRole: 'target', outcome: 'hit' });
  engine.closePeriscope();

  let searchAt = null;
  let regroupAt = null;
  let completeAt = null;
  for (let index = 0; index < 2000; index += 1) {
    engine.step(80);
    const snapshot = engine.snapshot();
    const seconds = (index + 1) * 0.08;
    if (snapshot.navalAI.globalState === 'search' && searchAt === null) searchAt = seconds;
    if (snapshot.navalAI.globalState === 'regroup' && regroupAt === null) regroupAt = seconds;
    if (snapshot.canComplete) {
      completeAt = seconds;
      break;
    }
  }

  const snapshot = engine.snapshot();
  assert.ok(searchAt !== null && searchAt >= 32, `search at ${searchAt}`);
  assert.ok(regroupAt !== null && regroupAt > searchAt, `regroup at ${regroupAt}`);
  assert.ok(completeAt !== null && completeAt >= 85, `complete at ${completeAt}`);
  assert.equal(snapshot.encounter.phase, 'complete');
  assert.equal(snapshot.encounter.completionAuthorized, true);
  assert.ok(snapshot.encounter.metrics.contactsLost >= 1);
  assert.notEqual(engine.missionReport(), null);
  engine.dispose();
});

test('mission report remains blocked until safe disengagement is complete', () => {
  const engine = createEngine();
  engine.resolveWeaponShot({ targetRole: 'target', outcome: 'hit' });
  assert.equal(engine.snapshot().targetDestroyed, true);
  assert.equal(engine.snapshot().canComplete, false);
  assert.equal(engine.missionReport(), null);
  simulate(engine, 95);
  assert.equal(engine.snapshot().canComplete, true);
  assert.notEqual(engine.missionReport(), null);
  engine.dispose();
});
