const phase27Clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const phase27Round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

export const PHASE27_ALERT_ATMOSPHERE = Object.freeze({
  phase: 27,
  operation: 'Silent Depth',
  system: 'alert-atmosphere',
  levels: ['calm', 'suspicion', 'combat', 'evasion', 'emergency'],
  mobileFirst: true,
  cinematicBridge: true
});

function readAircraft(snapshot = {}) {
  return snapshot.navalAI?.aircraft || snapshot.ai?.aircraft || snapshot.aircraft || {};
}

function readDetection(snapshot = {}) {
  const sensors = snapshot.sensors || {};
  const target = sensors.contacts?.target || sensors.strongestContact || {};
  const escort = sensors.contacts?.escort || {};
  return phase27Clamp(
    snapshot.detectionScore ?? sensors.detectionScore ?? target.confidence ?? escort.confidence ?? 0,
    0,
    100
  );
}

export function calculateAlertThreatScore({ snapshot = {}, mission = {} } = {}) {
  const physics = snapshot.physics || {};
  const sensors = snapshot.sensors || {};
  const weapons = snapshot.weapons || {};
  const damage = snapshot.damage || snapshot.damageControl || {};
  const aircraft = readAircraft(snapshot);
  const hull = phase27Clamp(snapshot.hull ?? 100, 0, 100);
  const pressure = phase27Clamp(physics.pressurePercent ?? physics.pressure ?? snapshot.pressure ?? 0, 0, 120);
  const oxygen = phase27Clamp(physics.oxygen ?? 100, 0, 100);
  const battery = phase27Clamp(physics.battery ?? 100, 0, 100);
  const detection = readDetection(snapshot);
  const speedKnots = phase27Clamp(physics.actualSpeedKnots ?? snapshot.actualSpeedKnots ?? 0, 0, 28);
  const contactCount = Number(sensors.contactCount ?? sensors.contacts?.count ?? 0) || (sensors.contacts ? Object.keys(sensors.contacts).length : 0);
  const escortState = String(snapshot.escortState || snapshot.navalAI?.escortState || '').toLowerCase();
  const aircraftActive = Boolean(aircraft.active) || ['tracking', 'attack', 'attack-run', 'inbound'].includes(String(aircraft.state || '').toLowerCase());
  const torpedoActive = Boolean(snapshot.torpedoActive || weapons.torpedoActive);
  const depth = Number(physics.depth ?? snapshot.depth ?? 0);
  const systemCritical = Number(damage.criticalCount || 0) * 10;
  const difficulty = { I: 2, II: 5, III: 8, IV: 12, V: 16 }[String(mission.difficulty || 'II').toUpperCase()] || 5;
  const escortPressure = escortState === 'hunt' ? 26 : escortState === 'alert' ? 18 : escortState === 'search' ? 12 : 0;
  const aircraftPressure = aircraftActive ? 30 : 0;
  const combatPressure = torpedoActive || snapshot.targetDestroyed ? 10 : 0;
  const score = detection * 0.34
    + pressure * 0.25
    + (100 - hull) * 0.30
    + (100 - oxygen) * 0.10
    + (100 - battery) * 0.08
    + speedKnots * 1.25
    + contactCount * 2.2
    + escortPressure
    + aircraftPressure
    + combatPressure
    + systemCritical
    + (depth > 220 ? 24 : depth > 170 ? 12 : 0)
    + difficulty;
  return phase27Round(phase27Clamp(score, 0, 100));
}

export function classifyAlertAtmosphere({ snapshot = {}, mission = {}, station = 'command' } = {}) {
  const score = calculateAlertThreatScore({ snapshot, mission });
  const physics = snapshot.physics || {};
  const weapons = snapshot.weapons || {};
  const aircraft = readAircraft(snapshot);
  const aircraftActive = Boolean(aircraft.active) || ['tracking', 'attack', 'attack-run', 'inbound'].includes(String(aircraft.state || '').toLowerCase());
  const hull = phase27Clamp(snapshot.hull ?? 100, 0, 100);
  const pressure = phase27Clamp(physics.pressurePercent ?? physics.pressure ?? snapshot.pressure ?? 0, 0, 120);
  const escortState = String(snapshot.escortState || '').toLowerCase();
  const silentTicks = Number(snapshot.silentTicks || 0);
  const emergencyDiveCooldown = Number(snapshot.emergencyDiveCooldown || 0);
  const torpedoActive = Boolean(snapshot.torpedoActive || weapons.torpedoActive);
  let level = 'calm';
  if (snapshot.missionFailed || hull <= 0 || hull < 34 || pressure >= 92 || aircraftActive) level = 'emergency';
  else if (escortState === 'hunt' || torpedoActive || score >= 68) level = 'combat';
  else if (silentTicks > 0 || emergencyDiveCooldown > 0 || escortState === 'alert' || score >= 50) level = 'evasion';
  else if (readDetection(snapshot) >= 34 || score >= 28) level = 'suspicion';

  const tone = level === 'emergency' ? 'critical' : level === 'combat' ? 'danger' : level === 'evasion' ? 'evasive' : level === 'suspicion' ? 'watch' : 'calm';
  const stationHint = level === 'emergency' ? 'damage' : level === 'combat' ? 'weapons' : level === 'evasion' ? 'sensors' : station;
  const lamps = {
    calm: ['dim', 'dim', 'dim', 'off', 'off'],
    suspicion: ['green', 'amber', 'dim', 'off', 'off'],
    evasion: ['amber', 'amber', 'red', 'dim', 'off'],
    combat: ['red', 'amber', 'red', 'amber', 'dim'],
    emergency: ['red', 'red', 'red', 'red', 'red']
  }[level] || ['dim', 'dim', 'dim', 'off', 'off'];
  return {
    id: level,
    level,
    tone,
    stationHint,
    score,
    priority: { calm: 1, suspicion: 3, evasion: 5, combat: 7, emergency: 10 }[level] || 1,
    labelKey: `alert.level.${level}`,
    titleKey: `alert.title.${level}`,
    messageKey: `alert.message.${level}`,
    orderKey: `alert.order.${level}`,
    soundscapeKey: `alert.soundscape.${level}`,
    bodyClass: `phase27-alert-${level}`,
    shouldPulse: ['combat', 'emergency'].includes(level),
    shouldInterrupt: ['combat', 'emergency'].includes(level),
    lamps
  };
}

export function buildAlertAtmosphereView({ snapshot = {}, mission = {}, station = 'command' } = {}) {
  const state = classifyAlertAtmosphere({ snapshot, mission, station });
  const dimming = phase27Round(phase27Clamp(state.score / 115, 0.08, 0.92), 2);
  const vibration = phase27Round(phase27Clamp(state.score / 95, 0.04, 1.15), 2);
  const redWash = phase27Round(phase27Clamp((state.score - 35) / 80, 0, 0.92), 2);
  const scanRate = state.level === 'emergency' ? 'fast' : state.level === 'combat' ? 'tense' : state.level === 'evasion' ? 'silent' : 'slow';
  return {
    ...state,
    cssVars: {
      '--phase27-dimming': String(dimming),
      '--phase27-vibration': String(vibration),
      '--phase27-red-wash': String(redWash)
    },
    scanRate,
    lampsMarkup: state.lamps.map((lamp, index) => `<i data-lamp="${lamp}" data-index="${index}"></i>`).join('')
  };
}

export function shouldAlertEscalate({ previous = null, next = null } = {}) {
  if (!next) return false;
  if (!previous) return next.priority >= 5;
  return next.priority > previous.priority || (next.level === 'emergency' && previous.level !== 'emergency');
}
