const PHYSICS_SPEED_KNOTS = Object.freeze({ stop: 0, slow: 3, half: 6, full: 10, flank: 14 });
const PHYSICS_SPEED_LOAD = Object.freeze({ stop: 0.08, slow: 0.28, half: 0.52, full: 0.82, flank: 1 });
const PHYSICS_SPEED_NOISE = Object.freeze({ stop: 5, slow: 16, half: 31, full: 52, flank: 76 });
const PHYSICS_BALLAST_MODES = Object.freeze(['auto', 'blow', 'neutral', 'flood']);
const PHYSICS_SURFACE_DEPTH = 6;

function clamp(value, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : 0));
}

function approach(current, target, maximumDelta) {
  const delta = target - current;
  if (Math.abs(delta) <= maximumDelta) return target;
  return current + Math.sign(delta) * maximumDelta;
}

function deriveConfiguration(submarine = {}) {
  const stats = submarine?.stats || {};
  const depthRating = clamp(stats.depth || 60, 1, 100);
  const rangeRating = clamp(stats.range || 65, 1, 100);
  const speedRating = clamp(stats.speed || 60, 1, 100);
  const stealthRating = clamp(stats.stealth || 60, 1, 100);
  const maxOperationalDepth = Math.round(120 + depthRating * 1.15);
  const crushDepth = Math.round(maxOperationalDepth + 48 + depthRating * 0.42);
  return {
    maxOperationalDepth,
    crushDepth,
    surfaceDepth: PHYSICS_SURFACE_DEPTH,
    fuelEfficiency: clamp(0.78 + rangeRating / 250, 0.8, 1.18),
    batteryEfficiency: clamp(0.82 + rangeRating / 300, 0.84, 1.15),
    propulsionFactor: clamp(0.82 + speedRating / 250, 0.84, 1.2),
    acousticFactor: clamp(1.18 - stealthRating / 300, 0.84, 1.16),
  };
}

function depthZoneFor(depth, config) {
  if (depth <= config.surfaceDepth) return 'surface';
  if (depth <= 18) return 'periscope';
  if (depth <= config.maxOperationalDepth * 0.55) return 'patrol';
  if (depth <= config.maxOperationalDepth) return 'deep';
  if (depth <= config.crushDepth) return 'overdepth';
  return 'collapse';
}

function buoyancyStateFor(verticalSpeed) {
  if (verticalSpeed > 0.12) return 'negative';
  if (verticalSpeed < -0.12) return 'positive';
  return 'neutral';
}

function depthEnvelope(depth, config) {
  return {
    surfaceDepth: config.surfaceDepth,
    periscopeDepth: 14,
    tacticalDepth: Math.round(config.maxOperationalDepth * 0.55),
    maxOperationalDepth: config.maxOperationalDepth,
    crushDepth: config.crushDepth,
    depthZone: depthZoneFor(depth, config)
  };
}

