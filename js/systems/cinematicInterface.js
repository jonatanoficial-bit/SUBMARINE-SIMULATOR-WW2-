export const PHASE36_CINEMATIC_INTERFACE = Object.freeze({
  phase: '36',
  system: 'premium-cinematic-interface',
  version: 'v2.0.0-alpha.51',
  layers: ['letterbox', 'film-grain', 'vignette', 'command-focus', 'scene-director', 'mobile-premium-hud'],
  mobileFirst: true,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pct(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

function pickMood({ snapshot = {}, station = 'command' } = {}) {
  const hull = safeNumber(snapshot.hull, 100);
  const detection = safeNumber(snapshot.detectionScore);
  const aiThreat = snapshot.navalAI?.threatLevel || 'clear';
  const alertLevel = snapshot.alertAtmosphere?.level || snapshot.alertLevel;
  const aircraft = snapshot.navalAI?.aircraft || snapshot.airThreat || {};
  const depthPattern = Array.isArray(snapshot.navalAI?.depthChargePatterns) && snapshot.navalAI.depthChargePatterns.length > 0;
  if (snapshot.missionFailed || hull <= 0) return 'lost';
  if (snapshot.targetDestroyed && !snapshot.torpedoActive) return 'success';
  if (hull <= 34 || alertLevel === 'emergency' || depthPattern) return 'emergency';
  if (snapshot.torpedoActive || aircraft.state === 'attack' || aiThreat === 'critical') return 'action';
  if (detection >= 50 || aiThreat === 'warning' || aircraft.active || ['combat', 'evasion'].includes(alertLevel)) return 'tension';
  if (station === 'periscope' || snapshot.periscopeOpen || detection >= 18) return 'patrol';
  return 'calm';
}

function sceneKeyForMood(mood) {
  return {
    calm: 'cinematic.sceneSilentPatrol',
    patrol: 'cinematic.scenePeriscopeWatch',
    tension: 'cinematic.sceneEnemyNear',
    action: 'cinematic.sceneAttackRun',
    emergency: 'cinematic.sceneEmergency',
    success: 'cinematic.sceneTargetDown',
    lost: 'cinematic.sceneLostBoat',
  }[mood] || 'cinematic.sceneSilentPatrol';
}

function cueKeyForMood(mood) {
  return {
    calm: 'cinematic.cueCalm',
    patrol: 'cinematic.cuePatrol',
    tension: 'cinematic.cueTension',
    action: 'cinematic.cueAction',
    emergency: 'cinematic.cueEmergency',
    success: 'cinematic.cueSuccess',
    lost: 'cinematic.cueLost',
  }[mood] || 'cinematic.cueCalm';
}

function transitionForMood(mood) {
  return ['action', 'emergency', 'lost'].includes(mood) ? 'hard-cut' : mood === 'tension' ? 'push-in' : mood === 'success' ? 'fade-gold' : 'slow-drift';
}

export function buildCinematicInterfaceView({ snapshot = {}, mission = {}, station = 'command' } = {}) {
  const mood = pickMood({ snapshot, station });
  const hullRisk = 100 - clamp(snapshot.hull ?? 100, 0, 100);
  const detection = clamp(snapshot.detectionScore, 0, 100);
  const aircraft = snapshot.navalAI?.aircraft || snapshot.airThreat || {};
  const aiThreat = snapshot.navalAI?.threatLevel || 'clear';
  const pressure = clamp(snapshot.physics?.pressurePercent || 0, 0, 100);
  const torpedo = snapshot.torpedoActive ? 24 : 0;
  const aircraftRisk = aircraft.state === 'attack' ? 28 : aircraft.active ? 13 : 0;
  const aiRisk = aiThreat === 'critical' ? 22 : aiThreat === 'warning' ? 10 : 0;
  const cinematicScore = clamp(hullRisk * 0.44 + detection * 0.28 + pressure * 0.12 + torpedo + aircraftRisk + aiRisk, 0, 100);
  const focus = mood === 'calm' ? 24 : mood === 'patrol' ? 38 : mood === 'tension' ? 58 : mood === 'action' ? 76 : mood === 'emergency' || mood === 'lost' ? 92 : 64;
  const vignette = clamp(0.22 + cinematicScore / 180, 0.18, 0.84);
  const grain = clamp(0.12 + cinematicScore / 220, 0.1, 0.62);
  const shake = ['action', 'emergency', 'lost'].includes(mood) ? clamp(1 + cinematicScore / 18, 1.2, 7.2) : mood === 'tension' ? clamp(cinematicScore / 32, 0.6, 2.8) : 0;
  const red = mood === 'emergency' || mood === 'lost' ? 0.58 : mood === 'action' ? 0.34 : mood === 'tension' ? 0.16 : 0.04;
  const letterbox = mood === 'action' || mood === 'emergency' || mood === 'success' || mood === 'lost' ? 16 : mood === 'tension' ? 12 : 8;
  return {
    phase: PHASE36_CINEMATIC_INTERFACE.phase,
    system: PHASE36_CINEMATIC_INTERFACE.system,
    version: PHASE36_CINEMATIC_INTERFACE.version,
    mood,
    transition: transitionForMood(mood),
    sceneKey: sceneKeyForMood(mood),
    cueKey: cueKeyForMood(mood),
    missionTitleKey: mission?.titleKey || 'gameplay.title',
    score: Math.round(cinematicScore),
    labels: {
      intensity: pct(cinematicScore),
      focus: pct(focus),
      filmMode: `cinematic.mode.${mood}`,
    },
    shouldPulse: ['action', 'emergency', 'lost'].includes(mood) || cinematicScore >= 72,
    cssVars: {
      '--phase36-vignette': vignette.toFixed(3),
      '--phase36-grain': grain.toFixed(3),
      '--phase36-shake': `${shake.toFixed(2)}px`,
      '--phase36-red': red.toFixed(3),
      '--phase36-letterbox': `${letterbox}px`,
      '--phase36-focus': `${Math.round(focus)}%`,
    },
  };
}

export function shouldCinematicTransition({ previous, next } = {}) {
  if (!next) return false;
  if (!previous) return ['action', 'emergency', 'lost'].includes(next.mood);
  if (previous.mood !== next.mood) return true;
  return Math.abs(safeNumber(next.score) - safeNumber(previous.score)) >= 24;
}
