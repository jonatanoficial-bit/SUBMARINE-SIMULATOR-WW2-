import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE28_AIR_ATTACK_EVASION, buildAirAttackView, readAirThreat, recommendAirEvasionAction, shouldAirThreatInterrupt } from '../js/systems/airAttackEvasion.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

test('phase 28 air attack metadata is active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.61');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.61');
  assert.equal(BUILD_INFO.phase, '46');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.61');
  assert.equal(manifest.version, '2.0.0-alpha.61');
  assert.equal(PHASE28_AIR_ATTACK_EVASION.system, 'air-attack-evasion');
  assert.deepEqual(PHASE28_AIR_ATTACK_EVASION.decisions, ['dive', 'silent', 'hold']);
});

test('air attack view classifies standby patrol tracking and attack', () => {
  const standby = buildAirAttackView({ snapshot: { navalAI: { aircraft: { available: true, active: false, state: 'standby' } } } });
  const patrol = buildAirAttackView({ snapshot: { navalAI: { aircraft: { available: true, active: true, state: 'patrol', detectionConfidence: 22 } }, physics: { depth: 14, actualSpeedKnots: 3 } } });
  const tracking = buildAirAttackView({ snapshot: { detectionScore: 34, periscopeOpen: false, navalAI: { aircraft: { available: true, active: true, state: 'tracking', detectionConfidence: 48 } }, physics: { depth: 30, actualSpeedKnots: 4, noise: 30 } } });
  const attack = buildAirAttackView({ snapshot: { detectionScore: 74, navalAI: { aircraft: { available: true, active: true, state: 'attack', detectionConfidence: 80 }, depthChargePatterns: [{ sourceType: 'aircraft', remainingMs: 5000 }] }, physics: { depth: 28, actualSpeedKnots: 6, noise: 42 } } });
  assert.equal(standby.level, 'standby');
  assert.equal(patrol.level, 'patrol');
  assert.equal(tracking.level, 'tracking');
  assert.equal(attack.level, 'attack');
  assert.equal(attack.secondsToPattern, 5);
  assert.ok(attack.danger > tracking.danger);
});

test('air evasion recommendation prefers dive under attack and silent under tracking', () => {
  assert.equal(recommendAirEvasionAction({ available: true, level: 'attack', danger: 88 }).id, 'dive');
  assert.equal(recommendAirEvasionAction({ available: true, level: 'tracking', danger: 55 }).id, 'silent');
  assert.equal(recommendAirEvasionAction({ available: true, level: 'patrol', danger: 26 }).id, 'hold');
  assert.equal(recommendAirEvasionAction({ available: false }).id, 'none');
});

test('air threat exposes marker style and interruption behavior', () => {
  const previous = buildAirAttackView({ snapshot: { navalAI: { aircraft: { available: true, active: true, state: 'patrol', detectionConfidence: 20 } } } });
  const next = buildAirAttackView({ snapshot: { navalAI: { aircraft: { available: true, active: true, state: 'attack', detectionConfidence: 84, x: 120, y: -90 } } } });
  assert.match(next.markerStyle, /left:/);
  assert.equal(shouldAirThreatInterrupt({ previous, next }), true);
  assert.ok(Number(next.cssVars['--phase28-air-danger']) > 0.5);
});

test('phase 28 files, cache, gameplay hooks and translations are present', () => {
  for (const relative of ['js/systems/airAttackEvasion.js', 'css/phase28-air-attack-evasion.css', 'tests/phase28_air_attack_evasion.test.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, relative)), `${relative} missing`);
  }
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const gameplay = fs.readFileSync(path.join(ROOT, 'js/screens/gameplay.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  const smoke = fs.readFileSync(path.join(ROOT, 'tests/smoke_test.py'), 'utf8');
  assert.match(index, /phase28-air-attack-evasion\.css/);
  assert.match(gameplay, /phase28-air-attack-panel/);
  assert.match(gameplay, /updateAirAttackEvasion/);
  assert.match(gameplay, /air-evasion-dive/);
  assert.match(sw, /airAttackEvasion\.js/);
  assert.match(sw, /phase28-air-attack-evasion\.css/);
  assert.match(smoke, /airAttackEvasion\.js/);
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of ['airAttack.kicker', 'airAttack.title.attack', 'airAttack.action.dive', 'airAttack.recommend.silent', 'subofficer.msg.aircraftAttack']) {
      assert.ok(dictionary[key], `${lang}:${key} missing`);
    }
  }
});
