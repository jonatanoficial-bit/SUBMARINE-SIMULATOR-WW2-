import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { beginCaptainCrewOrder } from '../js/systems/captainCrewRealism.js';
import { createCaptainExecutionFromCommand } from '../js/systems/captainOrderExecution.js';
import { PHASE49_CAPTAIN_COMMAND_CHAIN, analyzeCaptainCommandThreat, buildCaptainCommandChainView } from '../js/systems/captainCommandChain.js';

const ROOT = path.normalize(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

function snapshot(overrides = {}) {
  return {
    worldTime: 64000,
    elapsedMs: 64000,
    depth: 14,
    hull: 88,
    periscopeOpen: true,
    silentRunning: false,
    torpedoActive: false,
    systems: { engines: 94, sonar: 96, periscope: 92, weapons: 91 },
    physics: { depth: 14, actualSpeedKnots: 2.8 },
    sensors: {
      contacts: {
        target: { role: 'target', type: 'merchant', detected: true, confidence: 84, rangeMeters: 1400 },
        escort: { role: 'escort', type: 'destroyer', detected: true, confidence: 44, rangeMeters: 3600 },
      },
      strongestContact: { role: 'target', detected: true, confidence: 84 },
    },
    weapons: { canFire: true, minimumSolutionQuality: 42, profile: { maxLaunchDepth: 60 }, tdc: { solutionQuality: 82 } },
    damage: { criticalCount: 0, activeTeams: 0 },
    navalAI: { enemySolution: 28 },
    ...overrides,
  };
}

test('phase 49 metadata keeps saves stable and updates build wiring', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, '2.0.0');
  assert.equal(BUILD_INFO.phase, '54');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0');
  assert.equal(manifest.version, '2.0.0');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase54_career_retention.py');
  assert.equal(PHASE49_CAPTAIN_COMMAND_CHAIN.system, 'reactive-captain-command-chain');
});

test('command chain turns realistic attack readiness into a captain fire question', () => {
  const snap = snapshot();
  const execution = createCaptainExecutionFromCommand('prepare-attack', snap);
  const view = buildCaptainCommandChainView({ snapshot: snap, execution, flow: beginCaptainCrewOrder('prepare-attack', snap), commandMode: 'captain' });
  assert.equal(view.responseKey, 'captainChain.response.readyToFire');
  assert.equal(view.recommendationKey, 'captainChain.recommendation.fireOrHold');
  assert.equal(view.nextCommand, 'fire-confirm');
  assert.equal(view.actionStation, 'periscope');
  assert.equal(view.shouldInterrupt, true);
});

test('command chain prioritizes damage-control over attack when the boat is hurt', () => {
  const snap = snapshot({ hull: 29, damage: { criticalCount: 1 }, periscopeOpen: true });
  const execution = createCaptainExecutionFromCommand('prepare-attack', snap);
  const view = buildCaptainCommandChainView({ snapshot: snap, execution, flow: beginCaptainCrewOrder('prepare-attack', snap), commandMode: 'captain' });
  assert.equal(view.tone, 'critical');
  assert.equal(view.stationKey, 'captainExecution.station.damage');
  assert.equal(view.recommendationKey, 'captainChain.recommendation.authorizeRepair');
  assert.equal(view.nextCommand, 'authorize-repair');
});

test('command chain catches depth and periscope conflicts before firing', () => {
  const tooDeep = snapshot({ depth: 92, physics: { depth: 92 }, periscopeOpen: false });
  const depthView = buildCaptainCommandChainView({ snapshot: tooDeep, execution: createCaptainExecutionFromCommand('prepare-attack', tooDeep), flow: beginCaptainCrewOrder('prepare-attack', tooDeep) });
  assert.equal(depthView.responseKey, 'captainChain.response.tooDeep');
  assert.equal(depthView.nextCommand, 'order-periscope-depth');
  const noScope = snapshot({ periscopeOpen: false });
  const scopeView = buildCaptainCommandChainView({ snapshot: noScope, execution: createCaptainExecutionFromCommand('prepare-attack', noScope), flow: beginCaptainCrewOrder('prepare-attack', noScope) });
  assert.equal(scopeView.responseKey, 'captainChain.response.needPeriscope');
  assert.equal(scopeView.nextCommand, 'open-periscope');
});

test('manual mode remains isolated from crew automation', () => {
  const view = buildCaptainCommandChainView({ snapshot: snapshot(), execution: createCaptainExecutionFromCommand('manual-control', snapshot()), flow: beginCaptainCrewOrder('prepare-attack', snapshot()), commandMode: 'manual' });
  assert.equal(view.tone, 'manual');
  assert.equal(view.nextCommand, '');
  assert.equal(view.recommendationKey, 'captainChain.recommendation.manual');
});

test('threat analyzer detects escort and target contacts for chain decisions', () => {
  const threat = analyzeCaptainCommandThreat(snapshot({ sensors: { contacts: { target: { role: 'target', confidence: 76 }, escort: { role: 'escort', type: 'destroyer', confidence: 81 } } } }));
  assert.equal(threat.hasTarget, true);
  assert.equal(threat.hasEscortThreat, true);
  assert.ok(threat.escortConfidence >= 81);
});

test('phase 49 files are linked in gameplay, smoke, service worker, index and translations', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const index = readText('index.html');
  const sw = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase49-command-chain/);
  assert.match(gameplay, /buildCaptainCommandChainView/);
  assert.match(index, /phase49-captain-command-chain\.css/);
  assert.match(sw, /captainCommandChain\.js/);
  assert.match(smoke, /captainCommandChain\.js/);
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['captainChain.panel.kicker', 'captainChain.response.readyToFire', 'captainChain.recommendation.authorizeRepair']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
