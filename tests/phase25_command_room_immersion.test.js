import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { buildCommandRoomStations, classifyCommandRoomViewport, commandRoomCssVars, computeCommandRoomAmbience, PHASE25_COMMAND_ROOM } from '../js/systems/commandRoomImmersion.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const pkg = readJson('package.json');
const manifest = readJson('manifest.json');
const dictionaries = ['pt-BR','en','es'].map((lang) => readJson(`data/translations/${lang}.json`));

test('phase 25 immersive command room metadata is active', () => {
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.49');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.49');
  assert.equal(BUILD_INFO.phase, '34');
  assert.equal(BUILD_INFO.saveSchemaVersion, 28);
  assert.equal(pkg.version, '2.0.0-alpha.49');
  assert.equal(manifest.version, '2.0.0-alpha.49');
  assert.equal(PHASE25_COMMAND_ROOM.visualProfile, 'immersive-submarine-command-room');
});

test('command room ambience escalates from quiet watch to emergency', () => {
  const quiet = computeCommandRoomAmbience({
    telemetry: { pressure: 18, detection: 8, oxygen: 96, battery: 91, hull: 100, speed: 3 },
    readiness: { overall: 88 },
    strategicAssessment: { risk: 12 },
    mission: { difficulty: 'I' }
  });
  const emergency = computeCommandRoomAmbience({
    telemetry: { pressure: 104, detection: 92, oxygen: 28, battery: 20, hull: 42, speed: 14 },
    readiness: { overall: 36 },
    strategicAssessment: { risk: 88 },
    mission: { difficulty: 'V' }
  });
  assert.equal(quiet.alertLevel, 'quiet');
  assert.equal(emergency.alertLevel, 'emergency');
  assert.ok(emergency.threatScore > quiet.threatScore);
  assert.ok(emergency.redLampOpacity > quiet.redLampOpacity);
  assert.ok(emergency.condensationOpacity > quiet.condensationOpacity);
});

test('station cards expose severity and operational values', () => {
  const stations = buildCommandRoomStations({
    telemetry: { detection: 78, pressure: 40, depth: 14, depthZone: 'periscope', battery: 68, oxygen: 80, hull: 90 },
    readiness: { overall: 72 },
    strategicAssessment: { risk: 66 }
  });
  assert.equal(stations.length, 5);
  assert.deepEqual(stations.map((item) => item.id), ['helm', 'sonar', 'periscope', 'torpedo', 'engineering']);
  assert.equal(stations.find((item) => item.id === 'sonar').severity, 'critical');
  assert.equal(stations.find((item) => item.id === 'periscope').statusKey, 'phase25.station.periscope.available');
  for (const station of stations) {
    assert.ok(station.value >= 0 && station.value <= 100);
    assert.ok(station.icon.endsWith('.png'));
  }
});

test('viewport classification protects mobile command room readability', () => {
  const phone = classifyCommandRoomViewport({ width: 390, height: 780 });
  const small = classifyCommandRoomViewport({ width: 350, height: 430 });
  const desktop = classifyCommandRoomViewport({ width: 1366, height: 768 });
  assert.equal(phone.mode, 'mobile-cabin');
  assert.equal(phone.instrumentColumns, 2);
  assert.equal(small.hideDecor, true);
  assert.equal(desktop.mode, 'full-command-room');
  assert.equal(desktop.instrumentColumns, 5);
});

test('CSS vars are clamped and usable by the cabin styling', () => {
  const vars = commandRoomCssVars({ redLampOpacity: 2, condensationOpacity: -1, vibration: 0.5, tickPhase: 0.75 });
  assert.equal(vars['--phase25-red-opacity'], '1');
  assert.equal(vars['--phase25-condensation-opacity'], '0');
  assert.equal(vars['--phase25-vibration'], '0.5');
  assert.equal(vars['--phase25-lamp-phase'], '0.75');
});

test('phase 25 files, cache entries, screen hooks and translations are present', () => {
  for (const relative of ['js/systems/commandRoomImmersion.js', 'css/phase25-silent-depth-command-room.css', 'tests/phase25_command_room_immersion.test.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, relative)), `${relative} missing`);
  }
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const bridge = fs.readFileSync(path.join(ROOT, 'js/screens/bridge.js'), 'utf8');
  const gameplay = fs.readFileSync(path.join(ROOT, 'js/screens/gameplay.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  assert.match(index, /phase25-silent-depth-command-room\.css/);
  assert.match(bridge, /commandRoomImmersion\.js/);
  assert.match(bridge, /phase25-command-room/);
  assert.match(bridge, /phase25-crew-watch/);
  assert.match(gameplay, /phase25-command-room-shell/);
  assert.match(sw, /commandRoomImmersion\.js/);
  assert.match(sw, /phase25-silent-depth-command-room\.css/);
  for (const dictionary of dictionaries) {
    for (const key of ['phase25.title', 'phase25.summary', 'phase25.prompt.action-stations', 'phase25.station.sonar.contact']) {
      assert.ok(dictionary[key], `${key} missing`);
    }
  }
});
