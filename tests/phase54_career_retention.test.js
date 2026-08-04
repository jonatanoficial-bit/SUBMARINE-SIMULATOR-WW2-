import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PHASE54_CAREER_RETENTION,
  buildCareerRetentionDeck,
  calculateMissionMoraleOutcome,
  applyRetentionAccuracyModifiers,
  evaluateCareerGate,
} from '../js/systems/captainCareerRetention.js';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const read = (path) => fs.readFileSync(path, 'utf8');

const save = {
  crew: { hiredIds: ['rookie'] },
  progression: { level: 6, credits: 5200, completedMissions: ['m1','m2','m3','m4','m5','m6'], bestScore: 880 },
  logistics: { morale: 79, fatigue: 18, readiness: 82 },
  career: { victories: 6, reputation: 280, prestige: 40, failedPatrols: 0 },
  submarine: { unlockedIds: ['starter'], currentId: 'starter' },
};

const crew = [
  { id: 'rookie', nation: 'de', name: 'Rookie', roleKey: 'crew.role.sonar', bonusKey: 'crew.bonus.sonar', skill: 68, cost: 500, tier: 'rookie' },
  { id: 'veteran', nation: 'de', name: 'Veteran', roleKey: 'crew.role.mechanic', bonusKey: 'crew.bonus.repair', skill: 86, cost: 1400, tier: 'veteran', requires: { victories: 3, moraleMin: 60, reputationMin: 80, level: 3 } },
  { id: 'legend', nation: 'de', name: 'Legend', roleKey: 'crew.role.executive', bonusKey: 'crew.bonus.command', skill: 98, cost: 6000, tier: 'legendary', requires: { victories: 18, moraleMin: 88, reputationMin: 900, bestScoreMin: 950, level: 12 } },
];
const submarines = [
  { id: 'starter', nation: 'de', name: 'Starter', unlocked: true, levelRequired: 1, stats: { speed: 60, range: 60, stealth: 60, depth: 60, torpedoes: 6 } },
  { id: 'elite-sub', nation: 'de', name: 'Elite', unlocked: false, levelRequired: 7, unlockCost: 7000, stats: { speed: 80, range: 80, stealth: 80, depth: 80, torpedoes: 10 }, requires: { victories: 8, moraleMin: 74, reputationMin: 360, level: 7 } },
];

