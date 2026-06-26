import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { beginCaptainCrewOrder } from '../js/systems/captainCrewRealism.js';
import { PHASE48_CAPTAIN_ORDER_EXECUTION, buildCaptainExecutionBoard, createCaptainExecutionFromCommand, createCaptainExecutionState, normalizeCaptainExecutionState } from '../js/systems/captainOrderExecution.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

function snapshot(overrides = {}) {
  return {
    worldTime: 42000,
    elapsedMs: 42000,
    depth: 12,
    hull: 88,
    periscopeOpen: true,
    silentRunning: true,
    physics: { depth: 12, pressurePercent: 8, actualSpeedKnots: 2.2 },
    sensors: { contacts: { target: { detected: true, confidence: 88, rangeMeters: 1350 } }, strongestContact: { role: 'target', detected: true } },
    weapons: { canFire: true, minimumSolutionQuality: 42, profile: { maxLaunchDepth: 60 }, tdc: { solutionQuality: 84 } },
    damage: { criticalCount: 0, activeTeams: 1 },
    navigation: { route: [{ lat: 1, lon: 1 }], patrolEntered: true },
    ...overrides,
  };
}

test('phase 48 metadata keeps saves stable and advances build wiring', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.63');
  assert.equal(BUILD_INFO.phase, '48');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.63');
  assert.equal(manifest.version, '2.0.0-alpha.63');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase48_captain_order_execution.py');
  assert.equal(PHASE48_CAPTAIN_ORDER_EXECUTION.system, 'captain-order-execution-board');
});

test('captain order board maps attack preparation to station, ETA and checklist', () => {
  const snap = snapshot();
  const execution = createCaptainExecutionFromCommand('prepare-attack', snap);
  const board = buildCaptainExecutionBoard({ snapshot: { ...snap, worldTime: 52000 }, execution });
  assert.equal(board.orderKey, 'captainExecution.order.prepareAttack');
  assert.equal(board.stationKey, 'captainExecution.station.weapons');
  assert.equal(board.statusKey, 'captainExecution.status.preparing');
  assert.equal(board.risk, 'attack');
  assert.ok(board.progress > 0);
  assert.ok(board.etaSeconds > 0);
  assert.equal(board.rows[0].key, 'captainExecution.task.weaponsTube');
  assert.equal(board.rows[1].key, 'captainExecution.task.periscopeConfirm');
});

test('fire confirmation becomes executed and blocked orders show reason-safe feedback', () => {
  const snap = snapshot();
  const fired = createCaptainExecutionFromCommand('fire-confirm', snap, { result: { ok: true } });
  const blocked = createCaptainExecutionFromCommand('fire-confirm', snap, { result: { ok: false, reason: 'solutionPoor' } });
  assert.equal(buildCaptainExecutionBoard({ snapshot: snap, execution: fired }).statusKey, 'captainExecution.status.executed');
  const blockedBoard = buildCaptainExecutionBoard({ snapshot: snap, execution: blocked });
  assert.equal(blockedBoard.statusKey, 'captainExecution.status.blocked');
  assert.equal(blockedBoard.effectKey, 'captainExecution.effect.blocked');
  assert.equal(blockedBoard.risk, 'blocked');
});

test('execution board follows captain crew flow when no explicit order state exists', () => {
  const snap = snapshot();
  const flow = beginCaptainCrewOrder('prepare-attack', snap);
  const normalized = normalizeCaptainExecutionState(null, snap, flow, 'captain');
  const board = buildCaptainExecutionBoard({ snapshot: snap, execution: normalized, flow, commandMode: 'captain' });
  assert.equal(normalized.command, 'prepare-attack');
  assert.equal(board.orderKey, 'captainExecution.order.prepareAttack');
});

test('manual mode never mixes with captain crew automation', () => {
  const snap = snapshot();
  const current = createCaptainExecutionState(snap);
  const manual = normalizeCaptainExecutionState(current, snap, beginCaptainCrewOrder('prepare-attack', snap), 'manual');
  const board = buildCaptainExecutionBoard({ snapshot: snap, execution: manual, commandMode: 'manual' });
  assert.equal(manual.status, 'manual');
  assert.equal(board.effectKey, 'captainExecution.effect.manual');
  assert.equal(board.progress, 0);
});

test('phase 48 files are linked in gameplay, smoke, service worker and translations', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const index = readText('index.html');
  const sw = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase48-order-board/);
  assert.match(gameplay, /registerCaptainExecution\('prepare-attack'/);
  assert.match(index, /phase48-captain-order-execution\.css/);
  assert.match(sw, /captainOrderExecution\.js/);
  assert.match(smoke, /captainOrderExecution\.js/);
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['captainExecution.panel.kicker', 'captainExecution.order.prepareAttack', 'captainExecution.effect.manual']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
