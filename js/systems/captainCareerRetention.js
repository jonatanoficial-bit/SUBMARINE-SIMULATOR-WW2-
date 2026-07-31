export const PHASE54_CAREER_RETENTION = Object.freeze({
  phase: 54,
  system: 'captain-career-retention',
  version: '2.0.0',
  doctrine: 'correct-captain-decisions-change-crew-morale-and-long-term-store-progression-keeps-career-alive',
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

function roleStation(item = {}) {
  const role = String(item.roleKey || '').toLowerCase();
  const bonus = String(item.bonusKey || '').toLowerCase();
  if (role.includes('sonar') || bonus.includes('sonar') || bonus.includes('lookout')) return 'sonar';
  if (role.includes('mechanic') || bonus.includes('repair')) return 'engineering';
  if (role.includes('navigator') || bonus.includes('navigation')) return 'navigation';
  if (bonus.includes('torpedo') || bonus.includes('weapon') || bonus.includes('tdc')) return 'weapons';
  if (role.includes('lookout') || bonus.includes('stealth')) return 'stealth';
  return 'command';
}

function careerStats(save = {}) {
  const completed = Array.isArray(save?.progression?.completedMissions) ? save.progression.completedMissions.length : 0;
  return {
    level: Math.max(1, Math.floor(n(save?.progression?.level, 1))),
    credits: Math.max(0, Math.floor(n(save?.progression?.credits))),
    completedMissions: completed,
    victories: Math.max(n(save?.career?.victories), completed),
    failedPatrols: Math.max(0, Math.floor(n(save?.career?.failedPatrols))),
    reputation: Math.max(0, Math.floor(n(save?.career?.reputation))),
    prestige: Math.max(0, Math.floor(n(save?.career?.prestige))),
    morale: clamp(save?.logistics?.morale ?? 72),
    fatigue: clamp(save?.logistics?.fatigue ?? 25),
    readiness: clamp(save?.logistics?.readiness ?? 70),
    bestScore: Math.max(0, Math.floor(n(save?.progression?.bestScore))),
  };
}

function defaultCrewRequires(crew = {}) {
  const skill = n(crew.skill, 50);
  if (crew.requires && typeof crew.requires === 'object') return crew.requires;
  if (skill >= 94) return { victories: 15, moraleMin: 84, reputationMin: 650, level: 10 };
  if (skill >= 88) return { victories: 8, moraleMin: 76, reputationMin: 320, level: 6 };
  if (skill >= 80) return { victories: 3, moraleMin: 66, reputationMin: 90, level: 3 };
  return { victories: 0, moraleMin: 0, reputationMin: 0, level: 1 };
}

function defaultSubmarineRequires(submarine = {}) {
  const level = Math.max(1, n(submarine.levelRequired, 1));
  if (submarine.requires && typeof submarine.requires === 'object') return submarine.requires;
  if (level >= 12) return { victories: 18, moraleMin: 82, reputationMin: 800, level };
  if (level >= 8) return { victories: 9, moraleMin: 74, reputationMin: 360, level };
  if (level >= 4) return { victories: 3, moraleMin: 62, reputationMin: 80, level };
  return { victories: 0, moraleMin: 0, reputationMin: 0, level };
}

export function evaluateCareerGate(item = {}, save = {}, kind = 'crew') {
  const stats = careerStats(save);
  const requires = kind === 'submarine' ? defaultSubmarineRequires(item) : defaultCrewRequires(item);
  const checks = [
    { id: 'level', ok: stats.level >= n(requires.level, 1), current: stats.level, required: n(requires.level, 1), key: 'careerRetention.lock.level' },
    { id: 'victories', ok: stats.victories >= n(requires.victories), current: stats.victories, required: n(requires.victories), key: 'careerRetention.lock.victories' },
    { id: 'morale', ok: stats.morale >= n(requires.moraleMin), current: stats.morale, required: n(requires.moraleMin), key: 'careerRetention.lock.morale' },
    { id: 'reputation', ok: stats.reputation >= n(requires.reputationMin), current: stats.reputation, required: n(requires.reputationMin), key: 'careerRetention.lock.reputation' },
    { id: 'prestige', ok: stats.prestige >= n(requires.prestigeMin), current: stats.prestige, required: n(requires.prestigeMin), key: 'careerRetention.lock.prestige' },
    { id: 'bestScore', ok: stats.bestScore >= n(requires.bestScoreMin), current: stats.bestScore, required: n(requires.bestScoreMin), key: 'careerRetention.lock.bestScore' },
  ].filter((check) => check.required > 0 || check.id === 'level');
  const blocked = checks.find((check) => !check.ok);
  return {
    ok: !blocked,
    locked: Boolean(blocked),
    reasonKey: blocked?.key || 'careerRetention.unlocked',
    reason: blocked || null,
    requirements: requires,
    stats,
  };
}

function moraleBand(morale = 70) {
  const value = clamp(morale);
  if (value >= 90) return { key: 'careerRetention.morale.legendary', tone: 'legendary', accuracyBonus: 5, rewardMultiplier: 1.10 };
  if (value >= 78) return { key: 'careerRetention.morale.high', tone: 'high', accuracyBonus: 3, rewardMultiplier: 1.06 };
  if (value >= 58) return { key: 'careerRetention.morale.stable', tone: 'stable', accuracyBonus: 0, rewardMultiplier: 1.00 };
  if (value >= 40) return { key: 'careerRetention.morale.low', tone: 'low', accuracyBonus: -3, rewardMultiplier: 0.94 };
  return { key: 'careerRetention.morale.critical', tone: 'critical', accuracyBonus: -6, rewardMultiplier: 0.88 };
}

function itemTier(item = {}) {
  if (item.tier) return String(item.tier);
  const skill = n(item.skill, 0);
  const level = n(item.levelRequired, 1);
  if (skill >= 94 || level >= 12) return 'legendary';
  if (skill >= 88 || level >= 8) return 'elite';
  if (skill >= 80 || level >= 4) return 'veteran';
  if (skill >= 70 || level >= 2) return 'trained';
  return 'rookie';
}

function tierKey(tier) {
  return `careerRetention.tier.${tier || 'rookie'}`;
}

function sortShopItems(a, b) {
  const order = { rookie: 1, trained: 2, veteran: 3, elite: 4, legendary: 5 };
  return (order[a.tier] || 9) - (order[b.tier] || 9) || n(a.cost) - n(b.cost) || String(a.name).localeCompare(String(b.name));
}

export function buildCareerRetentionDeck({ allCrew = [], submarines = [], save = {}, nationId = 'de', crewImpact = null } = {}) {
  const stats = careerStats(save);
  const morale = moraleBand(stats.morale);
  const hired = new Set(save?.crew?.hiredIds || []);
  const owned = new Set(save?.submarine?.unlockedIds || []);
  const crewShop = (allCrew || [])
    .filter((crew) => crew?.nation === nationId)
    .map((crew) => {
      const gate = evaluateCareerGate(crew, save, 'crew');
      const tier = itemTier(crew);
      const station = roleStation(crew);
      const hiredAlready = hired.has(crew.id);
      const affordable = stats.credits >= n(crew.cost);
      return {
        ...crew,
        station,
        tier,
        tierKey: tierKey(tier),
        gate,
        unlocked: gate.ok,
        hired: hiredAlready,
        affordable,
        canBuy: gate.ok && affordable && !hiredAlready,
        lockKey: gate.reasonKey,
      };
    })
    .sort(sortShopItems);
  const submarineMarket = (submarines || [])
    .filter((submarine) => submarine?.nation === nationId)
    .map((submarine) => {
      const gate = evaluateCareerGate(submarine, save, 'submarine');
      const tier = itemTier(submarine);
      const isOwned = Boolean(submarine.unlocked || submarine.owned || owned.has(submarine.id));
      const cost = n(submarine.unlockCost);
      const affordable = cost <= 0 || stats.credits >= cost;
      return {
        ...submarine,
        tier,
        tierKey: tierKey(tier),
        gate,
        unlocked: gate.ok,
        owned: isOwned,
        affordable,
        canBuy: gate.ok && affordable && !isOwned,
        lockKey: gate.reasonKey,
      };
    })
    .sort((a, b) => n(a.levelRequired, 1) - n(b.levelRequired, 1) || n(a.unlockCost) - n(b.unlockCost));
  const nextCrew = crewShop.find((crew) => !crew.hired && !crew.unlocked) || crewShop.find((crew) => crew.canBuy) || null;
  const nextSubmarine = submarineMarket.find((sub) => !sub.owned && !sub.unlocked) || submarineMarket.find((sub) => sub.canBuy) || null;
  const freeModes = [
    { id: 'free-hunt', key: 'careerRetention.free.hunt', unlocked: stats.victories >= 3, requires: 3 },
    { id: 'convoy-nightmare', key: 'careerRetention.free.convoy', unlocked: stats.victories >= 8 && stats.morale >= 70, requires: 8 },
    { id: 'iron-coffin', key: 'careerRetention.free.iron', unlocked: stats.victories >= 15 && stats.morale >= 82, requires: 15 },
  ];
  return {
    phase: PHASE54_CAREER_RETENTION.phase,
    system: PHASE54_CAREER_RETENTION.system,
    version: PHASE54_CAREER_RETENTION.version,
    nationId,
    stats,
    morale,
    moraleKey: morale.key,
    accuracyBonus: morale.accuracyBonus,
    rewardMultiplier: morale.rewardMultiplier,
    crewShop,
    crewShopById: Object.fromEntries(crewShop.map((crew) => [crew.id, crew])),
    submarineMarket,
    submarineMarketById: Object.fromEntries(submarineMarket.map((sub) => [sub.id, sub])),
    nextUnlock: { crew: nextCrew, submarine: nextSubmarine },
    freeModes,
    lifetimeGoals: [
      { id: 'victories-10', key: 'careerRetention.goal.victories10', progress: Math.min(10, stats.victories), target: 10, completed: stats.victories >= 10 },
      { id: 'elite-crew-4', key: 'careerRetention.goal.eliteCrew4', progress: crewShop.filter((crew) => crew.hired && ['elite','legendary'].includes(crew.tier)).length, target: 4, completed: crewShop.filter((crew) => crew.hired && ['elite','legendary'].includes(crew.tier)).length >= 4 },
      { id: 'morale-90', key: 'careerRetention.goal.morale90', progress: Math.min(90, stats.morale), target: 90, completed: stats.morale >= 90 },
      { id: 'fleet-3', key: 'careerRetention.goal.fleet3', progress: submarineMarket.filter((sub) => sub.owned).length, target: 3, completed: submarineMarket.filter((sub) => sub.owned).length >= 3 },
    ],
    crewImpactTier: crewImpact?.tierKey || null,
    saveSchemaStable: true,
    preservesExistingAssetsAndAudio: true,
  };
}

export function calculateMissionMoraleOutcome({ mission = {}, report = {}, alreadyCompleted = false } = {}) {
  const score = n(report.score || report.baseScore);
  const hull = n(report.hull, 86);
  const stealth = n(report.stealth, 62);
  const shots = n(report.shots, 0);
  const difficultyMap = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  const difficulty = difficultyMap[String(mission.difficulty || 'I').toUpperCase()] || n(mission.difficulty, 1);
  let moraleDelta = 0;
  let fatigueDelta = 1;
  let reputationBonus = 0;
  if (score >= 950) { moraleDelta += 8; fatigueDelta -= 3; reputationBonus += 6; }
  else if (score >= 760) { moraleDelta += 5; fatigueDelta -= 2; reputationBonus += 3; }
  else if (score >= 580) { moraleDelta += 2; fatigueDelta -= 1; }
  else { moraleDelta -= 5; fatigueDelta += 4; reputationBonus -= 2; }
  if (hull >= 88) moraleDelta += 2;
  if (hull < 55) { moraleDelta -= 6; fatigueDelta += 5; }
  if (stealth >= 78) moraleDelta += 2;
  if (shots > 0 && score < 520) moraleDelta -= 3;
  if (difficulty >= 4 && score >= 700) { moraleDelta += 2; reputationBonus += 3; }
  if (alreadyCompleted) moraleDelta = Math.max(-2, Math.round(moraleDelta * 0.35));
  const labelKey = moraleDelta >= 7 ? 'careerRetention.afterAction.heroic' : moraleDelta >= 3 ? 'careerRetention.afterAction.victory' : moraleDelta >= 0 ? 'careerRetention.afterAction.stable' : 'careerRetention.afterAction.bad';
  return {
    moraleDelta: Math.max(-12, Math.min(12, Math.round(moraleDelta))),
    fatigueDelta: Math.max(-8, Math.min(10, Math.round(fatigueDelta))),
    reputationBonus: Math.max(-8, Math.min(12, Math.round(reputationBonus))),
    labelKey,
    score,
    hull,
    stealth,
    difficulty,
  };
}

export function applyRetentionAccuracyModifiers(impact = {}, retention = null) {
  if (!retention?.morale) return impact;
  const bonus = n(retention.accuracyBonus);
  const rewardMultiplier = n(retention.rewardMultiplier, 1);
  const modifiers = impact.modifiers || {};
  return {
    ...impact,
    retentionApplied: true,
    retentionMoraleKey: retention.moraleKey,
    retentionAccuracyBonus: bonus,
    modifiers: {
      ...modifiers,
      sonarConfidenceBonus: Math.max(0, n(modifiers.sonarConfidenceBonus) + bonus),
      tdcSolutionBonus: Math.max(0, n(modifiers.tdcSolutionBonus) + bonus),
      repairEfficiencyBonus: Math.max(0, n(modifiers.repairEfficiencyBonus) + bonus),
      stealthNoiseReduction: Math.max(0, n(modifiers.stealthNoiseReduction) + Math.max(-4, bonus)),
      autoOrderDelayReduction: Math.max(0, n(modifiers.autoOrderDelayReduction) + Math.max(-6, bonus)),
      scoreMultiplier: Math.max(0.88, Math.min(1.32, n(modifiers.scoreMultiplier, 1) * rewardMultiplier)),
    },
  };
}
