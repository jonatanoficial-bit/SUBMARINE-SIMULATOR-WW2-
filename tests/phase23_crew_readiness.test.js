import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const build = JSON.parse(fs.readFileSync(path.join(ROOT, 'BUILD_INFO.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const crew = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crew.json'), 'utf8'));
const translations = ['pt-BR', 'en', 'es'].map((lang) => JSON.parse(fs.readFileSync(path.join(ROOT, `data/translations/${lang}.json`), 'utf8')));

const { assessCrewReadiness, createCrewStationCoverage, CREW_STATIONS } = await import('../js/systems/crewReadiness.js');

test('phase 23 metadata identifies living crew readiness build', () => {
  assert.equal(build.semver, '2.0.0-alpha.55');
  assert.equal(build.phase, '40');
  assert.equal(pkg.version, '2.0.0-alpha.55');
  assert.equal(pkg.scripts.audit, 'python3 tools/audit_phase40_living_campaign_front.py');
});

test('crew readiness detects coverage, morale, fatigue and station readiness', () => {
  const hiredIds = ['de_exec_otto', 'de_sonar_emil', 'de_mech_franz', 'de_nav_karl'];
  const report = assessCrewReadiness(crew, hiredIds, { logistics: { morale: 84 }, career: { reputation: 36 }, submarine: { hull: 92 } });
  assert.equal(report.hiredCount, 4);
  assert.ok(report.readiness >= 60);
  assert.ok(report.morale >= 60);
  assert.ok(report.fatigue < 70);
  assert.ok(report.stationReadiness.command > 50);
  assert.ok(report.stationReadiness.sonar > 50);
  assert.ok(report.stationReadiness.damage > 50);
  assert.ok(report.watchRotation.length >= 3);
});

test('crew coverage exposes missing stations when specialists are absent', () => {
  const coverage = createCrewStationCoverage(crew, ['us_sonar_james']);
  assert.equal(coverage.sonar.covered, true);
  assert.equal(coverage.command.covered, false);
  const report = assessCrewReadiness(crew, ['us_sonar_james'], { logistics: { morale: 45 }, damageEmergency: { smokeDensity: 60 } });
  assert.ok(report.missingStations.includes('command'));
  assert.ok(report.readiness < 65);
  assert.ok(report.recommendations.some((rec) => rec.key === 'crew.rec.coverage'));
});

test('phase 23 translation keys are available in all languages', () => {
  const keys = [
    'crew.readinessTitle','crew.readiness','crew.morale','crew.fatigue','crew.coverage','crew.averageSkill',
    'crew.stationCoverage','crew.watchRotation','crew.recommendations','crew.status.ready','crew.status.elite',
    'crew.station.command','crew.station.sonar','crew.station.navigation','crew.station.damage','crew.station.watch',
    'crew.rec.coverage','crew.rec.fatigue','crew.rec.morale','crew.rec.elite','crew.rec.ready'
  ];
  for (const dictionary of translations) {
    assert.deepEqual(keys.filter((key) => !dictionary[key]), []);
  }
  assert.deepEqual(CREW_STATIONS.map((station) => station.id), ['command', 'sonar', 'navigation', 'damage', 'watch']);
});
