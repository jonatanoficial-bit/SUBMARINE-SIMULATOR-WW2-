import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { NavalAISystem } from '../js/engine/ai/NavalAISystem.js';
import { PHASE33_NAVAL_AI_TACTICS, buildNavalAITacticalView } from '../js/systems/navalAITacticalCoordinator.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

function mission(overrides = {}) {
  return {
    id: 'phase33-ai-test',
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
    timeCompression: 4,
    detectionScore: 0,
    torpedoActive: false,
    playerDepth: 65,
    actualSpeedKnots: 3,
    noise: 10,
    decoyActive: false,
    silentRunning: true,
    periscopeOpen: false,
    radarMastRaised: false,
    ...overrides,
  };
}

test('phase 33 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.59');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.59');
  assert.equal(BUILD_INFO.phase, '44');
  assert.equal(BUILD_INFO.saveSchemaVersion, 38);
  assert.equal(pkg.version, '2.0.0-alpha.59');
  assert.equal(manifest.version, '2.0.0-alpha.59');
  assert.equal(PHASE33_NAVAL_AI_TACTICS.system, 'naval-ai-tactical-coordinator');
  assert.ok(PHASE33_NAVAL_AI_TACTICS.layers.includes('escort-pincer'));
});

test('naval AI raises defensive zig-zag and search doctrine when contact increases', () => {
  const ai = new NavalAISystem({ mission: mission() });
  ai.update(80, context({ detectionScore: 35 }));
  let snapshot = ai.snapshot();
  assert.equal(snapshot.tacticalVersion, 1);
  assert.equal(snapshot.tactics.reactionState, 'investigating');
  assert.ok(snapshot.tactics.zigzagIntensity >= 45);
  assert.equal(snapshot.tactics.escortScreen, 'screening');

  ai.update(80, context({ detectionScore: 74, silentRunning: false, playerDepth: 45 }));
  snapshot = ai.snapshot();
  assert.equal(snapshot.globalState, 'hunt');
  assert.equal(snapshot.tactics.escortScreen, 'pincer');
  assert.equal(snapshot.tactics.searchPattern, 'closing-pincer');
  assert.ok(snapshot.tactics.pincerPressure >= 65);
});

test('torpedo launch forces violent convoy evasion and persists through restore', () => {
  const ai = new NavalAISystem({ mission: mission() });
  ai.notifyTorpedoLaunch([{ id: 'shot-1' }]);
  const snapshot = ai.snapshot();
  assert.equal(snapshot.tactics.reactionState, 'torpedo-evasion');
  assert.equal(snapshot.tactics.convoyManeuver, 'violent-zigzag');
  assert.equal(snapshot.metrics.torpedoEvasionTurns, 1);
  const restored = new NavalAISystem({ mission: mission() });
  assert.equal(restored.restore(snapshot), true);
  assert.equal(restored.snapshot().tactics.reactionState, 'torpedo-evasion');
  assert.equal(restored.snapshot().tacticalVersion, 1);
});

test('naval AI tactical view exposes readable escort and pressure data', () => {
  const ai = new NavalAISystem({ mission: mission({ year: '1944' }) });
  ai.notifyTorpedoLaunch([{ id: 'shot-1' }]);
  for (let index = 0; index < 18; index += 1) {
    ai.update(160, context({ detectionScore: 88, silentRunning: false, playerDepth: 35, periscopeOpen: true }));
  }
  const view = buildNavalAITacticalView({ snapshot: { navalAI: ai.snapshot() } });
  assert.equal(view.phase, '33');
  assert.equal(view.system, 'naval-ai-tactical-coordinator');
  assert.ok(['danger', 'critical'].includes(view.threat.band));
  assert.ok(view.bars.pincer >= 60);
  assert.ok(view.escortRows.length >= 1);
  assert.match(view.cssVars['--phase33-threat'], /%$/);
});

test('phase 33 assets are wired into gameplay index service worker and smoke harness', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/phase33-naval-ai-tactics.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase33-naval-ai-ready/);
  assert.match(gameplay, /buildNavalAITacticalView/);
  assert.match(gameplay, /phase33-ai-tactics-panel/);
  assert.match(css, /phase33-escort-row/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(index, /phase33-naval-ai-tactics\.css/);
  assert.match(serviceWorker, /navalAITacticalCoordinator\.js/);
  assert.match(smoke, /phase33-naval-ai-tactics\.css/);
  assert.match(smoke, /navalAITacticalCoordinator\.js/);
});

test('translations include naval AI tactics keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['navalAITactics.kicker', 'navalAITactics.screen.pincer', 'ai.tactics.directivePincer']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
