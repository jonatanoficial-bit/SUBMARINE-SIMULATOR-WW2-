function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function round(value) {
  return Math.round(Number(value) || 0);
}

export function classifyOceanWeather({ environment = {}, physics = {}, sensors = {} } = {}) {
  const sea = clamp(environment.seaState ?? 0, 0, 6);
  const wind = clamp(environment.windKnots ?? 0, 0, 80);
  const rain = clamp(environment.precipitation ?? 0, 0, 100);
  const visibility = clamp(environment.visibilityMeters ?? 6000, 500, 16000);
  const ambientNoise = clamp(environment.ambientNoise ?? 10, 0, 100);
  const layer = clamp(environment.thermalLayerDepth ?? 32, 5, 140);
  const depth = clamp(physics.depth ?? 12, 0, 320);
  const daylight = clamp(environment.daylight ?? 60, 0, 100);
  const radarClutter = clamp(environment.radarClutter ?? 0, 0, 100);
  const ownNoise = clamp(physics.noise ?? sensors.ownNoise ?? 15, 0, 100);

  const seaSeverity = clamp(sea * 13 + wind * 0.7 + rain * 0.18, 0, 100);
  const coverScore = clamp((1 - visibility / 12000) * 46 + (100 - daylight) * 0.24 + rain * 0.2 + sea * 3.8, 0, 100);
  const surfaceRisk = clamp(sea * 9 + radarClutter * 0.42 + daylight * 0.21 + wind * 0.34 - coverScore * 0.28, 0, 100);
  const thermoclineStrength = clamp(40 - Math.abs(depth - layer) * 1.45 + sea * 2.4, 0, 100);
  const sonarDegradation = clamp(ambientNoise * 0.54 + ownNoise * 0.34 + sea * 2.6 - thermoclineStrength * 0.18, 0, 100);
  const periscopeDegradation = clamp((1 - visibility / 11000) * 55 + rain * 0.26 + sea * 5 + (100 - daylight) * 0.12, 0, 100);
  const navigationDriftRisk = clamp(sea * 8 + wind * 0.58 + rain * 0.12, 0, 100);

  let seaBand = 'calm';
  if (seaSeverity >= 78) seaBand = 'storm';
  else if (seaSeverity >= 55) seaBand = 'heavy';
  else if (seaSeverity >= 31) seaBand = 'moderate';

  let visibilityBand = 'clear';
  if (visibility < 2200 || daylight < 8) visibilityBand = 'blackout';
  else if (visibility < 4200) visibilityBand = 'restricted';
  else if (visibility < 7600 || rain > 42) visibilityBand = 'hazy';

  let adviceKey = 'ocean.advice.normal';
  if (surfaceRisk >= 72) adviceKey = 'ocean.advice.deep';
  else if (sonarDegradation >= 68) adviceKey = 'ocean.advice.silent';
  else if (coverScore >= 62 && periscopeDegradation < 58) adviceKey = 'ocean.advice.periscope';
  else if (navigationDriftRisk >= 62) adviceKey = 'ocean.advice.slow';

  const recommendedDepth = round(clamp(layer + (surfaceRisk >= 60 ? 18 : 6) - (thermoclineStrength >= 45 ? 4 : 0), 18, 115));

  return {
    seaSeverity: round(seaSeverity),
    seaBand,
    visibilityBand,
    coverScore: round(coverScore),
    surfaceRisk: round(surfaceRisk),
    thermoclineStrength: round(thermoclineStrength),
    sonarDegradation: round(sonarDegradation),
    periscopeDegradation: round(periscopeDegradation),
    navigationDriftRisk: round(navigationDriftRisk),
    recommendedDepth,
    adviceKey,
    isStorm: seaBand === 'storm',
    environmentVersion: environment.environmentVersion || 1,
  };
}

