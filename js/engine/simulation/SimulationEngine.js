import { EventBus } from '../core/EventBus.js';
import { SimulationClock } from '../core/SimulationClock.js';
import { NavalAISystem } from '../ai/NavalAISystem.js';
import { DamageControlSystem } from '../damage/DamageControlSystem.js';
import { EnvironmentSystem } from '../environment/EnvironmentSystem.js';
import { SubmarineEntity } from '../entities/SubmarineEntity.js';
import { NavigationSystem } from '../navigation/NavigationSystem.js';
import { SubmarinePhysicsSystem } from '../physics/SubmarinePhysicsSystem.js';
import { SensorSystem } from '../sensors/SensorSystem.js';
import { TacticalEncounterSystem } from '../tactical/TacticalEncounterSystem.js';
import { difficultySummary, getDifficultyProfile } from '../training/DifficultyProfile.js';
import { WeaponSystem } from '../weapons/WeaponSystem.js';
import {
  DECOY_TICKS, DEPTH_CHARGE_RANGE, DEPTH_MAX, DEPTH_MIN, DETECTION_ALERT_THRESHOLD,
  DETECTION_DECAY, DETECTION_HUNT_THRESHOLD, EMERGENCY_DIVE_COOLDOWN,
  EMERGENCY_REPAIR_AMOUNT, EMERGENCY_REPAIR_USES, ESCORT_THREAT_RANGE, FIXED_STEP_MS,
  HUNT_DAMAGE_INTERVAL, MAX_DECOYS, MAX_TORPEDOES, PERISCOPE_MAX_DEPTH, REPAIR_TICKS,
  SILENT_TICKS, SPEED_MOVE, SPEED_NOISE, SPEEDS, TORPEDO_ALERT_BOOST, TORPEDO_TRAVEL_TICKS,
  VIEW_RANGE_X, VIEW_RANGE_Y,
} from './constants.js';
import { buildMissionReport, clamp, computeTargetLock, worldToViewPosition } from './simulationMath.js';

const ESCORT_STATE_ORDER = Object.freeze({ patrol: 0, alert: 1, hunt: 2 });
const SYSTEM_KEYS = Object.freeze(['engines', 'sonar', 'periscope', 'weapons']);

export class SimulationEngine {
  constructor({ mission = {}, submarine = null, initialHull = 100, initialSystems = {}, fixedStepMs = FIXED_STEP_MS, initialSnapshot = null, difficulty = 'officer' } = {}) {
    this.mission = mission || {};
    this.difficulty = getDifficultyProfile(initialSnapshot?.difficulty?.id || difficulty);
    this.events = new EventBus();
    this.player = new SubmarineEntity({
      id: submarine?.id || 'player-submarine',
      depth: 12,
      speed: 'slow',
      hull: initialHull,
      systems: initialSystems,
      resources: { torpedoes: mission?.torpedoes ?? MAX_TORPEDOES, decoys: MAX_DECOYS },
      metadata: { submarine: submarine ? { id: submarine.id, name: submarine.name, stats: { ...(submarine.stats || {}) } } : null },
    });
    this.navalAI = new NavalAISystem({ mission: this.mission });
    this.target = this.navalAI.primaryTarget;
    this.escort = this.navalAI.primaryEscort;
    this.session = {
      missionId: mission?.id || null,
      worldTime: 0,
      elapsedMs: 0,
      scanAngle: 0,
      view: { x: -120, y: 0 },
      escortState: 'patrol',
      playerDetected: false,
      detectionScore: 0,
      torpedoRevealTicks: 0,
      torpedoTravelTicks: 0,
      torpedoLockedAtLaunch: false,
      lastKnown: { x: 0, y: 0 },
      repairUses: EMERGENCY_REPAIR_USES,
      repairTicks: 0,
      missionFailed: false,
      periscopeOpen: false,
      torpedoActive: false,
      silentTicks: 0,
      decoyTicks: 0,
      emergencyDiveCooldown: 0,
      damageFlashTicks: 0,
      lastEventKey: 'gameplay.hint',
      canComplete: false,
      metrics: { shots: 0, hits: 0, maxDetection: 0, damageTaken: 0, startHull: initialHull },
    };
    this.navigation = new NavigationSystem({ mission: this.mission, submarine });
    this.environment = new EnvironmentSystem({ mission: this.mission });
    this.physics = new SubmarinePhysicsSystem({ submarine, initialDepth: this.player.depth });
    this.sensors = new SensorSystem({ mission: this.mission, submarine, difficultyProfile: this.difficulty });
    this.weapons = new WeaponSystem({
      mission: this.mission,
      submarine,
      initialTorpedoes: mission?.torpedoes ?? submarine?.stats?.torpedoes ?? MAX_TORPEDOES,
      difficultyProfile: this.difficulty,
    });
    this.damageControl = new DamageControlSystem({ submarine, initialHull, initialSystems });
    this.encounter = new TacticalEncounterSystem({ mission: this.mission });
    this.player.hull = this.damageControl.snapshot().hullIntegrity;
    this.player.systems = { ...this.damageControl.snapshot().systems };
    this.player.resources.torpedoes = this.weapons.totalTorpedoes();
    this.clock = new SimulationClock({
      fixedStepMs,
      onStep: (stepMs) => this.step(stepMs),
      onRender: () => this.events.emit('simulation:render', this.snapshot()),
    });
    if (initialSnapshot) this.restoreSnapshot(initialSnapshot);
  }

  restoreSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (snapshot.missionId && this.session.missionId && snapshot.missionId !== this.session.missionId) return false;
    const safeNumber = (value, fallback, min = -Infinity, max = Infinity) => {
      const number = Number(value);
      return Number.isFinite(number) ? clamp(number, min, max) : fallback;
    };
    this.player.setDepth(safeNumber(snapshot.depth, this.player.depth, DEPTH_MIN, DEPTH_MAX), DEPTH_MAX);
    if (SPEEDS.includes(snapshot.speed)) this.player.setSpeed(snapshot.speed);
    this.player.hull = safeNumber(snapshot.hull, this.player.hull, 0, 100);
    for (const key of SYSTEM_KEYS) this.player.systems[key] = safeNumber(snapshot.systems?.[key], this.player.systems[key], 0, 100);
    this.player.resources.torpedoes = Math.floor(safeNumber(snapshot.torpedoes, this.player.resources.torpedoes, 0, 40));
    this.player.resources.decoys = Math.floor(safeNumber(snapshot.decoys, this.player.resources.decoys, 0, MAX_DECOYS));
    this.target.moveTo(safeNumber(snapshot.target?.x, this.target.position.x), safeNumber(snapshot.target?.y, this.target.position.y));
    this.escort.moveTo(safeNumber(snapshot.escort?.x, this.escort.position.x), safeNumber(snapshot.escort?.y, this.escort.position.y));
    if (snapshot.targetDestroyed) this.target.destroy();
    if (snapshot.escort?.destroyed) this.escort.destroy();
    this.session.worldTime = Math.floor(safeNumber(snapshot.worldTime, 0, 0));
    this.session.elapsedMs = safeNumber(snapshot.elapsedMs, 0, 0);
    this.session.scanAngle = safeNumber(snapshot.scanAngle, 0, 0, 360);
    this.session.view = { x: safeNumber(snapshot.view?.x, -120, -VIEW_RANGE_X, VIEW_RANGE_X), y: safeNumber(snapshot.view?.y, 0, -VIEW_RANGE_Y, VIEW_RANGE_Y) };
    this.session.escortState = Object.prototype.hasOwnProperty.call(ESCORT_STATE_ORDER, snapshot.escortState) ? snapshot.escortState : 'patrol';
    this.escort.setState(this.session.escortState);
    this.session.playerDetected = Boolean(snapshot.playerDetected);
    this.session.detectionScore = safeNumber(snapshot.detectionScore, 0, 0, 100);
    this.session.torpedoRevealTicks = Math.floor(safeNumber(snapshot.torpedoRevealTicks, 0, 0));
    this.session.torpedoTravelTicks = Math.floor(safeNumber(snapshot.torpedoTravelTicks, 0, 0));
    this.session.torpedoLockedAtLaunch = Boolean(snapshot.torpedoLockedAtLaunch);
    this.session.lastKnown = { x: safeNumber(snapshot.lastKnown?.x, 0), y: safeNumber(snapshot.lastKnown?.y, 0) };
    this.session.repairUses = Math.floor(safeNumber(snapshot.repairUses, EMERGENCY_REPAIR_USES, 0, EMERGENCY_REPAIR_USES));
    this.session.repairTicks = Math.floor(safeNumber(snapshot.repairTicks, 0, 0));
    this.session.missionFailed = Boolean(snapshot.missionFailed);
    this.session.periscopeOpen = Boolean(snapshot.periscopeOpen) && this.player.depth <= PERISCOPE_MAX_DEPTH;
    this.session.torpedoActive = Boolean(snapshot.torpedoActive) && this.session.torpedoTravelTicks > 0;
    this.session.silentTicks = Math.floor(safeNumber(snapshot.silentTicks, 0, 0));
    this.session.decoyTicks = Math.floor(safeNumber(snapshot.decoyTicks, 0, 0));
    this.session.emergencyDiveCooldown = Math.floor(safeNumber(snapshot.emergencyDiveCooldown, 0, 0));
    this.session.damageFlashTicks = Math.floor(safeNumber(snapshot.damageFlashTicks, 0, 0));
    this.session.lastEventKey = typeof snapshot.lastEventKey === 'string' ? snapshot.lastEventKey : 'gameplay.hint';
    this.session.canComplete = false;
    this.session.metrics = { ...this.session.metrics, ...(snapshot.metrics || {}) };
    if (snapshot.physics) {
      this.physics.restore(snapshot.physics);
      this.player.setDepth(this.physics.snapshot().depth, this.physics.snapshot().crushDepth);
    } else {
      this.physics.setOrderedDepth(this.player.depth);
      this.physics.state.depth = this.player.depth;
    }
    if (snapshot.navigation) this.navigation.restore(snapshot.navigation);
    if (snapshot.environment) this.environment.restore(snapshot.environment);
    if (snapshot.sensors) this.sensors.restore(snapshot.sensors);
    if (snapshot.weapons) this.weapons.restore(snapshot.weapons);
    else this.weapons.migrateLegacyTorpedoes(this.player.resources.torpedoes);
    if (snapshot.navalAI) {
      this.navalAI.restore(snapshot.navalAI);
      this.target = this.navalAI.primaryTarget;
      this.escort = this.navalAI.primaryEscort;
    }
    if (snapshot.damageControl) this.damageControl.restore(snapshot.damageControl);
    else {
      this.damageControl.state.hullIntegrity = this.player.hull;
      for (const key of SYSTEM_KEYS) this.damageControl.state.systems[key] = this.player.systems[key];
      this.damageControl.recalculate();
    }
    this.player.hull = this.damageControl.snapshot().hullIntegrity;
    this.player.systems = { ...this.damageControl.snapshot().systems };
    this.player.resources.torpedoes = this.weapons.totalTorpedoes();
    if (snapshot.encounter) this.encounter.restore(snapshot.encounter);
    else if (this.target.destroyed || this.session.metrics.shots > 0) this.encounter.setDoctrine('evade');
    this.session.canComplete = Boolean(this.encounter.snapshot().completionAuthorized) && this.target.destroyed && !this.session.missionFailed;
    this.navigation.setSafetyLimit(this.navigationSafetyLimit());
    return true;
  }

  start() {
    this.clock.start();
    this.events.emit('simulation:started', this.diagnostics());
  }

  stop() {
    this.clock.stop();
    this.events.emit('simulation:stopped', this.diagnostics());
  }

  pause() {
    this.clock.pause();
    this.events.emit('simulation:paused', this.diagnostics());
  }

  resume() {
    this.clock.resume();
    this.events.emit('simulation:resumed', this.diagnostics());
  }

  dispose() {
    this.stop();
    this.events.clear();
  }

  on(eventName, handler) {
    return this.events.on(eventName, handler);
  }

  emitState() {
    if (this.navigation) this.navigation.setSafetyLimit(this.navigationSafetyLimit());
    const snapshot = this.snapshot();
    this.events.emit('state:changed', snapshot);
    return snapshot;
  }

  setHint(key) {
    this.session.lastEventKey = key;
    this.events.emit('hint:changed', { key, snapshot: this.snapshot() });
  }

  setEscortState(nextState, { allowDowngrade = false } = {}) {
    if (!Object.prototype.hasOwnProperty.call(ESCORT_STATE_ORDER, nextState)) return false;
    if (!allowDowngrade && ESCORT_STATE_ORDER[nextState] < ESCORT_STATE_ORDER[this.session.escortState]) return false;
    const previous = this.session.escortState;
    this.session.escortState = nextState;
    this.escort.setState(nextState);
    const aiState = nextState === 'patrol' ? 'formation' : nextState;
    this.navalAI?.setGlobalState(aiState, { force: allowDowngrade });
    if (previous !== nextState) this.events.emit('escort:state', { previous, current: nextState, snapshot: this.snapshot() });
    return previous !== nextState;
  }

  setSpeed(speed) {
    if (!SPEEDS.includes(speed) || this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    this.player.setSpeed(speed);
    this.emitState();
    return { ok: true };
  }

  setSensorMode(mode) {
    if (this.session.missionFailed) return { ok: false, reason: 'failed' };
    const result = this.sensors.setMode(mode);
    if (result.ok) this.emitState();
    return result;
  }

  nudgeHydrophoneBearing(delta) {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    const result = this.sensors.nudgeHydrophoneBearing(delta);
    if (result.ok) this.emitState();
    return result;
  }

  toggleRadarMast(force = null) {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    const result = this.sensors.toggleRadarMast(force, this.player.depth);
    if (result.ok) {
      if (result.raised) this.session.detectionScore = clamp(this.session.detectionScore + 3, 0, 100);
      this.emitState();
    }
    return result;
  }

  activeSonarPing() {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    const result = this.sensors.activePing(this.sensorContext());
    for (const exposure of this.sensors.drainExposureEvents()) {
      this.session.detectionScore = clamp(this.session.detectionScore + Number(exposure.detectionBoost || 0), 0, 100);
    }
    if (result.ok) {
      this.setHint('sensors.hintActivePing');
      this.emitState();
    }
    return result;
  }

  sensorContext() {
    return {
      worldTime: this.session.worldTime,
      depth: this.player.depth,
      systems: this.player.systems,
      physics: this.physics.snapshot(),
      environment: this.environment.snapshot(),
      timeCompression: this.navigation.timeCompression,
      periscopeOpen: this.session.periscopeOpen,
      view: this.session.view,
      contacts: {
        target: { ...this.target.position, destroyed: this.target.destroyed },
        escort: { ...this.escort.position, destroyed: this.escort.destroyed },
      },
    };
  }

  weaponContext() {
    return {
      worldTime: this.session.worldTime,
      depth: this.player.depth,
      systems: this.player.systems,
      missionFailed: this.session.missionFailed,
      escortState: this.session.escortState,
      navigation: this.navigation.snapshot(),
      sensors: this.sensors.snapshot(),
      contacts: {
        target: { ...this.target.position, destroyed: this.target.destroyed },
        escort: { ...this.escort.position, destroyed: this.escort.destroyed },
      },
      timeCompression: this.navigation.timeCompression,
    };
  }

  encounterContext(overrides = {}) {
    return {
      missionFailed: this.session.missionFailed,
      targetDestroyed: this.target.destroyed,
      torpedoActive: this.session.torpedoActive,
      detectionScore: this.session.detectionScore,
      periscopeOpen: this.session.periscopeOpen,
      depth: this.player.depth,
      silentRunning: this.session.silentTicks > 0,
      timeCompression: this.navigation.timeCompression,
      metrics: this.session.metrics,
      physics: this.physics.snapshot(),
      environment: this.environment.snapshot(),
      sensors: this.sensors.snapshot(),
      weapons: this.weapons.snapshot(this.weaponContext()),
      navalAI: this.navalAI.snapshot(),
      ...overrides,
    };
  }

  setTacticalDoctrine(doctrine) {
    if (this.session.missionFailed) return { ok: false, reason: 'failed', key: 'encounter.ended' };
    const result = this.encounter.setDoctrine(doctrine);
    if (result.ok) this.emitState();
    return result;
  }

  navigationSafetyLimit() {
    const physics = this.physics?.snapshot?.() || {};
    if (this.session.missionFailed || this.session.repairTicks > 0 || this.session.damageFlashTicks > 0
      || this.session.periscopeOpen || this.session.torpedoActive || this.session.escortState === 'hunt'
      || physics.status === 'critical' || physics.pressurePercent >= 100 || physics.oxygen <= 15 || physics.co2 >= 80
      || this.damageControl?.snapshot?.().criticalCompartments > 0 || this.damageControl?.snapshot?.().totalFlooding >= 45 || this.damageControl?.snapshot?.().totalFire >= 35) return 1;
    if (this.session.escortState === 'alert' || this.session.detectionScore >= DETECTION_ALERT_THRESHOLD
      || physics.cavitation >= 35 || physics.battery <= 18 || physics.fuel <= 12) return 4;
    return 16;
  }

  emitNavigation() {
    const snapshot = this.snapshot();
    this.events.emit('navigation:changed', snapshot);
    this.events.emit('state:changed', snapshot);
    return snapshot;
  }

  setRudder(value) {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    this.navigation.setRudder(value);
    this.emitNavigation();
    return { ok: true };
  }

  nudgeHeading(delta) {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    this.navigation.nudgeHeading(delta);
    this.emitNavigation();
    return { ok: true };
  }

  toggleAutopilot(force = null) {
    if (this.session.missionFailed) return { ok: false, reason: 'failed' };
    const active = this.navigation.toggleAutopilot(force);
    this.emitNavigation();
    return { ok: true, active };
  }

  requestTimeCompression(value) {
    const result = this.navigation.requestTimeCompression(value, this.navigationSafetyLimit());
    if (result.ok) this.emitNavigation();
    return result;
  }

  addWaypoint(lat, lon) {
    const result = this.navigation.addWaypoint(lat, lon);
    if (result.ok) this.emitNavigation();
    return result;
  }

  removeLastWaypoint() {
    const result = this.navigation.removeLastWaypoint();
    if (result.ok) this.emitNavigation();
    return result;
  }

  resetRoute() {
    this.navigation.resetRoute();
    this.emitNavigation();
    return { ok: true };
  }

  advanceWaypoint() {
    const result = this.navigation.advanceWaypoint();
    if (result.ok) this.emitNavigation();
    return result;
  }

  adjustDepth(delta) {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    this.physics.adjustOrderedDepth(delta);
    this.emitState();
    return { ok: true, orderedDepth: this.physics.snapshot().orderedDepth };
  }

  setBallastCommand(mode) {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    const result = this.physics.setBallastCommand(mode);
    if (result.ok) this.emitState();
    return result;
  }

  nudgeTrim(delta) {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    const result = this.physics.nudgeTrim(delta);
    if (result.ok) this.emitState();
    return result;
  }

  levelTrim() {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    const result = this.physics.levelTrim();
    if (result.ok) this.emitState();
    return result;
  }

  emergencyBlow() {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    const result = this.physics.emergencyBlow();
    if (result.ok) {
      this.session.periscopeOpen = false;
      this.setHint('physics.hintEmergencyBlow');
      this.emitState();
    }
    return result;
  }

  moveView(dx, dy) {
    this.session.view.x = clamp(this.session.view.x + dx, -VIEW_RANGE_X, VIEW_RANGE_X);
    this.session.view.y = clamp(this.session.view.y + dy, -VIEW_RANGE_Y, VIEW_RANGE_Y);
    this.emitState();
  }

  openPeriscope() {
    if (this.session.repairTicks > 0) return { ok: false, reason: 'repair' };
    if (this.session.missionFailed) return { ok: false, reason: 'failed' };
    if ((this.player.systems.periscope ?? 100) <= 10) return { ok: false, reason: 'periscopeDown' };
    if (this.player.depth > PERISCOPE_MAX_DEPTH) return { ok: false, reason: 'tooDeep' };
    this.session.periscopeOpen = true;
    this.sensors.observeVisual(this.sensorContext());
    this.emitState();
    return { ok: true };
  }

  closePeriscope() {
    this.session.periscopeOpen = false;
    this.emitState();
    return { ok: true };
  }

  activateSilentRunning() {
    if (this.session.missionFailed || this.session.repairTicks > 0 || this.session.silentTicks > 0) return { ok: false, reason: 'unavailable' };
    this.session.silentTicks = SILENT_TICKS;
    this.player.setSpeed('slow');
    this.session.detectionScore = clamp(this.session.detectionScore - 18, 0, 100);
    this.setHint('gameplay.hintSilentRunning');
    this.emitState();
    return { ok: true };
  }

  activateEmergencyDive() {
    if (this.session.missionFailed || this.session.repairTicks > 0 || this.session.emergencyDiveCooldown > 0) return { ok: false, reason: 'unavailable' };
    this.physics.emergencyDive();
    this.player.setSpeed('slow');
    this.session.periscopeOpen = false;
    this.session.emergencyDiveCooldown = EMERGENCY_DIVE_COOLDOWN;
    this.session.detectionScore = clamp(this.session.detectionScore - 12, 0, 100);
    this.setHint('gameplay.hintEmergencyDive');
    this.emitState();
    return { ok: true };
  }

  launchDecoy() {
    if (this.session.missionFailed || this.session.repairTicks > 0 || this.player.resources.decoys <= 0) return { ok: false, reason: 'unavailable' };
    this.player.resources.decoys -= 1;
    this.session.decoyTicks = DECOY_TICKS;
    this.session.detectionScore = clamp(this.session.detectionScore - 30, 0, 100);
    if (this.session.escortState === 'hunt') this.setEscortState('alert', { allowDowngrade: true });
    this.setHint('gameplay.hintDecoy');
    this.emitState();
    return { ok: true };
  }

  startEmergencyRepair() {
    const unavailable = this.session.missionFailed || this.session.repairUses <= 0 || this.session.repairTicks > 0 || this.player.hull <= 0 || this.player.hull >= 92;
    if (unavailable) return { ok: false, reason: 'unavailable' };
    this.session.repairUses -= 1;
    this.session.repairTicks = REPAIR_TICKS;
    this.player.setSpeed('stop');
    this.session.periscopeOpen = false;
    this.events.emit('repair:started', this.snapshot());
    this.emitState();
    return { ok: true };
  }

  assignDamageControlTeam(teamId, compartmentId, task) {
    if (this.session.missionFailed) return { ok: false, reason: 'failed' };
    const result = this.damageControl.assignTeam(teamId, compartmentId, task);
    if (result.ok) this.emitState();
    return result;
  }

  recallDamageControlTeam(teamId) {
    const result = this.damageControl.recallTeam(teamId);
    if (result.ok) this.emitState();
    return result;
  }

  toggleWatertightDoors(force = null) {
    const result = this.damageControl.toggleWatertightDoors(force);
    if (result.ok) this.emitState();
    return result;
  }

  toggleDamageControlPumps(force = null) {
    const result = this.damageControl.togglePumps(force);
    if (result.ok) this.emitState();
    return result;
  }

  toggleEmergencyPower(force = null) {
    const result = this.damageControl.toggleEmergencyPower(force);
    if (result.ok) this.emitState();
    return result;
  }

  setWeaponTarget(role) {
    if (this.session.missionFailed) return { ok: false, reason: 'failed' };
    const result = this.weapons.setTarget(role);
    if (result.ok) this.emitState();
    return result;
  }

  selectTorpedoTube(id) {
    const result = this.weapons.selectTube(id);
    if (result.ok) this.emitState();
    return result;
  }

  setSalvoSize(value) {
    const result = this.weapons.setSalvoSize(value);
    if (result.ok) this.emitState();
    return result;
  }

  setTorpedoType(type) {
    const result = this.weapons.setTorpedoType(type);
    if (result.ok) this.emitState();
    return result;
  }

  setTdcValue(key, value) {
    const result = this.weapons.setTdcValue(key, value);
    if (result.ok) {
      this.weapons.updateSolution(this.weaponContext());
      this.emitState();
    }
    return result;
  }

  syncTdcSolution() {
    if (this.session.missionFailed || this.session.repairTicks > 0) return { ok: false, reason: 'unavailable' };
    const result = this.weapons.syncFromContact(this.weaponContext());
    if (result.ok) this.emitState();
    return result;
  }

  targetLock() {
    const snapshot = this.snapshot();
    const contact = snapshot.sensors?.contacts?.target;
    const sensorReady = Boolean(snapshot.periscopeOpen) && Boolean(contact?.detected) && Number(contact?.confidence || 0) >= 35;
    return sensorReady && computeTargetLock({
      depth: snapshot.depth,
      target: snapshot.target,
      view: snapshot.view,
      systems: snapshot.systems,
      targetDestroyed: snapshot.targetDestroyed,
      periscopeMaxDepth: PERISCOPE_MAX_DEPTH,
    });
  }

  fireTorpedo() {
    if (this.session.repairTicks > 0) return { ok: false, reason: 'repair' };
    if ((this.player.systems.weapons ?? 100) <= 10) return { ok: false, reason: 'weaponsDown' };
    if (this.session.missionFailed) return { ok: false, reason: 'failed' };
    const result = this.weapons.fire(this.weaponContext());
    if (!result.ok) return result;

    this.session.metrics.shots += result.shots.length;
    this.player.resources.torpedoes = this.weapons.totalTorpedoes();
    this.session.torpedoActive = true;
    this.session.torpedoTravelTicks = Math.max(...result.shots.map((shot) => Math.ceil(shot.remainingMs / FIXED_STEP_MS)));
    this.session.torpedoLockedAtLaunch = result.shots.some((shot) => shot.predictedHit);
    this.session.torpedoRevealTicks = 70;
    this.session.lastKnown.x = this.target.position.x * 0.35;
    this.session.lastKnown.y = this.target.position.y * 0.5;
    for (const exposure of this.weapons.drainExposureEvents()) {
      this.session.detectionScore = clamp(this.session.detectionScore + Number(exposure.detectionBoost || 0), 0, 100);
    }
    this.setEscortState(this.session.detectionScore >= DETECTION_HUNT_THRESHOLD ? 'hunt' : 'alert');
    this.navalAI.notifyTorpedoLaunch(result.shots);
    this.events.emit('torpedo:fired', { shots: result.shots, salvoSize: result.salvoSize, hitPredicted: this.session.torpedoLockedAtLaunch, snapshot: this.snapshot() });
    this.emitState();
    return { ok: true, shots: result.shots, salvoSize: result.salvoSize, hitPredicted: this.session.torpedoLockedAtLaunch };
  }

  resolveWeaponShot(resolution) {
    const role = resolution.targetRole === 'escort' ? 'escort' : 'target';
    const entity = role === 'escort' ? this.escort : this.target;
    const hit = resolution.outcome === 'hit' && !entity.destroyed;
    if (hit) {
      entity.destroy();
      this.navalAI.notifyShipDestroyed(entity.id);
      this.session.metrics.hits += 1;
      this.damageControl.degradeSystem('weapons', 3);
      this.player.systems = { ...this.damageControl.snapshot().systems };
      if (role === 'target') {
        this.session.canComplete = false;
        this.encounter.setDoctrine('evade');
        this.setEscortState('hunt');
        this.events.emit('target:destroyed', this.snapshot());
      } else {
        this.setEscortState('alert', { allowDowngrade: true });
        this.session.detectionScore = clamp(this.session.detectionScore - 18, 0, 100);
        this.events.emit('escort:destroyed', this.snapshot());
      }
    } else {
      this.damageControl.degradeSystem('weapons', 2);
      this.player.systems = { ...this.damageControl.snapshot().systems };
      this.setEscortState('alert');
      const hintMap = {
        dud: 'weapons.hintDud',
        depthKeeping: 'weapons.hintDepthKeeping',
        premature: 'weapons.hintPremature',
        miss: 'gameplay.hintMiss',
      };
      this.setHint(hintMap[resolution.outcome] || 'gameplay.hintMiss');
    }
    this.events.emit('torpedo:resolved', { ...resolution, hit, snapshot: this.snapshot() });
  }

  applyDamage(amount, systemKey = null, hintKey = 'gameplay.hintDepthCharge', sourceType = 'impact') {
    if (this.session.missionFailed) return;
    const affected = systemKey || SYSTEM_KEYS[this.session.worldTime % SYSTEM_KEYS.length];
    const result = this.damageControl.applyImpact({
      amount,
      systemKey: affected,
      sourceType,
      seed: `${this.session.missionId}:${this.session.worldTime}:${this.session.metrics.damageTaken}`,
    });
    this.player.hull = this.damageControl.snapshot().hullIntegrity;
    this.player.systems = { ...this.damageControl.snapshot().systems };
    this.session.metrics.damageTaken += result.hullDamage;
    this.session.damageFlashTicks = 18;
    this.setHint(hintKey);
    this.events.emit('damage:applied', { amount: result.hullDamage, system: result.systemKey, compartmentId: result.compartmentId, casualties: { injured: result.injured, dead: result.dead }, snapshot: this.snapshot() });
    for (const event of this.damageControl.drainEvents()) this.events.emit('damageControl:event', { ...event, snapshot: this.snapshot() });
    if (this.player.hull <= 0 || this.damageControl.snapshot().criticalFailure) this.failMission();
  }

  failMission() {
    if (this.session.missionFailed) return;
    this.session.missionFailed = true;
    this.session.canComplete = false;
    this.session.periscopeOpen = false;
    this.player.hull = 0;
    this.damageControl.state.hullIntegrity = 0;
    this.damageControl.degradeSystem('engines', Math.max(0, (this.player.systems.engines ?? 100) - 20));
    this.player.systems = { ...this.damageControl.snapshot().systems };
    this.encounter.update(FIXED_STEP_MS, this.encounterContext({ missionFailed: true }));
    this.events.emit('mission:failed', this.snapshot());
    this.emitState();
  }

  missionReport() {
    if (this.session.missionFailed || !this.session.canComplete) return null;
    return buildMissionReport({
      hull: this.player.hull,
      systems: this.player.systems,
      maxDetection: this.session.metrics.maxDetection,
      shots: this.session.metrics.shots,
      mission: this.mission,
    });
  }

  step(stepMs = FIXED_STEP_MS) {
    if (this.session.missionFailed) {
      this.session.elapsedMs += stepMs;
      this.events.emit('simulation:tick', this.snapshot());
      return;
    }

    this.session.worldTime += 1;
    this.session.elapsedMs += stepMs;
    this.session.scanAngle = (this.session.scanAngle + 2.2) % 360;
    if (this.session.torpedoRevealTicks > 0) this.session.torpedoRevealTicks -= 1;
    if (this.session.silentTicks > 0) this.session.silentTicks -= 1;
    if (this.session.decoyTicks > 0) this.session.decoyTicks -= 1;
    if (this.session.emergencyDiveCooldown > 0) this.session.emergencyDiveCooldown -= 1;
    if (this.session.damageFlashTicks > 0) this.session.damageFlashTicks -= 1;
    if (this.session.repairTicks > 0) {
      this.session.repairTicks -= 1;
      if (this.session.repairTicks === 0) {
        this.damageControl.emergencyStabilize(EMERGENCY_REPAIR_AMOUNT);
        this.player.hull = this.damageControl.snapshot().hullIntegrity;
        this.player.systems = { ...this.damageControl.snapshot().systems };
        this.events.emit('repair:completed', this.snapshot());
      }
    }

    const environmentSnapshot = this.environment.update(stepMs, { timeCompression: this.navigation.timeCompression });

    const physicsSnapshot = this.physics.update(stepMs, {
      telegraphSpeed: this.player.speed,
      systems: this.player.systems,
      silentRunning: this.session.silentTicks > 0,
      timeCompression: this.navigation.timeCompression,
      resourceMultiplier: this.difficulty.resourceConsumptionMultiplier,
    });
    this.player.setDepth(physicsSnapshot.depth, physicsSnapshot.crushDepth);
    if (this.player.depth > PERISCOPE_MAX_DEPTH) this.session.periscopeOpen = false;
    for (const event of this.physics.drainDamageEvents()) {
      const hint = event.reason === 'pressure' ? 'physics.hintPressureDamage' : 'physics.hintAtmosphereDamage';
      this.applyDamage(event.amount, event.system, hint);
      if (this.session.missionFailed) break;
    }

    const damageSnapshot = this.damageControl.update(stepMs, {
      timeCompression: this.navigation.timeCompression,
      depth: this.player.depth,
      oxygen: physicsSnapshot.oxygen,
    });
    this.player.hull = Math.min(this.player.hull, damageSnapshot.hullIntegrity);
    this.player.systems = { ...damageSnapshot.systems };
    for (const event of this.damageControl.drainHullDamageEvents()) {
      const hullDamage = this.player.applyDamage(event.amount, event.system);
      this.damageControl.state.hullIntegrity = this.player.hull;
      this.session.metrics.damageTaken += hullDamage;
      this.session.damageFlashTicks = 18;
      this.setHint(event.key || 'damage.hintProgressiveFlooding');
      this.events.emit('damage:applied', { amount: hullDamage, system: event.system, progressive: true, snapshot: this.snapshot() });
    }
    for (const event of this.damageControl.drainEvents()) this.events.emit('damageControl:event', { ...event, snapshot: this.snapshot() });
    if (damageSnapshot.criticalFailure || this.player.hull <= 0) {
      this.failMission();
      return;
    }

    const sensorSnapshot = this.sensors.update(stepMs, this.sensorContext());
    for (const exposure of this.sensors.drainExposureEvents()) {
      this.session.detectionScore = clamp(this.session.detectionScore + Number(exposure.detectionBoost || 0), 0, 100);
    }

    const weaponSnapshot = this.weapons.update(stepMs, this.weaponContext());
    this.player.resources.torpedoes = weaponSnapshot.totalTorpedoes;
    this.session.torpedoActive = weaponSnapshot.activeShots.length > 0;
    this.session.torpedoTravelTicks = this.session.torpedoActive
      ? Math.max(...weaponSnapshot.activeShots.map((shot) => Math.ceil(shot.remainingMs / FIXED_STEP_MS)))
      : 0;
    for (const resolution of this.weapons.drainResolutionEvents()) this.resolveWeaponShot(resolution);
    for (const exposure of this.weapons.drainExposureEvents()) {
      this.session.detectionScore = clamp(this.session.detectionScore + Number(exposure.detectionBoost || 0), 0, 100);
    }

    const noise = physicsSnapshot.noise * (this.session.decoyTicks > 0 ? 0.45 : 1);
    const sonarFactor = clamp((this.player.systems.sonar ?? 100) / 100, 0.35, 1);
    const periscopePenalty = (this.player.systems.periscope ?? 100) < 35 ? 0.3 : 0;
    const depthRisk = Math.max(0, PERISCOPE_MAX_DEPTH - this.player.depth);
    const deepCover = this.player.depth > 90 ? 0.42 : this.player.depth > 50 ? 0.68 : 1;
    const nearestEscort = this.navalAI.nearestEscortRange();
    const rangeFactor = nearestEscort < 80 ? 1.25 : nearestEscort < 140 ? 0.9 : nearestEscort < 220 ? 0.5 : 0.2;
    const simulatedSeconds = Math.max(0.001, (stepMs / 1000) * clamp(this.navigation.timeCompression, 1, 16));
    const sensitivity = clamp(this.mission.escortSensitivity ?? 1, 0.65, 1.8);
    const acousticMasking = clamp(1.18 - environmentSnapshot.ambientNoise / 150, 0.42, 1.1);
    const acousticRate = noise * 0.018 * rangeFactor * sensitivity * deepCover * acousticMasking / sonarFactor;
    const visualWeather = clamp(environmentSnapshot.visualFactor, 0.16, 1.12);
    const visualRate = this.session.periscopeOpen ? (0.55 + depthRisk * 0.085 + periscopePenalty) * sensitivity * visualWeather : 0;
    const radarRate = sensorSnapshot.radarMastRaised ? 1.15 * sensitivity * clamp(1 - environmentSnapshot.radarClutter / 170, 0.45, 1) : 0;
    const torpedoRate = this.session.torpedoRevealTicks > 0 ? 1.8 * sensitivity : 0;
    const decayRate = 0.55 + (this.player.depth > 50 ? 0.18 : 0) + (this.session.silentTicks > 0 ? 0.85 : 0) + (this.session.decoyTicks > 0 ? 1.25 : 0);
    const netRate = (acousticRate + visualRate + radarRate + torpedoRate) * this.difficulty.enemyDetectionMultiplier - decayRate;
    this.session.detectionScore = clamp(this.session.detectionScore + netRate * simulatedSeconds, 0, 100);
    this.session.metrics.maxDetection = Math.max(this.session.metrics.maxDetection, Math.round(this.session.detectionScore));

    // A destroyed target or a past torpedo launch starts a hostile reaction inside
    // NavalAISystem, but must not pin the escorts in hunt forever. Detection alone
    // may promote the immediate UI state here; the AI owns later search/regroup loss.
    if (this.session.detectionScore >= DETECTION_HUNT_THRESHOLD) this.setEscortState('hunt');
    else if (this.session.detectionScore >= DETECTION_ALERT_THRESHOLD) this.setEscortState('alert');

    const aiSnapshot = this.navalAI.update(stepMs, {
      worldTime: this.session.worldTime,
      timeCompression: this.navigation.timeCompression,
      detectionScore: this.session.detectionScore,
      targetDestroyed: this.target.destroyed,
      torpedoActive: this.session.torpedoActive,
      playerDepth: this.player.depth,
      actualSpeedKnots: physicsSnapshot.actualSpeedKnots,
      noise: physicsSnapshot.noise,
      decoyActive: this.session.decoyTicks > 0,
      silentRunning: this.session.silentTicks > 0,
      periscopeOpen: this.session.periscopeOpen,
      radarMastRaised: sensorSnapshot.radarMastRaised,
      environment: environmentSnapshot,
    });
    const aiStateMap = { formation: 'patrol', regroup: 'patrol', alert: 'alert', search: 'alert', hunt: 'hunt' };
    this.session.escortState = aiStateMap[aiSnapshot.globalState] || this.session.escortState;
    this.session.playerDetected = aiSnapshot.globalState === 'hunt' && aiSnapshot.activeEscorts > 0;
    for (const event of this.navalAI.drainExposureEvents()) {
      this.session.detectionScore = clamp(this.session.detectionScore + Number(event.detectionBoost || 0), 0, 100);
    }
    for (const event of this.navalAI.drainDamageEvents()) {
      const adjustedDamage = Math.max(0, Math.round(Number(event.amount || 0) * this.difficulty.enemyDamageMultiplier));
      this.applyDamage(adjustedDamage, event.system, event.key || 'ai.hintCoordinatedDepthCharge', event.sourceType || 'depthCharge');
      if (this.session.missionFailed) break;
    }
    for (const event of this.navalAI.drainThreatEvents()) {
      if (event.key) this.setHint(event.key);
      this.events.emit('ai:threat', { ...event, snapshot: this.snapshot() });
    }

    const encounterSnapshot = this.encounter.update(stepMs, this.encounterContext({ navalAI: aiSnapshot, weapons: weaponSnapshot, sensors: sensorSnapshot, physics: physicsSnapshot }));
    this.session.canComplete = Boolean(encounterSnapshot.completionAuthorized) && this.target.destroyed && !this.session.missionFailed;
    for (const event of this.encounter.drainEvents()) {
      if (event.key) this.setHint(event.key);
      this.events.emit('encounter:event', { ...event, snapshot: this.snapshot() });
    }

    this.navigation.update(stepMs, this.player.speed, this.navigationSafetyLimit(), this.physics.snapshot().actualSpeedKnots);
    this.events.emit('simulation:tick', this.snapshot());
  }

  snapshot() {
    const player = this.player.snapshot();
    const target = this.target.snapshot();
    const escort = this.escort.snapshot();
    return {
      missionId: this.session.missionId,
      mission: this.mission,
      depth: player.depth,
      speed: player.speed,
      hull: player.hull,
      systems: player.systems,
      torpedoes: this.weapons.totalTorpedoes(),
      decoys: player.resources.decoys,
      target: { x: target.x, y: target.y, type: target.shipType },
      escort: { x: escort.x, y: escort.y, state: escort.state, destroyed: escort.destroyed },
      targetDestroyed: target.destroyed,
      escortState: this.session.escortState,
      playerDetected: this.session.playerDetected,
      detectionScore: this.session.detectionScore,
      scanAngle: this.session.scanAngle,
      view: { ...this.session.view },
      worldTime: this.session.worldTime,
      elapsedMs: this.session.elapsedMs,
      repairUses: this.session.repairUses,
      repairTicks: this.session.repairTicks,
      missionFailed: this.session.missionFailed,
      periscopeOpen: this.session.periscopeOpen,
      torpedoActive: this.session.torpedoActive,
      torpedoRevealTicks: this.session.torpedoRevealTicks,
      torpedoTravelTicks: this.session.torpedoTravelTicks,
      torpedoLockedAtLaunch: this.session.torpedoLockedAtLaunch,
      lastKnown: { ...this.session.lastKnown },
      silentTicks: this.session.silentTicks,
      decoyTicks: this.session.decoyTicks,
      emergencyDiveCooldown: this.session.emergencyDiveCooldown,
      damageFlashTicks: this.session.damageFlashTicks,
      lastEventKey: this.session.lastEventKey,
      canComplete: this.session.canComplete,
      metrics: { ...this.session.metrics },
      navigation: this.navigation.snapshot(),
      environment: this.environment.snapshot(),
      physics: this.physics.snapshot(),
      sensors: this.sensors.snapshot(),
      weapons: this.weapons.snapshot(this.weaponContext()),
      navalAI: this.navalAI.snapshot(),
      damageControl: this.damageControl.snapshot(),
      encounter: this.encounter.snapshot(),
      difficulty: difficultySummary(this.difficulty),
      snapshotVersion: 10,
      entityCount: 1 + this.navalAI.ships.length + (this.navalAI.state.aircraft.active ? 1 : 0),
    };
  }

  diagnostics() {
    return {
      engine: 'SimulationEngine',
      version: 10,
      missionId: this.session.missionId,
      entityCount: 1 + this.navalAI.ships.length + (this.navalAI.state.aircraft.active ? 1 : 0),
      aiVersion: 2,
      encounterVersion: 1,
      navigationVersion: 1,
      physicsVersion: 1,
      sensorVersion: 2,
      environmentVersion: 1,
      weaponVersion: 1,
      damageControlVersion: 1,
      eventBusListeners: [...this.events.listeners.values()].reduce((total, handlers) => total + handlers.size, 0),
      clock: this.clock.diagnostics(),
    };
  }

  worldToPeriscope(entity) {
    return worldToViewPosition(entity, this.session.view);
  }
}
