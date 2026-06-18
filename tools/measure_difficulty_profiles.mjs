import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';
import { DIFFICULTY_IDS, getDifficultyProfile } from '../js/engine/training/DifficultyProfile.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const missions = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'missions.json'), 'utf8'));
const submarines = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'submarines.json'), 'utf8'));
const submarine = submarines[0];

function runQuiet(mission, difficulty) {
  const engine = new SimulationEngine({ mission, submarine, difficulty });
  engine.stop();
  engine.physics.restore({ ...engine.snapshot().physics, depth: 65, orderedDepth: 65, verticalSpeed: 0, noise: 2, cavitation: 0 });
  engine.player.setDepth(65, 300);
  engine.setSpeed('slow');
  engine.activateSilentRunning();
  for (let i = 0; i < 750; i += 1) engine.step(80);
  const snapshot = engine.snapshot();
  const result = {
    missionId: mission.id,
    difficulty,
    damage: snapshot.metrics.damageTaken,
    detection: Number(snapshot.detectionScore.toFixed(2)),
    patterns: snapshot.navalAI.metrics.patternsDropped,
    hull: snapshot.hull,
  };
  engine.dispose();
  return result;
}

function runExposed(mission, difficulty) {
  const engine = new SimulationEngine({ mission, submarine, difficulty });
  engine.stop();
  engine.physics.restore({ ...engine.snapshot().physics, depth: 5, orderedDepth: 5, verticalSpeed: 0, noise: 4, cavitation: 0 });
  engine.player.setDepth(5, 300);
  engine.setSpeed('flank');
  engine.openPeriscope();
  const result = { difficulty, alertAtSeconds: null, huntAtSeconds: null, firstDamageAtSeconds: null, firstDamageAmount: null };
  for (let i = 0; i < 2250; i += 1) {
    engine.step(80);
    const snapshot = engine.snapshot();
    const seconds = Number(((i + 1) * 0.08).toFixed(2));
    if (result.alertAtSeconds === null && snapshot.escortState === 'alert') result.alertAtSeconds = seconds;
    if (result.huntAtSeconds === null && snapshot.escortState === 'hunt') result.huntAtSeconds = seconds;
    if (result.firstDamageAtSeconds === null && snapshot.metrics.damageTaken > 0) {
      result.firstDamageAtSeconds = seconds;
      result.firstDamageAmount = snapshot.metrics.damageTaken;
      break;
    }
  }
  const final = engine.snapshot();
  Object.assign(result, { finalDetection: Number(final.detectionScore.toFixed(2)), finalHull: final.hull, patterns: final.navalAI.metrics.patternsDropped });
  engine.dispose();
  return result;
}

function runResource(difficulty) {
  const engine = new SimulationEngine({ mission: missions[0], submarine, difficulty });
  engine.stop();
  engine.physics.restore({ ...engine.snapshot().physics, depth: 70, orderedDepth: 70, battery: 100, oxygen: 100, co2: 0 });
  engine.player.setDepth(70, 300);
  engine.setSpeed('full');
  for (let i = 0; i < 450; i += 1) engine.step(8000);
  const physics = engine.snapshot().physics;
  const result = { difficulty, battery: Number(physics.battery.toFixed(3)), oxygen: Number(physics.oxygen.toFixed(3)), co2: Number(physics.co2.toFixed(3)) };
  engine.dispose();
  return result;
}

const quiet = DIFFICULTY_IDS.flatMap((difficulty) => missions.map((mission) => runQuiet(mission, difficulty)));
const exposed = DIFFICULTY_IDS.map((difficulty) => runExposed(missions[0], difficulty));
const resources = DIFFICULTY_IDS.map(runResource);
const profiles = DIFFICULTY_IDS.map((id) => getDifficultyProfile(id));
const byId = Object.fromEntries(exposed.map((item) => [item.difficulty, item]));
const resById = Object.fromEntries(resources.map((item) => [item.difficulty, item]));

const assertions = {
  allProfilesPresent: DIFFICULTY_IDS.length === 4,
  allMissionsQuietSafeForSixtySeconds: quiet.every((item) => item.damage === 0 && item.patterns === 0 && item.hull === 100),
  noInstantAlertOnAnyProfile: exposed.every((item) => item.alertAtSeconds >= 15),
  noInstantDamageOnAnyProfile: exposed.every((item) => item.firstDamageAtSeconds === null || item.firstDamageAtSeconds >= 120),
  exposedRiskOrdersByDifficulty:
    byId.cadet.alertAtSeconds > byId.officer.alertAtSeconds &&
    byId.officer.alertAtSeconds > byId.simulator.alertAtSeconds &&
    byId.simulator.alertAtSeconds > byId.hardcore.alertAtSeconds &&
    byId.cadet.huntAtSeconds > byId.officer.huntAtSeconds &&
    byId.officer.huntAtSeconds > byId.simulator.huntAtSeconds &&
    byId.simulator.huntAtSeconds > byId.hardcore.huntAtSeconds &&
    byId.cadet.patterns <= byId.officer.patterns &&
    byId.officer.patterns <= byId.simulator.patterns &&
    byId.simulator.patterns <= byId.hardcore.patterns,
  resourceBurdenOrdersByDifficulty:
    resById.cadet.battery > resById.officer.battery &&
    resById.officer.battery > resById.simulator.battery &&
    resById.simulator.battery > resById.hardcore.battery,
  profileMultipliersOrdered:
    profiles[0].enemyDetectionMultiplier < profiles[1].enemyDetectionMultiplier &&
    profiles[1].enemyDetectionMultiplier < profiles[2].enemyDetectionMultiplier &&
    profiles[2].enemyDetectionMultiplier < profiles[3].enemyDetectionMultiplier,
};
const passed = Object.values(assertions).every(Boolean);
const output = {
  generatedAt: new Date().toISOString(),
  phase: '11',
  passed,
  assertions,
  profiles,
  quiet,
  exposed,
  resources,
};
const reportPath = path.join(ROOT, 'reports', 'phase11_difficulty_telemetry.json');
fs.writeFileSync(reportPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`DIFFICULTY TELEMETRY ${passed ? 'PASS' : 'FAIL'}: quiet ${quiet.length}/${quiet.length}, exposed ${exposed.map((x) => `${x.difficulty}:${x.firstDamageAtSeconds}s`).join(', ')}`);
if (!passed) {
  console.error(JSON.stringify(assertions, null, 2));
  process.exit(1);
}
