import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createTdcFireControlSolution } from '../js/screens/gameplay.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const build = readJson('BUILD_INFO.json');
const translations = ['pt-BR','en','es'].map((lang)=>readJson(`data/translations/${lang}.json`));

test('phase 19 metadata is active', () => {
  assert.equal(build.semver, '2.0.0-alpha.67');
  assert.equal(build.phase, '52');
  assert.equal(build.saveSchemaVersion, 40);
});

test('TDC fire-control authorizes good periscope/sonar solution', () => {
  const solution = createTdcFireControlSolution({ snapshot: {
    depth: 18,
    weapons: {
      canFire: true,
      salvoSize: 2,
      minimumSolutionQuality: 42,
      profile: { maxLaunchDepth: 60 },
      torpedoTypes: { electric: { speedKnots: 30, maxRangeMeters: 3200, wake: false } },
      tdc: { solutionQuality: 86, rangeMeters: 1250, targetSpeedKnots: 8, aobDegrees: 78, gyroAngle: 24, torpedoType: 'electric', lastContactAgeMs: 340 }
    }
  }});
  assert.equal(solution.discipline, 'fire');
  assert.equal(solution.salvoPattern, 'paired');
  assert.ok(solution.impactSeconds > 40);
  assert.ok(solution.fireRisk < 35);
  assert.ok(Math.abs(solution.leadAngle) > 0);
});

test('TDC fire-control blocks poor stale or too-deep solution', () => {
  const solution = createTdcFireControlSolution({ snapshot: {
    depth: 92,
    weapons: {
      canFire: false,
      salvoSize: 3,
      minimumSolutionQuality: 42,
      profile: { maxLaunchDepth: 60 },
      torpedoTypes: { steam: { speedKnots: 44, maxRangeMeters: 5200, wake: true } },
      tdc: { solutionQuality: 28, rangeMeters: 4400, targetSpeedKnots: 16, aobDegrees: 110, gyroAngle: 146, torpedoType: 'steam', lastContactAgeMs: 9000 }
    }
  }});
  assert.equal(solution.discipline, 'hold');
  assert.equal(solution.state, 'critical');
  assert.ok(solution.fireRisk >= 80);
  assert.equal(solution.salvoPattern, 'fan');
});

test('phase 19 UI, cache and translation keys are present', () => {
  const gameplay = fs.readFileSync(path.join(ROOT, 'js/screens/gameplay.js'), 'utf8');
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  assert.match(gameplay, /phase19-tdc-solution/);
  assert.match(index, /phase19-tdc-fire-control\.css/);
  assert.match(serviceWorker, /phase19-tdc-fire-control\.css/);
  const keys = ['tdc.attackTriangle','tdc.leadAngle','tdc.impactTime','tdc.fireRisk','tdc.hitWindow','tdc.salvoPattern','tdc.fireDiscipline','tdc.discipline.fire'];
  for (const dictionary of translations) assert.deepEqual(keys.filter((key) => !dictionary[key]), []);
});
