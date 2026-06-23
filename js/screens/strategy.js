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


function eventToneClass(event) {
  if (event?.tone === 'opportunity') return 'success';
  if (event?.tone === 'crisis' || event?.tone === 'danger') return 'warn';
  return 'gold';
}

function renderCampaignEventSummary(t, summary = null) {
  if (!summary?.events?.length) return '';
  const effect = summary.combinedEffect || {};
  const activeEvents = summary.activeEvents?.length ? summary.activeEvents : summary.events.filter((event) => event.active).slice(0, 3);
  return `
    <div class="panel phase16-campaign-events-panel">
      <div class="panel-header">${t('campaignEvents.title')}</div>
      <div class="panel-body stack">
        <div class="row space-between align-start">
          <div>
            <div class="kicker">${t(summary.titleKey)}</div>
            <h3>${t('campaignEvents.heading')}</h3>
            <p class="muted compact-text">${t(summary.summaryKey)}</p>
          </div>
          <span class="tag ${summary.volatility >= 60 ? 'warn' : 'gold'}">${t('campaignEvents.volatility')}: ${summary.volatility}%</span>
        </div>
        <div class="campaign-event-effect-grid">
          <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
          <div><span>${t('strategy.decryption')}</span><strong>${formatSigned(effect.decryptionBonus)}</strong></div>
          <div><span>${t('strategy.pressure')}</span><strong>${formatSigned(effect.pressureDelta)}</strong></div>
          <div><span>${t('campaignConsequences.risk')}</span><strong>${formatSigned(effect.riskDelta)}</strong></div>
          <div><span>${t('campaign.modifier.readiness')}</span><strong>${formatSigned(effect.readinessBonus)}</strong></div>
          <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</strong></div>
        </div>
        <div class="campaign-event-grid">
          ${activeEvents.length ? activeEvents.map((event) => `
            <div class="mission-card campaign-event-card ${event.acknowledged ? 'acknowledged' : ''} ${event.tone || 'warning'}">
              <div class="row space-between align-start">
                <div><h3>${t(event.nameKey)}</h3><p>${t(event.descKey)}</p></div>
                <span class="tag ${eventToneClass(event)}">${t(`campaignEvents.severity.${event.tone || event.severity || 'warning'}`)}</span>
              </div>
              <div class="mission-meta">
                <span class="tag">${t('strategy.pressure')}: ${formatSigned(event.effect.pressureDelta)}</span>
                <span class="tag ${Number(event.effect.riskDelta || 0) > 0 ? 'warn' : 'success'}">${t('campaignConsequences.risk')}: ${formatSigned(event.effect.riskDelta)}</span>
                <span class="tag gold">${t('campaign.modifier.tonnage')}: ${formatSigned(Math.round(((event.effect.tonnageMultiplier || 1) - 1) * 100), '%')}</span>
              </div>
              <button class="button block ${event.acknowledged ? 'secondary' : ''}" data-action="acknowledge-campaign-event" data-event="${event.id}" ${event.acknowledged ? 'disabled' : ''}>${event.acknowledged ? t('campaignEvents.acknowledged') : t('campaignEvents.acknowledge')}</button>
            </div>`).join('') : `<div class="empty-state compact">${t('campaignEvents.noActive')}</div>`}
        </div>
      </div>
    </div>`;
}


function operationToneClass(operation) {
  if (operation?.tone === 'covert' || operation?.severity === 'covert') return 'gold';
  if (operation?.tone === 'danger' || operation?.severity === 'danger') return 'warn';
  return 'success';
}

