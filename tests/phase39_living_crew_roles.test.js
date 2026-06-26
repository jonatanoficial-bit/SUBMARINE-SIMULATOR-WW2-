import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE39_LIVING_CREW_ROLES, buildLivingCrewRolesView, shouldCrewRoleInterrupt } from '../js/systems/livingCrewRoles.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 39 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.64');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.64');
  assert.equal(BUILD_INFO.phase, '49');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.64');
  assert.equal(manifest.version, '2.0.0-alpha.64');
  assert.equal(PHASE39_LIVING_CREW_ROLES.system, 'living-crew-roles');
  assert.ok(PHASE39_LIVING_CREW_ROLES.roles.includes('engineer'));
});

test('living crew roles classify calm patrol as steady or confident', () => {
  const view = buildLivingCrewRolesView({ snapshot: {
    hull: 96,
    systems: { engines: 96, sonar: 94, periscope: 98, weapons: 92 },
    physics: { pressurePercent: 8, noise: 12, fuel: 80 },
    damageControl: { totalFlooding: 0, totalFire: 0, morale: 85 },
    navalAI: { threatLevel: 'clear', contactConfidence: 0, aircraft: { active: false } },
    weapons: { canFire: false, minimumSolutionQuality: 42, tdc: { solutionQuality: 15 }, reserveTorpedoes: 12 },
    navigation: { route: [{ id: 'wp-1' }], patrolEntered: true },
  } });
  assert.equal(view.phase, '39');
  assert.ok(['steady', 'confident'].includes(view.commandState));
  assert.ok(view.overallReadiness >= 65);
  assert.equal(view.roles.length, 6);
  assert.ok(view.roles.every((role) => role.directiveKey.startsWith('crewRoles.directive.')));
});

test('living crew roles identify engineering as critical under flooding and pressure', () => {
  const view = buildLivingCrewRolesView({ snapshot: {
    hull: 38,
    systems: { engines: 34, sonar: 70, periscope: 80, weapons: 74 },
    physics: { pressurePercent: 86, noise: 30, fuel: 55 },
    damageControl: { totalFlooding: 54, totalFire: 8, morale: 40 },
    navalAI: { threatLevel: 'warning', contactConfidence: 32, aircraft: { active: false } },
    weapons: { canFire: false, minimumSolutionQuality: 42, tdc: { solutionQuality: 24 }, reserveTorpedoes: 8 },
    navigation: { route: [] },
  } });
  assert.equal(view.dominantRole.id, 'engineer');
  assert.equal(view.dominantRole.state, 'critical');
  assert.equal(view.summaryKey, 'crewRoles.directive.engineerPressure');
  assert.equal(view.commandState, 'critical');
});

test('living crew roles escalate when combat pressure rises', () => {
  const calm = buildLivingCrewRolesView({ snapshot: {
    hull: 98,
    systems: { engines: 95, sonar: 95, weapons: 95 },
    physics: { pressurePercent: 5, noise: 10 },
    damageControl: { totalFlooding: 0, totalFire: 0, morale: 88 },
    navalAI: { threatLevel: 'clear', contactConfidence: 0, aircraft: { active: false } },
    weapons: { canFire: false, tdc: { solutionQuality: 10 }, reserveTorpedoes: 10 },
    navigation: { route: [] },
  } });
  const danger = buildLivingCrewRolesView({ snapshot: {
    hull: 82,
    playerDetected: true,
    detectionScore: 84,
    torpedoActive: true,
    systems: { engines: 75, sonar: 72, weapons: 78 },
    physics: { pressurePercent: 44, noise: 62 },
    damageControl: { totalFlooding: 4, totalFire: 0, morale: 64 },
    navalAI: { threatLevel: 'critical', contactConfidence: 88, aircraft: { active: true, state: 'attack' } },
    weapons: { canFire: true, tdc: { solutionQuality: 78 }, reserveTorpedoes: 3 },
    navigation: { route: [{ id: 'wp' }] },
  } });
  assert.equal(shouldCrewRoleInterrupt({ previous: calm, next: danger }), true);
  assert.ok(['commander', 'sonar', 'weapons'].includes(danger.dominantRole.id));
});

test('phase 39 assets are wired into gameplay index service worker and smoke harness', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/phase39-crew-roles.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase39-crew-roles-ready/);
  assert.match(gameplay, /buildLivingCrewRolesView/);
  assert.match(gameplay, /phase39-crew-roles-panel/);
  assert.match(css, /phase39-crew-card/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(index, /phase39-crew-roles\.css/);
  assert.match(serviceWorker, /livingCrewRoles\.js/);
  assert.match(smoke, /phase39-crew-roles\.css/);
  assert.match(smoke, /livingCrewRoles\.js/);
});

test('translations include living crew role keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['crewRoles.kicker', 'crewRoles.role.engineer', 'crewRoles.directive.commanderPatrol', 'crewRoles.focus.route']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
