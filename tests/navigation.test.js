import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NavigationSystem, bearingDegrees, distanceNm, movePosition, normalizeHeading, shortestHeadingDelta,
} from '../js/engine/navigation/NavigationSystem.js';
import { SimulationEngine } from '../js/engine/simulation/SimulationEngine.js';

const navigation = {
  mapBounds: { north: 50, south: 47, west: -18, east: -12 },
  origin: { lat: 48, lon: -16 },
  heading: 90,
  patrolSector: { id: 'qa-sector', labelKey: 'navigation.sectorAtlantic', north: 48.8, south: 48.3, west: -15, east: -14 },
  route: [
    { id: 'qa-wp-1', lat: 48, lon: -15.9, labelKey: 'navigation.waypointDeparture' },
    { id: 'qa-wp-2', lat: 48.55, lon: -14.5, labelKey: 'navigation.waypointPatrol' },
  ],
};

const mission = {
  id: 'navigation-qa', targetType: 'merchant', targetStartX: 220, targetStartY: 18,
  escortStartX: 310, escortStartY: 42, escortSensitivity: 0, targetDrift: 0.7,
  targetWave: 0.35, targetBob: 6, navigation,
};

test('geographic helpers normalize heading, range and bearing', () => {
  assert.equal(normalizeHeading(-10), 350);
  assert.equal(shortestHeadingDelta(350, 10), 20);
  const distance = distanceNm({ lat: 48, lon: -16 }, { lat: 48, lon: -15.9 });
  assert.ok(distance > 3.9 && distance < 4.2, String(distance));
  const bearing = bearingDegrees({ lat: 48, lon: -16 }, { lat: 48, lon: -15.9 });
  assert.ok(bearing > 89 && bearing < 91, String(bearing));
  const moved = movePosition({ lat: 48, lon: -16 }, 90, distance);
  assert.ok(Math.abs(moved.lon + 15.9) < 0.002, JSON.stringify(moved));
});

test('autopilot follows the active route and advances waypoints', () => {
  const system = new NavigationSystem({ mission: { id: 'qa', navigation }, submarine: { stats: { speed: 60 } } });
  system.requestTimeCompression(16, 16);
  for (let index = 0; index < 1600; index += 1) system.update(80, 'flank', 16);
  const snapshot = system.snapshot();
  assert.ok(snapshot.distanceTravelledNm > 6, String(snapshot.distanceTravelledNm));
  assert.ok(snapshot.activeWaypointIndex >= 1, String(snapshot.activeWaypointIndex));
  assert.equal(snapshot.autopilot, true);
});

test('manual rudder disables autopilot and turns the boat', () => {
  const system = new NavigationSystem({ mission: { id: 'qa', navigation } });
  const before = system.snapshot().heading;
  system.setRudder(35);
  for (let index = 0; index < 20; index += 1) system.update(1000, 'half', 1);
  const after = system.snapshot();
  assert.equal(after.autopilot, false);
  assert.ok(shortestHeadingDelta(before, after.heading) > 10, JSON.stringify(after));
});

test('time compression is guarded by a tactical safety limit', () => {
  const system = new NavigationSystem({ mission: { id: 'qa', navigation } });
  const requested = system.requestTimeCompression(16, 16);
  assert.equal(requested.value, 16);
  system.setSafetyLimit(1);
  assert.equal(system.snapshot().timeCompression, 1);
  assert.equal(system.snapshot().safetyLimited, true);
  system.setSafetyLimit(16);
  assert.equal(system.snapshot().timeCompression, 16);
  assert.equal(system.snapshot().safetyLimited, false);
});

test('custom waypoints are bounded and limited to eight route points', () => {
  const system = new NavigationSystem({ mission: { id: 'qa', navigation } });
  for (let index = 0; index < 6; index += 1) assert.equal(system.addWaypoint(49, -13 - index * 0.01).ok, true);
  assert.equal(system.snapshot().route.length, 8);
  assert.equal(system.addWaypoint(49, -13).reason, 'routeFull');
  const last = system.snapshot().route.at(-1);
  assert.ok(last.lat <= navigation.mapBounds.north && last.lon <= navigation.mapBounds.east);
});

test('patrol sector entry and route state survive snapshot restoration', () => {
  const system = new NavigationSystem({ mission: { id: 'qa', navigation } });
  const snapshot = system.snapshot();
  snapshot.position = { lat: 48.5, lon: -14.5 };
  snapshot.patrolEntered = true;
  snapshot.heading = 147;
  snapshot.requestedTimeCompression = 8;
  snapshot.timeCompression = 8;
  const restored = new NavigationSystem({ mission: { id: 'qa', navigation }, initialSnapshot: snapshot });
  const next = restored.snapshot();
  assert.equal(next.patrolEntered, true);
  assert.equal(Math.round(next.heading), 147);
  assert.deepEqual(next.position, snapshot.position);
  assert.equal(next.timeCompression, 8);
});

test('SimulationEngine exports navigation in deterministic operation autosaves', () => {
  const engine = new SimulationEngine({ mission });
  engine.setSpeed('full');
  assert.equal(engine.requestTimeCompression(8).ok, true);
  engine.nudgeHeading(15);
  for (let index = 0; index < 50; index += 1) engine.step(80);
  const snapshot = engine.snapshot();
  assert.equal(snapshot.snapshotVersion, 10);
  assert.equal(snapshot.navigation.navigationVersion, 2);
  assert.ok(snapshot.navigation.distanceTravelledNm > 0);
  const restored = new SimulationEngine({ mission, initialSnapshot: snapshot });
  assert.deepEqual(restored.snapshot().navigation.position, snapshot.navigation.position);
  assert.equal(restored.snapshot().navigation.requestedTimeCompression, 8);
  engine.dispose(); restored.dispose();
});

test('SimulationEngine immediately limits compression during periscope exposure', () => {
  const engine = new SimulationEngine({ mission });
  assert.equal(engine.requestTimeCompression(16).value, 16);
  assert.equal(engine.openPeriscope().ok, true);
  engine.step(80);
  assert.equal(engine.snapshot().navigation.timeCompression, 1);
  assert.equal(engine.snapshot().navigation.safetyLimited, true);
  engine.closePeriscope();
  engine.step(80);
  assert.equal(engine.snapshot().navigation.timeCompression, 16);
  engine.dispose();
});
