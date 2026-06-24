import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialSave, migrateSave } from '../js/save.js';
import { buildCampaignObjectiveDeck, findCampaignObjectivesForNation, getNewlyCompletedObjectiveRewards } from '../js/systems/campaignObjectives.js';

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const nations = readJson('../data/nations.json');
const campaigns = readJson('../data/campaigns.json');
const missions = readJson('../data/missions.json');
const objectives = readJson('../data/campaign_objectives.json');
const dictionaries = ['pt-BR', 'en', 'es'].map((lang) => readJson(`../data/translations/${lang}.json`));

test('phase 13 campaign objectives cover Germany, United Kingdom and United States', () => {
  assert.equal(objectives.length, nations.length);
  assert.deepEqual(new Set(objectives.map((item) => item.nationId)), new Set(nations.map((item) => item.id)));
  for (const objectiveSet of objectives) {
    assert.equal(objectiveSet.objectives.length, 4);
    const campaign = campaigns.find((item) => item.nationId === objectiveSet.nationId);
    const campaignMissionIds = new Set(campaign.missionIds);
    for (const objective of objectiveSet.objectives) {
      assert.ok(objective.missionIds.length >= 1);
      objective.missionIds.forEach((missionId) => assert.ok(campaignMissionIds.has(missionId), `${objective.id} wrong mission ${missionId}`));
      for (const key of ['credits', 'xp', 'commandPoints', 'reputation', 'prestige', 'intel', 'pressureRelief']) {
        assert.equal(typeof objective.reward[key], 'number', `${objective.id} reward ${key}`);
      }
    }
  }
});

test('objective deck resolves progress and claimed rewards deterministically', () => {
  const deSet = findCampaignObjectivesForNation(objectives, 'de');
  const deck = buildCampaignObjectiveDeck(deSet, ['de1', 'de2', 'de3'], ['de_obj_atlantic_opening']);
  assert.equal(deck.total, 4);
  assert.equal(deck.completed, 1);
  assert.equal(deck.claimed, 1);
  assert.equal(deck.objectives[0].progress.completed, true);
  assert.equal(deck.objectives[0].claimed, true);
  assert.equal(deck.objectives[1].progress.done, 1);
  assert.equal(deck.objectives[1].progress.percent, 50);
});

test('new objective rewards trigger once and never duplicate on replay', () => {
  const ukSet = findCampaignObjectivesForNation(objectives, 'uk');
  const first = getNewlyCompletedObjectiveRewards(ukSet, ['uk1'], ['uk1', 'uk2'], []);
  assert.equal(first.length, 1);
  assert.equal(first[0].id, 'uk_obj_mediterranean_entry');
  const replay = getNewlyCompletedObjectiveRewards(ukSet, ['uk1', 'uk2'], ['uk1', 'uk2'], ['uk_obj_mediterranean_entry']);
  assert.equal(replay.length, 0);
});

test('save schema tracks campaign objective rewards for anti-duplication', () => {
  const save = createInitialSave({
    commander: { name: 'Vale', nationId: 'us', avatar: 'assets/avatars/us/captain_01.png', createdBuild: 'test' },
    starterSubmarineId: 'us-gato',
    credits: 5000,
  });
  assert.deepEqual(save.progression.campaignObjectiveRewards, []);
  const migrated = migrateSave({ ...save, progression: { ...save.progression, campaignObjectiveRewards: ['us_obj_pearl_response'] } });
  assert.deepEqual(migrated.progression.campaignObjectiveRewards, ['us_obj_pearl_response']);
  assert.equal(migrated.meta.schemaVersion, 23);
});

test('phase 13 objective translation keys exist in all languages', () => {
  const keys = new Set(['campaignObjectives.title', 'campaignObjectives.reward', 'campaignObjectives.rewardReport']);
  for (const objectiveSet of objectives) {
    keys.add(objectiveSet.titleKey);
    keys.add(objectiveSet.summaryKey);
    for (const objective of objectiveSet.objectives) {
      keys.add(objective.titleKey);
      keys.add(objective.descKey);
      keys.add(objective.effectKey);
    }
  }
  for (const dictionary of dictionaries) {
    for (const key of keys) assert.ok(key in dictionary, key);
  }
  assert.equal(new Set(dictionaries.map((d) => Object.keys(d).length)).size, 1);
});
