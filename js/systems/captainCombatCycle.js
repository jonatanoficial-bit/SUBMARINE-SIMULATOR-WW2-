import { analyzeCaptainCommandThreat } from './captainCommandChain.js';

export const PHASE50_CAPTAIN_COMBAT_CYCLE = Object.freeze({
  phase: 50,
  system: 'captain-combat-cycle',
  version: 'v2.0.0-alpha.65',
  doctrine: 'contact-classification-fire-control-captain-order-execution-consequence',
  manualOverride: true,
  saveSchemaStable: true,
});

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, n(value)));
}

function pct(value) {
  return Math.round(clamp(value, 0, 100));
}

function stage(id, labelKey, state = 'waiting', detailKey = '') {
  return { id, labelKey, state, detailKey };
}

function snapshotDepth(snapshot = {}) {
  return n(snapshot.depth ?? snapshot.physics?.depth, 0);
}

function currentCommand(execution = {}, flow = {}) {
  if (execution?.command && execution.command !== 'standby') return execution.command;
  if (flow?.stage === 'attackPrepared') return 'prepare-attack';
  if (flow?.stage === 'torpedoRunning') return 'fire-confirm';
  if (flow?.stage === 'repairAuthorized') return 'authorize-repair';
  if (flow?.stage === 'evasionOrdered') return flow.order || 'evade-now';
  if (flow?.stage === 'silentOrdered') return flow.order || 'silent-running';
  if (flow?.stage === 'patrolPlanned') return 'plan-patrol';
  if (flow?.stage === 'shadowOrdered') return flow.order || 'hold-shadow';
  return 'standby';
}

function damageStatus(snapshot = {}) {
  const damage = snapshot.damage || snapshot.damageControl || {};
  const hull = clamp(snapshot.hull ?? snapshot.damageControl?.hullIntegrity ?? 100, 0, 100);
  const systems = snapshot.systems || {};
  const criticalSystems = Object.entries(systems).filter(([, value]) => n(value, 100) <= 12).map(([name]) => name);
  return {
    hull,
    critical: hull <= 35 || n(damage.criticalCount, 0) > 0 || criticalSystems.length > 0,
    active: n(damage.activeTeams ?? damage.teamsActive, 0) > 0 || n(snapshot.repairTicks, 0) > 0,
  };
}

function weaponStatus(snapshot = {}) {
  const weapons = snapshot.weapons || {};
  const quality = clamp(weapons.tdc?.solutionQuality ?? weapons.solutionQuality ?? 0, 0, 100);
  const minimum = n(weapons.minimumSolutionQuality, 42);
  const maxLaunchDepth = n(weapons.profile?.maxLaunchDepth, 60);
  const depth = snapshotDepth(snapshot);
  return {
    quality,
    minimum,
    canFire: Boolean(weapons.canFire),
    torpedoes: n(weapons.torpedoes ?? weapons.torpedoCount ?? snapshot.torpedoes, 0),
    depthAllowed: depth <= maxLaunchDepth,
    maxLaunchDepth,
    depth,
  };
}

function contactState(threat = {}) {
  if (threat.hasTarget && threat.targetConfidence >= 72) return 'firm';
  if (threat.hasTarget) return 'probable';
  if ((threat.contacts || []).length > 0) return 'uncertain';
  return 'none';
}