export class SubmarinePhysicsSystem {
  constructor({ submarine = null, initialDepth = 12, initialSnapshot = null } = {}) {
    this.config = deriveConfiguration(submarine || {});
    const depth = clamp(initialDepth, 0, this.config.crushDepth);
    this.state = {
      depth,
      orderedDepth: depth,
      verticalSpeed: 0,
      ballast: depth > PHYSICS_SURFACE_DEPTH ? 50 : 24,
      ballastCommand: 'auto',
      trim: 0,
      depthHold: true,
      pressurePercent: 0,
      hullStress: 0,
      fuel: 100,
      battery: 100,
      oxygen: 100,
      co2: 0,
      noise: 0,
      cavitation: 0,
      actualSpeedKnots: 0,
      targetSpeedKnots: 0,
      propulsionEfficiency: 1,
      propulsionMode: depth <= PHYSICS_SURFACE_DEPTH ? 'diesel' : 'electric',
      surfaced: depth <= PHYSICS_SURFACE_DEPTH,
      snorkelAvailable: depth <= 16,
      simulatedElapsedMs: 0,
      emergencyBlowCooldownMs: 0,
      criticalFlags: [],
      status: 'normal',
      reserveBuoyancy: 50,
      buoyancyState: 'neutral',
      depthZone: depthZoneFor(depth, this.config),
      pressureEnvelope: depthEnvelope(depth, this.config),
      ascentRate: 0,
      descentRate: 0,
    };
    this.pendingDamage = [];
    this.pressureDamageAccumulator = 0;
    this.atmosphereDamageAccumulator = 0;
    if (initialSnapshot) this.restore(initialSnapshot);
    this.recalculateDerived('stop', { engines: 100 }, false);
  }

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    const source = snapshot.physics || snapshot;
    const safe = (key, fallback, min, max) => clamp(source[key] ?? fallback, min, max);
    this.state.depth = safe('depth', this.state.depth, 0, this.config.crushDepth);
    this.state.orderedDepth = safe('orderedDepth', this.state.depth, 0, this.config.crushDepth);
    this.state.verticalSpeed = safe('verticalSpeed', 0, -4, 4);
    this.state.ballast = safe('ballast', this.state.ballast, 0, 100);
    this.state.ballastCommand = PHYSICS_BALLAST_MODES.includes(source.ballastCommand) ? source.ballastCommand : 'auto';
    this.state.trim = safe('trim', 0, -15, 15);
    this.state.depthHold = source.depthHold !== false;
    this.state.fuel = safe('fuel', 100, 0, 100);
    this.state.battery = safe('battery', 100, 0, 100);
    this.state.oxygen = safe('oxygen', 100, 0, 100);
    this.state.co2 = safe('co2', 0, 0, 100);
    this.state.actualSpeedKnots = safe('actualSpeedKnots', this.state.actualSpeedKnots, 0, 30);
    this.state.targetSpeedKnots = safe('targetSpeedKnots', this.state.actualSpeedKnots, 0, 30);
    this.state.hullStress = safe('hullStress', 0, 0, 100);
    this.state.simulatedElapsedMs = Math.max(0, Number(source.simulatedElapsedMs) || 0);
    this.state.emergencyBlowCooldownMs = Math.max(0, Number(source.emergencyBlowCooldownMs) || 0);
    this.state.reserveBuoyancy = safe('reserveBuoyancy', this.state.reserveBuoyancy ?? 50, 0, 100);
    this.state.depthZone = typeof source.depthZone === 'string' ? source.depthZone : depthZoneFor(this.state.depth, this.config);
    this.state.buoyancyState = typeof source.buoyancyState === 'string' ? source.buoyancyState : buoyancyStateFor(this.state.verticalSpeed);
    this.recalculateDerived(source.telegraphSpeed || 'stop', { engines: 100 }, Boolean(source.silentRunning));
    return true;
  }

  setOrderedDepth(value) {
    this.state.orderedDepth = clamp(value, 0, this.config.crushDepth);
    this.state.depthHold = true;
    this.state.ballastCommand = 'auto';
    return this.snapshot();
  }

  adjustOrderedDepth(delta) {
    return this.setOrderedDepth(this.state.orderedDepth + Number(delta || 0));
  }

  setBallastCommand(mode) {
    if (!PHYSICS_BALLAST_MODES.includes(mode)) return { ok: false, reason: 'invalidBallast' };
    this.state.ballastCommand = mode;
    this.state.depthHold = mode === 'auto';
    if (mode === 'blow') this.state.orderedDepth = 0;
    if (mode === 'flood') this.state.orderedDepth = Math.min(this.config.maxOperationalDepth, Math.max(this.state.orderedDepth, this.state.depth + 35));
    return { ok: true, mode, snapshot: this.snapshot() };
  }

  setTrim(value) {
    this.state.trim = clamp(value, -15, 15);
    if (Math.abs(this.state.trim) > 0.1) this.state.depthHold = false;
    return { ok: true, snapshot: this.snapshot() };
  }

  nudgeTrim(delta) {
    return this.setTrim(this.state.trim + Number(delta || 0));
  }

  levelTrim() {
    this.state.trim = 0;
    this.state.depthHold = true;
    this.state.ballastCommand = 'auto';
    this.state.orderedDepth = this.state.depth;
    return { ok: true, snapshot: this.snapshot() };
  }

  emergencyDive() {
    this.state.orderedDepth = clamp(Math.max(this.state.depth + 85, 95), 0, this.config.maxOperationalDepth);
    this.state.ballastCommand = 'flood';
    this.state.depthHold = false;
    this.state.trim = clamp(this.state.trim + 8, -15, 15);
    return this.snapshot();
  }

  emergencyBlow() {
    if (this.state.emergencyBlowCooldownMs > 0) return { ok: false, reason: 'cooldown' };
    this.state.orderedDepth = 0;
    this.state.ballastCommand = 'blow';
    this.state.depthHold = false;
    this.state.trim = clamp(this.state.trim - 10, -15, 15);
    this.state.emergencyBlowCooldownMs = 180000;
    return { ok: true, snapshot: this.snapshot() };
  }

  recalculateDerived(telegraphSpeed = 'stop', systems = {}, silentRunning = false, dtSeconds = 0) {
    const engines = clamp(systems.engines ?? 100, 0, 100) / 100;
    const submerged = this.state.depth > PHYSICS_SURFACE_DEPTH;
    this.state.surfaced = !submerged;
    this.state.snorkelAvailable = this.state.depth <= 16;
    this.state.propulsionMode = submerged ? 'electric' : 'diesel';
    const energy = submerged ? this.state.battery : this.state.fuel;
    const energyFactor = energy <= 0.5 ? 0 : energy < 8 ? 0.3 + energy / 16 : 1;
    const damageFactor = clamp(0.25 + engines * 0.75, 0.25, 1);
    const submergedPenalty = submerged ? 0.88 : 1;
    this.state.propulsionEfficiency = clamp(energyFactor * damageFactor * submergedPenalty, 0, 1);
    const commanded = PHYSICS_SPEED_KNOTS[telegraphSpeed] ?? 0;
    const targetSpeed = commanded * this.config.propulsionFactor * this.state.propulsionEfficiency;
    this.state.targetSpeedKnots = targetSpeed;
    const currentSpeed = clamp(this.state.actualSpeedKnots, 0, 30);
    const responseSeconds = Math.max(0, Number(dtSeconds) || 0);
    if (responseSeconds > 0) {
      const accelerating = targetSpeed > currentSpeed;
      const baseRate = accelerating ? 0.72 : 1.08;
      const propulsionResponse = clamp(0.55 + this.state.propulsionEfficiency * 0.45, 0.35, 1);
      this.state.actualSpeedKnots = approach(currentSpeed, targetSpeed, baseRate * propulsionResponse * responseSeconds);
    } else {
      this.state.actualSpeedKnots = Math.min(currentSpeed, Math.max(targetSpeed, 0));
    }

    const shallowCavitation = submerged && this.state.depth < 42 ? clamp((42 - this.state.depth) / 42, 0, 1) : 0;
    const speedCavitation = clamp((this.state.actualSpeedKnots - 7) / 7, 0, 1);
    this.state.cavitation = clamp(shallowCavitation * speedCavitation * 130, 0, 100);
    const pumpNoise = Math.abs(this.state.ballast - 50) > 18 ? 8 : 0;
    const verticalNoise = Math.abs(this.state.verticalSpeed) * 5;
    const damageNoise = (1 - damageFactor) * 28;
    const silentFactor = silentRunning ? 0.48 : 1;
    this.state.noise = clamp((PHYSICS_SPEED_NOISE[telegraphSpeed] + this.state.cavitation * 0.52 + pumpNoise + verticalNoise + damageNoise) * this.config.acousticFactor * silentFactor, 0, 100);

    this.state.pressurePercent = clamp((this.state.depth / this.config.maxOperationalDepth) * 100, 0, 180);
    this.state.depthZone = depthZoneFor(this.state.depth, this.config);
    this.state.buoyancyState = buoyancyStateFor(this.state.verticalSpeed);
    this.state.ascentRate = clamp(-this.state.verticalSpeed, 0, 5);
    this.state.descentRate = clamp(this.state.verticalSpeed, 0, 5);
    this.state.pressureEnvelope = depthEnvelope(this.state.depth, this.config);
    const reservePenalty = (this.state.depth / Math.max(1, this.config.maxOperationalDepth)) * 22 + this.state.hullStress * 0.22;
    this.state.reserveBuoyancy = clamp(100 - this.state.ballast + (this.state.surfaced ? 18 : 0) - reservePenalty, 0, 100);
    const flags = [];
    if (this.state.pressurePercent >= 100) flags.push('pressure');
    if (this.state.battery <= 15) flags.push('battery');
    if (this.state.fuel <= 12) flags.push('fuel');
    if (this.state.oxygen <= 20) flags.push('oxygen');
    if (this.state.co2 >= 70) flags.push('co2');
    if (this.state.cavitation >= 40) flags.push('cavitation');
    this.state.criticalFlags = flags;
    this.state.status = flags.some((flag) => ['pressure', 'oxygen', 'co2'].includes(flag)) ? 'critical' : flags.length ? 'warning' : 'normal';
  }

  update(stepMs, { telegraphSpeed = 'stop', systems = {}, silentRunning = false, timeCompression = 1, resourceMultiplier = 1 } = {}) {
    const simulatedMs = Math.max(0, Number(stepMs) || 0) * clamp(timeCompression, 1, 16);
    const dt = Math.min(4, simulatedMs / 1000);
    const hours = (simulatedMs / 3600000) * clamp(resourceMultiplier, 0.5, 1.5);
    this.state.simulatedElapsedMs += simulatedMs;
    this.state.emergencyBlowCooldownMs = Math.max(0, this.state.emergencyBlowCooldownMs - simulatedMs);

    const depthError = this.state.orderedDepth - this.state.depth;
    let ballastTarget = 50;
    if (this.state.ballastCommand === 'blow') ballastTarget = 4;
    else if (this.state.ballastCommand === 'flood') ballastTarget = 96;
    else if (this.state.ballastCommand === 'neutral') ballastTarget = 50;
    else ballastTarget = clamp(50 + depthError * 0.55 - this.state.verticalSpeed * 5, 18, 82);
    this.state.ballast = approach(this.state.ballast, ballastTarget, 11 * dt);

    if (this.state.depthHold && this.state.ballastCommand === 'auto') {
      const trimTarget = clamp(depthError * 0.12 - this.state.verticalSpeed * 1.4, -9, 9);
      this.state.trim = approach(this.state.trim, trimTarget, 3.5 * dt);
    }

    const ballastForce = (this.state.ballast - 50) / 50;
    const trimForce = this.state.trim / 15;
    const depthControl = this.state.depthHold ? clamp(depthError * 0.018, -1.2, 1.2) : 0;
    const desiredVerticalSpeed = clamp(ballastForce * 1.8 + trimForce * 1.05 + depthControl, -3.2, 3.2);
    this.state.verticalSpeed = approach(this.state.verticalSpeed, desiredVerticalSpeed, 0.75 * dt);
    this.state.verticalSpeed *= Math.max(0.78, 1 - dt * 0.035);
    this.state.depth = clamp(this.state.depth + this.state.verticalSpeed * dt, 0, this.config.crushDepth + 10);

    if (this.state.depth <= 0.15) {
      this.state.depth = 0;
      this.state.verticalSpeed = Math.max(0, this.state.verticalSpeed);
      if (this.state.ballastCommand === 'blow') this.state.ballastCommand = 'auto';
      this.state.orderedDepth = Math.max(0, this.state.orderedDepth);
    }
    if (this.state.ballastCommand === 'flood' && this.state.depth >= this.state.orderedDepth - 3) {
      this.state.ballastCommand = 'auto';
      this.state.depthHold = true;
    }
    if (this.state.ballastCommand === 'blow' && this.state.depth <= 3) {
      this.state.ballastCommand = 'auto';
      this.state.depthHold = true;
    }

    const submerged = this.state.depth > PHYSICS_SURFACE_DEPTH;
    const load = PHYSICS_SPEED_LOAD[telegraphSpeed] ?? 0;
    if (submerged) {
      this.state.battery = clamp(this.state.battery - hours * (0.8 + load * 6.5) / this.config.batteryEfficiency, 0, 100);
      this.state.oxygen = clamp(this.state.oxygen - hours * (1.15 + load * 0.7), 0, 100);
      this.state.co2 = clamp(this.state.co2 + hours * (1.4 + load * 0.9), 0, 100);
    } else {
      this.state.fuel = clamp(this.state.fuel - hours * (0.35 + load * 2.25) / this.config.fuelEfficiency, 0, 100);
      this.state.battery = clamp(this.state.battery + hours * (4.2 - load * 1.25) * this.config.batteryEfficiency, 0, 100);
      this.state.oxygen = clamp(this.state.oxygen + hours * 28, 0, 100);
      this.state.co2 = clamp(this.state.co2 - hours * 38, 0, 100);
    }

    this.recalculateDerived(telegraphSpeed, systems, silentRunning, dt);

    if (this.state.depth > this.config.maxOperationalDepth) {
      const overload = (this.state.depth - this.config.maxOperationalDepth) / Math.max(1, this.config.crushDepth - this.config.maxOperationalDepth);
      this.state.hullStress = clamp(this.state.hullStress + hours * (18 + overload * 75), 0, 100);
      this.pressureDamageAccumulator += hours * overload * 9;
      while (this.pressureDamageAccumulator >= 1) {
        const damage = Math.min(8, Math.max(1, Math.floor(this.pressureDamageAccumulator)));
        this.pendingDamage.push({ amount: damage, system: 'engines', reason: 'pressure' });
        this.pressureDamageAccumulator -= damage;
      }
    } else {
      this.state.hullStress = clamp(this.state.hullStress - hours * 5, 0, 100);
    }

    if (this.state.oxygen <= 8 || this.state.co2 >= 92) {
      this.atmosphereDamageAccumulator += hours * 7;
      while (this.atmosphereDamageAccumulator >= 1) {
        this.pendingDamage.push({ amount: 1, system: 'sonar', reason: 'atmosphere' });
        this.atmosphereDamageAccumulator -= 1;
      }
    }
    return this.snapshot();
  }

  drainDamageEvents() {
    const events = this.pendingDamage.splice(0);
    return events;
  }

  snapshot() {
    return {
      ...this.state,
      maxOperationalDepth: this.config.maxOperationalDepth,
      crushDepth: this.config.crushDepth,
      surfaceDepth: this.config.surfaceDepth,
      physicsVersion: 1,
    };
  }
}

export const PHYSICS_CONSTANTS = Object.freeze({ SPEED_KNOTS: PHYSICS_SPEED_KNOTS, SPEED_LOAD: PHYSICS_SPEED_LOAD, SPEED_NOISE: PHYSICS_SPEED_NOISE, BALLAST_MODES: PHYSICS_BALLAST_MODES, SURFACE_DEPTH: PHYSICS_SURFACE_DEPTH });
