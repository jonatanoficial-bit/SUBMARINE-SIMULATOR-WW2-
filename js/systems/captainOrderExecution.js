export const PHASE48_CAPTAIN_ORDER_EXECUTION = Object.freeze({
  phase: 48,
  system: 'captain-order-execution-board',
  version: 'v2.0.0-alpha.64',
  doctrine: 'captain-order-enters-execution-board-with-station-progress-and-effect',
  manualOverride: true,
  saveSchemaStable: true,
});

const DEFAULT_TTL_MS = 64000;
const STANDBY_TTL_MS = 18000;
const ORDER_PROFILES = Object.freeze({
  'prepare-attack': { orderKey: 'captainExecution.order.prepareAttack', station: 'weapons', status: 'preparing', etaSeconds: 26, effectKey: 'captainExecution.effect.prepareAttack', risk: 'attack' },
  'fire-confirm': { orderKey: 'captainExecution.order.fireConfirm', station: 'periscope', status: 'executed', etaSeconds: 0, effectKey: 'captainExecution.effect.fireConfirm', risk: 'attack' },
  'order-periscope-depth': { orderKey: 'captainExecution.order.periscopeDepth', station: 'instruments', status: 'executing', etaSeconds: 18, effectKey: 'captainExecution.effect.periscopeDepth', risk: 'warning' },
  'open-periscope': { orderKey: 'captainExecution.order.openPeriscope', station: 'periscope', status: 'executing', etaSeconds: 8, effectKey: 'captainExecution.effect.openPeriscope', risk: 'watch' },
  'cancel-attack': { orderKey: 'captainExecution.order.cancelAttack', station: 'sensors', status: 'executing', etaSeconds: 12, effectKey: 'captainExecution.effect.cancelAttack', risk: 'watch' },
  'hold-shadow': { orderKey: 'captainExecution.order.holdShadow', station: 'sensors', status: 'executing', etaSeconds: 20, effectKey: 'captainExecution.effect.holdShadow', risk: 'watch' },
  'authorize-repair': { orderKey: 'captainExecution.order.authorizeRepair', station: 'damage', status: 'working', etaSeconds: 45, effectKey: 'captainExecution.effect.authorizeRepair', risk: 'critical' },
  'evade-now': { orderKey: 'captainExecution.order.evadeNow', station: 'instruments', status: 'executing', etaSeconds: 22, effectKey: 'captainExecution.effect.evadeNow', risk: 'danger' },
  'emergency-dive': { orderKey: 'captainExecution.order.emergencyDive', station: 'instruments', status: 'executing', etaSeconds: 16, effectKey: 'captainExecution.effect.emergencyDive', risk: 'danger' },
  'silent-running': { orderKey: 'captainExecution.order.silentRunning', station: 'sensors', status: 'executing', etaSeconds: 14, effectKey: 'captainExecution.effect.silentRunning', risk: 'watch' },
  'prepare-silent-approach': { orderKey: 'captainExecution.order.silentApproach', station: 'sensors', status: 'preparing', etaSeconds: 24, effectKey: 'captainExecution.effect.silentApproach', risk: 'watch' },
  'plan-patrol': { orderKey: 'captainExecution.order.planPatrol', station: 'navigation', status: 'working', etaSeconds: 28, effectKey: 'captainExecution.effect.planPatrol', risk: 'calm' },
  'stop-boat': { orderKey: 'captainExecution.order.stopBoat', station: 'engines', status: 'executing', etaSeconds: 10, effectKey: 'captainExecution.effect.stopBoat', risk: 'watch' },
  'slow-speed': { orderKey: 'captainExecution.order.slowSpeed', station: 'engines', status: 'executing', etaSeconds: 8, effectKey: 'captainExecution.effect.slowSpeed', risk: 'calm' },
  'shallow-up': { orderKey: 'captainExecution.order.shallowUp', station: 'instruments', status: 'executing', etaSeconds: 18, effectKey: 'captainExecution.effect.shallowUp', risk: 'warning' },
  'level-trim': { orderKey: 'captainExecution.order.levelTrim', station: 'instruments', status: 'executing', etaSeconds: 12, effectKey: 'captainExecution.effect.levelTrim', risk: 'calm' },
  'manual-control': { orderKey: 'captainExecution.order.manual', station: 'command', status: 'manual', etaSeconds: 0, effectKey: 'captainExecution.effect.manual', risk: 'manual' },
});

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, n(value)));
}

