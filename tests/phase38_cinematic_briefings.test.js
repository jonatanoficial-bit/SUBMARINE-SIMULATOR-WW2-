import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE38_CINEMATIC_BRIEFING, buildCinematicBriefing, renderCinematicBriefing } from '../js/systems/cinematicBriefing.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));
const t = (key) => key;

function mission(overrides = {}) {
  return {
    id: 'de-atlantic-05',
    titleKey: 'mission.de.05.title',
    year: '1944',
    difficulty: 'IV',
    theatreKey: 'mission.theatre.convoy',
    operationKey: 'mission.operation.atlantic',
    reward: 400,
    xp: 80,
    ...overrides,
  };
}

test('phase 38 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.67');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.67');
  assert.equal(BUILD_INFO.phase, '52');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.67');
  assert.equal(manifest.version, '2.0.0-alpha.67');
  assert.equal(PHASE38_CINEMATIC_BRIEFING.system, 'cinematic-mission-briefing');
  assert.ok(PHASE38_CINEMATIC_BRIEFING.layers.includes('mission-dossier'));
});

test('cinematic briefing builds dossier, risk and theater data from mission context', () => {
  const view = buildCinematicBriefing({
    mission: mission(),
    campaign: { theaterKey: 'campaign.atlantic' },
    readiness: { overall: 42 },
    logisticsPlan: { missionId: 'other' },
  });
  assert.equal(view.phase, '38');
  assert.equal(view.theater, 'atlantic');
  assert.match(view.dossierCode, /^NA-44-/);
  assert.ok(['high', 'extreme'].includes(view.risk.band));
  assert.ok(view.pins.length >= 3);
  assert.equal(view.commanderOrderKey, view.risk.band === 'extreme' ? 'briefingCinema.orderExtreme' : 'briefingCinema.orderHigh');
});

test('cinematic briefing render includes map pins, intel board and command order', () => {
  const view = buildCinematicBriefing({ mission: mission({ difficulty: 'II', year: '1941' }), readiness: { overall: 88 }, logisticsPlan: { missionId: 'de-atlantic-05' } });
  const html = renderCinematicBriefing({ view, t });
  assert.match(html, /phase38-cinematic-briefing/);
  assert.match(html, /phase38-war-map/);
  assert.match(html, /phase38-map-pin/);
  assert.match(html, /phase38-command-order/);
  assert.match(html, /--phase38-risk:/);
});

test('phase 38 assets are wired into briefing index service worker and smoke harness', () => {
  const briefing = readText('js/screens/briefing.js');
  const css = readText('css/phase38-cinematic-briefing.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(briefing, /phase38-briefing-ready/);
  assert.match(briefing, /renderCinematicBriefing/);
  assert.match(css, /phase38-war-map/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(index, /phase38-cinematic-briefing\.css/);
  assert.match(serviceWorker, /cinematicBriefing\.js/);
  assert.match(smoke, /phase38-cinematic-briefing\.css/);
  assert.match(smoke, /cinematicBriefing\.js/);
});

test('translations include cinematic briefing keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['briefingCinema.kicker', 'briefingCinema.riskExtreme', 'briefingCinema.orderHigh']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
