import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE44_STORY_CAMPAIGN_DIRECTOR, buildStoryCampaignFlow, renderStoryCampaignPanel } from '../js/systems/storyCampaignDirector.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

const missions = Array.from({ length: 8 }, (_, index) => ({
  id: `mission-${index + 1}`,
  campaignOrder: index + 1,
  status: index <= 2 ? 'available' : 'locked',
  titleKey: `mission.${index + 1}.title`,
  summaryKey: `mission.${index + 1}.summary`,
  operationKey: 'mission.operation.convoy',
  theatreKey: 'mission.theatre.convoy',
  year: '1943',
}));

test('phase 44 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.61');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.61');
  assert.equal(BUILD_INFO.phase, '46');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.61');
  assert.equal(manifest.version, '2.0.0-alpha.61');
  assert.equal(PHASE44_STORY_CAMPAIGN_DIRECTOR.system, 'story-campaign-director');
  assert.ok(PHASE44_STORY_CAMPAIGN_DIRECTOR.layers.includes('mission-rail'));
});

test('story campaign flow resolves acts, next operation and rail states', () => {
  const flow = buildStoryCampaignFlow({ campaign: { id: 'campaign.de' }, missions, progress: { completed: 3, total: 8 }, completedMissions: ['mission-1', 'mission-2', 'mission-3'], selectedMission: missions[3] });
  assert.equal(flow.phase, '44');
  assert.equal(flow.act.id, 'act2');
  assert.equal(flow.nextMission.id, 'mission-4');
  assert.equal(flow.rail.length, 8);
  assert.equal(flow.rail[0].state, 'completed');
  assert.equal(flow.rail[3].state, 'active');
  assert.match(flow.directiveKey, /storyCampaign\.directive/);
});

test('story campaign panel renders subofficer guidance and selectable mission rail', () => {
  const fakeT = (key) => key;
  const flow = buildStoryCampaignFlow({ campaign: { id: 'campaign.de' }, missions, progress: { completed: 0, total: 8 }, selectedMission: missions[0] });
  const html = renderStoryCampaignPanel(fakeT, flow);
  assert.match(html, /phase44-story-campaign-panel/);
  assert.match(html, /assets\/avatars\/de\/officer_01\.png/);
  assert.match(html, /data-action="select-mission"/);
  assert.match(html, /storyCampaign\.nextOperation/);
});

test('phase 44 is wired into campaign index service worker and smoke harness', () => {
  const campaign = readText('js/screens/campaign.js');
  const index = readText('index.html');
  const sw = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(campaign, /storyCampaignDirector/);
  assert.match(campaign, /renderStoryCampaignPanel/);
  assert.match(index, /phase44-story-campaign\.css/);
  assert.match(sw, /storyCampaignDirector\.js/);
  assert.match(smoke, /storyCampaignDirector\.js/);
});

test('translations include story campaign keys in all supported languages', () => {
  for (const lang of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of ['storyCampaign.title', 'storyCampaign.subofficer.initial', 'storyCampaign.directive.firstPatrol', 'storyCampaign.beat.active']) {
      assert.ok(key in dictionary, `${lang} missing ${key}`);
    }
  }
});
