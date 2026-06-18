import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const missions = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/missions.json'), 'utf8'));
const submarine = { id: 'qa-submarine', nation: 'de', stats: { torpedoes: 8, speed: 72, depth: 72, stealth: 70, range: 70 } };

function engineFor(mission) {
  const engine = new SimulationEngine({ mission, submarine });
  engine.stop();
  engine.physics.restore({
    ...engine.snapshot().physics,
    depth: 5,
    orderedDepth: 5,
    verticalSpeed: 0,
    battery: 100,
    oxygen: 100,
    co2: 1,
    noise: 2,
    cavitation: 0,
  });
  engine.player.setDepth(5, 300);
  return engine;
}

function runScenario(mission, scenario, maxSeconds) {
  const engine = engineFor(mission);
  if (scenario === 'periscope') engine.openPeriscope();
  if (scenario === 'flank') engine.setSpeed('flank');
  if (scenario === 'torpedo') {
    engine.target.moveTo(100, 0);
    engine.escort.moveTo(320, 40);
    engine.session.view = { x: 100, y: 0 };
    engine.openPeriscope();
    engine.syncTdcSolution();
    engine.setSalvoSize(1);
    engine.fireTorpedo();
  }
  let alert = null;
  let hunt = null;
  let damage = null;
  let failure = null;
  const steps = Math.ceil(maxSeconds * 1000 / 80);
  for (let index = 0; index < steps; index += 1) {
    engine.step(80);
    const snapshot = engine.snapshot();
    const seconds = Number(((index + 1) * 0.08).toFixed(2));
    if (alert === null && snapshot.detectionScore >= 28) alert = seconds;
    if (hunt === null && snapshot.navalAI.globalState === 'hunt') hunt = seconds;
    if (damage === null && snapshot.metrics.damageTaken > 0) damage = seconds;
    if (failure === null && snapshot.missionFailed) {
      failure = seconds;
      break;
    }
  }
  const end = engine.snapshot();
  const result = {
    alertSeconds: alert,
    huntSeconds: hunt,
    firstDamageSeconds: damage,
    failureSeconds: failure,
    hull: Math.round(end.hull),
    detection: Number(end.detectionScore.toFixed(2)),
    patterns: end.navalAI.metrics.patternsDropped,
  };
  engine.dispose();
  return result;
}

const rows = missions.map((mission) => ({
  missionId: mission.id,
  difficulty: mission.difficulty,
  quiet60: runScenario(mission, 'quiet', 60),
  periscope120: runScenario(mission, 'periscope', 120),
  torpedo90: runScenario(mission, 'torpedo', 90),
}));

const summary = {
  missionCount: rows.length,
  quietMissionsWithoutDamage: rows.filter((row) => row.quiet60.firstDamageSeconds === null).length,
  minimumPeriscopeDamageSeconds: Math.min(...rows.map((row) => row.periscope120.firstDamageSeconds ?? 999)),
  minimumTorpedoDamageSeconds: Math.min(...rows.map((row) => row.torpedo90.firstDamageSeconds ?? 999)),
  missionsFailedWithin90SecondsAfterTorpedo: rows.filter((row) => row.torpedo90.failureSeconds !== null).length,
};

const report = { generatedAt: new Date().toISOString(), summary, missions: rows };
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'phase10_1_balance_telemetry.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
for (const row of rows) {
  console.log(`${row.missionId.padEnd(4)} quietDamage=${String(row.quiet60.firstDamageSeconds).padEnd(5)} periscopeDamage=${String(row.periscope120.firstDamageSeconds).padEnd(6)} torpedoDamage=${String(row.torpedo90.firstDamageSeconds).padEnd(6)} torpedoFail=${row.torpedo90.failureSeconds}`);
}
