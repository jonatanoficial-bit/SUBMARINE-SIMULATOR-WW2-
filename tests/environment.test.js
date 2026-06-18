import test from 'node:test';
import assert from 'node:assert/strict';

import { EnvironmentSystem } from '../js/engine/environment/EnvironmentSystem.js';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const mission = { id:'atlantic-test', year:'1942', theatreKey:'mission.theatre.atlantic', difficulty:'III', targetStartX:220, targetStartY:18, escortStartX:310, escortStartY:42 };
const submarine = { id:'de_type_viic_hunter', nation:'de', stats:{ stealth:76, range:74 } };

test('environment is deterministic for the same mission seed', () => {
  const first = new EnvironmentSystem({ mission }).snapshot();
  const second = new EnvironmentSystem({ mission }).snapshot();
  assert.deepEqual(first, second);
  assert.equal(first.environmentVersion, 1);
});

test('different missions create distinct but bounded sea conditions', () => {
  const atlantic = new EnvironmentSystem({ mission }).snapshot();
  const pacific = new EnvironmentSystem({ mission:{ ...mission, id:'pacific-test', theatreKey:'mission.theatre.pacific' } }).snapshot();
  assert.notDeepEqual({ sea:atlantic.seaState, hour:atlantic.hour }, { sea:pacific.seaState, hour:pacific.hour });
  for (const snapshot of [atlantic,pacific]) {
    assert.ok(snapshot.seaState >= 0 && snapshot.seaState <= 6);
    assert.ok(snapshot.visibilityMeters >= 850 && snapshot.visibilityMeters <= 14500);
    assert.ok(snapshot.visualFactor >= .16 && snapshot.visualFactor <= 1.12);
    assert.ok(snapshot.acousticPropagation >= .48 && snapshot.acousticPropagation <= 1.22);
  }
});

test('weather progression is deterministic and moves horizon instruments', () => {
  const first = new EnvironmentSystem({ mission });
  const second = new EnvironmentSystem({ mission });
  for (let index=0; index<200; index+=1) {
    first.update(80,{ timeCompression:4 });
    second.update(80,{ timeCompression:4 });
  }
  assert.deepEqual(first.snapshot(), second.snapshot());
  assert.notEqual(first.snapshot().wavePhase, 0);
  assert.ok(Number.isFinite(first.snapshot().rollDegrees));
  assert.ok(Number.isFinite(first.snapshot().horizonOffset));
});

test('environment snapshot restores operational conditions exactly', () => {
  const source = new EnvironmentSystem({ mission });
  source.update(120000,{ timeCompression:8 });
  const snapshot = source.snapshot();
  const restored = new EnvironmentSystem({ mission, initialSnapshot:snapshot }).snapshot();
  const fields=['hour','seaState','windKnots','windBearing','precipitation','cloudCover','moonlight','thermalLayerDepth','wavePhase'];
  for (const field of fields) assert.equal(restored[field], snapshot[field], field);
  assert.equal(restored.lightCondition, snapshot.lightCondition);
});

test('SimulationEngine exposes and restores environment in operation snapshot v10', () => {
  const engine = new SimulationEngine({ mission, submarine });
  for (let index=0; index<120; index+=1) engine.step(80);
  const snapshot=engine.snapshot();
  assert.equal(snapshot.snapshotVersion,10);
  assert.equal(snapshot.environment.environmentVersion,1);
  assert.equal(engine.diagnostics().environmentVersion,1);
  const restored=new SimulationEngine({ mission, submarine, initialSnapshot:snapshot });
  const current=restored.snapshot();
  assert.equal(current.environment.hour,snapshot.environment.hour);
  assert.equal(current.environment.wavePhase,snapshot.environment.wavePhase);
  engine.dispose(); restored.dispose();
});
