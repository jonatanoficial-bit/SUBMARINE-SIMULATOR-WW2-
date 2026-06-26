import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_INFO } from '../js/build.js';
import {
  canClaimCommandPromotion,
  findCommandAdvancementDeckForNation,
  getCommandAdvancementClaimedIds,
  summarizeCommandAdvancement,
} from '../js/systems/commandAdvancement.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('phase 21 metadata identifies command advancement build', () => {
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.60');
  assert.equal(BUILD_INFO.phase, '45');
  assert.equal(BUILD_INFO.saveSchemaVersion, 39);
  assert.match(BUILD_INFO.buildId, /F45-FLOW-SUBOFFICER-HOTFIX/);
});

test('command advancement decks cover every nation and use valid dependencies', () => {
  const nations = readJson('data/nations.json');
  const decks = readJson('data/command_advancement.json');
  const steps = new Set(readJson('data/operation_chains.json').flatMap((deck) => deck.steps.map((step) => step.id)));
  const outcomes = new Set(readJson('data/operation_outcomes.json').flatMap((deck) => deck.outcomes.map((outcome) => outcome.id)));
  assert.deepEqual(new Set(decks.map((deck) => deck.nationId)), new Set(nations.map((nation) => nation.id)));
  for (const deck of decks) {
    assert.equal(deck.ranks.length, 5);
    assert.deepEqual(deck.ranks.map((rank) => rank.rankIndex), [1, 2, 3, 4, 5]);
    for (const rank of deck.ranks) {
      assert.ok(rank.rankKey.startsWith(`rank.${deck.nationId}.`));
      assert.ok(rank.billetKey.startsWith('commandAdvancement.'));
      assert.ok(rank.descKey.startsWith('commandAdvancement.'));
      if (rank.requires.completedStepId) assert.ok(steps.has(rank.requires.completedStepId));
      if (rank.requires.chosenOutcomeId) assert.ok(outcomes.has(rank.requires.chosenOutcomeId));
      ['credits','xp','commandPoints','prestige'].forEach((key) => assert.ok(Number.isFinite(rank.reward[key]), `${rank.id} missing reward ${key}`));
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => assert.ok(Number.isFinite(rank.effect[key]), `${rank.id} missing effect ${key}`));
    }
  }
});

test('promotions unlock from rank, honors and strategic career requirements', () => {
  const deck = findCommandAdvancementDeckForNation(readJson('data/command_advancement.json'), 'uk');
  const campaign = readJson('data/campaigns.json').find((item) => item.nationId === 'uk');
  const locked = summarizeCommandAdvancement({
    deck,
    campaign,
    completedMissionIds: ['uk1','uk2','uk3','uk4','uk5','uk6','uk7'],
    claimedIds: [],
    career: { rankIndex: 4, reputation: 260, prestige: 44, tonnage: 120000 },
    awardedHonorIds: ['uk_honor_dsc','uk_honor_atlantic_star','uk_honor_dso'],
    completedStepIds: ['uk_chain_hfdf_plot'],
    chosenOutcomeIds: ['uk_outcome_codebreakers_net'],
  });
  const captain = locked.ranks.find((item) => item.id === 'uk_adv_captain');
  assert.equal(captain.unlocked, false);
  assert.equal(captain.lockedReason, 'commandAdvancement.lockedOutcome');

  const unlocked = summarizeCommandAdvancement({
    deck,
    campaign,
    completedMissionIds: ['uk1','uk2','uk3','uk4','uk5','uk6','uk7','uk8'],
    claimedIds: [],
    career: { rankIndex: 5, reputation: 380, prestige: 64, tonnage: 160000 },
    awardedHonorIds: ['uk_honor_dsc','uk_honor_atlantic_star','uk_honor_dso','uk_honor_convoy_shield','uk_honor_first_sea_lord'],
    completedStepIds: ['uk_chain_hfdf_plot'],
    chosenOutcomeIds: ['uk_outcome_escort_supremacy'],
  });
  assert.equal(unlocked.availableCount, 5);
  assert.ok(unlocked.authorityScore >= 70);
});

test('claimed promotions combine effects and cannot be claimed twice', () => {
  const deck = findCommandAdvancementDeckForNation(readJson('data/command_advancement.json'), 'us');
  const campaign = readJson('data/campaigns.json').find((item) => item.nationId === 'us');
  const summary = summarizeCommandAdvancement({
    deck,
    campaign,
    completedMissionIds: ['us1','us2','us3'],
    claimedIds: [],
    career: { rankIndex: 2, reputation: 100, prestige: 16, tonnage: 46000 },
    awardedHonorIds: ['us_honor_navy_comm'],
  });
  const lieutenant = summary.ranks.find((item) => item.id === 'us_adv_lieutenant');
  assert.equal(canClaimCommandPromotion({ save: { career: { commandAdvancement: { claimedIds: [] } } }, rank: lieutenant, summary }).ok, true);
  const save = { career: { commandAdvancement: { claimedIds: [lieutenant.id] } } };
  assert.deepEqual(getCommandAdvancementClaimedIds(save), [lieutenant.id]);
  const after = summarizeCommandAdvancement({
    deck,
    campaign,
    completedMissionIds: ['us1','us2','us3'],
    claimedIds: [lieutenant.id],
    career: { rankIndex: 2, reputation: 100, prestige: 16, tonnage: 46000 },
    awardedHonorIds: ['us_honor_navy_comm'],
  });
  assert.equal(after.claimedCount, 1);
  assert.ok(after.combinedEffect.tonnageMultiplier > 1);
  assert.equal(canClaimCommandPromotion({ save, rank: after.ranks.find((item) => item.id === lieutenant.id), summary: after }).reason, 'commandAdvancement.alreadyClaimed');
});

test('all command advancement translation keys exist in PT EN ES', () => {
  const decks = readJson('data/command_advancement.json');
  const required = new Set([
    'commandAdvancement.title','commandAdvancement.heading','commandAdvancement.authorityScore','commandAdvancement.available','commandAdvancement.locked','commandAdvancement.claimed','commandAdvancement.claimPromotion','commandAdvancement.promotionActive','commandAdvancement.rankLevel','commandAdvancement.unavailable','commandAdvancement.alreadyClaimed','commandAdvancement.lockedRank','commandAdvancement.lockedReputation','commandAdvancement.lockedPrestige','commandAdvancement.lockedMissions','commandAdvancement.lockedTonnage','commandAdvancement.lockedHonors','commandAdvancement.lockedIntel','commandAdvancement.lockedChain','commandAdvancement.lockedOutcome','commandAdvancement.historyTitle','commandAdvancement.historyDetail','commandAdvancement.reportTitle','commandAdvancement.reportDetail','toast.commandPromotionClaimed'
  ]);
  decks.forEach((deck) => {
    required.add(deck.titleKey); required.add(deck.summaryKey); required.add(deck.frontKey);
    deck.ranks.forEach((rank) => { required.add(rank.rankKey); required.add(rank.billetKey); required.add(rank.descKey); });
  });
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of required) assert.ok(key in dictionary, `${lang} missing ${key}`);
  }
});
