import { clamp, worldToViewPosition } from '../simulation/simulationMath.js';
import { PERISCOPE_MAX_DEPTH } from '../simulation/constants.js';

const CONTACT_ROLES = Object.freeze(['target', 'escort']);
const SENSOR_MODES = Object.freeze(['hydrophone', 'radar']);
const RADAR_MAST_MAX_DEPTH = 12;
const ACTIVE_PING_COOLDOWN_MS = 12000;
const ACTIVE_PING_FLASH_MS = 1800;
const PASSIVE_REFRESH_MS = 950;
const RADAR_REFRESH_MS = 520;
const VISUAL_REFRESH_MS = 260;
const SOURCE_QUALITY = Object.freeze({ none: 0, hydrophone: 24, radar: 72, activeSonar: 82, periscope: 90 });

function normalizeBearing(value) {
  return ((Number(value) % 360) + 360) % 360;
}

function signedBearingDifference(a, b) {
  return ((normalizeBearing(a) - normalizeBearing(b) + 540) % 360) - 180;
}

function bearingDifference(a, b) {
  return Math.abs(signedBearingDifference(a, b));
}

function trueBearing(entity = {}) {
  return normalizeBearing(Math.atan2(Number(entity.x) || 0, -(Number(entity.y) || 0)) * 180 / Math.PI);
}

function trueRangeMeters(entity = {}) {
  return Math.max(0, Math.hypot(Number(entity.x) || 0, Number(entity.y) || 0) * 4);
}

function deterministicOffset(seed, magnitude) {
  const value = Math.sin(Number(seed) * 12.9898 + 78.233) * 43758.5453;
  return ((value - Math.floor(value)) * 2 - 1) * magnitude;
}

function classify(role, type, confidence) {
  if (confidence < 35) return 'unknown';
  if (confidence < 68) return role === 'escort' ? 'warship' : 'merchant';
  return type || (role === 'escort' ? 'destroyer' : 'merchant');
}

function nationFrom(submarine = {}) {
  if (submarine.nation) return submarine.nation;
  const id = String(submarine.id || 'de').toLowerCase();
  if (id.startsWith('uk_')) return 'uk';
  if (id.startsWith('us_')) return 'us';
  return 'de';
}

function buildProfile(submarine = {}, mission = {}) {
  const nation = nationFrom(submarine);
  const year = Math.max(1939, Number.parseInt(mission.year, 10) || 1939);
  const sonarRating = clamp(submarine?.stats?.stealth ?? 65, 35, 100);
  const rangeRating = clamp(submarine?.stats?.range ?? 65, 35, 100);
  const radarIntroduction = nation === 'de' ? 1942 : 1941;
  const radarAvailable = year >= radarIntroduction;
  const nationBonus = nation === 'uk' ? 1.08 : nation === 'us' ? 1.12 : 1;
  return {
    nation,
    year,
    hydrophoneRangeMeters: Math.round((2100 + sonarRating * 18) * nationBonus),
    activeSonarRangeMeters: Math.round((1700 + sonarRating * 14) * nationBonus),
    radarRangeMeters: radarAvailable ? Math.round((3200 + rangeRating * 24) * nationBonus) : 0,
    periscopeRangeMeters: Math.round(5200 + rangeRating * 22),
    currentVisualRangeMeters: Math.round(5200 + rangeRating * 22),
    radarAvailable,
    radarIntroduction,
    activeSonarAvailable: true,
    radarMastMaxDepth: RADAR_MAST_MAX_DEPTH,
  };
}

function blankContact(id, role, type) {
  return {
    id,
    role,
    type,
    detected: false,
    bearing: null,
    rangeMeters: null,
    rangeKnown: false,
    confidence: 0,
    signal: 0,
    bearingUncertainty: 180,
    rangeUncertainty: 1,
    classification: 'unknown',
    source: 'none',
    supportingSource: 'none',
    lastUpdateWorldTime: 0,
    ageMs: 0,
    stale: true,
    bearingRateDegMin: 0,
    rangeRateMps: 0,
    speedEstimateKnots: 0,
    trend: 'steady',
    aspect: 'unknown',
    history: [],
  };
}

function sourceScore(source, confidence, ageMs = 0) {
  return (SOURCE_QUALITY[source] || 0) + clamp(confidence, 0, 100) * 0.16 - Math.min(28, Math.max(0, ageMs) / 850);
}

function deriveTrend(rangeRateMps) {
  if (rangeRateMps < -0.28) return 'closing';
  if (rangeRateMps > 0.28) return 'opening';
  return 'steady';
}

