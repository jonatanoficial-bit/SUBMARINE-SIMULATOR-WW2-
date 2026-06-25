export const PHASE40_LIVING_CAMPAIGN = Object.freeze({
  phase: '40',
  system: 'living-campaign-war-front',
  version: 'v2.0.0-alpha.55',
  layers: ['front-pressure', 'enemy-adaptation', 'theater-morale', 'convoy-war-rhythm', 'next-war-pulse'],
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

function progressPercent(progress = {}, missions = []) {
  const total = Math.max(1, safeNumber(progress.total, missions.length || 1));
  const completed = clamp(progress.completed, 0, total);
  return Math.round((completed / total) * 100);
}

function effectFromDeck(deck = {}) {
  return deck.effect || deck.combinedEffect || deck.assessment || {};
}

function statusFromPressure(pressure) {
  if (pressure >= 76) return { state: 'critical', key: 'livingCampaign.status.critical' };
  if (pressure >= 54) return { state: 'contested', key: 'livingCampaign.status.contested' };
  if (pressure >= 32) return { state: 'tense', key: 'livingCampaign.status.tense' };
  return { state: 'stable', key: 'livingCampaign.status.stable' };
}

function frontKeyFromCampaign(campaign = {}) {
  if (campaign?.frontKey) return campaign.frontKey;
  if (campaign?.theaterKey) return campaign.theaterKey;
  return 'livingCampaign.frontUnknown';
}

export function buildLivingCampaignFront({ campaign = {}, missions = [], progress = {}, nation = {}, consequenceDeck = null, eventDeck = null, specialOperations = null, operationChains = null, operationOutcomes = null, operationalHonors = null, commandAdvancement = null, veteranOfficers = null } = {}) {
  const progressPct = progressPercent(progress, missions);
  const completed = safeNumber(progress.completed);
  const total = Math.max(1, safeNumber(progress.total, missions.length || 1));
  const consequenceEffect = effectFromDeck(consequenceDeck || {});
  const eventEffect = effectFromDeck(eventDeck || {});
  const volatility = clamp(eventDeck?.volatility, 0, 100);
  const activeEvents = Array.isArray(eventDeck?.activeEvents) ? eventDeck.activeEvents.length : 0;
  const launchedOps = Array.isArray(specialOperations?.operations) ? specialOperations.operations.filter((item) => item.launched).length : 0;
  const chainCompleted = Array.isArray(operationChains?.steps) ? operationChains.steps.filter((item) => item.completed).length : 0;
  const decisiveOutcomes = Array.isArray(operationOutcomes?.outcomes) ? operationOutcomes.outcomes.filter((item) => item.chosen).length : 0;
  const honors = Array.isArray(operationalHonors?.honors) ? operationalHonors.honors.filter((item) => item.awarded).length : 0;
  const promotions = Array.isArray(commandAdvancement?.promotions) ? commandAdvancement.promotions.filter((item) => item.claimed).length : 0;
  const officers = Array.isArray(veteranOfficers?.officers) ? veteranOfficers.officers.filter((item) => item.assigned).length : 0;

  const enemyAdaptation = clamp(18 + progressPct * 0.54 + activeEvents * 5 + safeNumber(consequenceEffect.riskDelta) * 1.15 + safeNumber(eventEffect.riskDelta) * 1.35, 0, 100);
  const theaterPressure = clamp(24 + volatility * 0.34 + safeNumber(eventEffect.pressureDelta) * 1.4 + safeNumber(consequenceEffect.riskDelta) * 1.15 + progressPct * 0.24 - launchedOps * 4 - chainCompleted * 2, 0, 100);
  const frontStability = clamp(76 - theaterPressure * 0.42 + honors * 3 + promotions * 4 + decisiveOutcomes * 5, 0, 100);
  const fleetMorale = clamp(52 + honors * 6 + promotions * 5 + officers * 4 + launchedOps * 2 - activeEvents * 3 + completed * 1.5, 0, 100);
  const initiative = clamp(38 + progressPct * 0.34 + launchedOps * 5 + chainCompleted * 4 + decisiveOutcomes * 8 + officers * 3 - enemyAdaptation * 0.25, 0, 100);
  const convoyTempo = clamp(28 + enemyAdaptation * 0.36 + theaterPressure * 0.32 + (total - completed) * 2.2, 0, 100);
  const status = statusFromPressure(theaterPressure);
  const nextPulse = theaterPressure >= 72
    ? 'livingCampaign.pulseCrisis'
    : enemyAdaptation >= 68
      ? 'livingCampaign.pulseEnemyAdapts'
      : initiative >= 64
        ? 'livingCampaign.pulseOpportunity'
        : 'livingCampaign.pulsePatrol';
  return {
    phase: PHASE40_LIVING_CAMPAIGN.phase,
    system: PHASE40_LIVING_CAMPAIGN.system,
    version: PHASE40_LIVING_CAMPAIGN.version,
    nationId: nation?.id || campaign?.nationId || 'unknown',
    frontKey: frontKeyFromCampaign(campaign),
    status,
    progressPct,
    completed,
    total,
    values: {
      theaterPressure: Math.round(theaterPressure),
      enemyAdaptation: Math.round(enemyAdaptation),
      frontStability: Math.round(frontStability),
      fleetMorale: Math.round(fleetMorale),
      initiative: Math.round(initiative),
      convoyTempo: Math.round(convoyTempo),
    },
    labels: {
      theaterPressure: pct(theaterPressure),
      enemyAdaptation: pct(enemyAdaptation),
      frontStability: pct(frontStability),
      fleetMorale: pct(fleetMorale),
      initiative: pct(initiative),
      convoyTempo: pct(convoyTempo),
    },
    nextPulseKey: nextPulse,
    directiveKey: theaterPressure >= 72
      ? 'livingCampaign.directiveCrisis'
      : enemyAdaptation >= 68
        ? 'livingCampaign.directiveStealth'
        : initiative >= 64
          ? 'livingCampaign.directiveExploit'
          : 'livingCampaign.directiveHold',
    cssVars: {
      '--phase40-pressure': pct(theaterPressure),
      '--phase40-adaptation': pct(enemyAdaptation),
      '--phase40-initiative': pct(initiative),
    },
    cards: [
      { id: 'pressure', labelKey: 'livingCampaign.theaterPressure', value: Math.round(theaterPressure), valueLabel: pct(theaterPressure), descKey: 'livingCampaign.theaterPressureDesc' },
      { id: 'adaptation', labelKey: 'livingCampaign.enemyAdaptation', value: Math.round(enemyAdaptation), valueLabel: pct(enemyAdaptation), descKey: 'livingCampaign.enemyAdaptationDesc' },
      { id: 'stability', labelKey: 'livingCampaign.frontStability', value: Math.round(frontStability), valueLabel: pct(frontStability), descKey: 'livingCampaign.frontStabilityDesc' },
      { id: 'morale', labelKey: 'livingCampaign.fleetMorale', value: Math.round(fleetMorale), valueLabel: pct(fleetMorale), descKey: 'livingCampaign.fleetMoraleDesc' },
      { id: 'initiative', labelKey: 'livingCampaign.initiative', value: Math.round(initiative), valueLabel: pct(initiative), descKey: 'livingCampaign.initiativeDesc' },
      { id: 'convoy', labelKey: 'livingCampaign.convoyTempo', value: Math.round(convoyTempo), valueLabel: pct(convoyTempo), descKey: 'livingCampaign.convoyTempoDesc' },
    ],
  };
}
