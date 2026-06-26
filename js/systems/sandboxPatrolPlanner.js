export const PHASE43_SANDBOX_PATROL = Object.freeze({
  phase: '43',
  system: 'sandbox-patrol-planner',
  version: 'v2.0.0-alpha.58',
  modes: ['campaign', 'quick-mission', 'sandbox-patrol'],
  mobileFirst: true,
});

export const SANDBOX_SCENARIOS = Object.freeze([
  {
    id: 'north-atlantic-convoy',
    titleKey: 'sandbox.scenario.atlantic.title',
    descKey: 'sandbox.scenario.atlantic.desc',
    theatreKey: 'mission.theatre.atlantic',
    operationKey: 'sandbox.operation.freePatrol',
    year: '1943',
    difficulty: 'III',
    weatherKey: 'sandbox.weather.storm',
    timeKey: 'sandbox.time.night',
    threatKey: 'sandbox.threat.convoyEscortAir',
    targetType: 'merchant',
    reward: 900,
    xp: 90,
    targetStartX: 260,
    targetStartY: 18,
    escortStartX: 330,
    escortStartY: 46,
    escortSensitivity: 1.12,
    targetSpeedKnots: 8.2,
    escortSpeedKnots: 16.8,
    environment: { seaState: 6, visibilityMeters: 3200, precipitation: 68, windKnots: 31, night: true },
    navigation: {
      mapBounds: { north: 50.35, south: 46.55, west: -19.4, east: -11.7 },
      origin: { lat: 48.1, lon: -17.9 }, heading: 72,
      patrolSector: { id: 'sandbox-na-sector', labelKey: 'sandbox.sector.convoyLane', north: 49.2, south: 47.95, west: -16.7, east: -14.2 },
      route: [
        { id: 'sandbox-na-wp-1', lat: 48.25, lon: -17.25, labelKey: 'navigation.waypointDeparture' },
        { id: 'sandbox-na-wp-2', lat: 48.55, lon: -16.35, labelKey: 'navigation.waypointApproach' },
        { id: 'sandbox-na-wp-3', lat: 48.6, lon: -15.25, labelKey: 'navigation.waypointPatrol' }
      ]
    }
  },
  {
    id: 'mediterranean-hunt',
    titleKey: 'sandbox.scenario.mediterranean.title',
    descKey: 'sandbox.scenario.mediterranean.desc',
    theatreKey: 'mission.theatre.mediterranean',
    operationKey: 'sandbox.operation.freePatrol',
    year: '1942', difficulty: 'II', weatherKey: 'sandbox.weather.clear', timeKey: 'sandbox.time.afternoon', threatKey: 'sandbox.threat.surfaceEscorts',
    targetType: 'tanker', reward: 760, xp: 72, targetStartX: 210, targetStartY: 24, escortStartX: 285, escortStartY: 58, escortSensitivity: 0.96, targetSpeedKnots: 7.4, escortSpeedKnots: 15.2,
    environment: { seaState: 2, visibilityMeters: 7200, precipitation: 4, windKnots: 9, night: false },
    navigation: {
      mapBounds: { north: 38.7, south: 34.9, west: 10.0, east: 18.2 }, origin: { lat: 36.1, lon: 11.5 }, heading: 91,
      patrolSector: { id: 'sandbox-med-sector', labelKey: 'sandbox.sector.coastalRoute', north: 37.15, south: 35.95, west: 12.4, east: 15.4 },
      route: [
        { id: 'sandbox-med-wp-1', lat: 36.2, lon: 12.1, labelKey: 'navigation.waypointDeparture' },
        { id: 'sandbox-med-wp-2', lat: 36.45, lon: 13.1, labelKey: 'navigation.waypointApproach' },
        { id: 'sandbox-med-wp-3', lat: 36.55, lon: 14.1, labelKey: 'navigation.waypointPatrol' }
      ]
    }
  },
  {
    id: 'training-shakedown',
    titleKey: 'sandbox.scenario.training.title',
    descKey: 'sandbox.scenario.training.desc',
    theatreKey: 'mission.theatre.training',
    operationKey: 'sandbox.operation.shakedown',
    year: '1941', difficulty: 'I', weatherKey: 'sandbox.weather.calm', timeKey: 'sandbox.time.dawn', threatKey: 'sandbox.threat.light',
    targetType: 'merchant', reward: 420, xp: 44, targetStartX: 230, targetStartY: 20, escortStartX: 410, escortStartY: 80, escortSensitivity: 0.64, targetSpeedKnots: 6.2, escortSpeedKnots: 12.4,
    environment: { seaState: 1, visibilityMeters: 8500, precipitation: 0, windKnots: 5, night: false },
    navigation: {
      mapBounds: { north: 55.4, south: 52.6, west: 2.0, east: 8.4 }, origin: { lat: 53.2, lon: 3.1 }, heading: 48,
      patrolSector: { id: 'sandbox-tr-sector', labelKey: 'sandbox.sector.trainingBox', north: 54.4, south: 53.4, west: 4.0, east: 6.4 },
      route: [
        { id: 'sandbox-tr-wp-1', lat: 53.45, lon: 3.8, labelKey: 'navigation.waypointDeparture' },
        { id: 'sandbox-tr-wp-2', lat: 53.85, lon: 4.8, labelKey: 'navigation.waypointApproach' },
        { id: 'sandbox-tr-wp-3', lat: 54.0, lon: 5.7, labelKey: 'navigation.waypointPatrol' }
      ]
    }
  }
]);

