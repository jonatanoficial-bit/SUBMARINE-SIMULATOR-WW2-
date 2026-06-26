import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE35_DEPTH_STEALTH, buildDepthStealthView, shouldDepthStealthEscalate } from '../js/systems/depthStealthRealism.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

function snapshot(overrides = {}) {
  return {
    depth: 32,
    speed: 'slow',
    detectionScore: 0,
    silentTicks: 0,
    physics: {
      depth: 32,
      maxOperationalDepth: 190,
      crushDepth: 270,
      actualSpeedKnots: 3,
      noise: 14,
      cavitation: 0,
      pressurePercent: 18,
    },
    environment: { seaState: 32, hour: 12, thermalLayerDepth: 64 },
    sensors: { contacts: { escort: { confidence: 0 } } },
    navalAI: { contactConfidence: 0 },
    ...overrides,
  };
}

test('phase 35 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.59');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.59');
  assert.equal(BUILD_INFO.phase, '44');
  assert.equal(BUILD_INFO.saveSchemaVersion, 38);
  assert.equal(pkg.version, '2.0.0-alpha.59');
  assert.equal(manifest.version, '2.0.0-alpha.59');
  assert.equal(PHASE35_DEPTH_STEALTH.system, 'depth-stealth-realism');
  assert.ok(PHASE35_DEPTH_STEALTH.layers.includes('thermal-layer'));
});

test('depth stealth rewards going below the thermal layer', () => {
  const shallow = buildDepthStealthView({ snapshot: snapshot({ physics: { ...snapshot().physics, depth: 26, noise: 30 }, depth: 26 }) });
  const deep = buildDepthStealthView({ snapshot: snapshot({ physics: { ...snapshot().physics, depth: 92, noise: 16, pressurePercent: 48 }, depth: 92, silentTicks: 60 }) });
  assert.equal(shallow.layerState, 'above');
  assert.equal(deep.layerState, 'below');
  assert.ok(deep.bars.layerShield > shallow.bars.layerShield);
  assert.ok(deep.bars.stealth > shallow.bars.stealth);
});

test('cavitation and pressure produce danger or critical advice', () => {
  const cavitating = buildDepthStealthView({ snapshot: snapshot({ detectionScore: 65, physics: { ...snapshot().physics, depth: 16, actualSpeedKnots: 13, noise: 86, cavitation: 82, pressurePercent: 18 } }) });
  assert.equal(cavitating.cavitationState, 'critical');
  assert.ok(['danger', 'critical'].includes(cavitating.band));
  assert.equal(cavitating.adviceKey, 'depthStealth.adviceCavitation');

  const overdepth = buildDepthStealthView({ snapshot: snapshot({ physics: { ...snapshot().physics, depth: 212, noise: 24, cavitation: 0, pressurePercent: 112, maxOperationalDepth: 190, crushDepth: 270 } }) });
  assert.equal(overdepth.pressureState, 'overdepth');
  assert.match(overdepth.recommendedLabel, /m/);
});

test('depth stealth escalation triggers on acoustic risk jump', () => {
  const previous = buildDepthStealthView({ snapshot: snapshot() });
  const next = buildDepthStealthView({ snapshot: snapshot({ detectionScore: 80, physics: { ...snapshot().physics, depth: 10, actualSpeedKnots: 14, noise: 90, cavitation: 88, pressurePercent: 12 } }) });
  assert.equal(shouldDepthStealthEscalate({ previous, next }), true);
});

test('phase 35 assets are wired into gameplay index service worker and smoke harness', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/phase35-depth-stealth-realism.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase35-depth-stealth-ready/);
  assert.match(gameplay, /buildDepthStealthView/);
  assert.match(gameplay, /phase35-depth-stealth/);
  assert.match(css, /phase35-depth-map/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(index, /phase35-depth-stealth-realism\.css/);
  assert.match(serviceWorker, /depthStealthRealism\.js/);
  assert.match(smoke, /phase35-depth-stealth-realism\.css/);
  assert.match(smoke, /depthStealthRealism\.js/);
});

test('translations include depth stealth keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['depthStealth.kicker', 'depthStealth.level.critical', 'depthStealth.adviceBelowLayer']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
