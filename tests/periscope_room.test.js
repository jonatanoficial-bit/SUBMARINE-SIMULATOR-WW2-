import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createPeriscopeOpticsSolution } from '../js/screens/gameplay.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const build = readJson('BUILD_INFO.json');
const translations = ['pt-BR','en','es'].map((lang)=>readJson(`data/translations/${lang}.json`));

test('phase 18 metadata is active', () => {
  assert.equal(build.semver, '2.0.0-alpha.65');
  assert.equal(build.phase, '50');
  assert.equal(build.saveSchemaVersion, 40);
});

test('periscope optics solution rewards correct periscope depth and good visibility', () => {
  const good = createPeriscopeOpticsSolution({
    snapshot: {
      depth: 12,
      detectionScore: 18,
      environment: { visualFactor: 0.92, visibilityMeters: 7200, precipitation: 4, seaState: 48 },
      sensors: {
        profile: { currentVisualRangeMeters: 7200, radarMastMaxDepth: 12 },
        contacts: { target: { confidence: 86, speedEstimateKnots: 8.2 } }
      },
      target: { x: 420, y: -220 }
    },
    periscopeZoom: 2
  });
  assert.equal(good.state, 'safe');
  assert.ok(good.opticalQuality >= 70);
  assert.ok(good.mastWakeRisk < 35);
  assert.ok(good.estimatedRangeMeters > 0);
  assert.ok(good.estimatedSpeedKnots > 0);
});

test('periscope optics flags bad depth and poor visibility as risky', () => {
  const bad = createPeriscopeOpticsSolution({
    snapshot: {
      depth: 42,
      detectionScore: 68,
      environment: { visualFactor: 0.22, visibilityMeters: 1100, precipitation: 72, seaState: 22 },
      sensors: {
        profile: { currentVisualRangeMeters: 1100, radarMastMaxDepth: 12 },
        contacts: { target: { confidence: 18, speedEstimateKnots: 5.8 } }
      },
      target: { x: 700, y: -320 }
    },
    periscopeZoom: 1
  });
  assert.equal(bad.state, 'critical');
  assert.ok(bad.mastWakeRisk >= 68);
  assert.ok(bad.opticalQuality < 35);
  assert.ok(bad.rangeError > 35);
});

test('phase 18 periscope translation keys are present in all languages', () => {
  const keys = [
    'periscope.opticalQuality',
    'periscope.mastWake',
    'periscope.depthEnvelope',
    'periscope.estimatedRange',
    'periscope.estimatedSpeed',
    'periscope.errorWindow',
    'periscope.depthEnvelopeValue'
  ];
  for (const dictionary of translations) {
    const missing = keys.filter((key) => !dictionary[key]);
    assert.deepEqual(missing, []);
  }
});
