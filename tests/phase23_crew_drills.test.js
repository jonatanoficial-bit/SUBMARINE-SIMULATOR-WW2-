import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_INFO } from '../js/build.js';
import { findCrewDrillDeckForNation, summarizeCrewDrills, canRunCrewDrill, getCrewDrillCompletedIds } from '../js/systems/crewDrills.js';

const decks = JSON.parse(fs.readFileSync(new URL('../data/crew_drills.json', import.meta.url), 'utf8'));
const campaigns = JSON.parse(fs.readFileSync(new URL('../data/campaigns.json', import.meta.url), 'utf8'));
const translations = ['pt-BR', 'en', 'es'].map((lang) => JSON.parse(fs.readFileSync(new URL(`../data/translations/${lang}.json`, import.meta.url), 'utf8')));
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('phase 23 build metadata is synchronized', () => {
  assert.equal(BUILD_INFO.version, '2.0.0');
  assert.equal(BUILD_INFO.phase, '54');
  assert.match(BUILD_INFO.buildId, /SCWW2-2\.0\.0-\d{8}-\d{4}-BRT/);
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0');
});

test('crew drill decks cover all playable nations', () => {
  assert.equal(decks.length, 3);
  for (const nationId of ['de', 'uk', 'us']) {
    const deck = findCrewDrillDeckForNation(decks, nationId);
    assert.ok(deck, `missing deck ${nationId}`);
    assert.equal(deck.drills.length, 4);
    assert.equal(new Set(deck.drills.map((drill) => drill.id)).size, 4);
  }
});

test('summary computes completed, available and combined drill effects', () => {
  const deck = findCrewDrillDeckForNation(decks, 'de');
  const campaign = campaigns.find((item) => item.nationId === 'de');
  const save = { career: { crewDrills: { completedIds: ['de_drill_silent_watch'] } } };
  const summary = summarizeCrewDrills({
    deck,
    campaign,
    completedMissionIds: campaign.missionIds.slice(0, 3),
    completedIds: getCrewDrillCompletedIds(save),
    assignedOfficerIds: ['de_veteran_wolfChief','de_veteran_engineRoom'],
    readiness: { readiness: 72 }
  });
  assert.equal(summary.completedCount, 1);
  assert.ok(summary.availableCount >= 1);
  assert.ok(summary.combinedEffect.stealthBonus >= 3);
  assert.ok(summary.disciplineScore > 20);
});

test('drill execution rejects duplicate, locked and unaffordable routines', () => {
  const deck = findCrewDrillDeckForNation(decks, 'uk');
  const campaign = campaigns.find((item) => item.nationId === 'uk');
  const save = { career: { crewDrills: { completedIds: ['uk_drill_asdic_rotation'] } }, progression: { credits: 10 }, strategy: { commandPoints: 0 } };
  const summary = summarizeCrewDrills({
    deck,
    campaign,
    completedMissionIds: campaign.missionIds.slice(0, 3),
    completedIds: getCrewDrillCompletedIds(save),
    assignedOfficerIds: ['uk_veteran_asdicsChief','uk_veteran_dieselArtificer'],
    readiness: { readiness: 72 }
  });
  assert.equal(canRunCrewDrill({ save, drill: summary.drills[0], summary }).reason, 'crewDrills.alreadyCompleted');
  assert.equal(canRunCrewDrill({ save, drill: summary.drills[2], summary }).reason, 'crewDrills.insufficientResources');
  const lockedSummary = summarizeCrewDrills({ deck, campaign, completedMissionIds: [], completedIds: [], assignedOfficerIds: [], readiness: { readiness: 20 } });
  assert.equal(canRunCrewDrill({ save: { career: {}, progression: { credits: 9999 }, strategy: { commandPoints: 5 } }, drill: lockedSummary.drills[1], summary: lockedSummary }).reason, 'crewDrills.lockedMissions');
});

test('completed drills reinforce readiness, stations and strategic posture effects', () => {
  const deck = findCrewDrillDeckForNation(decks, 'us');
  const campaign = campaigns.find((item) => item.nationId === 'us');
  const summary = summarizeCrewDrills({
    deck,
    campaign,
    completedMissionIds: campaign.missionIds,
    completedIds: deck.drills.map((drill) => drill.id),
    assignedOfficerIds: ['a','b','c','d'],
    readiness: { readiness: 90 }
  });
  assert.equal(summary.completedCount, 4);
  assert.ok(summary.combinedEffect.readinessBonus >= 16);
  assert.ok(summary.combinedEffect.torpedoBonus >= 7);
  assert.ok(summary.combinedEffect.tonnageMultiplier > 1.05);
  assert.ok(summary.combinedEffect.riskDelta <= -4);
});

test('phase 23 translation keys are available in all languages', () => {
  const keys = [
    'crewDrills.title','crewDrills.heading','crewDrills.completed','crewDrills.available','crewDrills.locked','crewDrills.run',
    'crewDrills.drillActive','crewDrills.insufficientResources','crewDrills.lockedMissions','crewDrills.lockedOfficers',
    'crewDrills.lockedReadiness','crewDrills.disciplineScore','toast.crewDrillCompleted',
    'crewDrills.de.silentWatch.name','crewDrills.uk.asdicRotation.name','crewDrills.us.tdcAttack.name'
  ];
  for (const dictionary of translations) {
    assert.deepEqual(keys.filter((key) => !dictionary[key]), []);
  }
});
