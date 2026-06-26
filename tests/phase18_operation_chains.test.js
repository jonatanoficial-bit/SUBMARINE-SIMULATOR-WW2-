import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_INFO } from '../js/build.js';
import {
  canExecuteOperationChainStep,
  findOperationChainDeckForNation,
  getOperationChainCompletedStepIds,
  summarizeOperationChains,
} from '../js/systems/operationChains.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('phase 18 metadata identifies special operation chains build', () => {
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.63');
  assert.equal(BUILD_INFO.phase, '48');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.match(BUILD_INFO.buildId, /F48-CAPTAIN-ORDER-EXECUTION/);
});

test('operation chain decks cover every nation and reference valid operations/events', () => {
  const nations = readJson('data/nations.json');
  const chains = readJson('data/operation_chains.json');
  const operationIds = new Set(readJson('data/special_operations.json').flatMap((deck) => deck.operations.map((operation) => operation.id)));
  const eventIds = new Set(readJson('data/campaign_events.json').flatMap((deck) => deck.events.map((event) => event.id)));
  assert.deepEqual(new Set(chains.map((deck) => deck.nationId)), new Set(nations.map((nation) => nation.id)));
  for (const deck of chains) {
    assert.equal(deck.steps.length, 4);
    const seen = new Set();
    for (const step of deck.steps) {
      assert.ok(step.nameKey.startsWith('operationChains.'));
      assert.ok(step.descKey.startsWith('operationChains.'));
      assert.ok(step.stageKey.startsWith('operationChains.stage.'));
      assert.ok(!seen.has(step.id));
      if (step.requires.previousStepId) assert.ok(seen.has(step.requires.previousStepId), `${step.id} must reference an earlier step`);
      seen.add(step.id);
      if (step.requires.launchedOperationId) assert.ok(operationIds.has(step.requires.launchedOperationId));
      if (step.requires.activeEventId) assert.ok(eventIds.has(step.requires.activeEventId));
      ['credits','commandPoints'].forEach((key) => assert.ok(Number.isFinite(step.cost[key]), `${step.id} missing ${key}`));
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        assert.ok(Number.isFinite(step.effect[key]), `${step.id} missing ${key}`);
      });
    }
  }
});

test('operation chain unlocks sequentially from special operations and previous steps', () => {
  const chains = readJson('data/operation_chains.json');
  const campaigns = readJson('data/campaigns.json');
  const deck = findOperationChainDeckForNation(chains, 'de');
  const campaign = campaigns.find((item) => item.nationId === 'de');
  const first = summarizeOperationChains({
    deck,
    campaign,
    completedMissionIds: ['de1'],
    completedStepIds: [],
    launchedOperationIds: ['de_operation_paukenschlag'],
    activeEventIds: ['de_happy_time_window'],
    strategySnapshot: { intelLevel: 58, decryption: 18, pressure: 60 },
  });
  assert.equal(first.steps[0].unlocked, true);
  assert.equal(first.steps[1].unlocked, false);
  assert.equal(first.availableCount, 1);
  const advanced = summarizeOperationChains({
    deck,
    campaign,
    completedMissionIds: ['de1','de2','de3','de4'],
    completedStepIds: ['de_chain_shadow_chart','de_chain_convoy_shadow'],
    launchedOperationIds: ['de_operation_paukenschlag','de_operation_bdienst_shadow','de_operation_milk_cow_rendezvous'],
    activeEventIds: ['de_happy_time_window','de_bdienst_breakthrough'],
    strategySnapshot: { intelLevel: 72, decryption: 32, pressure: 64 },
  });
  assert.equal(advanced.completedCount, 2);
  assert.equal(advanced.steps[2].unlocked, true);
  assert.ok(advanced.combinedEffect.intelBonus > 0);
  assert.ok(advanced.chainPercent >= 50);
});

test('operation chain execution gate prevents duplicates and unaffordable steps', () => {
  const deck = findOperationChainDeckForNation(readJson('data/operation_chains.json'), 'us');
  const step = deck.steps.find((item) => item.id === 'us_chain_magic_plot');
  const save = { progression: { credits: 2000 }, strategy: { commandPoints: 2, operationChains: { completedStepIds: [], history: [] } } };
  const ok = canExecuteOperationChainStep({
    save,
    step,
    completedMissions: 1,
    completedStepIds: [],
    launchedOperationIds: ['us_operation_magic_intercept'],
    activeEventIds: ['us_magic_window'],
    strategySnapshot: { intelLevel: 64, decryption: 22, pressure: 54 },
  });
  assert.equal(ok.ok, true);
  save.strategy.operationChains.completedStepIds.push(step.id);
  assert.equal(canExecuteOperationChainStep({ save, step, completedMissions: 1, launchedOperationIds: ['us_operation_magic_intercept'] }).reason, 'operationChains.alreadyCompleted');

  const poorSave = { progression: { credits: 10 }, strategy: { commandPoints: 0, operationChains: { completedStepIds: [] } } };
  assert.equal(canExecuteOperationChainStep({ save: poorSave, step, completedMissions: 1, launchedOperationIds: ['us_operation_magic_intercept'] }).reason, 'toast.commandPointsLow');
  assert.deepEqual(getOperationChainCompletedStepIds(save), [step.id]);
});

test('all operation chain translation keys exist in PT EN ES', () => {
  const chains = readJson('data/operation_chains.json');
  const required = new Set([
    'operationChains.title','operationChains.heading','operationChains.progress','operationChains.available','operationChains.completed','operationChains.locked',
    'operationChains.execute','operationChains.stepActive','operationChains.nextStep','operationChains.unavailable','operationChains.alreadyCompleted',
    'operationChains.lockedMissions','operationChains.lockedPrevious','operationChains.lockedSpecialOperation','operationChains.lockedEvent','operationChains.lockedPressure',
    'operationChains.lockedIntel','operationChains.lockedDecryption','operationChains.insufficientResources','operationChains.historyTitle','operationChains.historyDetail',
    'operationChains.reportTitle','operationChains.reportDetail','toast.operationChainStepCompleted'
  ]);
  chains.forEach((deck) => {
    required.add(deck.titleKey);
    required.add(deck.summaryKey);
    required.add(deck.frontKey);
    deck.steps.forEach((step) => {
      required.add(step.nameKey);
      required.add(step.descKey);
      required.add(step.stageKey);
    });
  });
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of required) assert.ok(key in dictionary, `${lang} missing ${key}`);
  }
});
