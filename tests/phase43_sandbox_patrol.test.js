import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE43_SANDBOX_PATROL, SANDBOX_SCENARIOS, buildSandboxMission, renderSandboxPatrolPanel } from '../js/systems/sandboxPatrolPlanner.js';

const ROOT = path.normalize(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 43 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, '2.2.0');
  assert.equal(BUILD_INFO.semver, '2.2.0');
  assert.equal(BUILD_INFO.phase, '56');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.2.0');
  assert.equal(manifest.version, '2.2.0');
  assert.equal(PHASE43_SANDBOX_PATROL.system, 'sandbox-patrol-planner');
  assert.ok(PHASE43_SANDBOX_PATROL.modes.includes('sandbox-patrol'));
});

test('sandbox scenarios generate full campaign-safe missions', () => {
  assert.ok(SANDBOX_SCENARIOS.length >= 3);
  const mission = buildSandboxMission({ scenarioId: 'north-atlantic-convoy', nationId: 'de', campaigns: [{ id: 'campaign.de.wolfpack', nationId: 'de', baseKey: 'campaign.de.base' }] });
  assert.equal(mission.id, 'sandbox-de-north-atlantic-convoy');
  assert.equal(mission.sandbox, true);
  assert.equal(mission.missionMode, 'sandbox');
  assert.equal(mission.status, 'available');
  assert.ok(mission.navigation.route.length >= 3);
  assert.ok(mission.navigation.patrolSector.id.includes('sandbox'));
  assert.ok(mission.environment.visibilityMeters > 0);
});

test('training shakedown generates a dedicated guided mission', () => {
  const mission = buildSandboxMission({ scenarioId: 'training-shakedown', nationId: 'uk', campaigns: [{ id: 'campaign.uk.mediterranean', nationId: 'uk', baseKey: 'campaign.uk.base' }] });
  assert.equal(mission.id, 'tutorial-uk');
  assert.equal(mission.tutorialMission, true);
  assert.equal(mission.missionMode, 'tutorial');
  assert.deepEqual(mission.objectiveKeys, [
    'tutorialMission.objective.contact',
    'tutorialMission.objective.sonar',
    'tutorialMission.objective.attack',
    'tutorialMission.objective.evade',
  ]);
});

test('sandbox panel exposes campaign quick mission and free patrol choices', () => {
  const fakeT = (key) => key;
  const html = renderSandboxPatrolPanel(fakeT, { isCurrentNation: true });
  assert.match(html, /phase43-sandbox-panel/);
  assert.match(html, /data-action="launch-sandbox"/);
  assert.match(html, /north-atlantic-convoy/);
  assert.match(html, /sandbox.mode.campaign/);
  assert.match(html, /sandbox.mode.free/);
});

test('phase 43 is wired into campaign app index service worker and smoke harness', () => {
  const app = readText('js/app.js');
  const campaign = readText('js/screens/campaign.js');
  const index = readText('index.html');
  const sw = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(app, /launch-sandbox/);
  assert.match(app, /buildSandboxMission/);
  assert.match(campaign, /renderSandboxPatrolPanel/);
  assert.match(index, /phase43-sandbox-patrol\.css/);
  assert.match(sw, /sandboxPatrolPlanner\.js/);
  assert.match(smoke, /sandboxPatrolPlanner\.js/);
});

test('translations include sandbox keys in all supported languages', () => {
  for (const lang of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of ['sandbox.title', 'sandbox.launch', 'sandbox.objective.patrol', 'toast.sandboxReady']) {
      assert.ok(key in dictionary, `${lang} missing ${key}`);
    }
  }
});