function deriveAspect(bearingRateDegMin, rangeRateMps) {
  if (Math.abs(bearingRateDegMin) < 1.3 && rangeRateMps < -0.22) return 'bow';
  if (Math.abs(bearingRateDegMin) < 1.3 && rangeRateMps > 0.22) return 'stern';
  if (Math.abs(bearingRateDegMin) >= 1.3) return 'crossing';
  return 'unknown';
}

function recordHistory(contact, observation) {
  const time = Math.max(0, Number(observation.worldTime) || 0);
  const bearing = observation.bearing === null ? null : normalizeBearing(observation.bearing);
  const rangeMeters = observation.rangeMeters === null ? null : Math.max(0, Number(observation.rangeMeters) || 0);
  const previous = contact.history[contact.history.length - 1];
  if (previous && time > previous.worldTime) {
    const minutes = (time - previous.worldTime) / 60_000;
    const seconds = (time - previous.worldTime) / 1000;
    if (bearing !== null && previous.bearing !== null && minutes > 0) {
      contact.bearingRateDegMin = clamp(signedBearingDifference(bearing, previous.bearing) / minutes, -90, 90);
    }
    if (rangeMeters !== null && previous.rangeMeters !== null && seconds > 0) {
      contact.rangeRateMps = clamp((rangeMeters - previous.rangeMeters) / seconds, -20, 20);
      contact.speedEstimateKnots = clamp(Math.abs(contact.rangeRateMps) * 1.94384, 0, 36);
    }
  }
  contact.trend = deriveTrend(contact.rangeRateMps);
  contact.aspect = deriveAspect(contact.bearingRateDegMin, contact.rangeRateMps);
  contact.history.push({ worldTime: time, bearing, rangeMeters, source: observation.source });
  if (contact.history.length > 12) contact.history.splice(0, contact.history.length - 12);
}

function fuseObservation(contact, observation) {
  const incomingScore = sourceScore(observation.source, observation.confidence, 0);
  const existingScore = sourceScore(contact.source, contact.confidence, contact.ageMs);
  const replaceSolution = contact.stale || !contact.detected || incomingScore >= existingScore - 1.5;
  contact.detected = true;
  contact.supportingSource = observation.source;
  contact.confidence = clamp(Math.max(contact.confidence, observation.confidence), 0, 100);
  contact.signal = clamp(Math.max(contact.signal * 0.72, observation.signal), 0, 100);
  contact.classification = classify(contact.role, contact.type, contact.confidence);
  if (replaceSolution) {
    contact.bearing = observation.bearing;
    contact.rangeMeters = observation.rangeMeters;
    contact.rangeKnown = Boolean(observation.rangeKnown);
    contact.bearingUncertainty = observation.bearingUncertainty;
    contact.rangeUncertainty = observation.rangeUncertainty;
    contact.source = observation.source;
    contact.lastUpdateWorldTime = observation.worldTime;
    contact.ageMs = 0;
    contact.stale = false;
    recordHistory(contact, observation);
  } else {
    // A weaker source may confirm existence but cannot corrupt a newer precise solution.
    contact.ageMs = Math.max(0, contact.ageMs - 220);
    contact.stale = contact.ageMs > 9000;
  }
}

export class SensorSystem {
  constructor({ mission = {}, submarine = null, initialSnapshot = null, difficultyProfile = null } = {}) {
    this.mission = mission || {};
    this.difficultyProfile = difficultyProfile || { sensorConfidenceMultiplier: 1 };
    this.profile = buildProfile(submarine || {}, this.mission);
    this.state = {
      mode: 'hydrophone',
      hydrophoneBearing: 0,
      radarMastRaised: false,
      radarSweepAngle: 0,
      activePingCooldownMs: 0,
      activePingFlashMs: 0,
      passiveAccumulatorMs: 0,
      radarAccumulatorMs: 0,
      visualAccumulatorMs: 0,
      lastMessageKey: this.profile.radarAvailable ? 'sensors.ready' : 'sensors.radarEraUnavailable',
      contacts: {
        target: blankContact('target', 'target', mission?.targetType || 'merchant'),
        escort: blankContact('escort', 'escort', 'destroyer'),
      },
    };
    this.exposureEvents = [];
    if (initialSnapshot) this.restore(initialSnapshot);
  }

