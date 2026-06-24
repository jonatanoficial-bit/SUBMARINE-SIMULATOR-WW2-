export const PHASE35_DEPTH_STEALTH = Object.freeze({
  phase: '35',
  system: 'depth-stealth-realism',
  version: 'v2.0.0-alpha.50',
  layers: ['thermal-layer', 'cavitation-envelope', 'acoustic-shadow', 'depth-risk', 'silent-running-advice'],
  mobileFirst: true,
});

function clamp(value, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : 0));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pct(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

function meters(value) {
  return `${Math.round(Math.max(0, safeNumber(value)))} m`;
}

function classifyBand(score) {
  if (score >= 74) return 'critical';
  if (score >= 48) return 'danger';
  if (score >= 24) return 'caution';
  return 'quiet';
}

function layerDepth(environment = {}, physics = {}) {
  const fromEnvironment = safeNumber(environment.thermalLayerDepth, NaN);
  if (Number.isFinite(fromEnvironment) && fromEnvironment > 0) return fromEnvironment;
  const seaState = safeNumber(environment.seaState, 35);
  const hour = safeNumber(environment.hour, 12);
  const daylightMixing = hour >= 7 && hour <= 17 ? 8 : -4;
  const stormMixing = clamp(seaState / 100, 0, 1) * 22;
  const maxDepth = safeNumber(physics.maxOperationalDepth, 190);
  return clamp(54 + daylightMixing + stormMixing, 36, Math.max(70, maxDepth * 0.58));
}

function speedRisk(speedKnots) {
  const speed = safeNumber(speedKnots);
  if (speed <= 2.5) return 4;
  if (speed <= 5.5) return 18;
  if (speed <= 8.5) return 38;
  if (speed <= 11.5) return 62;
  return 82;
}

function classifyRecommendedDepth({ depth, maxOperationalDepth, layer }) {
  const min = clamp(layer + 18, 48, maxOperationalDepth * 0.82);
  const max = clamp(maxOperationalDepth * 0.82, min + 10, maxOperationalDepth - 8);
  const target = clamp(Math.max(min, depth < layer ? layer + 26 : depth), min, max);
  return { min, max, target };
}

export function buildDepthStealthView({ snapshot = {}, mission = {} } = {}) {
  const physics = snapshot.physics || {};
  const environment = snapshot.environment || {};
  const sensors = snapshot.sensors || {};
  const depth = safeNumber(physics.depth ?? snapshot.depth, 12);
  const maxOperationalDepth = Math.max(90, safeNumber(physics.maxOperationalDepth, 190));
  const crushDepth = Math.max(maxOperationalDepth + 25, safeNumber(physics.crushDepth, maxOperationalDepth + 80));
  const speed = safeNumber(physics.actualSpeedKnots, 0);
  const cavitation = clamp(physics.cavitation, 0, 100);
  const noise = clamp(physics.noise, 0, 100);
  const pressure = clamp(physics.pressurePercent, 0, 180);
  const thermalLayer = layerDepth(environment, physics);
  const layerDelta = depth - thermalLayer;
  const belowLayer = layerDelta >= 8;
  const inLayer = Math.abs(layerDelta) < 8;
  const layerShield = belowLayer ? clamp(22 + Math.min(28, layerDelta * 0.42), 0, 50) : inLayer ? 12 : 0;
  const shallowPenalty = depth <= 18 ? 30 : depth < thermalLayer ? clamp((thermalLayer - depth) * 0.55, 0, 26) : 0;
  const depthPressureRisk = pressure >= 100 ? clamp((pressure - 86) * 1.25, 0, 100) : clamp((depth / maxOperationalDepth) * 22, 0, 28);
  const acousticLeak = clamp(noise * 0.44 + cavitation * 0.38 + speedRisk(speed) * 0.22 + shallowPenalty - layerShield, 0, 100);
  const detectionContext = clamp(safeNumber(snapshot.detectionScore, 0) * 0.42 + safeNumber(sensors.contacts?.escort?.confidence, 0) * 0.26 + safeNumber(snapshot.navalAI?.contactConfidence, 0) * 0.22, 0, 100);
  const stealthScore = clamp(100 - acousticLeak - detectionContext * 0.32 - depthPressureRisk * 0.18, 0, 100);
  const riskScore = clamp(acousticLeak * 0.48 + detectionContext * 0.34 + depthPressureRisk * 0.18, 0, 100);
  const band = classifyBand(riskScore);
  const recommended = classifyRecommendedDepth({ depth, maxOperationalDepth, layer: thermalLayer });
  const layerState = belowLayer ? 'below' : inLayer ? 'inside' : 'above';
  const cavitationState = cavitation >= 58 ? 'critical' : cavitation >= 28 ? 'warning' : 'quiet';
  const pressureState = pressure >= 105 ? 'overdepth' : pressure >= 82 ? 'deep' : 'safe';
  const silentAdvantage = clamp(layerShield + (snapshot.silentTicks > 0 ? 26 : 0) - speedRisk(speed) * 0.15, 0, 100);
  const adviceKey = band === 'critical'
    ? 'depthStealth.adviceCritical'
    : cavitationState === 'critical'
      ? 'depthStealth.adviceCavitation'
      : layerState === 'above'
        ? 'depthStealth.adviceBelowLayer'
        : pressureState === 'overdepth'
          ? 'depthStealth.advicePressure'
          : snapshot.silentTicks > 0 ? 'depthStealth.adviceHoldSilent' : 'depthStealth.adviceSilent';
  return {
    phase: PHASE35_DEPTH_STEALTH.phase,
    system: PHASE35_DEPTH_STEALTH.system,
    version: PHASE35_DEPTH_STEALTH.version,
    band,
    levelKey: `depthStealth.level.${band}`,
    layerState,
    layerKey: `depthStealth.layer.${layerState}`,
    cavitationState,
    cavitationKey: `depthStealth.cavitation.${cavitationState}`,
    pressureState,
    pressureKey: `depthStealth.pressure.${pressureState}`,
    adviceKey,
    depth,
    depthLabel: meters(depth),
    thermalLayer,
    thermalLayerLabel: meters(thermalLayer),
    recommended,
    recommendedLabel: `${meters(recommended.min)}–${meters(recommended.max)}`,
    targetDepthLabel: meters(recommended.target),
    bars: {
      stealth: Math.round(stealthScore),
      acousticLeak: Math.round(acousticLeak),
      layerShield: Math.round(layerShield),
      pressureRisk: Math.round(depthPressureRisk),
      silentAdvantage: Math.round(silentAdvantage),
      risk: Math.round(riskScore),
    },
    labels: {
      stealth: pct(stealthScore),
      acousticLeak: pct(acousticLeak),
      layerShield: pct(layerShield),
      pressureRisk: pct(depthPressureRisk),
      silentAdvantage: pct(silentAdvantage),
      risk: pct(riskScore),
    },
    cssVars: {
      '--phase35-depth': `${clamp((depth / crushDepth) * 100, 0, 100).toFixed(1)}%`,
      '--phase35-layer': `${clamp((thermalLayer / crushDepth) * 100, 0, 100).toFixed(1)}%`,
      '--phase35-risk': pct(riskScore),
      '--phase35-stealth': pct(stealthScore),
    },
  };
}

export function shouldDepthStealthEscalate({ previous = null, next = null } = {}) {
  if (!next) return false;
  if (!previous) return ['danger', 'critical'].includes(next.band);
  const order = { quiet: 0, caution: 1, danger: 2, critical: 3 };
  return (order[next.band] || 0) > (order[previous.band] || 0)
    || next.bars.risk - previous.bars.risk >= 18
    || next.cavitationState === 'critical' && previous.cavitationState !== 'critical';
}
