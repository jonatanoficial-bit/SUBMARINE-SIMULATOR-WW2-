import assert from 'node:assert/strict';
import test from 'node:test';
import { WeaponSystem } from '../js/engine/weapons/WeaponSystem.js';

function context(overrides = {}) {
  return {
    worldTime: 100,
    depth: 12,
    systems: { weapons: 100 },
    missionFailed: false,
    escortState: 'patrol',
    navigation: { heading: 90 },
    sensors: {
      contacts: {
        target: { detected: true, bearing: 90, rangeMeters: 900, rangeKnown: true, confidence: 96, source: 'periscope', ageMs: 0, stale: false, bearingUncertainty: 1, rangeUncertainty: 0.03 },
        escort: { detected: true, bearing: 115, rangeMeters: 1400, rangeKnown: true, confidence: 88, source: 'activeSonar', ageMs: 0, stale: false, bearingUncertainty: 1.5, rangeUncertainty: 0.04 },
      },
    },
    contacts: {
      target: { x: 225, y: 0, destroyed: false },
      escort: { x: 320, y: 90, destroyed: false },
    },
    timeCompression: 1,
    ...overrides,
  };
}

function system(options = {}) {
  return new WeaponSystem({
    mission: { id: 'test-mission', year: '1944', targetDrift: 0.7 },
    submarine: { id: 'uk_t_class_starter', nation: 'uk', stats: { torpedoes: 8 } },
    initialTorpedoes: 8,
    ...options,
  });
}

test('tube bank loads tubes and keeps remaining torpedoes in reserve', () => {
  const weapons = system();
  const snapshot = weapons.snapshot(context());
  assert.equal(snapshot.profile.tubeCount, 6);
  assert.equal(snapshot.loadedTubeCount, 6);
  assert.equal(snapshot.reserveTorpedoes, 2);
  assert.equal(snapshot.totalTorpedoes, 8);
});

test('TDC synchronizes bearing, range, target motion and gyro angle', () => {
  const weapons = system();
  const result = weapons.syncFromContact(context());
  assert.equal(result.ok, true);
  const snapshot = weapons.snapshot(context());
  assert.equal(snapshot.tdc.synced, true);
  assert.ok(snapshot.tdc.solutionQuality >= 58);
  assert.ok(Number.isFinite(snapshot.tdc.gyroAngle));
  assert.equal(snapshot.tdc.rangeMeters, 900);
});

test('a three-torpedo salvo consumes loaded tubes and starts reload cycles', () => {
  const weapons = system();
  weapons.syncFromContact(context());
  weapons.setSalvoSize(3);
  const fired = weapons.fire(context());
  assert.equal(fired.ok, true);
  assert.equal(fired.shots.length, 3);
  const snapshot = weapons.snapshot(context());
  assert.equal(snapshot.activeShots.length, 3);
  assert.equal(snapshot.loadedTubeCount, 3);
  assert.equal(snapshot.reserveTorpedoes, 0);
  assert.equal(snapshot.totalTorpedoes, 5);
  assert.equal(snapshot.tubes.filter((tube) => tube.reloadMs > 0).length, 2);
});

test('torpedoes resolve deterministically and report historical outcome', () => {
  const weapons = system();
  weapons.syncFromContact(context());
  const fired = weapons.fire(context());
  assert.equal(fired.ok, true);
  weapons.update(130000, context());
  const events = weapons.drainResolutionEvents();
  assert.equal(events.length, 1);
  assert.ok(['hit', 'miss', 'dud', 'depthKeeping', 'premature'].includes(events[0].outcome));
  assert.equal(weapons.snapshot(context()).activeShots.length, 0);
});

test('tube reload completes using simulated elapsed time', () => {
  const weapons = system();
  weapons.syncFromContact(context());
  weapons.fire(context());
  let snapshot = weapons.snapshot(context());
  assert.ok(snapshot.tubes.some((tube) => tube.reloadMs > 0));
  weapons.update(60000, context());
  snapshot = weapons.snapshot(context());
  assert.equal(snapshot.loadedTubeCount, 6);
  assert.equal(snapshot.reserveTorpedoes, 1);
});

test('launch is blocked below maximum firing depth', () => {
  const weapons = system();
  weapons.syncFromContact(context());
  const result = weapons.fire(context({ depth: 80 }));
  assert.deepEqual(result, { ok: false, reason: 'torpedoTooDeep' });
});

test('stern arc rejects bow-only firing geometry', () => {
  const weapons = new WeaponSystem({
    mission: { id: 'stern-test', year: '1944' },
    submarine: { id: 'de_type_viia_starter', nation: 'de', stats: { torpedoes: 5 } },
    initialTorpedoes: 5,
  });
  weapons.setTarget('target');
  weapons.selectTube('tube-5');
  weapons.syncFromContact(context());
  const result = weapons.fire(context());
  assert.equal(result.ok, true);
  assert.notEqual(result.shots[0].tubeId, 'tube-5');
});

test('snapshot restore preserves tubes, TDC, salvo and active shots', () => {
  const weapons = system();
  weapons.syncFromContact(context());
  weapons.setSalvoSize(2);
  weapons.setTorpedoType('electric');
  weapons.fire(context());
  weapons.update(1200, context());
  const saved = weapons.snapshot(context());
  const restored = system();
  assert.equal(restored.restore(saved), true);
  const snapshot = restored.snapshot(context());
  assert.equal(snapshot.salvoSize, 2);
  assert.equal(snapshot.tdc.torpedoType, 'electric');
  assert.equal(snapshot.activeShots.length, 2);
  assert.equal(snapshot.totalTorpedoes, saved.totalTorpedoes);
});

test('early-war profiles carry a higher deterministic failure risk', () => {
  const early = new WeaponSystem({ mission: { id: 'early', year: '1941' }, submarine: { id: 'us_gato_starter', nation: 'us', stats: { torpedoes: 8 } }, initialTorpedoes: 8 });
  const late = new WeaponSystem({ mission: { id: 'late', year: '1944' }, submarine: { id: 'us_gato_starter', nation: 'us', stats: { torpedoes: 8 } }, initialTorpedoes: 8 });
  assert.ok(early.snapshot(context()).profile.baseFailureRate > late.snapshot(context()).profile.baseFailureRate);
});
