import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PHASE51_CAPTAIN_COMMAND_ROOM, buildCaptainCommandRoomView } from '../js/systems/captainCommandRoom.js';

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
    physics: { battery: 88, oxygen: 94 },
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

test('phase 51 metadata preserves audio/assets and save schema while updating build', () => {
  const build = readJson('BUILD_INFO.json');
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(PHASE51_CAPTAIN_COMMAND_ROOM.phase, 51);
  assert.equal(PHASE51_CAPTAIN_COMMAND_ROOM.version, 'v2.0.0-alpha.66');
  assert.equal(PHASE51_CAPTAIN_COMMAND_ROOM.preservesExistingAssetsAndAudio, true);
  assert.equal(PHASE51_CAPTAIN_COMMAND_ROOM.saveSchemaStable, true);
  assert.equal(build.version, 'v2.0.0-alpha.68');
  assert.equal(build.semver, '2.0.0-alpha.68');
  assert.equal(build.phase, '53');
  assert.equal(build.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.68');
  assert.equal(manifest.version, '2.0.0-alpha.68');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase53_crew_progression_impact.py');
});

test('command room recommends attack preparation after classified target', () => {
  const view = buildCaptainCommandRoomView({ snapshot: snapshot(), commandMode: 'captain', nation: 'de' });
  assert.equal(view.phase, 51);
  assert.equal(view.tone, 'watch');
  assert.equal(view.primaryCommand, 'prepare-attack');
  assert.equal(view.primaryStation, 'weapons');
  assert.equal(view.secondaryCommand, 'hold-shadow');
  assert.ok(view.cards.length >= 4);
  assert.ok(view.cards.some((card) => card.asset === 'assets/avatars/de/sonar_01.png'));
  assert.ok(view.cards.some((card) => card.icon === 'assets/ui/instruments/torpedo_icon.png'));
});

test('command room gives captain final fire, damage, air and post-shot priority', () => {
  const fireView = buildCaptainCommandRoomView({ snapshot: snapshot({ periscopeOpen: true, weapons: { canFire: true, torpedoes: 4, minimumSolutionQuality: 42, tdc: { solutionQuality: 86 }, profile: { maxLaunchDepth: 60 } } }) });
  assert.equal(fireView.primaryCommand, 'fire-confirm');
  assert.equal(fireView.primaryStation, 'periscope');
  assert.equal(fireView.secondaryCommand, 'cancel-attack');

  const damageView = buildCaptainCommandRoomView({ snapshot: snapshot({ hull: 24 }) });
  assert.equal(damageView.tone, 'critical');
  assert.equal(damageView.primaryCommand, 'authorize-repair');
  assert.equal(damageView.primaryStation, 'damage');

  const airView = buildCaptainCommandRoomView({ snapshot: snapshot({ sensors: { contacts: { air: { id: 'air', role: 'aircraft', confidence: 88 } } } }) });
  assert.equal(airView.primaryCommand, 'emergency-dive');
  assert.equal(airView.primaryStation, 'instruments');

  const shotView = buildCaptainCommandRoomView({ snapshot: snapshot({ torpedoActive: true, sensors: { contacts: { target: { role: 'merchant', confidence: 80 }, escort: { role: 'destroyer', confidence: 78 } } } }) });
  assert.equal(shotView.primaryCommand, 'evade-now');
  assert.equal(shotView.primaryStation, 'instruments');
});

test('manual mode preserves solo control and only offers return to captain mode', () => {
  const view = buildCaptainCommandRoomView({ snapshot: snapshot(), commandMode: 'manual' });
  assert.equal(view.mode, 'manual');
  assert.equal(view.primaryCommand, '');
  assert.equal(view.secondaryCommand, 'captain-command');
  assert.equal(view.primaryActionKey, 'commandRoom.action.manualDisabled');
  assert.equal(view.manualOverride, true);
});

test('phase 51 files are linked in gameplay, smoke, service worker, index and translations', () => {
  const gameplay = read('js/screens/gameplay.js');
  const index = read('index.html');
  const sw = read('service-worker.js');
  const smoke = read('tests/smoke_test.py');
  const pt = read('data/translations/pt-BR.json');
  const css = read('css/phase51-captain-command-room.css');
  assert.match(gameplay, /phase51-command-room-definitive/);
  assert.match(gameplay, /buildCaptainCommandRoomView/);
  assert.match(gameplay, /captainCommandMode === 'manual'/);
  assert.match(index, /phase51-captain-command-room\.css/);
  assert.match(sw, /captainCommandRoom\.js/);
  assert.match(sw, /phase51-captain-command-room\.css/);
  assert.match(smoke, /captainCommandRoom\.js/);
  assert.match(smoke, /phase51-captain-command-room\.css/);
  assert.match(pt, /commandRoom\.headline\.fire/);
  assert.match(css, /100dvh/);
});
