import test from 'node:test';
import assert from 'node:assert/strict';
import { getDifficultyProfile, normalizeDifficultyId } from '../js/engine/training/DifficultyProfile.js';
import { OperationalTraining } from '../js/engine/training/OperationalTraining.js';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const mission = { id:'training-test', year:'1942', difficulty:'II', torpedoes:6, targetStartX:220, targetStartY:10, escortStartX:320, escortStartY:30, escortSensitivity:1 };

test('difficulty ids sanitize and expose ordered profiles', () => {
  assert.equal(normalizeDifficultyId('invalid'), 'officer');
  const cadet = getDifficultyProfile('cadet');
  const officer = getDifficultyProfile('officer');
  const hardcore = getDifficultyProfile('hardcore');
  assert.ok(cadet.enemyDetectionMultiplier < officer.enemyDetectionMultiplier);
  assert.ok(hardcore.enemyDamageMultiplier > officer.enemyDamageMultiplier);
  assert.ok(cadet.weaponQualityBonus > hardcore.weaponQualityBonus);
  assert.ok(cadet.resourceConsumptionMultiplier < hardcore.resourceConsumptionMultiplier);
});

test('engine snapshot preserves selected difficulty', () => {
  const engine = new SimulationEngine({ mission, difficulty:'simulator' });
  const snapshot = engine.snapshot();
  assert.equal(snapshot.difficulty.id, 'simulator');
  assert.equal(snapshot.snapshotVersion, 10);
  const resumed = new SimulationEngine({ mission, difficulty:'cadet', initialSnapshot:snapshot });
  assert.equal(resumed.snapshot().difficulty.id, 'simulator');
  engine.dispose(); resumed.dispose();
});

test('cadet and hardcore alter resource consumption deterministically', () => {
  const cadet = new SimulationEngine({ mission, difficulty:'cadet' });
  const hardcore = new SimulationEngine({ mission, difficulty:'hardcore' });
  cadet.physics.state.depth = 40; cadet.physics.state.orderedDepth = 40;
  hardcore.physics.state.depth = 40; hardcore.physics.state.orderedDepth = 40;
  cadet.player.setDepth(40, 300); hardcore.player.setDepth(40, 300);
  cadet.setSpeed('full'); hardcore.setSpeed('full');
  for (let i=0;i<450;i++){ cadet.step(80); hardcore.step(80); }
  assert.ok(cadet.snapshot().physics.battery > hardcore.snapshot().physics.battery);
  cadet.dispose(); hardcore.dispose();
});

test('operational training advances only from real snapshot state', () => {
  const training = new OperationalTraining({ enabled:true });
  let state = training.update({ elapsedMs:700, speed:'stop', depth:12, sensors:{contacts:{target:{detected:false}}}, weapons:{tdc:{solutionQuality:0}}, metrics:{shots:0}, encounter:{} });
  assert.ok(state.completed.includes('orientation'));
  assert.equal(state.currentStep, 'propulsion');
  state = training.update({ elapsedMs:1000, speed:'slow', depth:22, periscopeOpen:true, sensors:{contacts:{target:{detected:true}}}, weapons:{tdc:{solutionQuality:60}}, metrics:{shots:1}, encounter:{phase:'evade', doctrine:'evade'}, canComplete:true });
  for (const id of ['propulsion','depth','contact','periscope','solution','attack','evade','safe']) assert.ok(state.completed.includes(id));
  assert.equal(state.progress,100);
});

test('training danger recommendation prioritizes damage and enemy hunt', () => {
  const training = new OperationalTraining({ enabled:true });
  let state = training.update({ damageControl:{criticalCompartments:1,totalFlooding:10,totalFire:0} });
  assert.equal(state.dangerStation,'damage');
  training.reset();
  state = training.update({ escortState:'hunt', detectionScore:80, damageControl:{criticalCompartments:0,totalFlooding:0,totalFire:0} });
  assert.equal(state.dangerStation,'ai');
});