  setMode(mode) {
    if (!SENSOR_MODES.includes(mode)) return { ok: false, reason: 'invalidSensorMode' };
    if (mode === 'radar' && !this.profile.radarAvailable) return { ok: false, reason: 'radarEraUnavailable' };
    this.state.mode = mode;
    this.state.lastMessageKey = mode === 'radar' ? 'sensors.radarSelected' : 'sensors.hydrophoneSelected';
    return { ok: true, mode };
  }

  nudgeHydrophoneBearing(delta) {
    this.state.hydrophoneBearing = normalizeBearing(this.state.hydrophoneBearing + Number(delta || 0));
    this.state.mode = 'hydrophone';
    this.state.lastMessageKey = 'sensors.hydrophoneBearingChanged';
    return { ok: true, bearing: this.state.hydrophoneBearing };
  }

  toggleRadarMast(force = null, depth = 0) {
    if (!this.profile.radarAvailable) return { ok: false, reason: 'radarEraUnavailable' };
    const next = force === null ? !this.state.radarMastRaised : Boolean(force);
    if (next && Number(depth) > this.profile.radarMastMaxDepth) return { ok: false, reason: 'radarTooDeep' };
    this.state.radarMastRaised = next;
    if (next) this.state.mode = 'radar';
    this.state.lastMessageKey = next ? 'sensors.radarMastRaised' : 'sensors.radarMastLowered';
    return { ok: true, raised: next };
  }

  activePing(context = {}) {
    if (!this.profile.activeSonarAvailable) return { ok: false, reason: 'activeSonarUnavailable' };
    if ((context.systems?.sonar ?? 100) <= 10) return { ok: false, reason: 'sonarDown' };
    if (this.state.activePingCooldownMs > 0) return { ok: false, reason: 'sensorCooldown' };
    this.state.activePingCooldownMs = ACTIVE_PING_COOLDOWN_MS;
    this.state.activePingFlashMs = ACTIVE_PING_FLASH_MS;
    this.state.lastMessageKey = 'sensors.activePingSent';
    this.exposureEvents.push({ type: 'activePing', detectionBoost: 26 });
    this.observeActive(context);
    return { ok: true, contacts: this.visibleContacts().length };
  }

  observation(role, source, values, context) {
    const contact = this.state.contacts[role];
    const multiplier = clamp(Number(this.difficultyProfile.sensorConfidenceMultiplier) || 1, 0.75, 1.25);
    const assisted = {
      ...values,
      confidence: clamp(Number(values.confidence || 0) * multiplier, 0, 100),
      signal: clamp(Number(values.signal || 0) * Math.sqrt(multiplier), 0, 100),
      bearingUncertainty: Math.max(0.35, Number(values.bearingUncertainty || 0) / multiplier),
      rangeUncertainty: Math.max(0.015, Number(values.rangeUncertainty || 0) / multiplier),
    };
    fuseObservation(contact, {
      source,
      worldTime: Number(context.worldTime) || 0,
      ...assisted,
    });
  }

  observeVisual(context = {}) {
    if (!context.periscopeOpen || Number(context.depth) > PERISCOPE_MAX_DEPTH) return false;
    const health = clamp(context.systems?.periscope ?? 100, 0, 100) / 100;
    const environment = context.environment || {};
    const visibilityRange = Math.max(700, Number(environment.visibilityMeters) || this.profile.periscopeRangeMeters);
    const effectiveRange = Math.min(this.profile.periscopeRangeMeters, visibilityRange) * clamp(0.55 + health * 0.45, 0.35, 1);
    this.profile.currentVisualRangeMeters = Math.round(effectiveRange);
    let observed = false;
    for (const role of CONTACT_ROLES) {
      const entity = context.contacts?.[role];
      if (!entity || entity.destroyed) continue;
      const view = worldToViewPosition(entity, context.view || { x: 0, y: 0 });
      const range = trueRangeMeters(entity);
      const inView = Math.abs(view.dx) <= 150 && Math.abs(view.dy) <= 88 && range <= effectiveRange;
      if (!inView) continue;
      const existing = this.state.contacts[role];
      const weatherPenalty = clamp(1 - Number(environment.precipitation || 0) / 180 - Number(environment.seaState || 0) / 18, 0.34, 1);
      const confidence = clamp(Math.max(existing.confidence, 35) + (15 + health * 20) * weatherPenalty, 0, 100);
      this.observation(role, 'periscope', {
        confidence,
        bearing: normalizeBearing(trueBearing(entity) + deterministicOffset(context.worldTime + (role === 'escort' ? 7 : 3), Math.max(0.4, 3.5 - health * 3))),
        rangeMeters: Math.round(range * (1 + deterministicOffset(context.worldTime + 19, 0.04 + (1 - health) * 0.12))),
        rangeKnown: confidence >= 52,
        bearingUncertainty: Math.max(0.5, 6 - health * 4.5 + (1 - weatherPenalty) * 4),
        rangeUncertainty: Math.max(0.04, 0.18 - health * 0.1 + (1 - weatherPenalty) * 0.1),
        signal: clamp(78 * health * weatherPenalty, 0, 100),
      }, context);
      observed = true;
    }
    if (observed) this.state.lastMessageKey = 'sensors.visualContact';
    return observed;
  }

