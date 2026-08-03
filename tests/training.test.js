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
  const training = new OperationalTraining({ enabled:true, guided:true });
  training.visitStation('sensors');
  let state = training.update({ activeStation:'sensors', speed:'stop', depth:12, sensors:{contacts:{target:{detected:false}}}, weapons:{tdc:{solutionQuality:0}}, metrics:{shots:0} });
  assert.deepEqual(state.completed, ['contact']);
  assert.equal(state.currentStep, 'sonar');

  state = training.update({ activeStation:'sensors', speed:'stop', depth:12, sensors:{contacts:{target:{detected:true,confidence:34,source:'hydrophone',rangeMeters:2100}}}, weapons:{tdc:{solutionQuality:0}}, metrics:{shots:0} });
  assert.equal(state.currentStep, 'approach');
  state = training.update({ activeStation:'sensors', speed:'slow', depth:20, sensors:{contacts:{target:{detected:true,confidence:42,source:'hydrophone',rangeMeters:1800}}}, weapons:{tdc:{solutionQuality:0}}, metrics:{shots:0} });
  assert.equal(state.currentStep, 'approach');
  state = training.update({ activeStation:'instruments', speed:'slow', depth:20, sensors:{contacts:{target:{detected:true,confidence:42,source:'hydrophone',rangeMeters:1800}}}, weapons:{tdc:{solutionQuality:0}}, metrics:{shots:0} });
  assert.equal(state.currentStep, 'solution');
  state = training.update({ activeStation:'weapons', speed:'slow', depth:20, sensors:{contacts:{target:{detected:true,confidence:56,source:'hydrophone',rangeMeters:1600}}}, weapons:{tdc:{solutionQuality:48}}, metrics:{shots:0} });
  assert.equal(state.currentStep, 'attack');
  state = training.update({ activeStation:'weapons', speed:'slow', depth:20, weapons:{tdc:{solutionQuality:48}}, metrics:{shots:1} });
  assert.equal(state.currentStep, 'evade');
  state = training.update({ activeStation:'instruments', speed:'slow', depth:60, weapons:{tdc:{solutionQuality:48}}, metrics:{shots:1} });
  assert.deepEqual(state.completed, ['contact','sonar','approach','solution','attack','evade']);
  assert.equal(state.progress,100);
  assert.equal(state.finished,true);
  assert.equal(state.instructionKey,'training.guideComplete');
});

test('guided training cannot be dismissed and does not skip out-of-order steps', () => {
  const training = new OperationalTraining({ enabled:true, guided:true });
  training.dismiss();
  let state = training.update({ speed:'slow', depth:80, sensors:{contacts:{target:{detected:true,confidence:90,source:'activeSonar',rangeMeters:900}}}, weapons:{tdc:{solutionQuality:90}}, metrics:{shots:2} });
  assert.equal(state.dismissed, false);
  assert.equal(state.currentStep, 'contact');
  assert.equal(state.progress, 0);
});

test('training danger recommendation prioritizes damage and enemy hunt', () => {
  const training = new OperationalTraining({ enabled:true });
  let state = training.update({ damageControl:{criticalCompartments:1,totalFlooding:10,totalFire:0} });
  assert.equal(state.dangerStation,'damage');
  training.reset();
  state = training.update({ escortState:'hunt', detectionScore:80, damageControl:{criticalCompartments:0,totalFlooding:0,totalFire:0} });
  assert.equal(state.dangerStation,'ai');
});
