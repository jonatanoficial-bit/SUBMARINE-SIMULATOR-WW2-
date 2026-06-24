import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE32_TORPEDO_ATTACK_DIRECTOR, buildTorpedoAttackDirectorView } from '../js/systems/torpedoAttackDirector.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 32 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.51');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.51');
  assert.equal(BUILD_INFO.phase, '36');
  assert.equal(BUILD_INFO.saveSchemaVersion, 30);
  assert.equal(pkg.version, '2.0.0-alpha.51');
  assert.equal(manifest.version, '2.0.0-alpha.51');
  assert.equal(PHASE32_TORPEDO_ATTACK_DIRECTOR.system, 'torpedo-attack-director');
  assert.ok(PHASE32_TORPEDO_ATTACK_DIRECTOR.layers.includes('attack-triangle'));
});

test('torpedo director authorizes fire for a firm firing solution', () => {
  const view = buildTorpedoAttackDirectorView({ snapshot: {
    depth: 18,
    torpedoActive: false,
    weapons: {
      canFire: true,
      minimumSolutionQuality: 42,
      selectedTarget: 'target',
      tdc: {
        solutionQuality: 86,
        contactConfidence: 88,
        rangeMeters: 2400,
        bearing: 12,
        gyroAngle: 18,
        targetSpeedKnots: 8.5,
        torpedoSpeedKnots: 44,
        aobDegrees: 90,
        lastContactAgeMs: 200,
        torpedoType: 'electric',
      },
      torpedoTypes: { electric: { speedKnots: 30, maxRangeMeters: 5000, wake: false } },
      profile: { maxLaunchDepth: 60 },
    },
  } });
  assert.equal(view.phase, '32');
  assert.equal(view.attackPhase, 'fire');
  assert.equal(view.recommendationState, 'fire');
  assert.equal(view.recommendationKey, 'torpedoDirector.recommendFire');
  assert.ok(view.bars.firing >= 75);
  assert.match(view.style, /--phase32-gyro:/);
});

test('torpedo director holds fire when depth or range is unsafe', () => {
  const deep = buildTorpedoAttackDirectorView({ snapshot: {
    depth: 92,
    weapons: {
      canFire: false,
      fireReason: 'torpedoTooDeep',
      minimumSolutionQuality: 42,
      profile: { maxLaunchDepth: 60 },
      tdc: { solutionQuality: 90, contactConfidence: 90, rangeMeters: 1800, targetSpeedKnots: 7, aobDegrees: 85, torpedoType: 'steam' },
      torpedoTypes: { steam: { speedKnots: 44, maxRangeMeters: 5200, wake: true } },
    },
  } });
  assert.equal(deep.recommendationState, 'hold');
  assert.equal(deep.recommendationKey, 'torpedoDirector.recommendDepth');

  const far = buildTorpedoAttackDirectorView({ snapshot: {
    depth: 18,
    weapons: {
      canFire: false,
      fireReason: 'solutionPoor',
      minimumSolutionQuality: 42,
      profile: { maxLaunchDepth: 60 },
      tdc: { solutionQuality: 55, contactConfidence: 70, rangeMeters: 9000, targetSpeedKnots: 9, aobDegrees: 70, torpedoType: 'steam' },
      torpedoTypes: { steam: { speedKnots: 44, maxRangeMeters: 5200, wake: true } },
    },
  } });
  assert.equal(far.recommendationKey, 'torpedoDirector.recommendCloseRange');
});

test('torpedo director shows observe phase and shot feedback during torpedo run', () => {
  const view = buildTorpedoAttackDirectorView({ snapshot: {
    depth: 14,
    torpedoActive: true,
    weapons: {
      canFire: false,
      activeShots: [{ remainingMs: 12000, travelMs: 30000, predictedHit: true }],
      minimumSolutionQuality: 42,
      profile: { maxLaunchDepth: 60 },
      tdc: { solutionQuality: 82, contactConfidence: 80, rangeMeters: 2100, targetSpeedKnots: 8, aobDegrees: 92, gyroAngle: 14, torpedoType: 'electric' },
      torpedoTypes: { electric: { speedKnots: 30, maxRangeMeters: 5000, wake: false } },
    },
  } });
  assert.equal(view.attackPhase, 'observe');
  assert.equal(view.recommendationKey, 'torpedoDirector.recommendObserve');
  assert.equal(view.shotFeedbackKey, 'torpedoDirector.shotPredictedHit');
  assert.ok(view.runProgress > 50);
});

test('phase 32 assets are wired into gameplay index service worker and smoke harness', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/phase32-torpedo-attack-director.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase32-torpedo-attack-ready/);
  assert.match(gameplay, /phase32-attack-director/);
  assert.match(gameplay, /buildTorpedoAttackDirectorView/);
  assert.match(css, /phase32-attack-plot/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(index, /phase32-torpedo-attack-director\.css/);
  assert.match(serviceWorker, /torpedoAttackDirector\.js/);
  assert.match(smoke, /phase32-torpedo-attack-director\.css/);
  assert.match(smoke, /torpedoAttackDirector\.js/);
});

test('translations include torpedo director keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['torpedoDirector.kicker', 'torpedoDirector.phaseFire', 'torpedoDirector.recommendFire', 'torpedoDirector.shotPredictedHit']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
