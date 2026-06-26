export const PHASE47_CAPTAIN_CREW_REALISM = Object.freeze({
  phase: 47,
  system: 'captain-crew-realism',
  version: 'v2.0.0-alpha.62',
  doctrine: 'captain-receives-situation-decides-crew-executes',
  manualOverride: true,
  attackChain: Object.freeze(['decision', 'torpedo-prepared', 'periscope-confirmation', 'fire-order']),
});

const FLOW_TTL_MS = 52000;
const FEEDBACK_TTL_MS = 16000;
const ATTACK_TTL_MS = 90000;

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

function flow(id = 'idle', stage = 'idle', messageKey = 'captainCrew.flow.idle', snapshot = {}, extra = {}) {
  const now = nowFrom(snapshot);
  return {
    id,
    stage,
    messageKey,
    startedAt: now,
    updatedAt: now,
    expiresAt: now + (stage === 'attackPrepared' ? ATTACK_TTL_MS : FEEDBACK_TTL_MS),
    ...extra,
  };
}

export function createCaptainCrewOrderFlow(snapshot = {}) {
  return flow('idle', 'idle', 'captainCrew.flow.idle', snapshot);
}

export function beginCaptainCrewOrder(command, snapshot = {}, previous = null) {
  const base = previous && typeof previous === 'object' ? previous : createCaptainCrewOrderFlow(snapshot);
  const now = nowFrom(snapshot);
  if (command === 'prepare-attack') {
    return {
      ...base,
      id: 'attack-chain',
      stage: 'attackPrepared',
      messageKey: 'captainCrew.flow.attackPrepared',
      startedAt: now,
      updatedAt: now,
      expiresAt: now + ATTACK_TTL_MS,
      targetRole: 'target',
      requiresPeriscopeConfirmation: true,
      fireAuthorized: false,
    };
  }
  if (command === 'authorize-repair') {
    return flow('repair-authorized', 'repairAuthorized', 'captainCrew.flow.repairAuthorized', snapshot, { order: command });
  }
  if (command === 'evade-now' || command === 'emergency-dive') {
    return flow('evasion-ordered', 'evasionOrdered', 'captainCrew.flow.evasionOrdered', snapshot, { order: command });
  }
  if (command === 'prepare-silent-approach' || command === 'silent-running') {
    return flow('silent-ordered', 'silentOrdered', 'captainCrew.flow.silentOrdered', snapshot, { order: command });
  }
  if (command === 'plan-patrol') {
    return flow('patrol-planned', 'patrolPlanned', 'captainCrew.flow.patrolPlanned', snapshot, { order: command });
  }
  if (command === 'hold-shadow' || command === 'cancel-attack') {
    return flow('shadow-ordered', 'shadowOrdered', 'captainCrew.flow.shadowOrdered', snapshot, { order: command });
  }
  if (command === 'fire-confirm') {
    return flow('torpedo-running', 'torpedoRunning', 'captainCrew.flow.torpedoRunning', snapshot, { order: command, fireAuthorized: true });
  }
  return flow('idle', 'idle', 'captainCrew.flow.idle', snapshot);
}

export function normalizeCaptainCrewOrderFlow(current = null, snapshot = {}) {
  if (!current || typeof current !== 'object') return createCaptainCrewOrderFlow(snapshot);
  const now = nowFrom(snapshot);
  if (snapshot.missionFailed || snapshot.targetDestroyed || snapshot.canComplete) return flow('idle', 'idle', 'captainCrew.flow.idle', snapshot);
  if (current.stage === 'attackPrepared') {
    if (snapshot.torpedoActive) return beginCaptainCrewOrder('fire-confirm', snapshot, current);
    if (now - n(current.updatedAt, now) > ATTACK_TTL_MS) return flow('idle', 'idle', 'captainCrew.flow.idle', snapshot);
    return { ...current, expiresAt: now + Math.max(12000, n(current.expiresAt, now + ATTACK_TTL_MS) - now) };
  }
  if (current.stage === 'torpedoRunning' && !snapshot.torpedoActive && now - n(current.updatedAt, now) > FEEDBACK_TTL_MS) {
    return flow('idle', 'idle', 'captainCrew.flow.idle', snapshot);
  }
  if (now > n(current.expiresAt, 0) || now - n(current.updatedAt, now) > FLOW_TTL_MS) return flow('idle', 'idle', 'captainCrew.flow.idle', snapshot);
  return current;
}

function action(id, labelKey, station = 'command', command = null, intent = 'order') {
  return { id, labelKey, station, command: command || id, intent };
}

