import { renderBottomNav } from '../components/ui.js';

export function renderCampaign(t, missions, selectedMission) {
  return `
    <section class="screen screen-shell">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('campaign.title')}</div>
          <div class="screen-subtitle">${t('campaign.subtitle')}</div>
        </div>
      </div>

      <div class="stack">
        ${missions.map((mission) => `
          <button class="mission-card ${selectedMission?.id === mission.id ? 'active' : ''}" data-action="select-mission" data-mission="${mission.id}">
            <div class="row space-between align-start">
              <div>
                <h3>${t(mission.titleKey)}</h3>
                <p>${t(mission.summaryKey)}</p>
              </div>
              <span class="tag ${mission.status === 'available' ? 'success' : 'warn'}">${t(`campaign.status.${mission.status}`)}</span>
            </div>
            <div class="mission-meta">
              <span class="tag">${t(mission.theatreKey)}</span>
              <span class="tag gold">${t('common.difficulty')}: ${mission.difficulty}</span>
              <span class="tag">${t('common.reward')}: ${mission.reward}</span>
              <span class="tag">XP: ${mission.xp}</span>
            </div>
          </button>
        `).join('')}
      </div>

      <div class="panel">
        <div class="panel-header">${selectedMission ? t(selectedMission.titleKey) : t('campaign.play')}</div>
        <div class="panel-body stack">
          <p class="muted">${selectedMission ? t(selectedMission.summaryKey) : t('campaign.placeholder')}</p>
          <button class="button ${selectedMission && selectedMission.status === 'available' ? '' : 'secondary'} block" ${selectedMission && selectedMission.status === 'available' ? 'data-action="open-briefing"' : 'disabled'}>${t('campaign.play')}</button>
        </div>
      </div>

      ${renderBottomNav('campaign', t)}
    </section>
  `;
}
