export const PHASE53_CREW_PROGRESSION_IMPACT = Object.freeze({
  phase: 53,
  system: 'captain-crew-progression-impact',
  version: 'v2.0.0-alpha.69',
  doctrine: 'assistant-offers-auto-or-manual-crew-choice-and-hired-crew-affects-real-gameplay',
  mobileFullscreen: true,
  preservesExistingAssetsAndAudio: true,
  usesExistingAssetsFolder: true,
  saveSchemaStable: true,
});

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n(value)));
}

function uniqueStrings(items = []) {
  return [...new Set((Array.isArray(items) ? items : []).filter((item) => typeof item === 'string' && item.trim()))];
}

function stationFromCrew(crew = {}) {
  const role = String(crew.roleKey || '').toLowerCase();
  const bonus = String(crew.bonusKey || '').toLowerCase();
  if (role.includes('sonar') || bonus.includes('sonar') || bonus.includes('lookout')) return 'sonar';
  if (role.includes('mechanic') || bonus.includes('repair')) return 'engineering';
  if (role.includes('navigator') || bonus.includes('navigation')) return 'navigation';
  if (bonus.includes('torpedo') || bonus.includes('weapon')) return 'weapons';
  if (role.includes('lookout')) return 'stealth';
  return 'command';
}

function combinedEffectFrom(summary = null) {
  const effect = summary?.combinedEffect || {};
  return {
    readinessBonus: n(effect.readinessBonus),
    moraleBonus: n(effect.moraleBonus),
    fatigueDelta: n(effect.fatigueDelta),
    sonarBonus: n(effect.sonarBonus),
    engineeringBonus: n(effect.engineeringBonus),
    torpedoBonus: n(effect.torpedoBonus),
    stealthBonus: n(effect.stealthBonus),
    intelBonus: n(effect.intelBonus),
    decryptionBonus: n(effect.decryptionBonus),
    pressureRelief: n(effect.pressureRelief),
    riskDelta: n(effect.riskDelta),
    tonnageMultiplier: Math.max(0.85, Math.min(1.75, n(effect.tonnageMultiplier, 1))),
  };
}

function addEffects(a = {}, b = {}) {
  return {
    readinessBonus: n(a.readinessBonus) + n(b.readinessBonus),
    moraleBonus: n(a.moraleBonus) + n(b.moraleBonus),
    fatigueDelta: n(a.fatigueDelta) + n(b.fatigueDelta),
    sonarBonus: n(a.sonarBonus) + n(b.sonarBonus),
    engineeringBonus: n(a.engineeringBonus) + n(b.engineeringBonus),
    torpedoBonus: n(a.torpedoBonus) + n(b.torpedoBonus),
    stealthBonus: n(a.stealthBonus) + n(b.stealthBonus),
    intelBonus: n(a.intelBonus) + n(b.intelBonus),
    decryptionBonus: n(a.decryptionBonus) + n(b.decryptionBonus),
    pressureRelief: n(a.pressureRelief) + n(b.pressureRelief),
    riskDelta: n(a.riskDelta) + n(b.riskDelta),
    tonnageMultiplier: Math.max(0.85, Math.min(1.75, n(a.tonnageMultiplier, 1) * n(b.tonnageMultiplier, 1))),
  };
}

function scoreToLabel(score = 0) {
  const value = clamp(score);
  if (value >= 84) return 'crewImpact.tier.elite';
  if (value >= 68) return 'crewImpact.tier.veteran';
  if (value >= 48) return 'crewImpact.tier.ready';
  return 'crewImpact.tier.green';
}

