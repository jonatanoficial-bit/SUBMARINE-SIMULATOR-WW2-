import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const missions = readJson('data/missions.json');
const campaigns = readJson('data/campaigns.json');
const nations = readJson('data/nations.json');
const translations = ['pt-BR','en','es'].map((lang)=>readJson(`data/translations/${lang}.json`));

function statusAfterCompletion(nationId, completedIds) {
  const campaign = campaigns.find((item) => item.nationId === nationId);
  return campaign.missionIds.map((id, index) => {
    const previous = campaign.missionIds[index - 1];
    return { id, available: index === 0 || completedIds.has(id) || completedIds.has(previous) };
  });
}

test('each nation has one independent campaign with eight ordered missions', () => {
  assert.equal(campaigns.length, 3);
  for (const nation of nations) {
    const campaign = campaigns.find((item) => item.nationId === nation.id);
    assert.ok(campaign, `missing campaign for ${nation.id}`);
    assert.equal(campaign.missionIds.length, 8);
    assert.ok(campaign.frontKey && campaign.toneKey, `missing front/tone for ${nation.id}`);
    assert.equal(campaign.timeline.length, 4, `timeline for ${nation.id}`);
    assert.equal(campaign.chapters.length, 4, `chapters for ${nation.id}`);
    assert.ok(campaign.chapters.every((chapter) => chapter.missionIds.length === 2));
    const nationMissions = missions.filter((mission) => mission.nationId === nation.id);
    assert.deepEqual(nationMissions.map((mission) => mission.id), campaign.missionIds);
    assert.equal(nationMissions[0].status, 'available');
    assert.ok(nationMissions.slice(1).every((mission) => mission.status === 'locked'));
  }
});

test('missions carry campaign metadata, briefing keys and valid navigation', () => {
  for (const mission of missions) {
    assert.ok(campaigns.some((campaign) => campaign.id === mission.campaignId && campaign.nationId === mission.nationId));
    assert.ok(Number.isInteger(mission.campaignOrder));
    assert.ok(mission.baseKey && mission.strategicGoalKey && mission.enemyKey && mission.chronologyKey && mission.doctrineKey);
    assert.ok(Array.isArray(mission.objectiveKeys) && mission.objectiveKeys.includes('briefing.objectiveEvade'));
    const nav = mission.navigation;
    assert.ok(nav.mapBounds.north > nav.mapBounds.south);
    assert.ok(nav.mapBounds.east > nav.mapBounds.west);
    assert.ok(nav.route.length >= 3 && nav.route.length <= 8);
    for (const wp of [nav.origin, ...nav.route]) {
      assert.ok(wp.lat <= nav.mapBounds.north && wp.lat >= nav.mapBounds.south, mission.id);
      assert.ok(wp.lon <= nav.mapBounds.east && wp.lon >= nav.mapBounds.west, mission.id);
    }
  }
});

test('campaign progression unlocks only within the same nation', () => {
  const completed = new Set(['de1']);
  assert.equal(statusAfterCompletion('de', completed)[1].available, true);
  assert.equal(statusAfterCompletion('uk', completed)[1].available, false);
  assert.equal(statusAfterCompletion('us', completed)[1].available, false);
});

test('all campaign and mission keys are translated in three languages', () => {
  const keys = new Set();
  for (const campaign of campaigns) {
    for (const field of ['titleKey','summaryKey','baseKey','chronologyKey','doctrineKey','strategicGoalKey','enemyKey','frontKey','toneKey']) keys.add(campaign[field]);
    for (const item of campaign.timeline || []) keys.add(item.labelKey);
    for (const chapter of campaign.chapters || []) keys.add(chapter.titleKey);
  }
  for (const mission of missions) {
    for (const field of ['titleKey','summaryKey','theatreKey','operationKey','historicalNoteKey','baseKey','strategicGoalKey','enemyKey','chronologyKey','doctrineKey']) keys.add(mission[field]);
    for (const key of mission.objectiveKeys) keys.add(key);
    keys.add(mission.navigation.patrolSector.labelKey);
  }
  for (const dictionary of translations) {
    const missing = [...keys].filter((key) => !dictionary[key]);
    assert.deepEqual(missing, []);
  }
});


test('campaign screen can preview all nations without launching wrong-nation missions', () => {
  const appSource = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const screenSource = fs.readFileSync(path.join(ROOT, 'js/screens/campaign.js'), 'utf8');
  assert.match(appSource, /selectedCampaignNationId/);
  assert.match(appSource, /select-campaign-nation/);
  assert.match(appSource, /getCampaignViewNationId\(\) !== getCurrentNationId\(\)/);
  assert.match(screenSource, /campaign-nation-tabs/);
  assert.match(screenSource, /campaign\.launchBlockedNation/);
});
