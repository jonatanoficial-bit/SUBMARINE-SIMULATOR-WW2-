import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_INFO } from '../js/build.js';
import {
  canAwardOperationalHonor,
  findOperationalHonorDeckForNation,
  getOperationalHonorAwardedIds,
  summarizeOperationalHonors,
} from '../js/systems/operationalHonors.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('phase 20 metadata identifies operational honors build', () => {
  assert.equal(BUILD_INFO.version, '2.0.0');
  assert.equal(BUILD_INFO.phase, '54');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.match(BUILD_INFO.buildId, /SCWW2-2\.0\.0-\d{8}-\d{4}-BRT/);
});

test('operational honor decks cover every nation and use valid dependencies', () => {
  const nations = readJson('data/nations.json');
  const honors = readJson('data/operational_honors.json');
  const operations = new Set(readJson('data/special_operations.json').flatMap((deck) => deck.operations.map((operation) => operation.id)));
  const steps = new Set(readJson('data/operation_chains.json').flatMap((deck) => deck.steps.map((step) => step.id)));
  const outcomes = new Set(readJson('data/operation_outcomes.json').flatMap((deck) => deck.outcomes.map((outcome) => outcome.id)));
  assert.deepEqual(new Set(honors.map((deck) => deck.nationId)), new Set(nations.map((nation) => nation.id)));
  for (const deck of honors) {
    assert.equal(deck.honors.length, 5);
    for (const honor of deck.honors) {
      assert.ok(honor.nameKey.startsWith('operationalHonors.'));
      assert.ok(honor.descKey.startsWith('operationalHonors.'));
      assert.ok(honor.ribbonKey.startsWith('operationalHonors.ribbon.'));
      assert.ok(Number.isFinite(honor.tier));
      if (honor.requires.launchedOperationId) assert.ok(operations.has(honor.requires.launchedOperationId));
      if (honor.requires.completedStepId) assert.ok(steps.has(honor.requires.completedStepId));
      if (honor.requires.chosenOutcomeId) assert.ok(outcomes.has(honor.requires.chosenOutcomeId));
      ['credits','xp','commandPoints','reputation','prestige','intelBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        assert.ok(Number.isFinite(honor.reward[key]), `${honor.id} missing reward ${key}`);
      });
    }
  }
});

test('honors unlock from career performance and strategic dependencies', () => {
  const deck = findOperationalHonorDeckForNation(readJson('data/operational_honors.json'), 'de');
  const campaign = readJson('data/campaigns.json').find((item) => item.nationId === 'de');
  const locked = summarizeOperationalHonors({
    deck,
    campaign,
    completedMissionIds: ['de1','de2','de3','de4','de5','de6','de7'],
    awardedIds: [],
    career: { tonnage: 130000, reputation: 70, prestige: 30 },
    launchedOperationIds: ['de_operation_bdienst_shadow'],
    completedStepIds: ['de_chain_silent_exit'],
    chosenOutcomeIds: ['de_outcome_tonnage_war'],
  });
  const oak = locked.honors.find((item) => item.id === 'de_honor_oak_leaves');
  assert.equal(oak.unlocked, false);
  assert.equal(oak.lockedReason, 'operationalHonors.lockedOutcome');

  const unlocked = summarizeOperationalHonors({
    deck,
    campaign,
    completedMissionIds: ['de1','de2','de3','de4','de5','de6','de7','de8'],
    awardedIds: [],
    career: { tonnage: 180000, reputation: 82, prestige: 36 },
    launchedOperationIds: ['de_operation_bdienst_shadow'],
    completedStepIds: ['de_chain_silent_exit'],
    chosenOutcomeIds: ['de_outcome_shadow_doctrine'],
  });
  assert.equal(unlocked.availableCount, 5);
  assert.ok(unlocked.medalScore >= 40);
});

test('awarded honors combine effects and cannot be awarded twice', () => {
  const deck = findOperationalHonorDeckForNation(readJson('data/operational_honors.json'), 'us');
  const campaign = readJson('data/campaigns.json').find((item) => item.nationId === 'us');
  const summary = summarizeOperationalHonors({
    deck,
    campaign,
    completedMissionIds: ['us1','us2','us3','us4'],
    awardedIds: [],
    career: { tonnage: 60000, reputation: 30, prestige: 8 },
    launchedOperationIds: ['us_operation_magic_intercept'],
  });
  const silver = summary.honors.find((item) => item.id === 'us_honor_silver_star');
  assert.equal(canAwardOperationalHonor({ save: { career: { operationalHonors: { awardedIds: [] } } }, honor: silver, summary }).ok, true);
  const save = { career: { operationalHonors: { awardedIds: [silver.id] }, medals: [`honor:${silver.id}`] } };
  assert.equal(getOperationalHonorAwardedIds(save)[0], silver.id);
  const after = summarizeOperationalHonors({
    deck,
    campaign,
    completedMissionIds: ['us1','us2','us3','us4'],
    awardedIds: [silver.id],
    career: { tonnage: 60000, reputation: 30, prestige: 8 },
    launchedOperationIds: ['us_operation_magic_intercept'],
  });
  assert.equal(after.awardedCount, 1);
  assert.ok(after.combinedEffect.intelBonus >= 4);
  assert.equal(canAwardOperationalHonor({ save, honor: after.honors.find((item) => item.id === silver.id), summary: after }).reason, 'operationalHonors.alreadyAwarded');
});

test('all operational honor translation keys exist in PT EN ES', () => {
  const decks = readJson('data/operational_honors.json');
  const required = new Set([
    'operationalHonors.title','operationalHonors.heading','operationalHonors.score','operationalHonors.available','operationalHonors.locked','operationalHonors.awarded','operationalHonors.award','operationalHonors.honorActive','operationalHonors.tier','operationalHonors.unavailable','operationalHonors.alreadyAwarded','operationalHonors.lockedMissions','operationalHonors.lockedTonnage','operationalHonors.lockedReputation','operationalHonors.lockedPrestige','operationalHonors.lockedIntel','operationalHonors.lockedOperation','operationalHonors.lockedChain','operationalHonors.lockedOutcome','operationalHonors.historyTitle','operationalHonors.historyDetail','operationalHonors.reportTitle','operationalHonors.reportDetail','toast.operationalHonorAwarded'
  ]);
  decks.forEach((deck) => {
    required.add(deck.titleKey); required.add(deck.summaryKey); required.add(deck.frontKey);
    deck.honors.forEach((honor) => { required.add(honor.nameKey); required.add(honor.descKey); required.add(honor.ribbonKey); });
  });
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of required) assert.ok(key in dictionary, `${lang} missing ${key}`);
  }
});
