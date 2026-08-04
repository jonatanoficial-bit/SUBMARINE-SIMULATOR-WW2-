export const COMBAT_FEEDBACK_VERSION = Object.freeze({
  phase: 56,
  version: '2.2.0',
  system: 'immersive-combat-feedback',
});

const FAILURE_KEYS = Object.freeze({
  dud: 'dud',
  depthKeeping: 'depthKeeping',
  premature: 'premature',
  miss: 'miss',
});

export function buildTorpedoRunFeedback(snapshot = {}) {
  const shots = Array.isArray(snapshot.weapons?.activeShots) ? snapshot.weapons.activeShots : [];
  const remainingMs = shots.length ? Math.max(...shots.map((shot) => Number(shot.remainingMs || 0))) : 0;
  const travelMs = shots.length ? Math.max(...shots.map((shot) => Number(shot.travelMs || shot.remainingMs || 1))) : 1;
  const progress = shots.length ? Math.max(0, Math.min(100, Math.round((1 - remainingMs / Math.max(1, travelMs)) * 100))) : 0;
  return {
    active: Boolean(snapshot.torpedoActive && shots.length),
    shotCount: shots.length,
    remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
    progress,
  };
}

export function buildTorpedoOutcomeFeedback(event = {}) {
  const hit = Boolean(event.hit);
  const role = event.targetRole === 'escort' ? 'escort' : 'target';
  const failure = FAILURE_KEYS[event.outcome] || 'miss';
  const key = hit ? (role === 'escort' ? 'hitEscort' : 'hitTarget') : failure;
  return {
    hit,
    role,
    outcome: hit ? 'hit' : failure,
    titleKey: `combatFeedback.title.${key}`,
    summaryKey: `combatFeedback.summary.${key}`,
    consequenceKey: `combatFeedback.consequence.${key}`,
    voiceKey: `combatFeedback.voice.${key}`,
    primaryKey: hit ? 'combatFeedback.action.evade' : 'combatFeedback.action.retry',
    shipAsset: role === 'escort' ? 'assets/ships/destroyer_01.png' : 'assets/ships/merchant_ship_01.png',
    markerState: hit ? 'eliminated' : 'active',
  };
}
