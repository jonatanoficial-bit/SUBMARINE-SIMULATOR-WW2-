export const PHASE49_CAPTAIN_COMMAND_CHAIN = Object.freeze({
  phase: 49,
  system: 'reactive-captain-command-chain',
  version: 'v2.0.0-alpha.64',
  doctrine: 'captain-decides-crew-acknowledges-conflicts-and-recommends-next-order',
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

function lower(value = '') {
  return String(value || '').toLowerCase();
}

function contactsFrom(snapshot = {}) {
  const sensors = snapshot.sensors || {};
  const raw = sensors.contacts || {};
  const contacts = Array.isArray(raw) ? raw.slice() : Object.entries(raw).map(([id, contact]) => ({ id, ...(contact || {}) }));
  if (sensors.strongestContact) contacts.push({ id: 'strongest', ...sensors.strongestContact });
  return contacts.filter(Boolean);
}

function contactConfidence(contact = {}) {
  return clamp(contact.confidence ?? contact.detectionConfidence ?? contact.solution ?? contact.strength ?? contact.threat ?? 0, 0, 100);
}

export function analyzeCaptainCommandThreat(snapshot = {}) {
  const contacts = contactsFrom(snapshot);
  const target = contacts.find((contact) => ['target', 'merchant', 'convoy'].some((token) => lower(contact.role || contact.type || contact.id).includes(token))) || contacts[0] || null;
  const escort = contacts.find((contact) => ['escort', 'destroyer', 'warship', 'hunter'].some((token) => lower(contact.role || contact.type || contact.id || contact.name).includes(token))) || null;
  const air = contacts.find((contact) => ['air', 'aircraft', 'plane', 'patrol'].some((token) => lower(contact.role || contact.type || contact.id || contact.name).includes(token))) || null;
  const escortConfidence = escort ? Math.max(contactConfidence(escort), n(snapshot.navalAI?.enemySolution, 0), n(snapshot.enemySolution, 0)) : Math.max(n(snapshot.navalAI?.enemySolution, 0), n(snapshot.enemySolution, 0));
  const targetConfidence = target ? contactConfidence(target) : 0;
  const airConfidence = air ? Math.max(contactConfidence(air), n(snapshot.airAttack?.danger, 0)) : n(snapshot.airAttack?.danger, 0);
  return {
    contacts,
    target,
    escort,
    air,
    hasTarget: Boolean(target) && targetConfidence >= 20,
    hasEscortThreat: Boolean(escort) && escortConfidence >= 45,
    hasAirThreat: Boolean(air) && airConfidence >= 50,
    escortConfidence: clamp(escortConfidence, 0, 100),
    targetConfidence: clamp(targetConfidence, 0, 100),
    airConfidence: clamp(airConfidence, 0, 100),
  };
}

function flowCommand(flow = {}) {
  if (!flow || typeof flow !== 'object') return '';
  if (flow.stage === 'attackPrepared') return 'prepare-attack';
  if (flow.stage === 'torpedoRunning') return 'fire-confirm';
  if (flow.stage === 'repairAuthorized') return 'authorize-repair';
  if (flow.stage === 'evasionOrdered') return flow.order || 'evade-now';
  if (flow.stage === 'silentOrdered') return flow.order || 'silent-running';
  if (flow.stage === 'patrolPlanned') return 'plan-patrol';
  if (flow.stage === 'shadowOrdered') return flow.order || 'hold-shadow';
  return '';
}

function view({ tone = 'calm', station = 'command', response = 'captainChain.response.standby', recommendation = 'captainChain.recommendation.wait', nextCommand = '', actionStation = '', confidence = 0, shouldInterrupt = false, reason = 'captainChain.reason.normal', orderKey = 'captainExecution.order.standby' } = {}) {
  return {
    phase: PHASE49_CAPTAIN_COMMAND_CHAIN.phase,
    system: PHASE49_CAPTAIN_COMMAND_CHAIN.system,
    version: PHASE49_CAPTAIN_COMMAND_CHAIN.version,
    tone,
    station,
    stationKey: `captainExecution.station.${station}`,
    responseKey: response,
    recommendationKey: recommendation,
    nextCommand,
    actionStation: actionStation || station,
    confidence: Math.round(clamp(confidence, 0, 100)),
    shouldInterrupt: Boolean(shouldInterrupt),
    reasonKey: reason,
    orderKey,
  };
}

export function buildCaptainCommandChainView({ snapshot = {}, execution = null, flow = null, commandMode = 'captain' } = {}) {
  const currentCommand = execution?.command || flowCommand(flow) || 'standby';
  const currentOrderKey = execution?.orderKey || (currentCommand === 'standby' ? 'captainExecution.order.standby' : `captainExecution.order.${currentCommand.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())}`);
  const threat = analyzeCaptainCommandThreat(snapshot);
  const weapons = snapshot.weapons || {};
  const damage = snapshot.damage || snapshot.damageControl || {};
  const systems = snapshot.systems || {};
  const hull = clamp(snapshot.hull ?? snapshot.damageControl?.hullIntegrity ?? 100, 0, 100);
  const depth = n(snapshot.depth ?? snapshot.physics?.depth, 0);
  const maxLaunchDepth = n(weapons.profile?.maxLaunchDepth, 60);
  const quality = clamp(weapons.tdc?.solutionQuality ?? weapons.solutionQuality ?? 0, 0, 100);
  const minimumSolution = n(weapons.minimumSolutionQuality, 42);
  const criticalSystems = Object.entries(systems).filter(([, value]) => n(value, 100) <= 12).map(([name]) => name);
  const criticalDamage = hull <= 35 || n(damage.criticalCount, 0) > 0 || criticalSystems.length > 0;
  const attackOrder = ['prepare-attack', 'fire-confirm', 'open-periscope', 'order-periscope-depth'].includes(currentCommand) || flow?.stage === 'attackPrepared';

  if (commandMode === 'manual') {
    return view({
      tone: 'manual', station: 'command', response: 'captainChain.response.manual', recommendation: 'captainChain.recommendation.manual', nextCommand: '', confidence: 100, reason: 'captainChain.reason.manual', orderKey: 'captainExecution.order.manual',
    });
  }
  if (snapshot.missionFailed) {
    return view({ tone: 'critical', station: 'command', response: 'captainChain.response.missionFailed', recommendation: 'captainChain.recommendation.standDown', confidence: 100, reason: 'captainChain.reason.missionFailed', orderKey: currentOrderKey });
  }
  if (snapshot.targetDestroyed || snapshot.canComplete) {
    return view({ tone: 'calm', station: 'command', response: 'captainChain.response.objectiveDone', recommendation: 'captainChain.recommendation.completeMission', confidence: 100, reason: 'captainChain.reason.objectiveDone', orderKey: currentOrderKey });
  }
  if (snapshot.torpedoActive || flow?.stage === 'torpedoRunning') {
    return view({ tone: 'attack', station: 'periscope', response: 'captainChain.response.torpedoRunning', recommendation: threat.hasEscortThreat ? 'captainChain.recommendation.prepareEvasionAfterShot' : 'captainChain.recommendation.holdBearing', nextCommand: threat.hasEscortThreat ? 'evade-now' : 'hold-shadow', actionStation: threat.hasEscortThreat ? 'instruments' : 'sensors', confidence: Math.max(70, threat.escortConfidence), shouldInterrupt: threat.hasEscortThreat, reason: 'captainChain.reason.torpedoInWater', orderKey: 'captainExecution.order.fireConfirm' });
  }
  if (criticalDamage && !['authorize-repair', 'emergency-dive', 'evade-now', 'stop-boat'].includes(currentCommand)) {
    return view({ tone: 'critical', station: 'damage', response: 'captainChain.response.damageCritical', recommendation: 'captainChain.recommendation.authorizeRepair', nextCommand: 'authorize-repair', actionStation: 'damage', confidence: Math.max(75, 100 - hull), shouldInterrupt: true, reason: 'captainChain.reason.damageConflict', orderKey: currentOrderKey });
  }
  if (attackOrder && threat.hasEscortThreat && threat.escortConfidence >= 72 && !snapshot.silentRunning) {
    return view({ tone: 'danger', station: 'sensors', response: 'captainChain.response.escortThreat', recommendation: 'captainChain.recommendation.evadeOrSilent', nextCommand: 'evade-now', actionStation: 'instruments', confidence: threat.escortConfidence, shouldInterrupt: true, reason: 'captainChain.reason.escortConflict', orderKey: currentOrderKey });
  }
  if (attackOrder && depth > maxLaunchDepth) {
    return view({ tone: 'warning', station: 'instruments', response: 'captainChain.response.tooDeep', recommendation: 'captainChain.recommendation.periscopeDepth', nextCommand: 'order-periscope-depth', actionStation: 'instruments', confidence: Math.min(100, Math.round((depth / Math.max(1, maxLaunchDepth)) * 55)), shouldInterrupt: true, reason: 'captainChain.reason.depthConflict', orderKey: currentOrderKey });
  }
  if (attackOrder && quality < minimumSolution) {
    return view({ tone: 'watch', station: 'weapons', response: 'captainChain.response.solutionPoor', recommendation: 'captainChain.recommendation.recalculateTdc', nextCommand: 'prepare-attack', actionStation: 'weapons', confidence: quality, shouldInterrupt: false, reason: 'captainChain.reason.solutionQuality', orderKey: currentOrderKey });
  }
  if (attackOrder && !snapshot.periscopeOpen) {
    return view({ tone: 'attack', station: 'periscope', response: 'captainChain.response.needPeriscope', recommendation: 'captainChain.recommendation.openPeriscope', nextCommand: 'open-periscope', actionStation: 'periscope', confidence: Math.max(quality, threat.targetConfidence), shouldInterrupt: true, reason: 'captainChain.reason.visualConfirmation', orderKey: currentOrderKey });
  }
  if (attackOrder && weapons.canFire && snapshot.periscopeOpen) {
    return view({ tone: 'attack', station: 'periscope', response: 'captainChain.response.readyToFire', recommendation: threat.hasEscortThreat ? 'captainChain.recommendation.fireThenEvade' : 'captainChain.recommendation.fireOrHold', nextCommand: 'fire-confirm', actionStation: 'periscope', confidence: Math.max(quality, threat.targetConfidence), shouldInterrupt: true, reason: 'captainChain.reason.captainFinalWord', orderKey: currentOrderKey });
  }
  if (threat.hasAirThreat) {
    return view({ tone: 'danger', station: 'sensors', response: 'captainChain.response.airThreat', recommendation: 'captainChain.recommendation.emergencyDive', nextCommand: 'emergency-dive', actionStation: 'instruments', confidence: threat.airConfidence, shouldInterrupt: true, reason: 'captainChain.reason.airContact', orderKey: currentOrderKey });
  }
  if (!threat.hasTarget && ['standby', 'plan-patrol'].includes(currentCommand)) {
    return view({ tone: 'calm', station: 'navigation', response: 'captainChain.response.noContact', recommendation: 'captainChain.recommendation.planPatrol', nextCommand: 'plan-patrol', actionStation: 'navigation', confidence: 55, shouldInterrupt: false, reason: 'captainChain.reason.noContact', orderKey: currentOrderKey });
  }
  if (execution?.status === 'blocked') {
    return view({ tone: 'blocked', station: execution.station || 'command', response: 'captainChain.response.blocked', recommendation: 'captainChain.recommendation.checkConditions', nextCommand: threat.hasTarget ? 'hold-shadow' : 'plan-patrol', actionStation: threat.hasTarget ? 'sensors' : 'navigation', confidence: Math.max(threat.targetConfidence, threat.escortConfidence, 45), shouldInterrupt: true, reason: 'captainChain.reason.blocked', orderKey: currentOrderKey });
  }
  if (currentCommand === 'authorize-repair') {
    return view({ tone: criticalDamage ? 'critical' : 'watch', station: 'damage', response: 'captainChain.response.repairUnderway', recommendation: criticalDamage ? 'captainChain.recommendation.keepRepairing' : 'captainChain.recommendation.returnCommand', nextCommand: criticalDamage ? 'stop-boat' : 'hold-shadow', actionStation: criticalDamage ? 'engines' : 'sensors', confidence: Math.max(50, 100 - hull), reason: 'captainChain.reason.damageControl', orderKey: currentOrderKey });
  }
  if (['evade-now', 'emergency-dive', 'silent-running'].includes(currentCommand)) {
    return view({ tone: 'danger', station: 'sensors', response: 'captainChain.response.evasionAcknowledged', recommendation: threat.hasEscortThreat ? 'captainChain.recommendation.staySilent' : 'captainChain.recommendation.regainContact', nextCommand: threat.hasEscortThreat ? 'silent-running' : 'hold-shadow', actionStation: 'sensors', confidence: Math.max(threat.escortConfidence, 65), reason: 'captainChain.reason.evasion', orderKey: currentOrderKey });
  }
  if (threat.hasTarget) {
    return view({ tone: 'watch', station: 'sensors', response: 'captainChain.response.contactHeld', recommendation: 'captainChain.recommendation.prepareAttackQuestion', nextCommand: 'prepare-attack', actionStation: 'weapons', confidence: threat.targetConfidence, shouldInterrupt: currentCommand === 'standby', reason: 'captainChain.reason.contact', orderKey: currentOrderKey });
  }
  return view({ tone: 'calm', station: 'command', response: 'captainChain.response.orderAcknowledged', recommendation: 'captainChain.recommendation.continueExecution', nextCommand: '', confidence: 60, reason: 'captainChain.reason.normal', orderKey: currentOrderKey });
}
