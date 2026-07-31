import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE46_CAPTAIN_ORDER_DOCTRINE, buildCaptainOrderDoctrineView } from '../js/systems/captainOrderDoctrine.js';
import { buildSubOfficerDialogue } from '../js/systems/subOfficerCopilot.js';

const ROOT = path.normalize(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 46 captain order metadata is active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, '2.0.0');
  assert.equal(BUILD_INFO.phase, '54');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0');
  assert.equal(manifest.version, '2.0.0');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase54_career_retention.py');
  assert.equal(PHASE46_CAPTAIN_ORDER_DOCTRINE.system, 'captain-order-doctrine');
});

test('captain order doctrine asks attack decision without firing automatically', () => {
  const snapshot = {
    physics: { depth: 18, pressurePercent: 12 }, hull: 100, worldTime: 45000,
    sensors: { contacts: { target: { detected: true, confidence: 82 } } },
    navalAI: { aircraft: {}, threatLevel: 'warning' },
    weapons: { canFire: true, minimumSolutionQuality: 42, tdc: { solutionQuality: 86 } },
    damage: {}, navigation: { route: [{ lat: 1, lon: 2 }], patrolEntered: true }
  };
  const view = buildCaptainOrderDoctrineView({ snapshot });
  assert.equal(view.id, 'captain-attack-decision');
  assert.equal(view.questionKey, 'captainOrder.question.attackReady');
  assert.equal(view.actions[0].command, 'prepare-attack');
  assert.notEqual(view.actions[0].command, 'fire-torpedo');
  const dialogue = buildSubOfficerDialogue({ snapshot });
  assert.equal(dialogue.id, 'fire-solution');
  assert.equal(dialogue.textKey, 'captainOrder.question.attackReady');
  assert.equal(dialogue.actions[0].command, 'prepare-attack');
});

test('captain order doctrine preserves manual control override', () => {
  const view = buildCaptainOrderDoctrineView({ snapshot: { worldTime: 30000, physics: {}, sensors: { contacts: {} }, navalAI: { aircraft: {} }, weapons: { tdc: {} }, damage: {}, navigation: { route: [] } }, commandMode: 'manual' });
  assert.equal(view.system, 'captain-order-doctrine');
  assert.ok(view.actions.some((item) => item.command === 'manual-control'));
  const gameplay = readText('js/screens/gameplay.js');
  assert.match(gameplay, /captainCommandMode = 'captain'/);
  assert.match(gameplay, /setCaptainCommandMode\('manual'\)/);
  assert.match(gameplay, /captainAllowsPopup = captainCommandMode === 'captain' \|\| dialogue\.priority >= 8/);
});

test('subofficer decisions map to crew-operated orders', () => {
  const air = buildSubOfficerDialogue({ snapshot: { worldTime: 20000, physics: { depth: 8 }, sensors: { contacts: {} }, navalAI: { aircraft: { active: true, state: 'attack' } }, weapons: { tdc: {} }, damage: {} } });
  assert.equal(air.actions[0].command, 'evade-now');
  const damage = buildSubOfficerDialogue({ snapshot: { worldTime: 20000, hull: 30, physics: {}, sensors: { contacts: {} }, navalAI: { aircraft: {} }, weapons: { tdc: {} }, damage: { criticalCount: 1 } } });
  assert.equal(damage.actions[0].command, 'authorize-repair');
  const ready = buildSubOfficerDialogue({ snapshot: { worldTime: 1000, elapsedMs: 1000, physics: {}, sensors: { contacts: {} }, navalAI: { aircraft: {} }, weapons: { tdc: {} }, damage: {}, navigation: { route: [] } } });
  assert.equal(ready.actions[0].command, 'plan-patrol');
});

test('phase 46 assets are wired into app, cache and translations', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const index = readText('index.html');
  const sw = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase46-command-mode-card/);
  assert.match(gameplay, /prepare-attack/);
  assert.match(gameplay, /authorize-repair/);
  assert.match(index, /phase46-captain-order-doctrine\.css/);
  assert.match(sw, /captainOrderDoctrine\.js/);
  assert.match(smoke, /captainOrderDoctrine\.js/);
  assert.match(smoke, /captainCrewRealism\.js/);
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['captainOrder.question.attackReady', 'captainOrder.action.prepareAttack', 'captainOrder.mode.manual']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
