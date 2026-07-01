import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE40_LIVING_CAMPAIGN, buildLivingCampaignFront } from '../js/systems/livingCampaignFront.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

function sampleFront(overrides = {}) {
  return buildLivingCampaignFront({
    campaign: { nationId: 'de', frontKey: 'campaign.front.atlantic' },
    nation: { id: 'de' },
    missions: Array.from({ length: 8 }, (_, index) => ({ id: `m${index + 1}` })),
    progress: { completed: 4, total: 8 },
    consequenceDeck: { effect: { riskDelta: 12 } },
    eventDeck: { volatility: 68, activeEvents: [{ id: 'storm' }, { id: 'escort' }], combinedEffect: { riskDelta: 9, pressureDelta: 12 } },
    specialOperations: { operations: [{ launched: true }, { launched: false }] },
    operationChains: { steps: [{ completed: true }, { completed: true }] },
    operationOutcomes: { outcomes: [{ chosen: true }] },
    operationalHonors: { honors: [{ awarded: true }, { awarded: true }] },
    commandAdvancement: { promotions: [{ claimed: true }] },
    veteranOfficers: { officers: [{ assigned: true }, { assigned: false }] },
    ...overrides,
  });
}

test('phase 40 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.69');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.69');
  assert.equal(BUILD_INFO.phase, '54');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.69');
  assert.equal(manifest.version, '2.0.0-alpha.69');
  assert.equal(PHASE40_LIVING_CAMPAIGN.system, 'living-campaign-war-front');
  assert.ok(PHASE40_LIVING_CAMPAIGN.layers.includes('enemy-adaptation'));
});

test('living campaign front calculates pressure, morale and pulse state', () => {
  const front = sampleFront();
  assert.equal(front.phase, '40');
  assert.equal(front.system, 'living-campaign-war-front');
  assert.equal(front.progressPct, 50);
  assert.ok(front.values.theaterPressure >= 50);
  assert.ok(front.values.enemyAdaptation >= 50);
  assert.ok(front.values.fleetMorale > 50);
  assert.ok(front.cards.length >= 6);
  assert.match(front.cssVars['--phase40-pressure'], /%$/);
});

test('living campaign front reacts to crisis and opportunity conditions', () => {
  const crisis = sampleFront({
    progress: { completed: 7, total: 8 },
    consequenceDeck: { effect: { riskDelta: 30 } },
    eventDeck: { volatility: 100, activeEvents: [{}, {}, {}], combinedEffect: { riskDelta: 24, pressureDelta: 28 } },
    specialOperations: { operations: [] },
    operationChains: { steps: [] },
    operationOutcomes: { outcomes: [] },
  });
  assert.equal(crisis.status.state, 'critical');
  assert.equal(crisis.directiveKey, 'livingCampaign.directiveCrisis');

  const opportunity = sampleFront({
    progress: { completed: 6, total: 8 },
    consequenceDeck: { effect: { riskDelta: -8 } },
    eventDeck: { volatility: 10, activeEvents: [], combinedEffect: { riskDelta: -5, pressureDelta: -5 } },
    specialOperations: { operations: [{ launched: true }, { launched: true }, { launched: true }] },
    operationChains: { steps: [{ completed: true }, { completed: true }, { completed: true }] },
    operationOutcomes: { outcomes: [{ chosen: true }, { chosen: true }] },
    veteranOfficers: { officers: [{ assigned: true }, { assigned: true }] },
  });
  assert.ok(opportunity.values.initiative >= 60);
  assert.ok(['livingCampaign.directiveExploit', 'livingCampaign.directiveHold'].includes(opportunity.directiveKey));
});

test('phase 40 assets are wired into campaign screen, index, service worker and smoke harness', () => {
  const campaign = readText('js/screens/campaign.js');
  const css = readText('css/phase40-living-campaign.css');
  const index = readText('index.html');
  const sw = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(campaign, /buildLivingCampaignFront/);
  assert.match(campaign, /phase40-living-campaign/);
  assert.match(css, /phase40-front-grid/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(index, /phase40-living-campaign\.css/);
  assert.match(sw, /livingCampaignFront\.js/);
  assert.match(smoke, /phase40-living-campaign\.css/);
  assert.match(smoke, /livingCampaignFront\.js/);
});

test('translations include living campaign keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['livingCampaign.kicker', 'livingCampaign.enemyAdaptation', 'livingCampaign.directiveStealth']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