function renderSpecialOperations(t, save, summary = null) {
  if (!summary?.operations?.length) return '';
  const commandPoints = save.strategy?.commandPoints || 0;
  const credits = save.progression?.credits || 0;
  const effect = summary.combinedEffect || {};
  return `
    <div class="panel phase17-special-operations-panel">
      <div class="panel-header">${t('specialOps.title')}</div>
      <div class="panel-body stack">
        <div class="row space-between align-start">
          <div>
            <div class="kicker">${t(summary.titleKey)}</div>
            <h3>${t('specialOps.heading')}</h3>
            <p class="muted compact-text">${t(summary.summaryKey)}</p>
          </div>
          <span class="tag ${summary.availableCount ? 'gold' : 'success'}">${summary.launchedCount}/${summary.operations.length}</span>
        </div>
        <div class="special-operation-effect-grid">
          <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
          <div><span>${t('strategy.decryption')}</span><strong>${formatSigned(effect.decryptionBonus)}</strong></div>
          <div><span>${t('strategy.pressure')}</span><strong>-${Number(effect.pressureRelief || 0)}</strong></div>
          <div><span>${t('campaignConsequences.risk')}</span><strong>${formatSigned(effect.riskDelta)}</strong></div>
          <div><span>${t('campaign.modifier.readiness')}</span><strong>${formatSigned(effect.readinessBonus)}</strong></div>
          <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</strong></div>
        </div>
        <div class="special-operation-grid">
          ${summary.operations.map((operation) => {
            const cost = operation.cost || {};
            const opEffect = operation.effect || {};
            const affordable = credits >= (cost.credits || 0) && commandPoints >= (cost.commandPoints || 0);
            const canLaunch = operation.unlocked && !operation.launched && affordable;
            const lockText = operation.launched ? '' : (!operation.unlocked ? t(operation.lockedReason || 'specialOps.locked') : (!affordable ? t('specialOps.insufficientResources') : ''));
            return `
              <div class="mission-card special-operation-card ${operation.launched ? 'active' : ''} ${canLaunch ? '' : 'locked'}">
                <div class="row space-between align-start">
                  <div>
                    <span class="tag ${operationToneClass(operation)}">${t(operation.typeKey || 'specialOps.type.operation')}</span>
                    <h3>${t(operation.nameKey)}</h3>
                    <p>${t(operation.descKey)}</p>
                  </div>
                  <span class="tag ${operation.launched ? 'success' : operation.unlocked ? 'gold' : 'warn'}">${operation.launched ? t('specialOps.launched') : operation.unlocked ? t('specialOps.available') : t('specialOps.locked')}</span>
                </div>
                <div class="mission-meta">
                  <span class="tag">${t('common.credits')}: ${cost.credits || 0}</span>
                  <span class="tag">${t('strategy.commandPoints')}: ${cost.commandPoints || 0}</span>
                  <span class="tag ${Number(opEffect.riskDelta || 0) > 0 ? 'warn' : 'success'}">${t('campaignConsequences.risk')}: ${formatSigned(opEffect.riskDelta)}</span>
                  <span class="tag gold">${t('campaign.modifier.tonnage')}: ${formatSigned(Math.round(((opEffect.tonnageMultiplier || 1) - 1) * 100), '%')}</span>
                </div>
                <div class="special-operation-mini-effects">
                  <span>${t('strategy.intel')}: ${formatSigned(opEffect.intelBonus)}</span>
                  <span>${t('strategy.decryption')}: ${formatSigned(opEffect.decryptionBonus)}</span>
                  <span>${t('strategy.pressure')}: -${Number(opEffect.pressureRelief || 0)}</span>
                  <span>${t('campaign.modifier.readiness')}: ${formatSigned(opEffect.readinessBonus)}</span>
                </div>
                ${lockText ? `<small class="muted">${lockText}</small>` : ''}
                <button class="button block ${canLaunch ? '' : 'secondary'}" data-action="launch-special-operation" data-operation="${operation.id}" ${canLaunch ? '' : 'disabled'}>${operation.launched ? t('specialOps.operationActive') : t('specialOps.launch')}</button>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}


