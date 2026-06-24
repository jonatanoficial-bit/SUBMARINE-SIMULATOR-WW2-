import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { buildSubOfficerDialogue, classifySubOfficerSituation, PHASE26_SUBOFFICER, renderSubOfficerLine, shouldSubOfficerInterrupt } from '../js/systems/subOfficerCopilot.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

test('phase 26 subofficer metadata is active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.46');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.46');
  assert.equal(BUILD_INFO.phase, '31');
  assert.equal(BUILD_INFO.saveSchemaVersion, 25);
  assert.equal(pkg.version, '2.0.0-alpha.46');
  assert.equal(manifest.version, '2.0.0-alpha.46');
  assert.equal(PHASE26_SUBOFFICER.role, 'subofficer-copilot');
  assert.equal(PHASE26_SUBOFFICER.typewriter, true);
});

test('subofficer classifies standby, enemy, aircraft, damage and firing solution', () => {
  const standby = classifySubOfficerSituation({ snapshot: { physics: { actualSpeedKnots: 0, depth: 8 }, worldTime: 1 }, station: 'command' });
  const enemy = classifySubOfficerSituation({ snapshot: { escortState: 'hunt', physics: { actualSpeedKnots: 5, depth: 32 }, sensors: { contacts: { escort: { confidence: 80 } } } } });
  const aircraft = classifySubOfficerSituation({ snapshot: { navalAI: { aircraft: { active: true } }, physics: { depth: 10 } } });
  const damage = classifySubOfficerSituation({ snapshot: { hull: 34, damage: { criticalCount: 1 }, physics: { depth: 70 } } });
  const fire = classifySubOfficerSituation({ snapshot: { sensors: { contacts: { target: { detected: true, confidence: 88 } } }, weapons: { canFire: true, tdc: { solutionQuality: 82 } }, physics: { depth: 12 } } });
  assert.equal(standby.id, 'standing-by');
  assert.equal(enemy.id, 'enemy-hunt');
  assert.equal(aircraft.id, 'aircraft-inbound');
  assert.equal(damage.id, 'damage-critical');
  assert.equal(fire.id, 'fire-solution');
  assert.ok(aircraft.priority > enemy.priority);
});

test('dialogue interrupts emergencies and respects acknowledgements', () => {
  const calm = buildSubOfficerDialogue({ snapshot: { physics: { actualSpeedKnots: 0, depth: 5 }, worldTime: 10 }, station: 'command' });
  const danger = buildSubOfficerDialogue({ snapshot: { escortState: 'hunt', physics: { depth: 20 }, worldTime: 10 } });
  assert.equal(calm.shouldAutoOpen, true);
  assert.equal(danger.mustInterrupt, true);
  assert.equal(shouldSubOfficerInterrupt({ next: danger, acknowledged: [danger.key, danger.id] }), true);
  assert.equal(shouldSubOfficerInterrupt({ next: calm, acknowledged: [calm.key] }), false);
});

test('typewriter line renderer keeps dialogue compact', () => {
  const long = renderSubOfficerLine({ text: 'Senhor '.repeat(80), maxChars: 90 });
  assert.ok(long.length <= 90);
  assert.ok(long.endsWith('…'));
});

test('phase 26 files, cache, gameplay hooks and translations are present', () => {
  for (const relative of ['js/systems/subOfficerCopilot.js', 'css/phase26-subofficer-copilot.css', 'assets/avatars/subofficer_ww2.svg', 'tests/phase26_subofficer_copilot.test.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, relative)), `${relative} missing`);
  }
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const gameplay = fs.readFileSync(path.join(ROOT, 'js/screens/gameplay.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  const smoke = fs.readFileSync(path.join(ROOT, 'tests/smoke_test.py'), 'utf8');
  assert.match(index, /phase26-subofficer-copilot\.css/);
  assert.match(gameplay, /subofficer-copilot/);
  assert.match(gameplay, /typeSubOfficerLine/);
  assert.match(gameplay, /OK \/ RECEBIDO|subofficer\.ack/);
  assert.match(sw, /subOfficerCopilot\.js/);
  assert.match(sw, /subofficer_ww2\.svg/);
  assert.match(smoke, /subOfficerCopilot\.js/);
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of ['subofficer.rank', 'subofficer.msg.standby', 'subofficer.msg.enemyDetected', 'subofficer.ack']) {
      assert.ok(dictionary[key], `${lang}:${key} missing`);
    }
  }
});
