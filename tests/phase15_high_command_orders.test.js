import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_INFO } from '../js/build.js';
import { canApplyHighCommandOrder, findHighCommandDeckForNation, getHighCommandAppliedIds, summarizeHighCommandOrders } from '../js/systems/highCommandOrders.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('phase 15 metadata identifies strategic high command order build', () => {
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.43');
  assert.equal(BUILD_INFO.phase, '28');
  assert.equal(BUILD_INFO.saveSchemaVersion, 22);
  assert.match(BUILD_INFO.buildId, /F28-AIR-ATTACK-EVASION/);
});

test('high command order decks cover every campaign nation with four orders', () => {
  const nations = readJson('data/nations.json');
  const decks = readJson('data/high_command_orders.json');
  assert.deepEqual(new Set(decks.map((item) => item.nationId)), new Set(nations.map((item) => item.id)));
  for (const deck of decks) {
    assert.equal(deck.orders.length, 4);
    deck.orders.forEach((order) => {
      assert.ok(order.nameKey.startsWith('highCommand.'));
      assert.ok(order.descKey.startsWith('highCommand.'));
      assert.ok(Number.isFinite(order.cost.credits));
      assert.ok(Number.isFinite(order.cost.commandPoints));
      assert.ok(Number.isFinite(order.requires.completedMissions));
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        assert.ok(Number.isFinite(order.effect[key]), `${order.id} missing ${key}`);
      });
    });
  }
});

test('high command summary locks, unlocks and combines persistent effects deterministically', () => {
  const decks = readJson('data/high_command_orders.json');
  const campaigns = readJson('data/campaigns.json');
  const deck = findHighCommandDeckForNation(decks, 'de');
  const campaign = campaigns.find((item) => item.nationId === 'de');
  const initial = summarizeHighCommandOrders({ deck, campaign, completedMissionIds: [], appliedOrderIds: [] });
  assert.equal(initial.orders[0].unlocked, true);
  assert.equal(initial.orders[2].unlocked, false);
  const advanced = summarizeHighCommandOrders({ deck, campaign, completedMissionIds: ['de1','de2','de3'], appliedOrderIds: ['de_wolfpack_concentration','de_b_dienst_push'] });
  assert.equal(advanced.activeCount, 2);
  assert.equal(advanced.orders.find((order) => order.id === 'de_milk_cow_support').unlocked, true);
  assert.ok(advanced.combinedEffect.intelBonus > initial.combinedEffect.intelBonus);
  assert.ok(advanced.combinedEffect.tonnageMultiplier > initial.combinedEffect.tonnageMultiplier);
});

test('high command application gate prevents duplicate and unaffordable orders', () => {
  const deck = findHighCommandDeckForNation(readJson('data/high_command_orders.json'), 'us');
  const order = deck.orders[0];
  const save = { progression: { credits: 5000 }, strategy: { commandPoints: 3, highCommandOrders: { appliedIds: [], history: [] } } };
  assert.equal(canApplyHighCommandOrder({ save, order, completedMissions: 0 }).ok, true);
  save.strategy.highCommandOrders.appliedIds.push(order.id);
  assert.equal(canApplyHighCommandOrder({ save, order, completedMissions: 0 }).reason, 'highCommand.alreadyApplied');
  assert.deepEqual(getHighCommandAppliedIds(save), [order.id]);
  const locked = deck.orders.find((item) => item.requires.completedMissions > 0);
  save.strategy.highCommandOrders.appliedIds = [];
  assert.equal(canApplyHighCommandOrder({ save, order: locked, completedMissions: 0 }).reason, 'highCommand.lockedMissions');
  save.strategy.commandPoints = 0;
  assert.equal(canApplyHighCommandOrder({ save, order, completedMissions: 0 }).reason, 'toast.commandPointsLow');
});

test('all high command translation keys exist in PT EN ES', () => {
  const decks = readJson('data/high_command_orders.json');
  const required = new Set([
    'highCommand.title','highCommand.heading','highCommand.applied','highCommand.available','highCommand.locked',
    'highCommand.applyOrder','highCommand.orderActive','highCommand.requiresMissions','highCommand.insufficientResources',
    'highCommand.unavailable','highCommand.alreadyApplied','highCommand.lockedMissions','highCommand.historyTitle',
    'highCommand.historyDetail','highCommand.reportTitle','highCommand.reportDetail','toast.highCommandApplied'
  ]);
  decks.forEach((deck) => {
    required.add(deck.titleKey);
    required.add(deck.summaryKey);
    deck.orders.forEach((order) => { required.add(order.nameKey); required.add(order.descKey); });
  });
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of required) assert.ok(key in dictionary, `${lang} missing ${key}`);
  }
});
