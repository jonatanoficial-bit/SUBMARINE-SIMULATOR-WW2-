export const PHASE31_VISUAL_HORIZON_CONTACTS = Object.freeze({
  phase: '31',
  system: 'visual-horizon-contacts',
  version: 'v2.0.0-alpha.46',
  mobileFirst: true,
  layers: ['ship-silhouettes', 'smoke-plumes', 'mast-lines', 'aircraft-shadow', 'fog-depth'],
});

const CONTACT_ROLE_LABELS = Object.freeze({
  target: 'horizonContacts.contactMerchant',
  escort: 'horizonContacts.contactEscort',
  aircraft: 'horizonContacts.contactAircraft',
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeAngle(value) {
  const number = Number(value) || 0;
  return ((number % 360) + 360) % 360;
}

function signedAngleDelta(a, b) {
  return ((normalizeAngle(a) - normalizeAngle(b) + 540) % 360) - 180;
}

function bearingFromWorld(entity = {}) {
  return normalizeAngle(Math.atan2(safeNumber(entity.x), -safeNumber(entity.y)) * 180 / Math.PI);
}

function rangeMeters(entity = {}) {
  return Math.hypot(safeNumber(entity.x), safeNumber(entity.y)) * 4;
}

function viewBearing(view = {}) {
  return bearingFromWorld({ x: safeNumber(view.x), y: safeNumber(view.y, -1) });
}

function classifyVisibility({ range, visualRange, visualFactor, confidence = 0, role = 'target' }) {
  if (role === 'aircraft') return confidence >= 42 || visualFactor >= 0.42 ? 'airborne' : 'lost';
  const ratio = range / Math.max(1, visualRange);
  if (ratio > 1.25 || visualFactor < 0.14) return 'lost';
  if (ratio > 0.92 || confidence < 28 || visualFactor < 0.32) return 'ghost';
  if (ratio > 0.58 || confidence < 54) return 'probable';
  return 'firm';
}

function buildSurfaceContact({ id, role, entity = {}, contact = {}, snapshot = {}, environment = {}, fovDegrees = 70 }) {
  const range = rangeMeters(entity);
  const visualRange = Math.max(700, safeNumber(snapshot.sensors?.profile?.currentVisualRangeMeters || environment.visibilityMeters, 6000));
  const visualFactor = clamp(safeNumber(environment.visualFactor, 1), 0.12, 1.18);
  const confidence = clamp(contact.confidence ?? (contact.detected ? 46 : 0), 0, 100);
  const bearing = bearingFromWorld(entity);
  const relative = signedAngleDelta(bearing, viewBearing(snapshot.view || {}));
  const halfFov = Math.max(18, fovDegrees / 2);
  const inField = Math.abs(relative) <= halfFov + 8;
  const state = classifyVisibility({ range, visualRange, visualFactor, confidence, role });
  const visible = Boolean(snapshot.periscopeOpen) && inField && state !== 'lost' && !entity.destroyed;
  const rangeRatio = clamp(range / Math.max(1000, visualRange), 0, 1.4);
  const left = clamp(50 + (relative / halfFov) * 44, 4, 96);
  const baseBottom = clamp(42 - rangeRatio * 13 + safeNumber(environment.horizonOffset) * 0.08, 20, 48);
  const scale = clamp((1.2 - rangeRatio * 0.72) * safeNumber(snapshot.periscopeZoom, 1), 0.32, 1.18);
  const opacity = clamp((0.28 + visualFactor * 0.58 + confidence * 0.004) * (state === 'ghost' ? 0.68 : 1), 0.18, 1);
  const blur = clamp((1 - visualFactor) * 2.4 + rangeRatio * 0.8 + (state === 'ghost' ? 0.9 : 0), 0, 3.4);
  return {
    id,
    role,
    labelKey: CONTACT_ROLE_LABELS[role] || CONTACT_ROLE_LABELS.target,
    visible,
    state,
    bearing,
    bearingLabel: `${String(Math.round(bearing)).padStart(3, '0')}°`,
    relativeBearing: Math.round(relative),
    rangeMeters: Math.round(range),
    rangeLabel: range >= 1000 ? `${(range / 1000).toFixed(1)} km` : `${Math.round(range)} m`,
    confidence: Math.round(confidence),
    hasSmoke: visible && role !== 'escort' && (rangeRatio <= 1.05 || confidence >= 48),
    hasMasts: visible && (state === 'firm' || state === 'probable'),
    style: `--h-left:${left.toFixed(2)}%;--h-bottom:${baseBottom.toFixed(2)}%;--h-scale:${scale.toFixed(3)};--h-opacity:${opacity.toFixed(3)};--h-blur:${blur.toFixed(2)}px;`,
  };
}

function buildAircraftContact({ snapshot = {}, environment = {}, fovDegrees = 70 }) {
  const aircraft = snapshot.navalAI?.aircraft || snapshot.airThreat || {};
  const active = Boolean(aircraft.active || ['tracking', 'attack', 'patrol'].includes(aircraft.state || aircraft.level));
  if (!active) return null;
  const bearing = normalizeAngle(aircraft.bearing ?? aircraft.approachBearing ?? (viewBearing(snapshot.view || {}) + 18));
  const relative = signedAngleDelta(bearing, viewBearing(snapshot.view || {}));
  const halfFov = Math.max(18, fovDegrees / 2);
  const confidence = clamp(aircraft.confidence ?? aircraft.detectionConfidence ?? 54, 0, 100);
  const visualFactor = clamp(safeNumber(environment.visualFactor, 1), 0.12, 1.18);
  const visible = Boolean(snapshot.periscopeOpen) && Math.abs(relative) <= halfFov + 15 && visualFactor >= 0.2;
  const left = clamp(50 + (relative / halfFov) * 40, 7, 93);
  const top = clamp(18 + (1 - visualFactor) * 8 + (aircraft.state === 'attack' ? 3 : 0), 12, 34);
  const scale = aircraft.state === 'attack' ? 1.08 : aircraft.state === 'tracking' ? 0.82 : 0.64;
  return {
    id: 'aircraft-horizon',
    role: 'aircraft',
    labelKey: CONTACT_ROLE_LABELS.aircraft,
    visible,
    state: aircraft.state || aircraft.level || 'patrol',
    bearing,
    bearingLabel: `${String(Math.round(bearing)).padStart(3, '0')}°`,
    relativeBearing: Math.round(relative),
    rangeMeters: null,
    rangeLabel: '--',
    confidence: Math.round(confidence),
    hasSmoke: false,
    hasMasts: false,
    style: `--h-left:${left.toFixed(2)}%;--h-top:${top.toFixed(2)}%;--h-scale:${scale.toFixed(3)};--h-opacity:${clamp(0.3 + confidence / 120, 0.2, 0.95).toFixed(3)};--h-blur:${clamp((1 - visualFactor) * 1.5, 0, 2).toFixed(2)}px;`,
  };
}

function fogBand(environment = {}) {
  const visual = clamp(safeNumber(environment.visualFactor, 1), 0.12, 1.18);
  const precipitation = clamp(safeNumber(environment.precipitation, 0), 0, 100);
  if (visual < 0.28 || precipitation > 72) return 'heavy';
  if (visual < 0.52 || precipitation > 42) return 'medium';
  return 'light';
}

function chooseReport(contacts = []) {
  const visible = contacts.filter((item) => item.visible && item.role !== 'aircraft');
  const aircraft = contacts.find((item) => item.visible && item.role === 'aircraft');
  if (aircraft) return { key: 'horizonContacts.reportAircraft', priority: 'danger' };
  if (visible.length >= 2) return { key: 'horizonContacts.reportMultiple', priority: 'warning' };
  if (visible[0]?.role === 'escort') return { key: 'horizonContacts.reportEscort', priority: 'warning' };
  if (visible[0]?.role === 'target') return { key: 'horizonContacts.reportTarget', priority: 'contact' };
  return { key: 'horizonContacts.reportClear', priority: 'clear' };
}

export function buildHorizonContactView({ snapshot = {}, periscopeZoom = 1 } = {}) {
  const environment = snapshot.environment || {};
  const fovDegrees = clamp(72 / Math.max(1, safeNumber(periscopeZoom, 1)), 24, 76);
  const richSnapshot = { ...snapshot, periscopeZoom };
  const contacts = [
    buildSurfaceContact({ id: 'merchant-horizon', role: 'target', entity: snapshot.target || {}, contact: snapshot.sensors?.contacts?.target || {}, snapshot: richSnapshot, environment, fovDegrees }),
    buildSurfaceContact({ id: 'escort-horizon', role: 'escort', entity: snapshot.escort || {}, contact: snapshot.sensors?.contacts?.escort || {}, snapshot: richSnapshot, environment, fovDegrees }),
    buildAircraftContact({ snapshot: richSnapshot, environment, fovDegrees }),
  ].filter(Boolean);
  const visibleContacts = contacts.filter((item) => item.visible);
  const report = chooseReport(contacts);
  return {
    phase: PHASE31_VISUAL_HORIZON_CONTACTS.phase,
    system: PHASE31_VISUAL_HORIZON_CONTACTS.system,
    fovDegrees,
    fogBand: fogBand(environment),
    visualFactor: clamp(safeNumber(environment.visualFactor, 1), 0.12, 1.18),
    contacts,
    visibleContacts,
    visibleCount: visibleContacts.length,
    smokeCount: contacts.filter((item) => item.hasSmoke).length,
    mastCount: contacts.filter((item) => item.hasMasts).length,
    reportKey: report.key,
    priority: report.priority,
    layers: PHASE31_VISUAL_HORIZON_CONTACTS.layers,
  };
}
