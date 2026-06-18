import { clamp } from '../simulation/simulationMath.js';

const PHASES = Object.freeze(['patrol', 'approach', 'shadow', 'attack', 'evade', 'disengage', 'complete', 'failed']);
const DOCTRINES = Object.freeze(['shadow', 'attack', 'evade', 'disengage']);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function contactQuality(contact = {}) {
  if (!contact.detected) return 0;
  const confidence = clamp(finite(contact.confidence), 0, 100);
  const stalePenalty = contact.stale ? 22 : 0;
  const rangePenalty = contact.rangeKnown ? 0 : 12;
  return clamp(confidence - stalePenalty - rangePenalty, 0, 100);
}

export class TacticalEncounterSystem {
  constructor({ mission = {}, initialSnapshot = null } = {}) {
    this.mission = mission || {};
    this.events = [];
    this.state = {
      encounterVersion: 1,
      phase: 'patrol',
      phaseAgeMs: 0,
      doctrine: 'shadow',
      recommendedKey: 'encounter.recommendObserve',
      contactQuality: 0,
      attackReadiness: 0,
      enemySolution: 0,
      escapeProgress: 0,
      safeTimerMs: 0,
      requiredSafeMs: 22000,
      periscopeExposureMs: 0,
      postAttackAgeMs: 0,
      contactLost: false,
      completionAuthorized: false,
      lastShots: 0,
      transitionCount: 0,
      metrics: {
        longestExposureMs: 0,
        attackWindowsReached: 0,
        contactsLost: 0,
        safeDisengagements: 0,
      },
    };
    if (initialSnapshot) this.restore(initialSnapshot);
  }

  setDoctrine(doctrine) {
    if (!DOCTRINES.includes(doctrine)) return { ok: false, reason: 'invalidDoctrine', key: 'encounter.invalidDoctrine' };
    if (this.state.phase === 'complete' || this.state.phase === 'failed') return { ok: false, reason: 'encounterEnded', key: 'encounter.ended' };
    this.state.doctrine = doctrine;
    this.events.push({ type: 'doctrine', doctrine, key: `encounter.doctrine.${doctrine}` });
    return { ok: true, doctrine, key: `encounter.doctrine.${doctrine}` };
  }

  setPhase(next) {
    if (!PHASES.includes(next) || next === this.state.phase) return false;
    const previous = this.state.phase;
    this.state.phase = next;
    this.state.phaseAgeMs = 0;
    this.state.transitionCount += 1;
    if (next === 'attack') this.state.metrics.attackWindowsReached += 1;
    if (next === 'complete') this.state.metrics.safeDisengagements += 1;
    this.events.push({ type: 'phase', previous, current: next, key: `encounter.phase.${next}` });
    return true;
  }

  calculateAttackReadiness(context = {}) {
    const target = context.sensors?.contacts?.target || {};
    const quality = contactQuality(target);
    const solution = clamp(finite(context.weapons?.tdc?.solutionQuality), 0, 100);
    const rangeMeters = target.rangeKnown ? finite(target.rangeMeters, 9999) : 9999;
    const rangeScore = rangeMeters <= 700 ? 100 : rangeMeters <= 1400 ? 82 : rangeMeters <= 2600 ? 55 : rangeMeters <= 4200 ? 28 : 8;
    const depthScore = finite(context.depth) <= 18 ? 100 : finite(context.depth) <= 30 ? 45 : 0;
    const exposurePenalty = clamp(this.state.periscopeExposureMs / 900, 0, 30);
    const threatPenalty = context.navalAI?.globalState === 'hunt' ? 22 : context.navalAI?.globalState === 'search' ? 12 : 0;
    return clamp(quality * 0.3 + solution * 0.4 + rangeScore * 0.2 + depthScore * 0.1 - exposurePenalty - threatPenalty, 0, 100);
  }

