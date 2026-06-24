import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_INFO } from '../js/build.js';
import {
  canChooseOperationOutcome,
  findOperationOutcomeDeckForNation,
  getOperationOutcomeChosenIds,
  summarizeOperationOutcomes,
} from '../js/systems/operationOutcomes.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('phase 19 metadata identifies strategic outcomes build', () => {
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.51');
  assert.equal(BUILD_INFO.phase, '36');
  assert.equal(BUILD_INFO.saveSchemaVersion, 30);
  assert.match(BUILD_INFO.buildId, /F36-CINEMATIC-PREMIUM-INTERFACE/);
});

test('operation outcome decks cover every nation and require valid chain steps', () => {
  const nations = readJson('data/nations.json');
  const outcomes = readJson('data/operation_outcomes.json');
  const stepIds = new Set(readJson('data/operation_chains.json').flatMap((deck) => deck.steps.map((step) => step.id)));
  assert.deepEqual(new Set(outcomes.map((deck) => deck.nationId)), new Set(nations.map((nation) => nation.id)));
  for (const deck of outcomes) {
    assert.equal(deck.outcomes.length, 3);
    assert.equal(deck.requires.stepIds.length, 4);
    deck.requires.stepIds.forEach((stepId) => assert.ok(stepIds.has(stepId), `${deck.id} missing step ${stepId}`));
    for (const outcome of deck.outcomes) {
      assert.ok(outcome.nameKey.startsWith('operationOutcomes.'));
      assert.ok(outcome.descKey.startsWith('operationOutcomes.'));
      assert.ok(outcome.doctrineKey.startsWith('operationOutcomes.doctrine.'));
      ['credits','commandPoints'].forEach((key) => assert.ok(Number.isFinite(outcome.cost[key]), `${outcome.id} missing cost ${key}`));
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        assert.ok(Number.isFinite(outcome.effect[key]), `${outcome.id} missing effect ${key}`);
      });
    }
  }
});

test('strategic outcomes unlock only after the complete operation chain', () => {
  const deck = findOperationOutcomeDeckForNation(readJson('data/operation_outcomes.json'), 'de');
  const campaign = readJson('data/campaigns.json').find((item) => item.nationId === 'de');
  const locked = summarizeOperationOutcomes({
    deck,
    campaign,
    completedMissionIds: ['de1','de2','de3','de4','de5','de6'],
    chosenIds: [],
    operationChainSummary: { completedCount: 3, totalSteps: 4, chainPercent: 75, completedSteps: [{ id: 'de_chain_shadow_chart' }, { id: 'de_chain_convoy_shadow' }, { id: 'de_chain_rendezvous_net' }] },
  });
  assert.equal(locked.unlocked, false);
  assert.equal(locked.lockedReason, 'operationOutcomes.lockedChain');

  const unlocked = summarizeOperationOutcomes({
    deck,
    campaign,
    completedMissionIds: ['de1','de2','de3','de4','de5','de6'],
    chosenIds: [],
    operationChainSummary: { completedCount: 4, totalSteps: 4, chainPercent: 100, completedSteps: deck.requires.stepIds.map((id) => ({ id })) },
  });
  assert.equal(unlocked.unlocked, true);
  assert.equal(unlocked.availableCount, 3);
  assert.ok(unlocked.outcomeScore >= 80);
});

test('outcome choice is one per campaign and applies combined effect', () => {
  const deck = findOperationOutcomeDeckForNation(readJson('data/operation_outcomes.json'), 'us');
  const campaign = readJson('data/campaigns.json').find((item) => item.nationId === 'us');
  const summary = summarizeOperationOutcomes({
    deck,
    campaign,
    completedMissionIds: ['us1','us2','us3','us4','us5','us6'],
    chosenIds: [],
    operationChainSummary: { completedCount: 4, totalSteps: 4, chainPercent: 100, completedSteps: deck.requires.stepIds.map((id) => ({ id })) },
  });
  const outcome = summary.outcomes.find((item) => item.id === 'us_outcome_magic_stranglehold');
  const save = { progression: { credits: 3000 }, strategy: { commandPoints: 3, operationOutcomes: { chosenIds: [], history: [] } } };
  assert.equal(canChooseOperationOutcome({ save, outcome, summary }).ok, true);
  save.strategy.operationOutcomes.chosenIds.push(outcome.id);
  assert.equal(getOperationOutcomeChosenIds(save)[0], outcome.id);
  const chosenSummary = summarizeOperationOutcomes({
    deck,
    campaign,
    completedMissionIds: ['us1','us2','us3','us4','us5','us6'],
    chosenIds: [outcome.id],
    operationChainSummary: { completedCount: 4, totalSteps: 4, chainPercent: 100, completedSteps: deck.requires.stepIds.map((id) => ({ id })) },
  });
  assert.equal(chosenSummary.alreadyChosen, true);
  assert.ok(chosenSummary.combinedEffect.intelBonus >= 9);
  const other = chosenSummary.outcomes.find((item) => item.id !== outcome.id);
  assert.equal(canChooseOperationOutcome({ save, outcome: other, summary: chosenSummary }).reason, 'operationOutcomes.choiceLocked');
});

test('all outcome translation keys exist in PT EN ES', () => {
  const decks = readJson('data/operation_outcomes.json');
  const required = new Set([
    'operationOutcomes.title','operationOutcomes.heading','operationOutcomes.progress','operationOutcomes.available','operationOutcomes.locked','operationOutcomes.chosen',
    'operationOutcomes.choose','operationOutcomes.outcomeActive','operationOutcomes.unavailable','operationOutcomes.alreadyChosen','operationOutcomes.choiceLocked',
    'operationOutcomes.lockedChain','operationOutcomes.lockedMissions','operationOutcomes.insufficientResources','operationOutcomes.noChoice','operationOutcomes.finalDoctrine',
    'operationOutcomes.historyTitle','operationOutcomes.historyDetail','operationOutcomes.reportTitle','operationOutcomes.reportDetail','toast.operationOutcomeChosen'
  ]);
  decks.forEach((deck) => {
    required.add(deck.titleKey); required.add(deck.summaryKey); required.add(deck.frontKey);
    deck.outcomes.forEach((outcome) => {
      required.add(outcome.nameKey); required.add(outcome.descKey); required.add(outcome.doctrineKey);
    });
  });
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of required) assert.ok(key in dictionary, `${lang} missing ${key}`);
  }
});
