import { ShipEntity } from '../entities/ShipEntity.js';
import { clamp } from '../simulation/simulationMath.js';

const ROMAN_DIFFICULTY = Object.freeze({ I: 1, II: 2, III: 3, IV: 4, V: 5 });
const AI_STATES = Object.freeze(['formation', 'alert', 'search', 'hunt', 'regroup']);
const SYSTEMS = Object.freeze(['engines', 'sonar', 'periscope', 'weapons']);

function deterministicRoll(seed = '') {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

function difficultyLevel(mission = {}) {
  return ROMAN_DIFFICULTY[String(mission.difficulty || 'I').toUpperCase()] || 1;
}

function missionYear(mission = {}) {
  return Math.max(1939, Number.parseInt(mission.year, 10) || 1939);
}

function theatreText(mission = {}) {
  return `${mission.theatreKey || ''} ${mission.operationKey || ''}`.toLowerCase();
}

function formationSlot(index) {
  const slots = [
    { x: 0, y: 0 },
    { x: -72, y: -26 },
    { x: 72, y: -26 },
    { x: -72, y: 54 },
    { x: 72, y: 54 },
    { x: 0, y: 112 },
  ];
  return { ...(slots[index] || { x: 0, y: index * 62 }) };
}

function restoreShip(entity, saved = {}) {
  if (!entity || !saved) return;
  entity.moveTo(Number(saved.x) || 0, Number(saved.y) || 0);
  entity.setState(saved.state || entity.state);
  entity.destroyed = Boolean(saved.destroyed);
  entity.active = saved.active !== false && !entity.destroyed;
  entity.metadata = { ...entity.metadata, ...(saved.metadata || {}) };
}

export class NavalAISystem {
  constructor({ mission = {}, initialSnapshot = null } = {}) {
    this.mission = mission || {};
    this.profile = this.buildProfile();
    this.ships = this.buildConvoy();
    this.primaryTarget = this.ships.find((ship) => ship.role === 'target') || this.ships[0];
    this.primaryEscort = this.ships.find((ship) => ship.role === 'escort') || this.ships[this.ships.length - 1];
    this.state = {
      aiVersion: 2,
      globalState: 'formation',
      formationAnchor: {
        x: Number(mission.targetStartX ?? 230),
        y: Number(mission.targetStartY ?? 18),
      },
      convoyCourse: 265,
      convoySpeedKnots: 8 + this.profile.difficulty * 0.6,
      evasivePhase: 0,
      lastKnown: { x: 0, y: 0, ageMs: 0 },
      searchLeg: 0,
      searchRadius: 80,
      stateAgeMs: 0,
      hostileActionAgeMs: 999999,
      contactConfidence: 0,
      attackSolution: 0,
      attackPhase: 'none',
      attackCooldownMs: 18000,
      aircraftSpawnCooldownMs: this.profile.aircraftAvailable ? 60000 : 999999999,
      lastMessageKey: 'ai.formationHolding',
      depthChargePatterns: [],
      aircraft: {
        available: this.profile.aircraftAvailable,
        active: false,
        id: 'asw-aircraft-1',
        state: 'standby',
        x: 0,
        y: -420,
        enduranceMs: 0,
        attackCooldownMs: 0,
        detectionConfidence: 0,
        passes: 0,
      },
      metrics: {
        patternsDropped: 0,
        aircraftAttacks: 0,
        nearMisses: 0,
        coordinatedSearches: 0,
      },
    };
    this.damageEvents = [];
    this.exposureEvents = [];
    this.threatEvents = [];
    this.patternCounter = 0;
    if (initialSnapshot) this.restore(initialSnapshot);
  }

  buildProfile() {
    const difficulty = difficultyLevel(this.mission);
    const year = missionYear(this.mission);
    const theatre = theatreText(this.mission);
    const convoyMission = theatre.includes('convoy') || difficulty >= 2;
    const merchantCount = clamp((convoyMission ? 4 : 3) + Math.floor((difficulty - 1) / 2), 3, 6);
    const escortCount = clamp(1 + Math.floor(difficulty / 2), 1, 3);
    const aircraftAvailable = year >= 1942 && (difficulty >= 2 || theatre.includes('atlantic') || theatre.includes('pacific'));
    return {
      difficulty,
      year,
      merchantCount,
      escortCount,
      aircraftAvailable,
      escortAggression: 0.82 + difficulty * 0.13,
      searchCoordination: 0.75 + difficulty * 0.08,
      depthChargeCount: 4 + difficulty,
      convoySpacing: Math.max(48, 76 - difficulty * 4),
    };
  }

  buildConvoy() {
    const ships = [];
    const targetX = Number(this.mission.targetStartX ?? 230);
    const targetY = Number(this.mission.targetStartY ?? 18);
    for (let index = 0; index < this.profile.merchantCount; index += 1) {
      const slot = formationSlot(index);
      const ship = new ShipEntity({
        id: `${this.mission.id || 'mission'}-merchant-${index + 1}`,
        role: index === 0 ? 'target' : 'convoy',
        shipType: index === 0 ? (this.mission.targetType || 'merchant') : (index % 3 === 2 ? 'tanker' : 'merchant'),
        x: targetX + slot.x,
        y: targetY + slot.y,
        state: 'formation',
        metadata: {
          formationIndex: index,
          formationSlot: slot,
          hull: 100,
          speedKnots: 7.5 + (index % 2) * 0.8,
          value: index === 0 ? 'primary' : 'convoy',
        },
      });
      ships.push(ship);
    }
    const escortX = Number(this.mission.escortStartX ?? 320);
    const escortY = Number(this.mission.escortStartY ?? 42);
    for (let index = 0; index < this.profile.escortCount; index += 1) {
      const angle = (Math.PI * 2 * index) / Math.max(1, this.profile.escortCount);
      const ship = new ShipEntity({
        id: `${this.mission.id || 'mission'}-escort-${index + 1}`,
        role: index === 0 ? 'escort' : 'escort-support',
        shipType: index % 2 ? 'corvette' : 'destroyer',
        x: index === 0 ? escortX : targetX + Math.cos(angle) * 145,
        y: index === 0 ? escortY : targetY + Math.sin(angle) * 110,
        state: 'patrol',
        metadata: {
          formationIndex: index,
          hull: 100,
          sonarSkill: clamp(62 + this.profile.difficulty * 7 + index * 3, 60, 96),
          depthCharges: 18 + this.profile.difficulty * 4,
        },
      });
      ships.push(ship);
    }
    return ships;
  }

  merchantShips() {
    return this.ships.filter((ship) => ship.role === 'target' || ship.role === 'convoy');
  }

  escortShips() {
    return this.ships.filter((ship) => ship.role === 'escort' || ship.role === 'escort-support');
  }

  activeMerchants() {
    return this.merchantShips().filter((ship) => !ship.destroyed);
  }

  activeEscorts() {
    return this.escortShips().filter((ship) => !ship.destroyed);
  }

  setGlobalState(next, { force = false } = {}) {
    if (!AI_STATES.includes(next)) return false;
    const order = { formation: 0, regroup: 1, alert: 2, search: 3, hunt: 4 };
    if (!force && order[next] < order[this.state.globalState] && this.state.stateAgeMs < 9000) return false;
    if (this.state.globalState === next) return false;
    const previous = this.state.globalState;
    this.state.globalState = next;
    this.state.stateAgeMs = 0;
    if (next === 'search') {
      this.state.metrics.coordinatedSearches += 1;
      this.state.searchLeg = 0;
      this.state.searchRadius = 70;
    }
    this.state.lastMessageKey = `ai.state.${next}`;
    this.threatEvents.push({ type: 'state', previous, current: next, key: this.state.lastMessageKey });
    return true;
  }

  setLastKnown(position = {}) {
    this.state.lastKnown = {
      x: Number(position.x) || 0,
      y: Number(position.y) || 0,
      ageMs: 0,
    };
  }

  notifyTorpedoLaunch(shots = []) {
    if (!shots.length) return;
    this.setLastKnown({ x: 0, y: 0 });
    this.state.hostileActionAgeMs = 0;
    this.state.contactConfidence = Math.max(this.state.contactConfidence, 72);
    this.state.attackSolution = Math.max(this.state.attackSolution, 22);
    this.setGlobalState('hunt', { force: true });
    this.state.evasivePhase += 1.4;
    this.state.lastMessageKey = 'ai.torpedoWakeDetected';
    this.threatEvents.push({ type: 'torpedoWake', key: 'ai.torpedoWakeDetected', count: shots.length });
  }

  notifyShipDestroyed(shipId) {
    const ship = this.ships.find((item) => item.id === shipId);
    if (!ship) return false;
    ship.destroy();
    this.state.hostileActionAgeMs = 0;
    this.state.contactConfidence = Math.max(this.state.contactConfidence, 82);
    this.setGlobalState('hunt', { force: true });
    this.state.lastMessageKey = ship.role.includes('escort') ? 'ai.escortLost' : 'ai.convoyShipLost';
    this.threatEvents.push({ type: 'shipDestroyed', shipId, role: ship.role, key: this.state.lastMessageKey });
    return true;
  }

  syncPrimaryState() {
    if (this.primaryTarget.destroyed) this.primaryTarget.active = false;
    if (this.primaryEscort.destroyed) this.primaryEscort.active = false;
  }

  updateFormation(deltaMs, context) {
    const compression = clamp(Number(context.timeCompression) || 1, 1, 16);
    const tacticalScale = deltaMs * compression / 1000;
    const evasion = this.state.globalState === 'formation' ? 0 : Math.sin(this.state.evasivePhase) * 0.42;
    this.state.evasivePhase += tacticalScale * (this.state.globalState === 'hunt' ? 0.9 : 0.25);
    this.state.formationAnchor.x -= (0.7 + this.profile.difficulty * 0.06) * tacticalScale;
    this.state.formationAnchor.y += evasion * tacticalScale * 5;
    const merchants = this.merchantShips();
    merchants.forEach((ship, index) => {
      if (ship.destroyed) return;
      const slot = ship.metadata.formationSlot || formationSlot(index);
      const zigzag = this.state.globalState === 'formation' ? 0 : Math.sin(this.state.evasivePhase + index * 0.8) * (14 + this.profile.difficulty * 3);
      const desiredX = this.state.formationAnchor.x + slot.x;
      const desiredY = this.state.formationAnchor.y + slot.y + zigzag;
      const catchup = this.state.globalState === 'regroup' ? 0.12 : 0.075;
      ship.position.x += (desiredX - ship.position.x) * catchup;
      ship.position.y += (desiredY - ship.position.y) * catchup;
      ship.setState(this.state.globalState === 'formation' ? 'formation' : 'evasive');
    });
  }

  updateEscorts(deltaMs, context) {
    const active = this.activeEscorts();
    const anchor = this.state.formationAnchor;
    active.forEach((ship, index) => {
      let desiredX = anchor.x;
      let desiredY = anchor.y;
      if (this.state.globalState === 'formation' || this.state.globalState === 'regroup') {
        const angle = this.state.evasivePhase * 0.18 + (Math.PI * 2 * index) / Math.max(1, active.length);
        const radiusX = 145 + index * 18;
        const radiusY = 92 + index * 12;
        desiredX = anchor.x + Math.cos(angle) * radiusX;
        desiredY = anchor.y + Math.sin(angle) * radiusY;
        ship.setState('patrol');
      } else if (this.state.globalState === 'alert') {
        const angle = this.state.evasivePhase * 0.35 + index * 2.1;
        desiredX = this.state.lastKnown.x + Math.cos(angle) * (90 + index * 25);
        desiredY = this.state.lastKnown.y + Math.sin(angle) * (65 + index * 22);
        ship.setState('alert');
      } else if (this.state.globalState === 'search') {
        const legAngle = ((this.state.searchLeg + index * 2) % 8) * Math.PI / 4;
        desiredX = this.state.lastKnown.x + Math.cos(legAngle) * (this.state.searchRadius + index * 28);
        desiredY = this.state.lastKnown.y + Math.sin(legAngle) * (this.state.searchRadius + index * 28);
        ship.setState('search');
      } else {
        const offset = (index - (active.length - 1) / 2) * 58;
        desiredX = offset;
        desiredY = index % 2 ? 34 : -26;
        ship.setState('hunt');
      }
      const aggression = this.profile.escortAggression;
      const factor = clamp((deltaMs / 1000) * 0.06 * aggression, 0.002, 0.06);
      ship.position.x += (desiredX - ship.position.x) * factor;
      ship.position.y += (desiredY - ship.position.y) * factor;
    });
  }

  nearestEscortRange() {
    const active = this.activeEscorts();
    if (!active.length) return Number.POSITIVE_INFINITY;
    return Math.min(...active.map((ship) => ship.distanceTo({ x: 0, y: 0 })));
  }

  chooseAttackEscort() {
    return this.activeEscorts().sort((a, b) => a.distanceTo({ x: 0, y: 0 }) - b.distanceTo({ x: 0, y: 0 }))[0] || null;
  }

  launchDepthChargePattern(source, context, aerial = false) {
    if (!source) return false;
    if (!aerial && Number(source.metadata.depthCharges || 0) <= 0) return false;
    this.patternCounter += 1;
    const id = `asw-pattern-${this.patternCounter}`;
    const playerDepth = Number(context.playerDepth) || 0;
    const skill = aerial ? 78 : Number(source.metadata.sonarSkill || 65);
    const decoyError = context.decoyActive ? 42 : 0;
    const quietError = context.silentRunning ? 18 : 0;
    const speedError = Math.max(0, Number(context.actualSpeedKnots || 0) - 4) * 2.4;
    const confidenceError = (100 - clamp(this.state.contactConfidence, 0, 100)) * 0.28;
    const randomError = (deterministicRoll(`${this.mission.id}:${id}:depth`) * 2 - 1) * (38 - skill * 0.22 + decoyError + quietError + speedError + confidenceError);
    const targetDepth = clamp(playerDepth + randomError, 8, 260);
    const pattern = {
      id,
      sourceId: source.id,
      sourceType: aerial ? 'aircraft' : 'escort',
      charges: aerial ? 3 : this.profile.depthChargeCount,
      remainingMs: aerial ? 7000 : 9000,
      targetDepth,
      targetX: aerial ? Number(source.x || 0) : source.position.x,
      targetY: aerial ? Number(source.y || 0) : source.position.y,
      spread: aerial ? 68 : 48 + this.profile.difficulty * 7,
      resolved: false,
    };
    this.state.depthChargePatterns.push(pattern);
    this.state.metrics.patternsDropped += 1;
    if (aerial) this.state.metrics.aircraftAttacks += 1;
    else source.metadata.depthCharges = Math.max(0, Number(source.metadata.depthCharges || 0) - pattern.charges);
    this.state.lastMessageKey = aerial ? 'ai.aircraftAttackRun' : 'ai.depthChargePatternLaunched';
    this.state.attackSolution = 12;
    this.state.attackPhase = 'reacquire';
    this.threatEvents.push({ type: 'patternLaunched', key: this.state.lastMessageKey, pattern: { ...pattern } });
    return true;
  }

  resolvePattern(pattern, context) {
    const playerDepth = Number(context.playerDepth) || 0;
    const depthError = Math.abs(pattern.targetDepth - playerDepth);
    const sourceDistance = Math.hypot(Number(pattern.targetX) || 0, Number(pattern.targetY) || 0);
    const positionPenalty = sourceDistance * (pattern.sourceType === 'aircraft' ? 0.022 : 0.035);
    const evasion = Number(context.actualSpeedKnots || 0) * 1.5 + (context.decoyActive ? 22 : 0) + (context.silentRunning ? 7 : 0);
    const roll = deterministicRoll(`${this.mission.id}:${pattern.id}:resolve`);
    const raw = pattern.charges * 2.15 - depthError * 0.2 - positionPenalty - evasion * 0.42 + roll * 7;
    const damage = Math.round(clamp(raw, 0, pattern.sourceType === 'aircraft' ? 16 : 24));
    if (damage >= 3) {
      const system = SYSTEMS[Math.floor(deterministicRoll(`${pattern.id}:system`) * SYSTEMS.length) % SYSTEMS.length];
      this.damageEvents.push({
        type: 'depthCharge',
        amount: damage,
        system,
        sourceType: pattern.sourceType,
        key: pattern.sourceType === 'aircraft' ? 'ai.hintAircraftDepthCharge' : 'ai.hintCoordinatedDepthCharge',
      });
    } else {
      this.state.metrics.nearMisses += 1;
      this.threatEvents.push({ type: 'nearMiss', key: 'ai.depthChargeNearMiss', patternId: pattern.id });
    }
  }

  updatePatterns(deltaMs, context) {
    for (const pattern of this.state.depthChargePatterns) {
      if (pattern.resolved) continue;
      pattern.remainingMs = Math.max(0, pattern.remainingMs - deltaMs);
      if (pattern.remainingMs <= 0) {
        pattern.resolved = true;
        this.resolvePattern(pattern, context);
      }
    }
    this.state.depthChargePatterns = this.state.depthChargePatterns.filter((pattern) => !pattern.resolved).slice(-8);
  }

  updateAircraft(deltaMs, context) {
    const aircraft = this.state.aircraft;
    if (!aircraft.available) return;
    const compression = clamp(Number(context.timeCompression) || 1, 1, 16);
    const simulated = deltaMs * compression;
    if (!aircraft.active) {
      this.state.aircraftSpawnCooldownMs = Math.max(0, this.state.aircraftSpawnCooldownMs - simulated);
      const opportunity = Number(context.detectionScore || 0) >= 26 || context.periscopeOpen || context.radarMastRaised || Number(context.playerDepth || 0) <= 8;
      if (this.state.aircraftSpawnCooldownMs <= 0 && opportunity) {
        aircraft.active = true;
        aircraft.state = 'patrol';
        aircraft.enduranceMs = 52000 + this.profile.difficulty * 8000;
        aircraft.attackCooldownMs = 4500;
        aircraft.detectionConfidence = 18;
        aircraft.passes += 1;
        aircraft.x = -360;
        aircraft.y = -260;
        this.state.lastMessageKey = 'ai.aircraftInbound';
        this.threatEvents.push({ type: 'aircraftSpawn', key: 'ai.aircraftInbound' });
      }
      return;
    }
    aircraft.enduranceMs = Math.max(0, aircraft.enduranceMs - simulated);
    aircraft.attackCooldownMs = Math.max(0, aircraft.attackCooldownMs - simulated);
    const phase = (Number(context.worldTime) || 0) / 24;
    aircraft.x = Math.cos(phase) * 280;
    aircraft.y = Math.sin(phase * 0.82) * 210;
    const visible = Number(context.playerDepth || 0) <= 18 || context.periscopeOpen || context.radarMastRaised;
    const noise = Number(context.noise || 0);
    const gainRate = visible ? 3.2 : Number(context.playerDepth || 0) <= 55 ? Math.max(0, noise - 38) * 0.018 : -1.2;
    aircraft.detectionConfidence = clamp(aircraft.detectionConfidence + gainRate * (simulated / 1000), 0, 100);
    if (aircraft.detectionConfidence >= 45) {
      aircraft.state = 'tracking';
      this.exposureEvents.push({ type: 'aircraftSighting', detectionBoost: (visible ? 0.65 : 0.18) * (simulated / 1000) });
    }
    if (aircraft.detectionConfidence >= 72 && aircraft.attackCooldownMs <= 0 && Number(context.playerDepth || 0) <= 95) {
      aircraft.state = 'attack';
      this.launchDepthChargePattern(aircraft, context, true);
      aircraft.attackCooldownMs = 26000;
      aircraft.detectionConfidence = Math.max(36, aircraft.detectionConfidence - 22);
    }
    if (aircraft.enduranceMs <= 0) {
      aircraft.active = false;
      aircraft.state = 'standby';
      aircraft.detectionConfidence = 0;
      this.state.aircraftSpawnCooldownMs = 90000 + this.profile.difficulty * 12000;
      this.state.lastMessageKey = 'ai.aircraftDeparted';
      this.threatEvents.push({ type: 'aircraftDeparted', key: 'ai.aircraftDeparted' });
    }
  }

  updateStateMachine(deltaMs, context) {
    const compression = clamp(Number(context.timeCompression) || 1, 1, 16);
    const simulated = deltaMs * compression;
    this.state.stateAgeMs += simulated;
    this.state.lastKnown.ageMs += simulated;
    this.state.hostileActionAgeMs += simulated;
    const detection = Number(context.detectionScore) || 0;
    const confidenceGain = detection >= this.state.contactConfidence
      ? detection
      : this.state.contactConfidence - (context.decoyActive ? 2.8 : context.silentRunning ? 1.7 : 0.75) * (simulated / 1000);
    this.state.contactConfidence = clamp(confidenceGain, 0, 100);
    if (context.torpedoActive || this.state.hostileActionAgeMs < 32000) this.state.contactConfidence = Math.max(this.state.contactConfidence, 48);

    if (detection >= 58 || context.torpedoActive || this.state.hostileActionAgeMs < 32000) {
      if (detection >= 28 || context.torpedoActive) this.setLastKnown({ x: 0, y: 0 });
      this.setGlobalState('hunt');
    } else if (detection >= 28) {
      this.setLastKnown({ x: 0, y: 0 });
      this.setGlobalState('alert');
    } else if (this.state.globalState === 'hunt' && this.state.stateAgeMs >= 12000 && this.state.contactConfidence < 46) {
      this.setGlobalState('search', { force: true });
    } else if (this.state.globalState === 'search') {
      if (this.state.stateAgeMs > 9000) {
        this.state.searchLeg = (this.state.searchLeg + 1) % 8;
        this.state.searchRadius = clamp(this.state.searchRadius + 24, 70, 260);
        this.state.stateAgeMs = 0;
      }
      if (this.state.lastKnown.ageMs > 46000 && detection < 12 && this.state.contactConfidence < 20) this.setGlobalState('regroup', { force: true });
    } else if (this.state.globalState === 'alert' && this.state.stateAgeMs > 18000 && detection < 14) {
      this.setGlobalState('regroup', { force: true });
    } else if (this.state.globalState === 'regroup' && this.state.stateAgeMs > 12000) {
      this.setGlobalState('formation', { force: true });
    }
  }

  update(deltaMs = 80, context = {}) {
    const safeDelta = clamp(Number(deltaMs) || 80, 1, 5000);
    this.updateStateMachine(safeDelta, context);
    this.updateFormation(safeDelta, context);
    this.updateEscorts(safeDelta, context);
    const simulated = safeDelta * clamp(Number(context.timeCompression) || 1, 1, 16);
    this.state.attackCooldownMs = Math.max(0, this.state.attackCooldownMs - simulated);
    const nearest = this.nearestEscortRange();
    if (this.state.globalState === 'hunt') {
      const geometry = nearest < 80 ? 1 : nearest < 135 ? 0.72 : nearest < 190 ? 0.35 : 0.08;
      const confidence = clamp(this.state.contactConfidence / 100, 0, 1);
      const gain = geometry * confidence * 5.2 * (simulated / 1000);
      const loss = (context.decoyActive ? 8 : 0) + (context.silentRunning ? 2.6 : 0) + (Number(context.playerDepth || 0) > 80 ? 1.8 : 0);
      this.state.attackSolution = clamp(this.state.attackSolution + gain - loss * (simulated / 1000), 0, 100);
      this.state.attackPhase = this.state.attackSolution >= 72 ? 'attackRun' : this.state.attackSolution >= 42 ? 'localizing' : 'approach';
    } else {
      this.state.attackSolution = clamp(this.state.attackSolution - 3.2 * (simulated / 1000), 0, 100);
      this.state.attackPhase = this.state.globalState === 'search' ? 'reacquire' : 'none';
    }
    if (this.state.globalState === 'hunt' && this.state.stateAgeMs >= 27000 && nearest < 135 && this.state.contactConfidence >= 48 && this.state.attackSolution >= 72 && this.state.attackCooldownMs <= 0) {
      const attacker = this.chooseAttackEscort();
      if (attacker && this.launchDepthChargePattern(attacker, context, false)) {
        this.state.attackCooldownMs = Math.max(26000, 34000 - this.profile.difficulty * 1100);
      }
    }
    this.updateAircraft(safeDelta, context);
    this.updatePatterns(safeDelta * clamp(Number(context.timeCompression) || 1, 1, 16), context);
    this.syncPrimaryState();
    return this.snapshot();
  }

  restore(snapshot = {}) {
    if (!snapshot || ![1, 2].includes(Number(snapshot.aiVersion))) return false;
    if (snapshot.profile && Number(snapshot.profile.merchantCount) !== this.profile.merchantCount) return false;
    const byId = new Map((snapshot.ships || []).map((ship) => [ship.id, ship]));
    for (const ship of this.ships) restoreShip(ship, byId.get(ship.id));
    const state = snapshot.state || snapshot;
    if (AI_STATES.includes(state.globalState)) this.state.globalState = state.globalState;
    this.state.formationAnchor = {
      x: Number(state.formationAnchor?.x) || this.state.formationAnchor.x,
      y: Number(state.formationAnchor?.y) || this.state.formationAnchor.y,
    };
    this.state.convoyCourse = Number(state.convoyCourse) || this.state.convoyCourse;
    this.state.convoySpeedKnots = Number(state.convoySpeedKnots) || this.state.convoySpeedKnots;
    this.state.evasivePhase = Number(state.evasivePhase) || 0;
    this.state.lastKnown = {
      x: Number(state.lastKnown?.x) || 0,
      y: Number(state.lastKnown?.y) || 0,
      ageMs: Math.max(0, Number(state.lastKnown?.ageMs) || 0),
    };
    this.state.searchLeg = clamp(Math.floor(Number(state.searchLeg) || 0), 0, 7);
    this.state.searchRadius = clamp(Number(state.searchRadius) || 80, 60, 300);
    this.state.stateAgeMs = Math.max(0, Number(state.stateAgeMs) || 0);
    this.state.hostileActionAgeMs = Math.max(0, Number(state.hostileActionAgeMs) || 999999);
    this.state.contactConfidence = clamp(Number(state.contactConfidence) || 0, 0, 100);
    this.state.attackSolution = clamp(Number(state.attackSolution) || 0, 0, 100);
    this.state.attackPhase = typeof state.attackPhase === 'string' ? state.attackPhase : 'none';
    this.state.attackCooldownMs = Math.max(0, Number(state.attackCooldownMs) || 0);
    this.state.aircraftSpawnCooldownMs = Math.max(0, Number(state.aircraftSpawnCooldownMs) || 0);
    this.state.lastMessageKey = typeof state.lastMessageKey === 'string' ? state.lastMessageKey : this.state.lastMessageKey;
    this.state.depthChargePatterns = Array.isArray(state.depthChargePatterns)
      ? state.depthChargePatterns.slice(-8).map((pattern) => ({ ...pattern, remainingMs: Math.max(0, Number(pattern.remainingMs) || 0), resolved: Boolean(pattern.resolved) }))
      : [];
    this.state.aircraft = { ...this.state.aircraft, ...(state.aircraft || {}) };
    this.state.metrics = { ...this.state.metrics, ...(state.metrics || {}) };
    this.patternCounter = Math.max(this.patternCounter, ...this.state.depthChargePatterns.map((pattern) => Number(String(pattern.id || '').split('-').pop()) || 0), 0);
    this.syncPrimaryState();
    return true;
  }

  drainDamageEvents() {
    return this.damageEvents.splice(0);
  }

  drainExposureEvents() {
    return this.exposureEvents.splice(0);
  }

  drainThreatEvents() {
    return this.threatEvents.splice(0);
  }

  snapshot() {
    const activeMerchants = this.activeMerchants().length;
    const activeEscorts = this.activeEscorts().length;
    const nearest = this.nearestEscortRange();
    const threatLevel = this.state.globalState === 'hunt' || this.state.aircraft.state === 'attack'
      ? 'critical'
      : this.state.globalState === 'search' || this.state.globalState === 'alert' || this.state.aircraft.active
        ? 'warning'
        : 'clear';
    return {
      aiVersion: 2,
      profile: { ...this.profile },
      ships: this.ships.map((ship) => ship.snapshot()),
      state: {
        globalState: this.state.globalState,
        formationAnchor: { ...this.state.formationAnchor },
        convoyCourse: this.state.convoyCourse,
        convoySpeedKnots: this.state.convoySpeedKnots,
        evasivePhase: this.state.evasivePhase,
        lastKnown: { ...this.state.lastKnown },
        searchLeg: this.state.searchLeg,
        searchRadius: this.state.searchRadius,
        stateAgeMs: this.state.stateAgeMs,
        hostileActionAgeMs: this.state.hostileActionAgeMs,
        contactConfidence: this.state.contactConfidence,
        attackSolution: this.state.attackSolution,
        attackPhase: this.state.attackPhase,
        attackCooldownMs: this.state.attackCooldownMs,
        aircraftSpawnCooldownMs: this.state.aircraftSpawnCooldownMs,
        lastMessageKey: this.state.lastMessageKey,
        depthChargePatterns: this.state.depthChargePatterns.map((pattern) => ({ ...pattern })),
        aircraft: { ...this.state.aircraft },
        metrics: { ...this.state.metrics },
      },
      globalState: this.state.globalState,
      contactConfidence: this.state.contactConfidence,
      attackSolution: this.state.attackSolution,
      attackPhase: this.state.attackPhase,
      formationAnchor: { ...this.state.formationAnchor },
      activeMerchants,
      activeEscorts,
      totalShips: this.ships.length,
      destroyedShips: this.ships.filter((ship) => ship.destroyed).length,
      nearestEscortRange: Number.isFinite(nearest) ? nearest : null,
      depthChargePatterns: this.state.depthChargePatterns.map((pattern) => ({ ...pattern })),
      aircraft: { ...this.state.aircraft },
      threatLevel,
      lastMessageKey: this.state.lastMessageKey,
      metrics: { ...this.state.metrics },
    };
  }
}
