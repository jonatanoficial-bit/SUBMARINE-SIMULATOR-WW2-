import test from 'node:test';
import assert from 'node:assert/strict';

import { SensorSystem } from '../js/engine/sensors/SensorSystem.js';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const submarine = { id: 'de_type_viic_hunter', nation: 'de', stats: { stealth: 76, range: 74 } };
const mission1940 = { id: 's40', year: '1940', targetType: 'merchant', targetStartX: 220, targetStartY: 18, escortStartX: 310, escortStartY: 42, escortSensitivity: 0 };
const mission1942 = { ...mission1940, id: 's42', year: '1942' };
const contacts = { target: { x: 220, y: 18, destroyed: false }, escort: { x: 310, y: 42, destroyed: false } };
const quietContext = { worldTime: 20, depth: 60, systems: { sonar: 100, periscope: 100 }, physics: { noise: 4, cavitation: 0 }, timeCompression: 1, contacts, periscopeOpen: false, view: { x: 0, y: 0 } };

function advance(system, ticks = 20, context = quietContext) {
  for (let index = 0; index < ticks; index += 1) system.update(100, { ...context, worldTime: context.worldTime + index });
  return system.snapshot();
}

test('sensor profile respects nation and mission year radar introduction', () => {
  const early = new SensorSystem({ mission: mission1940, submarine }).snapshot();
  const later = new SensorSystem({ mission: mission1942, submarine }).snapshot();
  assert.equal(early.profile.radarAvailable, false);
  assert.equal(later.profile.radarAvailable, true);
  assert.ok(later.profile.hydrophoneRangeMeters > 2000);
});

test('passive hydrophone acquires contacts without exposure events', () => {
  const sensors = new SensorSystem({ mission: mission1940, submarine });
  const snapshot = advance(sensors, 20);
  assert.equal(snapshot.contacts.target.detected, true);
  assert.equal(snapshot.contacts.target.source, 'hydrophone');
  assert.ok(snapshot.contacts.target.confidence > 0);
  assert.equal(sensors.drainExposureEvents().length, 0);
});

test('own noise degrades passive signal quality deterministically', () => {
  const quiet = advance(new SensorSystem({ mission: mission1940, submarine }), 40, quietContext);
  const noisyContext = { ...quietContext, physics: { noise: 96, cavitation: 88 } };
  const noisy = advance(new SensorSystem({ mission: mission1940, submarine }), 40, noisyContext);
  assert.ok(quiet.contacts.target.signal > noisy.contacts.target.signal, `${quiet.contacts.target.signal}/${noisy.contacts.target.signal}`);
  assert.ok(quiet.contacts.target.confidence >= noisy.contacts.target.confidence);
});

test('hydrophone bearing control changes focused listening direction', () => {
  const sensors = new SensorSystem({ mission: mission1940, submarine });
  assert.equal(sensors.nudgeHydrophoneBearing(45).bearing, 45);
  assert.equal(sensors.nudgeHydrophoneBearing(-60).bearing, 345);
});

test('active sonar ping returns range and creates detection exposure', () => {
  const sensors = new SensorSystem({ mission: mission1940, submarine });
  const result = sensors.activePing(quietContext);
  const snapshot = sensors.snapshot();
  assert.equal(result.ok, true);
  assert.equal(snapshot.contacts.target.rangeKnown, true);
  assert.equal(snapshot.contacts.target.source, 'activeSonar');
  assert.ok(snapshot.contacts.target.confidence >= 58);
  const events = sensors.drainExposureEvents();
  assert.equal(events.length, 1);
  assert.ok(events[0].detectionBoost >= 20);
});

test('active sonar cooldown blocks repeated pings and expires in simulated time', () => {
  const sensors = new SensorSystem({ mission: mission1940, submarine });
  assert.equal(sensors.activePing(quietContext).ok, true);
  assert.equal(sensors.activePing(quietContext).reason, 'sensorCooldown');
  sensors.update(12000, quietContext);
  assert.equal(sensors.activePing(quietContext).ok, true);
});

test('radar mast is year-gated and depth-interlocked', () => {
  const early = new SensorSystem({ mission: mission1940, submarine });
  assert.equal(early.toggleRadarMast(true, 0).reason, 'radarEraUnavailable');
  const later = new SensorSystem({ mission: mission1942, submarine });
  assert.equal(later.toggleRadarMast(true, 30).reason, 'radarTooDeep');
  assert.equal(later.toggleRadarMast(true, 5).ok, true);
});