function stageStates({ snapshot = {}, flow = {}, execution = {}, threat = {}, weapon = {}, damage = {}, command = 'standby' } = {}) {
  const contact = contactState(threat);
  const attackFlow = flow?.stage === 'attackPrepared' || ['prepare-attack', 'open-periscope', 'order-periscope-depth', 'fire-confirm'].includes(command);
  const postShot = snapshot.torpedoActive || flow?.stage === 'torpedoRunning' || command === 'fire-confirm';
  const repairPriority = damage.critical || command === 'authorize-repair';
  const evading = ['evade-now', 'emergency-dive'].includes(command) || flow?.stage === 'evasionOrdered';
  const targetClassified = threat.hasTarget && threat.targetConfidence >= 45;
  const solutionReady = weapon.quality >= weapon.minimum;
  const visualReady = Boolean(snapshot.periscopeOpen) && weapon.depthAllowed;
  const orderGiven = command !== 'standby';
  const executionDone = execution?.status === 'executed' || postShot || snapshot.targetDestroyed || snapshot.canComplete;
  const consequenceActive = postShot || snapshot.targetDestroyed || snapshot.canComplete || evading || repairPriority;

  const rows = [
    stage('contact', 'combatCycle.stage.contact', contact === 'none' ? 'active' : 'done', `combatCycle.detail.contact.${contact}`),
    stage('classification', 'combatCycle.stage.classification', targetClassified ? 'done' : contact === 'none' ? 'waiting' : 'active', targetClassified ? 'combatCycle.detail.classification.firm' : 'combatCycle.detail.classification.pending'),
    stage('solution', 'combatCycle.stage.solution', solutionReady ? 'done' : attackFlow ? 'active' : 'waiting', solutionReady ? 'combatCycle.detail.solution.ready' : 'combatCycle.detail.solution.pending'),
    stage('captainOrder', 'combatCycle.stage.captainOrder', orderGiven ? 'done' : targetClassified ? 'active' : 'waiting', orderGiven ? 'combatCycle.detail.order.given' : 'combatCycle.detail.order.await'),
    stage('execution', 'combatCycle.stage.execution', executionDone ? 'done' : orderGiven ? 'active' : 'waiting', orderGiven ? 'combatCycle.detail.execution.running' : 'combatCycle.detail.execution.waiting'),
    stage('consequence', 'combatCycle.stage.consequence', snapshot.targetDestroyed || snapshot.canComplete ? 'done' : consequenceActive ? 'active' : 'waiting', snapshot.targetDestroyed || snapshot.canComplete ? 'combatCycle.detail.consequence.done' : postShot ? 'combatCycle.detail.consequence.torpedo' : evading ? 'combatCycle.detail.consequence.evading' : repairPriority ? 'combatCycle.detail.consequence.repair' : 'combatCycle.detail.consequence.waiting'),
  ];

  if (repairPriority) {
    rows[2].state = rows[2].state === 'done' ? 'done' : 'blocked';
    rows[3].state = command === 'authorize-repair' ? 'done' : 'blocked';
  }
  return rows;
}

function makeView({ state = 'patrol', tone = 'calm', questionKey = 'combatCycle.question.patrol', nextCommand = 'plan-patrol', nextStation = 'navigation', readiness = 0, reasonKey = 'combatCycle.reason.none', steps = [], command = 'standby', risk = 0 } = {}) {
  return {
    phase: PHASE50_CAPTAIN_COMBAT_CYCLE.phase,
    system: PHASE50_CAPTAIN_COMBAT_CYCLE.system,
    version: PHASE50_CAPTAIN_COMBAT_CYCLE.version,
    state,
    tone,
    stateKey: `combatCycle.state.${state}`,
    questionKey,
    nextCommand,
    nextStation,
    nextActionKey: nextCommand ? 'combatCycle.action.execute' : 'combatCycle.action.await',
    readiness: pct(readiness),
    risk: pct(risk),
    reasonKey,
    command,
    steps,
  };
}

