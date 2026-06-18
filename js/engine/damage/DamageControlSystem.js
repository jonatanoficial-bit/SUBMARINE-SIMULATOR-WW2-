import { clamp } from '../simulation/simulationMath.js';

const TASKS = Object.freeze(['idle', 'pump', 'fire', 'repair', 'medical']);
const DAMAGE_SYSTEM_KEYS = Object.freeze(['engines', 'sonar', 'periscope', 'weapons']);
const COMPARTMENT_BLUEPRINT = Object.freeze([
  { id: 'bowTorpedo', labelKey: 'damage.compartment.bowTorpedo', systemKey: 'weapons', crew: 6 },
  { id: 'forwardBattery', labelKey: 'damage.compartment.forwardBattery', systemKey: 'engines', crew: 6 },
  { id: 'controlRoom', labelKey: 'damage.compartment.controlRoom', systemKey: 'periscope', crew: 7 },
  { id: 'sonarRoom', labelKey: 'damage.compartment.sonarRoom', systemKey: 'sonar', crew: 5 },
  { id: 'engineRoom', labelKey: 'damage.compartment.engineRoom', systemKey: 'engines', crew: 8 },
  { id: 'aftBattery', labelKey: 'damage.compartment.aftBattery', systemKey: 'engines', crew: 6 },
  { id: 'sternTorpedo', labelKey: 'damage.compartment.sternTorpedo', systemKey: 'weapons', crew: 6 },
]);

function safeNumber(value, fallback = 0, min = -Infinity, max = Infinity) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

