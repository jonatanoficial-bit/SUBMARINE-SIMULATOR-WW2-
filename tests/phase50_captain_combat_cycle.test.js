import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PHASE50_CAPTAIN_COMBAT_CYCLE, evaluateCaptainCombatCycle, buildCaptainCombatCycleView } from '../js/systems/captainCombatCycle.js';
import { createCaptainExecutionFromCommand } from '../js/systems/captainOrderExecution.js';
import { beginCaptainCrewOrder } from '../js/systems/captainCrewRealism.js';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const read = (path) => fs.readFileSync(path, 'utf8');

function snapshot(overrides = {}) {
  return {
    worldTime: 10000,
    depth: 12,
    hull: 92,
    periscopeOpen: false,
    torpedoActive: false,
    sensors: {
      contacts: {
        target: { id: 'target', role: 'merchant', confidence: 76, detected: true },
      },
    },
    weapons: {
      canFire: false,
      torpedoes: 4,
      minimumSolutionQuality: 42,
      tdc: { solutionQuality: 35 },
      profile: { maxLaunchDepth: 60 },
    },
    systems: { hull: 100, engines: 100, sonar: 100, weapons: 100 },
    ...overrides,
  };
}

test('phase 50 metadata keeps save schema stable and updates build wiring', () => {
  const build = readJson('BUILD_INFO.json');
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(PHASE50_CAPTAIN_COMBAT_CYCLE.phase, 50);
  assert.equal(PHASE50_CAPTAIN_COMBAT_CYCLE.version, 'v2.0.0-alpha.65');
  assert.equal(PHASE50_CAPTAIN_COMBAT_CYCLE.saveSchemaStable, true);
  assert.equal(build.version, 'v2.0.0-alpha.67');
  assert.equal(build.semver, '2.0.0-alpha.67');
  assert.equal(build.phase, '52');
  assert.equal(build.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.67');
  assert.equal(manifest.version, '2.0.0-alpha.67');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase52_captain_delegation_advisor.py');
});

test('captain combat cycle asks for attack preparation after a firm classified contact', () => {
  const view = buildCaptainCombatCycleView({ snapshot: snapshot(), commandMode: 'captain' });
  assert.equal(view.state, 'targetClassified');
  assert.equal(view.nextCommand, 'prepare-attack');
  assert.equal(view.nextStation, 'weapons');
  assert.ok(view.readiness >= 55);
  assert.equal(view.steps.find((step) => step.id === 'contact').state, 'done');
  assert.equal(view.steps.find((step) => step.id === 'captainOrder').state, 'active');
});

test('combat cycle walks attack chain through solution, periscope and final fire decision', () => {
  const snap = snapshot({ weapons: { canFire: true, torpedoes: 4, minimumSolutionQuality: 42, tdc: { solutionQuality: 86 }, profile: { maxLaunchDepth: 60 } } });
  const flow = beginCaptainCrewOrder('prepare-attack', snap);
  const execution = createCaptainExecutionFromCommand('prepare-attack', snap, { flow });
  const visual = evaluateCaptainCombatCycle({ snapshot: snap, execution, flow });
  assert.equal(visual.state, 'visualConfirm');
  assert.equal(visual.nextCommand, 'open-periscope');

  const ready = evaluateCaptainCombatCycle({ snapshot: { ...snap, periscopeOpen: true }, execution, flow });
  assert.equal(ready.state, 'captainFireDecision');
  assert.equal(ready.nextCommand, 'fire-confirm');
  assert.equal(ready.steps.find((step) => step.id === 'solution').state, 'done');
});

test('combat cycle gives damage, air and post-shot survival priority over attack', () => {
  const damageView = evaluateCaptainCombatCycle({ snapshot: snapshot({ hull: 24 }), execution: createCaptainExecutionFromCommand('prepare-attack', snapshot({ hull: 24 })), flow: beginCaptainCrewOrder('prepare-attack', snapshot({ hull: 24 })) });
  assert.equal(damageView.state, 'damagePriority');
  assert.equal(damageView.nextCommand, 'authorize-repair');
  assert.equal(damageView.tone, 'critical');

  const airView = evaluateCaptainCombatCycle({ snapshot: snapshot({ sensors: { contacts: { air: { id: 'air', role: 'aircraft', confidence: 88 } } } }) });
  assert.equal(airView.state, 'airThreat');
  assert.equal(airView.nextCommand, 'emergency-dive');

  const shotView = evaluateCaptainCombatCycle({ snapshot: snapshot({ torpedoActive: true, sensors: { contacts: { target: { role: 'merchant', confidence: 80 }, escort: { role: 'destroyer', confidence: 78 } } } }), flow: beginCaptainCrewOrder('fire-confirm', snapshot({ torpedoActive: true })) });
  assert.equal(shotView.state, 'postShot');
  assert.equal(shotView.nextCommand, 'evade-now');
});

test('manual mode preserves solo player control and disables automatic recommendation', () => {
  const view = evaluateCaptainCombatCycle({ snapshot: snapshot(), commandMode: 'manual' });
  assert.equal(view.state, 'manual');
  assert.equal(view.nextCommand, '');
  assert.equal(view.readiness, 100);
});

test('phase 50 files are linked in gameplay, smoke, service worker, index and translations', () => {
  const gameplay = read('js/screens/gameplay.js');
  const index = read('index.html');
  const sw = read('service-worker.js');
  const smoke = read('tests/smoke_test.py');
  const pt = read('data/translations/pt-BR.json');
  assert.match(gameplay, /phase50-combat-cycle/);
  assert.match(gameplay, /buildCaptainCombatCycleView/);
  assert.match(index, /phase50-captain-combat-cycle\.css/);
  assert.match(sw, /captainCombatCycle\.js/);
  assert.match(sw, /phase50-captain-combat-cycle\.css/);
  assert.match(smoke, /captainCombatCycle\.js/);
  assert.match(smoke, /phase50-captain-combat-cycle\.css/);
  assert.match(pt, /combatCycle\.question\.fire/);
});
