import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { buildAlertAtmosphereView, calculateAlertThreatScore, classifyAlertAtmosphere, PHASE27_ALERT_ATMOSPHERE, shouldAlertEscalate } from '../js/systems/alertAtmosphere.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

test('phase 27 alert metadata is active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.42');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.42');
  assert.equal(BUILD_INFO.phase, '27');
  assert.equal(BUILD_INFO.saveSchemaVersion, 21);
  assert.equal(pkg.version, '2.0.0-alpha.42');
  assert.equal(manifest.version, '2.0.0-alpha.42');
  assert.equal(PHASE27_ALERT_ATMOSPHERE.system, 'alert-atmosphere');
  assert.deepEqual(PHASE27_ALERT_ATMOSPHERE.levels, ['calm', 'suspicion', 'combat', 'evasion', 'emergency']);
});

test('alert atmosphere classifies calm, suspicion, evasion, combat and emergency', () => {
  const calm = classifyAlertAtmosphere({ snapshot: { physics: { actualSpeedKnots: 1, depth: 30, pressurePercent: 8 }, hull: 100 } });
  const suspicion = classifyAlertAtmosphere({ snapshot: { detectionScore: 38, physics: { actualSpeedKnots: 4, depth: 30, pressurePercent: 20 }, hull: 98 } });
  const evasion = classifyAlertAtmosphere({ snapshot: { silentTicks: 2000, escortState: 'alert', detectionScore: 48, physics: { depth: 90, pressurePercent: 45 }, hull: 90 } });
  const combat = classifyAlertAtmosphere({ snapshot: { escortState: 'hunt', detectionScore: 72, physics: { depth: 60, pressurePercent: 42 }, hull: 82, weapons: { torpedoActive: true } } });
  const emergency = classifyAlertAtmosphere({ snapshot: { hull: 28, physics: { depth: 230, pressurePercent: 96 }, navalAI: { aircraft: { active: true } } } });
  assert.equal(calm.level, 'calm');
  assert.equal(suspicion.level, 'suspicion');
  assert.equal(evasion.level, 'evasion');
  assert.equal(combat.level, 'combat');
  assert.equal(emergency.level, 'emergency');
  assert.ok(emergency.priority > combat.priority);
  assert.ok(combat.shouldPulse);
});

test('alert view exposes css variables, lamp markup and escalation behavior', () => {
  const view = buildAlertAtmosphereView({ snapshot: { escortState: 'hunt', detectionScore: 86, physics: { actualSpeedKnots: 9, pressurePercent: 62, depth: 80 }, hull: 74 } });
  assert.equal(view.level, 'combat');
  assert.match(view.lampsMarkup, /data-lamp="red"/);
  assert.ok(Number(view.cssVars['--phase27-dimming']) > 0);
  assert.equal(shouldAlertEscalate({ previous: classifyAlertAtmosphere({ snapshot: { hull: 100 } }), next: view }), true);
});

test('threat score reacts to aircraft, hull and pressure', () => {
  const safe = calculateAlertThreatScore({ snapshot: { hull: 100, physics: { pressurePercent: 4, oxygen: 100, battery: 100 } } });
  const critical = calculateAlertThreatScore({ snapshot: { hull: 20, physics: { pressurePercent: 100, oxygen: 50, battery: 45 }, navalAI: { aircraft: { active: true } } } });
  assert.ok(critical > safe);
  assert.ok(critical >= 80);
});

test('phase 27 files, cache, gameplay hooks and translations are present', () => {
  for (const relative of ['js/systems/alertAtmosphere.js', 'css/phase27-alert-atmosphere.css', 'tests/phase27_alert_atmosphere.test.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, relative)), `${relative} missing`);
  }
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const gameplay = fs.readFileSync(path.join(ROOT, 'js/screens/gameplay.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  const smoke = fs.readFileSync(path.join(ROOT, 'tests/smoke_test.py'), 'utf8');
  assert.match(index, /phase27-alert-atmosphere\.css/);
  assert.match(gameplay, /phase27-alert-atmosphere/);
  assert.match(gameplay, /updateAlertAtmosphere/);
  assert.match(gameplay, /buildAlertAtmosphereView/);
  assert.match(sw, /alertAtmosphere\.js/);
  assert.match(sw, /phase27-alert-atmosphere\.css/);
  assert.match(smoke, /alertAtmosphere\.js/);
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of ['alert.atmosphere.title', 'alert.level.emergency', 'alert.message.combat', 'alert.order.evasion']) {
      assert.ok(dictionary[key], `${lang}:${key} missing`);
    }
  }
});
