import assert from 'node:assert/strict';
import test from 'node:test';
import { NavalAISystem } from '../js/engine/ai/NavalAISystem.js';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

function mission(overrides = {}) {
  return {
    id: 'ai-test',
    year: '1943',
    difficulty: 'III',
    theatreKey: 'mission.theatre.convoy',
    targetType: 'merchant',
    targetStartX: 230,
    targetStartY: 18,
    escortStartX: 320,
    escortStartY: 42,
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    worldTime: 100,
    timeCompression: 1,
    detectionScore: 0,
    targetDestroyed: false,
    torpedoActive: false,
    playerDepth: 70,
    actualSpeedKnots: 3,
    noise: 8,
    decoyActive: false,
    silentRunning: true,
    periscopeOpen: false,
    radarMastRaised: false,
    ...overrides,
  };
}

test('difficulty creates a real multi-ship convoy with coordinated escorts', () => {
  const ai = new NavalAISystem({ mission: mission() });
  const snapshot = ai.snapshot();
  assert.ok(snapshot.profile.merchantCount >= 4);
  assert.ok(snapshot.profile.escortCount >= 2);
  assert.equal(snapshot.ships.length, snapshot.profile.merchantCount + snapshot.profile.escortCount);
  assert.equal(ai.primaryTarget.role, 'target');
  assert.equal(ai.primaryEscort.role, 'escort');
});

test('convoy formation advances while preserving independent ship positions', () => {
  const ai = new NavalAISystem({ mission: mission() });
  const before = ai.snapshot();
  for (let index = 0; index < 30; index += 1) ai.update(80, context({ worldTime: index }));
  const after = ai.snapshot();
  assert.ok(after.formationAnchor.x < before.formationAnchor.x);
  assert.notEqual(after.ships[0].x, before.ships[0].x);
  assert.notEqual(after.ships[1].y, after.ships[0].y);
});

test('detection drives alert, search and hunt states deterministically', () => {
  const ai = new NavalAISystem({ mission: mission() });
  ai.update(80, context({ detectionScore: 35 }));
  assert.equal(ai.snapshot().globalState, 'alert');
  ai.update(80, context({ detectionScore: 75 }));
  assert.equal(ai.snapshot().globalState, 'hunt');
  ai.state.hostileActionAgeMs = 40000;
  ai.state.stateAgeMs = 13000;
  ai.state.contactConfidence = 40;
  ai.update(80, context({ detectionScore: 0, silentRunning: true, playerDepth: 90 }));
  assert.equal(ai.snapshot().globalState, 'search');
});

test('torpedo wake immediately forces coordinated hunting', () => {
  const ai = new NavalAISystem({ mission: mission() });
  ai.notifyTorpedoLaunch([{ id: 'shot-1' }, { id: 'shot-2' }]);
  const snapshot = ai.snapshot();
  assert.equal(snapshot.globalState, 'hunt');
  assert.equal(snapshot.lastMessageKey, 'ai.torpedoWakeDetected');
  assert.ok(ai.drainThreatEvents().some((event) => event.type === 'torpedoWake'));
});

test('escort attack has a readable hunt lead time before launching depth charges', () => {
  const ai = new NavalAISystem({ mission: mission() });
  ai.setGlobalState('hunt', { force: true });
  ai.state.attackCooldownMs = 0;
  ai.activeEscorts().forEach((escort, index) => escort.moveTo(index * 20, 0));
  const huntingContext = context({ detectionScore: 90, playerDepth: 55, silentRunning: false });

  // The escort must search and line up an attack instead of damaging the player instantly.
  for (let index = 0; index < 300; index += 1) ai.update(80, huntingContext);
  assert.equal(ai.snapshot().depthChargePatterns.length, 0);

  for (let index = 0; index < 45; index += 1) ai.update(80, huntingContext);
  assert.equal(ai.snapshot().depthChargePatterns.length, 1);

  for (let index = 0; index < 125; index += 1) ai.update(80, huntingContext);
  const outcomes = [...ai.drainDamageEvents(), ...ai.drainThreatEvents()];
  assert.ok(outcomes.some((event) => event.type === 'depthCharge' || event.type === 'nearMiss'));
});

