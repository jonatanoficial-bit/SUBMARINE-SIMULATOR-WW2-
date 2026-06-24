import { renderBottomNav } from '../components/ui.js';

function missionStatusLabel(t, mission) {
  if (mission.status === 'available') return t('campaign.status.available');
  return t('campaign.status.locked');
}

function pct(completed, total) {
  return total > 0 ? Math.round((Number(completed || 0) / total) * 100) : 0;
}

function renderCampaignSelector(t, nations = [], campaigns = [], progressByNation = {}, currentNationId, viewNationId) {
  return `
    <div class="panel phase11-campaign-selector" aria-label="${t('campaign.selectNationTitle')}">
      <div class="panel-header">${t('campaign.selectNationTitle')}</div>
      <div class="panel-body stack">
        <p class="muted compact-text">${t('campaign.selectNationSubtitle')}</p>
        <div class="campaign-nation-tabs">
          ${nations.map((item) => {
            const campaign = campaigns.find((candidate) => candidate.nationId === item.id);
            const progress = progressByNation[item.id] || { completed: 0, total: campaign?.missionIds?.length || 0 };
            const percent = pct(progress.completed, progress.total);
            const active = item.id === viewNationId;
            const current = item.id === currentNationId;
            return `
              <button class="campaign-nation-tab ${active ? 'active' : ''} ${current ? 'current' : 'preview'}" data-action="select-campaign-nation" data-nation="${item.id}">
                <span class="nation-flag-large mini">${item.flag || ''}</span>
                <span class="campaign-tab-copy">
                  <strong>${campaign ? t(campaign.titleKey) : t(item.nameKey)}</strong>
                  <small>${current ? t('campaign.currentCommander') : t('campaign.preview')}</small>
                </span>
                <span class="campaign-tab-progress" aria-hidden="true"><i style="width:${percent}%"></i></span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTimeline(t, campaign) {
  const timeline = Array.isArray(campaign?.timeline) ? campaign.timeline : [];
  if (!timeline.length) return '';
  return `
    <div class="campaign-timeline" aria-label="${t('campaign.timeline')}">
      ${timeline.map((item) => `
        <div>
          <span>${item.year}</span>
          <strong>${t(item.labelKey)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function formatSigned(value, suffix = '') {
  const number = Number(value || 0);
  return `${number > 0 ? '+' : ''}${number}${suffix}`;
}

function renderDoctrineDeck(t, doctrine = null, doctrineStage = {}, doctrineImpact = {}) {
  if (!doctrine) return '';
  const stage = doctrineStage?.stage || null;
  const traits = Array.isArray(doctrine.traitKeys) ? doctrine.traitKeys : [];
  return `
    <div class="campaign-doctrine-deck phase12-doctrine-deck" aria-label="${t('campaign.doctrineDeck.title')}">
      <div class="row space-between align-start doctrine-deck-head">
        <div>
          <div class="mini-title">${t('campaign.doctrineDeck.title')}</div>
          <strong>${t(doctrine.titleKey)}</strong>
          <p class="muted compact-text">${t(doctrine.summaryKey)}</p>
        </div>
        <span class="tag gold">${t('phase12.tag')}</span>
      </div>
      <div class="doctrine-stage-card">
        <span>${t('campaign.doctrineDeck.stageLabel')} ${doctrineStage.index >= 0 ? doctrineStage.index + 1 : 1}</span>
        <strong>${stage ? t(stage.titleKey) : t('campaign.doctrineDeck.stageFallback')}</strong>
        <small>${stage ? t(stage.descKey) : t('campaign.doctrineDeck.stageFallbackDesc')}</small>
      </div>
      <div class="doctrine-traits">
        ${traits.map((key) => `<span>${t(key)}</span>`).join('')}
      </div>
      <div class="doctrine-impact-grid">
        <div><span>${t('campaign.modifier.fuel')}</span><strong>${formatSigned(doctrineImpact.fuelPercent, '%')}</strong></div>
        <div><span>${t('campaign.modifier.torpedoes')}</span><strong>${formatSigned(doctrineImpact.torpedoPercent, '%')}</strong></div>
        <div><span>${t('campaign.modifier.readiness')}</span><strong>${formatSigned(doctrineImpact.readinessBonus)}</strong></div>
        <div><span>${t('campaign.modifier.stealth')}</span><strong>${formatSigned(doctrineImpact.stealthBonus)}</strong></div>
        <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(doctrineImpact.tonnagePercent, '%')}</strong></div>
        <div><span>${t('campaign.modifier.risk')}</span><strong>${formatSigned(doctrineImpact.riskDelta)}</strong></div>
      </div>
      <div class="doctrine-briefing-grid">
        <div><span>${t('campaign.doctrineDeck.focusLabel')}</span><strong>${t(doctrine.focusKey)}</strong></div>
        <div><span>${t('campaign.doctrineDeck.bonusLabel')}</span><strong>${t(doctrine.bonusKey)}</strong></div>
        <div><span>${t('campaign.doctrineDeck.riskLabel')}</span><strong>${t(doctrine.riskKey)}</strong></div>
      </div>
    </div>
  `;
}



function renderObjectiveDeck(t, deck = null) {
  const objectives = Array.isArray(deck?.objectives) ? deck.objectives : [];
  if (!objectives.length) return '';
  return `
    <div class="campaign-objective-deck phase13-campaign-objectives" aria-label="${t('campaignObjectives.title')}">
      <div class="row space-between align-start objective-deck-head">
        <div>
          <div class="mini-title">${t('campaignObjectives.title')}</div>
          <strong>${t(deck.titleKey)}</strong>
          <p class="muted compact-text">${t(deck.summaryKey)}</p>
        </div>
        <span class="tag gold">${deck.completed}/${deck.total}</span>
      </div>
      <div class="campaign-objective-list">
        ${objectives.map((objective) => `
          <div class="campaign-objective-card ${objective.progress.completed ? 'complete' : ''} ${objective.claimed ? 'claimed' : ''}">
            <div class="row space-between align-start">
              <div>
                <span>${t('campaignObjectives.act')} ${objective.act}</span>
                <strong>${t(objective.titleKey)}</strong>
                <small>${t(objective.descKey)}</small>
              </div>
              <em>${objective.progress.done}/${objective.progress.total}</em>
            </div>
            <div class="campaign-objective-track"><i style="width:${objective.progress.percent}%"></i></div>
            <div class="campaign-objective-reward">
              <span>${t('campaignObjectives.reward')}</span>
              <strong>+${objective.reward.credits} ${t('common.credits')} • +${objective.reward.xp} XP • +${objective.reward.commandPoints} ${t('strategy.commandPoints')}</strong>
            </div>
            <p class="muted compact-text">${t(objective.effectKey)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}


function renderConsequenceDeck(t, deck = null) {
  const tracks = Array.isArray(deck?.tracks) ? deck.tracks : [];
  if (!tracks.length) return '';
  const effect = deck.effect || {};
  const milestone = effect.milestone || null;
  return `
    <div class="campaign-consequence-deck phase14-campaign-consequences" aria-label="${t('campaignConsequences.title')}">
      <div class="row space-between align-start consequence-deck-head">
        <div>
          <div class="mini-title">${t('campaignConsequences.title')}</div>
          <strong>${t(deck.titleKey)}</strong>
          <p class="muted compact-text">${t(deck.summaryKey)}</p>
        </div>
        <span class="tag gold">${deck.missionProgress.completed}/${deck.missionProgress.total}</span>
      </div>
      <div class="consequence-front-card">
        <span>${t('campaignConsequences.front')}</span>
        <strong>${t(deck.frontKey)}</strong>
        <small>${milestone ? t(milestone.descKey) : t('campaignConsequences.noMilestone')}</small>
      </div>
      <div class="consequence-track-grid">
        ${tracks.map((track) => `
          <div class="consequence-track-card">
            <span>${t(track.labelKey)}</span>
            <strong>${track.value}%</strong>
            <div class="campaign-objective-track"><i style="width:${track.percent}%"></i></div>
          </div>
        `).join('')}
      </div>
      <div class="consequence-effect-grid">
        <div><span>${t('campaignConsequences.risk')}</span><strong>${formatSigned(effect.riskDelta)}</strong></div>
        <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
        <div><span>${t('campaign.modifier.readiness')}</span><strong>${formatSigned(effect.readinessBonus)}</strong></div>
        <div><span>${t('campaign.modifier.tonnage')}</span><strong>${Math.round((Number(effect.tonnageMultiplier || 1) - 1) * 100) > 0 ? '+' : ''}${Math.round((Number(effect.tonnageMultiplier || 1) - 1) * 100)}%</strong></div>
      </div>
      ${milestone ? `<div class="empty-state compact"><strong>${t(milestone.titleKey)}</strong><br>${t(milestone.descKey)}</div>` : ''}
    </div>
  `;
}


function eventToneClass(event) {
  if (event?.tone === 'opportunity') return 'success';
  if (event?.tone === 'danger' || event?.tone === 'crisis') return 'warn';
  return 'gold';
}

function renderCampaignEventsDeck(t, deck = null) {
  const events = Array.isArray(deck?.events) ? deck.events : [];
  if (!events.length) return '';
  const activeEvents = deck.activeEvents?.length ? deck.activeEvents : events.filter((event) => event.active);
  const effect = deck.combinedEffect || {};
  return `
    <div class="campaign-events-deck phase16-campaign-events" aria-label="${t('campaignEvents.title')}">
      <div class="row space-between align-start campaign-events-head">
        <div>
          <div class="mini-title">${t('campaignEvents.title')}</div>
          <strong>${t(deck.titleKey)}</strong>
          <p class="muted compact-text">${t(deck.summaryKey)}</p>
        </div>
        <span class="tag ${deck.volatility >= 60 ? 'warn' : 'gold'}">${t('campaignEvents.volatility')}: ${deck.volatility}%</span>
      </div>
      <div class="campaign-event-effect-grid compact">
        <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
        <div><span>${t('strategy.pressure')}</span><strong>${formatSigned(effect.pressureDelta)}</strong></div>
        <div><span>${t('campaignConsequences.risk')}</span><strong>${formatSigned(effect.riskDelta)}</strong></div>
        <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</strong></div>
      </div>
      <div class="campaign-event-list">
        ${activeEvents.length ? activeEvents.map((event) => `
          <div class="campaign-event-pill ${event.tone || event.severity || 'warning'}">
            <span class="tag ${eventToneClass(event)}">${t(`campaignEvents.severity.${event.tone || event.severity || 'warning'}`)}</span>
            <strong>${t(event.nameKey)}</strong>
            <small>${t(event.descKey)}</small>
          </div>
        `).join('') : `<div class="empty-state compact">${t('campaignEvents.noActive')}</div>`}
      </div>
    </div>
  `;
}


function operationToneClass(operation) {
  if (operation?.tone === 'covert' || operation?.severity === 'covert') return 'gold';
  if (operation?.tone === 'danger' || operation?.severity === 'danger') return 'warn';
  return 'success';
}

function renderSpecialOperationsDeck(t, deck = null) {
  const operations = Array.isArray(deck?.operations) ? deck.operations : [];
  if (!operations.length) return '';
  const previewOperations = operations.filter((operation) => operation.unlocked || operation.launched).slice(0, 4);
  const effect = deck.combinedEffect || {};
  return `
    <div class="campaign-special-operations-deck phase17-special-operations" aria-label="${t('specialOps.title')}">
      <div class="row space-between align-start campaign-events-head">
        <div>
          <div class="mini-title">${t('specialOps.title')}</div>
          <strong>${t(deck.titleKey)}</strong>
          <p class="muted compact-text">${t(deck.summaryKey)}</p>
        </div>
        <span class="tag ${deck.availableCount ? 'gold' : 'success'}">${deck.launchedCount}/${operations.length}</span>
      </div>
      <div class="special-operation-effect-grid compact">
        <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
        <div><span>${t('strategy.pressure')}</span><strong>-${Number(effect.pressureRelief || 0)}</strong></div>
        <div><span>${t('campaignConsequences.risk')}</span><strong>${formatSigned(effect.riskDelta)}</strong></div>
        <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</strong></div>
      </div>
      <div class="campaign-event-list">
        ${previewOperations.length ? previewOperations.map((operation) => `
          <div class="campaign-event-pill ${operation.launched ? 'opportunity' : operation.tone || operation.severity || 'support'}">
            <span class="tag ${operationToneClass(operation)}">${operation.launched ? t('specialOps.launched') : t('specialOps.available')}</span>
            <strong>${t(operation.nameKey)}</strong>
            <small>${t(operation.descKey)}</small>
          </div>
        `).join('') : `<div class="empty-state compact">${t('specialOps.noAvailable')}</div>`}
      </div>
    </div>
  `;
}


function renderOperationChainsDeck(t, deck = null) {
  const steps = Array.isArray(deck?.steps) ? deck.steps : [];
  if (!steps.length) return '';
  const effect = deck.combinedEffect || {};
  return `
    <div class="campaign-operation-chains-deck phase18-operation-chains" aria-label="${t('operationChains.title')}">
      <div class="row space-between align-start campaign-events-head">
        <div>
          <div class="mini-title">${t('operationChains.title')}</div>
          <strong>${t(deck.titleKey)}</strong>
          <p class="muted compact-text">${t(deck.summaryKey)}</p>
        </div>
        <span class="tag ${deck.completedCount >= deck.totalSteps ? 'success' : 'gold'}">${deck.completedCount}/${deck.totalSteps}</span>
      </div>
      <div class="operation-chain-track" aria-label="${t('operationChains.progress')}"><i style="width:${deck.chainPercent || 0}%"></i></div>
      <div class="special-operation-effect-grid compact">
        <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
        <div><span>${t('strategy.decryption')}</span><strong>${formatSigned(effect.decryptionBonus)}</strong></div>
        <div><span>${t('strategy.pressure')}</span><strong>-${Number(effect.pressureRelief || 0)}</strong></div>
        <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</strong></div>
      </div>
      <div class="operation-chain-steps compact">
        ${steps.map((step) => `
          <div class="operation-chain-step ${step.completed ? 'complete' : step.unlocked ? 'available' : 'locked'}">
            <span class="operation-chain-index">${String(step.index + 1).padStart(2, '0')}</span>
            <div>
              <span class="tag ${step.completed ? 'success' : step.unlocked ? 'gold' : 'warn'}">${step.completed ? t('operationChains.completed') : step.unlocked ? t('operationChains.available') : t('operationChains.locked')}</span>
              <strong>${t(step.nameKey)}</strong>
              <small>${t(step.stageKey)} • ${t(step.descKey)}</small>
            </div>
          </div>
        `).join('')}
      </div>
      ${deck.nextStep && !deck.nextStep.completed ? `<div class="empty-state compact"><strong>${t('operationChains.nextStep')}</strong><br>${t(deck.nextStep.nameKey)}</div>` : ''}
    </div>
  `;
}


function outcomeToneClass(outcome) {
  if (outcome?.tone === 'danger') return 'warn';
  if (outcome?.tone === 'covert') return 'gold';
  return 'success';
}

function renderOperationOutcomesDeck(t, deck = null) {
  const outcomes = Array.isArray(deck?.outcomes) ? deck.outcomes : [];
  if (!outcomes.length) return '';
  const effect = deck.combinedEffect || {};
  const chosen = deck.chosenOutcome || null;
  return `
    <div class="campaign-operation-outcomes-deck phase19-operation-outcomes" aria-label="${t('operationOutcomes.title')}">
      <div class="row space-between align-start campaign-events-head">
        <div>
          <div class="mini-title">${t('operationOutcomes.title')}</div>
          <strong>${t(deck.titleKey)}</strong>
          <p class="muted compact-text">${t(deck.summaryKey)}</p>
        </div>
        <span class="tag ${chosen ? 'success' : deck.unlocked ? 'gold' : 'warn'}">${chosen ? t('operationOutcomes.chosen') : deck.unlocked ? t('operationOutcomes.available') : t('operationOutcomes.locked')}</span>
      </div>
      <div class="operation-outcome-score" aria-label="${t('operationOutcomes.progress')}"><i style="width:${deck.outcomeScore || 0}%"></i></div>
      <div class="operation-outcome-effect-grid compact">
        <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
        <div><span>${t('strategy.decryption')}</span><strong>${formatSigned(effect.decryptionBonus)}</strong></div>
        <div><span>${t('strategy.pressure')}</span><strong>-${Number(effect.pressureRelief || 0)}</strong></div>
        <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</strong></div>
      </div>
      ${chosen ? `<div class="empty-state compact"><strong>${t(chosen.nameKey)}</strong><br>${t(chosen.descKey)}</div>` : `<div class="empty-state compact">${deck.unlocked ? t('operationOutcomes.heading') : t(deck.lockedReason || 'operationOutcomes.lockedChain', { count: deck.lockCount || deck.requires?.completedSteps || 4 })}</div>`}
      <div class="campaign-event-list">
        ${outcomes.map((outcome) => `
          <div class="campaign-event-pill ${outcome.chosen ? 'opportunity' : outcome.tone || 'support'}">
            <span class="tag ${outcomeToneClass(outcome)}">${outcome.chosen ? t('operationOutcomes.chosen') : t(outcome.doctrineKey || 'operationOutcomes.finalDoctrine')}</span>
            <strong>${t(outcome.nameKey)}</strong>
            <small>${t(outcome.descKey)}</small>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}


function honorToneClass(honor) {
  if (honor?.tone === 'legendary' || Number(honor?.tier || 0) >= 4) return 'success';
  if (honor?.tone === 'elite' || Number(honor?.tier || 0) >= 3) return 'gold';
  return 'combat';
}

function renderOperationalHonorsDeck(t, deck = null) {
  const honors = Array.isArray(deck?.honors) ? deck.honors : [];
  if (!honors.length) return '';
  const effect = deck.combinedEffect || {};
  return `
    <div class="campaign-operational-honors-deck phase20-operational-honors" aria-label="${t('operationalHonors.title')}">
      <div class="row space-between align-start campaign-events-head">
        <div>
          <div class="mini-title">${t('operationalHonors.title')}</div>
          <strong>${t(deck.titleKey)}</strong>
          <p class="muted compact-text">${t(deck.summaryKey)}</p>
        </div>
        <span class="tag ${deck.availableCount ? 'gold' : deck.awardedCount ? 'success' : 'warn'}">${deck.awardedCount}/${deck.totalHonors}</span>
      </div>
      <div class="operational-honor-score" aria-label="${t('operationalHonors.score')}"><i style="width:${deck.medalScore || 0}%"></i></div>
      <div class="operational-honor-effect-grid compact">
        <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
        <div><span>${t('strategy.pressure')}</span><strong>-${Number(effect.pressureRelief || 0)}</strong></div>
        <div><span>${t('campaignConsequences.risk')}</span><strong>${formatSigned(effect.riskDelta)}</strong></div>
        <div><span>${t('campaign.modifier.tonnage')}</span><strong>${formatSigned(Math.round(((effect.tonnageMultiplier || 1) - 1) * 100), '%')}</strong></div>
      </div>
      <div class="campaign-event-list">
        ${honors.map((honor) => `
          <div class="campaign-event-pill ${honor.awarded ? 'opportunity' : honor.unlocked ? 'support' : 'danger'}">
            <span class="tag ${honor.awarded ? 'success' : honor.unlocked ? 'gold' : 'warn'}">${honor.awarded ? t('operationalHonors.awarded') : honor.unlocked ? t('operationalHonors.available') : t('operationalHonors.locked')}</span>
            <strong>★ ${t(honor.nameKey)}</strong>
            <small>${t(honor.ribbonKey)} • ${t(honor.descKey)}</small>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}


function commandToneClass(rank) {
  if (rank?.tone === 'legendary' || Number(rank?.rankIndex || 0) >= 5) return 'success';
  if (rank?.tone === 'elite' || rank?.tone === 'staff' || Number(rank?.rankIndex || 0) >= 3) return 'gold';
  return 'combat';
}

function renderCommandAdvancementDeck(t, deck = null) {
  const ranks = Array.isArray(deck?.ranks) ? deck.ranks : [];
  if (!ranks.length) return '';
  const effect = deck.combinedEffect || {};
  return `
    <div class="campaign-command-advancement-deck phase21-command-advancement" aria-label="${t('commandAdvancement.title')}">
      <div class="row space-between align-start campaign-events-head">
        <div>
          <div class="mini-title">${t('commandAdvancement.title')}</div>
          <strong>${t(deck.titleKey)}</strong>
          <p class="muted compact-text">${t(deck.summaryKey)}</p>
        </div>
        <span class="tag ${deck.availableCount ? 'gold' : deck.claimedCount ? 'success' : 'warn'}">${deck.claimedCount}/${deck.totalRanks}</span>
      </div>
      <div class="command-authority-score" aria-label="${t('commandAdvancement.authorityScore')}"><i style="width:${deck.authorityScore || 0}%"></i></div>
      <div class="command-advancement-effect-grid compact">
        <div><span>${t('strategy.intel')}</span><strong>${formatSigned(effect.intelBonus)}</strong></div>
        <div><span>${t('strategy.decryption')}</span><strong>${formatSigned(effect.decryptionBonus)}</strong></div>
        <div><span>${t('strategy.pressure')}</span><strong>-${Number(effect.pressureRelief || 0)}</strong></div>
        <div><span>${t('campaign.modifier.readiness')}</span><strong>${formatSigned(effect.readinessBonus)}</strong></div>
      </div>
      <div class="campaign-event-list">
        ${ranks.map((rank) => `
          <div class="campaign-event-pill ${rank.claimed ? 'opportunity' : rank.unlocked ? 'support' : 'danger'}">
            <span class="tag ${rank.claimed ? 'success' : rank.unlocked ? 'gold' : 'warn'}">${rank.claimed ? t('commandAdvancement.claimed') : rank.unlocked ? t('commandAdvancement.available') : t('commandAdvancement.locked')}</span>
            <strong>⚓ ${t(rank.rankKey)}</strong>
            <small>${t(rank.billetKey)} • ${t(rank.descKey)}</small>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}


function renderVeteranOfficersDeck(t, deck = null) {
  const officers = Array.isArray(deck?.officers) ? deck.officers : [];
  if (!officers.length) return '';
  const effect = deck.combinedEffect || {};
  return `
    <div class="campaign-command-advancement-deck phase22-veteran-officers" aria-label="${t('veteranOfficers.title')}">
      <div class="row space-between align-start campaign-events-head">
        <div>
          <div class="mini-title">${t('veteranOfficers.title')}</div>
          <strong>${t(deck.titleKey)}</strong>
          <p class="muted compact-text">${t(deck.summaryKey)}</p>
        </div>
        <span class="tag ${deck.availableCount ? 'gold' : deck.assignedCount ? 'success' : 'warn'}">${deck.assignedCount}/${deck.totalOfficers}</span>
      </div>
      <div class="command-authority-score" aria-label="${t('veteranOfficers.veteranScore')}"><i style="width:${deck.veteranScore || 0}%"></i></div>
      <div class="command-advancement-effect-grid compact">
        <div><span>${t('veteranOfficers.sonar')}</span><strong>${formatSigned(effect.sonarBonus)}</strong></div>
        <div><span>${t('veteranOfficers.engineering')}</span><strong>${formatSigned(effect.engineeringBonus)}</strong></div>
        <div><span>${t('veteranOfficers.torpedoes')}</span><strong>${formatSigned(effect.torpedoBonus)}</strong></div>
        <div><span>${t('veteranOfficers.stealth')}</span><strong>${formatSigned(effect.stealthBonus)}</strong></div>
      </div>
      <div class="campaign-event-list">
        ${officers.map((officer) => `
          <div class="campaign-event-pill ${officer.assigned ? 'opportunity' : officer.unlocked ? 'support' : 'danger'}">
            <span class="tag ${officer.assigned ? 'success' : officer.unlocked ? 'gold' : 'warn'}">${officer.assigned ? t('veteranOfficers.assigned') : officer.unlocked ? t('veteranOfficers.available') : t('veteranOfficers.locked')}</span>
            <strong>★ ${t(officer.nameKey)}</strong>
            <small>${t(officer.roleKey)} • ${t(officer.descKey)}</small>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderChapters(t, campaign, completedSet = new Set()) {
  const chapters = Array.isArray(campaign?.chapters) ? campaign.chapters : [];
  if (!chapters.length) return '';
  return `
    <div class="campaign-chapters" aria-label="${t('campaign.actMap')}">
      <div class="mini-title">${t('campaign.actMap')}</div>
      ${chapters.map((chapter, index) => {
        const missionIds = Array.isArray(chapter.missionIds) ? chapter.missionIds : [];
        const done = missionIds.filter((id) => completedSet.has(id)).length;
        return `
          <div class="campaign-chapter">
            <span>${t('campaign.chapter')} ${String(index + 1).padStart(2, '0')}</span>
            <strong>${t(chapter.titleKey)}</strong>
            <small>${done}/${missionIds.length}</small>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function renderCampaign(t, missions, selectedMission, campaign, nation, progress = {}, options = {}) {
  const completed = Number(progress.completed || 0);
  const total = Number(progress.total || missions.length || 0);
  const percent = pct(completed, total);
  const currentNationId = options.currentNationId || nation?.id;
  const viewNationId = options.viewNationId || nation?.id;
  const isCurrentNation = viewNationId === currentNationId;
  const completedSet = new Set(options.completedMissions || []);
  const doctrine = options.doctrine || null;
  const doctrineStage = options.doctrineStage || {};
  const doctrineImpact = options.doctrineImpact || {};
  const campaignObjectives = options.campaignObjectives || null;
  const campaignConsequences = options.campaignConsequences || null;
  const campaignEvents = options.campaignEvents || null;
  const specialOperations = options.specialOperations || null;
  const operationChains = options.operationChains || null;
  const operationOutcomes = options.operationOutcomes || null;
  const operationalHonors = options.operationalHonors || null;
  const commandAdvancement = options.commandAdvancement || null;
  const veteranOfficers = options.veteranOfficers || null;
  const launchAllowed = selectedMission?.status === 'available' && isCurrentNation;

  return `
    <section class="screen screen-shell campaign-screen phase11-campaign-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('campaign.title')}</div>
          <div class="screen-subtitle">${campaign ? t(campaign.titleKey) : t('campaign.subtitle')}</div>
        </div>
      </div>

      ${renderCampaignSelector(t, options.allNations || [], options.allCampaigns || [], options.progressByNation || {}, currentNationId, viewNationId)}

      <div class="campaign-command-grid">
        <div class="panel campaign-overview phase11-campaign-overview">
          <div class="panel-header">${t('campaign.overview')}</div>
          <div class="panel-body stack">
            <div class="campaign-nation-row">
              <span class="nation-flag-large">${nation?.flag || ''}</span>
              <div>
                <strong>${campaign ? t(campaign.titleKey) : t('campaign.subtitle')}</strong>
                <p class="muted">${campaign ? t(campaign.summaryKey) : ''}</p>
              </div>
            </div>
            ${!isCurrentNation ? `<div class="empty-state compact phase11-preview-warning"><strong>${t('campaign.previewOnly')}</strong><br>${t('campaign.previewOnlyHint')}</div>` : ''}
            <div class="campaign-progress-block">
              <div class="row space-between"><span>${t('campaign.progressLabel')}</span><strong>${completed}/${total}</strong></div>
              <div class="campaign-progress-track"><i style="width:${percent}%"></i></div>
            </div>
            <div class="campaign-info-grid">
              <div><span>${t('campaign.base')}</span><strong>${campaign ? t(campaign.baseKey) : '--'}</strong></div>
              <div><span>${t('campaign.chronology')}</span><strong>${campaign ? t(campaign.chronologyKey) : '--'}</strong></div>
              <div><span>${t('campaign.doctrine')}</span><strong>${campaign ? t(campaign.doctrineKey) : '--'}</strong></div>
              <div><span>${t('campaign.enemy')}</span><strong>${campaign ? t(campaign.enemyKey) : '--'}</strong></div>
              <div><span>${t('campaign.front')}</span><strong>${campaign?.frontKey ? t(campaign.frontKey) : '--'}</strong></div>
              <div><span>${t('campaign.tone')}</span><strong>${campaign?.toneKey ? t(campaign.toneKey) : '--'}</strong></div>
            </div>
            <div class="empty-state compact"><strong>${t('campaign.goal')}</strong><br>${campaign ? t(campaign.strategicGoalKey) : ''}</div>
            ${renderDoctrineDeck(t, doctrine, doctrineStage, doctrineImpact)}
            ${renderObjectiveDeck(t, campaignObjectives)}
            ${renderConsequenceDeck(t, campaignConsequences)}
            ${renderCampaignEventsDeck(t, campaignEvents)}
            ${renderSpecialOperationsDeck(t, specialOperations)}
            ${renderOperationChainsDeck(t, operationChains)}
            ${renderOperationOutcomesDeck(t, operationOutcomes)}
            ${renderOperationalHonorsDeck(t, operationalHonors)}
            ${renderCommandAdvancementDeck(t, commandAdvancement)}
            ${renderVeteranOfficersDeck(t, veteranOfficers)}
            ${renderTimeline(t, campaign)}
            ${renderChapters(t, campaign, completedSet)}
          </div>
        </div>

        <div class="panel campaign-detail phase11-campaign-detail">
          <div class="panel-header">${selectedMission ? t(selectedMission.titleKey) : t('campaign.play')}</div>
          <div class="panel-body stack">
            <div class="mission-meta">
              ${selectedMission ? `<span class="tag gold">${selectedMission.year}</span><span class="tag">${t(selectedMission.theatreKey)}</span><span class="tag">${t(selectedMission.operationKey)}</span>` : ''}
            </div>
            <p class="muted">${selectedMission ? t(selectedMission.summaryKey) : t('campaign.placeholder')}</p>
            ${selectedMission?.status === 'locked' ? `<div class="empty-state compact">${t('campaign.lockedByCampaign')}</div>` : ''}
            ${!isCurrentNation ? `<div class="empty-state compact">${t('campaign.launchBlockedNation')}</div>` : ''}
            <button class="button ${launchAllowed ? '' : 'secondary'} block" ${launchAllowed ? 'data-action="open-briefing"' : 'disabled'}>${t('campaign.play')}</button>
          </div>
        </div>
      </div>

      <div class="stack campaign-list phase11-mission-list" aria-label="${t('campaign.missionsForNation')}">
        ${missions.map((mission) => `
          <button class="mission-card ${selectedMission?.id === mission.id ? 'active' : ''} ${mission.status === 'locked' ? 'locked' : ''}" data-action="select-mission" data-mission="${mission.id}">
            <div class="row space-between align-start">
              <div>
                <div class="mission-sequence">${String(mission.campaignOrder || 1).padStart(2, '0')} • ${t(mission.operationKey)}</div>
                <h3>${t(mission.titleKey)}</h3>
                <p>${t(mission.summaryKey)}</p>
              </div>
              <span class="tag ${mission.status === 'available' ? 'success' : 'warn'}">${missionStatusLabel(t, mission)}</span>
            </div>
            <div class="mission-meta">
              <span class="tag gold">${mission.year}</span>
              <span class="tag">${t(mission.theatreKey)}</span>
              <span class="tag">${t(mission.baseKey)}</span>
            </div>
            <div class="mission-meta">
              <span class="tag gold">${t('common.difficulty')}: ${mission.difficulty}</span>
              <span class="tag">${t('common.reward')}: ${mission.reward}</span>
              <span class="tag">XP: ${mission.xp}</span>
            </div>
          </button>
        `).join('')}
      </div>

      ${renderBottomNav('campaign', t)}
    </section>
  `;
}
