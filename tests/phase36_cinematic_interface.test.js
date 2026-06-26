import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE36_CINEMATIC_INTERFACE, buildCinematicInterfaceView, shouldCinematicTransition } from '../js/systems/cinematicInterface.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 36 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.60');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.60');
  assert.equal(BUILD_INFO.phase, '45');
  assert.equal(BUILD_INFO.saveSchemaVersion, 39);
  assert.equal(pkg.version, '2.0.0-alpha.60');
  assert.equal(manifest.version, '2.0.0-alpha.60');
  assert.equal(PHASE36_CINEMATIC_INTERFACE.system, 'premium-cinematic-interface');
  assert.ok(PHASE36_CINEMATIC_INTERFACE.layers.includes('letterbox'));
});

test('cinematic interface escalates from calm to emergency and action', () => {
  const calm = buildCinematicInterfaceView({ snapshot: { hull: 100, detectionScore: 0, physics: { pressurePercent: 12 }, navalAI: { threatLevel: 'clear' } } });
  assert.equal(calm.phase, '36');
  assert.equal(calm.mood, 'calm');
  assert.equal(calm.transition, 'slow-drift');

  const action = buildCinematicInterfaceView({ snapshot: { hull: 84, detectionScore: 76, torpedoActive: true, navalAI: { threatLevel: 'critical', aircraft: { active: true, state: 'attack' } }, physics: { pressurePercent: 55 } } });
  assert.equal(action.mood, 'action');
  assert.equal(action.transition, 'hard-cut');
  assert.ok(action.score >= 70);
  assert.equal(action.shouldPulse, true);

  const emergency = buildCinematicInterfaceView({ snapshot: { hull: 22, detectionScore: 88, navalAI: { threatLevel: 'critical', depthChargePatterns: [{ remainingMs: 2000 }] }, physics: { pressurePercent: 91 } } });
  assert.equal(emergency.mood, 'emergency');
  assert.ok(Number.parseFloat(emergency.cssVars['--phase36-red']) > 0.4);
});

test('cinematic transition detects mood changes and major score jumps', () => {
  const previous = buildCinematicInterfaceView({ snapshot: { hull: 100, detectionScore: 0 } });
  const next = buildCinematicInterfaceView({ snapshot: { hull: 72, detectionScore: 68, navalAI: { threatLevel: 'warning' } } });
  assert.equal(shouldCinematicTransition({ previous, next }), true);
  assert.equal(shouldCinematicTransition({ previous: next, next }), false);
});

test('phase 36 assets are wired into gameplay index service worker and smoke harness', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/phase36-cinematic-interface.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase36-cinematic-interface-ready/);
  assert.match(gameplay, /buildCinematicInterfaceView/);
  assert.match(gameplay, /phase36-premium-director/);
  assert.match(css, /phase36-cinematic-layer/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(index, /phase36-cinematic-interface\.css/);
  assert.match(serviceWorker, /cinematicInterface\.js/);
  assert.match(smoke, /phase36-cinematic-interface\.css/);
  assert.match(smoke, /cinematicInterface\.js/);
});

test('translations include cinematic keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['cinematic.kicker', 'cinematic.sceneAttackRun', 'cinematic.cueEmergency', 'cinematic.mode.action']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
