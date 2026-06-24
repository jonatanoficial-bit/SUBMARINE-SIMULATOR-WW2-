function clampNumber(value, min = 0, max = 100, fallback = 0) {
  const numeric = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : fallback));
}

function normalizeCost(cost = {}) {
  return {
    credits: Math.max(0, Math.floor(Number(cost.credits || 0))),
    commandPoints: Math.max(0, Math.floor(Number(cost.commandPoints || 0))),
  };
}

function normalizeEffect(effect = {}) {
  return {
    readinessBonus: Number(effect.readinessBonus || 0),
    moraleBonus: Number(effect.moraleBonus || 0),
    fatigueDelta: Number(effect.fatigueDelta || 0),
    sonarBonus: Number(effect.sonarBonus || 0),
    engineeringBonus: Number(effect.engineeringBonus || 0),
    torpedoBonus: Number(effect.torpedoBonus || 0),
    stealthBonus: Number(effect.stealthBonus || 0),
    intelBonus: Number(effect.intelBonus || 0),
    decryptionBonus: Number(effect.decryptionBonus || 0),
    pressureRelief: Number(effect.pressureRelief || 0),
    riskDelta: Number(effect.riskDelta || 0),
    tonnageMultiplier: Math.max(0.85, Math.min(1.2, Number(effect.tonnageMultiplier || 1))),
  };
}

function missionProgress(campaign, completedMissionIds = []) {
  const completed = new Set(completedMissionIds || []);
  const missionIds = Array.isArray(campaign?.missionIds) ? campaign.missionIds : [];
  return {
    total: missionIds.length,
    completed: missionIds.filter((missionId) => completed.has(missionId)).length,
  };
}

export function findCrewDrillDeckForNation(items = [], nationId = '') {
  return (items || []).find((item) => item.nationId === nationId) || null;
}

export function getCrewDrillCompletedIds(save = {}) {
  const nested = Array.isArray(save?.career?.crewDrills?.completedIds) ? save.career.crewDrills.completedIds : [];
  const legacy = Array.isArray(save?.career?.completedCrewDrills) ? save.career.completedCrewDrills : [];
  return [...new Set([...nested, ...legacy].filter((id) => typeof id === 'string' && id.trim()))];
}

function requirementState(drill = {}, context = {}) {
  const requires = drill.requires || {};
  const progress = context.progress || { completed: 0 };
  const completedIds = context.completedIds || [];
  const assignedOfficerIds = context.assignedOfficerIds || [];
  const readiness = Number(context.readiness?.readiness ?? context.readiness?.overall ?? context.readiness ?? 0);
  if (Number.isFinite(Number(requires.completedMissions)) && Number(progress.completed || 0) < Number(requires.completedMissions)) {
    return { ok: false, reason: 'crewDrills.lockedMissions', count: Number(requires.completedMissions) };
  }
  if (Number.isFinite(Number(requires.assignedOfficers)) && assignedOfficerIds.length < Number(requires.assignedOfficers)) {
    return { ok: false, reason: 'crewDrills.lockedOfficers', count: Number(requires.assignedOfficers) };
  }
  if (Number.isFinite(Number(requires.readinessMin)) && readiness < Number(requires.readinessMin)) {
    return { ok: false, reason: 'crewDrills.lockedReadiness', count: Number(requires.readinessMin) };
  }
  if (requires.completedDrillId && !completedIds.includes(requires.completedDrillId)) {
    return { ok: false, reason: 'crewDrills.lockedPrevious', count: 1 };
  }
  return { ok: true, reason: '' };
}

export function summarizeCrewDrills({ deck, campaign, completedMissionIds = [], completedIds = [], assignedOfficerIds = [], readiness = {} } = {}) {
  if (!deck) return null;
  const progress = missionProgress(campaign, completedMissionIds);
  const completed = new Set(completedIds || []);
  const drills = (deck.drills || []).map((drill) => {
    const requirement = requirementState(drill, { progress, completedIds, assignedOfficerIds, readiness });
    const completedDrill = completed.has(drill.id);
    return {
      ...drill,
      tier: Math.floor(Number(drill.tier || 1)),
      cost: normalizeCost(drill.cost),
      effect: normalizeEffect(drill.effect),
      completed: completedDrill,
      unlocked: requirement.ok,
      lockedReason: requirement.reason,
      lockCount: requirement.count,
      tone: drill.tone || 'watch',
    };
  });
  const completedDrills = drills.filter((drill) => drill.completed);
  const combinedEffect = completedDrills.reduce((acc, drill) => {
    acc.readinessBonus += drill.effect.readinessBonus;
    acc.moraleBonus += drill.effect.moraleBonus;
    acc.fatigueDelta += drill.effect.fatigueDelta;
    acc.sonarBonus += drill.effect.sonarBonus;
    acc.engineeringBonus += drill.effect.engineeringBonus;
    acc.torpedoBonus += drill.effect.torpedoBonus;
    acc.stealthBonus += drill.effect.stealthBonus;
    acc.intelBonus += drill.effect.intelBonus;
    acc.decryptionBonus += drill.effect.decryptionBonus;
    acc.pressureRelief += drill.effect.pressureRelief;
    acc.riskDelta += drill.effect.riskDelta;
    acc.tonnageMultiplier *= drill.effect.tonnageMultiplier;
    return acc;
  }, { readinessBonus: 0, moraleBonus: 0, fatigueDelta: 0, sonarBonus: 0, engineeringBonus: 0, torpedoBonus: 0, stealthBonus: 0, intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, riskDelta: 0, tonnageMultiplier: 1 });
  combinedEffect.tonnageMultiplier = Math.max(0.85, Math.min(1.75, combinedEffect.tonnageMultiplier));
  const availableCount = drills.filter((drill) => drill.unlocked && !drill.completed).length;
  const disciplineScore = clampNumber((completedDrills.length * 20) + Math.min(24, assignedOfficerIds.length * 6) + Math.min(20, Number(readiness?.readiness ?? readiness?.overall ?? 0) * 0.18), 0, 100, 0);
  return {
    id: deck.id,
    nationId: deck.nationId,
    titleKey: deck.titleKey,
    summaryKey: deck.summaryKey,
    frontKey: deck.frontKey,
    drills,
    completedDrills,
    completedCount: completedDrills.length,
    availableCount,
    totalDrills: drills.length,
    disciplineScore: Math.round(disciplineScore),
    combinedEffect,
  };
}

export function canRunCrewDrill({ save, drill, summary } = {}) {
  if (!save || !drill || !summary) return { ok: false, reason: 'crewDrills.unavailable' };
  const completed = new Set(getCrewDrillCompletedIds(save));
  if (completed.has(drill.id)) return { ok: false, reason: 'crewDrills.alreadyCompleted' };
  if (!drill.unlocked) return { ok: false, reason: drill.lockedReason || 'crewDrills.locked' };
  const credits = Number(save?.progression?.credits || 0);
  const commandPoints = Number(save?.strategy?.commandPoints || 0);
  if (credits < Number(drill.cost?.credits || 0) || commandPoints < Number(drill.cost?.commandPoints || 0)) {
    return { ok: false, reason: 'crewDrills.insufficientResources' };
  }
  return { ok: true, reason: '' };
}