function deterministicRoll(seed = '') {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

function cloneCompartment(compartment) {
  return {
    ...compartment,
    casualties: { ...compartment.casualties },
  };
}

export class DamageControlSystem {
  constructor({ submarine = null, initialHull = 100, initialSystems = {} } = {}) {
    const depthRating = Number(submarine?.stats?.depth || 60);
    const crewTotal = 44;
    this.profile = Object.freeze({
      crewTotal,
      teamCount: 3,
      pumpCapacity: 1 + depthRating / 180,
      fireSuppression: 1,
      repairEfficiency: 1 + Number(submarine?.stats?.range || 60) / 400,
    });
    this.state = {
      hullIntegrity: clamp(Number(initialHull) || 100, 0, 100),
      compartments: COMPARTMENT_BLUEPRINT.map((item) => ({
        ...item,
        integrity: 100,
        flooding: 0,
        fire: 0,
        electricalDamage: 0,
        oxygen: 100,
        sealed: false,
        casualties: { fit: item.crew, injured: 0, dead: 0 },
        assignedTeamId: null,
        activeTask: 'idle',
      })),
      teams: Array.from({ length: this.profile.teamCount }, (_, index) => ({
        id: `dc-team-${index + 1}`,
        labelKey: `damage.team.${index + 1}`,
        compartmentId: null,
        task: 'idle',
        progress: 0,
        fatigue: 0,
      })),
      systems: {
        engines: clamp(Number(initialSystems.engines ?? 100), 0, 100),
        sonar: clamp(Number(initialSystems.sonar ?? 100), 0, 100),
        periscope: clamp(Number(initialSystems.periscope ?? 100), 0, 100),
        weapons: clamp(Number(initialSystems.weapons ?? 100), 0, 100),
      },
      watertightDoorsClosed: false,
      pumpsActive: true,
      emergencyPower: false,
      mainPower: true,
      busVoltage: 100,
      morale: 100,
      casualtyTotals: { fit: crewTotal, injured: 0, dead: 0 },
      totalFlooding: 0,
      totalFire: 0,
      criticalCompartments: 0,
      criticalFailure: false,
      lastMessageKey: 'damage.ready',
      elapsedMs: 0,
      attritionAccumulator: 0,
      eventSequence: 0,
      metrics: {
        impacts: 0,
        floodingContained: 0,
        firesExtinguished: 0,
        systemsRestored: 0,
        casualtiesTreated: 0,
      },
    };
    this.events = [];
    this.hullDamageEvents = [];
    this.recalculate();
  }

  compartment(id) {
    return this.state.compartments.find((item) => item.id === id) || null;
  }

  team(id) {
    return this.state.teams.find((item) => item.id === id) || null;
  }

  emit(type, payload = {}) {
    this.state.eventSequence += 1;
    this.events.push({ id: this.state.eventSequence, type, ...payload });
  }

  drainEvents() {
    const events = this.events.splice(0);
    return events;
  }

  drainHullDamageEvents() {
    const events = this.hullDamageEvents.splice(0);
    return events;
  }

  chooseCompartment(systemKey, seed) {
    const matches = this.state.compartments.filter((item) => item.systemKey === systemKey);
    const pool = matches.length ? matches : this.state.compartments;
    return pool[Math.floor(deterministicRoll(seed) * pool.length) % pool.length];
  }

  applyImpact({ amount = 1, systemKey = null, sourceType = 'impact', seed = '' } = {}) {
    const impact = clamp(Math.round(Number(amount) || 1), 1, 100);
    const chosenSystem = DAMAGE_SYSTEM_KEYS.includes(systemKey) ? systemKey : DAMAGE_SYSTEM_KEYS[Math.floor(deterministicRoll(`${seed}:system`) * DAMAGE_SYSTEM_KEYS.length) % DAMAGE_SYSTEM_KEYS.length];
    const compartment = this.chooseCompartment(chosenSystem, `${seed}:${sourceType}:${this.state.metrics.impacts}`);
    const roll = deterministicRoll(`${seed}:${compartment.id}:severity`);
    const pressureFactor = sourceType === 'depthCharge' || sourceType === 'aircraft' ? 1.22 : 1;
    const fireFactor = sourceType === 'electrical' ? 1.4 : sourceType === 'depthCharge' ? 0.55 : 0.9;
    compartment.integrity = clamp(compartment.integrity - impact * (0.72 + roll * 0.28), 0, 100);
    compartment.flooding = clamp(compartment.flooding + impact * pressureFactor * (0.72 + roll * 0.48), 0, 100);
    compartment.fire = clamp(compartment.fire + impact * fireFactor * (0.18 + deterministicRoll(`${seed}:fire`) * 0.34), 0, 100);
    compartment.electricalDamage = clamp(compartment.electricalDamage + impact * (0.45 + deterministicRoll(`${seed}:electrical`) * 0.45), 0, 100);
    const casualtyPressure = impact + compartment.fire * 0.08 + compartment.flooding * 0.05;
    const injured = Math.min(compartment.casualties.fit, casualtyPressure >= 8 ? Math.max(1, Math.floor(casualtyPressure / 13)) : 0);
    const dead = Math.min(Math.max(0, compartment.casualties.fit - injured), casualtyPressure >= 24 && deterministicRoll(`${seed}:fatal`) > 0.42 ? 1 : 0);
    compartment.casualties.fit -= injured + dead;
    compartment.casualties.injured += injured;
    compartment.casualties.dead += dead;
    const hullDamage = impact;
    this.state.hullIntegrity = clamp(this.state.hullIntegrity - hullDamage, 0, 100);
    this.state.systems[chosenSystem] = clamp(this.state.systems[chosenSystem] - impact * 0.68, 0, 100);
    this.state.metrics.impacts += 1;
    this.state.lastMessageKey = sourceType === 'aircraft' ? 'damage.impactAircraft' : sourceType === 'depthCharge' ? 'damage.impactDepthCharge' : 'damage.impactGeneric';
    this.emit('impact', { compartmentId: compartment.id, systemKey: chosenSystem, amount: hullDamage, injured, dead, sourceType });
    this.recalculate();
    return { hullDamage, systemKey: chosenSystem, compartmentId: compartment.id, injured, dead };
  }

  degradeSystem(systemKey, amount = 1) {
    if (!DAMAGE_SYSTEM_KEYS.includes(systemKey)) return false;
    this.state.systems[systemKey] = clamp(this.state.systems[systemKey] - Math.max(0, Number(amount) || 0), 0, 100);
    this.recalculate();
    return true;
  }

  restoreSystem(systemKey, amount = 1) {
    if (!DAMAGE_SYSTEM_KEYS.includes(systemKey)) return false;
    this.state.systems[systemKey] = clamp(this.state.systems[systemKey] + Math.max(0, Number(amount) || 0), 0, 100);
    this.recalculate();
    return true;
  }

  assignTeam(teamId, compartmentId, task) {
    const team = this.team(teamId);
    const compartment = this.compartment(compartmentId);
    if (!team) return { ok: false, reason: 'invalidTeam' };
    if (!compartment) return { ok: false, reason: 'invalidCompartment' };
    if (!TASKS.includes(task) || task === 'idle') return { ok: false, reason: 'invalidDamageTask' };
    const occupied = this.state.teams.find((item) => item.id !== teamId && item.compartmentId === compartmentId && item.task === task);
    if (occupied) return { ok: false, reason: 'damageTaskOccupied' };
    const old = this.compartment(team.compartmentId);
    if (old && old.assignedTeamId === team.id) {
      old.assignedTeamId = null;
      old.activeTask = 'idle';
    }
    team.compartmentId = compartmentId;
    team.task = task;
    team.progress = 0;
    compartment.assignedTeamId = team.id;
    compartment.activeTask = task;
    this.state.lastMessageKey = 'damage.teamAssigned';
    this.emit('teamAssigned', { teamId, compartmentId, task });
    return { ok: true };
  }

  recallTeam(teamId) {
    const team = this.team(teamId);
    if (!team) return { ok: false, reason: 'invalidTeam' };
    const compartment = this.compartment(team.compartmentId);
    if (compartment && compartment.assignedTeamId === team.id) {
      compartment.assignedTeamId = null;
      compartment.activeTask = 'idle';
    }
    team.compartmentId = null;
    team.task = 'idle';
    team.progress = 0;
    this.state.lastMessageKey = 'damage.teamRecalled';
    this.emit('teamRecalled', { teamId });
    return { ok: true };
  }

  toggleWatertightDoors(force = null) {
    this.state.watertightDoorsClosed = force === null ? !this.state.watertightDoorsClosed : Boolean(force);
    for (const compartment of this.state.compartments) compartment.sealed = this.state.watertightDoorsClosed;
    this.state.lastMessageKey = this.state.watertightDoorsClosed ? 'damage.doorsClosedMessage' : 'damage.doorsOpenMessage';
    return { ok: true, closed: this.state.watertightDoorsClosed };
  }

  togglePumps(force = null) {
    const next = force === null ? !this.state.pumpsActive : Boolean(force);
    if (next && !this.state.mainPower && !this.state.emergencyPower) return { ok: false, reason: 'damageNoPower' };
    this.state.pumpsActive = next;
    this.state.lastMessageKey = next ? 'damage.pumpsStarted' : 'damage.pumpsStopped';
    return { ok: true, active: next };
  }

  toggleEmergencyPower(force = null) {
    this.state.emergencyPower = force === null ? !this.state.emergencyPower : Boolean(force);
    this.state.lastMessageKey = this.state.emergencyPower ? 'damage.emergencyPowerOn' : 'damage.emergencyPowerOff';
    this.recalculate();
    return { ok: true, active: this.state.emergencyPower };
  }

  emergencyStabilize(amount = 12) {
    const worst = this.state.compartments.slice().sort((a, b) => (b.flooding + b.fire + (100 - b.integrity)) - (a.flooding + a.fire + (100 - a.integrity)))[0];
    if (worst) {
      worst.flooding = clamp(worst.flooding - amount, 0, 100);
      worst.fire = clamp(worst.fire - amount * 0.7, 0, 100);
      worst.integrity = clamp(worst.integrity + amount * 0.55, 0, 100);
      worst.electricalDamage = clamp(worst.electricalDamage - amount * 0.5, 0, 100);
    }
    this.state.hullIntegrity = clamp(this.state.hullIntegrity + amount * 0.65, 0, 74);
    this.restoreSystem('engines', amount * 0.8);
    this.state.lastMessageKey = 'damage.emergencyStabilized';
    this.recalculate();
  }

  processTeam(team, compartment, seconds) {
    if (!compartment || team.task === 'idle') return;
    const fitRatio = compartment.crew > 0 ? compartment.casualties.fit / compartment.crew : 0;
    const fatigueFactor = clamp(1 - team.fatigue / 140, 0.35, 1);
    const efficiency = clamp((0.55 + fitRatio * 0.45) * fatigueFactor, 0.2, 1.15);
    team.fatigue = clamp(team.fatigue + seconds * 0.38, 0, 100);
    team.progress = (team.progress + seconds * efficiency * 7) % 100;
    if (team.task === 'pump') {
      const before = compartment.flooding;
      compartment.flooding = clamp(compartment.flooding - seconds * 0.78 * efficiency * this.profile.pumpCapacity, 0, 100);
      if (before > 0 && compartment.flooding === 0) this.state.metrics.floodingContained += 1;
    } else if (team.task === 'fire') {
      const before = compartment.fire;
      compartment.fire = clamp(compartment.fire - seconds * 0.9 * efficiency * this.profile.fireSuppression, 0, 100);
      compartment.oxygen = clamp(compartment.oxygen - seconds * 0.04, 20, 100);
      if (before > 0 && compartment.fire === 0) this.state.metrics.firesExtinguished += 1;
    } else if (team.task === 'repair') {
      const before = compartment.integrity;
      compartment.integrity = clamp(compartment.integrity + seconds * 0.34 * efficiency * this.profile.repairEfficiency, 0, 100);
      compartment.electricalDamage = clamp(compartment.electricalDamage - seconds * 0.42 * efficiency, 0, 100);
      const gain = seconds * 0.18 * efficiency;
      this.state.systems[compartment.systemKey] = clamp(this.state.systems[compartment.systemKey] + gain, 0, 100);
      if (before < 100 && compartment.integrity === 100) this.state.metrics.systemsRestored += 1;
    } else if (team.task === 'medical' && compartment.casualties.injured > 0) {
      team.progress += seconds * efficiency * 8;
      if (team.progress >= 100) {
        team.progress -= 100;
        compartment.casualties.injured -= 1;
        compartment.casualties.fit += 1;
        this.state.metrics.casualtiesTreated += 1;
        this.emit('casualtyTreated', { teamId: team.id, compartmentId: compartment.id });
      }
    }
  }

  update(deltaMs = 80, context = {}) {
    const compression = clamp(Number(context.timeCompression) || 1, 1, 16);
    const seconds = clamp((Number(deltaMs) || 80) / 1000 * compression, 0.001, 8);
    this.state.elapsedMs += Number(deltaMs) || 80;
    for (const team of this.state.teams) {
      const compartment = this.compartment(team.compartmentId);
      if (!compartment || team.task === 'idle') {
        team.fatigue = clamp(team.fatigue - seconds * 0.22, 0, 100);
        continue;
      }
      this.processTeam(team, compartment, seconds);
    }

    const powered = this.state.mainPower || this.state.emergencyPower;
    const doorsFactor = this.state.watertightDoorsClosed ? 0.32 : 1;
    for (let index = 0; index < this.state.compartments.length; index += 1) {
      const compartment = this.state.compartments[index];
      const breach = clamp((100 - compartment.integrity) / 100, 0, 1);
      if (breach > 0.08) compartment.flooding = clamp(compartment.flooding + seconds * breach * 0.22 * doorsFactor, 0, 100);
      if (compartment.electricalDamage > 38 && powered) compartment.fire = clamp(compartment.fire + seconds * compartment.electricalDamage * 0.00045, 0, 100);
      if (compartment.fire > 0) {
        compartment.oxygen = clamp(compartment.oxygen - seconds * compartment.fire * 0.0024, 0, 100);
        compartment.integrity = clamp(compartment.integrity - seconds * compartment.fire * 0.0015, 0, 100);
      } else {
        compartment.oxygen = clamp(compartment.oxygen + seconds * 0.08, 0, 100);
      }
      if (this.state.pumpsActive && powered && compartment.flooding > 0) {
        compartment.flooding = clamp(compartment.flooding - seconds * 0.14 * this.profile.pumpCapacity, 0, 100);
      }
      if (!this.state.watertightDoorsClosed && index < this.state.compartments.length - 1) {
        const next = this.state.compartments[index + 1];
        if (compartment.fire > 46) next.fire = clamp(next.fire + seconds * 0.025, 0, 100);
        if (compartment.flooding > 62) next.flooding = clamp(next.flooding + seconds * 0.035, 0, 100);
      }
    }

    const control = this.compartment('controlRoom');
    const engine = this.compartment('engineRoom');
    this.state.mainPower = Boolean(engine && control && engine.electricalDamage < 78 && engine.flooding < 82 && control.electricalDamage < 84);
    if (!this.state.mainPower && !this.state.emergencyPower) this.state.pumpsActive = false;
    this.state.busVoltage = this.state.mainPower ? clamp(100 - (engine?.electricalDamage || 0) * 0.35, 55, 100) : this.state.emergencyPower ? 42 : 0;

    this.recalculate();
    const severeFlooding = this.state.compartments.reduce((sum, item) => sum + Math.max(0, item.flooding - 65), 0);
    const severeFire = this.state.compartments.reduce((sum, item) => sum + Math.max(0, item.fire - 70), 0);
    this.state.attritionAccumulator += seconds * (severeFlooding * 0.005 + severeFire * 0.004);
    if (this.state.attritionAccumulator >= 1) {
      const amount = Math.min(4, Math.floor(this.state.attritionAccumulator));
      this.state.attritionAccumulator -= amount;
      const worst = this.state.compartments.slice().sort((a, b) => (b.flooding + b.fire) - (a.flooding + a.fire))[0];
      this.hullDamageEvents.push({ amount, system: worst?.systemKey || 'engines', key: severeFlooding >= severeFire ? 'damage.hintProgressiveFlooding' : 'damage.hintProgressiveFire' });
    }
    return this.snapshot();
  }

  recalculate() {
    const totals = this.state.compartments.reduce((acc, item) => {
      acc.fit += item.casualties.fit;
      acc.injured += item.casualties.injured;
      acc.dead += item.casualties.dead;
      acc.flooding += item.flooding;
      acc.fire += item.fire;
      if (item.flooding >= 75 || item.fire >= 75 || item.integrity <= 25) acc.critical += 1;
      return acc;
    }, { fit: 0, injured: 0, dead: 0, flooding: 0, fire: 0, critical: 0 });
    this.state.casualtyTotals = { fit: totals.fit, injured: totals.injured, dead: totals.dead };
    this.state.totalFlooding = totals.flooding / this.state.compartments.length;
    this.state.totalFire = totals.fire / this.state.compartments.length;
    this.state.criticalCompartments = totals.critical;
    this.state.morale = clamp(100 - totals.injured * 1.6 - totals.dead * 4.5 - this.state.totalFlooding * 0.2 - this.state.totalFire * 0.22, 0, 100);
    for (const key of DAMAGE_SYSTEM_KEYS) {
      const rooms = this.state.compartments.filter((item) => item.systemKey === key);
      const condition = rooms.reduce((sum, item) => sum + clamp(item.integrity - item.flooding * 0.45 - item.fire * 0.5 - item.electricalDamage * 0.32, 0, 100), 0) / Math.max(1, rooms.length);
      this.state.systems[key] = clamp(Math.min(this.state.systems[key], condition + 18), 0, 100);
    }
    this.state.criticalFailure = this.state.hullIntegrity <= 0 || totals.fit <= 4 || this.state.compartments.some((item) => item.flooding >= 99 || (item.fire >= 99 && item.oxygen > 12));
  }

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    this.state.hullIntegrity = safeNumber(snapshot.hullIntegrity, this.state.hullIntegrity, 0, 100);
    const savedCompartments = Array.isArray(snapshot.compartments) ? snapshot.compartments : [];
    for (const compartment of this.state.compartments) {
      const saved = savedCompartments.find((item) => item?.id === compartment.id);
      if (!saved) continue;
      compartment.integrity = safeNumber(saved.integrity, compartment.integrity, 0, 100);
      compartment.flooding = safeNumber(saved.flooding, compartment.flooding, 0, 100);
      compartment.fire = safeNumber(saved.fire, compartment.fire, 0, 100);
      compartment.electricalDamage = safeNumber(saved.electricalDamage, compartment.electricalDamage, 0, 100);
      compartment.oxygen = safeNumber(saved.oxygen, compartment.oxygen, 0, 100);
      compartment.sealed = Boolean(saved.sealed);
      compartment.casualties = {
        fit: Math.floor(safeNumber(saved.casualties?.fit, compartment.casualties.fit, 0, compartment.crew)),
        injured: Math.floor(safeNumber(saved.casualties?.injured, compartment.casualties.injured, 0, compartment.crew)),
        dead: Math.floor(safeNumber(saved.casualties?.dead, compartment.casualties.dead, 0, compartment.crew)),
      };
      compartment.assignedTeamId = typeof saved.assignedTeamId === 'string' ? saved.assignedTeamId : null;
      compartment.activeTask = TASKS.includes(saved.activeTask) ? saved.activeTask : 'idle';
    }
    const savedTeams = Array.isArray(snapshot.teams) ? snapshot.teams : [];
    for (const team of this.state.teams) {
      const saved = savedTeams.find((item) => item?.id === team.id);
      if (!saved) continue;
      team.compartmentId = this.compartment(saved.compartmentId) ? saved.compartmentId : null;
      team.task = TASKS.includes(saved.task) ? saved.task : 'idle';
      team.progress = safeNumber(saved.progress, 0, 0, 100);
      team.fatigue = safeNumber(saved.fatigue, 0, 0, 100);
    }
    for (const key of DAMAGE_SYSTEM_KEYS) this.state.systems[key] = safeNumber(snapshot.systems?.[key], this.state.systems[key], 0, 100);
    this.state.watertightDoorsClosed = Boolean(snapshot.watertightDoorsClosed);
    this.state.pumpsActive = snapshot.pumpsActive !== false;
    this.state.emergencyPower = Boolean(snapshot.emergencyPower);
    this.state.mainPower = snapshot.mainPower !== false;
    this.state.busVoltage = safeNumber(snapshot.busVoltage, this.state.busVoltage, 0, 100);
    this.state.lastMessageKey = typeof snapshot.lastMessageKey === 'string' ? snapshot.lastMessageKey : 'damage.ready';
    this.state.elapsedMs = safeNumber(snapshot.elapsedMs, 0, 0);
    this.state.attritionAccumulator = safeNumber(snapshot.attritionAccumulator, 0, 0, 100);
    this.state.metrics = { ...this.state.metrics, ...(snapshot.metrics || {}) };
    this.recalculate();
    return true;
  }

  snapshot() {
    return {
      damageControlVersion: 1,
      profile: { ...this.profile },
      hullIntegrity: this.state.hullIntegrity,
      compartments: this.state.compartments.map(cloneCompartment),
      teams: this.state.teams.map((item) => ({ ...item })),
      systems: { ...this.state.systems },
      watertightDoorsClosed: this.state.watertightDoorsClosed,
      pumpsActive: this.state.pumpsActive,
      emergencyPower: this.state.emergencyPower,
      mainPower: this.state.mainPower,
      busVoltage: this.state.busVoltage,
      morale: this.state.morale,
      casualtyTotals: { ...this.state.casualtyTotals },
      totalFlooding: this.state.totalFlooding,
      totalFire: this.state.totalFire,
      criticalCompartments: this.state.criticalCompartments,
      criticalFailure: this.state.criticalFailure,
      lastMessageKey: this.state.lastMessageKey,
      elapsedMs: this.state.elapsedMs,
      attritionAccumulator: this.state.attritionAccumulator,
      metrics: { ...this.state.metrics },
    };
  }
}
