const EARTH_NM_PER_DEGREE = 60;
const VALID_COMPRESSIONS = Object.freeze([1, 2, 4, 8, 16]);
const SPEED_KNOTS = Object.freeze({ stop: 0, slow: 3, half: 6, full: 10, flank: 14 });
const RUDDER_LIMIT = 35;
const WAYPOINT_REACHED_NM = 0.22;
const MAX_ROUTE_POINTS = 8;

export function normalizeHeading(value) {
  const number = Number(value) || 0;
  return ((number % 360) + 360) % 360;
}

export function shortestHeadingDelta(from, to) {
  return ((normalizeHeading(to) - normalizeHeading(from) + 540) % 360) - 180;
}

export function distanceNm(a, b) {
  const latA = Number(a?.lat) || 0;
  const latB = Number(b?.lat) || 0;
  const meanLat = ((latA + latB) / 2) * Math.PI / 180;
  const dy = (latB - latA) * EARTH_NM_PER_DEGREE;
  const dx = ((Number(b?.lon) || 0) - (Number(a?.lon) || 0)) * EARTH_NM_PER_DEGREE * Math.max(0.15, Math.cos(meanLat));
  return Math.hypot(dx, dy);
}

export function bearingDegrees(a, b) {
  const latA = Number(a?.lat) || 0;
  const latB = Number(b?.lat) || 0;
  const meanLat = ((latA + latB) / 2) * Math.PI / 180;
  const north = (latB - latA) * EARTH_NM_PER_DEGREE;
  const east = ((Number(b?.lon) || 0) - (Number(a?.lon) || 0)) * EARTH_NM_PER_DEGREE * Math.max(0.15, Math.cos(meanLat));
  return normalizeHeading(Math.atan2(east, north) * 180 / Math.PI);
}

