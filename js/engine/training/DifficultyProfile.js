const PROFILES = Object.freeze({
  cadet: Object.freeze({
    id: 'cadet', enemyDetectionMultiplier: 0.72, enemyDamageMultiplier: 0.68,
    sensorConfidenceMultiplier: 1.14, weaponQualityBonus: 12,
    torpedoFailureMultiplier: 0.55, resourceConsumptionMultiplier: 0.76,
    automaticHints: true, contactLabels: true, recommendedForTraining: true,
  }),
  officer: Object.freeze({
    id: 'officer', enemyDetectionMultiplier: 1, enemyDamageMultiplier: 1,
    sensorConfidenceMultiplier: 1, weaponQualityBonus: 2,
    torpedoFailureMultiplier: 0.9, resourceConsumptionMultiplier: 1,
    automaticHints: true, contactLabels: true, recommendedForTraining: false,
  }),
  simulator: Object.freeze({
    id: 'simulator', enemyDetectionMultiplier: 1.12, enemyDamageMultiplier: 1.08,
    sensorConfidenceMultiplier: 0.96, weaponQualityBonus: -3,
    torpedoFailureMultiplier: 1.05, resourceConsumptionMultiplier: 1.06,
    automaticHints: false, contactLabels: true, recommendedForTraining: false,
  }),
  hardcore: Object.freeze({
    id: 'hardcore', enemyDetectionMultiplier: 1.28, enemyDamageMultiplier: 1.22,
    sensorConfidenceMultiplier: 0.88, weaponQualityBonus: -8,
    torpedoFailureMultiplier: 1.18, resourceConsumptionMultiplier: 1.16,
    automaticHints: false, contactLabels: false, recommendedForTraining: false,
  }),
});

export const DIFFICULTY_IDS = Object.freeze(Object.keys(PROFILES));
export const DEFAULT_DIFFICULTY_ID = 'officer';

export function normalizeDifficultyId(value) {
  return DIFFICULTY_IDS.includes(value) ? value : DEFAULT_DIFFICULTY_ID;
}

export function getDifficultyProfile(value) {
  const id = typeof value === 'object' && value ? value.id : value;
  return { ...PROFILES[normalizeDifficultyId(id)] };
}

export function difficultySummary(profile) {
  const value = getDifficultyProfile(profile);
  return {
    id: value.id,
    enemyDetectionMultiplier: value.enemyDetectionMultiplier,
    enemyDamageMultiplier: value.enemyDamageMultiplier,
    sensorConfidenceMultiplier: value.sensorConfidenceMultiplier,
    weaponQualityBonus: value.weaponQualityBonus,
    torpedoFailureMultiplier: value.torpedoFailureMultiplier,
    resourceConsumptionMultiplier: value.resourceConsumptionMultiplier,
  };
}
