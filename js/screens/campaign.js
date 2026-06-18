import { renderBottomNav } from '../components/ui.js';

function missionStatusLabel(t, mission) {
  if (mission.status === 'available') return t('campaign.status.available');
  return t('campaign.status.locked');
}

export function renderCampaign(t, missions, selectedMission, campaign, nation, progress = {}) {
  const completed = Number(progress.completed || 0);
  const total = Number(progress.total || missions.length || 0);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return `
    <section class="screen screen-shell campaign-screen phase11-campaign-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('campaign.title')}</div>
          <div class="screen-subtitle">${campaign ? t(campaign.titleKey) : t('campaign.subtitle')}</div>
        </div>
      </div>

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
            <div class="campaign-progress-block">
              <div class="row space-between"><span>${t('campaign.progressLabel')}</span><strong>${completed}/${total}</strong></div>
              <div class="campaign-progress-track"><i style="width:${pct}%"></i></div>
            </div>
            <div class="campaign-info-grid">
              <div><span>${t('campaign.base')}</span><strong>${campaign ? t(campaign.baseKey) : '--'}</strong></div>
              <div><span>${t('campaign.chronology')}</span><strong>${campaign ? t(campaign.chronologyKey) : '--'}</strong></div>
              <div><span>${t('campaign.doctrine')}</span><strong>${campaign ? t(campaign.doctrineKey) : '--'}</strong></div>
              <div><span>${t('campaign.enemy')}</span><strong>${campaign ? t(campaign.enemyKey) : '--'}</strong></div>
            </div>
            <div class="empty-state compact"><strong>${t('campaign.goal')}</strong><br>${campaign ? t(campaign.strategicGoalKey) : ''}</div>
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
            <button class="button ${selectedMission && selectedMission.status === 'available' ? '' : 'secondary'} block" ${selectedMission && selectedMission.status === 'available' ? 'data-action="open-briefing"' : 'disabled'}>${t('campaign.play')}</button>
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