function renderOperationChains(t, save, summary = null) {
  if (!summary?.steps?.length) return '';
  const commandPoints = save.strategy?.commandPoints || 0;
  const credits = save.progression?.credits || 0;
  const effect = summary.combinedEffect || {};
  return `
    <div class="panel phase18-operation-chains-panel">
      <div class="panel-header">${t('operationChains.title')}</div>
      <div class="panel-body stack">
        <div class="row space-between align-start">
          <div>
            <div class="kicker">${t(summary.titleKey)}</div>
            <h3>${t('operationChains.heading')}</h3>
            <p class="muted compact-text">${t(summary.summaryKey)}</p>
          </div>
          <span class="tag ${summary.completedCount >= summary.totalSteps ? 'success' : 'gold'}">${summary.completedCount}/${summary.totalSteps}</span>
        </div>
        <div class="operation-chain-track"><i style="width:${summary.chainPercent || 0}%"></i></div>
        <div class="special-operation-effect-grid">
          <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
          <div><span>${t('strategy.decryption')}</span><strong>${formatSigned(effect.decryptionBonus)}</strong></div>
          <div><span>${t('strategy.pressure')}</span><strong>-${Number(effect.pressureRelief || 0)}</strong></div>
          <div><span>${t('campaignConsequences.risk')}</span><strong>${formatSigned(effect.riskDelta)}</strong></div>
          <div><span>${t('campaign.modifier.readiness')}</span><strong>${formatSigned(effect.readinessBonus)}</strong></div>
          <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</strong></div>
        </div>
        <div class="operation-chain-grid">
          ${summary.steps.map((step) => {
            const cost = step.cost || {};
            const stepEffect = step.effect || {};
            const affordable = credits >= (cost.credits || 0) && commandPoints >= (cost.commandPoints || 0);
            const canExecute = step.unlocked && !step.completed && affordable;
            const lockText = step.completed ? '' : (!step.unlocked ? t(step.lockedReason || 'operationChains.locked') : (!affordable ? t('operationChains.insufficientResources') : ''));
            return `
              <div class="mission-card operation-chain-card ${step.completed ? 'active' : ''} ${canExecute ? '' : 'locked'}">
                <div class="row space-between align-start">
                  <div>
                    <span class="tag ${step.completed ? 'success' : step.unlocked ? 'gold' : 'warn'}">${t(step.stageKey || 'operationChains.stage.operation')}</span>
                    <h3>${String(step.index + 1).padStart(2, '0')} • ${t(step.nameKey)}</h3>
                    <p>${t(step.descKey)}</p>
                  </div>
                  <span class="tag ${step.completed ? 'success' : step.unlocked ? 'gold' : 'warn'}">${step.completed ? t('operationChains.completed') : step.unlocked ? t('operationChains.available') : t('operationChains.locked')}</span>
                </div>
                <div class="mission-meta">
                  <span class="tag">${t('common.credits')}: ${cost.credits || 0}</span>
                  <span class="tag">${t('strategy.commandPoints')}: ${cost.commandPoints || 0}</span>
                  <span class="tag ${Number(stepEffect.riskDelta || 0) > 0 ? 'warn' : 'success'}">${t('campaignConsequences.risk')}: ${formatSigned(stepEffect.riskDelta)}</span>
                  <span class="tag gold">${t('campaign.modifier.tonnage')}: ${formatSigned(Math.round(((stepEffect.tonnageMultiplier || 1) - 1) * 100), '%')}</span>
                </div>
                <div class="special-operation-mini-effects">
                  <span>${t('strategy.intel')}: ${formatSigned(stepEffect.intelBonus)}</span>
                  <span>${t('strategy.decryption')}: ${formatSigned(stepEffect.decryptionBonus)}</span>
                  <span>${t('strategy.pressure')}: -${Number(stepEffect.pressureRelief || 0)}</span>
                  <span>${t('campaign.modifier.readiness')}: ${formatSigned(stepEffect.readinessBonus)}</span>
                </div>
                ${lockText ? `<small class="muted">${lockText}</small>` : ''}
                <button class="button block ${canExecute ? '' : 'secondary'}" data-action="execute-operation-chain-step" data-step="${step.id}" ${canExecute ? '' : 'disabled'}>${step.completed ? t('operationChains.stepActive') : t('operationChains.execute')}</button>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}


function outcomeToneClass(outcome) {
  if (outcome?.tone === 'danger') return 'warn';
  if (outcome?.tone === 'covert') return 'gold';
  return 'success';
}