function nowFrom(snapshot = {}) {
  return n(snapshot.worldTime ?? snapshot.elapsedMs, Date.now());
}

function fallbackProfile(command = 'standby') {
  if (ORDER_PROFILES[command]) return ORDER_PROFILES[command];
  return { orderKey: 'captainExecution.order.standby', station: 'command', status: 'standby', etaSeconds: 0, effectKey: 'captainExecution.effect.awaiting', risk: 'calm' };
}

function baseState(command = 'standby', snapshot = {}, profile = fallbackProfile(command), extra = {}) {
  const now = nowFrom(snapshot);
  const etaMs = Math.max(0, n(profile.etaSeconds, 0) * 1000);
  return {
    phase: PHASE48_CAPTAIN_ORDER_EXECUTION.phase,
    command,
    orderKey: profile.orderKey,
    station: profile.station,
    status: profile.status,
    effectKey: profile.effectKey,
    risk: profile.risk,
    startedAt: now,
    updatedAt: now,
    etaMs,
    expiresAt: now + Math.max(DEFAULT_TTL_MS, etaMs + STANDBY_TTL_MS),
    resultOk: true,
    reason: '',
    ...extra,
  };
}

export function createCaptainExecutionState(snapshot = {}) {
  return baseState('standby', snapshot, fallbackProfile('standby'), { expiresAt: nowFrom(snapshot) + STANDBY_TTL_MS });
}

export function createCaptainExecutionFromCommand(command = 'standby', snapshot = {}, options = {}) {
  const profile = fallbackProfile(command);
  const result = options.result && typeof options.result === 'object' ? options.result : { ok: true };
  const blocked = result.ok === false;
  return baseState(command, snapshot, profile, {
    status: blocked ? 'blocked' : profile.status,
    effectKey: blocked ? 'captainExecution.effect.blocked' : profile.effectKey,
    risk: blocked ? 'blocked' : profile.risk,
    resultOk: !blocked,
    reason: blocked ? String(result.reason || 'blocked') : '',
    flowStage: options.flow?.stage || '',
  });
}

function progressOf(state = {}, snapshot = {}) {
  if (!state || state.status === 'standby' || state.status === 'manual') return 0;
  if (state.status === 'blocked' || state.status === 'executed') return 100;
  const elapsed = Math.max(0, nowFrom(snapshot) - n(state.startedAt, nowFrom(snapshot)));
  const eta = Math.max(1000, n(state.etaMs, 0));
  return Math.round(clamp((elapsed / eta) * 100, 7, 99));
}

function flowFallbackCommand(flow = {}) {
  if (!flow || typeof flow !== 'object') return '';
  if (flow.stage === 'attackPrepared') return 'prepare-attack';
  if (flow.stage === 'torpedoRunning') return 'fire-confirm';
  if (flow.stage === 'repairAuthorized') return 'authorize-repair';
  if (flow.stage === 'evasionOrdered') return flow.order === 'emergency-dive' ? 'emergency-dive' : 'evade-now';
  if (flow.stage === 'silentOrdered') return flow.order === 'silent-running' ? 'silent-running' : 'prepare-silent-approach';
  if (flow.stage === 'patrolPlanned') return 'plan-patrol';
  if (flow.stage === 'shadowOrdered') return flow.order === 'cancel-attack' ? 'cancel-attack' : 'hold-shadow';
  return '';
}

export function normalizeCaptainExecutionState(current = null, snapshot = {}, flow = null, commandMode = 'captain') {
  const now = nowFrom(snapshot);
  if (commandMode === 'manual') {
    if (!current || current.status !== 'manual') return createCaptainExecutionFromCommand('manual-control', snapshot);
    return { ...current, updatedAt: now, expiresAt: now + DEFAULT_TTL_MS };
  }
  const fallbackCommandFromFlow = flowFallbackCommand(flow);
  if (!current || typeof current !== 'object') {
    return fallbackCommandFromFlow ? createCaptainExecutionFromCommand(fallbackCommandFromFlow, snapshot, { flow }) : createCaptainExecutionState(snapshot);
  }
  if (fallbackCommandFromFlow && current.command !== fallbackCommandFromFlow && current.status !== 'blocked') {
    return createCaptainExecutionFromCommand(fallbackCommandFromFlow, snapshot, { flow });
  }
  if (current.status === 'blocked' && now - n(current.startedAt, now) > STANDBY_TTL_MS) return createCaptainExecutionState(snapshot);
  if (current.status === 'executed' && now - n(current.startedAt, now) > STANDBY_TTL_MS) return createCaptainExecutionState(snapshot);
  if (now > n(current.expiresAt, 0)) return createCaptainExecutionState(snapshot);
  return { ...current, updatedAt: now };
}

