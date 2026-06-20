function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function activeShips(ships = [], roles = []) {
  return ships.filter((ship) => roles.includes(ship.role) && !ship.destroyed);
}

function averageMerchantSpacing(merchants = []) {
  if (merchants.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < merchants.length; i += 1) {
    for (let j = i + 1; j < merchants.length; j += 1) {
      total += Math.hypot(Number(merchants[i].x || 0) - Number(merchants[j].x || 0), Number(merchants[i].y || 0) - Number(merchants[j].y || 0));
      pairs += 1;
    }
  }
  return pairs ? total / pairs : 0;
}

export function analyzeConvoyDoctrine({ navalAI = {}, environment = {}, sensors = {}, physics = {}, weapons = {}, encounter = {} } = {}) {
  const profile = navalAI.profile || {};
  const ships = Array.isArray(navalAI.ships) ? navalAI.ships : [];
  const merchants = activeShips(ships, ['target', 'convoy']);
  const escorts = activeShips(ships, ['escort', 'escort-support']);
  const merchantCount = Math.max(1, Number(profile.merchantCount || navalAI.totalShips || merchants.length || 1));
  const escortCount = Math.max(1, Number(profile.escortCount || escorts.length || 1));
  const destroyedShips = clamp(navalAI.destroyedShips || ships.filter((ship) => ship.destroyed).length, 0, 30);
  const state = navalAI.globalState || navalAI.state?.globalState || 'formation';
  const threatLevel = navalAI.threatLevel || 'clear';
  const confidence = clamp(navalAI.contactConfidence || 0, 0, 100);
  const enemySolution = clamp(navalAI.attackSolution || encounter.enemySolution || 0, 0, 100);
  const nearestEscort = Number.isFinite(Number(navalAI.nearestEscortRange)) ? Number(navalAI.nearestEscortRange) : 999;
  const seaState = clamp(environment.seaState || 0, 0, 6);
  const visualFactor = clamp(environment.visualFactor ?? 1, 0.12, 1.2);
  const cover = clamp((1 - visualFactor) * 58 + (environment.precipitation || 0) * 0.15 + seaState * 4.8, 0, 100);
  const ownNoise = clamp(physics.noise || sensors.ownNoise || 0, 0, 100);
  const spacing = averageMerchantSpacing(merchants);

  const formationIntegrity = clamp((merchants.length / merchantCount) * 100 - destroyedShips * 9 - (state === 'regroup' ? 8 : 0), 0, 100);
  const escortDensity = clamp((escorts.length / escortCount) * 100, 0, 100);
  const closeEscortPressure = nearestEscort < 70 ? 35 : nearestEscort < 130 ? 24 : nearestEscort < 220 ? 12 : 3;
  const escortScreen = clamp(escortDensity * 0.46 + confidence * 0.24 + enemySolution * 0.18 + closeEscortPressure, 0, 100);
  const zigzagIntensity = clamp((state === 'formation' ? 18 : state === 'regroup' ? 32 : state === 'alert' ? 54 : state === 'search' ? 66 : 82) + seaState * 2.6 + destroyedShips * 2, 0, 100);
  const interceptWindow = clamp(100 - escortScreen * 0.45 - zigzagIntensity * 0.24 + cover * 0.35 + (formationIntegrity < 55 ? 10 : 0) - ownNoise * 0.08, 0, 100);
  const convoySpacing = round(spacing * 4);
  const screenRangeMeters = Number.isFinite(nearestEscort) ? round(nearestEscort * 4) : null;

  let doctrineKey = 'convoy.doctrine.formation';
  if (state === 'hunt' || threatLevel === 'critical') doctrineKey = 'convoy.doctrine.hunt';
  else if (state === 'search') doctrineKey = 'convoy.doctrine.search';
  else if (state === 'alert') doctrineKey = 'convoy.doctrine.alert';
  else if (state === 'regroup') doctrineKey = 'convoy.doctrine.regroup';

  let recommendationKey = 'convoy.recommend.shadow';
  if (enemySolution >= 74 || escortScreen >= 78 || nearestEscort < 78) recommendationKey = 'convoy.recommend.deepSilent';
  else if (interceptWindow >= 70 && formationIntegrity <= 82) recommendationKey = 'convoy.recommend.attackWindow';
  else if (cover >= 62 && interceptWindow >= 48) recommendationKey = 'convoy.recommend.periscope';
  else if (zigzagIntensity >= 64) recommendationKey = 'convoy.recommend.waitCourse';

  const posture = recommendationKey.includes('deep') ? 'defensive' : recommendationKey.includes('attack') ? 'attack' : recommendationKey.includes('periscope') ? 'shadow' : 'hold';
  const risk = clamp(escortScreen * 0.38 + enemySolution * 0.34 + (100 - interceptWindow) * 0.18 + (threatLevel === 'critical' ? 14 : threatLevel === 'warning' ? 6 : 0), 0, 100);

  return {
    formationIntegrity: round(formationIntegrity),
    escortScreen: round(escortScreen),
    zigzagIntensity: round(zigzagIntensity),
    interceptWindow: round(interceptWindow),
    convoySpacingMeters: convoySpacing,
    screenRangeMeters,
    doctrineKey,
    recommendationKey,
    posture,
    risk: round(risk),
    state,
    activeMerchants: merchants.length,
    activeEscorts: escorts.length,
    phase25Version: 1,
  };
}
