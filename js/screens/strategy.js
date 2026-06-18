import { renderBottomNav, renderProgressMini } from '../components/ui.js';

function metricCard(t, labelKey, value, tone = '') {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="strategy-metric ${tone}"><div class="stat-label">${t(labelKey)}</div><div class="stat-value">${safe}%</div>${renderProgressMini(safe, 100)}</div>`;
}

function laneCard(t, lane, active) {
  return `
    <button class="strategy-lane-card ${active ? 'active' : ''}" data-action="select-convoy-lane" data-lane="${lane.id}">
      <div class="row space-between align-start">
        <div>
          <strong>${t(lane.nameKey)}</strong>
          <p>${t(lane.descKey)}</p>
        </div>
        <span class="tag ${lane.risk >= 75 ? 'warn' : 'success'}">${t('strategy.risk')}: ${lane.risk}%</span>
      </div>
      <div class="mission-meta">
        <span class="tag">${t(lane.regionKey)}</span>
        <span class="tag gold">${t('strategy.traffic')}: ${lane.traffic}%</span>
        <span class="tag">${t('strategy.intel')}: ${lane.intel}%</span>
      </div>
    </button>`;
}

function directiveCard(t, directive, active, commandPoints, credits) {
  const affordable = (credits || 0) >= (directive.cost || 0) && (commandPoints || 0) >= (directive.commandCost || 0);
  return `
    <div class="mission-card strategy-directive-card ${active ? 'active' : ''} ${affordable ? '' : 'locked'}">
      <div class="row space-between align-start">
        <div><h3>${t(directive.nameKey)}</h3><p>${t(directive.descKey)}</p></div>
        <span class="tag ${active ? 'success' : 'gold'}">${active ? t('strategy.active') : `${directive.commandCost || 0} CP`}</span>
      </div>
      <div class="mission-meta">
        <span class="tag">${t('common.credits')}: ${directive.cost || 0}</span>
        <span class="tag">${t('strategy.riskDelta')}: ${directive.riskDelta > 0 ? '+' : ''}${directive.riskDelta}</span>
        <span class="tag">${t('strategy.intelDelta')}: ${directive.intelDelta > 0 ? '+' : ''}${directive.intelDelta}</span>
      </div>
      <button class="button block ${active || affordable ? '' : 'secondary'}" data-action="set-directive" data-directive="${directive.id}" ${active || affordable ? '' : 'disabled'}>${active ? t('strategy.directiveSelected') : t('strategy.issueDirective')}</button>
    </div>`;
}

export function renderStrategy(t, save, nation, strategyData, theater, selectedLane, selectedDirective, assessment) {
  const strategy = save.strategy || {};
  const lanes = (strategyData.convoyLanes || []).filter((lane) => lane.nationId === nation.id);
  const network = (strategyData.intelNetworks || []).find((item) => item.nationId === nation.id) || {};
  const history = strategy.commandHistory || [];
  const reports = strategy.intelligenceReports || [];
  return `
    <section class="screen screen-shell phase13-strategy-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('strategy.title')}</div>
          <div class="screen-subtitle">${t('strategy.subtitle')}</div>
        </div>
        <span class="top-badge">${t(nation.nameKey)} • ${t(theater?.hqKey || 'strategy.hq')}</span>
      </div>

      <div class="strategy-hero panel edge-glow">
        <div class="panel-body strategy-hero-grid">
          <div>
            <div class="kicker">${t('strategy.theater')}</div>
            <h2>${t(theater?.titleKey || 'strategy.title')}</h2>
            <p class="muted">${t(theater?.summaryKey || 'strategy.subtitle')}</p>
            <div class="mission-meta">
              <span class="tag gold">${t('strategy.commandPoints')}: ${strategy.commandPoints || 0}</span>
              <span class="tag">${t('strategy.ordersIssued')}: ${strategy.ordersIssued || 0}</span>
              <span class="tag ${assessment?.risk >= 75 ? 'warn' : 'success'}">${t('strategy.operationalRisk')}: ${assessment?.risk || 0}%</span>
            </div>
          </div>
          <div class="strategy-map-card">
            <div class="strategy-map-ring"></div>
            <strong>${selectedLane ? t(selectedLane.nameKey) : t('strategy.noLane')}</strong>
            <span>${selectedLane ? t(selectedLane.regionKey) : t('strategy.selectLane')}</span>
          </div>
        </div>
      </div>

      <div class="phase13-grid">
        <div class="panel">
          <div class="panel-header">${t('strategy.theaterMetrics')}</div>
          <div class="panel-body strategy-metrics-grid">
            ${metricCard(t, 'strategy.pressure', strategy.pressure ?? theater?.baselinePressure ?? 0, 'warn')}
            ${metricCard(t, 'strategy.intelLevel', strategy.intelLevel ?? theater?.baselineIntel ?? 0, 'success')}
            ${metricCard(t, 'strategy.decryption', strategy.decryption ?? 0, 'gold')}
            ${metricCard(t, 'strategy.falseContactRisk', strategy.falseContactRisk ?? 0, 'warn')}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">${t('strategy.intelligenceNetwork')}</div>
          <div class="panel-body stack">
            <div class="empty-state compact"><strong>${t(network.nameKey || 'strategy.network')}</strong><br>${t(network.descKey || 'strategy.network.desc')}</div>
            <div class="row wrap">
              <button class="button secondary" data-action="invest-intelligence">${t('strategy.investIntel')} (${network.cost || 0})</button>
              <button class="button ghost" data-action="run-decryption">${t('strategy.runDecryption')}</button>
              <button class="button ghost" data-action="export-intel-dossier">${t('strategy.exportDossier')}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${t('strategy.convoyLanes')}</div>
        <div class="panel-body strategy-lane-grid">
          ${lanes.map((lane) => laneCard(t, lane, lane.id === selectedLane?.id)).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${t('strategy.commandDirectives')}</div>
        <div class="panel-body plan-profile-grid">
          ${(strategyData.directives || []).map((directive) => directiveCard(t, directive, directive.id === selectedDirective?.id, strategy.commandPoints, save.progression.credits)).join('')}
        </div>
      </div>

      <div class="phase13-grid">
        <div class="panel">
          <div class="panel-header">${t('strategy.commandHistory')}</div>
          <div class="panel-body stack">
            ${history.length ? history.slice(0, 6).map((item) => `<div class="record-line"><strong>${item.title || item.type}</strong><span>${item.detail || item.at}</span></div>`).join('') : `<div class="empty-state">${t('strategy.noHistory')}</div>`}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">${t('strategy.intelReports')}</div>
          <div class="panel-body stack">
            ${reports.length ? reports.slice(0, 6).map((item) => `<div class="record-line"><strong>${item.title || t('strategy.report')}</strong><span>${item.detail || item.at}</span></div>`).join('') : `<div class="empty-state">${t('strategy.noReports')}</div>`}
          </div>
        </div>
      </div>

      ${renderBottomNav('strategy', t)}
    </section>`;
}
