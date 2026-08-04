import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SensorSystem } from '../js/engine/sensors/SensorSystem.js';
import { WeaponSystem } from '../js/engine/weapons/WeaponSystem.js';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';
import { PHASE53_CREW_PROGRESSION_IMPACT, buildCrewProgressionImpact, applyCrewImpactToMissionReport } from '../js/systems/captainCrewProgressionImpact.js';
import { buildCaptainDelegationAdvisorView } from '../js/systems/captainDelegationAdvisor.js';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const read = (path) => fs.readFileSync(path, 'utf8');

const sampleCrew = [
  { id: 'sonar-a', nation: 'de', name: 'Klaus', roleKey: 'crew.role.sonar', bonusKey: 'crew.bonus.sonar', skill: 86, cost: 900 },
  { id: 'mech-a', nation: 'de', name: 'Otto', roleKey: 'crew.role.mechanic', bonusKey: 'crew.bonus.repair', skill: 82, cost: 760 },
  { id: 'nav-a', nation: 'de', name: 'Erich', roleKey: 'crew.role.navigator', bonusKey: 'crew.bonus.navigation', skill: 78, cost: 700 },
  { id: 'gun-a', nation: 'de', name: 'Hans', roleKey: 'crew.role.officer', bonusKey: 'crew.bonus.torpedoes', skill: 84, cost: 880 },
];

const save = {
  crew: { hiredIds: ['sonar-a', 'mech-a', 'nav-a', 'gun-a'] },
  progression: { credits: 2500, xp: 480, bestScore: 910 },
  logistics: { morale: 86, fatigue: 14, readiness: 82 },
};

function impact() {
  return buildCrewProgressionImpact({
    allCrew: sampleCrew,
    hiredIds: save.crew.hiredIds,
    save,
    crewDrillSummary: { completedCount: 2, combinedEffect: { sonarBonus: 4, engineeringBonus: 3, torpedoBonus: 4, stealthBonus: 2, readinessBonus: 4, moraleBonus: 2, fatigueDelta: -3, tonnageMultiplier: 1.04 } },
    veteranOfficerSummary: { assignedCount: 1, combinedEffect: { sonarBonus: 2, torpedoBonus: 2, stealthBonus: 2, readinessBonus: 3, tonnageMultiplier: 1.03 } },
  });
}

