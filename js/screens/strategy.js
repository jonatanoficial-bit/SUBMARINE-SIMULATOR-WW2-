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


function formatSigned(value, suffix = '') {
  const numeric = Number(value || 0);
  return `${numeric > 0 ? '+' : ''}${numeric}${suffix}`;
}

function renderHighCommandOrders(t, save, summary = null) {
  if (!summary?.orders?.length) return '';
  const commandPoints = save.strategy?.commandPoints || 0;
  const credits = save.progression?.credits || 0;
  const effect = summary.combinedEffect || {};
  return `
    <div class="panel phase15-high-command-panel">
      <div class="panel-header">${t('highCommand.title')}</div>
      <div class="panel-body stack">
        <div class="row space-between align-start">
          <div>
            <div class="kicker">${t(summary.titleKey)}</div>
            <h3>${t('highCommand.heading')}</h3>
            <p class="muted compact-text">${t(summary.summaryKey)}</p>
          </div>
          <span class="tag gold">${summary.activeCount}/${summary.orders.length}</span>
        </div>
        <div class="high-command-effect-grid">
          <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
          <div><span>${t('strategy.decryption')}</span><strong>${formatSigned(effect.decryptionBonus)}</strong></div>
          <div><span>${t('strategy.pressure')}</span><strong>-${Number(effect.pressureRelief || 0)}</strong></div>
          <div><span>${t('campaignConsequences.risk')}</span><strong>${formatSigned(effect.riskDelta)}</strong></div>
          <div><span>${t('campaign.modifier.readiness')}</span><strong>${formatSigned(effect.readinessBonus)}</strong></div>
          <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</strong></div>
        </div>
        <div class="high-command-grid">
          ${summary.orders.map((order) => {
            const cost = order.cost || {};
            const effect = order.effect || {};
            const affordable = credits >= (cost.credits || 0) && commandPoints >= (cost.commandPoints || 0);
            const canApply = order.unlocked && !order.applied && affordable;
            const lockedText = !order.unlocked ? t('highCommand.requiresMissions', { count: order.requiredMissions }) : (!affordable && !order.applied ? t('highCommand.insufficientResources') : '');
            return `
              <div class="mission-card high-command-card ${order.applied ? 'active' : ''} ${canApply ? '' : 'locked'}">
                <div class="row space-between align-start">
                  <div><h3>${t(order.nameKey)}</h3><p>${t(order.descKey)}</p></div>
                  <span class="tag ${order.applied ? 'success' : order.unlocked ? 'gold' : 'warn'}">${order.applied ? t('highCommand.applied') : order.unlocked ? t('highCommand.available') : t('highCommand.locked')}</span>
                </div>
                <div class="mission-meta">
                  <span class="tag">${t('common.credits')}: ${cost.credits || 0}</span>
                  <span class="tag">${t('strategy.commandPoints')}: ${cost.commandPoints || 0}</span>
                  <span class="tag ${Number(effect.riskDelta || 0) > 0 ? 'warn' : 'success'}">${t('campaignConsequences.risk')}: ${formatSigned(effect.riskDelta)}</span>
                  <span class="tag gold">${t('campaign.modifier.tonnage')}: ${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</span>
                </div>
                <div class="high-command-mini-effects">
                  <span>${t('strategy.intel')}: ${formatSigned(effect.intelBonus)}</span>
                  <span>${t('strategy.decryption')}: ${formatSigned(effect.decryptionBonus)}</span>
                  <span>${t('strategy.pressure')}: -${Number(effect.pressureRelief || 0)}</span>
                  <span>${t('campaign.modifier.readiness')}: ${formatSigned(effect.readinessBonus)}</span>
                </div>
                ${lockedText ? `<small class="muted">${lockedText}</small>` : ''}
                <button class="button block ${canApply ? '' : 'secondary'}" data-action="apply-high-command-order" data-order="${order.id}" ${canApply ? '' : 'disabled'}>${order.applied ? t('highCommand.orderActive') : t('highCommand.applyOrder')}</button>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function renderConsequenceSummary(t, deck = null, assessment = {}) {
  if (!deck?.tracks?.length) return '';
  const effect = deck.effect || assessment.consequenceEffect || {};
  const milestone = effect.milestone || null;
  return `
    <div class="panel phase14-strategy-consequences">
      <div class="panel-header">${t('campaignConsequences.strategyPanel')}</div>
      <div class="panel-body stack">
        <div class="row space-between align-start">
          <div>
            <strong>${t(deck.titleKey)}</strong>
            <p class="muted compact-text">${t(deck.summaryKey)}</p>
          </div>
          <span class="tag gold">${deck.objectiveProgress.completed}/${deck.objectiveProgress.total}</span>
        </div>
        <div class="consequence-track-grid strategy-consequence-grid">
          ${deck.tracks.map((track) => `
            <div class="consequence-track-card">
              <span>${t(track.labelKey)}</span>
              <strong>${track.value}%</strong>
              <div class="campaign-objective-track"><i style="width:${track.percent}%"></i></div>
            </div>
          `).join('')}
        </div>
        <div class="consequence-effect-grid">
          <div><span>${t('campaignConsequences.risk')}</span><strong>${Number(effect.riskDelta || 0) > 0 ? '+' : ''}${Number(effect.riskDelta || 0)}</strong></div>
          <div><span>${t('strategy.intel')}</span><strong>${Number(effect.intelBonus || 0) > 0 ? '+' : ''}${Number(effect.intelBonus || 0)}</strong></div>
          <div><span>${t('campaign.modifier.readiness')}</span><strong>${Number(effect.readinessBonus || 0) > 0 ? '+' : ''}${Number(effect.readinessBonus || 0)}</strong></div>
          <div><span>${t('campaign.modifier.tonnage')}</span><strong>${Math.round((Number(effect.tonnageMultiplier || 1) - 1) * 100) > 0 ? '+' : ''}${Math.round((Number(effect.tonnageMultiplier || 1) - 1) * 100)}%</strong></div>
        </div>
        ${milestone ? `<div class="empty-state compact"><strong>${t(milestone.titleKey)}</strong><br>${t(milestone.descKey)}</div>` : ''}
      </div>
    </div>`;
}

export function renderStrategy(t, save, nation, strategyData, theater, selectedLane, selectedDirective, assessment, campaignConsequences = null, highCommandOrders = null) {
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

      ${renderConsequenceSummary(t, campaignConsequences, assessment)}
      ${renderHighCommandOrders(t, save, highCommandOrders)}

      <div class="phase13-grid">
        <div class="panel">
          <div class="panel-header">${t('strategy.theaterMetrics')}</div>
          <div class="panel-body strategy-metrics-grid">
            ${metricCard(t, 'strategy.pressure', assessment?.pressure ?? strategy.pressure ?? theater?.baselinePressure ?? 0, 'warn')}
            ${metricCard(t, 'strategy.intelLevel', assessment?.intel ?? strategy.intelLevel ?? theater?.baselineIntel ?? 0, 'success')}
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