  calculateEnemySolution(context = {}) {
    const ai = context.navalAI || {};
    const confidence = clamp(finite(ai.contactConfidence ?? ai.state?.contactConfidence), 0, 100);
    const attackSolution = clamp(finite(ai.attackSolution ?? ai.state?.attackSolution), 0, 100);
    const detection = clamp(finite(context.detectionScore), 0, 100);
    const patternBoost = (ai.depthChargePatterns || []).length ? 18 : 0;
    return clamp(confidence * 0.42 + attackSolution * 0.38 + detection * 0.2 + patternBoost, 0, 100);
  }

  safeConditions(context = {}) {
    const ai = context.navalAI || {};
    const quietAI = ['formation', 'regroup'].includes(ai.globalState);
    const noWeaponsInbound = !(ai.depthChargePatterns || []).length && !context.torpedoActive;
    const nearest = finite(ai.nearestEscortRange, 9999);
    const deepOrDistant = finite(context.depth) >= 42 || nearest >= 185;
    const lowDetection = finite(context.detectionScore) < 12;
    const quietBoat = finite(context.physics?.noise) < 46 || context.silentRunning;
    return quietAI && noWeaponsInbound && deepOrDistant && lowDetection && quietBoat && !context.periscopeOpen;
  }

  update(deltaMs = 80, context = {}) {
    const compression = clamp(finite(context.timeCompression, 1), 1, 16);
    const simulated = clamp(finite(deltaMs, 80), 1, 5000) * compression;
    this.state.phaseAgeMs += simulated;

    if (context.periscopeOpen) {
      this.state.periscopeExposureMs += simulated;
      this.state.metrics.longestExposureMs = Math.max(this.state.metrics.longestExposureMs, this.state.periscopeExposureMs);
    } else {
      this.state.periscopeExposureMs = Math.max(0, this.state.periscopeExposureMs - simulated * 1.8);
    }

    const shots = Math.max(0, Math.floor(finite(context.metrics?.shots)));
    if (shots > this.state.lastShots) {
      this.state.postAttackAgeMs = 0;
      this.state.lastShots = shots;
      this.state.doctrine = 'evade';
      this.events.push({ type: 'weaponRelease', shots, key: 'encounter.weaponReleased' });
    } else if (shots > 0 || context.targetDestroyed) {
      this.state.postAttackAgeMs += simulated;
    }

    const previousContactLost = this.state.contactLost;
    const target = context.sensors?.contacts?.target || {};
    this.state.contactQuality = contactQuality(target);
    this.state.attackReadiness = this.calculateAttackReadiness(context);
    this.state.enemySolution = this.calculateEnemySolution(context);
    this.state.contactLost = finite(context.detectionScore) < 12
      && ['formation', 'regroup', 'search'].includes(context.navalAI?.globalState)
      && finite(context.navalAI?.contactConfidence ?? context.navalAI?.state?.contactConfidence) < 24;
    if (this.state.contactLost && !previousContactLost) {
      this.state.metrics.contactsLost += 1;
      this.events.push({ type: 'contactLost', key: 'encounter.contactLost' });
    }

    if (context.missionFailed) {
      this.state.completionAuthorized = false;
      this.setPhase('failed');
      this.state.recommendedKey = 'encounter.recommendDamageControl';
      return this.snapshot();
    }

    const afterAttack = context.targetDestroyed || shots > 0 || this.state.doctrine === 'evade' || this.state.doctrine === 'disengage';
    if (afterAttack) {
      const safe = this.safeConditions(context);
      this.state.safeTimerMs = safe ? this.state.safeTimerMs + simulated : Math.max(0, this.state.safeTimerMs - simulated * 0.7);
      this.state.escapeProgress = clamp((this.state.safeTimerMs / this.state.requiredSafeMs) * 100, 0, 100);
      if (context.targetDestroyed && this.state.escapeProgress >= 100) {
        this.state.completionAuthorized = true;
        this.setPhase('complete');
        this.state.recommendedKey = 'encounter.recommendComplete';
      } else if (safe || this.state.contactLost) {
        this.setPhase('disengage');
        this.state.recommendedKey = 'encounter.recommendMaintainDisengagement';
      } else {
        this.setPhase('evade');
        this.state.recommendedKey = context.periscopeOpen
          ? 'encounter.recommendLowerScope'
          : finite(context.depth) < 42
            ? 'encounter.recommendGoDeep'
            : 'encounter.recommendSilentEvasion';
      }
      return this.snapshot();
    }

    this.state.safeTimerMs = 0;
    this.state.escapeProgress = 0;
    this.state.completionAuthorized = false;
    const targetRange = target.rangeKnown ? finite(target.rangeMeters, 9999) : 9999;
    if (this.state.doctrine === 'attack' && this.state.attackReadiness >= 58) {
      this.setPhase('attack');
      this.state.recommendedKey = this.state.attackReadiness >= 72 ? 'encounter.recommendFire' : 'encounter.recommendRefineSolution';
    } else if (this.state.contactQuality >= 34 && targetRange <= 4200) {
      if (this.state.attackReadiness >= 68) {
        this.setPhase('attack');
        this.state.recommendedKey = 'encounter.recommendAttackWindow';
      } else {
        this.setPhase('shadow');
        this.state.recommendedKey = context.periscopeOpen && this.state.periscopeExposureMs > 18000
          ? 'encounter.recommendLowerScope'
          : 'encounter.recommendTrackContact';
      }
    } else if (this.state.contactQuality > 0 || targetRange < 7000) {
      this.setPhase('approach');
      this.state.recommendedKey = 'encounter.recommendApproachQuietly';
    } else {
      this.setPhase('patrol');
      this.state.recommendedKey = 'encounter.recommendObserve';
    }
    return this.snapshot();
  }

