const WAYPOINT_NAV_EARTH_NM_PER_DEGREE = 60;
const WAYPOINT_NAV_DEFAULT_SPEED_KNOTS = 6;

export const PHASE30_WAYPOINT_NAVIGATION = Object.freeze({
  phase: '30',
  system: 'waypoint-navigation-planner',
  version: 'v2.0.0-alpha.45',
  mobileFirst: true,
  layers: ['route-legs', 'bearing-labels', 'eta-projection', 'autonomy-check', 'patrol-orders'],
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeHeading(value) {
  const number = Number(value) || 0;
  return ((number % 360) + 360) % 360;
}

function distanceNm(a = {}, b = {}) {
  const latA = safeNumber(a.lat);
  const latB = safeNumber(b.lat);
  const meanLat = ((latA + latB) / 2) * Math.PI / 180;
  const dy = (latB - latA) * WAYPOINT_NAV_EARTH_NM_PER_DEGREE;
  const dx = (safeNumber(b.lon) - safeNumber(a.lon)) * WAYPOINT_NAV_EARTH_NM_PER_DEGREE * Math.max(0.15, Math.cos(meanLat));
  return Math.hypot(dx, dy);
}

function bearingDegrees(a = {}, b = {}) {
  const latA = safeNumber(a.lat);
  const latB = safeNumber(b.lat);
  const meanLat = ((latA + latB) / 2) * Math.PI / 180;
  const north = (latB - latA) * WAYPOINT_NAV_EARTH_NM_PER_DEGREE;
  const east = (safeNumber(b.lon) - safeNumber(a.lon)) * WAYPOINT_NAV_EARTH_NM_PER_DEGREE * Math.max(0.15, Math.cos(meanLat));
  return normalizeHeading(Math.atan2(east, north) * 180 / Math.PI);
}

function formatBearing(value) {
  return `${String(Math.round(normalizeHeading(value))).padStart(3, '0')}°`;
}

function formatDistance(value) {
  const nm = Math.max(0, safeNumber(value));
  return nm >= 100 ? `${Math.round(nm)} NM` : `${nm.toFixed(nm >= 10 ? 1 : 2)} NM`;
}

function formatEta(hours) {
  if (!Number.isFinite(Number(hours)) || Number(hours) <= 0) return '--';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

function waypointLabel(waypoint = {}, index = 0) {
  if (waypoint.custom) return `WP-${index + 1}`;
  if (String(waypoint.id || '').startsWith('patrol-')) return `PT-${index + 1}`;
  return `WP-${index + 1}`;
}

export function buildRouteLegs({ position = {}, route = [], activeWaypointIndex = 0, speedKnots = WAYPOINT_NAV_DEFAULT_SPEED_KNOTS } = {}) {
  const activeIndex = Math.max(0, Math.floor(safeNumber(activeWaypointIndex, 0)));
  const effectiveSpeed = Math.max(0.25, safeNumber(speedKnots, WAYPOINT_NAV_DEFAULT_SPEED_KNOTS) || WAYPOINT_NAV_DEFAULT_SPEED_KNOTS);
  const remaining = Array.isArray(route) ? route.slice(activeIndex) : [];
  const legs = [];
  let from = position;
  remaining.forEach((waypoint, offset) => {
    const index = activeIndex + offset;
    const distance = distanceNm(from, waypoint);
    const bearing = bearingDegrees(from, waypoint);
    legs.push({
      id: waypoint.id || `wp-${index + 1}`,
      index,
      label: waypointLabel(waypoint, index),
      from,
      to: waypoint,
      distanceNm: distance,
      distanceLabel: formatDistance(distance),
      bearing,
      bearingLabel: formatBearing(bearing),
      etaHours: distance / effectiveSpeed,
      etaLabel: formatEta(distance / effectiveSpeed),
      active: offset === 0,
    });
    from = waypoint;
  });
  return legs;
}

function classifyAutonomy(totalDistanceNm, snapshot = {}) {
  const fuel = safeNumber(snapshot.physics?.fuel, 100);
  const battery = safeNumber(snapshot.physics?.battery, 100);
  const enduranceNm = Math.max(12, fuel * 3.2 + battery * 0.85);
  const ratio = totalDistanceNm / enduranceNm;
  if (ratio > 0.78) return { state: 'critical', labelKey: 'waypointNav.autonomyCritical', enduranceNm };
  if (ratio > 0.55) return { state: 'caution', labelKey: 'waypointNav.autonomyCaution', enduranceNm };
  return { state: 'safe', labelKey: 'waypointNav.autonomySafe', enduranceNm };
}

function classifyOrder(snapshot = {}, legs = []) {
  const aircraft = snapshot.navalAI?.aircraft || {};
  const airLevel = aircraft.state || snapshot.airThreat?.level || 'standby';
  if (aircraft.active && ['tracking', 'attack'].includes(airLevel)) return { state: 'evasion', labelKey: 'waypointNav.orderEvasion' };
  if (snapshot.playerDetected || safeNumber(snapshot.detectionScore) >= 70) return { state: 'silent', labelKey: 'waypointNav.orderSilent' };
  if (!legs.length) return { state: 'hold', labelKey: 'waypointNav.orderHold' };
  if (snapshot.navigation?.patrolEntered) return { state: 'patrol', labelKey: 'waypointNav.orderPatrol' };
  return { state: 'transit', labelKey: 'waypointNav.orderTransit' };
}

export function buildWaypointNavigationView({ snapshot = {}, mission = {} } = {}) {
  const navigation = snapshot.navigation || mission.navigation || {};
  const position = navigation.position || mission.navigation?.origin || { lat: 0, lon: 0 };
  const route = Array.isArray(navigation.route) ? navigation.route : [];
  const speedKnots = Math.max(0.25, safeNumber(navigation.speedKnots, WAYPOINT_NAV_DEFAULT_SPEED_KNOTS) || WAYPOINT_NAV_DEFAULT_SPEED_KNOTS);
  const legs = buildRouteLegs({ position, route, activeWaypointIndex: navigation.activeWaypointIndex || 0, speedKnots });
  const totalDistanceNm = legs.reduce((sum, leg) => sum + leg.distanceNm, 0);
  const totalEtaHours = totalDistanceNm / speedKnots;
  const autonomy = classifyAutonomy(totalDistanceNm, snapshot);
  const order = classifyOrder(snapshot, legs);
  const activeLeg = legs[0] || null;
  const patrolSector = navigation.patrolSector || mission.navigation?.patrolSector || null;
  return {
    phase: PHASE30_WAYPOINT_NAVIGATION.phase,
    system: PHASE30_WAYPOINT_NAVIGATION.system,
    speedKnots,
    activeLeg,
    legs,
    legCount: legs.length,
    totalDistanceNm,
    totalDistanceLabel: formatDistance(totalDistanceNm),
    totalEtaHours,
    totalEtaLabel: formatEta(totalEtaHours),
    fuelEstimate: Math.max(0, totalDistanceNm * 0.31),
    fuelEstimateLabel: `${Math.max(0, totalDistanceNm * 0.31).toFixed(1)}%`,
    autonomy,
    order,
    routeComplete: Boolean(navigation.routeComplete) || !legs.length,
    patrolSector,
    canPlotPatrol: Boolean(patrolSector),
    layers: PHASE30_WAYPOINT_NAVIGATION.layers,
  };
}

export function buildPatrolRouteFromSector({ sector = {}, bounds = {}, currentPosition = {} } = {}) {
  if (!sector) return [];
  const north = safeNumber(sector.north);
  const south = safeNumber(sector.south);
  const west = safeNumber(sector.west);
  const east = safeNumber(sector.east);
  if (!(north > south && east > west)) return [];
  const midLat = (north + south) / 2;
  const midLon = (west + east) / 2;
  const lonPad = Math.max(0.06, (east - west) * 0.18);
  const latPad = Math.max(0.04, (north - south) * 0.18);
  const minLon = safeNumber(bounds.west, -180);
  const maxLon = safeNumber(bounds.east, 180);
  const minLat = safeNumber(bounds.south, -90);
  const maxLat = safeNumber(bounds.north, 90);
  const entryWest = currentPosition.lon !== undefined && safeNumber(currentPosition.lon) < midLon;
  const entryLon = entryWest ? clamp(west - lonPad, minLon, maxLon) : clamp(east + lonPad, minLon, maxLon);
  const exitLon = entryWest ? clamp(east + lonPad, minLon, maxLon) : clamp(west - lonPad, minLon, maxLon);
  return [
    { id: 'patrol-entry', labelKey: 'waypointNav.wpPatrolEntry', lat: clamp(midLat, minLat, maxLat), lon: entryLon, custom: true },
    { id: 'patrol-sweep-north', labelKey: 'waypointNav.wpPatrolNorth', lat: clamp(north - latPad, minLat, maxLat), lon: clamp(midLon, minLon, maxLon), custom: true },
    { id: 'patrol-sweep-south', labelKey: 'waypointNav.wpPatrolSouth', lat: clamp(south + latPad, minLat, maxLat), lon: clamp(midLon, minLon, maxLon), custom: true },
    { id: 'patrol-exit', labelKey: 'waypointNav.wpPatrolExit', lat: clamp(midLat, minLat, maxLat), lon: exitLon, custom: true },
  ];
}
