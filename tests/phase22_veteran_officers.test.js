import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_INFO } from '../js/build.js';
import { findVeteranOfficerDeckForNation, summarizeVeteranOfficers, canAssignVeteranOfficer, getVeteranOfficerAssignedIds } from '../js/systems/veteranOfficers.js';

const decks = JSON.parse(fs.readFileSync(new URL('../data/veteran_officers.json', import.meta.url), 'utf8'));
const campaigns = JSON.parse(fs.readFileSync(new URL('../data/campaigns.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('phase 22 build metadata is synchronized', () => {
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.69');
  assert.equal(BUILD_INFO.phase, '54');
  assert.match(BUILD_INFO.buildId, /F54-CAREER-MORALE-SHOP-RETENTION/);
  assert.equal(pkg.version, '2.0.0-alpha.69');
});

test('veteran officer decks cover all playable nations', () => {
  assert.equal(decks.length, 3);
  for (const nationId of ['de', 'uk', 'us']) {
    const deck = findVeteranOfficerDeckForNation(decks, nationId);
    assert.ok(deck, `missing deck ${nationId}`);
    assert.equal(deck.officers.length, 4);
    assert.equal(new Set(deck.officers.map((officer) => officer.id)).size, 4);
  }
});

test('summary computes locked, available and assigned specialists', () => {
  const deck = findVeteranOfficerDeckForNation(decks, 'de');
  const campaign = campaigns.find((item) => item.nationId === 'de');
  const save = {
    career: { reputation: 90, rankIndex: 2, veteranOfficers: { assignedIds: ['de_veteran_wolfChief'] } },
    progression: { credits: 9000 },
    strategy: { commandPoints: 5 },
  };
  const summary = summarizeVeteranOfficers({ deck, campaign, completedMissionIds: campaign.missionIds.slice(0, 2), assignedIds: getVeteranOfficerAssignedIds(save), career: save.career, awardedHonorIds: ['h1'], claimedPromotionIds: ['p1'] });
  assert.equal(summary.assignedCount, 1);
  assert.ok(summary.availableCount >= 1);
  assert.ok(summary.combinedEffect.sonarBonus > 0);
});

test('assignment rejects duplicate or unaffordable officers', () => {
  const deck = findVeteranOfficerDeckForNation(decks, 'uk');
  const campaign = campaigns.find((item) => item.nationId === 'uk');
  const save = { career: { reputation: 200, rankIndex: 4, veteranOfficers: { assignedIds: ['uk_veteran_asdicsChief'] } }, progression: { credits: 10 }, strategy: { commandPoints: 0 } };
  const summary = summarizeVeteranOfficers({ deck, campaign, completedMissionIds: campaign.missionIds.slice(0, 6), assignedIds: getVeteranOfficerAssignedIds(save), career: save.career, awardedHonorIds: ['h1','h2'], claimedPromotionIds: ['p1','p2'] });
  assert.equal(canAssignVeteranOfficer({ save, officer: summary.officers[0], summary }).reason, 'veteranOfficers.alreadyAssigned');
  assert.equal(canAssignVeteranOfficer({ save, officer: summary.officers[2], summary }).reason, 'veteranOfficers.insufficientResources');
});

test('combined specialist effects influence strategic posture fields', () => {
  const deck = findVeteranOfficerDeckForNation(decks, 'us');
  const campaign = campaigns.find((item) => item.nationId === 'us');
  const summary = summarizeVeteranOfficers({ deck, campaign, completedMissionIds: campaign.missionIds, assignedIds: deck.officers.map((officer) => officer.id), career: { reputation: 250, rankIndex: 5 }, awardedHonorIds: ['a','b','c'], claimedPromotionIds: ['p1','p2','p3'] });
  assert.ok(summary.combinedEffect.intelBonus >= 6);
  assert.ok(summary.combinedEffect.tonnageMultiplier > 1.05);
  assert.ok(summary.combinedEffect.readinessBonus >= 8);
});
