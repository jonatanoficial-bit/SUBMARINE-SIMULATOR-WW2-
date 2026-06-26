export const PHASE42_BASE_WORKSHOP_INTEGRATION = Object.freeze({
  phase: '42',
  system: 'base-workshop-integration',
  version: 'v2.0.0-alpha.57',
  layers: ['upgrade-impact', 'mission-readiness', 'dock-maintenance', 'logistics-prep', 'captain-briefing'],
  mobileFirst: true,
});

function clamp(value, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : 0));
}

function round(value) { return Math.round(Number(value) || 0); }

const CATEGORY_IMPACT = Object.freeze({
  hull: { hullPressureBonus: 8, damageControlBonus: 5, maintenanceReliability: 4 },
  battery: { batteryEndurancePercent: 8, silentRunningBonus: 7, acousticMasking: 3 },
  engine: { propulsionEfficiency: 7, engineNoiseReduction: 4, fuelEfficiencyPercent: 4 },
  sonar: { sonarRangePercent: 9, contactConfidenceBonus: 6, falseContactReduction: 3 },
  torpedo: { weaponReloadPercent: 6, solutionStabilityBonus: 4, torpedoReserveBonus: 1 },
});

export function calculateUpgradeBonus(upgrades = [], ownedIds = []) {
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  const bonus = {
    speed: 0, range: 0, stealth: 0, depth: 0, torpedoes: 0,
    sonarRangePercent: 0, contactConfidenceBonus: 0, falseContactReduction: 0,
    batteryEndurancePercent: 0, silentRunningBonus: 0, acousticMasking: 0,
    propulsionEfficiency: 0, engineNoiseReduction: 0, fuelEfficiencyPercent: 0,
    hullPressureBonus: 0, damageControlBonus: 0, maintenanceReliability: 0,
    weaponReloadPercent: 0, solutionStabilityBonus: 0, torpedoReserveBonus: 0,
  };
  upgrades.forEach((upgrade) => {
    if (!upgrade || !owned.has(upgrade.id)) return;
    Object.entries(upgrade.effect || {}).forEach(([key, value]) => {
      bonus[key] = (bonus[key] || 0) + Number(value || 0);
    });
    const impact = CATEGORY_IMPACT[upgrade.category] || {};
    Object.entries(impact).forEach(([key, value]) => {
      bonus[key] = (bonus[key] || 0) + Number(value || 0);
    });
  });
  return bonus;
}

export function applyUpgradeStats(stats = {}, bonus = {}) {
  const merged = { ...stats };
  Object.keys(merged).forEach((key) => {
    const raw = Number(merged[key]) || 0;
    const next = raw + Number(bonus[key] || 0);
    merged[key] = key === 'torpedoes' ? Math.max(1, Math.round(next + Number(bonus.torpedoReserveBonus || 0))) : clamp(next, 1, 100);
  });
  return merged;
}

function installedByCategory(upgrades = [], ownedIds = []) {
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  return upgrades.reduce((acc, upgrade) => {
    if (owned.has(upgrade.id)) acc[upgrade.category] = (acc[upgrade.category] || 0) + 1;
    return acc;
  }, {});
}

function classifyReadiness(score) {
  if (score >= 82) return { state: 'excellent', key: 'workshop.readiness.excellent' };
  if (score >= 64) return { state: 'ready', key: 'workshop.readiness.ready' };
  if (score >= 42) return { state: 'caution', key: 'workshop.readiness.caution' };
  return { state: 'critical', key: 'workshop.readiness.critical' };
}

export function buildWorkshopImpactReport({ upgrades = [], ownedIds = [], submarine = {}, logistics = {}, hull = 100, systems = {} } = {}) {
  const bonus = calculateUpgradeBonus(upgrades, ownedIds);
  const categories = installedByCategory(upgrades, ownedIds);
  const systemAverage = ['engines', 'sonar', 'periscope', 'weapons'].reduce((sum, key) => sum + clamp(systems[key] ?? 100, 0, 100), 0) / 4;
  const logisticsReadiness = clamp(logistics.readiness ?? 50, 0, 100);
  const upgradeScore = clamp(Object.keys(categories).length * 8 + Object.values(categories).reduce((sum, value) => sum + value, 0) * 4, 0, 34);
  const readinessScore = clamp((clamp(hull, 0, 100) * 0.28) + (systemAverage * 0.24) + (logisticsReadiness * 0.28) + upgradeScore + (bonus.maintenanceReliability || 0) * 0.4, 0, 100);
  const readiness = classifyReadiness(readinessScore);
  const stats = applyUpgradeStats(submarine.stats || {}, bonus);
  const cards = [
    { id: 'sonar', category: 'sonar', titleKey: 'workshop.card.sonar', value: `+${round(bonus.sonarRangePercent)}%`, detailKey: bonus.sonarRangePercent ? 'workshop.card.sonarActive' : 'workshop.card.sonarEmpty' },
    { id: 'battery', category: 'battery', titleKey: 'workshop.card.battery', value: `+${round(bonus.batteryEndurancePercent)}%`, detailKey: bonus.batteryEndurancePercent ? 'workshop.card.batteryActive' : 'workshop.card.batteryEmpty' },
    { id: 'engine', category: 'engine', titleKey: 'workshop.card.engine', value: `-${round(bonus.engineNoiseReduction)}%`, detailKey: bonus.engineNoiseReduction ? 'workshop.card.engineActive' : 'workshop.card.engineEmpty' },
    { id: 'hull', category: 'hull', titleKey: 'workshop.card.hull', value: `+${round(bonus.hullPressureBonus)}%`, detailKey: bonus.hullPressureBonus ? 'workshop.card.hullActive' : 'workshop.card.hullEmpty' },
    { id: 'weapon', category: 'torpedo', titleKey: 'workshop.card.weapon', value: `-${round(bonus.weaponReloadPercent)}%`, detailKey: bonus.weaponReloadPercent ? 'workshop.card.weaponActive' : 'workshop.card.weaponEmpty' },
  ];
  const directiveKey = readiness.state === 'critical'
    ? 'workshop.directive.critical'
    : Object.keys(categories).length <= 1
      ? 'workshop.directive.install'
      : readiness.state === 'excellent'
        ? 'workshop.directive.excellent'
        : 'workshop.directive.ready';
  return {
    phase: PHASE42_BASE_WORKSHOP_INTEGRATION.phase,
    system: PHASE42_BASE_WORKSHOP_INTEGRATION.system,
    bonus,
    categories,
    stats,
    cards,
    readiness: { ...readiness, score: Math.round(readinessScore) },
    directiveKey,
    installedCount: Array.isArray(ownedIds) ? ownedIds.length : 0,
    operationalEffects: {
      stealthScore: clamp((stats.stealth || 0) + bonus.silentRunningBonus + bonus.acousticMasking, 0, 120),
      enduranceScore: clamp((stats.range || 0) + bonus.batteryEndurancePercent + bonus.fuelEfficiencyPercent, 0, 125),
      attackScore: clamp((stats.torpedoes || 0) * 8 + bonus.solutionStabilityBonus + bonus.weaponReloadPercent, 0, 120),
      survivalScore: clamp((stats.depth || 0) + bonus.hullPressureBonus + bonus.damageControlBonus, 0, 130),
    },
  };
}