function renderOperationOutcomes(t, save, summary = null) {
  if (!summary?.outcomes?.length) return '';
  const commandPoints = save.strategy?.commandPoints || 0;
  const credits = save.progression?.credits || 0;
  const effect = summary.combinedEffect || {};
  return `
    <div class="panel phase19-operation-outcomes-panel">
      <div class="panel-header">${t('operationOutcomes.title')}</div>
      <div class="panel-body stack">
        <div class="row space-between align-start">
          <div>
            <div class="kicker">${t(summary.titleKey)}</div>
            <h3>${t('operationOutcomes.heading')}</h3>
            <p class="muted compact-text">${t(summary.summaryKey)}</p>
          </div>
          <span class="tag ${summary.chosenOutcome ? 'success' : summary.unlocked ? 'gold' : 'warn'}">${summary.chosenOutcome ? t('operationOutcomes.chosen') : summary.unlocked ? t('operationOutcomes.available') : t('operationOutcomes.locked')}</span>
        </div>
        <div class="operation-outcome-score"><i style="width:${summary.outcomeScore || 0}%"></i></div>
        <div class="operation-outcome-effect-grid">
          <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
          <div><span>${t('strategy.decryption')}</span><strong>${formatSigned(effect.decryptionBonus)}</strong></div>
          <div><span>${t('strategy.pressure')}</span><strong>-${Number(effect.pressureRelief || 0)}</strong></div>
          <div><span>${t('campaignConsequences.risk')}</span><strong>${formatSigned(effect.riskDelta)}</strong></div>
          <div><span>${t('campaign.modifier.readiness')}</span><strong>${formatSigned(effect.readinessBonus)}</strong></div>
          <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</strong></div>
        </div>
        <div class="operation-outcome-choice-grid">
          ${summary.outcomes.map((outcome) => {
            const cost = outcome.cost || {};
            const outcomeEffect = outcome.effect || {};
            const affordable = credits >= (cost.credits || 0) && commandPoints >= (cost.commandPoints || 0);
            const canChoose = outcome.unlocked && !outcome.chosen && !summary.alreadyChosen && affordable;
            const lockText = outcome.chosen ? '' : (!outcome.unlocked ? t(outcome.lockedReason || summary.lockedReason || 'operationOutcomes.lockedChain', { count: outcome.lockCount || summary.lockCount || 4 }) : (!affordable ? t('operationOutcomes.insufficientResources') : ''));
            return `
              <div class="mission-card operation-outcome-card ${outcome.chosen ? 'chosen' : ''} ${canChoose ? '' : 'locked'}">
                <div class="row space-between align-start">
                  <div>
                    <span class="tag ${outcomeToneClass(outcome)}">${t(outcome.doctrineKey || 'operationOutcomes.finalDoctrine')}</span>
                    <h3>${t(outcome.nameKey)}</h3>
                    <p>${t(outcome.descKey)}</p>
                  </div>
                  <span class="tag ${outcome.chosen ? 'success' : outcome.unlocked ? 'gold' : 'warn'}">${outcome.chosen ? t('operationOutcomes.chosen') : outcome.unlocked ? t('operationOutcomes.available') : t('operationOutcomes.locked')}</span>
                </div>
                <div class="mission-meta">
                  <span class="tag">${t('common.credits')}: ${cost.credits || 0}</span>
                  <span class="tag">${t('strategy.commandPoints')}: ${cost.commandPoints || 0}</span>
                  <span class="tag ${Number(outcomeEffect.riskDelta || 0) > 0 ? 'warn' : 'success'}">${t('campaignConsequences.risk')}: ${formatSigned(outcomeEffect.riskDelta)}</span>
                  <span class="tag gold">${t('campaign.modifier.tonnage')}: ${formatSigned(Math.round(((outcomeEffect.tonnageMultiplier || 1) - 1) * 100), '%')}</span>
                </div>
                <div class="operation-outcome-mini-effects">
                  <span>${t('strategy.intel')}: ${formatSigned(outcomeEffect.intelBonus)}</span>
                  <span>${t('strategy.decryption')}: ${formatSigned(outcomeEffect.decryptionBonus)}</span>
                  <span>${t('strategy.pressure')}: -${Number(outcomeEffect.pressureRelief || 0)}</span>
                  <span>${t('campaign.modifier.readiness')}: ${formatSigned(outcomeEffect.readinessBonus)}</span>
                </div>
                ${lockText ? `<small class="muted">${lockText}</small>` : ''}
                <button class="button block ${canChoose ? '' : 'secondary'}" data-action="choose-operation-outcome" data-outcome="${outcome.id}" ${canChoose ? '' : 'disabled'}>${outcome.chosen ? t('operationOutcomes.outcomeActive') : t('operationOutcomes.choose')}</button>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

export function renderStrategy(t, save, nation, strategyData, theater, selectedLane, selectedDirective, assessment, campaignConsequences = null, highCommandOrders = null, campaignEvents = null, specialOperations = null, operationChains = null, operationOutcomes = null) {
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
      ${renderCampaignEventSummary(t, campaignEvents)}
      ${renderSpecialOperations(t, save, specialOperations)}
      ${renderOperationChains(t, save, operationChains)}
      ${renderOperationOutcomes(t, save, operationOutcomes)}
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
