import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCampaignConsequenceDeck, calculateConsequenceEffect, findCampaignConsequenceForNation } from '../js/systems/campaignConsequences.js';
import { BUILD_INFO } from '../js/build.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('phase 14 metadata identifies strategic campaign consequence build', () => {
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.61');
  assert.equal(BUILD_INFO.phase, '46');
  assert.match(BUILD_INFO.buildId, /F46-CAPTAIN-ORDER-DOCTRINE/);
});

test('campaign consequences cover every independent campaign nation', () => {
  const nations = readJson('data/nations.json');
  const consequences = readJson('data/campaign_consequences.json');
  assert.deepEqual(new Set(consequences.map((item) => item.nationId)), new Set(nations.map((item) => item.id)));
  for (const consequence of consequences) {
    assert.equal(consequence.tracks.length, 4);
    assert.equal(consequence.milestones.length, 4);
    consequence.tracks.forEach((track) => {
      assert.ok(track.labelKey.startsWith('campaignConsequences.track.'));
      assert.ok(Number.isFinite(track.base));
      assert.ok(Number.isFinite(track.perMission));
      assert.ok(Number.isFinite(track.perObjective));
    });
  }
});

test('consequence deck progresses deterministically with missions and objectives', () => {
  const consequences = readJson('data/campaign_consequences.json');
  const campaigns = readJson('data/campaigns.json');
  const objectives = readJson('data/campaign_objectives.json');
  const de = findCampaignConsequenceForNation(consequences, 'de');
  const campaign = campaigns.find((item) => item.nationId === 'de');
  const objectiveSet = objectives.find((item) => item.nationId === 'de');
  const initial = buildCampaignConsequenceDeck({ consequence: de, campaign, objectiveSet, completedMissionIds: [], claimedRewardIds: [] });
  const advanced = buildCampaignConsequenceDeck({ consequence: de, campaign, objectiveSet, completedMissionIds: ['de1','de2','de3','de4'], claimedRewardIds: ['de_obj_atlantic_opening','de_obj_happy_time'] });
  assert.equal(initial.missionProgress.completed, 0);
  assert.equal(advanced.missionProgress.completed, 4);
  assert.equal(advanced.objectiveProgress.completed, 2);
  assert.ok(advanced.tracks.find((track) => track.id === 'convoyDisruption').value > initial.tracks.find((track) => track.id === 'convoyDisruption').value);
  assert.ok(advanced.effect.riskDelta >= initial.effect.riskDelta);
  assert.ok(advanced.effect.tonnageMultiplier >= initial.effect.tonnageMultiplier);
});

test('all consequence translation keys exist in PT EN ES', () => {
  const consequences = readJson('data/campaign_consequences.json');
  const required = new Set(['campaignConsequences.title','campaignConsequences.strategyPanel','campaignConsequences.front','campaignConsequences.risk']);
  consequences.forEach((consequence) => {
    required.add(consequence.titleKey);
    required.add(consequence.summaryKey);
    required.add(consequence.frontKey);
    consequence.tracks.forEach((track) => required.add(track.labelKey));
    consequence.milestones.forEach((milestone) => { required.add(milestone.titleKey); required.add(milestone.descKey); });
  });
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of required) assert.ok(key in dictionary, `${lang} missing ${key}`);
  }
});
