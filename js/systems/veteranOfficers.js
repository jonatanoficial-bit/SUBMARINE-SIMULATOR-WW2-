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
    tonnageMultiplier: Math.max(0.85, Math.min(1.2, Number(effect.tonnageMultiplier || 1))),
    moraleBonus: Number(effect.moraleBonus || 0),
    fatigueDelta: Number(effect.fatigueDelta || 0),
    sonarBonus: Number(effect.sonarBonus || 0),
    engineeringBonus: Number(effect.engineeringBonus || 0),
    torpedoBonus: Number(effect.torpedoBonus || 0),
    stealthBonus: Number(effect.stealthBonus || 0),
  };
}

function normalizeCost(cost = {}) {
  return {
    credits: Math.max(0, Math.floor(Number(cost.credits || 0))),
    commandPoints: Math.max(0, Math.floor(Number(cost.commandPoints || 0))),
  };
}

export function findVeteranOfficerDeckForNation(items = [], nationId = '') {
  return (items || []).find((item) => item.nationId === nationId) || null;
}

export function getVeteranOfficerAssignedIds(save = {}) {
  const nested = Array.isArray(save?.career?.veteranOfficers?.assignedIds) ? save.career.veteranOfficers.assignedIds : [];
  const legacy = Array.isArray(save?.career?.officersAssigned) ? save.career.officersAssigned : [];
  return [...new Set([...nested, ...legacy].filter((id) => typeof id === 'string' && id.trim()))];
}

function requirementState(officer = {}, context = {}) {
  const requires = officer.requires || {};
  const progress = context.progress || { completed: 0 };
  const career = context.career || {};
  const awardedHonorIds = context.awardedHonorIds || [];
  const claimedPromotionIds = context.claimedPromotionIds || [];
  if (Number.isFinite(Number(requires.completedMissions)) && Number(progress.completed || 0) < Number(requires.completedMissions)) {
    return { ok: false, reason: 'veteranOfficers.lockedMissions', count: Number(requires.completedMissions) };
  }
  if (Number.isFinite(Number(requires.reputationMin)) && Number(career.reputation || 0) < Number(requires.reputationMin)) {
    return { ok: false, reason: 'veteranOfficers.lockedReputation', count: Number(requires.reputationMin) };
  }
  if (Number.isFinite(Number(requires.rankIndexMin)) && Number(career.rankIndex || 0) < Number(requires.rankIndexMin)) {
    return { ok: false, reason: 'veteranOfficers.lockedRank', count: Number(requires.rankIndexMin) };
  }
  if (Number.isFinite(Number(requires.awardedHonors)) && awardedHonorIds.length < Number(requires.awardedHonors)) {
    return { ok: false, reason: 'veteranOfficers.lockedHonors', count: Number(requires.awardedHonors) };
  }
  if (Number.isFinite(Number(requires.claimedPromotions)) && claimedPromotionIds.length < Number(requires.claimedPromotions)) {
    return { ok: false, reason: 'veteranOfficers.lockedPromotions', count: Number(requires.claimedPromotions) };
  }
  return { ok: true, reason: '' };
}

export function summarizeVeteranOfficers({ deck, campaign, completedMissionIds = [], assignedIds = [], career = {}, awardedHonorIds = [], claimedPromotionIds = [] } = {}) {
  if (!deck) return null;
  const progress = missionProgress(campaign, completedMissionIds);
  const assigned = new Set(assignedIds || []);
  const officers = (deck.officers || []).map((officer) => {
    const requirement = requirementState(officer, { progress, career, awardedHonorIds, claimedPromotionIds });
    const cost = normalizeCost(officer.cost);
    const effect = normalizeEffect(officer.effect);
    const assignedOfficer = assigned.has(officer.id);
    return {
      ...officer,
      tier: Math.floor(Number(officer.tier || 1)),
      cost,
      effect,
      assigned: assignedOfficer,
      unlocked: requirement.ok,
      lockedReason: requirement.reason,
      lockCount: requirement.count,
      tone: officer.tone || 'watch',
    };
  });
  const assignedOfficers = officers.filter((officer) => officer.assigned);
  const combinedEffect = assignedOfficers.reduce((acc, officer) => {
    acc.intelBonus += officer.effect.intelBonus;
    acc.decryptionBonus += officer.effect.decryptionBonus;
    acc.pressureRelief += officer.effect.pressureRelief;
    acc.riskDelta += officer.effect.riskDelta;
    acc.readinessBonus += officer.effect.readinessBonus;
    acc.tonnageMultiplier *= officer.effect.tonnageMultiplier;
    acc.moraleBonus += officer.effect.moraleBonus;
    acc.fatigueDelta += officer.effect.fatigueDelta;
    acc.sonarBonus += officer.effect.sonarBonus;
    acc.engineeringBonus += officer.effect.engineeringBonus;
    acc.torpedoBonus += officer.effect.torpedoBonus;
    acc.stealthBonus += officer.effect.stealthBonus;
    return acc;
  }, { intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, riskDelta: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0, sonarBonus: 0, engineeringBonus: 0, torpedoBonus: 0, stealthBonus: 0 });
  combinedEffect.tonnageMultiplier = Math.max(0.85, Math.min(1.75, combinedEffect.tonnageMultiplier));
  const availableCount = officers.filter((officer) => officer.unlocked && !officer.assigned).length;
  const veteranScore = clampNumber((assignedOfficers.length * 18) + Math.min(24, Number(career.reputation || 0) * 0.08) + Math.min(20, Number(career.rankIndex || 0) * 4) + Math.min(18, awardedHonorIds.length * 4), 0, 100, 0);
  return {
    id: deck.id,
    nationId: deck.nationId,
    titleKey: deck.titleKey,
    summaryKey: deck.summaryKey,
    frontKey: deck.frontKey,
    officers,
    assignedOfficers,
    assignedCount: assignedOfficers.length,
    availableCount,
    totalOfficers: officers.length,
    veteranScore: Math.round(veteranScore),
    combinedEffect,
  };
}

export function canAssignVeteranOfficer({ save, officer, summary } = {}) {
  if (!save || !officer || !summary) return { ok: false, reason: 'veteranOfficers.unavailable' };
  const assigned = new Set(getVeteranOfficerAssignedIds(save));
  if (assigned.has(officer.id)) return { ok: false, reason: 'veteranOfficers.alreadyAssigned' };
  if (!officer.unlocked) return { ok: false, reason: officer.lockedReason || 'veteranOfficers.locked' };
  const credits = Number(save?.progression?.credits || 0);
  const commandPoints = Number(save?.strategy?.commandPoints || 0);
  if (credits < Number(officer.cost?.credits || 0) || commandPoints < Number(officer.cost?.commandPoints || 0)) {
    return { ok: false, reason: 'veteranOfficers.insufficientResources' };
  }
  return { ok: true, reason: '' };
}
