const ROLE_TO_STATION = Object.freeze({
  'crew.role.executive': 'command',
  'crew.role.sonar': 'sonar',
  'crew.role.mechanic': 'damage',
  'crew.role.navigator': 'navigation',
  'crew.role.lookout': 'watch'
});

const STATION_KEYS = Object.freeze(['command', 'sonar', 'navigation', 'damage', 'watch']);

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}

function average(values, fallback = 0) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return fallback;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function normalizeHiredCrew(crewMembers = [], hiredIds = []) {
  const hiredSet = new Set(hiredIds || []);
  return crewMembers.filter((member) => hiredSet.has(member.id));
}

function stationOf(member = {}) {
  return ROLE_TO_STATION[member.roleKey] || 'watch';
}

export function createCrewStationCoverage(crewMembers = [], hiredIds = []) {
  const hired = normalizeHiredCrew(crewMembers, hiredIds);
  const coverage = Object.fromEntries(STATION_KEYS.map((key) => [key, { station: key, crew: [], skill: 0, covered: false }]));
  for (const member of hired) {
    const station = stationOf(member);
    const slot = coverage[station] || coverage.watch;
    slot.crew.push(member);
  }
  for (const key of STATION_KEYS) {
    const slot = coverage[key];
    slot.covered = slot.crew.length > 0;
    slot.skill = Math.round(average(slot.crew.map((member) => member.skill), slot.covered ? 50 : 0));
    slot.lead = slot.crew.slice().sort((a, b) => Number(b.skill || 0) - Number(a.skill || 0))[0] || null;
  }
  return coverage;
}

export function assessCrewReadiness(crewMembers = [], hiredIds = [], context = {}) {
  const hired = normalizeHiredCrew(crewMembers, hiredIds);
  const coverage = createCrewStationCoverage(crewMembers, hiredIds);
  const averageSkill = Math.round(average(hired.map((member) => member.skill), hired.length ? 50 : 0));
  const coverageScore = Math.round(STATION_KEYS.reduce((sum, key) => sum + (coverage[key].covered ? 20 : 0), 0));
  const hull = clamp(context.submarine?.hull ?? context.hull ?? 100, 0, 100);
  const logisticsMorale = clamp(context.logistics?.morale ?? context.morale ?? 74, 0, 100);
  const careerReputation = clamp(context.career?.reputation ?? context.reputation ?? 0, 0, 100);
  const emergencyPressure = clamp(context.damageEmergency?.pressureIngress ?? context.pressureIngress ?? 0, 0, 100);
  const smoke = clamp(context.damageEmergency?.smokeDensity ?? context.smokeDensity ?? 0, 0, 100);
  const fatigue = Math.round(clamp(28 + Math.max(0, 5 - hired.length) * 7 + (100 - logisticsMorale) * 0.22 + emergencyPressure * 0.24 + smoke * 0.18 - averageSkill * 0.14, 0, 100));
  const morale = Math.round(clamp(logisticsMorale * 0.58 + averageSkill * 0.20 + coverageScore * 0.12 + careerReputation * 0.10 - fatigue * 0.16, 0, 100));
  const readiness = Math.round(clamp(averageSkill * 0.34 + coverageScore * 0.32 + morale * 0.20 + hull * 0.14 - fatigue * 0.22, 0, 100));
  const sonarReadiness = Math.round(clamp(coverage.sonar.skill * 0.70 + readiness * 0.30, 0, 100));
  const navigationReadiness = Math.round(clamp(coverage.navigation.skill * 0.68 + readiness * 0.32, 0, 100));
  const repairReadiness = Math.round(clamp(coverage.damage.skill * 0.70 + readiness * 0.30, 0, 100));
  const commandReadiness = Math.round(clamp(coverage.command.skill * 0.72 + morale * 0.28, 0, 100));
  const watchReadiness = Math.round(clamp(coverage.watch.skill * 0.60 + sonarReadiness * 0.20 + readiness * 0.20, 0, 100));
  const missingStations = STATION_KEYS.filter((key) => !coverage[key].covered);
  let status = 'critical';
  if (readiness >= 82 && missingStations.length === 0) status = 'elite';
  else if (readiness >= 64 && missingStations.length <= 1) status = 'ready';
  else if (readiness >= 42) status = 'strained';
  const watchRotation = hired.slice().sort((a, b) => Number(b.skill || 0) - Number(a.skill || 0)).slice(0, 4).map((member, index) => ({
    id: member.id,
    name: member.name,
    roleKey: member.roleKey,
    station: stationOf(member),
    watch: index + 1,
    fatigueLoad: Math.round(clamp(fatigue + index * 5 - Number(member.skill || 0) * 0.08, 0, 100))
  }));
  return {
    hiredCount: hired.length,
    averageSkill,
    coverageScore,
    readiness,
    fatigue,
    morale,
    status,
    missingStations,
    stationCoverage: coverage,
    stationReadiness: {
      command: commandReadiness,
      sonar: sonarReadiness,
      navigation: navigationReadiness,
      damage: repairReadiness,
      watch: watchReadiness
    },
    watchRotation,
    recommendations: buildCrewRecommendations({ status, missingStations, fatigue, morale })
  };
}

export function buildCrewRecommendations({ status = 'critical', missingStations = [], fatigue = 0, morale = 0 } = {}) {
  const recommendations = [];
  if (missingStations.length) recommendations.push({ key: 'crew.rec.coverage', stations: missingStations });
  if (fatigue >= 68) recommendations.push({ key: 'crew.rec.fatigue' });
  if (morale <= 42) recommendations.push({ key: 'crew.rec.morale' });
  if (!recommendations.length && status === 'elite') recommendations.push({ key: 'crew.rec.elite' });
  if (!recommendations.length) recommendations.push({ key: 'crew.rec.ready' });
  return recommendations;
}

export const CREW_STATIONS = STATION_KEYS.map((station) => ({ id: station, labelKey: `crew.station.${station}` }));
