import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { renderBottomNav } from '../js/components/ui.js';
import { PHASE26_SUBOFFICER, buildSubOfficerDialogue, shouldSubOfficerInterrupt } from '../js/systems/subOfficerCopilot.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));
const t = (key) => key;

test('phase 45 hotfix metadata is active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.69');
  assert.equal(BUILD_INFO.phase, '54');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.69');
  assert.equal(manifest.version, '2.0.0-alpha.69');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase54_career_retention.py');
});

test('main flow no longer exposes disconnected bridge button', () => {
  const lobby = readText('js/screens/lobby.js');
  const nav = renderBottomNav('campaign', t);
  assert.doesNotMatch(lobby, /data-nav="bridge"/);
  assert.doesNotMatch(nav, /data-nav="bridge"/);
  assert.match(nav, /data-nav="campaign"/);
  assert.match(nav, /data-nav="arsenal"/);
  assert.match(nav, /data-nav="crew"/);
});

test('subofficer uses existing officer avatar and action-first acknowledgement', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const story = readText('js/systems/storyCampaignDirector.js');
  assert.equal(PHASE26_SUBOFFICER.avatar, 'assets/avatars/de/officer_01.png');
  assert.match(gameplay, /assets\/avatars\/de\/officer_01\.png/);
  assert.match(story, /assets\/avatars\/de\/officer_01\.png/);
  assert.match(gameplay, /dataset\.subofficerAction/);
  assert.match(gameplay, /runSubOfficerAction\(command, station\)/);
});

test('persistent enemy threat is acknowledged once and does not reopen as a blocking popup', () => {
  const danger = buildSubOfficerDialogue({ snapshot: {
    escortState: 'hunt',
    hull: 100,
    physics: { depth: 32, actualSpeedKnots: 3 },
    sensors: { contacts: { escort: { confidence: 80 } } },
    navalAI: { aircraft: {} },
    weapons: { tdc: {} },
    damage: {},
    worldTime: 20000,
  } });
  assert.equal(danger.id, 'enemy-hunt');
  assert.equal(danger.mustInterrupt, true);
  assert.equal(shouldSubOfficerInterrupt({ next: danger, acknowledged: [] }), true);
  assert.equal(shouldSubOfficerInterrupt({ next: danger, acknowledged: [danger.id] }), false);
});

test('aircraft warning primary action is direct dive, not passive OK', () => {
  const air = buildSubOfficerDialogue({ snapshot: {
    navalAI: { aircraft: { active: true, state: 'attack' } },
    physics: { depth: 8 },
    sensors: { contacts: {} },
    weapons: { tdc: {} },
    damage: {},
    worldTime: 12000,
  } });
  assert.equal(air.id, 'aircraft-attack-run');
  assert.equal(air.actions[0].command, 'evade-now');
  assert.equal(air.ackLabelKey, 'captainOrder.action.evadeNow');
});
