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
    tonnageMultiplier: Math.max(0.85, Math.min(1.18, Number(effect.tonnageMultiplier || 1))),
    moraleBonus: Number(effect.moraleBonus || 0),
    fatigueDelta: Number(effect.fatigueDelta || 0),
  };
}

function normalizeReward(reward = {}) {
  return {
    credits: Math.floor(Number(reward.credits || 0)),
    xp: Math.floor(Number(reward.xp || 0)),
    commandPoints: Math.floor(Number(reward.commandPoints || 0)),
    prestige: Math.floor(Number(reward.prestige || 0)),
  };
}

export function findCommandAdvancementDeckForNation(items = [], nationId = '') {
  return (items || []).find((item) => item.nationId === nationId) || null;
}

export function getCommandAdvancementClaimedIds(save = {}) {
  const nested = Array.isArray(save?.career?.commandAdvancement?.claimedIds) ? save.career.commandAdvancement.claimedIds : [];
  const legacy = Array.isArray(save?.career?.promotionsClaimed) ? save.career.promotionsClaimed : [];
  return [...new Set([...nested, ...legacy].filter((id) => typeof id === 'string' && id.trim()))];
}

function requirementState(rank = {}, context = {}) {
  const requires = rank.requires || {};
  const progress = context.progress || { completed: 0 };
  const career = context.career || {};
  const strategy = context.strategySnapshot || {};
  const awardedHonorIds = context.awardedHonorIds || [];
  const completedStepIds = new Set(context.completedStepIds || []);
  const chosenOutcomeIds = new Set(context.chosenOutcomeIds || []);

  if (Number.isFinite(Number(requires.reputationMin)) && Number(career.reputation || 0) < Number(requires.reputationMin)) {
    return { ok: false, reason: 'commandAdvancement.lockedReputation', count: Number(requires.reputationMin) };
  }
  if (Number.isFinite(Number(requires.prestigeMin)) && Number(career.prestige || 0) < Number(requires.prestigeMin)) {
    return { ok: false, reason: 'commandAdvancement.lockedPrestige', count: Number(requires.prestigeMin) };
  }
  if (Number.isFinite(Number(requires.completedMissions)) && Number(progress.completed || 0) < Number(requires.completedMissions)) {
    return { ok: false, reason: 'commandAdvancement.lockedMissions', count: Number(requires.completedMissions) };
  }
  if (Number.isFinite(Number(requires.tonnageMin)) && Number(career.tonnage || 0) < Number(requires.tonnageMin)) {
    return { ok: false, reason: 'commandAdvancement.lockedTonnage', count: Number(requires.tonnageMin) };
  }
  if (Number.isFinite(Number(requires.awardedHonors)) && awardedHonorIds.length < Number(requires.awardedHonors)) {
    return { ok: false, reason: 'commandAdvancement.lockedHonors', count: Number(requires.awardedHonors) };
  }
  if (Number.isFinite(Number(requires.intelMin)) && Number(strategy.intelLevel || 0) < Number(requires.intelMin)) {
    return { ok: false, reason: 'commandAdvancement.lockedIntel', count: Number(requires.intelMin) };
  }
  if (requires.completedStepId && !completedStepIds.has(requires.completedStepId)) {
    return { ok: false, reason: 'commandAdvancement.lockedChain' };
  }
  if (requires.chosenOutcomeId && !chosenOutcomeIds.has(requires.chosenOutcomeId)) {
    return { ok: false, reason: 'commandAdvancement.lockedOutcome' };
  }
  return { ok: true, reason: '' };
}

export function summarizeCommandAdvancement({ deck, campaign, completedMissionIds = [], claimedIds = [], career = {}, strategySnapshot = {}, awardedHonorIds = [], completedStepIds = [], chosenOutcomeIds = [] } = {}) {
  if (!deck) return null;
  const progress = missionProgress(campaign, completedMissionIds);
  const claimed = new Set(claimedIds || []);
  const currentRankIndex = Math.floor(Number(career.rankIndex || 0));
  const ranks = (deck.ranks || []).map((rank) => {
    const requirement = requirementState(rank, { progress, career, strategySnapshot, awardedHonorIds, completedStepIds, chosenOutcomeIds });
    const reward = normalizeReward(rank.reward);
    const effect = normalizeEffect(rank.effect);
    const rankIndex = Math.floor(Number(rank.rankIndex || 0));
    const reached = currentRankIndex >= rankIndex;
    const claimedRank = claimed.has(rank.id);
    return {
      ...rank,
      rankIndex,
      reward,
      effect,
      reached,
      claimed: claimedRank,
      unlocked: reached && requirement.ok,
      lockedReason: reached ? requirement.reason : 'commandAdvancement.lockedRank',
      lockCount: reached ? requirement.count : rankIndex,
      tone: rank.tone || (rankIndex >= 5 ? 'legendary' : 'command'),
    };
  });
  const claimedRanks = ranks.filter((rank) => rank.claimed);
  const combinedEffect = claimedRanks.reduce((acc, rank) => {
    acc.intelBonus += rank.effect.intelBonus;
    acc.decryptionBonus += rank.effect.decryptionBonus;
    acc.pressureRelief += rank.effect.pressureRelief;
    acc.riskDelta += rank.effect.riskDelta;
    acc.readinessBonus += rank.effect.readinessBonus;
    acc.tonnageMultiplier *= rank.effect.tonnageMultiplier;
    acc.moraleBonus += rank.effect.moraleBonus;
    acc.fatigueDelta += rank.effect.fatigueDelta;
    return acc;
  }, { intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, riskDelta: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 });
  combinedEffect.tonnageMultiplier = Math.max(0.85, Math.min(1.65, combinedEffect.tonnageMultiplier));
  const availableCount = ranks.filter((rank) => rank.unlocked && !rank.claimed).length;
  const authorityScore = clampNumber((currentRankIndex * 14) + (claimedRanks.length * 10) + Math.min(30, Number(career.prestige || 0) * 0.4) + Math.min(18, awardedHonorIds.length * 5), 0, 100, 0);
  const nextRank = ranks.find((rank) => !rank.claimed) || ranks[ranks.length - 1] || null;
  return {
    id: deck.id,
    nationId: deck.nationId,
    titleKey: deck.titleKey,
    summaryKey: deck.summaryKey,
    frontKey: deck.frontKey,
    progress,
    ranks,
    claimedRanks,
    claimedCount: claimedRanks.length,
    availableCount,
    currentRankIndex,
    totalRanks: ranks.length,
    authorityScore: Math.round(authorityScore),
    nextRank,
    combinedEffect,
  };
}

export function canClaimCommandPromotion({ save, rank, summary } = {}) {
  if (!save || !rank || !summary) return { ok: false, reason: 'commandAdvancement.unavailable' };
  const claimed = new Set(getCommandAdvancementClaimedIds(save));
  if (claimed.has(rank.id)) return { ok: false, reason: 'commandAdvancement.alreadyClaimed' };
  if (!rank.unlocked) return { ok: false, reason: rank.lockedReason || 'commandAdvancement.locked' };
  return { ok: true, reason: '' };
}