export function buildCaptainCrewOrderPanel({ snapshot = {}, flow: current = null, commandMode = 'captain' } = {}) {
  const active = normalizeCaptainCrewOrderFlow(current, snapshot);
  const weapons = snapshot.weapons || {};
  const tdc = weapons.tdc || {};
  const quality = clamp(tdc.solutionQuality ?? 0, 0, 100);
  const periscopeOpen = Boolean(snapshot.periscopeOpen);
  const canFire = Boolean(weapons.canFire);
  const depth = n(snapshot.depth ?? snapshot.physics?.depth, 0);
  const maxLaunchDepth = n(weapons.profile?.maxLaunchDepth, 60);
  const attackReady = active.stage === 'attackPrepared';
  const steps = attackReady
    ? [
        { key: 'captainCrew.step.decision', state: 'done' },
        { key: 'captainCrew.step.torpedoPrepared', state: quality >= n(weapons.minimumSolutionQuality, 42) ? 'done' : 'active' },
        { key: 'captainCrew.step.periscope', state: periscopeOpen ? 'done' : 'active' },
        { key: 'captainCrew.step.fireOrder', state: canFire && periscopeOpen ? 'active' : 'waiting' },
      ]
    : [
        { key: 'captainCrew.step.situation', state: active.stage === 'idle' ? 'active' : 'done' },
        { key: 'captainCrew.step.order', state: active.stage === 'idle' ? 'waiting' : 'done' },
        { key: 'captainCrew.step.execution', state: active.stage === 'idle' ? 'waiting' : 'active' },
      ];
  let detailKey = active.messageKey || 'captainCrew.flow.idle';
  let state = active.stage || 'idle';
  if (attackReady && depth > maxLaunchDepth) {
    detailKey = 'captainCrew.flow.attackTooDeep';
    state = 'attackTooDeep';
  } else if (attackReady && !periscopeOpen) {
    detailKey = 'captainCrew.flow.attackNeedPeriscope';
    state = 'attackNeedPeriscope';
  } else if (attackReady && canFire && periscopeOpen) {
    detailKey = 'captainCrew.flow.awaitingFireOrder';
    state = 'awaitingFireOrder';
  }
  return {
    phase: PHASE47_CAPTAIN_CREW_REALISM.phase,
    system: PHASE47_CAPTAIN_CREW_REALISM.system,
    version: PHASE47_CAPTAIN_CREW_REALISM.version,
    commandMode,
    active,
    state,
    stageKey: `captainCrew.stage.${state}`,
    detailKey,
    quality,
    canFire,
    periscopeOpen,
    steps,
  };
}

export function buildCaptainCrewFlowDialogue({ snapshot = {}, flow: current = null } = {}) {
  const view = buildCaptainCrewOrderPanel({ snapshot, flow: current });
  const weapons = snapshot.weapons || {};
  const depth = n(snapshot.depth ?? snapshot.physics?.depth, 0);
  const maxLaunchDepth = n(weapons.profile?.maxLaunchDepth, 60);
  if (view.active.stage !== 'attackPrepared') return null;
  if (depth > maxLaunchDepth) {
    return {
      id: 'captain-attack-too-deep', tone: 'attack', priority: 8,
      titleKey: 'captainCrew.title.attackStation', textKey: 'captainCrew.question.periscopeDepth', stationHint: 'instruments',
      actions: [action('order-periscope-depth', 'captainCrew.action.periscopeDepth', 'instruments', 'order-periscope-depth'), action('cancel-attack', 'captainCrew.action.cancelAttack', 'sensors', 'cancel-attack'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control', 'mode')],
    };
  }
  if (!snapshot.periscopeOpen) {
    return {
      id: 'captain-open-periscope-confirm', tone: 'attack', priority: 8,
      titleKey: 'captainCrew.title.attackStation', textKey: 'captainCrew.question.openPeriscope', stationHint: 'periscope',
      actions: [action('open-periscope', 'subofficer.action.periscope', 'command', 'open-periscope'), action('cancel-attack', 'captainCrew.action.cancelAttack', 'sensors', 'cancel-attack'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control', 'mode')],
    };
  }
  if (view.canFire) {
    return {
      id: 'captain-confirm-fire', tone: 'attack', priority: 9,
      titleKey: 'captainCrew.title.attackStation', textKey: 'captainCrew.question.confirmFire', stationHint: 'periscope',
      actions: [action('fire-confirm', 'captainCrew.action.fireConfirm', 'periscope', 'fire-confirm'), action('cancel-attack', 'captainCrew.action.cancelAttack', 'sensors', 'cancel-attack'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control', 'mode')],
    };
  }
  return {
    id: 'captain-attack-wait-solution', tone: 'watch', priority: 7,
    titleKey: 'captainCrew.title.attackStation', textKey: 'captainCrew.question.waitSolution', stationHint: 'weapons',
    actions: [action('prepare-attack', 'captainCrew.action.recalculateTdc', 'weapons', 'prepare-attack'), action('hold-shadow', 'captainOrder.action.holdShadow', 'sensors', 'hold-shadow'), action('manual-control', 'captainOrder.action.manual', 'command', 'manual-control', 'mode')],
  };
}
