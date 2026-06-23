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
    tonnageMultiplier: Math.max(0.75, Math.min(1.6, Number(effect.tonnageMultiplier || 1))),
    moraleBonus: Number(effect.moraleBonus || 0),
    fatigueDelta: Number(effect.fatigueDelta || 0),
  };
}

export function findOperationOutcomeDeckForNation(items = [], nationId = '') {
  return (items || []).find((item) => item.nationId === nationId) || null;
}

export function getOperationOutcomeChosenIds(save = {}) {
  const nested = Array.isArray(save?.strategy?.operationOutcomes?.chosenIds) ? save.strategy.operationOutcomes.chosenIds : [];
  const legacy = Array.isArray(save?.strategy?.operationOutcomeChosen) ? save.strategy.operationOutcomeChosen : [];
  return [...new Set([...nested, ...legacy].filter((id) => typeof id === 'string' && id.trim()))];
}

export function getOperationOutcomeChoiceForDeck(deck = null, chosenIds = []) {
  if (!deck) return null;
  const chosen = new Set(chosenIds || []);
  return (deck.outcomes || []).find((item) => chosen.has(item.id)) || null;
}

function hasRequiredSteps(deck = null, operationChainSummary = null, completedStepIds = []) {
  const explicit = new Set(completedStepIds || []);
  const fromSummary = new Set((operationChainSummary?.completedSteps || []).map((step) => step.id));
  const all = new Set([...explicit, ...fromSummary]);
  const required = Array.isArray(deck?.requires?.stepIds) ? deck.requires.stepIds : [];
  if (required.length) return required.every((id) => all.has(id));
  return Number(operationChainSummary?.completedCount || 0) >= Number(deck?.requires?.completedSteps || operationChainSummary?.totalSteps || 4);
}

function requirementState(deck = null, context = {}) {
  const progress = context.progress || { completed: 0 };
  const requires = deck?.requires || {};
  if (Number.isFinite(Number(requires.completedMissions)) && Number(progress.completed || 0) < Number(requires.completedMissions)) {
    return { ok: false, reason: 'operationOutcomes.lockedMissions', count: Number(requires.completedMissions) };
  }
  if (Number.isFinite(Number(requires.completedSteps)) && Number(context.operationChainSummary?.completedCount || 0) < Number(requires.completedSteps)) {
    return { ok: false, reason: 'operationOutcomes.lockedChain', count: Number(requires.completedSteps) };
  }
  if (!hasRequiredSteps(deck, context.operationChainSummary, context.completedStepIds)) {
    return { ok: false, reason: 'operationOutcomes.lockedChain', count: Number(requires.completedSteps || 4) };
  }
  return { ok: true, reason: '' };
}

export function summarizeOperationOutcomes({ deck, campaign, completedMissionIds = [], chosenIds = [], operationChainSummary = null, completedStepIds = [] } = {}) {
  if (!deck) return null;
  const progress = missionProgress(campaign, completedMissionIds);
  const chosenSet = new Set(chosenIds || []);
  const chosenOutcome = getOperationOutcomeChoiceForDeck(deck, chosenIds);
  const requirement = requirementState(deck, { progress, operationChainSummary, completedStepIds });
  const alreadyChosen = Boolean(chosenOutcome);
  const outcomes = (deck.outcomes || []).map((outcome) => {
    const effect = normalizeEffect(outcome.effect);
    const chosen = chosenSet.has(outcome.id);
    return {
      ...outcome,
      effect,
      chosen,
      unlocked: requirement.ok && (!alreadyChosen || chosen),
      lockedReason: alreadyChosen && !chosen ? 'operationOutcomes.choiceLocked' : requirement.reason,
      lockCount: requirement.count,
      tone: outcome.tone || (effect.riskDelta > 0 ? 'danger' : 'support'),
    };
  });
  const combinedEffect = outcomes.filter((outcome) => outcome.chosen).reduce((acc, outcome) => {
    acc.intelBonus += outcome.effect.intelBonus;
    acc.decryptionBonus += outcome.effect.decryptionBonus;
    acc.pressureRelief += outcome.effect.pressureRelief;
    acc.riskDelta += outcome.effect.riskDelta;
    acc.readinessBonus += outcome.effect.readinessBonus;
    acc.tonnageMultiplier *= outcome.effect.tonnageMultiplier;
    acc.moraleBonus += outcome.effect.moraleBonus;
    acc.fatigueDelta += outcome.effect.fatigueDelta;
    return acc;
  }, { intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, riskDelta: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 });
  combinedEffect.tonnageMultiplier = Math.max(0.75, Math.min(1.8, combinedEffect.tonnageMultiplier));
  const chainPercent = Number(operationChainSummary?.chainPercent || 0);
  const unlocked = requirement.ok;
  const availableCount = outcomes.filter((outcome) => outcome.unlocked && !outcome.chosen).length;
  const outcomeScore = clampNumber((chainPercent * 0.55) + (progress.completed * 6) + (alreadyChosen ? 24 : 0), 0, 100, 0);
  return {
    id: deck.id,
    nationId: deck.nationId,
    titleKey: deck.titleKey,
    summaryKey: deck.summaryKey,
    frontKey: deck.frontKey,
    requires: deck.requires || {},
    progress,
    outcomes,
    chosenOutcome: chosenOutcome ? outcomes.find((item) => item.id === chosenOutcome.id) : null,
    chosenCount: outcomes.filter((outcome) => outcome.chosen).length,
    alreadyChosen,
    unlocked,
    availableCount,
    lockedReason: requirement.reason,
    lockCount: requirement.count,
    chainPercent,
    outcomeScore,
    combinedEffect,
  };
}

export function canChooseOperationOutcome({ save, outcome, summary } = {}) {
  if (!save || !outcome || !summary) return { ok: false, reason: 'operationOutcomes.unavailable' };
  const chosenIds = getOperationOutcomeChosenIds(save);
  if (chosenIds.includes(outcome.id)) return { ok: false, reason: 'operationOutcomes.alreadyChosen' };
  const deckOutcomeIds = new Set((summary.outcomes || []).map((item) => item.id));
  if (chosenIds.some((id) => deckOutcomeIds.has(id))) return { ok: false, reason: 'operationOutcomes.choiceLocked' };
  if (!summary.unlocked || !outcome.unlocked) return { ok: false, reason: outcome.lockedReason || summary.lockedReason || 'operationOutcomes.lockedChain' };
  const cost = outcome.cost || {};
  if ((save.strategy?.commandPoints || 0) < (cost.commandPoints || 0)) return { ok: false, reason: 'toast.commandPointsLow' };
  if ((save.progression?.credits || 0) < (cost.credits || 0)) return { ok: false, reason: 'toast.notEnoughCredits' };
  return { ok: true, reason: '' };
}

export function previewOperationOutcomeImpact(outcome = {}) {
  const effect = normalizeEffect(outcome.effect);
  return {
    ...effect,
    tonnagePercent: Math.round((effect.tonnageMultiplier - 1) * 100),
    pressureValue: clampNumber(effect.pressureRelief, 0, 100, 0),
    riskTone: effect.riskDelta > 0 ? 'warn' : 'success',
  };
}