  restore(snapshot = {}) {
    if (!snapshot || ![1].includes(Number(snapshot.encounterVersion))) return false;
    if (PHASES.includes(snapshot.phase)) this.state.phase = snapshot.phase;
    if (DOCTRINES.includes(snapshot.doctrine)) this.state.doctrine = snapshot.doctrine;
    for (const key of ['phaseAgeMs', 'contactQuality', 'attackReadiness', 'enemySolution', 'escapeProgress', 'safeTimerMs', 'requiredSafeMs', 'periscopeExposureMs', 'postAttackAgeMs', 'lastShots', 'transitionCount']) {
      const value = Number(snapshot[key]);
      if (Number.isFinite(value)) this.state[key] = Math.max(0, value);
    }
    this.state.recommendedKey = typeof snapshot.recommendedKey === 'string' ? snapshot.recommendedKey : this.state.recommendedKey;
    this.state.contactLost = Boolean(snapshot.contactLost);
    this.state.completionAuthorized = Boolean(snapshot.completionAuthorized);
    this.state.metrics = { ...this.state.metrics, ...(snapshot.metrics || {}) };
    return true;
  }

  drainEvents() {
    return this.events.splice(0);
  }

  snapshot() {
    return {
      encounterVersion: 1,
      phase: this.state.phase,
      phaseAgeMs: this.state.phaseAgeMs,
      doctrine: this.state.doctrine,
      recommendedKey: this.state.recommendedKey,
      contactQuality: this.state.contactQuality,
      attackReadiness: this.state.attackReadiness,
      enemySolution: this.state.enemySolution,
      escapeProgress: this.state.escapeProgress,
      safeTimerMs: this.state.safeTimerMs,
      requiredSafeMs: this.state.requiredSafeMs,
      periscopeExposureMs: this.state.periscopeExposureMs,
      postAttackAgeMs: this.state.postAttackAgeMs,
      contactLost: this.state.contactLost,
      completionAuthorized: this.state.completionAuthorized,
      lastShots: this.state.lastShots,
      transitionCount: this.state.transitionCount,
      metrics: { ...this.state.metrics },
    };
  }
}
