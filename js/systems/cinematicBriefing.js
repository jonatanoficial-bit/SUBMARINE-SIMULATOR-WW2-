export const PHASE38_CINEMATIC_BRIEFING = Object.freeze({
  phase: '38',
  system: 'cinematic-mission-briefing',
  version: 'v2.0.0-alpha.53',
  layers: ['mission-dossier', 'theater-map', 'risk-board', 'weather-intel', 'command-order'],
  mobileFirst: true,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function missionDifficultyValue(mission = {}) {
  const roman = { I: 18, II: 36, III: 58, IV: 76, V: 92 };
  return roman[String(mission.difficulty || 'II').toUpperCase()] || clamp(Number(mission.difficulty), 12, 95) || 42;
}

function classifyEra(mission = {}) {
  const year = Number.parseInt(mission.year, 10) || 1941;
  if (year <= 1940) return 'early';
  if (year >= 1944) return 'late';
  return 'middle';
}

function classifyTheater(mission = {}, campaign = {}) {
  const text = `${mission.theatreKey || ''} ${mission.operationKey || ''} ${campaign.theaterKey || ''}`.toLowerCase();
  if (text.includes('pacific')) return 'pacific';
  if (text.includes('mediterranean') || text.includes('med')) return 'mediterranean';
  if (text.includes('convoy') || text.includes('atlantic')) return 'atlantic';
  if (text.includes('coast')) return 'coastal';
  return 'open-sea';
}

function classifyWeather(theater, era, mission = {}) {
  const seed = String(mission.id || mission.titleKey || theater).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const fog = theater === 'atlantic' ? 58 : theater === 'pacific' ? 24 : 36;
  const sea = clamp((seed % 44) + (era === 'late' ? 9 : 0) + (theater === 'atlantic' ? 18 : 6), 12, 96);
  const visibility = clamp(100 - fog - sea * 0.28, 18, 88);
  return {
    fog,
    sea,
    visibility,
    key: sea >= 70 ? 'briefingCinema.weatherHeavy' : visibility <= 35 ? 'briefingCinema.weatherFog' : 'briefingCinema.weatherClear',
  };
}

function classifyRisk(score) {
  if (score >= 82) return { band: 'extreme', key: 'briefingCinema.riskExtreme' };
  if (score >= 62) return { band: 'high', key: 'briefingCinema.riskHigh' };
  if (score >= 38) return { band: 'medium', key: 'briefingCinema.riskMedium' };
  return { band: 'low', key: 'briefingCinema.riskLow' };
}

function buildDossierCode(mission = {}, theater = 'open-sea') {
  const year = String(mission.year || '1942').slice(-2);
  const id = String(mission.id || mission.titleKey || 'mission').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'PATRL';
  const theaterCode = { atlantic: 'NA', pacific: 'PA', mediterranean: 'MS', coastal: 'CO', 'open-sea': 'OS' }[theater] || 'OS';
  return `${theaterCode}-${year}-${id}`;
}

function buildMapPins(mission = {}, theater = 'open-sea') {
  const baseX = theater === 'atlantic' ? 34 : theater === 'pacific' ? 62 : theater === 'mediterranean' ? 52 : 44;
  const missionShift = String(mission.id || '').length % 12;
  return [
    { id: 'base', key: 'briefingCinema.pinBase', x: clamp(baseX - 18, 10, 84), y: 72, type: 'base' },
    { id: 'patrol', key: 'briefingCinema.pinPatrol', x: clamp(baseX + missionShift, 12, 88), y: 44, type: 'patrol' },
    { id: 'threat', key: 'briefingCinema.pinThreat', x: clamp(baseX + 22, 12, 90), y: 28, type: 'threat' },
  ];
}

export function buildCinematicBriefing({ mission = {}, campaign = null, readiness = null, logisticsPlan = null } = {}) {
  const era = classifyEra(mission);
  const theater = classifyTheater(mission, campaign || {});
  const difficulty = missionDifficultyValue(mission);
  const readinessValue = clamp(readiness?.overall ?? 62, 0, 100);
  const logisticsReady = logisticsPlan?.missionId === mission.id;
  const weather = classifyWeather(theater, era, mission);
  const airThreat = era === 'late' ? 18 : era === 'middle' ? 9 : 3;
  const escortThreat = theater === 'atlantic' ? 16 : theater === 'coastal' ? 14 : 9;
  const riskScore = clamp(difficulty * 0.58 + weather.sea * 0.16 + airThreat + escortThreat - readinessValue * 0.18 - (logisticsReady ? 4 : 0), 8, 98);
  const risk = classifyRisk(riskScore);
  const theaterKey = `briefingCinema.theater.${theater}`;
  const commanderOrderKey = risk.band === 'extreme'
    ? 'briefingCinema.orderExtreme'
    : risk.band === 'high'
      ? 'briefingCinema.orderHigh'
      : logisticsReady ? 'briefingCinema.orderReady' : 'briefingCinema.orderPrepare';
  return {
    phase: PHASE38_CINEMATIC_BRIEFING.phase,
    system: PHASE38_CINEMATIC_BRIEFING.system,
    dossierCode: buildDossierCode(mission, theater),
    era,
    theater,
    theaterKey,
    weather,
    risk,
    riskScore: Math.round(riskScore),
    readiness: Math.round(readinessValue),
    logisticsReady,
    pins: buildMapPins(mission, theater),
    commanderOrderKey,
    cssVars: {
      '--phase38-risk': `${Math.round(riskScore)}%`,
      '--phase38-visibility': `${Math.round(weather.visibility)}%`,
      '--phase38-sea': `${Math.round(weather.sea)}%`,
    },
  };
}

export function renderCinematicBriefing({ view, t }) {
  const safeView = view || buildCinematicBriefing();
  const pinMarkup = safeView.pins.map((pin) => `<span class="phase38-map-pin ${pin.type}" style="left:${pin.x}%;top:${pin.y}%"><i></i><b>${t(pin.key)}</b></span>`).join('');
  return `
    <section class="phase38-cinematic-briefing" data-risk="${safeView.risk.band}" data-theater="${safeView.theater}" style="${Object.entries(safeView.cssVars).map(([key, value]) => `${key}:${value}`).join(';')}">
      <div class="phase38-briefing-header">
        <span>${t('briefingCinema.kicker')}</span>
        <strong>${safeView.dossierCode}</strong>
        <b>${t(safeView.risk.key)} · ${safeView.riskScore}%</b>
      </div>
      <div class="phase38-briefing-grid">
        <div class="phase38-war-map" aria-label="${t('briefingCinema.map')}">
          <div class="phase38-map-grid"></div>
          <div class="phase38-map-route"></div>
          ${pinMarkup}
        </div>
        <div class="phase38-intel-board">
          <div><span>${t('briefingCinema.theaterLabel')}</span><strong>${t(safeView.theaterKey)}</strong></div>
          <div><span>${t('briefingCinema.weatherLabel')}</span><strong>${t(safeView.weather.key)}</strong></div>
          <div><span>${t('briefingCinema.visibility')}</span><strong>${safeView.weather.visibility}%</strong><i><em style="width:${safeView.weather.visibility}%"></em></i></div>
          <div><span>${t('logistics.readiness')}</span><strong>${safeView.readiness}%</strong><i><em style="width:${safeView.readiness}%"></em></i></div>
        </div>
      </div>
      <div class="phase38-command-order">
        <span>${t('briefingCinema.commandOrder')}</span>
        <strong>${t(safeView.commanderOrderKey)}</strong>
      </div>
    </section>
  `;
}
