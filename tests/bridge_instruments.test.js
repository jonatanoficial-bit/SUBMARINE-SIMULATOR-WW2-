import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeTelemetry } from '../js/screens/bridge.js';

const baseContext = {
  save: {
    submarine: { hull: 88 },
    logistics: { readiness: 76, fatigue: 20, morale: 78 }
  },
  submarine: { stats: { speed: 68, range: 70, stealth: 72, depth: 74, torpedoes: 8 } },
  readiness: { overall: 76 },
  strategicAssessment: { risk: 44 },
  mission: { difficulty: 'III' }
};

test('bridge telemetry exposes real simulator instruments within safe numeric bounds', () => {
  const snapshot = createBridgeTelemetry({ ...baseContext, mode: 'cruise', tick: 4 });
  assert.ok(snapshot.depth >= 0);
  assert.ok(snapshot.speed >= 0 && snapshot.speed <= 22);
  assert.ok(snapshot.pressure >= 0 && snapshot.pressure <= 120);
  assert.ok(snapshot.oxygen >= 0 && snapshot.oxygen <= 100);
  assert.ok(snapshot.battery >= 0 && snapshot.battery <= 100);
  assert.ok(snapshot.noise >= 0 && snapshot.noise <= 100);
  assert.ok(snapshot.detection >= 0 && snapshot.detection <= 100);
  assert.ok(snapshot.safeDepth > 100);
  assert.ok(snapshot.crushDepth > snapshot.safeDepth);
});

test('silent running reduces noise and detection compared with emergency dive', () => {
  const silent = createBridgeTelemetry({ ...baseContext, mode: 'silent', tick: 8 });
  const emergency = createBridgeTelemetry({ ...baseContext, mode: 'emergency', tick: 8 });
  assert.ok(silent.noise < emergency.noise);
  assert.ok(silent.detection < emergency.detection);
  assert.ok(emergency.pressure > silent.pressure);
});

test('weak hull increases pressure status risk', () => {
  const strong = createBridgeTelemetry({ ...baseContext, save: { submarine: { hull: 100 }, logistics: { readiness: 80 } }, mode: 'deep', tick: 3 });
  const damaged = createBridgeTelemetry({ ...baseContext, save: { submarine: { hull: 35 }, logistics: { readiness: 80 } }, mode: 'deep', tick: 3 });
  assert.ok(damaged.pressure > strong.pressure);
  assert.match(damaged.statusKey, /^bridge\.status\./);
});
