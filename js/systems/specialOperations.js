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
    tonnageMultiplier: Math.max(0.75, Math.min(1.4, Number(effect.tonnageMultiplier || 1))),
    moraleBonus: Number(effect.moraleBonus || 0),
    fatigueDelta: Number(effect.fatigueDelta || 0),
  };
}

function requirementState(requires = {}, context = {}) {
  const completed = Number(context.progress?.completed || 0);
  const strategy = context.strategySnapshot || {};
  const activeEventIds = new Set(context.activeEventIds || []);
  const activeOrderIds = new Set(context.activeOrderIds || []);

  if (Number.isFinite(Number(requires.completedMissions)) && completed < Number(requires.completedMissions)) {
    return { ok: false, reason: 'specialOps.lockedMissions', count: Number(requires.completedMissions) };
  }
  if (requires.activeEventId && !activeEventIds.has(requires.activeEventId)) {
    return { ok: false, reason: 'specialOps.lockedEvent' };
  }
  if (requires.activeOrderId && !activeOrderIds.has(requires.activeOrderId)) {
    return { ok: false, reason: 'specialOps.lockedOrder' };
  }
  if (Number.isFinite(Number(requires.pressureMin)) && Number(strategy.pressure || 0) < Number(requires.pressureMin)) {
    return { ok: false, reason: 'specialOps.lockedPressure' };
  }
  if (Number.isFinite(Number(requires.intelMin)) && Number(strategy.intelLevel || 0) < Number(requires.intelMin)) {
    return { ok: false, reason: 'specialOps.lockedIntel' };
  }
  if (Number.isFinite(Number(requires.decryptionMin)) && Number(strategy.decryption || 0) < Number(requires.decryptionMin)) {
    return { ok: false, reason: 'specialOps.lockedDecryption' };
  }
  return { ok: true, reason: '' };
}

export function findSpecialOperationDeckForNation(items = [], nationId = '') {
  return (items || []).find((item) => item.nationId === nationId) || null;
}

export function getSpecialOperationLaunchedIds(save = {}) {
  const nested = Array.isArray(save?.strategy?.specialOperations?.launchedIds) ? save.strategy.specialOperations.launchedIds : [];
  const legacy = Array.isArray(save?.strategy?.specialOperationsLaunched) ? save.strategy.specialOperationsLaunched : [];
  return [...new Set([...nested, ...legacy].filter((id) => typeof id === 'string' && id.trim()))];
}

export function summarizeSpecialOperations({ deck, campaign, completedMissionIds = [], launchedIds = [], activeEventIds = [], activeOrderIds = [], strategySnapshot = {} } = {}) {
  if (!deck) return null;
  const progress = missionProgress(campaign, completedMissionIds);
  const launched = new Set(launchedIds || []);
  const operations = (deck.operations || []).map((operation) => {
    const requirement = requirementState(operation.requires || {}, { progress, activeEventIds, activeOrderIds, strategySnapshot });
    const effect = normalizeEffect(operation.effect);
    const isLaunched = launched.has(operation.id);
    return {
      ...operation,
      effect,
      requiredMissions: Math.max(0, Number(operation.requires?.completedMissions || 0)),
      unlocked: requirement.ok,
      launched: isLaunched,
      lockedReason: requirement.reason,
      lockCount: requirement.count,
      tone: operation.severity || (effect.riskDelta > 0 ? 'danger' : 'support'),
    };
  });
  const launchedOperations = operations.filter((operation) => operation.launched);
  const combinedEffect = launchedOperations.reduce((acc, operation) => {
    acc.intelBonus += operation.effect.intelBonus;
    acc.decryptionBonus += operation.effect.decryptionBonus;
    acc.pressureRelief += operation.effect.pressureRelief;
    acc.riskDelta += operation.effect.riskDelta;
    acc.readinessBonus += operation.effect.readinessBonus;
    acc.tonnageMultiplier *= operation.effect.tonnageMultiplier;
    acc.moraleBonus += operation.effect.moraleBonus;
    acc.fatigueDelta += operation.effect.fatigueDelta;
    return acc;
  }, { intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, riskDelta: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 });
  combinedEffect.tonnageMultiplier = Math.max(0.7, Math.min(1.75, combinedEffect.tonnageMultiplier));
  const availableCount = operations.filter((operation) => operation.unlocked && !operation.launched).length;
  const riskProfile = clampNumber(
    operations.filter((operation) => operation.unlocked && !operation.launched)
      .reduce((acc, operation) => acc + Math.max(0, operation.effect.riskDelta) + Math.abs((operation.effect.tonnageMultiplier - 1) * 30), 0),
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
    operations,
    launchedOperations,
    launchedCount: launchedOperations.length,
    availableCount,
    riskProfile,
    combinedEffect,
  };
}

export function canLaunchSpecialOperation({ save, operation, completedMissions = 0, activeEventIds = [], activeOrderIds = [], strategySnapshot = {} } = {}) {
  if (!save || !operation) return { ok: false, reason: 'specialOps.unavailable' };
  const launched = new Set(getSpecialOperationLaunchedIds(save));
  if (launched.has(operation.id)) return { ok: false, reason: 'specialOps.alreadyLaunched' };
  const requirement = requirementState(operation.requires || {}, {
    progress: { completed: completedMissions },
    activeEventIds,
    activeOrderIds,
    strategySnapshot,
  });
  if (!requirement.ok) return requirement;
  const cost = operation.cost || {};
  if ((save.strategy?.commandPoints || 0) < (cost.commandPoints || 0)) return { ok: false, reason: 'toast.commandPointsLow' };
  if ((save.progression?.credits || 0) < (cost.credits || 0)) return { ok: false, reason: 'toast.notEnoughCredits' };
  return { ok: true, reason: '' };
}

export function previewSpecialOperationImpact(operation = {}) {
  const effect = normalizeEffect(operation.effect);
  return {
    ...effect,
    tonnagePercent: Math.round((effect.tonnageMultiplier - 1) * 100),
    riskTone: effect.riskDelta > 0 ? 'warn' : 'success',
    readinessTone: effect.readinessBonus >= 0 ? 'success' : 'warn',
    pressureValue: clampNumber(effect.pressureRelief, 0, 100, 0),
  };
}
