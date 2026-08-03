import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE42_BASE_WORKSHOP_INTEGRATION, applyUpgradeStats, buildWorkshopImpactReport, calculateUpgradeBonus } from '../js/systems/baseWorkshopIntegration.js';

const ROOT = path.normalize(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 42 metadata and workshop system are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, '2.1.0');
  assert.equal(BUILD_INFO.phase, '55');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.1.0');
  assert.equal(manifest.version, '2.1.0');
  assert.equal(PHASE42_BASE_WORKSHOP_INTEGRATION.system, 'base-workshop-integration');
});

test('installed upgrades now create mission-facing operational bonuses', () => {
  const upgrades = readJson('data/upgrades.json');
  const bonus = calculateUpgradeBonus(upgrades, ['sonar_array_1', 'battery_silent_1', 'hull_steel_1', 'torpedo_rack_1']);
  assert.ok(bonus.sonarRangePercent >= 9);
  assert.ok(bonus.batteryEndurancePercent >= 8);
  assert.ok(bonus.hullPressureBonus >= 8);
  assert.ok(bonus.weaponReloadPercent >= 6);
  assert.ok(bonus.torpedoes >= 2);
});

test('workshop applies upgrade stats to the submarine used by missions', () => {
  const stats = { speed: 60, range: 70, stealth: 65, depth: 60, torpedoes: 6 };
  const upgraded = applyUpgradeStats(stats, { speed: 7, range: 3, stealth: 5, depth: 6, torpedoes: 2, torpedoReserveBonus: 1 });
  assert.equal(upgraded.speed, 67);
  assert.equal(upgraded.range, 73);
  assert.equal(upgraded.stealth, 70);
  assert.equal(upgraded.depth, 66);
  assert.equal(upgraded.torpedoes, 9);
});

test('workshop report gives readiness, directive and impact cards', () => {
  const upgrades = readJson('data/upgrades.json');
  const report = buildWorkshopImpactReport({
    upgrades,
    ownedIds: ['sonar_array_1', 'battery_silent_1', 'engine_tuned_1'],
    submarine: { stats: { speed: 62, range: 71, stealth: 68, depth: 64, torpedoes: 6 } },
    logistics: { readiness: 82 },
    hull: 96,
    systems: { engines: 94, sonar: 100, periscope: 100, weapons: 95 },
  });
  assert.equal(report.phase, '42');
  assert.ok(report.readiness.score >= 70);
  assert.ok(report.cards.length >= 5);
  assert.ok(report.operationalEffects.enduranceScore > 70);
  assert.match(report.directiveKey, /workshop\.directive/);
});

test('phase 42 files are wired into arsenal, app, index, service worker and smoke', () => {
  const arsenal = readText('js/screens/arsenal.js');
  const app = readText('js/app.js');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(app, /baseWorkshopIntegration/);
  assert.match(app, /getWorkshopImpactReport/);
  assert.match(arsenal, /phase42-workshop-impact/);
  assert.match(arsenal, /restock-logistics/);
  assert.match(index, /phase42-base-workshop\.css/);
  assert.match(serviceWorker, /baseWorkshopIntegration\.js/);
  assert.match(smoke, /phase42-base-workshop\.css/);
});

test('translations include phase 42 workshop keys in all languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['workshop.title', 'workshop.directive.ready', 'workshop.card.sonar', 'workshop.installedImpact']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
