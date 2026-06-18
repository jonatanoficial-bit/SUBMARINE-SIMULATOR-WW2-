import { renderBottomNav } from '../components/ui.js';

export function renderBriefing(t, mission, operationAutosave = null, campaign = null, logisticsPlan = null, readiness = null) {
  const objectiveKeys = mission.objectiveKeys || ['briefing.objectiveSilent', 'briefing.objectiveStrike', 'briefing.objectiveReturn'];
  return `
    <section class="screen screen-shell briefing-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('briefing.title')}</div>
          <div class="screen-subtitle">${t('briefing.subtitle')}</div>
        </div>
      </div>

      <div class="panel hero-panel briefing-panel">
        <div class="panel-header">${t(mission.titleKey)}</div>
        <div class="panel-body stack">
          <div class="mission-meta">
            <span class="tag gold">${mission.year}</span>
            <span class="tag">${t(mission.theatreKey)}</span>
            <span class="tag">${t(mission.operationKey)}</span>
          </div>
          <p>${t(mission.summaryKey)}</p>
          <div class="briefing-campaign-intel">
            <div><span>${t('campaign.base')}</span><strong>${mission.baseKey ? t(mission.baseKey) : (campaign ? t(campaign.baseKey) : '--')}</strong></div>
            <div><span>${t('campaign.goal')}</span><strong>${mission.strategicGoalKey ? t(mission.strategicGoalKey) : (campaign ? t(campaign.strategicGoalKey) : '--')}</strong></div>
            <div><span>${t('campaign.enemy')}</span><strong>${mission.enemyKey ? t(mission.enemyKey) : (campaign ? t(campaign.enemyKey) : '--')}</strong></div>
          </div>
          <div class="empty-state compact"><strong>${t('briefing.historicalNote')}</strong><br>${t(mission.historicalNoteKey || 'briefing.defaultHistoricalNote')}</div>
          <div class="stat-strip">
            <div class="stat-box"><div class="stat-label">${t('common.reward')}</div><div class="stat-value">${mission.reward}</div></div>
            <div class="stat-box"><div class="stat-label">XP</div><div class="stat-value">${mission.xp}</div></div>
            <div class="stat-box"><div class="stat-label">${t('common.difficulty')}</div><div class="stat-value">${mission.difficulty}</div></div>
          </div>
          <div class="briefing-logistics-card">
            <strong>${t('logistics.launchReadiness')}</strong>
            <span class="muted">${logisticsPlan?.missionId === mission.id ? t('logistics.briefingPlanReady') : t('logistics.briefingAutoPlan')}</span>
            <div class="logistics-state">
              <span class="tag ${readiness?.overall >= 58 ? 'success' : 'warn'}">${t('logistics.readiness')}: ${readiness?.overall ?? '--'}%</span>
              <span class="tag ${logisticsPlan?.missionId === mission.id ? 'success' : 'gold'}">${logisticsPlan?.missionId === mission.id ? t('logistics.planActive') : t('logistics.planRequired')}</span>
            </div>
            <button class="button secondary block" data-nav="career">${t('logistics.openCareer')}</button>
          </div>
          <div class="stack" style="gap:8px;">
            <div class="kicker">${t('briefing.objectives')}</div>
            <ul class="bullet-list">
              ${objectiveKeys.map((key) => `<li>${t(key)}</li>`).join('')}
            </ul>
          </div>
          ${operationAutosave && operationAutosave.missionId === mission.id ? `
            <div class="operation-resume-panel">
              <strong>${t('profiles.operationAvailable')}</strong>
              <span>${t('profiles.operationResumeHint')}</span>
              <button class="button block" data-action="resume-operation">${t('profiles.resumeOperation')}</button>
              <button class="button ghost block" data-action="discard-operation">${t('profiles.discardOperation')}</button>
            </div>
          ` : ''}
          <button class="button block" data-action="start-mission">${t('briefing.deploy')}</button>
        </div>
      </div>
      ${renderBottomNav('campaign', t)}
    </section>
  `;
}