test('decoys reduce or preserve depth-charge damage relative to an identical pattern', () => {
  const plain = new NavalAISystem({ mission: mission() });
  const decoy = new NavalAISystem({ mission: mission() });
  plain.launchDepthChargePattern(plain.primaryEscort, context({ playerDepth: 45 }), false);
  decoy.launchDepthChargePattern(decoy.primaryEscort, context({ playerDepth: 45 }), false);
  plain.updatePatterns(10000, context({ playerDepth: 45, actualSpeedKnots: 2, decoyActive: false, silentRunning: false }));
  decoy.updatePatterns(10000, context({ playerDepth: 45, actualSpeedKnots: 2, decoyActive: true, silentRunning: false }));
  const plainDamage = plain.drainDamageEvents()[0]?.amount || 0;
  const decoyDamage = decoy.drainDamageEvents()[0]?.amount || 0;
  assert.ok(decoyDamage <= plainDamage);
});

test('aircraft availability respects mission year', () => {
  const early = new NavalAISystem({ mission: mission({ year: '1940', difficulty: 'I' }) });
  const late = new NavalAISystem({ mission: mission({ year: '1944', difficulty: 'III' }) });
  assert.equal(early.snapshot().aircraft.available, false);
  assert.equal(late.snapshot().aircraft.available, true);
});

test('ASW aircraft spawns, tracks exposed submarine and launches an attack', () => {
  const ai = new NavalAISystem({ mission: mission({ year: '1944' }) });
  ai.state.aircraftSpawnCooldownMs = 0;
  ai.update(80, context({ playerDepth: 5, periscopeOpen: true, detectionScore: 50 }));
  assert.equal(ai.snapshot().aircraft.active, true);
  for (let index = 0; index < 72; index += 1) ai.update(80, context({ worldTime: index, timeCompression: 4, playerDepth: 5, periscopeOpen: true, detectionScore: 70 }));
  const snapshot = ai.snapshot();
  assert.ok(snapshot.aircraft.detectionConfidence >= 45);
  assert.ok(snapshot.metrics.aircraftAttacks >= 1 || snapshot.depthChargePatterns.some((pattern) => pattern.sourceType === 'aircraft'));
});

test('AI snapshot restores convoy, search and ASW states', () => {
  const ai = new NavalAISystem({ mission: mission() });
  ai.notifyTorpedoLaunch([{ id: 'shot-1' }]);
  ai.state.aircraftSpawnCooldownMs = 0;
  ai.update(80, context({ playerDepth: 5, periscopeOpen: true, detectionScore: 80 }));
  ai.primaryTarget.destroy();
  const saved = ai.snapshot();
  const restored = new NavalAISystem({ mission: mission() });
  assert.equal(restored.restore(saved), true);
  const snapshot = restored.snapshot();
  assert.equal(snapshot.globalState, saved.globalState);
  assert.equal(snapshot.ships.find((ship) => ship.id === ai.primaryTarget.id).destroyed, true);
  assert.equal(snapshot.aircraft.active, saved.aircraft.active);
});

test('SimulationEngine exports AI snapshot v10 and all active entities', () => {
  const engine = new SimulationEngine({ mission: mission(), submarine: { id: 'de_type_viia_starter', nation: 'de', stats: { torpedoes: 8 } } });
  const snapshot = engine.snapshot();
  assert.equal(snapshot.snapshotVersion, 10);
  assert.equal(snapshot.navalAI.aiVersion, 2);
  assert.equal(snapshot.entityCount, 1 + snapshot.navalAI.totalShips);
  assert.ok(snapshot.entityCount > 3);
});

test('SimulationEngine operation snapshot restores complete convoy AI state', () => {
  const options = { mission: mission(), submarine: { id: 'de_type_viia_starter', nation: 'de', stats: { torpedoes: 8 } } };
  const engine = new SimulationEngine(options);
  engine.navalAI.notifyTorpedoLaunch([{ id: 'shot-x' }]);
  engine.navalAI.primaryEscort.moveTo(30, 12);
  engine.step(80);
  const saved = engine.snapshot();
  const restored = new SimulationEngine({ ...options, initialSnapshot: saved });
  const snapshot = restored.snapshot();
  assert.equal(snapshot.navalAI.globalState, saved.navalAI.globalState);
  assert.equal(snapshot.navalAI.ships.length, saved.navalAI.ships.length);
  assert.equal(snapshot.navalAI.ships[0].id, saved.navalAI.ships[0].id);
});
