import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { analyzeConvoyDoctrine } from '../js/systems/convoyDoctrine.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const build = readJson('BUILD_INFO.json');
const pkg = readJson('package.json');

test('phase 25 metadata identifies convoy doctrine build', () => {
  assert.equal(build.semver, '2.0.0-alpha.33');
  assert.equal(build.phase, '18');
  assert.equal(pkg.version, '2.0.0-alpha.33');
});

test('convoy doctrine analysis is bounded and deterministic', () => {
  const navalAI = {
    profile: { merchantCount: 4, escortCount: 2 },
    globalState: 'alert', threatLevel: 'warning', contactConfidence: 48, attackSolution: 22, nearestEscortRange: 145, destroyedShips: 1,
    ships: [
      { role:'target', x:200, y:0 }, { role:'convoy', x:128, y:-25 }, { role:'convoy', x:272, y:-22 }, { role:'escort', x:110, y:90 }, { role:'escort-support', x:320, y:92 }
    ]
  };
  const first = analyzeConvoyDoctrine({ navalAI, environment:{ seaState:4, visualFactor:.42, precipitation:65 }, physics:{ noise:18 } });
  const second = analyzeConvoyDoctrine({ navalAI, environment:{ seaState:4, visualFactor:.42, precipitation:65 }, physics:{ noise:18 } });
  assert.deepEqual(first, second);
  for (const key of ['formationIntegrity','escortScreen','zigzagIntensity','interceptWindow','risk']) assert.ok(first[key] >= 0 && first[key] <= 100, key);
  assert.ok(first.convoySpacingMeters > 0);
  assert.ok(first.doctrineKey.startsWith('convoy.doctrine.'));
  assert.ok(first.recommendationKey.startsWith('convoy.recommend.'));
});

test('heavy escort pressure recommends defensive posture', () => {
  const result = analyzeConvoyDoctrine({ navalAI:{ profile:{ merchantCount:3, escortCount:2 }, globalState:'hunt', threatLevel:'critical', contactConfidence:88, attackSolution:82, nearestEscortRange:58, ships:[{ role:'target', x:240, y:0 }, { role:'escort', x:30, y:12 }, { role:'escort-support', x:80, y:-25 }] }, environment:{ seaState:2, visualFactor:.9 }, physics:{ noise:42 } });
  assert.equal(result.posture, 'defensive');
  assert.equal(result.recommendationKey, 'convoy.recommend.deepSilent');
  assert.ok(result.risk >= 60);
});

test('phase 25 translation keys exist in all languages', () => {
  const keys = ['convoy.title','convoy.integrity','convoy.escortScreen','convoy.zigzag','convoy.interceptWindow','convoy.doctrine.hunt','convoy.recommend.attackWindow','convoy.recommend.deepSilent'];
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    assert.deepEqual(keys.filter((key) => !dictionary[key]), [], lang);
  }
});
