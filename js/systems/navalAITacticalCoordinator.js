export const PHASE33_NAVAL_AI_TACTICS = Object.freeze({
  phase: '33',
  system: 'naval-ai-tactical-coordinator',
  version: 'v2.0.0-alpha.48',
  layers: ['convoy-zigzag', 'escort-pincer', 'expanding-square-search', 'torpedo-wake-reaction', 'asw-pressure-readout'],
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

function seconds(value) {
  const number = Math.max(0, safeNumber(value));
  return number ? `${Math.ceil(number / 1000)}s` : '--';
}

function tacticKey(prefix, value, fallback) {
  return `${prefix}.${value || fallback}`;
}

function classifyThreat(ai = {}, tactics = {}) {
  const confidence = safeNumber(ai.contactConfidence);
  const solution = safeNumber(ai.attackSolution);
  const pincer = safeNumber(tactics.pincerPressure);
  const aircraft = ai.aircraft || {};
  const depthPattern = Array.isArray(ai.depthChargePatterns) && ai.depthChargePatterns.length > 0;
  const score = clamp(confidence * 0.34 + solution * 0.34 + pincer * 0.22 + (aircraft.active ? 8 : 0) + (aircraft.state === 'attack' ? 12 : 0) + (depthPattern ? 16 : 0), 0, 100);
  const band = score >= 74 ? 'critical' : score >= 48 ? 'danger' : score >= 24 ? 'watch' : 'clear';
  return { score, band, labelKey: `navalAITactics.threat.${band}` };
}

function buildEscortRows(ships = [], tactics = {}) {
  return ships
    .filter((ship) => ship && (String(ship.role || '').includes('escort')))
    .slice(0, 4)
    .map((ship, index) => {
      const distance = Math.hypot(safeNumber(ship.x), safeNumber(ship.y)) * 4;
      const roleKey = tactics.escortScreen === 'pincer'
        ? (index % 2 ? 'navalAITactics.escortRole.flank' : 'navalAITactics.escortRole.lead')
        : tactics.escortScreen === 'barrier'
          ? 'navalAITactics.escortRole.sweep'
          : 'navalAITactics.escortRole.screen';
      return {
        id: ship.id || `escort-${index + 1}`,
        label: ship.shipType || ship.role || 'escort',
        state: ship.state || 'patrol',
        roleKey,
        rangeMeters: Math.round(distance),
        rangeLabel: distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`,
        destroyed: Boolean(ship.destroyed),
      };
    });
}

export function buildNavalAITacticalView({ snapshot = {} } = {}) {
  const ai = snapshot.navalAI || {};
  const tactics = ai.tactics || ai.state?.tactics || {};
  const threat = classifyThreat(ai, tactics);
  const patterns = Array.isArray(ai.depthChargePatterns) ? ai.depthChargePatterns : [];
  const nextPattern = patterns.slice().sort((a, b) => safeNumber(a.remainingMs) - safeNumber(b.remainingMs))[0] || null;
  const confidence = clamp(ai.contactConfidence, 0, 100);
  const pincer = clamp(tactics.pincerPressure, 0, 100);
  const zigzag = clamp(tactics.zigzagIntensity, 0, 100);
  const state = ai.globalState || ai.state?.globalState || 'formation';
  const aircraft = ai.aircraft || {};
  return {
    phase: PHASE33_NAVAL_AI_TACTICS.phase,
    system: PHASE33_NAVAL_AI_TACTICS.system,
    version: PHASE33_NAVAL_AI_TACTICS.version,
    state,
    threat,
    tactics: {
      convoyManeuver: tactics.convoyManeuver || 'steady',
      escortScreen: tactics.escortScreen || 'loose',
      searchPattern: tactics.searchPattern || 'none',
      reactionState: tactics.reactionState || 'routine',
      directiveKey: tactics.lastDirectiveKey || 'ai.tactics.directiveFormation',
    },
    keys: {
      convoyManeuver: tacticKey('navalAITactics.maneuver', tactics.convoyManeuver, 'steady'),
      escortScreen: tacticKey('navalAITactics.screen', tactics.escortScreen, 'loose'),
      searchPattern: tacticKey('navalAITactics.search', tactics.searchPattern, 'none'),
      reactionState: tacticKey('navalAITactics.reaction', tactics.reactionState, 'routine'),
    },
    bars: {
      zigzag: Math.round(zigzag),
      confidence: Math.round(confidence),
      pincer: Math.round(pincer),
      attack: Math.round(clamp(ai.attackSolution, 0, 100)),
    },
    labels: {
      zigzag: pct(zigzag),
      confidence: pct(confidence),
      pincer: pct(pincer),
      attack: pct(ai.attackSolution),
      nextPattern: nextPattern ? seconds(nextPattern.remainingMs) : '--',
      aircraft: !aircraft.available ? 'navalAITactics.air.unavailable' : !aircraft.active ? 'navalAITactics.air.standby' : aircraft.state === 'attack' ? 'navalAITactics.air.attack' : aircraft.state === 'tracking' ? 'navalAITactics.air.tracking' : 'navalAITactics.air.patrol',
    },
    predictedSubmarine: {
      ageMs: safeNumber(tactics.predictedSubmarine?.ageMs),
      ageLabel: tactics.predictedSubmarine?.ageMs ? seconds(tactics.predictedSubmarine.ageMs) : '--',
    },
    escortRows: buildEscortRows(ai.ships || [], tactics),
    metrics: {
      coordinatedSearches: safeNumber(ai.metrics?.coordinatedSearches),
      torpedoEvasionTurns: safeNumber(ai.metrics?.torpedoEvasionTurns),
      escortPincerRuns: safeNumber(ai.metrics?.escortPincerRuns),
      patternsDropped: safeNumber(ai.metrics?.patternsDropped),
    },
    cssVars: {
      '--phase33-threat': `${Math.round(threat.score)}%`,
      '--phase33-zigzag': `${Math.round(zigzag)}%`,
      '--phase33-pincer': `${Math.round(pincer)}%`,
    },
  };
}