function nextCrewRecommendation({ allCrew = [], hiredIds = [], ratings = {}, credits = 0 } = {}) {
  const hired = new Set(hiredIds);
  const missingStation = ['sonar', 'engineering', 'navigation', 'command', 'weapons', 'stealth']
    .sort((a, b) => n(ratings[a]) - n(ratings[b]))[0];
  const candidates = (allCrew || [])
    .filter((crew) => crew && !hired.has(crew.id))
    .map((crew) => ({ crew, station: stationFromCrew(crew), cost: n(crew.cost), skill: n(crew.skill) }))
    .sort((a, b) => (a.station === missingStation ? -1 : 1) - (b.station === missingStation ? -1 : 1) || a.cost - b.cost || b.skill - a.skill);
  const candidate = candidates[0];
  if (!candidate) return { key: 'crewImpact.recommendation.train', station: missingStation, affordable: true, cost: 0, crewId: null };
  return {
    key: credits >= candidate.cost ? 'crewImpact.recommendation.hireNow' : 'crewImpact.recommendation.saveCredits',
    station: candidate.station,
    affordable: credits >= candidate.cost,
    cost: candidate.cost,
    crewId: candidate.crew.id,
    crewName: candidate.crew.name,
  };
}

export function normalizeCrewGameplayModifiers(modifiers = {}) {
  return {
    sonarConfidenceBonus: clamp(modifiers.sonarConfidenceBonus, 0, 22),
    tdcSolutionBonus: clamp(modifiers.tdcSolutionBonus, 0, 20),
    repairEfficiencyBonus: clamp(modifiers.repairEfficiencyBonus, 0, 28),
    stealthNoiseReduction: clamp(modifiers.stealthNoiseReduction, 0, 24),
    navigationSpeedBonus: clamp(modifiers.navigationSpeedBonus, 0, 18),
    autoOrderDelayReduction: clamp(modifiers.autoOrderDelayReduction, 0, 30),
    scoreMultiplier: Math.max(1, Math.min(1.25, n(modifiers.scoreMultiplier, 1))),
  };
}

