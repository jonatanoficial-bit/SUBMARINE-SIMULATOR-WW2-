export const PHASE32_TORPEDO_ATTACK_DIRECTOR = Object.freeze({
  phase: '32',
  system: 'torpedo-attack-director',
  version: 'v2.0.0-alpha.47',
  mobileFirst: true,
  layers: ['acquisition-ladder', 'attack-triangle', 'gyro-track', 'salvo-discipline', 'shot-feedback'],
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBearing(value) {
  const number = Number(value) || 0;
  return ((number % 360) + 360) % 360;
}

function formatDegrees(value) {
  return `${String(Math.round(normalizeBearing(value))).padStart(3, '0')}°`;
}

function formatRange(value) {
  const meters = Math.max(0, safeNumber(value));
  if (!meters) return '--';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatSeconds(value) {
  const seconds = Math.max(0, Math.round(safeNumber(value)));
  if (!seconds) return '--';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min ? `${min}m ${String(sec).padStart(2, '0')}s` : `${sec}s`;
}

function targetAspect(aob) {
  const angle = clamp(aob, 0, 180);
  if (angle < 35) return { state: 'bow', key: 'torpedoDirector.aspectBow' };
  if (angle > 145) return { state: 'stern', key: 'torpedoDirector.aspectStern' };
  if (angle >= 70 && angle <= 112) return { state: 'broadside', key: 'torpedoDirector.aspectBroadside' };
  return { state: 'quarter', key: 'torpedoDirector.aspectQuarter' };
}

function buildBars({ quality, confidence, rangeMeters, maxRangeMeters, targetSpeed, torpedoSpeed, staleMs, aob, canFire, minimum }) {
  const rangeRatio = rangeMeters ? clamp(rangeMeters / Math.max(1, maxRangeMeters), 0, 1.6) : 1.35;
  const acquisition = clamp(confidence - staleMs / 1800 + (rangeRatio < 1 ? 10 : -16), 0, 100);
  const motion = clamp(100 - Math.abs(90 - clamp(aob, 0, 180)) * 0.55 - Math.abs(targetSpeed - 9) * 1.2, 0, 100);
  const range = clamp(100 - Math.max(0, rangeRatio - 0.38) * 82, 0, 100);
  const gyro = clamp(quality * 0.78 + motion * 0.22, 0, 100);
  const firing = clamp(quality * 0.62 + acquisition * 0.16 + range * 0.14 + (canFire ? 12 : -18) - Math.max(0, minimum - quality) * 0.8, 0, 100);
  const torpedoRun = clamp((torpedoSpeed / Math.max(1, targetSpeed || 7)) * 14, 0, 100);
  return { acquisition: Math.round(acquisition), motion: Math.round(motion), range: Math.round(range), gyro: Math.round(gyro), firing: Math.round(firing), torpedoRun: Math.round(torpedoRun) };
}

function choosePhase({ quality, confidence, canFire, torpedoActive, lastResolution }) {
  if (torpedoActive) return { id: 'observe', key: 'torpedoDirector.phaseObserve' };
  if (lastResolution?.outcome) return { id: 'assess', key: 'torpedoDirector.phaseAssess' };
  if (quality >= 78 && canFire) return { id: 'fire', key: 'torpedoDirector.phaseFire' };
  if (quality >= 48 || confidence >= 54) return { id: 'solve', key: 'torpedoDirector.phaseSolve' };
  if (confidence >= 24) return { id: 'track', key: 'torpedoDirector.phaseTrack' };
  return { id: 'acquire', key: 'torpedoDirector.phaseAcquire' };
}

function chooseRecommendation({ phase, quality, confidence, canFire, fireReason, rangeMeters, maxRangeMeters, depth, maxLaunchDepth, torpedoActive }) {
  if (torpedoActive) return { state: 'observe', key: 'torpedoDirector.recommendObserve' };
  if (depth > maxLaunchDepth) return { state: 'hold', key: 'torpedoDirector.recommendDepth' };
  if (fireReason === 'noLoadedTubes') return { state: 'hold', key: 'torpedoDirector.recommendReload' };
  if (!confidence || phase.id === 'acquire') return { state: 'hold', key: 'torpedoDirector.recommendAcquire' };
  if (rangeMeters > maxRangeMeters) return { state: 'hold', key: 'torpedoDirector.recommendCloseRange' };
  if (quality >= 78 && canFire) return { state: 'fire', key: 'torpedoDirector.recommendFire' };
  if (quality >= 48) return { state: 'wait', key: 'torpedoDirector.recommendRefine' };
  return { state: 'hold', key: 'torpedoDirector.recommendHold' };
}

export function buildTorpedoAttackDirectorView({ snapshot = {} } = {}) {
  const weapons = snapshot.weapons || {};
  const tdc = weapons.tdc || {};
  const torpedo = weapons.torpedoTypes?.[tdc.torpedoType] || { speedKnots: safeNumber(tdc.torpedoSpeedKnots, 44), maxRangeMeters: 5200, wake: true };
  const quality = clamp(tdc.solutionQuality, 0, 100);
  const confidence = clamp(tdc.contactConfidence, 0, 100);
  const rangeMeters = Math.max(0, safeNumber(tdc.rangeMeters));
  const maxRangeMeters = Math.max(1, safeNumber(torpedo.maxRangeMeters, 5200));
  const targetSpeed = Math.max(0, safeNumber(tdc.targetSpeedKnots));
  const torpedoSpeed = Math.max(1, safeNumber(torpedo.speedKnots || tdc.torpedoSpeedKnots, 44));
  const staleMs = Math.max(0, safeNumber(tdc.lastContactAgeMs));
  const aob = clamp(tdc.aobDegrees, 0, 180);
  const gyroAngle = normalizeBearing(tdc.gyroAngle);
  const bearing = tdc.bearing === null || tdc.bearing === undefined ? null : normalizeBearing(tdc.bearing);
  const depth = Math.max(0, safeNumber(snapshot.depth || snapshot.physics?.depth));
  const maxLaunchDepth = Math.max(1, safeNumber(weapons.profile?.maxLaunchDepth, 60));
  const minimum = Math.max(1, safeNumber(weapons.minimumSolutionQuality, 42));
  const phase = choosePhase({ quality, confidence, canFire: Boolean(weapons.canFire), torpedoActive: Boolean(snapshot.torpedoActive), lastResolution: weapons.lastResolution });
  const bars = buildBars({ quality, confidence, rangeMeters, maxRangeMeters, targetSpeed, torpedoSpeed, staleMs, aob, canFire: Boolean(weapons.canFire), minimum });
  const ratio = clamp((targetSpeed / torpedoSpeed) * Math.sin((aob * Math.PI) / 180), -0.95, 0.95);
  const leadAngle = Math.asin(ratio) * 180 / Math.PI;
  const impactSeconds = rangeMeters > 0 ? rangeMeters / (torpedoSpeed * 0.514444) : 0;
  const dispersion = rangeMeters ? Math.max(12, rangeMeters * clamp((100 - quality) / 240, 0.035, 0.38)) : 0;
  const stability = clamp(quality * 0.52 + confidence * 0.36 + bars.motion * 0.12 - staleMs / 1600, 0, 100);
  const aspect = targetAspect(aob);
  const recommendation = chooseRecommendation({ phase, quality, confidence, canFire: Boolean(weapons.canFire), fireReason: weapons.fireReason, rangeMeters, maxRangeMeters, depth, maxLaunchDepth, torpedoActive: Boolean(snapshot.torpedoActive) });
  const state = recommendation.state === 'fire' ? 'fire' : recommendation.state === 'observe' ? 'observe' : quality >= 58 ? 'wait' : 'hold';
  const activeShots = Array.isArray(weapons.activeShots) ? weapons.activeShots : [];
  const leadingShot = activeShots[0] || null;
  const runProgress = leadingShot ? clamp(100 - (safeNumber(leadingShot.remainingMs) / Math.max(1, safeNumber(leadingShot.travelMs, leadingShot.remainingMs))) * 100, 0, 100) : 0;
  return {
    phase: PHASE32_TORPEDO_ATTACK_DIRECTOR.phase,
    system: PHASE32_TORPEDO_ATTACK_DIRECTOR.system,
    version: PHASE32_TORPEDO_ATTACK_DIRECTOR.version,
    attackPhase: phase.id,
    attackPhaseKey: phase.key,
    state,
    quality: Math.round(quality),
    confidence: Math.round(confidence),
    bars,
    bearing,
    bearingLabel: bearing === null ? '--' : formatDegrees(bearing),
    gyroAngle: Math.round(gyroAngle),
    gyroLabel: formatDegrees(gyroAngle),
    rangeMeters: Math.round(rangeMeters),
    rangeLabel: formatRange(rangeMeters),
    maxRangeLabel: formatRange(maxRangeMeters),
    targetSpeed: Math.round(targetSpeed * 10) / 10,
    targetSpeedLabel: `${(Math.round(targetSpeed * 10) / 10).toFixed(1)} kn`,
    torpedoSpeedLabel: `${Math.round(torpedoSpeed)} kn`,
    aob: Math.round(aob),
    aspect,
    leadAngle: Math.round(leadAngle * 10) / 10,
    leadLabel: `${Math.round(leadAngle * 10) / 10}°`,
    impactSeconds: Math.round(impactSeconds),
    impactLabel: formatSeconds(impactSeconds),
    dispersionMeters: Math.round(dispersion),
    dispersionLabel: dispersion ? `${Math.round(dispersion)} m` : '--',
    stability: Math.round(stability),
    recommendationKey: recommendation.key,
    recommendationState: recommendation.state,
    canFire: Boolean(weapons.canFire),
    fireReason: weapons.fireReason || null,
    activeShots: activeShots.length,
    shotFeedbackKey: leadingShot ? (leadingShot.predictedHit ? 'torpedoDirector.shotPredictedHit' : 'torpedoDirector.shotTracking') : (weapons.lastResolution?.outcome === 'hit' ? 'torpedoDirector.shotHit' : weapons.lastResolution?.outcome ? 'torpedoDirector.shotMiss' : 'torpedoDirector.shotNone'),
    runProgress: Math.round(runProgress),
    style: `--phase32-bearing:${bearing === null ? 0 : Math.round(bearing)}deg;--phase32-gyro:${Math.round(gyroAngle)}deg;--phase32-lead:${Math.round(leadAngle)}deg;--phase32-run:${Math.round(runProgress)}%;--phase32-dispersion:${clamp(dispersion / 18, 2, 24).toFixed(1)}px;`,
    layers: PHASE32_TORPEDO_ATTACK_DIRECTOR.layers,
  };
}