test('radar provides precise contact and auto-lowers when submerged', () => {
  const sensors = new SensorSystem({ mission: mission1942, submarine });
  sensors.toggleRadarMast(true, 4);
  const radar = advance(sensors, 8, { ...quietContext, depth: 4 });
  assert.equal(radar.contacts.target.source, 'radar');
  assert.equal(radar.contacts.target.rangeKnown, true);
  assert.ok(radar.contacts.target.bearingUncertainty <= 2);
  const submerged = sensors.update(600, { ...quietContext, depth: 20 });
  assert.equal(submerged.radarMastRaised, false);
});

test('periscope observation increases confidence and classifies the target', () => {
  const sensors = new SensorSystem({ mission: mission1940, submarine });
  const observed = sensors.observeVisual({ ...quietContext, depth: 12, periscopeOpen: true, view: { x: 120, y: 0 } });
  const contact = sensors.snapshot().contacts.target;
  assert.equal(observed, true);
  assert.equal(contact.source, 'periscope');
  assert.ok(contact.confidence >= 35);
  assert.notEqual(contact.classification, 'unknown');
});

test('contact fusion preserves precise periscope solution against weaker passive updates', () => {
  const sensors = new SensorSystem({ mission: mission1940, submarine });
  const visualContext = { ...quietContext, worldTime: 1000, depth: 10, periscopeOpen: true, view: { x: 220, y: 18 }, environment: { visibilityMeters: 9000, precipitation: 0, seaState: 1 } };
  assert.equal(sensors.observeVisual(visualContext), true);
  const visual = sensors.snapshot().contacts.target;
  assert.equal(visual.source, 'periscope');
  sensors.update(1200, { ...quietContext, worldTime: 2200, environment: { ambientNoise: 18, acousticPropagation: 1, thermalLayerDepth: 36 } });
  const fused = sensors.snapshot().contacts.target;
  assert.equal(fused.source, 'periscope');
  assert.equal(fused.supportingSource, 'hydrophone');
  assert.ok(fused.bearingUncertainty <= visual.bearingUncertainty);
});

test('ambient sea noise reduces passive signal while contact history remains bounded', () => {
  const calm = new SensorSystem({ mission: mission1940, submarine });
  const rough = new SensorSystem({ mission: mission1940, submarine });
  const calmContext = { ...quietContext, environment: { ambientNoise: 8, acousticPropagation: 1.15, thermalLayerDepth: 36 } };
  const roughContext = { ...quietContext, environment: { ambientNoise: 88, acousticPropagation: .52, thermalLayerDepth: 10 } };
  const calmSnapshot = advance(calm, 40, calmContext);
  const roughSnapshot = advance(rough, 40, roughContext);
  assert.ok(calmSnapshot.contacts.target.signal > roughSnapshot.contacts.target.signal);
  for (let index=0; index<40; index+=1) calm.update(1000, { ...calmContext, worldTime: 5000 + index * 1000 });
  assert.ok(calm.snapshot().contacts.target.history.length <= 12);
});

test('sensor snapshot restores contacts and instrument state', () => {
  const source = new SensorSystem({ mission: mission1942, submarine });
  source.nudgeHydrophoneBearing(75);
  source.activePing(quietContext);
  const snapshot = source.snapshot();
  const restored = new SensorSystem({ mission: mission1942, submarine, initialSnapshot: snapshot }).snapshot();
  assert.equal(restored.hydrophoneBearing, 75);
  assert.equal(restored.contacts.target.confidence, snapshot.contacts.target.confidence);
  assert.equal(restored.contacts.target.rangeMeters, snapshot.contacts.target.rangeMeters);
});

test('SimulationEngine exposes sensors in operation autosaves and diagnostics', () => {
  const engine = new SimulationEngine({ mission: mission1942, submarine });
  for (let index = 0; index < 20; index += 1) engine.step(80);
  const snapshot = engine.snapshot();
  assert.equal(snapshot.snapshotVersion, 10);
  assert.equal(snapshot.sensors.sensorVersion, 2);
  assert.equal(engine.diagnostics().sensorVersion, 2);
  const restored = new SimulationEngine({ mission: mission1942, submarine, initialSnapshot: snapshot }).snapshot();
  assert.deepEqual(restored.sensors.contacts.target, snapshot.sensors.contacts.target);
  engine.dispose();
});

test('active sonar ping increases engine detection score and visual contact enables lock', () => {
  const engine = new SimulationEngine({ mission: mission1942, submarine });
  const before = engine.snapshot().detectionScore;
  assert.equal(engine.activeSonarPing().ok, true);
  assert.ok(engine.snapshot().detectionScore > before);
  engine.moveView(340, 18);
  assert.equal(engine.openPeriscope().ok, true);
  assert.equal(engine.targetLock(), true);
  engine.dispose();
});
