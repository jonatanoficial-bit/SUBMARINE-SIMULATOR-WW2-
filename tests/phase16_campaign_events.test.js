import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_INFO } from '../js/build.js';
import {
  canAcknowledgeCampaignEvent,
  findCampaignEventDeckForNation,
  getCampaignEventAcknowledgedIds,
  summarizeCampaignEvents,
} from '../js/systems/campaignEvents.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('phase 16 metadata identifies dynamic war events build', () => {
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.60');
  assert.equal(BUILD_INFO.phase, '45');
  assert.equal(BUILD_INFO.saveSchemaVersion, 39);
  assert.match(BUILD_INFO.buildId, /F45-FLOW-SUBOFFICER-HOTFIX/);
});

test('dynamic event decks cover every campaign nation with validated event definitions', () => {
  const nations = readJson('data/nations.json');
  const decks = readJson('data/campaign_events.json');
  const orderIds = new Set(readJson('data/high_command_orders.json').flatMap((deck) => deck.orders.map((order) => order.id)));
  assert.deepEqual(new Set(decks.map((item) => item.nationId)), new Set(nations.map((item) => item.id)));
  for (const deck of decks) {
    assert.equal(deck.events.length, 5);
    for (const event of deck.events) {
      assert.ok(event.nameKey.startsWith('campaignEvents.'));
      assert.ok(event.descKey.startsWith('campaignEvents.'));
      assert.ok(['opportunity', 'warning', 'danger', 'crisis'].includes(event.severity));
      if (event.trigger.activeOrderId) assert.ok(orderIds.has(event.trigger.activeOrderId));
      ['intelBonus','decryptionBonus','pressureDelta','riskDelta','readinessBonus','tonnageMultiplier','moraleDelta','fatigueDelta'].forEach((key) => {
        assert.ok(Number.isFinite(event.effect[key]), `${event.id} missing ${key}`);
      });
    }
  }
});

test('dynamic event summary activates by progress, pressure and high command orders', () => {
  const decks = readJson('data/campaign_events.json');
  const campaigns = readJson('data/campaigns.json');
  const deck = findCampaignEventDeckForNation(decks, 'de');
  const campaign = campaigns.find((item) => item.nationId === 'de');
  const initial = summarizeCampaignEvents({
    deck,
    campaign,
    completedMissionIds: [],
    strategySnapshot: { intelLevel: 54, decryption: 18, pressure: 62 },
    activeOrderIds: [],
    acknowledgedIds: [],
  });
  assert.ok(initial.activeEvents.some((event) => event.id === 'de_happy_time_window'));
  assert.ok(initial.combinedEffect.tonnageMultiplier > 1);

  const advanced = summarizeCampaignEvents({
    deck,
    campaign,
    completedMissionIds: ['de1','de2','de3','de4'],
    strategySnapshot: { intelLevel: 70, decryption: 30, pressure: 72 },
    activeOrderIds: ['de_b_dienst_push'],
    acknowledgedIds: ['de_happy_time_window'],
  });
  assert.ok(advanced.activeEvents.some((event) => event.id === 'de_bdienst_breakthrough'));
  assert.ok(advanced.activeEvents.some((event) => event.id === 'de_escort_carrier_response'));
  assert.ok(advanced.combinedEffect.riskDelta > initial.combinedEffect.riskDelta);
  assert.equal(advanced.events.find((event) => event.id === 'de_happy_time_window').acknowledged, true);
});

test('campaign event acknowledgement gate prevents duplicate and inactive records', () => {
  const deck = findCampaignEventDeckForNation(readJson('data/campaign_events.json'), 'us');
  const campaign = readJson('data/campaigns.json').find((item) => item.nationId === 'us');
  const summary = summarizeCampaignEvents({
    deck,
    campaign,
    completedMissionIds: [],
    strategySnapshot: { intelLevel: 64, decryption: 22, pressure: 54 },
    activeOrderIds: [],
    acknowledgedIds: [],
  });
  const active = summary.events.find((event) => event.id === 'us_torpedo_crisis');
  const inactive = summary.events.find((event) => event.id === 'us_forward_tenders');
  const save = { strategy: { campaignEvents: { acknowledgedIds: [], currentIds: [], history: [] } } };
  assert.equal(canAcknowledgeCampaignEvent({ save, event: active }).ok, true);
  assert.equal(canAcknowledgeCampaignEvent({ save, event: inactive }).reason, 'campaignEvents.inactive');
  save.strategy.campaignEvents.acknowledgedIds.push(active.id);
  assert.equal(canAcknowledgeCampaignEvent({ save, event: active }).reason, 'campaignEvents.alreadyAcknowledged');
  assert.deepEqual(getCampaignEventAcknowledgedIds(save), [active.id]);
});

test('all campaign event translation keys exist in PT EN ES', () => {
  const decks = readJson('data/campaign_events.json');
  const required = new Set([
    'campaignEvents.title','campaignEvents.heading','campaignEvents.volatility','campaignEvents.noActive',
    'campaignEvents.acknowledge','campaignEvents.acknowledged','campaignEvents.unavailable',
    'campaignEvents.alreadyAcknowledged','campaignEvents.inactive','toast.campaignEventAcknowledged',
    'campaignEvents.historyTitle','campaignEvents.historyDetail','campaignEvents.reportTitle','campaignEvents.reportDetail',
    'campaignEvents.severity.opportunity','campaignEvents.severity.warning','campaignEvents.severity.danger','campaignEvents.severity.crisis'
  ]);
  decks.forEach((deck) => {
    required.add(deck.titleKey);
    required.add(deck.summaryKey);
    deck.events.forEach((event) => { required.add(event.nameKey); required.add(event.descKey); });
  });
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of required) assert.ok(key in dictionary, `${lang} missing ${key}`);
  }
});
