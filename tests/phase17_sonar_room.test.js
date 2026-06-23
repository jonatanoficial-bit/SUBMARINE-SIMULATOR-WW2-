import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(read(relative));

test('phase 17 sonar room metadata and assets are active', () => {
  const build = readJson('BUILD_INFO.json');
  assert.equal(build.semver, '2.0.0-alpha.33');
  assert.equal(build.phase, '18');
  assert.equal(build.qaStatus, 'PASS');
  assert.ok(fs.existsSync(path.join(ROOT, 'css/phase17-sonar-room.css')));
});

test('phase 17 sonar room is rendered in gameplay and cached for PWA', () => {
  const gameplay = read('js/screens/gameplay.js');
  const index = read('index.html');
  const serviceWorker = read('service-worker.js');
  assert.match(gameplay, /sonar-room-status-grid/);
  assert.match(gameplay, /sonar-room-acoustic-board/);
  assert.match(gameplay, /phase17-waterfall/);
  assert.match(index, /phase17-sonar-room\.css/);
  assert.match(serviceWorker, /phase17-sonar-room\.css/);
});

test('phase 17 translations exist in Portuguese, English and Spanish', () => {
  const keys = [
    'sonarRoom.acousticStatus',
    'sonarRoom.signatureBoard',
    'sonarRoom.pingRisk',
    'sonarRoom.riskHigh',
    'sonarRoom.ownNoise',
    'sonarRoom.thermalLayer'
  ];
  for (const lang of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    const missing = keys.filter((key) => !dictionary[key]);
    assert.deepEqual(missing, []);
  }
});
