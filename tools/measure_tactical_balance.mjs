import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const missions = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'missions.json'), 'utf8'));
const submarines = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'submarines.json'), 'utf8'));
const submarine = submarines[0];

function setup(mission, { cautious }) {
  const engine = new SimulationEngine({ mission, submarine });
  engine.stop();
  engine.physics.restore({
    ...engine.snapshot().physics,
    depth: cautious ? 90 : 5,
    orderedDepth: cautious ? 90 : 5,
    verticalSpeed: 0,
    battery: 100,
    oxygen: 100,
    co2: 1,
    noise: cautious ? 2 : 4,
    cavitation: 0,
  });
  engine.player.setDepth(cautious ? 90 : 5, 300);
  engine.setSpeed(cautious ? 'slow' : 'flank');
  if (cautious) engine.activateSilentRunning();
  else engine.openPeriscope();
  engine.session.detectionScore = 38;
  engine.navalAI.notifyTorpedoLaunch([]);
  engine.resolveWeaponShot({ targetRole: 'target', outcome: 'hit' });
  if (cautious) engine.closePeriscope();
  return engine;
}

function runScenario(mission, cautious) {
  const engine = setup(mission, { cautious });
  const result = {
    missionId: mission.id,
    difficulty: mission.difficulty,
    mode: cautious ? 'deep-silent-evasion' : 'surface-exposed-evasion',
    immediateCompletion: engine.snapshot().canComplete,
    searchAtSeconds: null,
    regroupAtSeconds: null,
    formationAtSeconds: null,
    firstDamageAtSeconds: null,
    completionAtSeconds: null,
  };
  const maxSeconds = cautious ? 150 : 150;
  const steps = Math.ceil(maxSeconds * 1000 / 80);
  for (let index = 0; index < steps; index += 1) {
    engine.step(80);
    const snapshot = engine.snapshot();
    const seconds = Number(((index + 1) * 0.08).toFixed(2));
    if (snapshot.navalAI.globalState === 'search' && result.searchAtSeconds === null) result.searchAtSeconds = seconds;
    if (snapshot.navalAI.globalState === 'regroup' && result.regroupAtSeconds === null) result.regroupAtSeconds = seconds;
    if (snapshot.navalAI.globalState === 'formation' && result.formationAtSeconds === null) result.formationAtSeconds = seconds;
    if (snapshot.metrics.damageTaken > 0 && result.firstDamageAtSeconds === null) result.firstDamageAtSeconds = seconds;
    if (snapshot.canComplete) {
      result.completionAtSeconds = seconds;
      break;
    }
    if (snapshot.missionFailed) break;
  }
  const final = engine.snapshot();
  Object.assign(result, {
    finalPhase: final.encounter.phase,
    finalAIState: final.navalAI.globalState,
    finalHull: final.hull,
    finalDetection: Number(final.detectionScore.toFixed(2)),
    patternsDropped: final.navalAI.metrics.patternsDropped,
    completionAuthorized: final.encounter.completionAuthorized,
    contactLossEvents: final.encounter.metrics.contactsLost,
    safeDisengagements: final.encounter.metrics.safeDisengagements,
    missionFailed: final.missionFailed,
  });
  engine.dispose();
  return result;
}

const cautious = missions.map((mission) => runScenario(mission, true));
const exposed = missions.map((mission) => runScenario(mission, false));
const assertions = {
  missionCount: missions.length === 24,
  noImmediateCompletion: cautious.every((item) => item.immediateCompletion === false),
  allCautiousRunsLoseContact: cautious.every((item) => item.searchAtSeconds !== null && item.regroupAtSeconds !== null),
  allCautiousRunsCompleteSafely: cautious.every((item) => item.completionAtSeconds >= 85 && item.completionAtSeconds <= 120 && item.completionAuthorized && item.finalHull === 100),
  allCautiousRunsRespectSafeWindow: cautious.every((item) => item.completionAtSeconds > item.regroupAtSeconds),
  exposedRunsNeverAutoComplete: exposed.every((item) => item.completionAtSeconds === null && !item.completionAuthorized),
  exposedRunsArePunished: exposed.every((item) => (item.firstDamageAtSeconds !== null || item.patternsDropped >= 4) && item.patternsDropped >= 4),
};
const passed = Object.values(assertions).every(Boolean);
const output = {
  generatedAt: new Date().toISOString(),
  phase: '11',
  summary: {
    passed,
    missionCount: missions.length,
    cautiousCompletionRangeSeconds: [Math.min(...cautious.map((item) => item.completionAtSeconds)), Math.max(...cautious.map((item) => item.completionAtSeconds))],
    cautiousSearchRangeSeconds: [Math.min(...cautious.map((item) => item.searchAtSeconds)), Math.max(...cautious.map((item) => item.searchAtSeconds))],
    cautiousRegroupRangeSeconds: [Math.min(...cautious.map((item) => item.regroupAtSeconds)), Math.max(...cautious.map((item) => item.regroupAtSeconds))],
    exposedFirstDamageRangeSeconds: [Math.min(...exposed.map((item) => item.firstDamageAtSeconds ?? 0)), Math.max(...exposed.map((item) => item.firstDamageAtSeconds ?? 0))],
  },
  assertions,
  cautious,
  exposed,
};
const reportPath = path.join(ROOT, 'reports', 'phase11_tactical_telemetry.json');
fs.writeFileSync(reportPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`TACTICAL TELEMETRY ${passed ? 'PASS' : 'FAIL'}: ${missions.length} missions, cautious completion ${output.summary.cautiousCompletionRangeSeconds.join('-')}s, exposed damage ${output.summary.exposedFirstDamageRangeSeconds.join('-')}s`);
if (!passed) {
  console.error(JSON.stringify(assertions, null, 2));
  process.exit(1);
}