export function movePosition(position, heading, distance) {
  const radians = normalizeHeading(heading) * Math.PI / 180;
  const northNm = Math.cos(radians) * distance;
  const eastNm = Math.sin(radians) * distance;
  const nextLat = position.lat + northNm / EARTH_NM_PER_DEGREE;
  const cosLat = Math.max(0.15, Math.cos(((position.lat + nextLat) / 2) * Math.PI / 180));
  return {
    lat: nextLat,
    lon: position.lon + eastNm / (EARTH_NM_PER_DEGREE * cosLat),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function cloneWaypoint(item, index = 0) {
  return {
    id: String(item?.id || `wp-${index + 1}`),
    lat: Number(item?.lat) || 0,
    lon: Number(item?.lon) || 0,
    labelKey: typeof item?.labelKey === 'string' ? item.labelKey : null,
    custom: Boolean(item?.custom),
  };
}

function defaultNavigation(mission = {}) {
  const seed = Math.max(1, Number.parseInt(String(mission.id || '1').replace(/\D/g, ''), 10) || 1);
  const origin = { lat: 48 + (seed % 3) * 0.08, lon: -16.2 + (seed % 4) * 0.07 };
  return {
    mapBounds: { north: 50.5, south: 46.5, west: -19.5, east: -11.5 },
    origin,
    heading: 72,
    patrolSector: { id: `sector-${seed}`, labelKey: 'navigation.sectorAtlantic', north: 49.2, south: 48.4, west: -14.8, east: -13.4 },
    route: [
      { id: 'wp-1', lat: origin.lat + 0.03, lon: origin.lon + 0.11, labelKey: 'navigation.waypointDeparture' },
      { id: 'wp-2', lat: 48.62, lon: -14.62, labelKey: 'navigation.waypointApproach' },
      { id: 'wp-3', lat: 48.82, lon: -14.08, labelKey: 'navigation.waypointPatrol' },
    ],
  };
}

export class NavigationSystem {
  constructor({ mission = {}, submarine = null, initialSnapshot = null } = {}) {
    this.missionId = mission?.id || null;
    this.config = mission?.navigation || defaultNavigation(mission);
    const origin = this.config.origin || { lat: 48, lon: -16 };
    this.position = { lat: Number(origin.lat) || 0, lon: Number(origin.lon) || 0 };
    this.heading = normalizeHeading(this.config.heading ?? 0);
    this.orderedHeading = this.heading;
    this.rudder = 0;
    this.autopilot = true;
    this.route = (this.config.route || []).slice(0, MAX_ROUTE_POINTS).map(cloneWaypoint);
    this.originalRoute = this.route.map(cloneWaypoint);
    this.activeWaypointIndex = 0;
    this.requestedTimeCompression = 1;
    this.timeCompression = 1;
    this.safetyLimit = 16;
    this.safetyLimited = false;
    this.simulatedElapsedMs = 0;
    this.distanceTravelledNm = 0;
    this.speedKnots = 0;
    this.patrolEntered = false;
    this.routeComplete = this.route.length === 0;
    this.customWaypointSerial = 0;
    this.submarineSpeedFactor = clamp(0.8 + (Number(submarine?.stats?.speed) || 50) / 250, 0.82, 1.2);
    if (initialSnapshot) this.restore(initialSnapshot);
  }

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (snapshot.missionId && this.missionId && snapshot.missionId !== this.missionId) return false;
    const position = snapshot.position || {};
    if (Number.isFinite(Number(position.lat)) && Number.isFinite(Number(position.lon))) {
      this.position = { lat: Number(position.lat), lon: Number(position.lon) };
    }
    this.heading = normalizeHeading(snapshot.heading ?? this.heading);
    this.orderedHeading = normalizeHeading(snapshot.orderedHeading ?? this.heading);
    this.rudder = clamp(snapshot.rudder, -RUDDER_LIMIT, RUDDER_LIMIT);
    this.autopilot = Boolean(snapshot.autopilot);
    if (Array.isArray(snapshot.route)) this.route = snapshot.route.slice(0, MAX_ROUTE_POINTS).map(cloneWaypoint);
    this.activeWaypointIndex = Math.floor(clamp(snapshot.activeWaypointIndex, 0, Math.max(0, this.route.length)));
    this.requestedTimeCompression = VALID_COMPRESSIONS.includes(Number(snapshot.requestedTimeCompression)) ? Number(snapshot.requestedTimeCompression) : 1;
    this.timeCompression = VALID_COMPRESSIONS.includes(Number(snapshot.timeCompression)) ? Number(snapshot.timeCompression) : 1;
    this.safetyLimit = VALID_COMPRESSIONS.includes(Number(snapshot.safetyLimit)) ? Number(snapshot.safetyLimit) : 16;
    this.safetyLimited = Boolean(snapshot.safetyLimited);
    this.simulatedElapsedMs = Math.max(0, Number(snapshot.simulatedElapsedMs) || 0);
    this.distanceTravelledNm = Math.max(0, Number(snapshot.distanceTravelledNm) || 0);
    this.patrolEntered = Boolean(snapshot.patrolEntered);
    this.routeComplete = Boolean(snapshot.routeComplete) || this.activeWaypointIndex >= this.route.length;
    this.customWaypointSerial = Math.max(0, Math.floor(Number(snapshot.customWaypointSerial) || 0));
    return true;
  }

  setRudder(value) {
    this.rudder = clamp(value, -RUDDER_LIMIT, RUDDER_LIMIT);
    if (Math.abs(this.rudder) > 0.01) this.autopilot = false;
    return this.snapshot();
  }

  nudgeHeading(delta) {
    this.orderedHeading = normalizeHeading(this.orderedHeading + Number(delta || 0));
    this.autopilot = true;
    return this.snapshot();
  }

  setOrderedHeading(value) {
    this.orderedHeading = normalizeHeading(value);
    this.autopilot = true;
    return this.snapshot();
  }

  toggleAutopilot(force = null) {
    this.autopilot = force === null ? !this.autopilot : Boolean(force);
    if (this.autopilot) this.rudder = 0;
    return this.autopilot;
  }

  setSafetyLimit(maximum) {
    const allowed = VALID_COMPRESSIONS.filter((value) => value <= Number(maximum || 1));
    this.safetyLimit = allowed.at(-1) || 1;
    const effective = VALID_COMPRESSIONS.filter((value) => value <= Math.min(this.requestedTimeCompression, this.safetyLimit)).at(-1) || 1;
    this.safetyLimited = effective < this.requestedTimeCompression;
    this.timeCompression = effective;
    return this.timeCompression;
  }

  requestTimeCompression(value, safetyLimit = this.safetyLimit) {
    const requested = Number(value);
    if (!VALID_COMPRESSIONS.includes(requested)) return { ok: false, reason: 'invalidCompression', value: this.timeCompression };
    this.requestedTimeCompression = requested;
    const effective = this.setSafetyLimit(safetyLimit);
    return { ok: true, limited: effective !== requested, value: effective, requested };
  }

  addWaypoint(lat, lon) {
    if (this.route.length >= MAX_ROUTE_POINTS) return { ok: false, reason: 'routeFull' };
    const bounds = this.config.mapBounds || {};
    const waypoint = cloneWaypoint({
      id: `custom-${++this.customWaypointSerial}`,
      lat: clamp(lat, Number(bounds.south ?? -90), Number(bounds.north ?? 90)),
      lon: clamp(lon, Number(bounds.west ?? -180), Number(bounds.east ?? 180)),
      labelKey: 'navigation.waypointCustom',
      custom: true,
    }, this.route.length);
    this.route.push(waypoint);
    this.routeComplete = false;
    if (this.activeWaypointIndex >= this.route.length) this.activeWaypointIndex = this.route.length - 1;
    return { ok: true, waypoint };
  }

  removeLastWaypoint() {
    if (!this.route.length) return { ok: false, reason: 'emptyRoute' };
    const removed = this.route.pop();
    this.activeWaypointIndex = Math.min(this.activeWaypointIndex, Math.max(0, this.route.length - 1));
    this.routeComplete = this.route.length === 0;
    return { ok: true, waypoint: removed };
  }

  resetRoute() {
    this.route = this.originalRoute.map(cloneWaypoint);
    this.activeWaypointIndex = 0;
    this.routeComplete = this.route.length === 0;
    this.autopilot = true;
    return this.snapshot();
  }

  advanceWaypoint() {
    if (!this.route.length) return { ok: false, reason: 'emptyRoute' };
    this.activeWaypointIndex += 1;
    if (this.activeWaypointIndex >= this.route.length) {
      this.activeWaypointIndex = this.route.length;
      this.routeComplete = true;
      this.autopilot = false;
      this.rudder = 0;
    }
    return { ok: true, complete: this.routeComplete };
  }

  activeWaypoint() {
    return this.route[this.activeWaypointIndex] || null;
  }

  insidePatrolSector(position = this.position) {
    const sector = this.config.patrolSector;
    if (!sector) return false;
    return position.lat <= Number(sector.north) && position.lat >= Number(sector.south)
      && position.lon <= Number(sector.east) && position.lon >= Number(sector.west);
  }

  routeDistanceNm() {
    let total = 0;
    let from = this.position;
    for (let index = this.activeWaypointIndex; index < this.route.length; index += 1) {
      total += distanceNm(from, this.route[index]);
      from = this.route[index];
    }
    return total;
  }

  update(stepMs, telegraphSpeed = 'stop', safetyLimit = 16, actualSpeedKnots = null) {
    this.setSafetyLimit(safetyLimit);
    const simulatedMs = Math.max(0, Number(stepMs) || 0) * this.timeCompression;
    this.simulatedElapsedMs += simulatedMs;
    const waypoint = this.activeWaypoint();
    if (this.autopilot && waypoint) this.orderedHeading = bearingDegrees(this.position, waypoint);

    const headingError = shortestHeadingDelta(this.heading, this.orderedHeading);
    if (this.autopilot) this.rudder = clamp(headingError * 1.7, -RUDDER_LIMIT, RUDDER_LIMIT);
    const speedBase = SPEED_KNOTS[telegraphSpeed] ?? 0;
    const requestedActual = actualSpeedKnots === null || actualSpeedKnots === undefined ? Number.NaN : Number(actualSpeedKnots);
    this.speedKnots = Number.isFinite(requestedActual) ? Math.max(0, requestedActual) : speedBase * this.submarineSpeedFactor;
    const speedFactor = Math.min(1, this.speedKnots / 5);
    const turnRateDegreesPerSecond = (this.rudder / RUDDER_LIMIT) * (0.72 + speedFactor * 0.55);
    this.heading = normalizeHeading(this.heading + turnRateDegreesPerSecond * (simulatedMs / 1000));

    const travelled = this.speedKnots * (simulatedMs / 3600000);
    if (travelled > 0) {
      this.position = movePosition(this.position, this.heading, travelled);
      this.distanceTravelledNm += travelled;
    }

    const current = this.activeWaypoint();
    if (current && distanceNm(this.position, current) <= WAYPOINT_REACHED_NM) this.advanceWaypoint();
    if (this.insidePatrolSector()) this.patrolEntered = true;
    return this.snapshot();
  }

  snapshot() {
    const waypoint = this.activeWaypoint();
    const distance = waypoint ? distanceNm(this.position, waypoint) : 0;
    const routeDistance = this.routeDistanceNm();
    const etaHours = this.speedKnots > 0.05 ? routeDistance / this.speedKnots : null;
    return {
      missionId: this.missionId,
      position: { lat: this.position.lat, lon: this.position.lon },
      heading: this.heading,
      orderedHeading: this.orderedHeading,
      rudder: this.rudder,
      autopilot: this.autopilot,
      route: this.route.map(cloneWaypoint),
      originalRoute: this.originalRoute.map(cloneWaypoint),
      activeWaypointIndex: this.activeWaypointIndex,
      activeWaypointId: waypoint?.id || null,
      nextWaypointDistanceNm: distance,
      nextWaypointBearing: waypoint ? bearingDegrees(this.position, waypoint) : this.heading,
      routeDistanceNm: routeDistance,
      routeComplete: this.routeComplete,
      requestedTimeCompression: this.requestedTimeCompression,
      timeCompression: this.timeCompression,
      safetyLimit: this.safetyLimit,
      safetyLimited: this.safetyLimited,
      simulatedElapsedMs: this.simulatedElapsedMs,
      distanceTravelledNm: this.distanceTravelledNm,
      speedKnots: this.speedKnots,
      etaHours,
      patrolSector: this.config.patrolSector ? { ...this.config.patrolSector } : null,
      mapBounds: this.config.mapBounds ? { ...this.config.mapBounds } : null,
      patrolEntered: this.patrolEntered,
      customWaypointSerial: this.customWaypointSerial,
      navigationVersion: 1,
    };
  }
}

export const NAVIGATION_CONSTANTS = Object.freeze({
  VALID_COMPRESSIONS, SPEED_KNOTS, RUDDER_LIMIT, WAYPOINT_REACHED_NM, MAX_ROUTE_POINTS,
});
