import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_INFO } from '../js/build.js';
import {
  canLaunchSpecialOperation,
  findSpecialOperationDeckForNation,
  getSpecialOperationLaunchedIds,
  summarizeSpecialOperations,
} from '../js/systems/specialOperations.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('phase 17 metadata identifies campaign special operations build', () => {
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.33');
  assert.equal(BUILD_INFO.phase, '18');
  assert.equal(BUILD_INFO.saveSchemaVersion, 12);
  assert.match(BUILD_INFO.buildId, /F18-OPERATION-CHAINS/);
});

test('special operation decks cover every campaign nation with valid references', () => {
  const nations = readJson('data/nations.json');
  const decks = readJson('data/special_operations.json');
  const eventIds = new Set(readJson('data/campaign_events.json').flatMap((deck) => deck.events.map((event) => event.id)));
  const orderIds = new Set(readJson('data/high_command_orders.json').flatMap((deck) => deck.orders.map((order) => order.id)));
  assert.deepEqual(new Set(decks.map((item) => item.nationId)), new Set(nations.map((item) => item.id)));
  for (const deck of decks) {
    assert.equal(deck.operations.length, 4);
    for (const operation of deck.operations) {
      assert.ok(operation.nameKey.startsWith('specialOps.'));
      assert.ok(operation.descKey.startsWith('specialOps.'));
      assert.ok(['opportunity', 'covert', 'support', 'danger'].includes(operation.severity));
      if (operation.requires.activeEventId) assert.ok(eventIds.has(operation.requires.activeEventId));
      if (operation.requires.activeOrderId) assert.ok(orderIds.has(operation.requires.activeOrderId));
      ['credits','commandPoints'].forEach((key) => assert.ok(Number.isFinite(operation.cost[key]), `${operation.id} missing ${key}`));
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        assert.ok(Number.isFinite(operation.effect[key]), `${operation.id} missing ${key}`);
      });
    }
  }
});

test('special operations unlock from progress, active events and high command orders', () => {
  const decks = readJson('data/special_operations.json');
  const campaigns = readJson('data/campaigns.json');
  const deck = findSpecialOperationDeckForNation(decks, 'de');
  const campaign = campaigns.find((item) => item.nationId === 'de');
  const early = summarizeSpecialOperations({
    deck,
    campaign,
    completedMissionIds: ['de1'],
    launchedIds: [],
    activeEventIds: ['de_happy_time_window'],
    activeOrderIds: [],
    strategySnapshot: { intelLevel: 54, decryption: 18, pressure: 62 },
  });
  assert.equal(early.operations.find((operation) => operation.id === 'de_operation_paukenschlag').unlocked, true);
  assert.equal(early.operations.find((operation) => operation.id === 'de_operation_bdienst_shadow').unlocked, false);
  assert.equal(early.availableCount, 1);

  const advanced = summarizeSpecialOperations({
    deck,
    campaign,
    completedMissionIds: ['de1','de2','de3','de4'],
    launchedIds: ['de_operation_paukenschlag'],
    activeEventIds: ['de_happy_time_window','de_bdienst_breakthrough'],
    activeOrderIds: ['de_b_dienst_push','de_milk_cow_support'],
    strategySnapshot: { intelLevel: 70, decryption: 30, pressure: 66 },
  });
  assert.equal(advanced.launchedCount, 1);
  assert.ok(advanced.operations.find((operation) => operation.id === 'de_operation_bdienst_shadow').unlocked);
  assert.ok(advanced.operations.find((operation) => operation.id === 'de_operation_milk_cow_rendezvous').unlocked);
  assert.ok(advanced.combinedEffect.tonnageMultiplier > 1);
});

test('special operation launch gate prevents duplicates and unaffordable operations', () => {
  const deck = findSpecialOperationDeckForNation(readJson('data/special_operations.json'), 'us');
  const operation = deck.operations.find((item) => item.id === 'us_operation_magic_intercept');
  const save = { progression: { credits: 2000 }, strategy: { commandPoints: 2, specialOperations: { launchedIds: [], history: [] } } };
  const ok = canLaunchSpecialOperation({
    save,
    operation,
    completedMissions: 1,
    activeEventIds: ['us_magic_window'],
    activeOrderIds: [],
    strategySnapshot: { intelLevel: 64, decryption: 22, pressure: 54 },
  });
  assert.equal(ok.ok, true);
  save.strategy.specialOperations.launchedIds.push(operation.id);
  assert.equal(canLaunchSpecialOperation({ save, operation, completedMissions: 1, activeEventIds: ['us_magic_window'] }).reason, 'specialOps.alreadyLaunched');

  const poorSave = { progression: { credits: 10 }, strategy: { commandPoints: 0, specialOperations: { launchedIds: [] } } };
  assert.equal(canLaunchSpecialOperation({ save: poorSave, operation, completedMissions: 1, activeEventIds: ['us_magic_window'] }).reason, 'toast.commandPointsLow');
  assert.deepEqual(getSpecialOperationLaunchedIds(save), [operation.id]);
});

test('all special operation translation keys exist in PT EN ES', () => {
  const decks = readJson('data/special_operations.json');
  const required = new Set([
    'specialOps.title','specialOps.heading','specialOps.available','specialOps.launched','specialOps.locked','specialOps.launch',
    'specialOps.operationActive','specialOps.noAvailable','specialOps.unavailable','specialOps.alreadyLaunched','specialOps.lockedMissions',
    'specialOps.lockedEvent','specialOps.lockedOrder','specialOps.lockedPressure','specialOps.lockedIntel','specialOps.lockedDecryption',
    'specialOps.insufficientResources','specialOps.historyTitle','specialOps.historyDetail','specialOps.reportTitle','specialOps.reportDetail','toast.specialOperationLaunched'
  ]);
  decks.forEach((deck) => {
    required.add(deck.titleKey);
    required.add(deck.summaryKey);
    deck.operations.forEach((operation) => {
      required.add(operation.nameKey);
      required.add(operation.descKey);
      required.add(operation.typeKey);
    });
  });
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of required) assert.ok(key in dictionary, `${lang} missing ${key}`);
  }
});
