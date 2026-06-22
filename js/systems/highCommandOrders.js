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
    pressureRelief: Number(effect.pressureRelief || 0),
    riskDelta: Number(effect.riskDelta || 0),
    readinessBonus: Number(effect.readinessBonus || 0),
    tonnageMultiplier: Math.max(0.8, Math.min(1.35, Number(effect.tonnageMultiplier || 1))),
    moraleBonus: Number(effect.moraleBonus || 0),
    fatigueDelta: Number(effect.fatigueDelta || 0),
  };
}

export function findHighCommandDeckForNation(items = [], nationId = '') {
  return (items || []).find((item) => item.nationId === nationId) || null;
}

export function getHighCommandAppliedIds(save = {}) {
  const legacy = Array.isArray(save?.strategy?.highCommandApplied) ? save.strategy.highCommandApplied : [];
  const nested = Array.isArray(save?.strategy?.highCommandOrders?.appliedIds) ? save.strategy.highCommandOrders.appliedIds : [];
  return [...new Set([...legacy, ...nested].filter((id) => typeof id === 'string' && id.trim()))];
}

export function summarizeHighCommandOrders({ deck, campaign, completedMissionIds = [], appliedOrderIds = [] } = {}) {
  if (!deck) return null;
  const progress = missionProgress(campaign, completedMissionIds);
  const applied = new Set(appliedOrderIds || []);
  const orders = (deck.orders || []).map((order) => {
    const requiredMissions = Math.max(0, Number(order.requires?.completedMissions || 0));
    const unlocked = progress.completed >= requiredMissions;
    const isApplied = applied.has(order.id);
    return {
      ...order,
      effect: normalizeEffect(order.effect),
      requiredMissions,
      unlocked,
      applied: isApplied,
      lockedReason: unlocked ? '' : 'highCommand.lockedMissions',
    };
  });
  const activeOrders = orders.filter((order) => order.applied);
  const combinedEffect = activeOrders.reduce((acc, order) => {
    acc.intelBonus += order.effect.intelBonus;
    acc.decryptionBonus += order.effect.decryptionBonus;
    acc.pressureRelief += order.effect.pressureRelief;
    acc.riskDelta += order.effect.riskDelta;
    acc.readinessBonus += order.effect.readinessBonus;
    acc.tonnageMultiplier *= order.effect.tonnageMultiplier;
    acc.moraleBonus += order.effect.moraleBonus;
    acc.fatigueDelta += order.effect.fatigueDelta;
    return acc;
  }, { intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, riskDelta: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 });
  combinedEffect.tonnageMultiplier = Math.max(0.75, Math.min(1.65, combinedEffect.tonnageMultiplier));
  return {
    id: deck.id,
    nationId: deck.nationId,
    titleKey: deck.titleKey,
    summaryKey: deck.summaryKey,
    progress,
    orders,
    activeCount: activeOrders.length,
    availableCount: orders.filter((order) => order.unlocked && !order.applied).length,
    combinedEffect,
  };
}

export function canApplyHighCommandOrder({ save, order, completedMissions = 0 } = {}) {
  if (!save || !order) return { ok: false, reason: 'highCommand.unavailable' };
  const applied = new Set(getHighCommandAppliedIds(save));
  if (applied.has(order.id)) return { ok: false, reason: 'highCommand.alreadyApplied' };
  const requiredMissions = Math.max(0, Number(order.requires?.completedMissions || 0));
  if (completedMissions < requiredMissions) return { ok: false, reason: 'highCommand.lockedMissions' };
  const cost = order.cost || {};
  if ((save.strategy?.commandPoints || 0) < (cost.commandPoints || 0)) return { ok: false, reason: 'toast.commandPointsLow' };
  if ((save.progression?.credits || 0) < (cost.credits || 0)) return { ok: false, reason: 'toast.notEnoughCredits' };
  return { ok: true, reason: '' };
}

export function previewHighCommandOrderImpact(order = {}) {
  const effect = normalizeEffect(order.effect);
  return {
    ...effect,
    tonnagePercent: Math.round((effect.tonnageMultiplier - 1) * 100),
    riskTone: effect.riskDelta > 0 ? 'warn' : 'success',
    readinessTone: effect.readinessBonus >= 0 ? 'success' : 'warn',
    pressureValue: clampNumber(effect.pressureRelief, 0, 100, 0),
  };
}