function taskRows(state = {}, snapshot = {}) {
  const sensors = snapshot.sensors || {};
  const weapons = snapshot.weapons || {};
  const damage = snapshot.damage || {};
  const physics = snapshot.physics || {};
  const quality = clamp(weapons.tdc?.solutionQuality || 0, 0, 100);
  const hull = clamp(snapshot.hull ?? 100, 0, 100);
  const contact = sensors.contacts?.target || sensors.strongestContact || {};
  if (state.command === 'prepare-attack') {
    return [
      { key: 'captainExecution.task.weaponsTube', state: quality >= n(weapons.minimumSolutionQuality, 42) ? 'done' : 'active' },
      { key: 'captainExecution.task.periscopeConfirm', state: snapshot.periscopeOpen ? 'done' : 'waiting' },
      { key: 'captainExecution.task.fireDiscipline', state: weapons.canFire && snapshot.periscopeOpen ? 'active' : 'waiting' },
    ];
  }
  if (['evade-now', 'emergency-dive'].includes(state.command)) {
    return [
      { key: 'captainExecution.task.depthChange', state: Number(physics.depth ?? snapshot.depth ?? 0) >= 70 ? 'done' : 'active' },
      { key: 'captainExecution.task.noiseReduction', state: snapshot.silentRunning ? 'done' : 'active' },
      { key: 'captainExecution.task.escortBearing', state: contact.detected ? 'active' : 'waiting' },
    ];
  }
  if (state.command === 'authorize-repair') {
    return [
      { key: 'captainExecution.task.damageParty', state: Number(damage.activeTeams || damage.teamsActive || 0) > 0 ? 'active' : 'waiting' },
      { key: 'captainExecution.task.secureCompartments', state: Number(damage.criticalCount || 0) <= 0 ? 'done' : 'active' },
      { key: 'captainExecution.task.hullIntegrity', state: hull >= 70 ? 'done' : hull >= 45 ? 'active' : 'critical' },
    ];
  }
  if (state.command === 'plan-patrol') {
    const route = Array.isArray(snapshot.navigation?.route) ? snapshot.navigation.route : [];
    return [
      { key: 'captainExecution.task.plotRoute', state: route.length ? 'done' : 'active' },
      { key: 'captainExecution.task.checkWeather', state: snapshot.environment ? 'done' : 'waiting' },
      { key: 'captainExecution.task.enterSector', state: snapshot.navigation?.patrolEntered ? 'done' : 'active' },
    ];
  }
  return [
    { key: 'captainExecution.task.listen', state: 'active' },
    { key: 'captainExecution.task.report', state: 'waiting' },
    { key: 'captainExecution.task.standby', state: 'waiting' },
  ];
}

export function buildCaptainExecutionBoard({ snapshot = {}, execution = null, flow = null, commandMode = 'captain' } = {}) {
  const state = normalizeCaptainExecutionState(execution, snapshot, flow, commandMode);
  const progress = progressOf(state, snapshot);
  const remainingMs = Math.max(0, n(state.etaMs, 0) - Math.max(0, nowFrom(snapshot) - n(state.startedAt, nowFrom(snapshot))));
  const etaSeconds = state.status === 'standby' || state.status === 'manual' || state.status === 'executed' || state.status === 'blocked' ? 0 : Math.ceil(remainingMs / 1000);
  return {
    phase: PHASE48_CAPTAIN_ORDER_EXECUTION.phase,
    system: PHASE48_CAPTAIN_ORDER_EXECUTION.system,
    version: PHASE48_CAPTAIN_ORDER_EXECUTION.version,
    state,
    command: state.command,
    statusKey: `captainExecution.status.${state.status || 'standby'}`,
    orderKey: state.orderKey || 'captainExecution.order.standby',
    stationKey: `captainExecution.station.${state.station || 'command'}`,
    effectKey: state.effectKey || 'captainExecution.effect.awaiting',
    risk: state.risk || 'calm',
    progress,
    etaSeconds,
    rows: taskRows(state, snapshot),
  };
}
