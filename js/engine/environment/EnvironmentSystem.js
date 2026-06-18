import { clamp } from '../simulation/simulationMath.js';

const SEA_STATE_MAX = 6;

function hashText(value = '') {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeBearing(value) {
  return ((Number(value) % 360) + 360) % 360;
}

function difficultyNumber(value) {
  const table = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  return table[String(value || 'I').toUpperCase()] || clamp(Number(value) || 1, 1, 5);
}

function theatreProfile(theatreKey = '') {
  const key = String(theatreKey).toLowerCase();
  if (key.includes('mediterranean')) return { temperature: 20, visibility: 11200, seaBias: -0.7, layer: 36 };
  if (key.includes('pacific')) return { temperature: 24, visibility: 9600, seaBias: 0.2, layer: 48 };
  if (key.includes('arctic') || key.includes('north')) return { temperature: 5, visibility: 7200, seaBias: 0.8, layer: 24 };
  if (key.includes('coast')) return { temperature: 14, visibility: 7600, seaBias: 0.35, layer: 30 };
  return { temperature: 11, visibility: 8500, seaBias: 0.55, layer: 32 };
}

function daylightAtHour(hour) {
  const normalized = ((Number(hour) % 24) + 24) % 24;
  if (normalized < 4.5 || normalized >= 21) return 0;
  if (normalized < 6.5) return ((normalized - 4.5) / 2) * 65;
  if (normalized < 8) return 65 + ((normalized - 6.5) / 1.5) * 35;
  if (normalized < 17.5) return 100;
  if (normalized < 20.5) return Math.max(0, 100 - ((normalized - 17.5) / 3) * 100);
  return 0;
}

function lightCondition(daylight) {
  if (daylight >= 78) return 'day';
  if (daylight >= 28) return 'dawnDusk';
  if (daylight > 0) return 'twilight';
  return 'night';
}

export class EnvironmentSystem {
  constructor({ mission = {}, initialSnapshot = null } = {}) {
    this.mission = mission || {};
    const seed = hashText(`${mission.id || 'mission'}:${mission.year || 1939}:${mission.theatreKey || 'atlantic'}`);
    const theatre = theatreProfile(mission.theatreKey);
    const difficulty = difficultyNumber(mission.difficulty);
    const initialHour = 4.75 + ((seed % 1320) / 1320) * 15.5;
    const seaState = clamp(Math.round(1 + difficulty * 0.55 + theatre.seaBias + ((seed >>> 5) % 3) * 0.35), 0, SEA_STATE_MAX);
    const precipitation = clamp(((seed >>> 9) % 100) * (seaState >= 4 ? 0.75 : 0.42), 0, 82);
    const cloudCover = clamp(25 + precipitation * 0.7 + seaState * 5, 8, 100);
    this.seed = seed;
    this.base = { theatre, difficulty, seaState, precipitation, cloudCover };
    this.state = {
      elapsedMs: 0,
      hour: initialHour,
      seaState,
      windKnots: clamp(4 + seaState * 4.2 + ((seed >>> 13) % 7), 2, 34),
      windBearing: normalizeBearing(seed % 360),
      precipitation,
      cloudCover,
      visibilityMeters: theatre.visibility,
      daylight: daylightAtHour(initialHour),
      lightCondition: 'day',
      moonlight: clamp(((seed >>> 18) % 100), 8, 92),
      waterTemperatureC: theatre.temperature + (((seed >>> 21) % 7) - 3),
      thermalLayerDepth: theatre.layer + (((seed >>> 24) % 15) - 7),
      ambientNoise: 0,
      acousticPropagation: 1,
      visualFactor: 1,
      radarClutter: 0,
      wavePhase: 0,
      rollDegrees: 0,
      pitchDegrees: 0,
      horizonOffset: 0,
      lastMessageKey: 'environment.steady',
    };
    this.recalculate();
    if (initialSnapshot) this.restore(initialSnapshot);
  }

  recalculate() {
    const s = this.state;
    s.daylight = daylightAtHour(s.hour);
    s.lightCondition = lightCondition(s.daylight);
    const weatherVisibility = this.base.theatre.visibility
      * (1 - s.precipitation / 150)
      * (1 - s.cloudCover / 480)
      * (1 - s.seaState * 0.045);
    const nightFactor = s.daylight <= 0 ? 0.34 + s.moonlight / 220 : 0.7 + s.daylight / 330;
    s.visibilityMeters = clamp(weatherVisibility * nightFactor, 850, 14500);
    s.ambientNoise = clamp(8 + s.seaState * 10 + s.windKnots * 0.45 + s.precipitation * 0.18, 6, 92);
    const layerBonus = s.thermalLayerDepth >= 28 && s.thermalLayerDepth <= 58 ? 0.1 : 0;
    s.acousticPropagation = clamp(1.12 - s.ambientNoise / 180 + layerBonus, 0.48, 1.22);
    s.visualFactor = clamp((s.visibilityMeters / 9000) * (0.55 + s.daylight / 220), 0.16, 1.12);
    s.radarClutter = clamp(s.seaState * 9 + s.precipitation * 0.55, 0, 92);
    const amplitude = 0.3 + s.seaState * 0.46;
    s.rollDegrees = Math.sin(s.wavePhase) * amplitude + Math.sin(s.wavePhase * 0.37) * amplitude * 0.32;
    s.pitchDegrees = Math.cos(s.wavePhase * 0.73) * amplitude * 0.52;
    s.horizonOffset = Math.sin(s.wavePhase * 0.61) * (1.2 + s.seaState * 1.15);
    s.lastMessageKey = s.seaState >= 5
      ? 'environment.heavySea'
      : s.visibilityMeters < 2800
        ? 'environment.restrictedVisibility'
        : s.lightCondition === 'night'
          ? 'environment.nightWatch'
          : 'environment.steady';
  }

  update(stepMs, { timeCompression = 1 } = {}) {
    const elapsed = Math.max(0, Number(stepMs) || 0) * clamp(Number(timeCompression) || 1, 1, 16);
    this.state.elapsedMs += elapsed;
    this.state.hour = (this.state.hour + elapsed / 3_600_000) % 24;
    this.state.wavePhase = (this.state.wavePhase + elapsed * (0.00032 + this.state.seaState * 0.000045)) % (Math.PI * 200);

    // Deterministic slow weather evolution; no random calls means save/replay parity.
    const slow = this.state.elapsedMs / 480_000 + (this.seed % 37);
    const desiredSea = clamp(this.base.seaState + Math.sin(slow) * 0.72, 0, SEA_STATE_MAX);
    const desiredRain = clamp(this.base.precipitation + Math.sin(slow * 0.67 + 1.4) * 22, 0, 90);
    const desiredCloud = clamp(this.base.cloudCover + Math.sin(slow * 0.43 + 0.8) * 16, 5, 100);
    const approach = clamp(elapsed / 240_000, 0, 0.08);
    this.state.seaState += (desiredSea - this.state.seaState) * approach;
    this.state.precipitation += (desiredRain - this.state.precipitation) * approach;
    this.state.cloudCover += (desiredCloud - this.state.cloudCover) * approach;
    this.state.windKnots = clamp(4 + this.state.seaState * 4.4 + Math.sin(slow * 0.31) * 3.5, 1, 38);
    this.state.windBearing = normalizeBearing(this.state.windBearing + elapsed / 180_000);
    this.recalculate();
    return this.snapshot();
  }

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    const numeric = [
      ['elapsedMs', 0, Number.MAX_SAFE_INTEGER], ['hour', 0, 24], ['seaState', 0, SEA_STATE_MAX],
      ['windKnots', 0, 60], ['windBearing', 0, 360], ['precipitation', 0, 100],
      ['cloudCover', 0, 100], ['moonlight', 0, 100], ['waterTemperatureC', -5, 40],
      ['thermalLayerDepth', 5, 120], ['wavePhase', 0, Math.PI * 200],
    ];
    for (const [key, min, max] of numeric) {
      const value = Number(snapshot[key]);
      if (Number.isFinite(value)) this.state[key] = clamp(value, min, max);
    }
    this.recalculate();
    return true;
  }

  snapshot() {
    return {
      environmentVersion: 1,
      elapsedMs: this.state.elapsedMs,
      hour: this.state.hour,
      seaState: this.state.seaState,
      beaufort: Math.round(clamp(this.state.windKnots / 3.1, 0, 12)),
      windKnots: this.state.windKnots,
      windBearing: this.state.windBearing,
      precipitation: this.state.precipitation,
      cloudCover: this.state.cloudCover,
      visibilityMeters: this.state.visibilityMeters,
      daylight: this.state.daylight,
      lightCondition: this.state.lightCondition,
      moonlight: this.state.moonlight,
      waterTemperatureC: this.state.waterTemperatureC,
      thermalLayerDepth: this.state.thermalLayerDepth,
      ambientNoise: this.state.ambientNoise,
      acousticPropagation: this.state.acousticPropagation,
      visualFactor: this.state.visualFactor,
      radarClutter: this.state.radarClutter,
      wavePhase: this.state.wavePhase,
      rollDegrees: this.state.rollDegrees,
      pitchDegrees: this.state.pitchDegrees,
      horizonOffset: this.state.horizonOffset,
      lastMessageKey: this.state.lastMessageKey,
    };
  }
}