export function buildCrewProgressionImpact({ allCrew = [], hiredIds = [], save = {}, crewDrillSummary = null, veteranOfficerSummary = null } = {}) {
  const ids = uniqueStrings(hiredIds || save?.crew?.hiredIds || []);
  const hiredSet = new Set(ids);
  const hiredCrew = (allCrew || []).filter((crew) => hiredSet.has(crew.id));
  const stationBuckets = { command: [], sonar: [], engineering: [], navigation: [], weapons: [], stealth: [] };
  hiredCrew.forEach((crew) => {
    const station = stationFromCrew(crew);
    stationBuckets[station]?.push(clamp(crew.skill || 50));
    if (station === 'sonar') stationBuckets.stealth.push(clamp(crew.skill || 50) - 6);
    if (station === 'navigation') stationBuckets.stealth.push(clamp(crew.skill || 50) - 8);
    if (station === 'command') stationBuckets.weapons.push(clamp(crew.skill || 50) - 12);
  });
  const baseFallback = hiredCrew.length ? 44 : 30;
  const avg = (values = [], fallback = baseFallback) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : fallback;
  const drillEffect = combinedEffectFrom(crewDrillSummary);
  const veteranEffect = combinedEffectFrom(veteranOfficerSummary);
  const effect = addEffects(drillEffect, veteranEffect);
  const logistics = save?.logistics || {};
  const morale = clamp(logistics.morale ?? 70);
  const fatigue = clamp(logistics.fatigue ?? 28);
  const readinessBase = clamp(logistics.readiness ?? 70);
  const ratings = {
    command: Math.round(clamp(avg(stationBuckets.command) * 0.74 + morale * 0.16 + readinessBase * 0.10 + effect.readinessBonus)),
    sonar: Math.round(clamp(avg(stationBuckets.sonar) * 0.78 + readinessBase * 0.12 + effect.sonarBonus * 2.2 - fatigue * 0.06)),
    engineering: Math.round(clamp(avg(stationBuckets.engineering) * 0.78 + readinessBase * 0.12 + effect.engineeringBonus * 2.2 - fatigue * 0.07)),
    navigation: Math.round(clamp(avg(stationBuckets.navigation) * 0.78 + readinessBase * 0.12 + effect.readinessBonus * 1.4 - fatigue * 0.05)),
    weapons: Math.round(clamp(avg(stationBuckets.weapons) * 0.78 + readinessBase * 0.12 + effect.torpedoBonus * 2.3 - fatigue * 0.05)),
    stealth: Math.round(clamp(avg(stationBuckets.stealth) * 0.74 + readinessBase * 0.10 + effect.stealthBonus * 2.4 + Math.max(0, 100 - fatigue) * 0.06)),
  };
  const averageRating = Math.round(Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length);
  const crewInvestment = hiredCrew.reduce((total, crew) => total + n(crew.cost), 0);
  const completedDrillCount = Number(crewDrillSummary?.completedCount || 0);
  const veteranOfficerCount = Number(veteranOfficerSummary?.assignedCount || veteranOfficerSummary?.assignedOfficers?.length || 0);
  const modifiers = normalizeCrewGameplayModifiers({
    sonarConfidenceBonus: Math.round(Math.max(0, (ratings.sonar - 45) * 0.18 + effect.sonarBonus)),
    tdcSolutionBonus: Math.round(Math.max(0, (ratings.weapons - 45) * 0.17 + effect.torpedoBonus)),
    repairEfficiencyBonus: Math.round(Math.max(0, (ratings.engineering - 45) * 0.22 + effect.engineeringBonus * 1.2)),
    stealthNoiseReduction: Math.round(Math.max(0, (ratings.stealth - 45) * 0.18 + effect.stealthBonus)),
    navigationSpeedBonus: Math.round(Math.max(0, (ratings.navigation - 45) * 0.14)),
    autoOrderDelayReduction: Math.round(Math.max(0, (ratings.command - 45) * 0.18 + ids.length * 1.5 + completedDrillCount * 2)),
    scoreMultiplier: 1 + Math.max(0, averageRating - 45) / 850 + completedDrillCount * 0.012 + veteranOfficerCount * 0.01,
  });
  return {
    phase: PHASE53_CREW_PROGRESSION_IMPACT.phase,
    system: PHASE53_CREW_PROGRESSION_IMPACT.system,
    version: PHASE53_CREW_PROGRESSION_IMPACT.version,
    hiredCount: hiredCrew.length,
    hiredIds: ids,
    ratings,
    averageRating,
    tierKey: scoreToLabel(averageRating),
    stationKeys: Object.fromEntries(Object.keys(ratings).map((key) => [key, `crewImpact.station.${key}`])),
    modifiers,
    crewInvestment,
    completedDrillCount,
    veteranOfficerCount,
    credits: n(save?.progression?.credits),
    xp: n(save?.progression?.xp),
    bestScore: n(save?.progression?.bestScore),
    recommendation: nextCrewRecommendation({ allCrew, hiredIds: ids, ratings, credits: n(save?.progression?.credits) }),
    effects: effect,
    saveSchemaStable: PHASE53_CREW_PROGRESSION_IMPACT.saveSchemaStable,
    preservesExistingAssetsAndAudio: PHASE53_CREW_PROGRESSION_IMPACT.preservesExistingAssetsAndAudio,
  };
}

export function applyCrewImpactToMissionReport(report = {}, impact = {}) {
  const modifiers = normalizeCrewGameplayModifiers(impact.modifiers || {});
  const baseScore = Math.max(0, Math.round(n(report.score)));
  const score = Math.round(baseScore * modifiers.scoreMultiplier);
  const bonusCredits = Math.round(n(report.bonusCredits) + Math.max(0, score - baseScore) * 0.18);
  const bonusXp = Math.round(n(report.bonusXp) + Math.max(0, score - baseScore) * 0.055);
  return { ...report, score, baseScore, bonusCredits, bonusXp, crewImpactApplied: true, crewScoreMultiplier: modifiers.scoreMultiplier };
}
