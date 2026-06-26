import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { buildSubOfficerDialogue, classifySubOfficerSituation } from '../js/systems/subOfficerCopilot.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 41 metadata and schema are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.60');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.60');
  assert.equal(BUILD_INFO.phase, '45');
  assert.equal(BUILD_INFO.saveSchemaVersion, 39);
  assert.equal(pkg.version, '2.0.0-alpha.60');
  assert.equal(manifest.version, '2.0.0-alpha.60');
});

test('subofficer opens with captain-ready guidance and actionable buttons', () => {
  const dialogue = buildSubOfficerDialogue({ snapshot: {
    elapsedMs: 1000,
    worldTime: 1000,
    hull: 100,
    depth: 12,
    detectionScore: 0,
    navigation: { route: [] },
    physics: { actualSpeedKnots: 0, pressurePercent: 4 },
    sensors: { contacts: {} },
    navalAI: { aircraft: {} },
    weapons: { tdc: {} },
    damage: {},
  }, station: 'command' });
  assert.equal(dialogue.id, 'crew-ready-awaiting-orders');
  assert.equal(dialogue.textKey, 'subofficer.msg.crewReadyCaptain');
  assert.equal(dialogue.shouldAutoOpen, true);
  assert.ok(dialogue.actions.some((item) => item.command === 'open-periscope'));
  assert.ok(dialogue.actions.some((item) => item.station === 'navigation'));
});

test('subofficer guides lost player to map when no route is plotted', () => {
  const situation = classifySubOfficerSituation({ snapshot: {
    elapsedMs: 25000,
    worldTime: 25000,
    hull: 100,
    depth: 15,
    detectionScore: 0,
    navigation: { route: [], patrolEntered: false },
    physics: { actualSpeedKnots: 0, pressurePercent: 6 },
    sensors: { contacts: {} },
    navalAI: { aircraft: {} },
    weapons: { tdc: {} },
    damage: {},
  }, station: 'command' });
  assert.equal(situation.id, 'route-needed');
  assert.equal(situation.stationHint, 'navigation');
  assert.ok(situation.actions.some((item) => item.labelKey === 'subofficer.action.map'));
});

test('phase 41 simplified flow, subofficer popup and mobile periscope cleanup are wired', () => {
  const ui = readText('js/components/ui.js');
  const lobby = readText('js/screens/lobby.js');
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/phase41-flow-subofficer-periscope.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(ui, /nav\.mission/);
  assert.doesNotMatch(ui, /nav\.strategy/);
  assert.match(lobby, /phase41-flow-hub/);
  assert.match(gameplay, /phase41-subofficer-guide-ready/);
  assert.match(gameplay, /subofficer-toggle/);
  assert.match(gameplay, /runSubOfficerAction/);
  assert.match(css, /phase41-subofficer-toggle/);
  assert.match(css, /phase31-horizon-report,[\s\S]*display: none !important/);
  assert.match(css, /periscope-data-ribbon,[\s\S]*display: none !important/);
  assert.match(index, /phase41-flow-subofficer-periscope\.css/);
  assert.match(serviceWorker, /phase41-flow-subofficer-periscope\.css/);
  assert.match(smoke, /phase41-flow-subofficer-periscope\.css/);
});

test('translations include phase 41 flow and subofficer action keys', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['nav.mission', 'nav.submarine', 'nav.baseWorkshop', 'subofficer.msg.crewReadyCaptain', 'subofficer.action.map', 'subofficer.action.periscope']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
