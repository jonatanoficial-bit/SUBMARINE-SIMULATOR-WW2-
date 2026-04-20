import { renderBottomNav, renderCommanderSummary, renderProgressMini } from '../components/ui.js';

export function renderLobby(t, save, nation, submarine, crewMembers) {
  const nextLevelXp = save.progression.level * 300;
  return `
    <section class="screen screen-shell">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('nav.lobby')}</div>
          <div class="screen-subtitle">${t('lobby.overview')}</div>
        </div>
        <span class="top-badge">${t(nation.nameKey)} • ${t(nation.factionKey)}</span>
      </div>

      ${renderCommanderSummary(save, nation, t)}

      <div class="panel">
        <div class="panel-header">${t('lobby.careerProgress')}</div>
        <div class="panel-body stack">
          <div class="row space-between"><strong>XP</strong><span>${save.progression.xp}/${nextLevelXp}</span></div>
          ${renderProgressMini(save.progression.xp, nextLevelXp)}
          <div class="stat-strip">
            <div class="stat-box"><div class="stat-label">${t('lobby.completedMissions')}</div><div class="stat-value">${save.progression.completedMissions.length}</div></div>
            <div class="stat-box"><div class="stat-label">${t('lobby.totalSpent')}</div><div class="stat-value">${save.economy.totalSpent}</div></div>
            <div class="stat-box"><div class="stat-label">${t('lobby.totalEarned')}</div><div class="stat-value">${save.economy.totalEarned}</div></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${t('lobby.currentSub')}</div>
        <div class="panel-body stack">
          <div class="sub-card active">
            <div class="sub-visual"><img src="${submarine.image}" alt="${submarine.name}"></div>
            <h3>${submarine.name}</h3>
            <p>${t('arsenal.note')}</p>
            <div class="stat-strip">
              <div class="stat-box"><div class="stat-label">${t('arsenal.stats.speed')}</div><div class="stat-value">${submarine.stats.speed}</div></div>
              <div class="stat-box"><div class="stat-label">${t('arsenal.stats.stealth')}</div><div class="stat-value">${submarine.stats.stealth}</div></div>
              <div class="stat-box"><div class="stat-label">${t('arsenal.stats.torpedoes')}</div><div class="stat-value">${submarine.stats.torpedoes}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${t('lobby.quickActions')}</div>
        <div class="panel-body stack">
          <button class="action-card" data-nav="campaign">
            <img class="action-icon" src="assets/ui/icons/icon_navigation.png" alt="">
            <div><div class="action-title">${t('nav.campaign')}</div><div class="action-subtitle">${t('campaign.subtitle')}</div></div>
          </button>
          <button class="action-card" data-nav="arsenal">
            <img class="action-icon" src="assets/ui/icons/icon_submarine.png" alt="">
            <div><div class="action-title">${t('nav.arsenal')}</div><div class="action-subtitle">${t('arsenal.subtitle')}</div></div>
          </button>
          <button class="action-card" data-nav="crew">
            <img class="action-icon" src="assets/ui/icons/icon_crew.png" alt="">
            <div><div class="action-title">${t('nav.crew')}</div><div class="action-subtitle">${t('crew.subtitle')}</div></div>
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${t('lobby.activeCrew')}</div>
        <div class="panel-body stack">
          ${crewMembers.length ? crewMembers.slice(0, 3).map((crew) => `
            <div class="row">
              <div class="crew-avatar" style="width:58px; height:72px;"><img src="${crew.avatar}" alt="${crew.name}"></div>
              <div class="grow">
                <strong>${crew.name}</strong>
                <div class="muted">${t(crew.roleKey)} • ${t(crew.bonusKey)}</div>
              </div>
            </div>
          `).join('') : `<div class="empty-state">${t('lobby.noCrew')}</div>`}
        </div>
      </div>

      ${renderBottomNav('lobby', t)}
    </section>
  `;
}