  observeActive(context = {}) {
    const health = clamp(context.systems?.sonar ?? 100, 0, 100) / 100;
    const environment = context.environment || {};
    const propagation = clamp(Number(environment.acousticPropagation) || 1, 0.45, 1.25);
    for (const role of CONTACT_ROLES) {
      const entity = context.contacts?.[role];
      if (!entity || entity.destroyed) continue;
      const range = trueRangeMeters(entity);
      if (range > this.profile.activeSonarRangeMeters * Math.max(0.35, health) * propagation) continue;
      const existing = this.state.contacts[role];
      const confidence = clamp(Math.max(existing.confidence, 58) + 25 * health, 0, 100);
      this.observation(role, 'activeSonar', {
        confidence,
        bearing: normalizeBearing(trueBearing(entity) + deterministicOffset(context.worldTime + (role === 'escort' ? 31 : 23), 1.8 - health * 1.2)),
        rangeMeters: Math.round(range * (1 + deterministicOffset(context.worldTime + 41, 0.025 + (1 - health) * 0.05))),
        rangeKnown: true,
        bearingUncertainty: Math.max(0.4, 2.4 - health * 1.7),
        rangeUncertainty: Math.max(0.02, 0.08 - health * 0.04),
        signal: clamp(85 * health * (1 - range / (this.profile.activeSonarRangeMeters * propagation * 1.45)), 8, 100),
      }, context);
    }
  }

  observePassive(context = {}) {
    const sonarHealth = clamp(context.systems?.sonar ?? 100, 0, 100) / 100;
    const ownNoise = clamp(context.physics?.noise ?? 0, 0, 100);
    const cavitation = clamp(context.physics?.cavitation ?? 0, 0, 100);
    const environment = context.environment || {};
    const ambientNoise = clamp(Number(environment.ambientNoise) || 12, 0, 100);
    const propagation = clamp(Number(environment.acousticPropagation) || 1, 0.45, 1.25);
    const layerDepth = Number(environment.thermalLayerDepth) || 36;
    const layerSeparation = Math.abs(Number(context.depth) - layerDepth);
    const layerFactor = layerSeparation <= 14 ? 1.12 : Number(context.depth) > layerDepth + 20 ? 0.78 : 0.94;
    const depthFactor = Number(context.depth) > 25 ? 1.08 : 0.9;
    for (const role of CONTACT_ROLES) {
      const entity = context.contacts?.[role];
      if (!entity || entity.destroyed) continue;
      const range = trueRangeMeters(entity);
      const sourceNoise = role === 'escort' ? 78 : 52;
      const effectiveRange = this.profile.hydrophoneRangeMeters * sonarHealth * depthFactor * propagation * layerFactor
        * clamp(1 - ownNoise / 145 - cavitation / 210 - ambientNoise / 310, 0.18, 1);
      const bearing = trueBearing(entity);
      const focusDifference = bearingDifference(bearing, this.state.hydrophoneBearing);
      const focusFactor = focusDifference <= 35 ? 1.18 : focusDifference <= 85 ? 0.9 : 0.68;
      const signal = clamp((sourceNoise * focusFactor * sonarHealth) - (range / Math.max(1, effectiveRange)) * 58 - ownNoise * 0.35 - ambientNoise * 0.12, 0, 100);
      if (range > effectiveRange || signal < 8) continue;
      const existing = this.state.contacts[role];
      const confidence = clamp(existing.confidence + 3 + signal * 0.12, 0, 78);
      const uncertainty = clamp(28 - signal * 0.2 + ownNoise * 0.08 + ambientNoise * 0.045, 4, 38);
      const rangeKnown = confidence >= 60;
      this.observation(role, 'hydrophone', {
        confidence,
        bearing: normalizeBearing(bearing + deterministicOffset(context.worldTime + (role === 'escort' ? 13 : 5), uncertainty)),
        rangeKnown,
        rangeMeters: rangeKnown ? Math.round(range * (1 + deterministicOffset(context.worldTime + 29, 0.22))) : Math.round(range / 250) * 250,
        bearingUncertainty: uncertainty,
        rangeUncertainty: rangeKnown ? 0.28 : 0.55,
        signal,
      }, context);
    }
  }

