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

function normalizeReward(reward = {}) {
  return {
    credits: Math.floor(Number(reward.credits || 0)),
    xp: Math.floor(Number(reward.xp || 0)),
    commandPoints: Math.floor(Number(reward.commandPoints || 0)),
    reputation: Math.floor(Number(reward.reputation || 0)),
    prestige: Math.floor(Number(reward.prestige || 0)),
    intelBonus: Number(reward.intelBonus || 0),
    pressureRelief: Number(reward.pressureRelief || 0),
    riskDelta: Number(reward.riskDelta || 0),
    readinessBonus: Number(reward.readinessBonus || 0),
    tonnageMultiplier: Math.max(0.85, Math.min(1.25, Number(reward.tonnageMultiplier || 1))),
    moraleBonus: Number(reward.moraleBonus || 0),
    fatigueDelta: Number(reward.fatigueDelta || 0),
  };
}

export function findOperationalHonorDeckForNation(items = [], nationId = '') {
  return (items || []).find((item) => item.nationId === nationId) || null;
}

export function getOperationalHonorAwardedIds(save = {}) {
  const nested = Array.isArray(save?.career?.operationalHonors?.awardedIds) ? save.career.operationalHonors.awardedIds : [];
  const legacy = Array.isArray(save?.career?.operationalHonorAwarded) ? save.career.operationalHonorAwarded : [];
  const medals = Array.isArray(save?.career?.medals) ? save.career.medals.filter((id) => String(id).startsWith('honor:')).map((id) => String(id).slice(6)) : [];
  return [...new Set([...nested, ...legacy, ...medals].filter((id) => typeof id === 'string' && id.trim()))];
}

function requirementState(honor = {}, context = {}) {
  const requires = honor.requires || {};
  const progress = context.progress || { completed: 0 };
  const career = context.career || {};
  const strategy = context.strategySnapshot || {};
  const launchedOperationIds = new Set(context.launchedOperationIds || []);
  const completedStepIds = new Set(context.completedStepIds || []);
  const chosenOutcomeIds = new Set(context.chosenOutcomeIds || []);

  if (Number.isFinite(Number(requires.completedMissions)) && Number(progress.completed || 0) < Number(requires.completedMissions)) {
    return { ok: false, reason: 'operationalHonors.lockedMissions', count: Number(requires.completedMissions) };
  }
  if (Number.isFinite(Number(requires.tonnageMin)) && Number(career.tonnage || 0) < Number(requires.tonnageMin)) {
    return { ok: false, reason: 'operationalHonors.lockedTonnage', count: Number(requires.tonnageMin) };
  }
  if (Number.isFinite(Number(requires.reputationMin)) && Number(career.reputation || 0) < Number(requires.reputationMin)) {
    return { ok: false, reason: 'operationalHonors.lockedReputation', count: Number(requires.reputationMin) };
  }
  if (Number.isFinite(Number(requires.prestigeMin)) && Number(career.prestige || 0) < Number(requires.prestigeMin)) {
    return { ok: false, reason: 'operationalHonors.lockedPrestige', count: Number(requires.prestigeMin) };
  }
  if (Number.isFinite(Number(requires.intelMin)) && Number(strategy.intelLevel || 0) < Number(requires.intelMin)) {
    return { ok: false, reason: 'operationalHonors.lockedIntel', count: Number(requires.intelMin) };
  }
  if (requires.launchedOperationId && !launchedOperationIds.has(requires.launchedOperationId)) {
    return { ok: false, reason: 'operationalHonors.lockedOperation' };
  }
  if (requires.completedStepId && !completedStepIds.has(requires.completedStepId)) {
    return { ok: false, reason: 'operationalHonors.lockedChain' };
  }
  if (requires.chosenOutcomeId && !chosenOutcomeIds.has(requires.chosenOutcomeId)) {
    return { ok: false, reason: 'operationalHonors.lockedOutcome' };
  }
  return { ok: true, reason: '' };
}

export function summarizeOperationalHonors({ deck, campaign, completedMissionIds = [], awardedIds = [], career = {}, strategySnapshot = {}, launchedOperationIds = [], completedStepIds = [], chosenOutcomeIds = [] } = {}) {
  if (!deck) return null;
  const progress = missionProgress(campaign, completedMissionIds);
  const awarded = new Set(awardedIds || []);
  const honors = (deck.honors || []).map((honor) => {
    const requirement = requirementState(honor, { progress, career, strategySnapshot, launchedOperationIds, completedStepIds, chosenOutcomeIds });
    const reward = normalizeReward(honor.reward);
    const isAwarded = awarded.has(honor.id);
    return {
      ...honor,
      reward,
      awarded: isAwarded,
      unlocked: requirement.ok,
      lockedReason: requirement.reason,
      lockCount: requirement.count,
      tone: honor.tone || (Number(honor.tier || 1) >= 4 ? 'legendary' : 'combat'),
    };
  });
  const awardedHonors = honors.filter((honor) => honor.awarded);
  const combinedEffect = awardedHonors.reduce((acc, honor) => {
    acc.intelBonus += honor.reward.intelBonus;
    acc.pressureRelief += honor.reward.pressureRelief;
    acc.riskDelta += honor.reward.riskDelta;
    acc.readinessBonus += honor.reward.readinessBonus;
    acc.tonnageMultiplier *= honor.reward.tonnageMultiplier;
    acc.moraleBonus += honor.reward.moraleBonus;
    acc.fatigueDelta += honor.reward.fatigueDelta;
    return acc;
  }, { intelBonus: 0, pressureRelief: 0, riskDelta: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 });
  combinedEffect.tonnageMultiplier = Math.max(0.85, Math.min(1.55, combinedEffect.tonnageMultiplier));
  const availableCount = honors.filter((honor) => honor.unlocked && !honor.awarded).length;
  const medalScore = clampNumber((awardedHonors.length * 16) + (availableCount * 10) + Math.min(40, Number(career.reputation || 0) * 0.35) + Math.min(24, Number(career.prestige || 0) * 0.35), 0, 100, 0);
  return {
    id: deck.id,
    nationId: deck.nationId,
    titleKey: deck.titleKey,
    summaryKey: deck.summaryKey,
    frontKey: deck.frontKey,
    progress,
    honors,
    awardedHonors,
    awardedCount: awardedHonors.length,
    availableCount,
    totalHonors: honors.length,
    medalScore: Math.round(medalScore),
    combinedEffect,
  };
}

export function canAwardOperationalHonor({ save, honor, summary } = {}) {
  if (!save || !honor || !summary) return { ok: false, reason: 'operationalHonors.unavailable' };
  const awarded = new Set(getOperationalHonorAwardedIds(save));
  if (awarded.has(honor.id)) return { ok: false, reason: 'operationalHonors.alreadyAwarded' };
  if (!honor.unlocked) return { ok: false, reason: honor.lockedReason || 'operationalHonors.locked' };
  return { ok: true, reason: '' };
}

export function previewOperationalHonorReward(honor = {}) {
  const reward = normalizeReward(honor.reward);
  return {
    ...reward,
    tonnagePercent: Math.round((reward.tonnageMultiplier - 1) * 100),
    riskTone: reward.riskDelta > 0 ? 'warn' : 'success',
  };
}
