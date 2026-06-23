function clampNumber(value, min = 0, max = 100, fallback = 0) {
  const numeric = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : fallback));
}

function missionProgress(campaign, completedMissionIds = []) {
  const completed = new Set(completedMissionIds || []);
  const missionIds = Array.isArray(campaign?.missionIds) ? campaign.missionIds : [];
  return {
    total: missionIds.length,
    completed: missionIds.filter((missionId) => completed.has(missionId)).length,
  };
}

function normalizeEffect(effect = {}) {
  return {
    intelBonus: Number(effect.intelBonus || 0),
    decryptionBonus: Number(effect.decryptionBonus || 0),
    pressureDelta: Number(effect.pressureDelta || 0),
    riskDelta: Number(effect.riskDelta || 0),
    readinessBonus: Number(effect.readinessBonus || 0),
    tonnageMultiplier: Math.max(0.75, Math.min(1.35, Number(effect.tonnageMultiplier || 1))),
    moraleDelta: Number(effect.moraleDelta || 0),
    fatigueDelta: Number(effect.fatigueDelta || 0),
  };
}

function matchTrigger(trigger = {}, context = {}) {
  const completed = Number(context.progress?.completed || 0);
  const strategy = context.strategySnapshot || {};
  const activeOrderIds = new Set(context.activeOrderIds || []);

  if (Number.isFinite(Number(trigger.completedMissionsMin)) && completed < Number(trigger.completedMissionsMin)) return false;
  if (Number.isFinite(Number(trigger.completedMissionsMax)) && completed > Number(trigger.completedMissionsMax)) return false;
  if (Number.isFinite(Number(trigger.pressureMin)) && Number(strategy.pressure || 0) < Number(trigger.pressureMin)) return false;
  if (Number.isFinite(Number(trigger.pressureMax)) && Number(strategy.pressure || 0) > Number(trigger.pressureMax)) return false;
  if (Number.isFinite(Number(trigger.intelMin)) && Number(strategy.intelLevel || 0) < Number(trigger.intelMin)) return false;
  if (Number.isFinite(Number(trigger.decryptionMin)) && Number(strategy.decryption || 0) < Number(trigger.decryptionMin)) return false;
  if (trigger.activeOrderId && !activeOrderIds.has(trigger.activeOrderId)) return false;
  return true;
}

export function findCampaignEventDeckForNation(items = [], nationId = '') {
  return (items || []).find((item) => item.nationId === nationId) || null;
}

export function getCampaignEventAcknowledgedIds(save = {}) {
  const strategyEvents = save?.strategy?.campaignEvents;
  const acknowledged = Array.isArray(strategyEvents?.acknowledgedIds) ? strategyEvents.acknowledgedIds : [];
  const legacy = Array.isArray(save?.strategy?.campaignEventAcknowledged) ? save.strategy.campaignEventAcknowledged : [];
  return [...new Set([...acknowledged, ...legacy].filter((id) => typeof id === 'string' && id.trim()))];
}

export function summarizeCampaignEvents({ deck, campaign, completedMissionIds = [], strategySnapshot = {}, activeOrderIds = [], acknowledgedIds = [] } = {}) {
  if (!deck) return null;
  const progress = missionProgress(campaign, completedMissionIds);
  const acknowledged = new Set(acknowledgedIds || []);
  const events = (deck.events || []).map((event) => {
    const effect = normalizeEffect(event.effect);
    const active = matchTrigger(event.trigger || {}, { progress, strategySnapshot, activeOrderIds });
    return {
      ...event,
      effect,
      active,
      acknowledged: acknowledged.has(event.id),
      tone: event.severity || (effect.riskDelta > 0 || effect.pressureDelta > 0 ? 'warning' : 'opportunity'),
    };
  });
  const activeEvents = events.filter((event) => event.active);
  const combinedEffect = activeEvents.reduce((acc, event) => {
    acc.intelBonus += event.effect.intelBonus;
    acc.decryptionBonus += event.effect.decryptionBonus;
    acc.pressureDelta += event.effect.pressureDelta;
    acc.riskDelta += event.effect.riskDelta;
    acc.readinessBonus += event.effect.readinessBonus;
    acc.tonnageMultiplier *= event.effect.tonnageMultiplier;
    acc.moraleDelta += event.effect.moraleDelta;
    acc.fatigueDelta += event.effect.fatigueDelta;
    return acc;
  }, { intelBonus: 0, decryptionBonus: 0, pressureDelta: 0, riskDelta: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleDelta: 0, fatigueDelta: 0 });
  combinedEffect.tonnageMultiplier = Math.max(0.65, Math.min(1.7, combinedEffect.tonnageMultiplier));
  const volatility = clampNumber(
    activeEvents.reduce((acc, event) => acc + Math.abs(event.effect.riskDelta) + Math.abs(event.effect.pressureDelta) + Math.abs((event.effect.tonnageMultiplier - 1) * 40), 0),
    0,
    100,
    0
  );
  return {
    id: deck.id,
    nationId: deck.nationId,
    titleKey: deck.titleKey,
    summaryKey: deck.summaryKey,
    progress,
    events,
    activeEvents,
    activeCount: activeEvents.length,
    unacknowledgedCount: activeEvents.filter((event) => !event.acknowledged).length,
    combinedEffect,
    volatility,
  };
}

export function canAcknowledgeCampaignEvent({ save, event } = {}) {
  if (!save || !event) return { ok: false, reason: 'campaignEvents.unavailable' };
  const acknowledged = new Set(getCampaignEventAcknowledgedIds(save));
  if (acknowledged.has(event.id)) return { ok: false, reason: 'campaignEvents.alreadyAcknowledged' };
  if (!event.active) return { ok: false, reason: 'campaignEvents.inactive' };
  return { ok: true, reason: '' };
}