export function evaluateCaptainCombatCycle({ snapshot = {}, execution = null, flow = null, chain = null, commandMode = 'captain' } = {}) {
  const threat = analyzeCaptainCommandThreat(snapshot);
  const weapon = weaponStatus(snapshot);
  const damage = damageStatus(snapshot);
  const command = currentCommand(execution, flow);
  const steps = stageStates({ snapshot, flow, execution, threat, weapon, damage, command });
  const contact = contactState(threat);
  const targetReadiness = threat.hasTarget ? threat.targetConfidence : 0;
  const attackReadiness = pct(targetReadiness * 0.36 + weapon.quality * 0.42 + (snapshot.periscopeOpen ? 12 : 0) + (weapon.depthAllowed ? 10 : 0));
  const survivalRisk = pct(Math.max(threat.escortConfidence, threat.airConfidence) * 0.72 + (100 - damage.hull) * 0.48 + (snapshot.torpedoActive ? 10 : 0));

  if (commandMode === 'manual') {
    return makeView({ state: 'manual', tone: 'manual', questionKey: 'combatCycle.question.manual', nextCommand: '', nextStation: 'command', readiness: 100, risk: survivalRisk, reasonKey: 'combatCycle.reason.manual', steps, command });
  }
  if (snapshot.missionFailed) {
    return makeView({ state: 'lost', tone: 'critical', questionKey: 'combatCycle.question.lost', nextCommand: '', nextStation: 'command', readiness: 0, risk: 100, reasonKey: 'combatCycle.reason.lost', steps, command });
  }
  if (snapshot.targetDestroyed || snapshot.canComplete) {
    return makeView({ state: 'complete', tone: 'calm', questionKey: 'combatCycle.question.complete', nextCommand: '', nextStation: 'command', readiness: 100, risk: survivalRisk, reasonKey: 'combatCycle.reason.complete', steps, command });
  }
  if (damage.critical && command !== 'authorize-repair') {
    return makeView({ state: 'damagePriority', tone: 'critical', questionKey: 'combatCycle.question.damage', nextCommand: 'authorize-repair', nextStation: 'damage', readiness: Math.max(72, 100 - damage.hull), risk: survivalRisk, reasonKey: 'combatCycle.reason.damage', steps, command });
  }
  if (threat.hasAirThreat) {
    return makeView({ state: 'airThreat', tone: 'danger', questionKey: 'combatCycle.question.air', nextCommand: 'emergency-dive', nextStation: 'instruments', readiness: threat.airConfidence, risk: survivalRisk, reasonKey: 'combatCycle.reason.air', steps, command });
  }
  if (snapshot.torpedoActive || flow?.stage === 'torpedoRunning') {
    return makeView({ state: 'postShot', tone: threat.hasEscortThreat ? 'danger' : 'attack', questionKey: threat.hasEscortThreat ? 'combatCycle.question.postShotEvade' : 'combatCycle.question.postShotHold', nextCommand: threat.hasEscortThreat ? 'evade-now' : 'hold-shadow', nextStation: threat.hasEscortThreat ? 'instruments' : 'sensors', readiness: Math.max(70, threat.targetConfidence), risk: survivalRisk, reasonKey: 'combatCycle.reason.postShot', steps, command });
  }
  if ((flow?.stage === 'attackPrepared' || command === 'prepare-attack') && !weapon.depthAllowed) {
    return makeView({ state: 'depthConflict', tone: 'warning', questionKey: 'combatCycle.question.depth', nextCommand: 'order-periscope-depth', nextStation: 'instruments', readiness: Math.max(35, weapon.quality), risk: survivalRisk, reasonKey: 'combatCycle.reason.depth', steps, command });
  }
  if ((flow?.stage === 'attackPrepared' || command === 'prepare-attack') && weapon.quality < weapon.minimum) {
    return makeView({ state: 'solutionBuilding', tone: 'watch', questionKey: 'combatCycle.question.solution', nextCommand: 'prepare-attack', nextStation: 'weapons', readiness: attackReadiness, risk: survivalRisk, reasonKey: 'combatCycle.reason.solution', steps, command });
  }
  if ((flow?.stage === 'attackPrepared' || command === 'prepare-attack') && !snapshot.periscopeOpen) {
    return makeView({ state: 'visualConfirm', tone: 'attack', questionKey: 'combatCycle.question.visual', nextCommand: 'open-periscope', nextStation: 'periscope', readiness: attackReadiness, risk: survivalRisk, reasonKey: 'combatCycle.reason.visual', steps, command });
  }
  if ((flow?.stage === 'attackPrepared' || command === 'prepare-attack') && weapon.canFire && snapshot.periscopeOpen) {
    return makeView({ state: 'captainFireDecision', tone: 'attack', questionKey: threat.hasEscortThreat ? 'combatCycle.question.fireWithEscort' : 'combatCycle.question.fire', nextCommand: 'fire-confirm', nextStation: 'periscope', readiness: attackReadiness, risk: survivalRisk, reasonKey: 'combatCycle.reason.fire', steps, command });
  }
  if (threat.hasEscortThreat && threat.escortConfidence >= 72) {
    return makeView({ state: 'escortClosing', tone: 'danger', questionKey: 'combatCycle.question.escort', nextCommand: 'evade-now', nextStation: 'instruments', readiness: threat.escortConfidence, risk: survivalRisk, reasonKey: 'combatCycle.reason.escort', steps, command });
  }
  if (threat.hasTarget && contact !== 'none') {
    return makeView({ state: contact === 'firm' ? 'targetClassified' : 'contactClassifying', tone: contact === 'firm' ? 'attack' : 'watch', questionKey: contact === 'firm' ? 'combatCycle.question.attackOrShadow' : 'combatCycle.question.classify', nextCommand: contact === 'firm' ? 'prepare-attack' : 'hold-shadow', nextStation: contact === 'firm' ? 'weapons' : 'sensors', readiness: contact === 'firm' ? Math.max(55, attackReadiness) : threat.targetConfidence, risk: survivalRisk, reasonKey: 'combatCycle.reason.contact', steps, command });
  }
  if (chain?.nextCommand) {
    return makeView({ state: 'chainRecommendation', tone: chain.tone || 'watch', questionKey: 'combatCycle.question.chain', nextCommand: chain.nextCommand, nextStation: chain.actionStation || chain.station || 'command', readiness: chain.confidence || 45, risk: survivalRisk, reasonKey: 'combatCycle.reason.chain', steps, command });
  }
  return makeView({ state: 'patrol', tone: 'calm', questionKey: 'combatCycle.question.patrol', nextCommand: 'plan-patrol', nextStation: 'navigation', readiness: 42, risk: survivalRisk, reasonKey: 'combatCycle.reason.none', steps, command });
}

export function buildCaptainCombatCycleView(args = {}) {
  return evaluateCaptainCombatCycle(args);
}
