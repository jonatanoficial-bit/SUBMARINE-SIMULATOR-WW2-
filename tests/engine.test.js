import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus } from '../js/engine/core/EventBus.js';
import { SimulationClock } from '../js/engine/core/SimulationClock.js';
import { Entity } from '../js/engine/entities/Entity.js';
import { SceneManager } from '../js/engine/scenes/SceneManager.js';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const mission = {
  id: 'qa-mission',
  targetType: 'merchant',
  targetStartX: 220,
  targetStartY: 18,
  escortStartX: 310,
  escortStartY: 42,
  escortSensitivity: 1,
  targetDrift: 0.7,
  targetWave: 0.35,
  targetBob: 6,
  bonusReward: 500,
  bonusXp: 80,
};

test('EventBus subscribes, emits and unsubscribes deterministically', () => {
  const bus = new EventBus();
  let total = 0;
  const unsubscribe = bus.on('score', (value) => { total += value; });
  assert.equal(bus.emit('score', 4), 1);
  unsubscribe();
  assert.equal(bus.emit('score', 4), 0);
  assert.equal(total, 4);
});

test('SimulationClock supports deterministic manual fixed steps', () => {
  let steps = 0;
  const clock = new SimulationClock({ fixedStepMs: 80, onStep: () => { steps += 1; } });
  clock.stepOnce();
  clock.stepOnce();
  assert.equal(steps, 2);
  assert.deepEqual(clock.diagnostics(), {
    running: false,
    paused: false,
    fixedStepMs: 80,
    tickCount: 2,
    elapsedMs: 160,
  });
});

test('Entity positions and distance are serializable', () => {
  const entity = new Entity({ id: 'e1', x: 3, y: 4 });
  assert.equal(entity.distanceTo({ x: 0, y: 0 }), 5);
  entity.translate(2, -1);
  assert.deepEqual(entity.snapshot().x, 5);
  assert.deepEqual(entity.snapshot().y, 3);
});

test('SceneManager enforces enter and exit lifecycle', () => {
  const lifecycle = [];
  const manager = new SceneManager()
    .register('menu', { render: () => '<menu>', enter: () => lifecycle.push('menu-enter'), exit: () => lifecycle.push('menu-exit') })
    .register('game', { render: () => '<game>', enter: () => lifecycle.push('game-enter'), exit: () => lifecycle.push('game-exit') });
  assert.equal(manager.render('menu', {}), '<menu>');
  manager.enterActive();
  assert.equal(manager.render('game', {}), '<game>');
  manager.enterActive();
  manager.exitActive();
  assert.deepEqual(lifecycle, ['menu-enter', 'menu-exit', 'game-enter', 'game-exit']);
});

test('SimulationEngine exposes a multi-entity convoy and advances the world', () => {
  const engine = new SimulationEngine({ mission });
  const before = engine.snapshot();
  engine.step(80);
  const after = engine.snapshot();
  assert.equal(after.entityCount, 1 + after.navalAI.totalShips);
  assert.ok(after.entityCount > 3);
  assert.equal(after.worldTime, 1);
  assert.equal(after.elapsedMs, 80);
  assert.notEqual(after.target.x, before.target.x);
  assert.equal(engine.diagnostics().clock.fixedStepMs, 80);
  engine.dispose();
});

test('Torpedo resolution is deterministic and independent from DOM timers', () => {
  const engine = new SimulationEngine({ mission });
  engine.moveView(340, 18);
  assert.equal(engine.openPeriscope().ok, true);
  assert.equal(engine.targetLock(), true);
  const fired = engine.fireTorpedo();
  assert.equal(fired.ok, true);
  for (let i = 0; i < 300 && engine.snapshot().torpedoActive; i += 1) engine.step(80);
  const snapshot = engine.snapshot();
  assert.equal(snapshot.targetDestroyed, true);
  assert.equal(snapshot.canComplete, false);
  assert.equal(snapshot.encounter.phase, 'evade');
  assert.equal(snapshot.metrics.hits, 1);
  assert.equal(snapshot.torpedoes, 3);
  assert.equal(engine.missionReport(), null);
  engine.dispose();
});

test('Damage, failure and emergency repair use engine state only', () => {
  const engine = new SimulationEngine({ mission: { ...mission, escortSensitivity: 0 }, initialHull: 80 });
  engine.applyDamage(20, 'engines');
  assert.equal(engine.snapshot().hull, 60);
  assert.equal(engine.startEmergencyRepair().ok, true);
  for (let i = 0; i < 55; i += 1) engine.step(80);
  assert.equal(engine.snapshot().hull, 74);
  engine.applyDamage(100, 'weapons');
  assert.equal(engine.snapshot().missionFailed, true);
  assert.equal(engine.snapshot().hull, 0);
  engine.dispose();
});

test('simulation snapshot restores deterministic tactical state', () => {
  const original = new SimulationEngine({ mission: mission, initialHull: 91 });
  original.adjustDepth(72);
  original.setSpeed('full');
  original.moveView(18, -6);
  original.activateSilentRunning();
  for (let index = 0; index < 42; index += 1) original.step(80);
  const snapshot = original.snapshot();
  const restored = new SimulationEngine({ mission: mission, initialHull: 100, initialSnapshot: snapshot });
  const next = restored.snapshot();
  assert.equal(next.missionId, snapshot.missionId);
  assert.equal(next.depth, snapshot.depth);
  assert.equal(next.speed, snapshot.speed);
  assert.equal(next.worldTime, snapshot.worldTime);
  assert.deepEqual(next.view, snapshot.view);
  assert.deepEqual(next.systems, snapshot.systems);
  assert.equal(next.detectionScore, snapshot.detectionScore);
});