export function sandboxScenarioById(id = 'north-atlantic-convoy') {
  return SANDBOX_SCENARIOS.find((scenario) => scenario.id === id) || SANDBOX_SCENARIOS[0];
}

function campaignForNation(campaigns = [], nationId = 'de') {
  return campaigns.find((campaign) => campaign.nationId === nationId) || campaigns[0] || { id: `sandbox.${nationId}`, baseKey: 'sandbox.base.forward', strategicGoalKey: 'sandbox.goal.freePatrol', enemyKey: 'sandbox.enemy.simulated', chronologyKey: 'sandbox.chronology.open', doctrineKey: 'sandbox.doctrine.free' };
}

export function buildSandboxMission({ scenarioId = 'north-atlantic-convoy', nationId = 'de', campaigns = [] } = {}) {
  const scenario = sandboxScenarioById(scenarioId);
  const campaign = campaignForNation(campaigns, nationId);
  return {
    id: `sandbox-${nationId}-${scenario.id}`,
    sandbox: true,
    missionMode: 'sandbox',
    nationId,
    campaignId: campaign.id,
    campaignOrder: 0,
    titleKey: scenario.titleKey,
    summaryKey: scenario.descKey,
    theatreKey: scenario.theatreKey,
    operationKey: scenario.operationKey,
    baseKey: campaign.baseKey || 'sandbox.base.forward',
    strategicGoalKey: 'sandbox.goal.freePatrol',
    enemyKey: 'sandbox.enemy.dynamic',
    chronologyKey: campaign.chronologyKey || 'sandbox.chronology.open',
    doctrineKey: 'sandbox.doctrine.free',
    year: scenario.year,
    difficulty: scenario.difficulty,
    reward: scenario.reward,
    xp: scenario.xp,
    status: 'available',
    targetType: scenario.targetType,
    targetStartX: scenario.targetStartX,
    targetStartY: scenario.targetStartY,
    escortStartX: scenario.escortStartX,
    escortStartY: scenario.escortStartY,
    escortSensitivity: scenario.escortSensitivity,
    targetDrift: 0.72,
    targetWave: 0.42,
    targetBob: 5,
    targetSpeedKnots: scenario.targetSpeedKnots,
    escortSpeedKnots: scenario.escortSpeedKnots,
    objectiveKeys: ['sandbox.objective.patrol', 'sandbox.objective.identify', 'sandbox.objective.attackOptional', 'sandbox.objective.returnOptional'],
    historicalNoteKey: 'sandbox.historicalNote',
    bonusReward: Math.round(scenario.reward * 0.22),
    bonusXp: Math.round(scenario.xp * 0.25),
    environment: scenario.environment,
    navigation: scenario.navigation,
  };
}

export function renderSandboxPatrolPanel(t, { isCurrentNation = true } = {}) {
  return `
    <div class="panel phase43-sandbox-panel" aria-label="${t('sandbox.title')}">
      <div class="panel-header phase43-sandbox-header"><span>${t('sandbox.title')}</span><b>${t('sandbox.badge')}</b></div>
      <div class="panel-body stack">
        <p class="muted compact-text">${t('sandbox.subtitle')}</p>
        <div class="phase43-mode-grid">
          <div class="phase43-mode-card active"><strong>${t('sandbox.mode.campaign')}</strong><span>${t('sandbox.mode.campaignDesc')}</span></div>
          <div class="phase43-mode-card"><strong>${t('sandbox.mode.quick')}</strong><span>${t('sandbox.mode.quickDesc')}</span></div>
          <div class="phase43-mode-card"><strong>${t('sandbox.mode.free')}</strong><span>${t('sandbox.mode.freeDesc')}</span></div>
        </div>
        <div class="phase43-scenario-grid">
          ${SANDBOX_SCENARIOS.map((scenario) => `
            <article class="phase43-scenario-card">
              <div class="row space-between align-start">
                <div><span>${t(scenario.theatreKey)}</span><strong>${t(scenario.titleKey)}</strong></div>
                <b>${scenario.difficulty}</b>
              </div>
              <p>${t(scenario.descKey)}</p>
              <div class="mission-meta">
                <span class="tag gold">${t(scenario.weatherKey)}</span>
                <span class="tag">${t(scenario.timeKey)}</span>
                <span class="tag warn">${t(scenario.threatKey)}</span>
              </div>
              <button class="button block" ${isCurrentNation ? `data-action="launch-sandbox" data-sandbox="${scenario.id}"` : 'disabled'}>${t('sandbox.launch')}</button>
            </article>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
