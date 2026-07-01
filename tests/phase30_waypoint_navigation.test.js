import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE30_WAYPOINT_NAVIGATION, buildPatrolRouteFromSector, buildRouteLegs, buildWaypointNavigationView } from '../js/systems/waypointNavigation.js';
import { NavigationSystem } from '../js/engine/navigation/NavigationSystem.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 30 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.68');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.68');
  assert.equal(BUILD_INFO.phase, '53');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.68');
  assert.equal(manifest.version, '2.0.0-alpha.68');
  assert.equal(PHASE30_WAYPOINT_NAVIGATION.system, 'waypoint-navigation-planner');
  assert.ok(PHASE30_WAYPOINT_NAVIGATION.layers.includes('route-legs'));
});

test('route legs compute bearing distance eta and active leg', () => {
  const legs = buildRouteLegs({
    position: { lat: 48, lon: -16 },
    speedKnots: 6,
    route: [{ id: 'wp-a', lat: 48.2, lon: -15.7 }, { id: 'wp-b', lat: 48.4, lon: -15.2 }],
    activeWaypointIndex: 0,
  });
  assert.equal(legs.length, 2);
  assert.equal(legs[0].active, true);
  assert.match(legs[0].bearingLabel, /^\d{3}°$/);
  assert.ok(legs[0].distanceNm > 10);
  assert.ok(legs[0].etaHours > 1);
});

test('waypoint navigation view classifies orders and autonomy', () => {
  const snapshot = {
    detectionScore: 82,
    playerDetected: true,
    physics: { fuel: 20, battery: 30 },
    navigation: {
      position: { lat: 48, lon: -16 },
      speedKnots: 5,
      activeWaypointIndex: 0,
      patrolEntered: false,
      patrolSector: { north: 48.9, south: 48.2, west: -15.8, east: -14.4 },
      route: [{ id: 'wp-a', lat: 49.5, lon: -12.2 }],
    },
  };
  const view = buildWaypointNavigationView({ snapshot });
  assert.equal(view.phase, '30');
  assert.equal(view.order.state, 'silent');
  assert.ok(['caution', 'critical'].includes(view.autonomy.state));
  assert.equal(view.canPlotPatrol, true);
  assert.ok(view.totalDistanceNm > 150);
});

test('patrol route planner creates bounded sector sweep route', () => {
  const route = buildPatrolRouteFromSector({
    sector: { north: 49, south: 48, west: -15, east: -14 },
    bounds: { north: 50, south: 46, west: -20, east: -12 },
    currentPosition: { lat: 48.1, lon: -16 },
  });
  assert.equal(route.length, 4);
  assert.ok(route.every((point) => point.lat <= 50 && point.lat >= 46));
  assert.ok(route.every((point) => point.lon <= -12 && point.lon >= -20));
  assert.equal(route[0].id, 'patrol-entry');
});

test('NavigationSystem can replace route with patrol-sector sweep', () => {
  const nav = new NavigationSystem({ mission: { id: 'qa-30', navigation: {
    origin: { lat: 48.1, lon: -16.1 },
    heading: 70,
    mapBounds: { north: 50, south: 46, west: -20, east: -12 },
    patrolSector: { north: 49, south: 48, west: -15, east: -14 },
    route: [{ id: 'old', lat: 48.2, lon: -15.8 }],
  } } });
  const result = nav.planPatrolSectorRoute();
  assert.equal(result.ok, true);
  const snapshot = nav.snapshot();
  assert.equal(snapshot.route.length, 4);
  assert.equal(snapshot.activeWaypointIndex, 0);
  assert.equal(snapshot.autopilot, true);
  assert.equal(snapshot.navigationVersion, 2);
});

test('phase 30 assets are wired into gameplay index service worker and smoke harness', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/phase30-waypoint-navigation.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase30-waypoint-navigation-ready/);
  assert.match(gameplay, /buildWaypointNavigationView/);
  assert.match(gameplay, /nav-plan-patrol/);
  assert.match(css, /phase30-route-planner/);
  assert.match(index, /phase30-waypoint-navigation\.css/);
  assert.match(serviceWorker, /waypointNavigation\.js/);
  assert.match(smoke, /phase30-waypoint-navigation\.css/);
  assert.match(smoke, /waypointNavigation\.js/);
});

test('translations include waypoint navigation keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['waypointNav.kicker', 'waypointNav.orderTransit', 'waypointNav.planPatrol', 'waypointNav.autonomySafe']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
