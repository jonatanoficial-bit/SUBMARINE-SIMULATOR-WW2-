function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

const DEFAULT_MODIFIERS = Object.freeze({
  fuelMultiplier: 1,
  torpedoMultiplier: 1,
  readinessBonus: 0,
  moraleDelta: 0,
  stealthBonus: 0,
  tonnageMultiplier: 1,
  intelGain: 0,
  pressureDelta: 0,
  riskDelta: 0,
  opportunityBonus: 0,
});

export function normalizeDoctrineModifiers(doctrine = null) {
  const source = doctrine?.modifiers || {};
  return {
    fuelMultiplier: clamp(source.fuelMultiplier ?? DEFAULT_MODIFIERS.fuelMultiplier, 0.72, 1.35),
    torpedoMultiplier: clamp(source.torpedoMultiplier ?? DEFAULT_MODIFIERS.torpedoMultiplier, 0.72, 1.35),
    readinessBonus: Math.round(clamp(source.readinessBonus ?? DEFAULT_MODIFIERS.readinessBonus, -15, 18)),
    moraleDelta: Math.round(clamp(source.moraleDelta ?? DEFAULT_MODIFIERS.moraleDelta, -8, 8)),
    stealthBonus: Math.round(clamp(source.stealthBonus ?? DEFAULT_MODIFIERS.stealthBonus, -12, 18)),
    tonnageMultiplier: clamp(source.tonnageMultiplier ?? DEFAULT_MODIFIERS.tonnageMultiplier, 0.75, 1.35),
    intelGain: Math.round(clamp(source.intelGain ?? DEFAULT_MODIFIERS.intelGain, -4, 8)),
    pressureDelta: Math.round(clamp(source.pressureDelta ?? DEFAULT_MODIFIERS.pressureDelta, -8, 8)),
    riskDelta: Math.round(clamp(source.riskDelta ?? DEFAULT_MODIFIERS.riskDelta, -12, 12)),
    opportunityBonus: Math.round(clamp(source.opportunityBonus ?? DEFAULT_MODIFIERS.opportunityBonus, -10, 12)),
  };
}

export function findDoctrineForNation(doctrines = [], nationId = '') {
  return (Array.isArray(doctrines) ? doctrines : []).find((doctrine) => doctrine?.nationId === nationId) || null;
}

export function countCompletedCampaignMissions(campaign = null, completedMissions = []) {
  const completed = new Set(Array.isArray(completedMissions) ? completedMissions : []);
  return (campaign?.missionIds || []).filter((missionId) => completed.has(missionId)).length;
}

export function resolveDoctrineStage(doctrine = null, campaign = null, completedMissions = []) {
  const completed = countCompletedCampaignMissions(campaign, completedMissions);
  const stages = Array.isArray(doctrine?.stages) ? [...doctrine.stages] : [];
  if (!stages.length) return { completed, stage: null, index: -1 };
  stages.sort((a, b) => Number(a.threshold || 0) - Number(b.threshold || 0));
  let index = 0;
  stages.forEach((stage, stageIndex) => {
    if (completed >= Number(stage.threshold || 0)) index = stageIndex;
  });
  return { completed, stage: stages[index], index };
}

export function applyDoctrineToPatrolCost(costs = {}, doctrine = null) {
  const modifiers = normalizeDoctrineModifiers(doctrine);
  return {
    fuel: Math.max(0, Math.ceil((Number(costs.fuel) || 0) * modifiers.fuelMultiplier)),
    torpedoes: Math.max(0, Math.ceil((Number(costs.torpedoes) || 0) * modifiers.torpedoMultiplier)),
    deckAmmo: Math.max(0, Math.ceil(Number(costs.deckAmmo) || 0)),
    rations: Math.max(0, Math.ceil(Number(costs.rations) || 0)),
    spareParts: Math.max(0, Math.ceil(Number(costs.spareParts) || 0)),
  };
}

export function summarizeDoctrineImpact(doctrine = null) {
  const modifiers = normalizeDoctrineModifiers(doctrine);
  return {
    fuelPercent: Math.round((modifiers.fuelMultiplier - 1) * 100),
    torpedoPercent: Math.round((modifiers.torpedoMultiplier - 1) * 100),
    tonnagePercent: Math.round((modifiers.tonnageMultiplier - 1) * 100),
    readinessBonus: modifiers.readinessBonus,
    stealthBonus: modifiers.stealthBonus,
    intelGain: modifiers.intelGain,
    pressureDelta: modifiers.pressureDelta,
    riskDelta: modifiers.riskDelta,
    opportunityBonus: modifiers.opportunityBonus,
  };
}
