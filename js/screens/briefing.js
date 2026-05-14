import { renderBottomNav } from '../components/ui.js';

export function renderBriefing(t, mission) {
  const objectiveKeys = mission.objectiveKeys || ['briefing.objectiveSilent', 'briefing.objectiveStrike', 'briefing.objectiveReturn'];
  return `
    <section class="screen screen-shell">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('briefing.title')}</div>
          <div class="screen-subtitle">${t('briefing.subtitle')}</div>
        </div>
      </div>

      <div class="panel hero-panel">
        <div class="panel-header">${t(mission.titleKey)}</div>
        <div class="panel-body stack">
          <div class="mission-meta">
            <span class="tag gold">${mission.year}</span>
            <span class="tag">${t(mission.theatreKey)}</span>
            <span class="tag">${t(mission.operationKey)}</span>
          </div>
          <p>${t(mission.summaryKey)}</p>
          <div class="empty-state compact"><strong>${t('briefing.historicalNote')}</strong><br>${t(mission.historicalNoteKey || 'briefing.defaultHistoricalNote')}</div>
          <div class="stat-strip">
            <div class="stat-box"><div class="stat-label">${t('common.reward')}</div><div class="stat-value">${mission.reward}</div></div>
            <div class="stat-box"><div class="stat-label">XP</div><div class="stat-value">${mission.xp}</div></div>
            <div class="stat-box"><div class="stat-label">${t('common.difficulty')}</div><div class="stat-value">${mission.difficulty}</div></div>
          </div>
          <div class="stack" style="gap:8px;">
            <div class="kicker">${t('briefing.objectives')}</div>
            <ul class="bullet-list">
              ${objectiveKeys.map((key) => `<li>${t(key)}</li>`).join('')}
            </ul>
          </div>
          <button class="button block" data-action="start-mission">${t('briefing.deploy')}</button>
        </div>
      </div>
      ${renderBottomNav('campaign', t)}
    </section>
  `;
}
