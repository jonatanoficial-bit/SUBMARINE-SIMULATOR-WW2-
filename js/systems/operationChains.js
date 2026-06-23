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
    tonnageMultiplier: Math.max(0.75, Math.min(1.5, Number(effect.tonnageMultiplier || 1))),
    moraleBonus: Number(effect.moraleBonus || 0),
    fatigueDelta: Number(effect.fatigueDelta || 0),
  };
}

function requirementState(requires = {}, context = {}) {
  const completed = Number(context.progress?.completed || 0);
  const strategy = context.strategySnapshot || {};
  const completedStepIds = new Set(context.completedStepIds || []);
  const launchedOperationIds = new Set(context.launchedOperationIds || []);
  const activeEventIds = new Set(context.activeEventIds || []);

  if (Number.isFinite(Number(requires.completedMissions)) && completed < Number(requires.completedMissions)) {
    return { ok: false, reason: 'operationChains.lockedMissions', count: Number(requires.completedMissions) };
  }
  if (requires.previousStepId && !completedStepIds.has(requires.previousStepId)) {
    return { ok: false, reason: 'operationChains.lockedPrevious' };
  }
  if (requires.launchedOperationId && !launchedOperationIds.has(requires.launchedOperationId)) {
    return { ok: false, reason: 'operationChains.lockedSpecialOperation' };
  }
  if (requires.activeEventId && !activeEventIds.has(requires.activeEventId)) {
    return { ok: false, reason: 'operationChains.lockedEvent' };
  }
  if (Number.isFinite(Number(requires.pressureMin)) && Number(strategy.pressure || 0) < Number(requires.pressureMin)) {
    return { ok: false, reason: 'operationChains.lockedPressure' };
  }
  if (Number.isFinite(Number(requires.intelMin)) && Number(strategy.intelLevel || 0) < Number(requires.intelMin)) {
    return { ok: false, reason: 'operationChains.lockedIntel' };
  }
  if (Number.isFinite(Number(requires.decryptionMin)) && Number(strategy.decryption || 0) < Number(requires.decryptionMin)) {
    return { ok: false, reason: 'operationChains.lockedDecryption' };
  }
  return { ok: true, reason: '' };
}

export function findOperationChainDeckForNation(items = [], nationId = '') {
  return (items || []).find((item) => item.nationId === nationId) || null;
}

export function getOperationChainCompletedStepIds(save = {}) {
  const nested = Array.isArray(save?.strategy?.operationChains?.completedStepIds) ? save.strategy.operationChains.completedStepIds : [];
  const legacy = Array.isArray(save?.strategy?.operationChainCompleted) ? save.strategy.operationChainCompleted : [];
  return [...new Set([...nested, ...legacy].filter((id) => typeof id === 'string' && id.trim()))];
}

export function summarizeOperationChains({ deck, campaign, completedMissionIds = [], completedStepIds = [], launchedOperationIds = [], activeEventIds = [], strategySnapshot = {} } = {}) {
  if (!deck) return null;
  const progress = missionProgress(campaign, completedMissionIds);
  const completedSteps = new Set(completedStepIds || []);
  const steps = (deck.steps || []).map((step, index) => {
    const requirement = requirementState(step.requires || {}, { progress, completedStepIds, launchedOperationIds, activeEventIds, strategySnapshot });
    const effect = normalizeEffect(step.effect);
    const completed = completedSteps.has(step.id);
    const previousId = step.requires?.previousStepId || null;
    return {
      ...step,
      index,
      effect,
      completed,
      unlocked: requirement.ok,
      lockedReason: requirement.reason,
      lockCount: requirement.count,
      previousId,
      requiredMissions: Math.max(0, Number(step.requires?.completedMissions || 0)),
      tone: step.tone || (effect.riskDelta > 0 ? 'danger' : 'support'),
    };
  });
  const completedItems = steps.filter((step) => step.completed);
  const combinedEffect = completedItems.reduce((acc, step) => {
    acc.intelBonus += step.effect.intelBonus;
    acc.decryptionBonus += step.effect.decryptionBonus;
    acc.pressureRelief += step.effect.pressureRelief;
    acc.riskDelta += step.effect.riskDelta;
    acc.readinessBonus += step.effect.readinessBonus;
    acc.tonnageMultiplier *= step.effect.tonnageMultiplier;
    acc.moraleBonus += step.effect.moraleBonus;
    acc.fatigueDelta += step.effect.fatigueDelta;
    return acc;
  }, { intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, riskDelta: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 });
  combinedEffect.tonnageMultiplier = Math.max(0.7, Math.min(1.9, combinedEffect.tonnageMultiplier));
  const nextStep = steps.find((step) => step.unlocked && !step.completed) || steps.find((step) => !step.completed) || null;
  const chainPercent = steps.length ? Math.round((completedItems.length / steps.length) * 100) : 0;
  const availableCount = steps.filter((step) => step.unlocked && !step.completed).length;
  const momentum = clampNumber(
    (completedItems.length * 18) + (availableCount * 12) + Math.max(0, combinedEffect.intelBonus) + Math.max(0, combinedEffect.pressureRelief),
    0,
    100,
    0
  );
  return {
    id: deck.id,
    nationId: deck.nationId,
    titleKey: deck.titleKey,
    summaryKey: deck.summaryKey,
    frontKey: deck.frontKey,
    progress,
    steps,
    completedSteps: completedItems,
    completedCount: completedItems.length,
    totalSteps: steps.length,
    availableCount,
    nextStep,
    chainPercent,
    momentum,
    combinedEffect,
  };
}

export function canExecuteOperationChainStep({ save, step, completedMissions = 0, completedStepIds = [], launchedOperationIds = [], activeEventIds = [], strategySnapshot = {} } = {}) {
  if (!save || !step) return { ok: false, reason: 'operationChains.unavailable' };
  const completedSteps = new Set(getOperationChainCompletedStepIds(save));
  if (completedSteps.has(step.id)) return { ok: false, reason: 'operationChains.alreadyCompleted' };
  const requirement = requirementState(step.requires || {}, {
    progress: { completed: completedMissions },
    completedStepIds: [...new Set([...completedStepIds, ...completedSteps])],
    launchedOperationIds,
    activeEventIds,
    strategySnapshot,
  });
  if (!requirement.ok) return requirement;
  const cost = step.cost || {};
  if ((save.strategy?.commandPoints || 0) < (cost.commandPoints || 0)) return { ok: false, reason: 'toast.commandPointsLow' };
  if ((save.progression?.credits || 0) < (cost.credits || 0)) return { ok: false, reason: 'toast.notEnoughCredits' };
  return { ok: true, reason: '' };
}

export function previewOperationChainStepImpact(step = {}) {
  const effect = normalizeEffect(step.effect);
  return {
    ...effect,
    tonnagePercent: Math.round((effect.tonnageMultiplier - 1) * 100),
    riskTone: effect.riskDelta > 0 ? 'warn' : 'success',
    pressureValue: clampNumber(effect.pressureRelief, 0, 100, 0),
  };
}