test('phase 53 metadata upgrades build without changing save schema or removing assets/audio promise', () => {
  const build = readJson('BUILD_INFO.json');
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(PHASE53_CREW_PROGRESSION_IMPACT.phase, 53);
  assert.equal(PHASE53_CREW_PROGRESSION_IMPACT.version, '2.0.0');
  assert.equal(PHASE53_CREW_PROGRESSION_IMPACT.saveSchemaStable, true);
  assert.equal(PHASE53_CREW_PROGRESSION_IMPACT.preservesExistingAssetsAndAudio, true);
  assert.equal(PHASE53_CREW_PROGRESSION_IMPACT.mobileFullscreen, true);
  assert.equal(build.version, '2.2.0');
  assert.equal(build.phase, '56');
  assert.equal(build.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.2.0');
  assert.equal(manifest.version, '2.2.0');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase54_career_retention.py');
});

test('crew hired, drills and officers create real gameplay modifiers', () => {
  const result = impact();
  assert.equal(result.hiredCount, 4);
  assert.ok(result.ratings.sonar > 70);
  assert.ok(result.ratings.engineering > 70);
  assert.ok(result.ratings.weapons > 70);
  assert.ok(result.modifiers.sonarConfidenceBonus > 0);
  assert.ok(result.modifiers.tdcSolutionBonus > 0);
  assert.ok(result.modifiers.repairEfficiencyBonus > 0);
  assert.ok(result.modifiers.stealthNoiseReduction > 0);
  assert.ok(result.modifiers.autoOrderDelayReduction > 0);
  assert.ok(result.modifiers.scoreMultiplier > 1);
  assert.equal(result.recommendation.affordable, true);
});

test('mission report rewards are affected by crew progression without mutating the original score contract', () => {
  const report = applyCrewImpactToMissionReport({ score: 1000, bonusCredits: 120, bonusXp: 35 }, impact());
  assert.equal(report.crewImpactApplied, true);
  assert.equal(report.baseScore, 1000);
  assert.ok(report.score > 1000);
  assert.ok(report.bonusCredits > 120);
  assert.ok(report.bonusXp > 35);
});

test('sensor confidence and weapon solution receive crew modifiers in real engine systems', () => {
  const crewImpact = impact();
  const sensorBase = new SensorSystem({ mission: { targetType: 'merchant' }, difficultyProfile: { sensorConfidenceMultiplier: 1 } });
  const sensorCrew = new SensorSystem({ mission: { targetType: 'merchant' }, difficultyProfile: { sensorConfidenceMultiplier: 1 } });
  const contactContext = { worldTime: 1000, crewImpact, contacts: { target: { x: 100, y: -120 } }, depth: 12, systems: { sonar: 100 }, physics: { noise: 5, cavitation: 0 }, environment: { acousticPropagation: 1, ambientNoise: 8 } };
  sensorBase.observation('target', 'hydrophone', { confidence: 40, signal: 40, bearing: 12, rangeMeters: 1100, bearingUncertainty: 20, rangeUncertainty: .4 }, { ...contactContext, crewImpact: null });
  sensorCrew.observation('target', 'hydrophone', { confidence: 40, signal: 40, bearing: 12, rangeMeters: 1100, bearingUncertainty: 20, rangeUncertainty: .4 }, contactContext);
  assert.ok(sensorCrew.snapshot().contacts.target.confidence > sensorBase.snapshot().contacts.target.confidence);

  const baseWeapons = new WeaponSystem({ mission: { id: 'm', year: 1942, targetSpeedKnots: 8 } });
  const crewWeapons = new WeaponSystem({ mission: { id: 'm', year: 1942, targetSpeedKnots: 8 } });
  const context = {
    worldTime: 2000,
    crewImpact,
    systems: { weapons: 100 },
    navigation: { heading: 0 },
    escortState: 'patrol',
    contacts: { target: { x: 80, y: -180, destroyed: false } },
    sensors: { contacts: { target: { detected: true, confidence: 70, bearing: 20, rangeMeters: 880, rangeKnown: true, source: 'hydrophone', bearingUncertainty: 12, rangeUncertainty: .2, stale: false, ageMs: 0 } } },
  };
  const baseQuality = baseWeapons.updateSolution({ ...context, crewImpact: null });
  const crewQuality = crewWeapons.updateSolution(context);
  assert.ok(crewQuality > baseQuality);
});

test('simulation snapshot and advisor expose crew impact to automatic/manual captain decisions', () => {
  const crewImpact = impact();
  const engine = new SimulationEngine({ mission: { id: 'phase53', nationId: 'de', targetType: 'merchant' }, submarine: { id: 'de_test', nation: 'de', stats: { torpedoes: 6, stealth: 70, range: 70 } }, crewImpact });
  const snapshot = engine.snapshot();
  assert.equal(snapshot.crewImpact.system, 'captain-crew-progression-impact');
  assert.ok(snapshot.crewImpact.modifiers.autoOrderDelayReduction > 0);
  const view = buildCaptainDelegationAdvisorView({ snapshot, commandMode: 'captain', nation: 'de', crewImpact });
  assert.equal(view.crewImpact.tierKey, crewImpact.tierKey);
  assert.ok(view.crewImpact.automaticConfidence > 58);
  assert.equal(view.preserveAssets, true);
});

test('phase 53 files are wired in gameplay, crew store, css, service worker, smoke and translations', () => {
  const gameplay = read('js/screens/gameplay.js');
  const app = read('js/app.js');
  const crew = read('js/screens/crew.js');
  const index = read('index.html');
  const sw = read('service-worker.js');
  const smoke = read('tests/smoke_test.py');
  const pt = read('data/translations/pt-BR.json');
  const css = read('css/phase53-crew-progression-impact.css');
  assert.match(gameplay, /phase53-crew-impact/);
  assert.match(gameplay, /buildCrewProgressionImpact/);
  assert.match(app, /applyCrewImpactToMissionReport/);
  assert.match(app, /crewProgressionImpact/);
  assert.match(crew, /phase53-crew-store-impact-panel/);
  assert.match(index, /phase53-crew-progression-impact\.css/);
  assert.match(sw, /captainCrewProgressionImpact\.js/);
  assert.match(sw, /phase53-crew-progression-impact\.css/);
  assert.match(smoke, /captainCrewProgressionImpact\.js/);
  assert.match(pt, /crewImpact\.title/);
  assert.match(css, /100dvh/);
});
