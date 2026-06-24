const phase25Clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const phase25Round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

export const PHASE25_COMMAND_ROOM = Object.freeze({
  phase: 25,
  operation: 'Silent Depth',
  visualProfile: 'immersive-submarine-command-room',
  mobilePriority: true,
  cockpitMode: 'cinematic-bridge'
});

export function classifyCommandRoomViewport({ width = 1280, height = 720 } = {}) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const compact = w <= 680 || h <= 540;
  const landscapeMobile = w <= 920 && h <= 520;
  return {
    mode: compact ? 'mobile-cabin' : landscapeMobile ? 'mobile-landscape-cabin' : 'full-command-room',
    hideDecor: w <= 360 || h <= 460,
    instrumentColumns: compact ? 2 : 5,
    showCrewSilhouettes: !compact || h >= 620,
    safePanelDensity: compact ? 'reduced' : 'cinematic'
  };
}

export function computeCommandRoomAmbience({ telemetry = {}, readiness = {}, strategicAssessment = {}, mission = {}, tick = 0 } = {}) {
  const pressure = phase25Clamp(telemetry.pressure, 0, 120);
  const detection = phase25Clamp(telemetry.detection, 0, 100);
  const oxygen = phase25Clamp(telemetry.oxygen ?? 100, 0, 100);
  const battery = phase25Clamp(telemetry.battery ?? 100, 0, 100);
  const hull = phase25Clamp(telemetry.hull ?? 100, 0, 100);
  const risk = phase25Clamp(strategicAssessment.risk ?? strategicAssessment.aswRisk ?? 0, 0, 100);
  const readinessOverall = phase25Clamp(readiness.overall ?? readiness.readiness ?? 72, 0, 100);
  const difficulty = { I: 1, II: 2, III: 3, IV: 4, V: 5 }[String(mission.difficulty || 'II').toUpperCase()] || 2;
  const threatScore = phase25Clamp(
    detection * 0.36 + pressure * 0.24 + (100 - oxygen) * 0.12 + (100 - battery) * 0.10 + (100 - hull) * 0.18 + risk * 0.22 + difficulty * 3 - readinessOverall * 0.08,
    0,
    100
  );
  const alertLevel = threatScore >= 74 ? 'emergency' : threatScore >= 52 ? 'action-stations' : threatScore >= 30 ? 'watch' : 'quiet';
  const lightMode = alertLevel === 'emergency' ? 'red' : alertLevel === 'action-stations' ? 'amber' : alertLevel === 'watch' ? 'dim' : 'silent-blue';
  const redLampOpacity = phase25Round(alertLevel === 'emergency' ? 0.84 : alertLevel === 'action-stations' ? 0.52 : alertLevel === 'watch' ? 0.25 : 0.1, 2);
  const condensationOpacity = phase25Round(phase25Clamp((pressure / 120) * 0.42 + (100 - oxygen) / 260, 0.08, 0.62), 2);
  const vibration = phase25Round(phase25Clamp((telemetry.speed || 0) / 21 + pressure / 160 + threatScore / 240, 0.05, 1), 2);
  const crewMotion = alertLevel === 'emergency' ? 'rapid' : alertLevel === 'action-stations' ? 'busy' : alertLevel === 'watch' ? 'steady' : 'calm';
  const soundscape = alertLevel === 'emergency' ? 'alarm' : alertLevel === 'action-stations' ? 'tense' : alertLevel === 'watch' ? 'watch' : 'quiet';
  const tickPhase = phase25Round(Math.sin(Number(tick || 0) / 4) * 0.5 + 0.5, 2);
  return {
    alertLevel,
    lightMode,
    redLampOpacity,
    condensationOpacity,
    vibration,
    crewMotion,
    soundscape,
    tickPhase,
    threatScore: phase25Round(threatScore),
    orderPromptKey: `phase25.prompt.${alertLevel}`
  };
}

export function buildCommandRoomStations({ telemetry = {}, readiness = {}, strategicAssessment = {} } = {}) {
  const ready = phase25Clamp(readiness.overall ?? readiness.readiness ?? 72, 0, 100);
  const detection = phase25Clamp(telemetry.detection, 0, 100);
  const pressure = phase25Clamp(telemetry.pressure, 0, 120);
  const risk = phase25Clamp(strategicAssessment.risk ?? strategicAssessment.aswRisk ?? 0, 0, 100);
  const battery = phase25Clamp(telemetry.battery ?? 100, 0, 100);
  const oxygen = phase25Clamp(telemetry.oxygen ?? 100, 0, 100);
  const hull = phase25Clamp(telemetry.hull ?? 100, 0, 100);
  return [
    {
      id: 'helm', icon: 'assets/ui/instruments/helm_icon.png', labelKey: 'stabilization.stationCommand', statusKey: ready < 45 ? 'phase25.station.helm.tense' : 'phase25.station.helm.ready', severity: ready < 45 ? 'alert' : 'normal', value: ready
    },
    {
      id: 'sonar', icon: 'assets/ui/instruments/sonar_icon.png', labelKey: 'stabilization.stationSensors', statusKey: detection > 68 || risk > 66 ? 'phase25.station.sonar.contact' : 'phase25.station.sonar.listening', severity: detection > 74 ? 'critical' : detection > 52 ? 'alert' : 'normal', value: detection
    },
    {
      id: 'periscope', icon: 'assets/ui/instruments/periscope_icon.png', labelKey: 'bridge.station.periscope', statusKey: telemetry.depthZone === 'periscope' || telemetry.depth <= 18 ? 'phase25.station.periscope.available' : 'phase25.station.periscope.secured', severity: telemetry.depthZone === 'overdepth' || telemetry.depthZone === 'collapse' ? 'alert' : 'normal', value: phase25Clamp(100 - pressure * 0.6, 0, 100)
    },
    {
      id: 'torpedo', icon: 'assets/ui/instruments/torpedo_icon.png', labelKey: 'stabilization.stationWeapons', statusKey: detection > 42 ? 'phase25.station.torpedo.solution' : 'phase25.station.torpedo.standby', severity: detection > 65 ? 'alert' : 'normal', value: phase25Clamp(detection + ready * 0.25, 0, 100)
    },
    {
      id: 'engineering', icon: 'assets/ui/instruments/speed_telegraph_icon.png', labelKey: 'bridge.station.engines', statusKey: battery < 32 || oxygen < 42 || hull < 55 ? 'phase25.station.engine.strain' : 'phase25.station.engine.nominal', severity: battery < 25 || oxygen < 34 || hull < 45 ? 'critical' : battery < 40 || oxygen < 52 || hull < 65 ? 'alert' : 'normal', value: phase25Clamp((battery + oxygen + hull) / 3, 0, 100)
    }
  ];
}

export function commandRoomCssVars(ambience = {}) {
  const red = phase25Clamp(ambience.redLampOpacity ?? 0.12, 0, 1);
  const condensation = phase25Clamp(ambience.condensationOpacity ?? 0.16, 0, 1);
  const vibration = phase25Clamp(ambience.vibration ?? 0.12, 0, 1);
  return {
    '--phase25-red-opacity': String(red),
    '--phase25-condensation-opacity': String(condensation),
    '--phase25-vibration': String(vibration),
    '--phase25-lamp-phase': String(phase25Clamp(ambience.tickPhase ?? 0.2, 0, 1))
  };
}