  observeRadar(context = {}) {
    if (!this.profile.radarAvailable || !this.state.radarMastRaised || Number(context.depth) > this.profile.radarMastMaxDepth) return;
    const sonarHealth = clamp(context.systems?.sonar ?? 100, 0, 100) / 100;
    const clutter = clamp(Number(context.environment?.radarClutter) || 0, 0, 100);
    const clutterFactor = clamp(1 - clutter / 170, 0.42, 1);
    for (const role of CONTACT_ROLES) {
      const entity = context.contacts?.[role];
      if (!entity || entity.destroyed) continue;
      const range = trueRangeMeters(entity);
      if (range > this.profile.radarRangeMeters * Math.max(0.4, sonarHealth) * clutterFactor) continue;
      const existing = this.state.contacts[role];
      const confidence = clamp(Math.max(existing.confidence, 70) + 12 * sonarHealth * clutterFactor, 0, 96);
      this.observation(role, 'radar', {
        confidence,
        bearing: normalizeBearing(trueBearing(entity) + deterministicOffset(context.worldTime + (role === 'escort' ? 53 : 47), 1.2 + clutter / 65)),
        rangeMeters: Math.round(range * (1 + deterministicOffset(context.worldTime + 59, 0.025 + clutter / 2600))),
        rangeKnown: true,
        bearingUncertainty: 1.2 + clutter / 38,
        rangeUncertainty: 0.04 + clutter / 1500,
        signal: clamp((92 - (range / this.profile.radarRangeMeters) * 45) * clutterFactor, 10, 100),
      }, context);
    }
  }

  update(stepMs, context = {}) {
    const elapsed = Math.max(0, Number(stepMs) || 0) * Math.max(1, Number(context.timeCompression) || 1);
    this.state.activePingCooldownMs = Math.max(0, this.state.activePingCooldownMs - elapsed);
    this.state.activePingFlashMs = Math.max(0, this.state.activePingFlashMs - elapsed);
    this.state.radarSweepAngle = normalizeBearing(this.state.radarSweepAngle + elapsed * 0.055);
    this.state.passiveAccumulatorMs += elapsed;
    this.state.radarAccumulatorMs += elapsed;
    this.state.visualAccumulatorMs += elapsed;

    if (Number(context.depth) > this.profile.radarMastMaxDepth && this.state.radarMastRaised) {
      this.state.radarMastRaised = false;
      this.state.lastMessageKey = 'sensors.radarAutoLowered';
    }

    for (const role of CONTACT_ROLES) {
      const contact = this.state.contacts[role];
      contact.ageMs += elapsed;
      contact.signal = clamp(contact.signal - elapsed / 5200, 0, 100);
      if (contact.ageMs > 9000) {
        const decayDivisor = contact.source === 'periscope' || contact.source === 'activeSonar' ? 2300 : 1800;
        contact.confidence = clamp(contact.confidence - elapsed / decayDivisor, 0, 100);
        contact.stale = true;
      }
      if (contact.confidence < 4) {
        contact.detected = false;
        contact.rangeKnown = false;
        contact.classification = 'unknown';
        contact.source = 'none';
      }
    }

    if (this.state.passiveAccumulatorMs >= PASSIVE_REFRESH_MS) {
      this.state.passiveAccumulatorMs %= PASSIVE_REFRESH_MS;
      this.observePassive(context);
    }
    if (this.state.radarAccumulatorMs >= RADAR_REFRESH_MS) {
      this.state.radarAccumulatorMs %= RADAR_REFRESH_MS;
      this.observeRadar(context);
    }
    if (this.state.visualAccumulatorMs >= VISUAL_REFRESH_MS) {
      this.state.visualAccumulatorMs %= VISUAL_REFRESH_MS;
      this.observeVisual(context);
    }
    return this.snapshot();
  }

  contact(role) {
    return this.state.contacts[role] ? structuredClone(this.state.contacts[role]) : null;
  }

  visibleContacts() {
    return CONTACT_ROLES.map((role) => this.state.contacts[role]).filter((contact) => contact.detected);
  }

  strongestContact() {
    return this.visibleContacts().sort((a, b) => (b.signal + b.confidence * 0.35) - (a.signal + a.confidence * 0.35))[0] || null;
  }

