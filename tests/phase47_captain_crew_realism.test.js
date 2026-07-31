import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE47_CAPTAIN_CREW_REALISM, beginCaptainCrewOrder, buildCaptainCrewFlowDialogue, buildCaptainCrewOrderPanel, createCaptainCrewOrderFlow } from '../js/systems/captainCrewRealism.js';
import { buildSubOfficerDialogue } from '../js/systems/subOfficerCopilot.js';

const ROOT = path.normalize(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

function attackSnapshot(overrides = {}) {
  return {
    worldTime: 42000,
    elapsedMs: 42000,
    depth: 12,
    hull: 100,
    periscopeOpen: true,
    physics: { depth: 12, pressurePercent: 8, actualSpeedKnots: 2.2 },
    sensors: { contacts: { target: { detected: true, confidence: 88, rangeMeters: 1350 } } },
    navalAI: { aircraft: {}, threatLevel: 'warning' },
    weapons: { canFire: true, minimumSolutionQuality: 42, profile: { maxLaunchDepth: 60 }, tdc: { solutionQuality: 84 } },
    damage: {},
    navigation: { route: [{ lat: 1, lon: 1 }], patrolEntered: true },
    ...overrides,
  };
}

test('phase 47 metadata and static wiring are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, '2.0.0');
  assert.equal(BUILD_INFO.phase, '54');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0');
  assert.equal(manifest.version, '2.0.0');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase54_career_retention.py');
  assert.equal(PHASE47_CAPTAIN_CREW_REALISM.system, 'captain-crew-realism');
});

test('attack order becomes prepare -> periscope confirmation -> fire authorization', () => {
  const snapshot = attackSnapshot();
  const idle = createCaptainCrewOrderFlow(snapshot);
  const flow = beginCaptainCrewOrder('prepare-attack', snapshot, idle);
  const panel = buildCaptainCrewOrderPanel({ snapshot, flow });
  assert.equal(flow.stage, 'attackPrepared');
  assert.equal(panel.state, 'awaitingFireOrder');
  assert.equal(panel.steps[1].key, 'captainCrew.step.torpedoPrepared');
  assert.equal(panel.steps[3].key, 'captainCrew.step.fireOrder');
  const dialogue = buildCaptainCrewFlowDialogue({ snapshot, flow });
  assert.equal(dialogue.id, 'captain-confirm-fire');
  assert.equal(dialogue.actions[0].command, 'fire-confirm');
  assert.notEqual(dialogue.actions[0].command, 'fire-torpedo');
  const subofficer = buildSubOfficerDialogue({ snapshot: { ...snapshot, captainCrewFlow: flow }, commandMode: 'captain' });
  assert.equal(subofficer.id, 'captain-confirm-fire');
  assert.equal(subofficer.actions[0].command, 'fire-confirm');
});

test('attack chain blocks unsafe launch depth and asks for periscope-depth order', () => {
  const snapshot = attackSnapshot({ depth: 85, physics: { depth: 85, pressurePercent: 42, actualSpeedKnots: 2.5 }, periscopeOpen: false });
  const flow = beginCaptainCrewOrder('prepare-attack', snapshot);
  const panel = buildCaptainCrewOrderPanel({ snapshot, flow });
  assert.equal(panel.state, 'attackTooDeep');
  const dialogue = buildCaptainCrewFlowDialogue({ snapshot, flow });
  assert.equal(dialogue.id, 'captain-attack-too-deep');
  assert.equal(dialogue.actions[0].command, 'order-periscope-depth');
});

test('repair, evasion and silent orders use crew execution feedback instead of extra chatter', () => {
  const snapshot = attackSnapshot({ worldTime: 8000, weapons: { tdc: {} }, sensors: { contacts: {} } });
  const repair = beginCaptainCrewOrder('authorize-repair', snapshot);
  const evasion = beginCaptainCrewOrder('evade-now', snapshot);
  const silent = beginCaptainCrewOrder('prepare-silent-approach', snapshot);
  assert.equal(buildCaptainCrewOrderPanel({ snapshot, flow: repair }).detailKey, 'captainCrew.flow.repairAuthorized');
  assert.equal(buildCaptainCrewOrderPanel({ snapshot, flow: evasion }).detailKey, 'captainCrew.flow.evasionOrdered');
  assert.equal(buildCaptainCrewOrderPanel({ snapshot, flow: silent }).detailKey, 'captainCrew.flow.silentOrdered');
});

test('phase 47 is wired into gameplay, cache, smoke harness and translations', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const index = readText('index.html');
  const sw = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase47-captain-flow-panel/);
  assert.match(gameplay, /beginCaptainCrewOrder\('prepare-attack'/);
  assert.match(gameplay, /fire-confirm/);
  assert.match(gameplay, /setCaptainCommandMode\(mode = 'captain'\)/);
  assert.match(index, /phase47-captain-crew-realism\.css/);
  assert.match(sw, /captainCrewRealism\.js/);
  assert.match(smoke, /captainCrewRealism\.js/);
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['captainCrew.question.confirmFire', 'captainCrew.flow.awaitingFireOrder', 'captainCrew.action.fireConfirm']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
