import { buildCaptainOrderDoctrineView } from './captainOrderDoctrine.js';
const phase26Clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export const PHASE26_SUBOFFICER = Object.freeze({
  phase: 26,
  operation: 'Silent Depth',
  role: 'subofficer-copilot',
  avatar: 'assets/avatars/de/officer_01.png',
  typewriter: true,
  mobileFirst: true,
  confirmButton: 'AÇÃO RECOMENDADA'
});

function action(id, labelKey, station = 'command', command = null) {
  return { id, labelKey, station, command: command || id };
}

function stationActions(stationHint = 'command', extra = []) {
  const base = {
    command: action('go-command', 'subofficer.action.command', 'command'),
    navigation: action('go-map', 'subofficer.action.map', 'navigation'),
    sensors: action('go-sonar', 'subofficer.action.sonar', 'sensors'),
    weapons: action('go-weapons', 'subofficer.action.weapons', 'weapons'),
    damage: action('go-damage', 'subofficer.action.damage', 'damage'),
    periscope: action('open-periscope', 'subofficer.action.periscope', 'command', 'open-periscope'),
    instruments: action('go-instruments', 'subofficer.action.instruments', 'instruments'),
    ai: action('go-threat', 'subofficer.action.threat', 'ai'),
  };
  const primary = base[stationHint] || base.command;
  const seen = new Set();
  return [primary, ...extra].filter(Boolean).filter((item) => {
    const key = item.id || item.command || item.station;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

export function classifySubOfficerSituation({ snapshot = {}, station = 'command' } = {}) {
  const physics = snapshot.physics || {};
  const sensors = snapshot.sensors || {};
  const ai = snapshot.navalAI || {};
  const weapons = snapshot.weapons || {};
  const damage = snapshot.damage || {};
  const contact = sensors.contacts?.target || sensors.strongestContact || {};
  const escort = sensors.contacts?.escort || {};
  const aircraft = ai.aircraft || {};
  const speedKnots = Number(physics.actualSpeedKnots ?? snapshot.speedKnots ?? 0);
  const detection = phase26Clamp(snapshot.detectionScore ?? contact.confidence ?? 0, 0, 100);
  const hull = phase26Clamp(snapshot.hull ?? 100, 0, 100);
  const pressure = phase26Clamp(physics.pressurePercent ?? snapshot.pressure ?? 0, 0, 120);
  const depth = Number(physics.depth ?? snapshot.depth ?? 0);
  const damageCritical = Number(damage.criticalCount || 0);
  const targetVisible = Boolean(contact.detected) || Boolean(snapshot.periscopeOpen && !snapshot.targetDestroyed && Number(weapons.tdc?.solutionQuality || 0) > 18);
  const escortThreat = snapshot.escortState === 'hunt' || snapshot.escortState === 'alert' || Number(escort.confidence || 0) >= 58;
  const hasNavigationPlan = snapshot.navigation && typeof snapshot.navigation === 'object';
  const navigation = snapshot.navigation || {};
  const route = Array.isArray(navigation.route) ? navigation.route : [];
  const hasRuntimeClock = snapshot.elapsedMs !== undefined || snapshot.worldTime !== undefined;
  const elapsedMs = Number(snapshot.elapsedMs || snapshot.worldTime || 0);
  const missionJustStarted = hasRuntimeClock && hasNavigationPlan && elapsedMs < 12000 && !snapshot.torpedoActive && !snapshot.targetDestroyed && !snapshot.playerDetected;

  if (snapshot.missionFailed || hull <= 0) return { id: 'mission-lost', tone: 'critical', priority: 10, titleKey: 'subofficer.title.damage', textKey: 'subofficer.msg.missionLost', stationHint: 'damage', actions: stationActions('damage', [action('go-command', 'subofficer.action.command', 'command')]) };
  if (aircraft.state === 'attack' || aircraft.state === 'attack-run') return { id: 'aircraft-attack-run', tone: 'critical', priority: 10, titleKey: 'subofficer.title.air', textKey: 'captainOrder.question.airAttack', stationHint: 'command', actions: [action('evade-now', 'captainOrder.action.evadeNow', 'command', 'evade-now'), action('silent-running', 'subofficer.action.silent', 'command', 'silent-running'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control')] };
  if (aircraft.active || aircraft.state === 'tracking') return { id: 'aircraft-inbound', tone: 'critical', priority: 9, titleKey: 'subofficer.title.air', textKey: 'captainOrder.question.airWarning', stationHint: 'command', actions: [action('emergency-dive', 'subofficer.action.dive', 'command', 'emergency-dive'), action('prepare-silent-approach', 'captainOrder.action.silentApproach', 'sensors', 'prepare-silent-approach'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control')] };
  if (snapshot.damageFlashTicks > 0 || hull < 45 || damageCritical > 0) return { id: 'damage-critical', tone: 'critical', priority: 8, titleKey: 'subofficer.title.damage', textKey: 'captainOrder.question.damage', stationHint: 'damage', actions: [action('authorize-repair', 'captainOrder.action.authorizeRepair', 'damage', 'authorize-repair'), action('stop-boat', 'captainOrder.action.stopBoat', 'command', 'stop-boat'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control')] };
  if (snapshot.depth > 220 || pressure > 86 || physics.depthZone === 'collapse' || physics.depthZone === 'overdepth') return { id: 'deep-pressure', tone: 'critical', priority: 8, titleKey: 'subofficer.title.depth', textKey: 'captainOrder.question.pressure', stationHint: 'instruments', actions: [action('level-trim', 'subofficer.action.trim', 'instruments', 'level-trim'), action('shallow-up', 'captainOrder.action.shallowUp', 'instruments', 'shallow-up'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control')] };
  if (escortThreat) return { id: 'enemy-hunt', tone: 'danger', priority: 7, titleKey: 'subofficer.title.contact', textKey: 'captainOrder.question.escortHunt', stationHint: 'sensors', actions: [action('prepare-silent-approach', 'captainOrder.action.silentApproach', 'sensors', 'prepare-silent-approach'), action('evade-now', 'captainOrder.action.evadeNow', 'command', 'evade-now'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control')] };
  if (targetVisible && Number(weapons.tdc?.solutionQuality || 0) >= 70 && weapons.canFire) return { id: 'fire-solution', tone: 'attack', priority: 6, titleKey: 'subofficer.title.attack', textKey: 'captainOrder.question.attackReady', stationHint: 'weapons', actions: [action('prepare-attack', 'captainOrder.action.prepareAttack', 'weapons', 'prepare-attack'), action('hold-shadow', 'captainOrder.action.holdShadow', 'sensors', 'hold-shadow'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control')] };
  if (targetVisible) return { id: 'visual-contact', tone: 'watch', priority: 5, titleKey: 'subofficer.title.contact', textKey: 'captainOrder.question.contact', stationHint: 'periscope', actions: [action('prepare-attack', 'captainOrder.action.prepareAttack', 'weapons', 'prepare-attack'), action('hold-shadow', 'captainOrder.action.holdShadow', 'sensors', 'hold-shadow'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control')] };
  if (missionJustStarted) return { id: 'crew-ready-awaiting-orders', tone: 'calm', priority: 6, titleKey: 'subofficer.title.readyCaptain', textKey: 'captainOrder.question.crewReady', stationHint: 'navigation', actions: [action('plan-patrol', 'captainOrder.action.planPatrol', 'navigation', 'plan-patrol'), action('open-periscope', 'subofficer.action.periscope', 'command', 'open-periscope'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control')] };
  if (hasNavigationPlan && !route.length && !navigation.patrolEntered && elapsedMs > 10000) return { id: 'route-needed', tone: 'watch', priority: 5, titleKey: 'subofficer.title.navigation', textKey: 'captainOrder.question.route', stationHint: 'navigation', actions: [action('plan-patrol', 'captainOrder.action.planPatrol', 'navigation', 'plan-patrol'), action('go-map', 'subofficer.action.map', 'navigation'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control')] };
  if (snapshot.periscopeOpen) return { id: 'periscope-watch', tone: 'watch', priority: 4, titleKey: 'subofficer.title.periscope', textKey: 'subofficer.msg.periscopeWatch', stationHint: 'periscope', actions: stationActions('periscope', [action('go-sonar', 'subofficer.action.sonar', 'sensors')]) };
  if (speedKnots < 0.4 && depth < 30 && station === 'command') return { id: 'standing-by', tone: 'calm', priority: 3, titleKey: 'subofficer.title.standby', textKey: 'subofficer.msg.standby', stationHint: 'navigation', actions: stationActions('navigation') };
  if (snapshot.canComplete || snapshot.targetDestroyed) return { id: 'mission-success', tone: 'success', priority: 6, titleKey: 'subofficer.title.success', textKey: 'subofficer.msg.success', stationHint: 'command', actions: stationActions('command', [action('go-map', 'subofficer.action.map', 'navigation')]) };
  if (depth >= 80 && speedKnots < 4) return { id: 'silent-patrol', tone: 'calm', priority: 2, titleKey: 'subofficer.title.silent', textKey: 'subofficer.msg.silentPatrol', stationHint: 'sensors', actions: stationActions('sensors', [action('go-map', 'subofficer.action.map', 'navigation')]) };
  return { id: 'patrol-steady', tone: 'calm', priority: 1, titleKey: 'subofficer.title.standby', textKey: 'subofficer.msg.patrolSteady', stationHint: 'command', actions: stationActions('command') };
}

export function buildSubOfficerDialogue({ snapshot = {}, station = 'command', commanderName = '', commandMode = 'captain' } = {}) {
  const situation = classifySubOfficerSituation({ snapshot, station });
  const captainDecision = buildCaptainOrderDoctrineView({ snapshot, station, commandMode });
  const watch = Number(snapshot.worldTime || snapshot.elapsedMs || 0);
  const watchGroup = Math.floor(watch / 9000);
  return {
    ...situation,
    captainDecision,
    commandMode,
    commanderName: commanderName || 'Commander',
    key: `${situation.id}:${watchGroup}`,
    mustInterrupt: situation.priority >= 7,
    shouldAutoOpen: situation.priority >= 5 || ['crew-ready-awaiting-orders', 'route-needed', 'standing-by', 'mission-success'].includes(situation.id),
    typewriterMs: situation.priority >= 7 ? 12 : situation.priority >= 5 ? 16 : 20,
    actions: Array.isArray(situation.actions) ? situation.actions : stationActions(situation.stationHint || 'command'),
    ackLabelKey: situation.actions?.[0]?.labelKey || (situation.priority >= 7 ? 'subofficer.ackEmergency' : 'subofficer.ack')
  };
}

export function shouldSubOfficerInterrupt({ current = null, next = null, acknowledged = [] } = {}) {
  if (!next) return false;
  const acknowledgedSet = new Set(acknowledged);
  if (acknowledgedSet.has(next.id) || acknowledgedSet.has(next.key)) return false;
  if (next.mustInterrupt) return true;
  if (!current) return Boolean(next.shouldAutoOpen);
  if (next.id !== current.id && next.priority >= current.priority) return true;
  return false;
}

export function renderSubOfficerLine({ text = '', maxChars = 220 } = {}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}
