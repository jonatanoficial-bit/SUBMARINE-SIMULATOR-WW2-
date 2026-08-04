const CHART_WIDTH = 1000;
const CHART_HEIGHT = 560;

export const PHASE29_TACTICAL_NAVAL_CHART = Object.freeze({
  phase: '29',
  system: 'tactical-naval-chart',
  version: 'v2.0.0-alpha.44',
  layers: ['hydrographic-grid', 'convoy-lanes', 'danger-zones', 'patrol-sector', 'waypoint-route', 'contact-markers'],
  mobileFirst: true,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBounds(bounds = {}) {
  const north = safeNumber(bounds.north, 50.5);
  const south = safeNumber(bounds.south, 46.5);
  const west = safeNumber(bounds.west, -19.5);
  const east = safeNumber(bounds.east, -11.5);
  if (north <= south || east <= west) return { north: 50.5, south: 46.5, west: -19.5, east: -11.5 };
  return { north, south, west, east };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function pointFromRatio(bounds, lonRatio, latRatio) {
  return {
    lon: lerp(bounds.west, bounds.east, clamp(lonRatio, 0, 1)),
    lat: lerp(bounds.north, bounds.south, clamp(latRatio, 0, 1)),
  };
}

export function projectChartPoint(position = {}, boundsInput = {}) {
  const bounds = normalizeBounds(boundsInput);
  const lonSpan = Math.max(0.001, bounds.east - bounds.west);
  const latSpan = Math.max(0.001, bounds.north - bounds.south);
  return {
    x: clamp(((safeNumber(position.lon, bounds.west) - bounds.west) / lonSpan) * CHART_WIDTH, 0, CHART_WIDTH),
    y: clamp(((bounds.north - safeNumber(position.lat, bounds.north)) / latSpan) * CHART_HEIGHT, 0, CHART_HEIGHT),
  };
}

export function formatChartCoordinate(position = {}) {
  const lat = safeNumber(position.lat, 0);
  const lon = safeNumber(position.lon, 0);
  const part = (value, positive, negative) => `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
  return `${part(lat, 'N', 'S')} ${part(lon, 'E', 'W')}`;
}

function deriveChartTheater(bounds) {
  const centerLon = (bounds.west + bounds.east) / 2;
  const centerLat = (bounds.north + bounds.south) / 2;
  if (centerLon < -30) return { id: 'west-atlantic', title: 'Carta Naval WA-29 · Atlântico Oeste', scale: '1:2.250.000' };
  if (centerLon > -8) return { id: 'approaches', title: 'Carta Naval EA-29 · Aproximações Europeias', scale: '1:1.650.000' };
  if (centerLat < 40) return { id: 'mediterranean', title: 'Carta Naval MS-29 · Mar Mediterrâneo', scale: '1:1.300.000' };
  return { id: 'north-atlantic', title: 'Carta Naval NA-29 · Atlântico Norte', scale: '1:1.850.000' };
}

function buildConvoyLanes(bounds) {
  return [
    {
      id: 'lane-hx', label: 'HX', threat: 'high',
      points: [pointFromRatio(bounds, .04, .66), pointFromRatio(bounds, .34, .55), pointFromRatio(bounds, .66, .45), pointFromRatio(bounds, .96, .34)],
    },
    {
      id: 'lane-sc', label: 'SC', threat: 'medium',
      points: [pointFromRatio(bounds, .02, .28), pointFromRatio(bounds, .31, .36), pointFromRatio(bounds, .63, .50), pointFromRatio(bounds, .98, .61)],
    },
    {
      id: 'lane-on', label: 'ON', threat: 'low',
      points: [pointFromRatio(bounds, .11, .83), pointFromRatio(bounds, .43, .72), pointFromRatio(bounds, .74, .64), pointFromRatio(bounds, .93, .51)],
    },
  ];
}

function buildHydrographicGrid(bounds) {
  const latLines = [];
  const lonLines = [];
  for (let i = 1; i <= 4; i += 1) latLines.push(lerp(bounds.north, bounds.south, i / 5));
  for (let i = 1; i <= 6; i += 1) lonLines.push(lerp(bounds.west, bounds.east, i / 7));
  return { latLines, lonLines };
}

function buildDangerZones({ navigation = {}, snapshot = {}, bounds }) {
  const zones = [];
  const sector = navigation.patrolSector;
  if (sector) {
    zones.push({
      id: 'patrol-risk',
      label: 'PATRULHA',
      level: navigation.patrolEntered ? 'controlled' : 'caution',
      type: 'rect',
      north: safeNumber(sector.north), south: safeNumber(sector.south), west: safeNumber(sector.west), east: safeNumber(sector.east),
    });
  }
  const aircraft = snapshot.navalAI?.aircraft || {};
  const airLevel = aircraft.state || snapshot.airThreat?.level || 'standby';
  if (aircraft.active || ['tracking', 'attack'].includes(airLevel)) {
    const player = navigation.position || pointFromRatio(bounds, .5, .5);
    zones.push({
      id: 'air-sweep', label: airLevel === 'attack' ? 'ATAQUE AÉREO' : 'VARREDURA AÉREA', level: airLevel === 'attack' ? 'danger' : 'warning',
      type: 'circle', center: player, radius: airLevel === 'attack' ? 88 : 64,
    });
  }
  const aiState = snapshot.navalAI?.state || snapshot.navalAI?.globalState || '';
  if (String(aiState).includes('hunt')) {
    const player = navigation.position || pointFromRatio(bounds, .5, .5);
    zones.push({ id: 'escort-hunt', label: 'ESCOLTAS', level: 'danger', type: 'circle', center: player, radius: 72 });
  }
  return zones;
}

function buildQuadrants(bounds) {
  return [
    { id: 'q-nw', label: 'A1', point: pointFromRatio(bounds, .14, .14) },
    { id: 'q-ne', label: 'A2', point: pointFromRatio(bounds, .86, .14) },
    { id: 'q-sw', label: 'B1', point: pointFromRatio(bounds, .14, .86) },
    { id: 'q-se', label: 'B2', point: pointFromRatio(bounds, .86, .86) },
  ];
}

function summarizeRoute(route = [], activeWaypointIndex = 0) {
  return route.map((waypoint, index) => ({
    id: waypoint.id || `wp-${index + 1}`,
    label: `WP-${index + 1}`,
    index,
    active: index === activeWaypointIndex,
    completed: index < activeWaypointIndex,
    coordinate: formatChartCoordinate(waypoint),
    position: waypoint,
  }));
}

function buildContactMarkers(snapshot = {}) {
  const ships = Array.isArray(snapshot.navalAI?.ships) ? snapshot.navalAI.ships : [];
  return ships.map((ship) => ({
    id: ship.id || 'contact',
    role: ['target', 'convoy'].includes(ship.role) ? 'merchant' : 'escort',
    shipType: ship.shipType || ship.role || 'unknown',
    x: safeNumber(ship.x, 0),
    y: safeNumber(ship.y, 0),
    destroyed: Boolean(ship.destroyed || ship.active === false),
    labelKey: ship.destroyed || ship.active === false ? 'combatFeedback.map.eliminated' : 'combatFeedback.map.contact',
  }));
}

export function buildTacticalNavalChartView({ snapshot = {}, mission = {} } = {}) {
  const navigation = snapshot.navigation || mission.navigation || {};
  const bounds = normalizeBounds(navigation.mapBounds || mission.navigation?.mapBounds);
  const theater = deriveChartTheater(bounds);
  const route = Array.isArray(navigation.route) ? navigation.route : [];
  const activeWaypointIndex = Math.max(0, Math.floor(safeNumber(navigation.activeWaypointIndex, 0)));
  const position = navigation.position || mission.navigation?.origin || pointFromRatio(bounds, .5, .5);
  const routeSummary = summarizeRoute(route, activeWaypointIndex);
  const activeWaypoint = routeSummary.find((item) => item.active) || routeSummary.at(-1) || null;
  const convoyLanes = buildConvoyLanes(bounds);
  const dangerZones = buildDangerZones({ navigation, snapshot, bounds });
  const aircraftActive = Boolean(snapshot.navalAI?.aircraft?.active);
  const threatScore = Math.round(clamp((snapshot.detectionScore || 0) + (aircraftActive ? 24 : 0) + (dangerZones.some((zone) => zone.level === 'danger') ? 18 : 0), 0, 100));
  const status = threatScore >= 72 ? 'danger' : threatScore >= 42 ? 'warning' : navigation.patrolEntered ? 'controlled' : 'plotting';
  return {
    ...theater,
    phase: PHASE29_TACTICAL_NAVAL_CHART.phase,
    status,
    threatScore,
    bounds,
    boundsLabel: `${formatChartCoordinate({ lat: bounds.north, lon: bounds.west })} / ${formatChartCoordinate({ lat: bounds.south, lon: bounds.east })}`,
    position,
    positionLabel: formatChartCoordinate(position),
    routeSummary,
    activeWaypoint,
    convoyLanes,
    dangerZones,
    quadrants: buildQuadrants(bounds),
    contactMarkers: buildContactMarkers(snapshot),
    grid: buildHydrographicGrid(bounds),
    patrolEntered: Boolean(navigation.patrolEntered),
    routeComplete: Boolean(navigation.routeComplete),
    layers: PHASE29_TACTICAL_NAVAL_CHART.layers,
  };
}
