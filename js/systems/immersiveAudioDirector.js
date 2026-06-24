export const PHASE37_IMMERSIVE_AUDIO = Object.freeze({
  phase: '37',
  system: 'immersive-audio-director',
  version: 'v2.0.0-alpha.52',
  layers: ['sonar-ping', 'hull-creak', 'crew-callouts', 'klaxon', 'pressure-drone', 'radio-static'],
  mobileFirst: true,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function classifyAudioState(snapshot = {}) {
  const physics = snapshot.physics || {};
  const ai = snapshot.navalAI || {};
  const damage = snapshot.damage || {};
  const aircraft = ai.aircraft || snapshot.airThreat || {};
  const pressure = clamp(physics.pressurePercent ?? snapshot.pressurePercent, 0, 120);
  const detection = clamp(snapshot.detectionScore, 0, 100);
  const hull = clamp(snapshot.hull, 0, 100);
  const depth = safeNumber(physics.depth ?? snapshot.depth);
  const noise = clamp(physics.noise, 0, 100);
  const combat = snapshot.torpedoActive || ai.globalState === 'hunt' || aircraft.state === 'attack';
  const criticalDamage = safeNumber(damage.criticalCount) > 0 || hull <= 38 || pressure >= 78;
  if (snapshot.missionFailed) return 'lost';
  if (criticalDamage) return 'emergency';
  if (combat || detection >= 68) return 'combat';
  if (depth >= 130 || pressure >= 54) return 'deep';
  if (snapshot.periscopeOpen || detection >= 32 || aircraft.active) return 'watch';
  if (noise >= 58) return 'machinery';
  return 'silent';
}

function selectCue(state, snapshot = {}) {
  const physics = snapshot.physics || {};
  const ai = snapshot.navalAI || {};
  const aircraft = ai.aircraft || snapshot.airThreat || {};
  if (state === 'lost') return 'damage';
  if (state === 'emergency') return 'klaxon';
  if (aircraft.state === 'attack') return 'crewDive';
  if (state === 'combat') return snapshot.torpedoActive ? 'torpedoRun' : 'sonarClose';
  if (state === 'deep') return 'hullCreak';
  if (state === 'watch') return snapshot.periscopeOpen ? 'periscopeWatch' : 'radioStatic';
  if (clamp(physics.noise, 0, 100) >= 58) return 'engineDrone';
  return 'subtleSonar';
}

function crewLineForState(state, snapshot = {}) {
  const physics = snapshot.physics || {};
  const ai = snapshot.navalAI || {};
  const aircraft = ai.aircraft || snapshot.airThreat || {};
  if (aircraft.state === 'attack') return 'immersiveAudio.crew.airAttack';
  if (state === 'emergency') return 'immersiveAudio.crew.emergency';
  if (state === 'combat') return snapshot.torpedoActive ? 'immersiveAudio.crew.torpedoRun' : 'immersiveAudio.crew.aswHunt';
  if (state === 'deep') return clamp(physics.pressurePercent, 0, 120) >= 70 ? 'immersiveAudio.crew.pressure' : 'immersiveAudio.crew.deepQuiet';
  if (state === 'watch') return snapshot.periscopeOpen ? 'immersiveAudio.crew.periscope' : 'immersiveAudio.crew.contactWatch';
  if (state === 'machinery') return 'immersiveAudio.crew.machinery';
  return 'immersiveAudio.crew.silent';
}

export function buildImmersiveAudioDirectorView({ snapshot = {}, station = 'command' } = {}) {
  const physics = snapshot.physics || {};
  const environment = snapshot.environment || {};
  const ai = snapshot.navalAI || {};
  const state = classifyAudioState(snapshot);
  const cue = selectCue(state, snapshot);
  const pressure = clamp(physics.pressurePercent, 0, 120);
  const noise = clamp(physics.noise, 0, 100);
  const sea = clamp(environment.seaState, 0, 6);
  const detection = clamp(snapshot.detectionScore, 0, 100);
  const intensity = clamp(
    pressure * 0.26 + noise * 0.22 + detection * 0.28 + sea * 5 +
      (ai.globalState === 'hunt' ? 18 : 0) +
      (snapshot.torpedoActive ? 16 : 0) +
      ((ai.aircraft || {}).state === 'attack' ? 18 : 0),
    0, 100,
  );
  return {
    phase: PHASE37_IMMERSIVE_AUDIO.phase,
    system: PHASE37_IMMERSIVE_AUDIO.system,
    state,
    cue,
    station,
    levelKey: `immersiveAudio.state.${state}`,
    cueKey: `immersiveAudio.cue.${cue}`,
    crewKey: crewLineForState(state, snapshot),
    mixKey: state === 'emergency' ? 'immersiveAudio.mixEmergency'
      : state === 'combat' ? 'immersiveAudio.mixCombat'
        : state === 'deep' ? 'immersiveAudio.mixDeep'
          : state === 'watch' ? 'immersiveAudio.mixWatch' : 'immersiveAudio.mixSilent',
    labels: {
      intensity: `${Math.round(intensity)}%`,
      pressure: `${Math.round(pressure)}%`,
      noise: `${Math.round(noise)}%`,
      sea: `${Math.round(sea)}`,
    },
    shouldPulse: ['emergency', 'combat', 'lost'].includes(state),
    cssVars: {
      '--phase37-intensity': `${Math.round(intensity)}%`,
      '--phase37-pressure': `${Math.round(pressure)}%`,
      '--phase37-noise': `${Math.round(noise)}%`,
    },
  };
}

export function shouldAudioCueTrigger({ previous = null, next = null } = {}) {
  if (!next) return false;
  if (!previous) return ['watch', 'combat', 'deep', 'emergency'].includes(next.state);
  if (previous.state !== next.state) return true;
  if (previous.cue !== next.cue && ['klaxon', 'crewDive', 'sonarClose', 'torpedoRun', 'hullCreak'].includes(next.cue)) return true;
  return false;
}
