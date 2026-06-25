export const PHASE39_LIVING_CREW_ROLES = Object.freeze({
  phase: '39',
  system: 'living-crew-roles',
  version: 'v2.0.0-alpha.54',
  roles: ['commander', 'executive', 'sonar', 'engineer', 'weapons', 'navigator'],
  mobileFirst: true,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pct(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

function roleStateFromStress(stress, readiness) {
  if (readiness <= 28 || stress >= 84) return 'critical';
  if (readiness <= 48 || stress >= 64) return 'strained';
  if (readiness >= 78 && stress <= 34) return 'sharp';
  return 'steady';
}

function roleCard({ id, titleKey, stationKey, stress, readiness, directiveKey, focusKey }) {
  const boundedStress = clamp(stress, 0, 100);
  const boundedReadiness = clamp(readiness, 0, 100);
  const state = roleStateFromStress(boundedStress, boundedReadiness);
  return {
    id,
    titleKey,
    stationKey,
    stress: Math.round(boundedStress),
    readiness: Math.round(boundedReadiness),
    stressLabel: pct(boundedStress),
    readinessLabel: pct(boundedReadiness),
    state,
    stateKey: `crewRoles.state.${state}`,
    directiveKey,
    focusKey,
  };
}

function commanderStress(snapshot = {}) {
  const ai = snapshot.navalAI || {};
  const alert = snapshot.alertAtmosphere || {};
  return clamp(
    safeNumber(snapshot.detectionScore) * 0.32
    + (snapshot.playerDetected ? 18 : 0)
    + (snapshot.torpedoActive ? 16 : 0)
    + (ai.threatLevel === 'critical' ? 18 : ai.threatLevel === 'warning' ? 9 : 0)
    + (alert.level === 'emergency' ? 16 : 0),
    0,
    100
  );
}

function engineerStress(snapshot = {}) {
  const damage = snapshot.damageControl || {};
  const physics = snapshot.physics || {};
  const systems = snapshot.systems || {};
  const weakestSystem = Math.min(...['engines', 'sonar', 'periscope', 'weapons'].map((key) => safeNumber(systems[key], 100)));
  return clamp(
    (100 - safeNumber(snapshot.hull, 100)) * 0.62
    + safeNumber(physics.pressurePercent || physics.pressure, 0) * 0.34
    + safeNumber(damage.totalFlooding, 0) * 0.32
    + safeNumber(damage.totalFire, 0) * 0.34
    + (100 - weakestSystem) * 0.22,
    0,
    100
  );
}

function sonarStress(snapshot = {}) {
  const sensors = snapshot.sensors || {};
  const ai = snapshot.navalAI || {};
  const contacts = sensors.contacts || {};
  const count = Object.values(contacts).filter((contact) => contact && contact.detected).length;
  return clamp(count * 14 + safeNumber(ai.contactConfidence, 0) * 0.34 + safeNumber(snapshot.physics?.noise, 0) * 0.22 + (snapshot.playerDetected ? 18 : 0), 0, 100);
}

function weaponsStress(snapshot = {}) {
  const weapons = snapshot.weapons || {};
  const tdc = weapons.tdc || {};
  return clamp(
    (snapshot.torpedoActive ? 36 : 0)
    + (weapons.canFire ? 10 : 0)
    + safeNumber(tdc.solutionQuality, 0) * 0.22
    + (safeNumber(weapons.reserveTorpedoes, 0) <= 2 ? 18 : 0),
    0,
    100
  );
}

function navigatorStress(snapshot = {}) {
  const navigation = snapshot.navigation || {};
  const aircraft = snapshot.navalAI?.aircraft || {};
  return clamp(
    safeNumber(navigation.route?.length || 0) * 7
    + (aircraft.active ? 16 : 0)
    + (snapshot.playerDetected ? 12 : 0)
    + (safeNumber(snapshot.physics?.fuel, 100) < 35 ? 18 : 0)
    + (navigation.patrolEntered ? 4 : 0),
    0,
    100
  );
}

function executiveStress(snapshot = {}) {
  const damage = engineerStress(snapshot);
  const command = commanderStress(snapshot);
  const stealth = safeNumber(snapshot.depthStealth?.signatureScore, 0);
  return clamp(command * 0.42 + damage * 0.32 + stealth * 0.18 + (snapshot.missionFailed ? 30 : 0), 0, 100);
}

function directiveFor(role, snapshot = {}) {
  const ai = snapshot.navalAI || {};
  const weapons = snapshot.weapons || {};
  const physics = snapshot.physics || {};
  const damage = snapshot.damageControl || {};
  if (role === 'commander') {
    if (snapshot.missionFailed || safeNumber(snapshot.hull, 100) <= 24) return 'crewRoles.directive.commanderAbandon';
    if (ai.threatLevel === 'critical' || snapshot.playerDetected) return 'crewRoles.directive.commanderEvasion';
    if (weapons.canFire) return 'crewRoles.directive.commanderAttack';
    return 'crewRoles.directive.commanderPatrol';
  }
  if (role === 'executive') {
    if (safeNumber(damage.totalFlooding, 0) > 28 || safeNumber(damage.totalFire, 0) > 20) return 'crewRoles.directive.executiveDamage';
    if (snapshot.playerDetected) return 'crewRoles.directive.executiveBattleStations';
    return 'crewRoles.directive.executiveRoutine';
  }
  if (role === 'sonar') {
    if (safeNumber(ai.contactConfidence, 0) >= 58) return 'crewRoles.directive.sonarContact';
    if (safeNumber(physics.noise, 0) >= 54) return 'crewRoles.directive.sonarNoise';
    return 'crewRoles.directive.sonarListen';
  }
  if (role === 'engineer') {
    if (safeNumber(physics.pressurePercent || physics.pressure, 0) >= 72) return 'crewRoles.directive.engineerPressure';
    if (safeNumber(damage.totalFlooding, 0) > 18) return 'crewRoles.directive.engineerFlooding';
    if (safeNumber(damage.totalFire, 0) > 12) return 'crewRoles.directive.engineerFire';
    return 'crewRoles.directive.engineerReady';
  }
  if (role === 'weapons') {
    if (snapshot.torpedoActive) return 'crewRoles.directive.weaponsRun';
    if (weapons.canFire) return 'crewRoles.directive.weaponsFire';
    if (safeNumber(weapons.tdc?.solutionQuality, 0) < safeNumber(weapons.minimumSolutionQuality, 42)) return 'crewRoles.directive.weaponsSolution';
    return 'crewRoles.directive.weaponsHold';
  }
  if (role === 'navigator') {
    if (snapshot.playerDetected || ai.aircraft?.active) return 'crewRoles.directive.navigatorEvasion';
    if (!snapshot.navigation?.route?.length) return 'crewRoles.directive.navigatorPlot';
    return 'crewRoles.directive.navigatorCourse';
  }
  return 'crewRoles.directive.executiveRoutine';
}

function focusFor(role, snapshot = {}) {
  if (role === 'commander') return snapshot.playerDetected ? 'crewRoles.focus.command' : 'crewRoles.focus.intent';
  if (role === 'executive') return 'crewRoles.focus.discipline';
  if (role === 'sonar') return 'crewRoles.focus.bearing';
  if (role === 'engineer') return 'crewRoles.focus.plant';
  if (role === 'weapons') return snapshot.weapons?.canFire ? 'crewRoles.focus.firing' : 'crewRoles.focus.tdc';
  if (role === 'navigator') return 'crewRoles.focus.route';
  return 'crewRoles.focus.intent';
}

export function buildLivingCrewRolesView({ snapshot = {}, station = 'command' } = {}) {
  const stresses = {
    commander: commanderStress(snapshot),
    executive: executiveStress(snapshot),
    sonar: sonarStress(snapshot),
    engineer: engineerStress(snapshot),
    weapons: weaponsStress(snapshot),
    navigator: navigatorStress(snapshot),
  };
  const readinessBase = {
    commander: 92,
    executive: 88,
    sonar: safeNumber(snapshot.systems?.sonar, 100),
    engineer: safeNumber(snapshot.systems?.engines, 100),
    weapons: safeNumber(snapshot.systems?.weapons, 100),
    navigator: 86,
  };
  const roles = PHASE39_LIVING_CREW_ROLES.roles.map((id) => roleCard({
    id,
    titleKey: `crewRoles.role.${id}`,
    stationKey: `crewRoles.station.${id}`,
    stress: stresses[id],
    readiness: clamp(readinessBase[id] - stresses[id] * 0.38 + (id === station ? 6 : 0), 0, 100),
    directiveKey: directiveFor(id, snapshot),
    focusKey: focusFor(id, snapshot),
  }));
  const overallReadiness = roles.reduce((sum, role) => sum + role.readiness, 0) / Math.max(1, roles.length);
  const dominantRole = roles.slice().sort((a, b) => b.stress - a.stress)[0] || roles[0];
  const morale = clamp(overallReadiness - Math.max(0, dominantRole.stress - 54) * 0.42 + safeNumber(snapshot.damageControl?.morale, 78) * 0.16, 0, 100);
  const commandState = morale <= 34 || dominantRole.state === 'critical'
    ? 'critical'
    : morale <= 56 || dominantRole.state === 'strained'
      ? 'strained'
      : morale >= 78 ? 'confident' : 'steady';
  return {
    phase: PHASE39_LIVING_CREW_ROLES.phase,
    system: PHASE39_LIVING_CREW_ROLES.system,
    version: PHASE39_LIVING_CREW_ROLES.version,
    station,
    roles,
    dominantRole,
    commandState,
    commandStateKey: `crewRoles.commandState.${commandState}`,
    summaryKey: dominantRole.directiveKey,
    overallReadiness: Math.round(overallReadiness),
    morale: Math.round(morale),
    labels: {
      readiness: pct(overallReadiness),
      morale: pct(morale),
      stress: pct(dominantRole.stress),
    },
    cssVars: {
      '--phase39-readiness': pct(overallReadiness),
      '--phase39-morale': pct(morale),
      '--phase39-stress': pct(dominantRole.stress),
    },
  };
}

export function shouldCrewRoleInterrupt({ previous, next } = {}) {
  if (!next) return false;
  if (!previous) return ['critical', 'strained'].includes(next.commandState);
  const order = { confident: 0, steady: 1, strained: 2, critical: 3 };
  return (order[next.commandState] || 0) > (order[previous.commandState] || 0)
    || next.dominantRole?.id !== previous.dominantRole?.id && next.dominantRole?.state === 'critical';
}
