import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE29_TACTICAL_NAVAL_CHART, buildTacticalNavalChartView, formatChartCoordinate, projectChartPoint } from '../js/systems/tacticalNavalChart.js';

const ROOT = path.normalize(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 29 tactical chart metadata is active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, '2.2.0');
  assert.equal(BUILD_INFO.semver, '2.2.0');
  assert.equal(BUILD_INFO.phase, '56');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.2.0');
  assert.equal(manifest.version, '2.2.0');
  assert.equal(PHASE29_TACTICAL_NAVAL_CHART.system, 'tactical-naval-chart');
  assert.ok(PHASE29_TACTICAL_NAVAL_CHART.layers.includes('convoy-lanes'));
  assert.ok(PHASE29_TACTICAL_NAVAL_CHART.layers.includes('danger-zones'));
});

test('chart projection and coordinate formatting keep points inside SVG', () => {
  const bounds = { north: 50, south: 46, west: -20, east: -12 };
  assert.deepEqual(projectChartPoint({ lat: 50, lon: -20 }, bounds), { x: 0, y: 0 });
  assert.deepEqual(projectChartPoint({ lat: 46, lon: -12 }, bounds), { x: 1000, y: 560 });
  const center = projectChartPoint({ lat: 48, lon: -16 }, bounds);
  assert.equal(center.x, 500);
  assert.equal(center.y, 280);
  assert.equal(formatChartCoordinate({ lat: 48.5, lon: -16.25 }), '48.50°N 16.25°W');
});

test('tactical naval chart view builds convoy lanes danger zones and route summary', () => {
  const snapshot = {
    detectionScore: 64,
    navigation: {
      mapBounds: { north: 50, south: 46, west: -20, east: -12 },
      position: { lat: 48, lon: -16 },
      activeWaypointIndex: 1,
      patrolEntered: false,
      patrolSector: { north: 48.9, south: 48.2, west: -15.8, east: -14.4 },
      route: [
        { id: 'wp-1', lat: 48.1, lon: -16.4 },
        { id: 'wp-2', lat: 48.3, lon: -15.6 },
        { id: 'wp-3', lat: 48.6, lon: -14.9 },
      ],
    },
    navalAI: { aircraft: { active: true, state: 'attack' }, state: 'hunt' },
  };
  const view = buildTacticalNavalChartView({ snapshot });
  assert.equal(view.phase, '29');
  assert.equal(view.title, 'Carta Naval NA-29 · Atlântico Norte');
  assert.equal(view.status, 'danger');
  assert.ok(view.threatScore >= 90);
  assert.equal(view.convoyLanes.length, 3);
  assert.ok(view.dangerZones.some((zone) => zone.id === 'air-sweep' && zone.level === 'danger'));
  assert.ok(view.dangerZones.some((zone) => zone.id === 'escort-hunt'));
  assert.equal(view.routeSummary.length, 3);
  assert.equal(view.routeSummary[1].active, true);
});

test('phase 29 assets are wired into gameplay index service worker and smoke harness', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/phase29-tactical-naval-chart.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase29-tactical-chart-ready/);
  assert.match(gameplay, /nav-chart-lanes/);
  assert.match(gameplay, /buildTacticalNavalChartView/);
  assert.match(css, /phase29-chart-lane/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(index, /phase29-tactical-naval-chart\.css/);
  assert.match(serviceWorker, /tacticalNavalChart\.js/);
  assert.match(smoke, /phase29-tactical-naval-chart\.css/);
  assert.match(smoke, /tacticalNavalChart\.js/);
});

test('translations include tactical chart keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['navalChart.kicker', 'navalChart.title', 'navalChart.scale', 'navalChart.bounds']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
