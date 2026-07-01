import { clamp } from '../simulation/simulationMath.js';

const TARGET_ROLES = Object.freeze(['target', 'escort']);
const TORPEDO_TYPES = Object.freeze({
  steam: Object.freeze({ id: 'steam', speedKnots: 44, maxRangeMeters: 5200, wake: true, exposure: 16, reliabilityBonus: 0 }),
  electric: Object.freeze({ id: 'electric', speedKnots: 30, maxRangeMeters: 3200, wake: false, exposure: 7, reliabilityBonus: 0.025 }),
});
const MAX_LAUNCH_DEPTH = 60;
const BASE_RELOAD_MS = 45000;
const MIN_SOLUTION_QUALITY = 42;
const MAX_SALVO = 3;

function normalizeWeaponBearing(value) {
  return ((Number(value) % 360) + 360) % 360;
}

function angleDifference(a, b) {
  const difference = Math.abs(normalizeWeaponBearing(a) - normalizeWeaponBearing(b));
  return Math.min(difference, 360 - difference);
}

function signedAngleDifference(a, b) {
  return ((normalizeWeaponBearing(a) - normalizeWeaponBearing(b) + 540) % 360) - 180;
}

function deterministicRoll(seed) {
  let hash = 2166136261;
  const text = String(seed);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function weaponNationFrom(submarine = {}) {
  if (submarine.nation) return submarine.nation;
  const id = String(submarine.id || 'de').toLowerCase();
  if (id.startsWith('uk_')) return 'uk';
  if (id.startsWith('us_')) return 'us';
  return 'de';
}

function historicalFailureRate(nation, year) {
  if (nation === 'us') return year <= 1942 ? 0.28 : year === 1943 ? 0.16 : 0.08;
  if (nation === 'de') return year <= 1941 ? 0.22 : year === 1942 ? 0.15 : 0.08;
  return year <= 1940 ? 0.11 : 0.065;
}

function buildWeaponProfile(submarine = {}, mission = {}, initialTorpedoes = 6) {
  const nation = weaponNationFrom(submarine);
  const year = Math.max(1939, Number.parseInt(mission.year, 10) || 1939);
  const nominalTotal = Math.max(1, Math.floor(Number(initialTorpedoes) || Number(submarine?.stats?.torpedoes) || 6));
  const tubeCount = nation === 'de' ? Math.min(5, nominalTotal) : Math.min(6, nominalTotal);
  const bowTubes = nation === 'de' ? Math.min(4, tubeCount) : tubeCount;
  return {
    nation,
    year,
    tubeCount,
    bowTubes,
    sternTubes: Math.max(0, tubeCount - bowTubes),
    initialTorpedoes: nominalTotal,
    baseFailureRate: historicalFailureRate(nation, year),
    reloadMs: BASE_RELOAD_MS,
    maxLaunchDepth: MAX_LAUNCH_DEPTH,
  };
}

function trueWeaponRangeMeters(entity = {}) {
  return Math.max(0, Math.hypot(Number(entity.x) || 0, Number(entity.y) || 0) * 4);
}

function trueWeaponBearing(entity = {}) {
  return normalizeWeaponBearing(Math.atan2(Number(entity.x) || 0, -(Number(entity.y) || 0)) * 180 / Math.PI);
}

function actualTargetSpeed(mission = {}, role = 'target') {
  if (role === 'escort') return Math.max(10, Number(mission.escortSpeedKnots) || 17);
  return Math.max(4, Number(mission.targetSpeedKnots) || (6.2 + (Number(mission.targetDrift) || 0.7) * 2.2));
}

function actualTargetCourse(role = 'target', escortState = 'patrol') {
  if (role === 'escort' && escortState === 'hunt') return 180;
  return role === 'escort' ? 245 : 270;
}

function actualAob(entity, targetCourse) {
  const bearingFromTargetToSub = normalizeWeaponBearing(trueWeaponBearing(entity) + 180);
  return clamp(angleDifference(targetCourse, bearingFromTargetToSub), 0, 180);
}

function blankTdc() {
  return {
    bearing: null,
    rangeMeters: null,
    targetSpeedKnots: 8,
    targetCourse: 270,
    aobDegrees: 90,
    gyroAngle: 0,
    runDepthMeters: 3,
    torpedoType: 'steam',
    torpedoSpeedKnots: TORPEDO_TYPES.steam.speedKnots,
    solutionQuality: 0,
    solutionStatus: 'noContact',
    contactConfidence: 0,
    lastContactAgeMs: 0,
    synced: false,
  };
}

function tubeLabel(index, position) {
  return `${position === 'stern' ? 'S' : 'B'}${index + 1}`;
}

export class WeaponSystem {
  constructor({ mission = {}, submarine = null, initialTorpedoes = 6, initialSnapshot = null, difficultyProfile = null } = {}) {
    this.mission = mission || {};
    this.difficultyProfile = difficultyProfile || { weaponQualityBonus: 0, torpedoFailureMultiplier: 1 };
    this.profile = buildWeaponProfile(submarine || {}, this.mission, initialTorpedoes);
    this.state = {
      selectedTarget: 'target',
      selectedTubeId: 'tube-1',
      salvoSize: 1,
      reserveTorpedoes: Math.max(0, this.profile.initialTorpedoes - this.profile.tubeCount),
      tubes: Array.from({ length: this.profile.tubeCount }, (_, index) => {
        const position = index < this.profile.bowTubes ? 'bow' : 'stern';
        return {
          id: `tube-${index + 1}`,
          label: tubeLabel(position === 'bow' ? index : index - this.profile.bowTubes, position),
          position,
          loaded: true,
          reloadMs: 0,
          reloadDurationMs: this.profile.reloadMs,
          torpedoType: 'steam',
        };
      }),
      tdc: blankTdc(),
      activeShots: [],
      shotCounter: 0,
      lastMessageKey: 'weapons.ready',
      lastResolution: null,
    };
    this.resolutionEvents = [];
    this.exposureEvents = [];
    if (initialSnapshot) this.restore(initialSnapshot);
  }

  totalTorpedoes() {
    const loaded = this.state.tubes.filter((tube) => tube.loaded).length;
    const reloading = this.state.tubes.filter((tube) => !tube.loaded && tube.reloadMs > 0).length;
    return loaded + reloading + this.state.reserveTorpedoes;
  }

  loadedTubeCount() {
    return this.state.tubes.filter((tube) => tube.loaded).length;
  }

  selectedContact(context = {}) {
    return context.sensors?.contacts?.[this.state.selectedTarget] || null;
  }

  selectedEntity(context = {}) {
    return context.contacts?.[this.state.selectedTarget] || null;
  }

  setTarget(role) {
    if (!TARGET_ROLES.includes(role)) return { ok: false, reason: 'invalidWeaponTarget' };
    this.state.selectedTarget = role;
    this.state.tdc.synced = false;
    this.state.lastMessageKey = 'weapons.targetChanged';
    return { ok: true, role };
  }

  selectTube(id) {
    const tube = this.state.tubes.find((item) => item.id === id);
    if (!tube) return { ok: false, reason: 'invalidTube' };
    this.state.selectedTubeId = id;
    return { ok: true, id };
  }

  setSalvoSize(value) {
    const size = Math.floor(Number(value));
    if (!Number.isFinite(size) || size < 1 || size > MAX_SALVO) return { ok: false, reason: 'invalidSalvo' };
    this.state.salvoSize = size;
    return { ok: true, size };
  }

  setTorpedoType(type) {
    if (!TORPEDO_TYPES[type]) return { ok: false, reason: 'invalidTorpedoType' };
    this.state.tdc.torpedoType = type;
    this.state.tdc.torpedoSpeedKnots = TORPEDO_TYPES[type].speedKnots;
    const selected = this.state.tubes.find((tube) => tube.id === this.state.selectedTubeId);
    if (selected && selected.loaded) selected.torpedoType = type;
    return { ok: true, type };
  }

  setTdcValue(key, value) {
    const rules = {
      targetSpeedKnots: [0, 40],
      targetCourse: [0, 359],
      aobDegrees: [0, 180],
      runDepthMeters: [1, 15],
    };
    if (!rules[key]) return { ok: false, reason: 'invalidTdcField' };
    const number = Number(value);
    if (!Number.isFinite(number)) return { ok: false, reason: 'invalidTdcValue' };
    this.state.tdc[key] = key === 'targetCourse' ? normalizeWeaponBearing(number) : clamp(number, rules[key][0], rules[key][1]);
    this.state.tdc.synced = false;
    return { ok: true, key, value: this.state.tdc[key] };
  }

  syncFromContact(context = {}) {
    const contact = this.selectedContact(context);
    const entity = this.selectedEntity(context);
    if (!contact?.detected || !entity || entity.destroyed) return { ok: false, reason: 'noWeaponContact' };
    const confidence = clamp(contact.confidence, 0, 100);
    const role = this.state.selectedTarget;
    const targetCourse = actualTargetCourse(role, context.escortState);
    const targetSpeed = actualTargetSpeed(this.mission, role);
    const uncertainty = (100 - confidence) / 100;
    const speedOffset = (deterministicRoll(`${context.worldTime}:${role}:speed`) * 2 - 1) * 4 * uncertainty;
    const courseOffset = (deterministicRoll(`${context.worldTime}:${role}:course`) * 2 - 1) * 24 * uncertainty;
    this.state.tdc.bearing = contact.bearing ?? trueWeaponBearing(entity);
    this.state.tdc.rangeMeters = contact.rangeMeters ?? trueWeaponRangeMeters(entity);
    this.state.tdc.targetSpeedKnots = clamp(targetSpeed + speedOffset, 0, 40);
    this.state.tdc.targetCourse = normalizeWeaponBearing(targetCourse + courseOffset);
    this.state.tdc.aobDegrees = clamp(actualAob(entity, this.state.tdc.targetCourse), 0, 180);
    this.state.tdc.contactConfidence = confidence;
    this.state.tdc.lastContactAgeMs = Math.max(0, Number(contact.ageMs) || 0);
    this.state.tdc.synced = true;
    this.updateSolution(context);
    this.state.lastMessageKey = 'weapons.solutionSynced';
    return { ok: true, tdc: { ...this.state.tdc } };
  }

  tubeArcAllows(tube, relativeBearing) {
    const absolute = Math.abs(relativeBearing);
    return tube.position === 'bow' ? absolute <= 105 : absolute >= 75;
  }

  updateSolution(context = {}) {
    const contact = this.selectedContact(context);
    const entity = this.selectedEntity(context);
    const tdc = this.state.tdc;
    if (!contact?.detected || !entity || entity.destroyed) {
      tdc.solutionQuality = 0;
      tdc.solutionStatus = 'noContact';
      tdc.contactConfidence = 0;
      return tdc.solutionQuality;
    }
    if (!tdc.synced || tdc.bearing === null || tdc.rangeMeters === null) {
      tdc.bearing = contact.bearing;
      tdc.rangeMeters = contact.rangeMeters;
    }
    tdc.contactConfidence = clamp(contact.confidence, 0, 100);
    tdc.lastContactAgeMs = Math.max(0, Number(contact.ageMs) || 0);
    const actualSpeed = actualTargetSpeed(this.mission, this.state.selectedTarget);
    const course = actualTargetCourse(this.state.selectedTarget, context.escortState);
    const aob = actualAob(entity, course);
    const speedAccuracy = clamp(1 - Math.abs(tdc.targetSpeedKnots - actualSpeed) / 12, 0, 1);
    const aobAccuracy = clamp(1 - Math.abs(tdc.aobDegrees - aob) / 90, 0, 1);
    const courseAccuracy = clamp(1 - angleDifference(tdc.targetCourse, course) / 120, 0, 1);
    const weaponsHealth = clamp(context.systems?.weapons ?? 100, 0, 100) / 100;
    const sourceBonus = contact.source === 'periscope' ? 10 : contact.source === 'activeSonar' ? 8 : contact.source === 'radar' ? 7 : 2;
    const rangeBonus = contact.rangeKnown ? 10 : 0;
    const stalePenalty = contact.stale ? 18 : Math.min(12, tdc.lastContactAgeMs / 1200);
    const uncertaintyPenalty = clamp((contact.bearingUncertainty || 0) * 0.45 + (contact.rangeUncertainty || 0) * 18, 0, 24);
    const crewTdcBonus = clamp(Number(context.crewImpact?.modifiers?.tdcSolutionBonus || 0), 0, 20);
    let quality = tdc.contactConfidence * 0.48 + sourceBonus + rangeBonus + weaponsHealth * 12 + speedAccuracy * 8 + aobAccuracy * 7 + courseAccuracy * 5 - stalePenalty - uncertaintyPenalty + Number(this.difficultyProfile.weaponQualityBonus || 0) + crewTdcBonus;
    const range = Number(tdc.rangeMeters) || trueWeaponRangeMeters(entity);
    const torpedo = TORPEDO_TYPES[tdc.torpedoType] || TORPEDO_TYPES.steam;
    if (range > torpedo.maxRangeMeters) quality -= 35;
    quality = clamp(quality, 0, 100);
    const bearing = tdc.bearing ?? trueWeaponBearing(entity);
    const ownHeading = Number(context.navigation?.heading) || 0;
    const relativeBearing = signedAngleDifference(bearing, ownHeading);
    const ratio = clamp((tdc.targetSpeedKnots / torpedo.speedKnots) * Math.sin((tdc.aobDegrees * Math.PI) / 180), -0.95, 0.95);
    const lead = Math.asin(ratio) * 180 / Math.PI;
    tdc.gyroAngle = normalizeWeaponBearing(relativeBearing + lead);
    tdc.torpedoSpeedKnots = torpedo.speedKnots;
    tdc.solutionQuality = Math.round(quality);
    tdc.solutionStatus = quality >= 78 ? 'excellent' : quality >= 58 ? 'good' : quality >= MIN_SOLUTION_QUALITY ? 'marginal' : 'poor';
    return quality;
  }

  fireCheck(context = {}) {
    if ((context.systems?.weapons ?? 100) <= 10) return { ok: false, reason: 'weaponsDown' };
    if (Number(context.depth) > this.profile.maxLaunchDepth) return { ok: false, reason: 'torpedoTooDeep' };
    if (context.missionFailed) return { ok: false, reason: 'failed' };
    const contact = this.selectedContact(context);
    const entity = this.selectedEntity(context);
    if (!contact?.detected || !entity || entity.destroyed) return { ok: false, reason: 'noWeaponContact' };
    this.updateSolution(context);
    if (this.state.tdc.solutionQuality < MIN_SOLUTION_QUALITY) return { ok: false, reason: 'solutionPoor' };
    const ownHeading = Number(context.navigation?.heading) || 0;
    const relative = signedAngleDifference(this.state.tdc.bearing ?? trueWeaponBearing(entity), ownHeading);
    const valid = this.state.tubes.filter((tube) => tube.loaded && this.tubeArcAllows(tube, relative));
    if (!valid.length) return { ok: false, reason: this.loadedTubeCount() ? 'tubeArc' : this.totalTorpedoes() ? 'tubesReloading' : 'noTorpedoes' };
    return { ok: true, tubes: valid, relativeBearing: relative };
  }

  chooseTubes(validTubes) {
    const selected = validTubes.find((tube) => tube.id === this.state.selectedTubeId);
    const ordered = selected ? [selected, ...validTubes.filter((tube) => tube !== selected)] : validTubes;
    return ordered.slice(0, Math.min(this.state.salvoSize, ordered.length));
  }

  beginReload(tube, weaponsHealth = 100) {
    if (this.state.reserveTorpedoes <= 0) {
      tube.reloadMs = 0;
      return;
    }
    this.state.reserveTorpedoes -= 1;
    const healthFactor = clamp(Number(weaponsHealth) / 100, 0.35, 1);
    tube.reloadDurationMs = Math.round(this.profile.reloadMs / healthFactor);
    tube.reloadMs = tube.reloadDurationMs;
  }

  buildShot(tube, context = {}) {
    this.state.shotCounter += 1;
    const id = `shot-${this.state.shotCounter}`;
    const tdc = { ...this.state.tdc };
    const torpedo = TORPEDO_TYPES[tube.torpedoType] || TORPEDO_TYPES[tdc.torpedoType] || TORPEDO_TYPES.steam;
    const range = Math.max(150, Number(tdc.rangeMeters) || trueWeaponRangeMeters(this.selectedEntity(context)));
    const speedMetersPerSecond = torpedo.speedKnots * 0.514444 * 4; // tactical world scale
    const travelMs = clamp((range / speedMetersPerSecond) * 1000, 2800, 120000);
    const damagePenalty = (100 - clamp(context.systems?.weapons ?? 100, 0, 100)) / 240;
    const crewReliability = clamp(Number(context.crewImpact?.modifiers?.tdcSolutionBonus || 0) / 350, 0, 0.055);
    const failureRate = clamp((this.profile.baseFailureRate - torpedo.reliabilityBonus - crewReliability + damagePenalty) * (Number(this.difficultyProfile.torpedoFailureMultiplier) || 1), 0.015, 0.52);
    const failureRoll = deterministicRoll(`${this.mission.id}:${this.profile.year}:${id}:${tube.id}:failure`);
    let failureMode = null;
    if (failureRoll < failureRate) {
      const modeRoll = deterministicRoll(`${id}:${tube.id}:mode`);
      failureMode = modeRoll < 0.46 ? 'dud' : modeRoll < 0.76 ? 'depthKeeping' : 'premature';
    }
    const rangeFactor = clamp(1 - Math.max(0, range - torpedo.maxRangeMeters * 0.72) / torpedo.maxRangeMeters, 0.35, 1);
    const qualityProbability = clamp((tdc.solutionQuality / 100) * 0.98 * rangeFactor, 0.08, 0.96);
    const hitRoll = deterministicRoll(`${this.mission.id}:${id}:${tdc.solutionQuality}:hit`);
    const predictedHit = !failureMode && hitRoll <= qualityProbability;
    return {
      id,
      tubeId: tube.id,
      targetRole: this.state.selectedTarget,
      torpedoType: torpedo.id,
      travelMs,
      remainingMs: travelMs,
      solutionQuality: tdc.solutionQuality,
      gyroAngle: tdc.gyroAngle,
      runDepthMeters: tdc.runDepthMeters,
      rangeMeters: range,
      predictedHit,
      failureMode,
      resolved: false,
    };
  }

  fire(context = {}) {
    const check = this.fireCheck(context);
    if (!check.ok) return check;
    const tubes = this.chooseTubes(check.tubes);
    const shots = [];
    for (const tube of tubes) {
      const shot = this.buildShot(tube, context);
      shots.push(shot);
      tube.loaded = false;
      tube.reloadMs = 0;
      this.beginReload(tube, context.systems?.weapons ?? 100);
    }
    this.state.activeShots.push(...shots);
    this.state.lastMessageKey = shots.length > 1 ? 'weapons.salvoFired' : 'weapons.torpedoFired';
    const exposure = shots.reduce((total, shot) => total + TORPEDO_TYPES[shot.torpedoType].exposure, 0);
    this.exposureEvents.push({ type: 'torpedoLaunch', detectionBoost: exposure, shots: shots.length });
    return { ok: true, shots: shots.map((shot) => ({ ...shot })), salvoSize: shots.length };
  }

  update(stepMs, context = {}) {
    const elapsed = Math.max(0, Number(stepMs) || 0) * Math.max(1, Number(context.timeCompression) || 1);
    for (const tube of this.state.tubes) {
      if (tube.loaded || tube.reloadMs <= 0) continue;
      tube.reloadMs = Math.max(0, tube.reloadMs - elapsed);
      if (tube.reloadMs === 0) {
        tube.loaded = true;
        tube.torpedoType = this.state.tdc.torpedoType;
        this.state.lastMessageKey = 'weapons.tubeReloaded';
      }
    }
    this.updateSolution(context);
    for (const shot of this.state.activeShots) {
      shot.remainingMs = Math.max(0, shot.remainingMs - elapsed);
      if (shot.remainingMs > 0 || shot.resolved) continue;
      shot.resolved = true;
      const outcome = shot.failureMode || (shot.predictedHit ? 'hit' : 'miss');
      const resolution = { ...shot, outcome };
      this.state.lastResolution = resolution;
      this.resolutionEvents.push(resolution);
      this.state.lastMessageKey = `weapons.outcome.${outcome}`;
    }
    this.state.activeShots = this.state.activeShots.filter((shot) => !shot.resolved);
    return this.snapshot(context);
  }

  drainResolutionEvents() {
    return this.resolutionEvents.splice(0);
  }

  drainExposureEvents() {
    return this.exposureEvents.splice(0);
  }

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (TARGET_ROLES.includes(snapshot.selectedTarget)) this.state.selectedTarget = snapshot.selectedTarget;
    if (Number.isFinite(Number(snapshot.salvoSize))) this.state.salvoSize = clamp(Math.floor(Number(snapshot.salvoSize)), 1, MAX_SALVO);
    this.state.reserveTorpedoes = Math.max(0, Math.floor(Number(snapshot.reserveTorpedoes) || 0));
    this.state.shotCounter = Math.max(0, Math.floor(Number(snapshot.shotCounter) || 0));
    this.state.lastMessageKey = typeof snapshot.lastMessageKey === 'string' ? snapshot.lastMessageKey : this.state.lastMessageKey;
    this.state.lastResolution = snapshot.lastResolution && typeof snapshot.lastResolution === 'object' ? { ...snapshot.lastResolution } : null;
    if (snapshot.tdc && typeof snapshot.tdc === 'object') {
      this.state.tdc = { ...blankTdc(), ...snapshot.tdc };
      if (!TORPEDO_TYPES[this.state.tdc.torpedoType]) this.state.tdc.torpedoType = 'steam';
      this.state.tdc.torpedoSpeedKnots = TORPEDO_TYPES[this.state.tdc.torpedoType].speedKnots;
    }
    if (Array.isArray(snapshot.tubes)) {
      for (const tube of this.state.tubes) {
        const incoming = snapshot.tubes.find((item) => item?.id === tube.id);
        if (!incoming) continue;
        tube.loaded = Boolean(incoming.loaded);
        tube.reloadMs = Math.max(0, Number(incoming.reloadMs) || 0);
        tube.reloadDurationMs = Math.max(1000, Number(incoming.reloadDurationMs) || this.profile.reloadMs);
        tube.torpedoType = TORPEDO_TYPES[incoming.torpedoType] ? incoming.torpedoType : 'steam';
      }
    }
    if (this.state.tubes.some((tube) => tube.id === snapshot.selectedTubeId)) this.state.selectedTubeId = snapshot.selectedTubeId;
    this.state.activeShots = Array.isArray(snapshot.activeShots) ? snapshot.activeShots.map((shot) => ({ ...shot, resolved: false })).filter((shot) => Number(shot.remainingMs) > 0) : [];
    return true;
  }

  migrateLegacyTorpedoes(total) {
    const requested = Math.max(0, Math.floor(Number(total) || 0));
    for (const tube of this.state.tubes) {
      tube.loaded = false;
      tube.reloadMs = 0;
    }
    let remaining = requested;
    for (const tube of this.state.tubes) {
      if (remaining <= 0) break;
      tube.loaded = true;
      remaining -= 1;
    }
    this.state.reserveTorpedoes = remaining;
  }

  snapshot(context = {}) {
    const check = this.fireCheck({ ...context, missionFailed: Boolean(context.missionFailed) });
    return {
      weaponVersion: 1,
      profile: { ...this.profile },
      selectedTarget: this.state.selectedTarget,
      selectedTubeId: this.state.selectedTubeId,
      salvoSize: this.state.salvoSize,
      reserveTorpedoes: this.state.reserveTorpedoes,
      totalTorpedoes: this.totalTorpedoes(),
      loadedTubeCount: this.loadedTubeCount(),
      tubes: this.state.tubes.map((tube) => ({ ...tube })),
      tdc: { ...this.state.tdc },
      activeShots: this.state.activeShots.map((shot) => ({ ...shot })),
      shotCounter: this.state.shotCounter,
      lastMessageKey: this.state.lastMessageKey,
      lastResolution: this.state.lastResolution ? { ...this.state.lastResolution } : null,
      canFire: check.ok,
      fireReason: check.ok ? null : check.reason,
      minimumSolutionQuality: MIN_SOLUTION_QUALITY,
      torpedoTypes: Object.fromEntries(Object.entries(TORPEDO_TYPES).map(([key, value]) => [key, { ...value }])),
    };
  }
}