test('phase 54 metadata keeps save schema and asset/audio preservation guarantees', () => {
  const build = readJson('BUILD_INFO.json');
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(PHASE54_CAREER_RETENTION.phase, 54);
  assert.equal(PHASE54_CAREER_RETENTION.version, '2.0.0');
  assert.equal(PHASE54_CAREER_RETENTION.saveSchemaStable, true);
  assert.equal(PHASE54_CAREER_RETENTION.preservesExistingAssetsAndAudio, true);
  assert.equal(build.version, '2.2.0');
  assert.equal(build.phase, '56');
  assert.equal(build.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.2.0');
  assert.equal(manifest.version, '2.2.0');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase54_career_retention.py');
});

test('career retention deck gates crew and submarines by victories, morale, reputation and level', () => {
  const deck = buildCareerRetentionDeck({ allCrew: crew, submarines, save, nationId: 'de', crewImpact: { tierKey: 'crewImpact.tier.ready' } });
  assert.equal(deck.system, 'captain-career-retention');
  assert.equal(deck.moraleKey, 'careerRetention.morale.high');
  assert.equal(deck.crewShopById.veteran.canBuy, true);
  assert.equal(deck.crewShopById.legend.unlocked, false);
  assert.equal(deck.crewShopById.legend.lockKey, 'careerRetention.lock.level');
  assert.equal(deck.submarineMarketById['elite-sub'].unlocked, false);
  assert.ok(deck.lifetimeGoals.length >= 4);
  assert.ok(deck.freeModes.some((mode) => mode.id === 'free-hunt' && mode.unlocked));
});

test('mission result changes morale based on correct victory, hull survival and stealth', () => {
  const heroic = calculateMissionMoraleOutcome({ mission: { difficulty: 'IV' }, report: { score: 1020, hull: 96, stealth: 84, shots: 1 } });
  assert.ok(heroic.moraleDelta >= 10);
  assert.ok(heroic.fatigueDelta < 0);
  assert.equal(heroic.labelKey, 'careerRetention.afterAction.heroic');
  const bad = calculateMissionMoraleOutcome({ mission: { difficulty: 'II' }, report: { score: 360, hull: 42, stealth: 30, shots: 4 } });
  assert.ok(bad.moraleDelta < 0);
  assert.ok(bad.fatigueDelta > 0);
  assert.equal(bad.labelKey, 'careerRetention.afterAction.bad');
});

test('morale retention adjusts real gameplay accuracy and score multiplier', () => {
  const impact = { modifiers: { sonarConfidenceBonus: 4, tdcSolutionBonus: 3, repairEfficiencyBonus: 2, stealthNoiseReduction: 2, autoOrderDelayReduction: 4, scoreMultiplier: 1.05 } };
  const high = buildCareerRetentionDeck({ allCrew: crew, submarines, save, nationId: 'de' });
  const boosted = applyRetentionAccuracyModifiers(impact, high);
  assert.equal(boosted.retentionApplied, true);
  assert.ok(boosted.modifiers.sonarConfidenceBonus > impact.modifiers.sonarConfidenceBonus);
  assert.ok(boosted.modifiers.tdcSolutionBonus > impact.modifiers.tdcSolutionBonus);
  assert.ok(boosted.modifiers.scoreMultiplier > impact.modifiers.scoreMultiplier);
  const lowSave = { ...save, logistics: { morale: 35, fatigue: 60, readiness: 40 } };
  const low = buildCareerRetentionDeck({ allCrew: crew, submarines, save: lowSave, nationId: 'de' });
  const penalized = applyRetentionAccuracyModifiers(impact, low);
  assert.ok(penalized.modifiers.tdcSolutionBonus < impact.modifiers.tdcSolutionBonus);
});

test('acquisition gate blocks unaffordable or unproven legendary crew', () => {
  const gate = evaluateCareerGate(crew[2], save, 'crew');
  assert.equal(gate.ok, false);
  assert.equal(gate.reasonKey, 'careerRetention.lock.level');
  const proven = { ...save, progression: { ...save.progression, level: 13, bestScore: 1000 }, logistics: { ...save.logistics, morale: 90 }, career: { ...save.career, victories: 22, reputation: 1000 } };
  assert.equal(evaluateCareerGate(crew[2], proven, 'crew').ok, true);
});

test('phase 54 is wired into app, crew shop, arsenal, CSS, service worker, smoke and translations', () => {
  const app = read('js/app.js');
  const crewScreen = read('js/screens/crew.js');
  const arsenal = read('js/screens/arsenal.js');
  const index = read('index.html');
  const sw = read('service-worker.js');
  const smoke = read('tests/smoke_test.py');
  const pt = read('data/translations/pt-BR.json');
  const css = read('css/phase54-career-retention.css');
  const crewData = readJson('data/crew.json');
  const submarineData = readJson('data/submarines.json');
  assert.match(app, /buildCareerRetentionDeck/);
  assert.match(app, /calculateMissionMoraleOutcome/);
  assert.match(app, /evaluateCareerGate/);
  assert.match(crewScreen, /phase54-career-retention-panel/);
  assert.match(arsenal, /arsenalRetentionMarkup/);
  assert.match(index, /phase54-career-retention\.css/);
  assert.match(sw, /captainCareerRetention\.js/);
  assert.match(smoke, /phase54-career-retention\.css/);
  assert.match(pt, /careerRetention\.title/);
  assert.match(css, /100dvh/);
  assert.ok(crewData.filter((item) => item.nation === 'de').length >= 10);
  assert.ok(submarineData.filter((item) => item.nation === 'de').length >= 4);
});
