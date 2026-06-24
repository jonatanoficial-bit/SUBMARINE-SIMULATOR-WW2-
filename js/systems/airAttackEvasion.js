const phase28Clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const phase28Round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
};

export const PHASE28_AIR_ATTACK_EVASION = Object.freeze({
  phase: 28,
  operation: 'Silent Depth',
  system: 'air-attack-evasion',
  decisions: ['dive', 'silent', 'hold'],
  states: ['none', 'standby', 'patrol', 'tracking', 'attack'],
  mobileFirst: true,
  tacticalGoal: 'Detectar aeronaves ASW e oferecer decisão rápida: mergulhar, silêncio total ou manter curso.'
});

export function readAirThreat(snapshot = {}) {
  const navalAI = snapshot.navalAI || {};
  const aircraft = navalAI.aircraft || navalAI.state?.aircraft || {};
  const physics = snapshot.physics || {};
  const sensors = snapshot.sensors || {};
  const environment = snapshot.environment || {};
  const active = Boolean(aircraft.active);
  const available = aircraft.available !== false && (aircraft.available === true || active || aircraft.state === 'standby' || aircraft.state === 'patrol' || aircraft.state === 'tracking' || aircraft.state === 'attack');
  const depth = phase28Clamp(snapshot.depth ?? physics.depth ?? 0, 0, 340);
  const speedKnots = phase28Clamp(physics.actualSpeedKnots ?? snapshot.speedKnots ?? 0, 0, 26);
  const detectionScore = phase28Clamp(snapshot.detectionScore ?? 0, 0, 100);
  const aircraftConfidence = phase28Clamp(aircraft.detectionConfidence ?? 0, 0, 100);
  const state = String(active ? aircraft.state || 'patrol' : available ? 'standby' : 'none').toLowerCase();
  const visualExposure = (snapshot.periscopeOpen ? 24 : 0) + (sensors.radarMastRaised ? 22 : 0) + (depth <= 12 ? 18 : depth <= 25 ? 8 : 0);
  const acousticExposure = Math.max(0, speedKnots - 4) * 3.2 + phase28Clamp(physics.noise ?? 0, 0, 100) * 0.18;
  const weatherMask = 1 - phase28Clamp((environment.precipitation ?? 0) / 140 + (environment.fog ?? 0) / 180 + (environment.seaState ?? 0) / 260, 0, 0.58);
  const danger = phase28Clamp(
    aircraftConfidence * 0.54 + detectionScore * 0.22 + visualExposure * weatherMask + acousticExposure + (state === 'attack' ? 32 : state === 'tracking' ? 18 : state === 'patrol' ? 8 : 0),
    0,
    100
  );
  let level = 'none';
  if (!available) level = 'none';
  else if (!active) level = 'standby';
  else if (state === 'attack' || danger >= 76) level = 'attack';
  else if (state === 'tracking' || danger >= 48) level = 'tracking';
  else level = 'patrol';
  const secondsToPattern = (navalAI.depthChargePatterns || [])
    .filter((pattern) => pattern.sourceType === 'aircraft')
    .map((pattern) => Math.max(1, Math.ceil(Number(pattern.remainingMs || 0) / 1000)))
    .sort((a, b) => a - b)[0] || null;
  return {
    available,
    active,
    level,
    state,
    danger: Math.round(danger),
    confidence: Math.round(aircraftConfidence),
    depth: Math.round(depth),
    speedKnots: phase28Round(speedKnots, 1),
    x: Number(aircraft.x || 0),
    y: Number(aircraft.y || 0),
    enduranceSeconds: active ? Math.max(0, Math.ceil(Number(aircraft.enduranceMs || 0) / 1000)) : 0,
    attackCooldownSeconds: active ? Math.max(0, Math.ceil(Number(aircraft.attackCooldownMs || 0) / 1000)) : 0,
    secondsToPattern,
    passes: Math.max(0, Number(aircraft.passes || 0)),
    visualExposure: Math.round(visualExposure),
    acousticExposure: Math.round(acousticExposure),
    weatherMask: phase28Round(weatherMask, 2),
  };
}

export function recommendAirEvasionAction(threat = {}) {
  if (!threat.available) return { id: 'none', key: 'airAttack.recommend.none', priority: 0 };
  if (threat.level === 'attack' || threat.danger >= 74) return { id: 'dive', key: 'airAttack.recommend.dive', priority: 10 };
  if (threat.level === 'tracking' || threat.danger >= 45) return { id: 'silent', key: 'airAttack.recommend.silent', priority: 7 };
  if (threat.level === 'patrol') return { id: 'hold', key: 'airAttack.recommend.hold', priority: 4 };
  return { id: 'watch', key: 'airAttack.recommend.watch', priority: 2 };
}

export function buildAirAttackView({ snapshot = {}, mission = {} } = {}) {
  const threat = readAirThreat(snapshot);
  const recommendation = recommendAirEvasionAction(threat);
  const level = threat.level;
  const labelKey = `airAttack.level.${level}`;
  const titleKey = threat.level === 'attack' ? 'airAttack.title.attack' : threat.level === 'tracking' ? 'airAttack.title.tracking' : threat.level === 'patrol' ? 'airAttack.title.patrol' : threat.available ? 'airAttack.title.standby' : 'airAttack.title.none';
  const messageKey = threat.level === 'attack' ? 'airAttack.message.attack' : threat.level === 'tracking' ? 'airAttack.message.tracking' : threat.level === 'patrol' ? 'airAttack.message.patrol' : threat.available ? 'airAttack.message.standby' : 'airAttack.message.none';
  const threatRing = threat.danger >= 75 ? 'critical' : threat.danger >= 48 ? 'warning' : threat.danger >= 20 ? 'watch' : 'clear';
  const radarLeft = phase28Clamp(50 + threat.x / 8, 5, 95);
  const radarTop = phase28Clamp(50 + threat.y / 6, 5, 95);
  return {
    ...threat,
    missionId: mission?.id || null,
    labelKey,
    titleKey,
    messageKey,
    recommendation,
    threatRing,
    shouldInterrupt: ['tracking', 'attack'].includes(level),
    shouldPulse: ['tracking', 'attack'].includes(level),
    markerStyle: `left:${phase28Round(radarLeft, 1)}%;top:${phase28Round(radarTop, 1)}%`,
    cssVars: {
      '--phase28-air-danger': String(phase28Clamp(threat.danger / 100, 0, 1)),
      '--phase28-air-x': `${phase28Round(radarLeft, 1)}%`,
      '--phase28-air-y': `${phase28Round(radarTop, 1)}%`,
    }
  };
}

export function shouldAirThreatInterrupt({ previous = null, next = null } = {}) {
  if (!next) return false;
  if (!previous) return Boolean(next.shouldInterrupt);
  const order = { none: 0, standby: 1, patrol: 3, tracking: 6, attack: 9 };
  return (order[next.level] || 0) > (order[previous.level] || 0) || (next.level === 'attack' && previous.level !== 'attack');
}
