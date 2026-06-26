export const PHASE46_CAPTAIN_ORDER_DOCTRINE = Object.freeze({
  phase: 46,
  system: 'captain-order-doctrine',
  version: 'v2.0.0-alpha.61',
  defaultMode: 'captain',
  manualOverride: true,
  philosophy: 'captain-decides-crew-operates',
});

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, n(value))); }

function action(id, labelKey, station = 'command', command = null, intent = 'order') {
  return { id, labelKey, station, command: command || id, intent };
}

export function buildCaptainOrderDoctrineView({ snapshot = {}, station = 'command', commandMode = 'captain' } = {}) {
  const physics = snapshot.physics || {};
  const sensors = snapshot.sensors || {};
  const ai = snapshot.navalAI || {};
  const aircraft = ai.aircraft || {};
  const weapons = snapshot.weapons || {};
  const damage = snapshot.damage || {};
  const navigation = snapshot.navigation || {};
  const target = sensors.contacts?.target || sensors.strongestContact || {};
  const escort = sensors.contacts?.escort || {};
  const tdc = weapons.tdc || {};
  const hull = clamp(snapshot.hull ?? 100, 0, 100);
  const pressure = clamp(physics.pressurePercent ?? snapshot.pressure ?? 0, 0, 130);
  const depth = n(physics.depth ?? snapshot.depth, 0);
  const detection = clamp(snapshot.detectionScore ?? target.confidence ?? 0, 0, 100);
  const escortThreat = snapshot.escortState === 'hunt' || snapshot.escortState === 'alert' || n(escort.confidence) >= 58 || ai.threatLevel === 'critical';
  const targetQuality = clamp(tdc.solutionQuality ?? target.confidence ?? 0, 0, 100);
  const hasTarget = Boolean(target.detected) || targetQuality >= 35;
  const canFire = Boolean(weapons.canFire) && targetQuality >= n(weapons.minimumSolutionQuality, 42);
  const route = Array.isArray(navigation.route) ? navigation.route : [];
  const elapsed = n(snapshot.elapsedMs || snapshot.worldTime, 0);
  const noRoute = navigation && !route.length && !navigation.patrolEntered && elapsed > 9000;
  const criticalDamage = hull < 45 || n(damage.criticalCount) > 0 || n(damage.totalFlooding) >= 42 || n(damage.totalFire) >= 35 || snapshot.damageFlashTicks > 0;
  const criticalPressure = depth > 220 || pressure > 86 || physics.depthZone === 'collapse' || physics.depthZone === 'overdepth';
  const crewReady = elapsed < 13000 && !snapshot.playerDetected && !snapshot.torpedoActive && !snapshot.targetDestroyed;

  if (snapshot.missionFailed || hull <= 0) {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-mission-lost', category: 'damage', priority: 10, tone: 'critical', questionKey: 'captainOrder.question.missionLost', decisionKey: 'captainOrder.decision.damage', stationHint: 'damage', actions: [action('go-damage','subofficer.action.damage','damage'), action('go-command','subofficer.action.command','command')] };
  }
  if (aircraft.state === 'attack' || aircraft.state === 'attack-run') {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-air-attack', category: 'threat', priority: 10, tone: 'critical', questionKey: 'captainOrder.question.airAttack', decisionKey: 'captainOrder.decision.evasion', stationHint: 'command', actions: [action('evade-now','captainOrder.action.evadeNow','command','evade-now'), action('silent-running','subofficer.action.silent','command','silent-running'), action('manual-control','captainOrder.action.manual','command','manual-control','mode')] };
  }
  if (aircraft.active || aircraft.state === 'tracking') {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-air-warning', category: 'threat', priority: 9, tone: 'critical', questionKey: 'captainOrder.question.airWarning', decisionKey: 'captainOrder.decision.evasion', stationHint: 'command', actions: [action('emergency-dive','subofficer.action.dive','command','emergency-dive'), action('prepare-silent-approach','captainOrder.action.silentApproach','sensors','prepare-silent-approach'), action('manual-control','captainOrder.action.manual','command','manual-control','mode')] };
  }
  if (criticalDamage) {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-damage-control', category: 'damage', priority: 8, tone: 'critical', questionKey: 'captainOrder.question.damage', decisionKey: 'captainOrder.decision.repair', stationHint: 'damage', actions: [action('authorize-repair','captainOrder.action.authorizeRepair','damage','authorize-repair'), action('stop-boat','captainOrder.action.stopBoat','command','stop-boat'), action('manual-control','captainOrder.action.manual','command','manual-control','mode')] };
  }
  if (criticalPressure) {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-pressure', category: 'depth', priority: 8, tone: 'critical', questionKey: 'captainOrder.question.pressure', decisionKey: 'captainOrder.decision.depth', stationHint: 'instruments', actions: [action('level-trim','subofficer.action.trim','instruments','level-trim'), action('shallow-up','captainOrder.action.shallowUp','instruments','shallow-up'), action('manual-control','captainOrder.action.manual','command','manual-control','mode')] };
  }
  if (escortThreat) {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-escort-hunt', category: 'threat', priority: 7, tone: 'danger', questionKey: 'captainOrder.question.escortHunt', decisionKey: 'captainOrder.decision.silent', stationHint: 'sensors', actions: [action('prepare-silent-approach','captainOrder.action.silentApproach','sensors','prepare-silent-approach'), action('evade-now','captainOrder.action.evadeNow','command','evade-now'), action('manual-control','captainOrder.action.manual','command','manual-control','mode')] };
  }
  if (hasTarget && canFire) {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-attack-decision', category: 'attack', priority: 7, tone: 'attack', questionKey: 'captainOrder.question.attackReady', decisionKey: 'captainOrder.decision.attack', stationHint: 'weapons', actions: [action('prepare-attack','captainOrder.action.prepareAttack','weapons','prepare-attack'), action('hold-shadow','captainOrder.action.holdShadow','sensors','hold-shadow'), action('manual-control','captainOrder.action.manual','command','manual-control','mode')] };
  }
  if (hasTarget) {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-contact-decision', category: 'contact', priority: 6, tone: 'watch', questionKey: 'captainOrder.question.contact', decisionKey: 'captainOrder.decision.observe', stationHint: 'periscope', actions: [action('prepare-attack','captainOrder.action.prepareAttack','weapons','prepare-attack'), action('hold-shadow','captainOrder.action.holdShadow','sensors','hold-shadow'), action('manual-control','captainOrder.action.manual','command','manual-control','mode')] };
  }
  if (crewReady) {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-crew-ready', category: 'ready', priority: 6, tone: 'calm', questionKey: 'captainOrder.question.crewReady', decisionKey: 'captainOrder.decision.start', stationHint: 'navigation', actions: [action('plan-patrol','captainOrder.action.planPatrol','navigation','plan-patrol'), action('open-periscope','subofficer.action.periscope','command','open-periscope'), action('manual-control','captainOrder.action.manual','command','manual-control','mode')] };
  }
  if (noRoute) {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-route-order', category: 'navigation', priority: 5, tone: 'watch', questionKey: 'captainOrder.question.route', decisionKey: 'captainOrder.decision.navigation', stationHint: 'navigation', actions: [action('plan-patrol','captainOrder.action.planPatrol','navigation','plan-patrol'), action('go-map','subofficer.action.map','navigation'), action('manual-control','captainOrder.action.manual','command','manual-control','mode')] };
  }
  if (snapshot.canComplete || snapshot.targetDestroyed) {
    return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-success', category: 'success', priority: 6, tone: 'success', questionKey: 'captainOrder.question.success', decisionKey: 'captainOrder.decision.complete', stationHint: 'command', actions: [action('go-command','subofficer.action.command','command'), action('go-map','subofficer.action.map','navigation')] };
  }
  return { phase: PHASE46_CAPTAIN_ORDER_DOCTRINE.phase, system: PHASE46_CAPTAIN_ORDER_DOCTRINE.system, version: PHASE46_CAPTAIN_ORDER_DOCTRINE.version, commandMode, id: 'captain-steady-patrol', category: 'patrol', priority: commandMode === 'manual' ? 1 : 2, tone: 'calm', questionKey: 'captainOrder.question.steady', decisionKey: 'captainOrder.decision.patrol', stationHint: station || 'command', actions: [action('go-command','subofficer.action.command','command'), action('manual-control','captainOrder.action.manual','command','manual-control','mode')] };
}
