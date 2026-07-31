import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PHASE52_CAPTAIN_DELEGATION_ADVISOR, buildCaptainDelegationAdvisorView, buildDelegationRadioReport } from '../js/systems/captainDelegationAdvisor.js';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const read = (path) => fs.readFileSync(path, 'utf8');

function snapshot(overrides = {}) {
  return {
    worldTime: 8000,
    elapsedMs: 8000,
    depth: 12,
    hull: 94,
    periscopeOpen: false,
    torpedoActive: false,
    navigation: { route: [], patrolEntered: false },
    sensors: { contacts: {} },
    physics: { battery: 92, oxygen: 96 },
    weapons: {
      canFire: false,
      torpedoes: 4,
      reserveTorpedoes: 4,
      minimumSolutionQuality: 42,
      tdc: { solutionQuality: 0 },
      profile: { maxLaunchDepth: 60 },
    },
    systems: { hull: 100, engines: 100, sonar: 100, weapons: 100 },
    ...overrides,
  };
}

test('phase 52 metadata updates build without changing save schema or assets/audio promise', () => {
  const build = readJson('BUILD_INFO.json');
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(PHASE52_CAPTAIN_DELEGATION_ADVISOR.phase, 52);
  assert.equal(PHASE52_CAPTAIN_DELEGATION_ADVISOR.version, '2.0.0');
  assert.equal(PHASE52_CAPTAIN_DELEGATION_ADVISOR.preservesExistingAssetsAndAudio, true);
  assert.equal(PHASE52_CAPTAIN_DELEGATION_ADVISOR.mobileFullscreen, true);
  assert.equal(PHASE52_CAPTAIN_DELEGATION_ADVISOR.saveSchemaStable, true);
  assert.equal(build.version, '2.0.0');
  assert.equal(Number(build.phase), 54);
  assert.equal(build.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0');
  assert.equal(manifest.version, '2.0.0');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase54_career_retention.py');
});

test('advisor opens game with automatic route or manual navigation option', () => {
  const view = buildCaptainDelegationAdvisorView({ snapshot: snapshot(), commandMode: 'captain', nation: 'de' });
  assert.equal(view.phase, 52);
  assert.equal(view.scenario, 'route');
  assert.equal(view.autoCommand, 'auto-route');
  assert.equal(view.autoStation, 'navigation');
  assert.equal(view.manualCommand, 'manual-route');
  assert.equal(view.manualStation, 'navigation');
  assert.equal(view.infoCommand, 'radio-report');
  assert.equal(view.officerAsset, 'assets/avatars/de/officer_01.png');
  assert.equal(view.icon, 'assets/ui/instruments/helm_icon.png');
});

test('advisor reports radio contacts and offers automatic/manual combat decisions', () => {
  const targetView = buildCaptainDelegationAdvisorView({ snapshot: snapshot({
    navigation: { route: [{ x: 1, y: 2 }], patrolEntered: true },
    sensors: { contacts: { target: { id: 'm1', role: 'merchant', confidence: 82, detected: true } } },
    weapons: { canFire: false, torpedoes: 4, minimumSolutionQuality: 42, tdc: { solutionQuality: 55 }, profile: { maxLaunchDepth: 60 } },
  }) });
  assert.equal(targetView.scenario, 'attack-setup');
  assert.equal(targetView.autoCommand, 'auto-attack');
  assert.equal(targetView.manualCommand, 'manual-attack');
  assert.equal(targetView.radio.total, 1);
  assert.equal(targetView.radio.typeKeys[0].role, 'merchant');

  const fireView = buildCaptainDelegationAdvisorView({ snapshot: snapshot({
    navigation: { route: [{ x: 1, y: 2 }], patrolEntered: true },
    periscopeOpen: true,
    sensors: { contacts: { target: { id: 'm1', role: 'merchant', confidence: 90, detected: true } } },
    weapons: { canFire: true, torpedoes: 4, minimumSolutionQuality: 42, tdc: { solutionQuality: 88 }, profile: { maxLaunchDepth: 60 } },
  }) });
  assert.equal(fireView.scenario, 'attack-ready');
  assert.equal(fireView.autoLabelKey, 'delegation.action.autoFire');
});

test('advisor prioritizes danger, damage and manual override correctly', () => {
  const airView = buildCaptainDelegationAdvisorView({ snapshot: snapshot({ sensors: { contacts: { air: { role: 'aircraft', confidence: 90 } } } }) });
  assert.equal(airView.scenario, 'air-danger');
  assert.equal(airView.autoCommand, 'emergency-dive');
  assert.equal(airView.manualCommand, 'manual-evasion');

  const damageView = buildCaptainDelegationAdvisorView({ snapshot: snapshot({ hull: 25 }) });
  assert.equal(damageView.scenario, 'damage');
  assert.equal(damageView.autoCommand, 'authorize-repair');
  assert.equal(damageView.manualCommand, 'manual-damage');

  const manualView = buildCaptainDelegationAdvisorView({ snapshot: snapshot(), commandMode: 'manual' });
  assert.equal(manualView.mode, 'manual');
  assert.equal(manualView.autoCommand, 'captain-command');
  assert.equal(manualView.manualCommand, '');
});

test('radio report counts enemy types and contact categories', () => {
  const report = buildDelegationRadioReport(snapshot({
    sensors: { contacts: {
      target: { id: 'm1', role: 'merchant', confidence: 70 },
      escort: { id: 'd1', role: 'destroyer', confidence: 74 },
      air: { id: 'a1', role: 'aircraft', confidence: 68 },
    } },
  }));
  assert.equal(report.total, 3);
  assert.equal(report.hostileTotal, 2);
  assert.equal(report.counts.merchant, 1);
  assert.equal(report.counts.destroyer, 1);
  assert.equal(report.counts.aircraft, 1);
  assert.equal(report.titleKey, 'delegation.radio.title.air');
});

test('phase 52 files are wired in gameplay, css, service worker, smoke and translations', () => {
  const gameplay = read('js/screens/gameplay.js');
  const index = read('index.html');
  const sw = read('service-worker.js');
  const smoke = read('tests/smoke_test.py');
  const pt = read('data/translations/pt-BR.json');
  const css = read('css/phase52-captain-delegation-advisor.css');
  assert.match(gameplay, /buildCaptainDelegationAdvisorView/);
  assert.match(gameplay, /phase52-delegation-advisor/);
  assert.match(gameplay, /auto-attack/);
  assert.match(gameplay, /manual-route/);
  assert.match(index, /phase52-captain-delegation-advisor\.css/);
  assert.match(sw, /captainDelegationAdvisor\.js/);
  assert.match(sw, /phase52-captain-delegation-advisor\.css/);
  assert.match(smoke, /captainDelegationAdvisor\.js/);
  assert.match(smoke, /phase52-captain-delegation-advisor\.css/);
  assert.match(pt, /delegation\.question\.route/);
  assert.match(css, /100dvh/);
});