  drainExposureEvents() {
    return this.exposureEvents.splice(0);
  }

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (SENSOR_MODES.includes(snapshot.mode)) this.state.mode = snapshot.mode;
    this.state.hydrophoneBearing = normalizeBearing(snapshot.hydrophoneBearing || 0);
    this.state.radarMastRaised = Boolean(snapshot.radarMastRaised) && this.profile.radarAvailable;
    this.state.radarSweepAngle = normalizeBearing(snapshot.radarSweepAngle || 0);
    this.state.activePingCooldownMs = clamp(snapshot.activePingCooldownMs, 0, ACTIVE_PING_COOLDOWN_MS);
    this.state.activePingFlashMs = clamp(snapshot.activePingFlashMs, 0, ACTIVE_PING_FLASH_MS);
    this.state.lastMessageKey = typeof snapshot.lastMessageKey === 'string' ? snapshot.lastMessageKey : this.state.lastMessageKey;
    if (Number.isFinite(Number(snapshot.profile?.currentVisualRangeMeters))) this.profile.currentVisualRangeMeters = Number(snapshot.profile.currentVisualRangeMeters);
    for (const role of CONTACT_ROLES) {
      const incoming = snapshot.contacts?.[role];
      if (!incoming || typeof incoming !== 'object') continue;
      const contact = this.state.contacts[role];
      contact.detected = Boolean(incoming.detected);
      contact.bearing = incoming.bearing === null ? null : normalizeBearing(incoming.bearing);
      contact.rangeMeters = incoming.rangeMeters === null ? null : Math.max(0, Number(incoming.rangeMeters) || 0);
      contact.rangeKnown = Boolean(incoming.rangeKnown);
      contact.confidence = clamp(incoming.confidence, 0, 100);
      contact.signal = clamp(incoming.signal, 0, 100);
      contact.bearingUncertainty = clamp(incoming.bearingUncertainty, 0, 180);
      contact.rangeUncertainty = clamp(incoming.rangeUncertainty, 0, 1);
      contact.classification = typeof incoming.classification === 'string' ? incoming.classification : 'unknown';
      contact.source = typeof incoming.source === 'string' ? incoming.source : 'none';
      contact.supportingSource = typeof incoming.supportingSource === 'string' ? incoming.supportingSource : contact.source;
      contact.lastUpdateWorldTime = Math.max(0, Number(incoming.lastUpdateWorldTime) || 0);
      contact.ageMs = Math.max(0, Number(incoming.ageMs) || 0);
      contact.stale = Boolean(incoming.stale);
      contact.bearingRateDegMin = clamp(incoming.bearingRateDegMin, -90, 90);
      contact.rangeRateMps = clamp(incoming.rangeRateMps, -20, 20);
      contact.speedEstimateKnots = clamp(incoming.speedEstimateKnots, 0, 36);
      contact.trend = ['closing', 'opening', 'steady'].includes(incoming.trend) ? incoming.trend : deriveTrend(contact.rangeRateMps);
      contact.aspect = ['bow', 'stern', 'crossing', 'unknown'].includes(incoming.aspect) ? incoming.aspect : deriveAspect(contact.bearingRateDegMin, contact.rangeRateMps);
      contact.history = Array.isArray(incoming.history) ? incoming.history.slice(-12).map((item) => ({
        worldTime: Math.max(0, Number(item.worldTime) || 0),
        bearing: item.bearing === null ? null : normalizeBearing(item.bearing),
        rangeMeters: item.rangeMeters === null ? null : Math.max(0, Number(item.rangeMeters) || 0),
        source: typeof item.source === 'string' ? item.source : 'none',
      })) : [];
    }
    return true;
  }

  snapshot() {
    const contacts = {
      target: structuredClone(this.state.contacts.target),
      escort: structuredClone(this.state.contacts.escort),
    };
    return {
      sensorVersion: 2,
      mode: this.state.mode,
      hydrophoneBearing: this.state.hydrophoneBearing,
      radarMastRaised: this.state.radarMastRaised,
      radarSweepAngle: this.state.radarSweepAngle,
      activePingCooldownMs: this.state.activePingCooldownMs,
      activePingFlashMs: this.state.activePingFlashMs,
      lastMessageKey: this.state.lastMessageKey,
      profile: { ...this.profile },
      contacts,
      strongestContact: this.strongestContact() ? { ...this.strongestContact(), history: undefined } : null,
      visibleContactCount: this.visibleContacts().length,
    };
  }
}
