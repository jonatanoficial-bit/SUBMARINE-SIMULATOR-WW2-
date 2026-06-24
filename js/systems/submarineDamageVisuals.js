export const PHASE34_SUBMARINE_DAMAGE_VISUALS = Object.freeze({
  phase: '34',
  system: 'submarine-damage-visual-states',
  version: 'v2.0.0-alpha.49',
  layers: ['hull-state', 'compartment-flooding', 'fire-smoke', 'emergency-lighting', 'crew-reaction'],
  mobileFirst: true,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pct(value) { return `${Math.round(clamp(value, 0, 100))}%`; }

function worstCompartment(compartments = []) {
  return compartments.slice().sort((a, b) => {
    const scoreA = (100 - safeNumber(a.integrity, 100)) + safeNumber(a.flooding) + safeNumber(a.fire) + safeNumber(a.electricalDamage) * 0.65;
    const scoreB = (100 - safeNumber(b.integrity, 100)) + safeNumber(b.flooding) + safeNumber(b.fire) + safeNumber(b.electricalDamage) * 0.65;
    return scoreB - scoreA;
  })[0] || null;
}

function severityFromScore(score) {
  if (score >= 78) return 'critical';
  if (score >= 55) return 'emergency';
  if (score >= 30) return 'damaged';
  return 'stable';
}

function systemState(value) {
  const number = clamp(value, 0, 100);
  if (number <= 25) return 'critical';
  if (number <= 50) return 'damaged';
  if (number <= 75) return 'strained';
  return 'online';
}

function compartmentState(compartment = {}) {
  const flooding = clamp(compartment.flooding, 0, 100);
  const fire = clamp(compartment.fire, 0, 100);
  const integrity = clamp(compartment.integrity, 0, 100);
  if (flooding >= 70) return 'flooded';
  if (fire >= 60) return 'fire';
  if (integrity <= 35) return 'breached';
  if (flooding >= 30 || fire >= 25 || integrity <= 65) return 'damaged';
  return 'secure';
}

function buildCompartmentRows(compartments = []) {
  return compartments.slice(0, 8).map((compartment, index) => ({
    id: compartment.id || `room-${index + 1}`,
    name: compartment.name || compartment.label || compartment.id || `Setor ${index + 1}`,
    state: compartmentState(compartment),
    integrity: Math.round(clamp(compartment.integrity, 0, 100)),
    flooding: Math.round(clamp(compartment.flooding, 0, 100)),
    fire: Math.round(clamp(compartment.fire, 0, 100)),
    electrical: Math.round(clamp(compartment.electricalDamage, 0, 100)),
  }));
}

export function buildSubmarineDamageVisualView({ snapshot = {} } = {}) {
  const damage = snapshot.damageControl || {};
  const systems = damage.systems || snapshot.systems || {};
  const compartments = Array.isArray(damage.compartments) ? damage.compartments : [];
  const hull = clamp(damage.hullIntegrity ?? snapshot.hull, 0, 100);
  const pressure = clamp(damage.pressureIngress, 0, 100);
  const smoke = clamp(damage.smokeLoad, 0, 100);
  const flooding = clamp(damage.totalFlooding, 0, 100);
  const fire = clamp(damage.totalFire, 0, 100);
  const criticalRooms = safeNumber(damage.criticalCompartments);
  const stability = clamp(damage.compartmentStability, 0, 100);
  const battery = clamp(snapshot.physics?.battery, 0, 100);
  const oxygen = clamp(snapshot.physics?.oxygen, 0, 100);
  const score = clamp((100 - hull) * 0.38 + pressure * 0.22 + flooding * 0.22 + fire * 0.2 + smoke * 0.15 + criticalRooms * 9 + (100 - stability) * 0.25 + (battery < 20 ? 8 : 0) + (oxygen < 25 ? 9 : 0), 0, 100);
  const severity = severityFromScore(score);
  const worst = worstCompartment(compartments);
  const lights = severity === 'critical' ? 'red' : severity === 'emergency' ? 'amber-red' : severity === 'damaged' ? 'amber' : 'normal';
  const orderKey = severity === 'critical'
    ? 'damageVisual.orderCritical'
    : severity === 'emergency'
      ? 'damageVisual.orderEmergency'
      : severity === 'damaged'
        ? 'damageVisual.orderDamaged'
        : 'damageVisual.orderStable';
  const crewKey = damage.criticalFailure
    ? 'damageVisual.crewCritical'
    : fire >= 35
      ? 'damageVisual.crewFire'
      : flooding >= 35
        ? 'damageVisual.crewFlooding'
        : pressure >= 45
          ? 'damageVisual.crewPressure'
          : severity === 'damaged' ? 'damageVisual.crewDamage' : 'damageVisual.crewStable';
  return {
    phase: PHASE34_SUBMARINE_DAMAGE_VISUALS.phase,
    system: PHASE34_SUBMARINE_DAMAGE_VISUALS.system,
    severity,
    score,
    scoreLabel: pct(score),
    lights,
    hullLabel: pct(hull),
    stabilityLabel: pct(stability),
    floodingLabel: pct(flooding),
    fireLabel: pct(fire),
    smokeLabel: pct(smoke),
    pressureLabel: pct(pressure),
    orderKey,
    crewKey,
    worstCompartmentName: worst?.name || worst?.id || '--',
    worstCompartmentState: worst ? `damageVisual.room.${compartmentState(worst)}` : 'damageVisual.room.secure',
    systems: Object.fromEntries(['engines','sonar','periscope','weapons'].map((key) => [key, { value: Math.round(clamp(systems[key], 0, 100)), state: systemState(systems[key]) }])),
    compartments: buildCompartmentRows(compartments),
    effects: {
      smoke: smoke >= 12,
      flooding: flooding >= 12,
      sparks: Object.values(systems).some((value) => safeNumber(value, 100) <= 45) || fire >= 18,
      emergency: ['emergency','critical'].includes(severity),
    },
    cssVars: {
      '--phase34-damage-score': `${Math.round(score)}%`,
      '--phase34-hull': `${Math.round(hull)}%`,
      '--phase34-smoke': `${Math.round(smoke)}%`,
      '--phase34-flood': `${Math.round(flooding)}%`,
      '--phase34-fire': `${Math.round(fire)}%`,
    },
  };
}

export function shouldDamageVisualEscalate({ previous = null, next = null } = {}) {
  if (!next) return false;
  if (!previous) return ['emergency', 'critical'].includes(next.severity);
  const order = { stable: 0, damaged: 1, emergency: 2, critical: 3 };
  return (order[next.severity] || 0) > (order[previous.severity] || 0) || safeNumber(next.score) - safeNumber(previous.score) >= 18;
}
