import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { classifyOceanWeather } from '../js/oceanWeather.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const build = readJson('BUILD_INFO.json');
const pkg = readJson('package.json');

test('phase 24 metadata identifies ocean weather patrol build', () => {
  assert.equal(build.semver, '2.0.0-alpha.51');
  assert.equal(build.phase, '36');
  assert.equal(pkg.version, '2.0.0-alpha.51');
});

test('ocean weather classifier is bounded and deterministic', () => {
  const environment = { seaState:5.6, windKnots:31, precipitation:76, visibilityMeters:1800, ambientNoise:78, thermalLayerDepth:42, daylight:12, radarClutter:82, environmentVersion:1 };
  const physics = { depth:46, noise:22 };
  const first = classifyOceanWeather({ environment, physics });
  const second = classifyOceanWeather({ environment, physics });
  assert.deepEqual(first, second);
  assert.equal(first.seaBand, 'storm');
  assert.ok(first.surfaceRisk >= 0 && first.surfaceRisk <= 100);
  assert.ok(first.recommendedDepth >= 18 && first.recommendedDepth <= 115);
  assert.ok(first.adviceKey.startsWith('ocean.advice.'));
});

test('bad visibility creates cover while noisy water degrades sonar', () => {
  const clear = classifyOceanWeather({ environment:{ seaState:1, windKnots:5, precipitation:0, visibilityMeters:12000, ambientNoise:12, daylight:100, radarClutter:8, thermalLayerDepth:35 }, physics:{ depth:20, noise:12 } });
  const rough = classifyOceanWeather({ environment:{ seaState:5, windKnots:28, precipitation:62, visibilityMeters:2400, ambientNoise:72, daylight:8, radarClutter:78, thermalLayerDepth:35 }, physics:{ depth:38, noise:44 } });
  assert.ok(rough.coverScore > clear.coverScore);
  assert.ok(rough.sonarDegradation > clear.sonarDegradation);
  assert.ok(rough.navigationDriftRisk > clear.navigationDriftRisk);
});

test('phase 24 translation keys exist in all languages', () => {
  const keys = ['ocean.title','ocean.severity','ocean.cover','ocean.surfaceRisk','ocean.sonarEffect','ocean.recommendedDepth','ocean.advice','ocean.sea.storm','ocean.visibility.restricted','ocean.advice.deep'];
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    assert.deepEqual(keys.filter((key) => !dictionary[key]), [], lang);
  }
});
