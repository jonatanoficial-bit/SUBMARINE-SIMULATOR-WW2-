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
