import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE37_IMMERSIVE_AUDIO, buildImmersiveAudioDirectorView, shouldAudioCueTrigger } from '../js/systems/immersiveAudioDirector.js';

const ROOT = path.normalize(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 37 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, '2.1.0');
  assert.equal(BUILD_INFO.semver, '2.1.0');
  assert.equal(BUILD_INFO.phase, '55');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.1.0');
  assert.equal(manifest.version, '2.1.0');
  assert.equal(PHASE37_IMMERSIVE_AUDIO.system, 'immersive-audio-director');
  assert.ok(PHASE37_IMMERSIVE_AUDIO.layers.includes('crew-callouts'));
});

test('audio director classifies silent, deep, combat and emergency states', () => {
  const silent = buildImmersiveAudioDirectorView({ snapshot: { hull: 100, physics: { depth: 40, noise: 8, pressurePercent: 10 }, detectionScore: 0 } });
  assert.equal(silent.state, 'silent');
  assert.equal(silent.cue, 'subtleSonar');

  const deep = buildImmersiveAudioDirectorView({ snapshot: { hull: 94, physics: { depth: 155, noise: 16, pressurePercent: 58 }, detectionScore: 5 } });
  assert.equal(deep.state, 'deep');
  assert.equal(deep.cue, 'hullCreak');

  const combat = buildImmersiveAudioDirectorView({ snapshot: { hull: 90, torpedoActive: true, physics: { depth: 45, noise: 28, pressurePercent: 25 }, detectionScore: 70, navalAI: { globalState: 'hunt' } } });
  assert.equal(combat.state, 'combat');
  assert.equal(combat.cue, 'torpedoRun');

  const emergency = buildImmersiveAudioDirectorView({ snapshot: { hull: 32, physics: { depth: 190, noise: 45, pressurePercent: 88 }, damage: { criticalCount: 1 }, detectionScore: 40 } });
  assert.equal(emergency.state, 'emergency');
  assert.equal(emergency.cue, 'klaxon');
  assert.equal(emergency.shouldPulse, true);
});

test('audio cues trigger only on meaningful transitions', () => {
  const previous = buildImmersiveAudioDirectorView({ snapshot: { hull: 100, physics: { depth: 30, noise: 6, pressurePercent: 10 }, detectionScore: 0 } });
  const next = buildImmersiveAudioDirectorView({ snapshot: { hull: 80, physics: { depth: 40, noise: 30, pressurePercent: 25 }, detectionScore: 72, navalAI: { globalState: 'hunt' } } });
  assert.equal(shouldAudioCueTrigger({ previous, next }), true);
  assert.equal(shouldAudioCueTrigger({ previous: next, next }), false);
});

test('phase 37 assets are wired into gameplay audio index service worker and smoke harness', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const audio = readText('js/audio.js');
  const css = readText('css/phase37-immersive-audio.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase37-immersive-audio-ready/);
  assert.match(gameplay, /buildImmersiveAudioDirectorView/);
  assert.match(gameplay, /phase37-audio-director/);
  assert.match(audio, /case 'klaxon'/);
  assert.match(audio, /case 'hullCreak'/);
  assert.match(css, /phase37-audio-director/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(index, /phase37-immersive-audio\.css/);
  assert.match(serviceWorker, /immersiveAudioDirector\.js/);
  assert.match(smoke, /phase37-immersive-audio\.css/);
});

test('translations include immersive audio keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['immersiveAudio.kicker', 'immersiveAudio.state.combat', 'immersiveAudio.crew.aswHunt', 'immersiveAudio.mixEmergency']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
