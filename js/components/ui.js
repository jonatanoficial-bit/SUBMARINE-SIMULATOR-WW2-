import { BUILD_INFO } from '../build.js';

export function renderBuildBadge(t) {
  return `
    <div class="top-badge">
      <span>${t('build.label')} ${BUILD_INFO.version}</span>
      <span>•</span>
      <span>${BUILD_INFO.date}</span>
      <span>•</span>
      <span>${BUILD_INFO.time}</span>
    </div>
  `;
}

export function renderBuildFooter(t) {
  return `${t('build.label')} ${BUILD_INFO.version} • ${BUILD_INFO.date} • ${BUILD_INFO.time} • ${BUILD_INFO.progress}% ${t('app.progress').toLowerCase()}`;
}

export function renderBottomNav(active, t) {
  const items = [
    { id: 'lobby', label: t('nav.lobby'), icon: 'assets/ui/icons/icon_submarine.png' },
    { id: 'campaign', label: t('nav.campaign'), icon: 'assets/ui/icons/icon_navigation.png' },
    { id: 'arsenal', label: t('nav.arsenal'), icon: 'assets/ui/icons/icon_submarine.png' },
    { id: 'crew', label: t('nav.crew'), icon: 'assets/ui/icons/icon_crew.png' },
    { id: 'settings', label: t('nav.settings'), icon: 'assets/ui/icons/icon_settings.png' }
  ];

  return `
    <nav class="bottom-nav">
      ${items.map((item) => `
        <button class="nav-button ${item.id === active ? 'active' : ''}" data-nav="${item.id}">
          <img src="${item.icon}" alt="${item.label}">
          <span>${item.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

export function renderCommanderSummary(save, nation, t) {
  return `
    <div class="panel edge-glow">
      <div class="panel-body compact commander-card">
        <div class="commander-portrait"><img src="${save.commander.avatar}" alt="${save.commander.name}"></div>
        <div class="commander-meta">
          <div>
            <div class="kicker">${t('lobby.welcome')}</div>
            <div class="commander-name">${save.commander.name}</div>
            <div class="commander-faction">${t(nation.factionKey)}</div>
          </div>
          <div class="row wrap">
            <span class="tag gold">${t('common.rank')}: ${t(nation.rankKey)}</span>
            <span class="tag">${t('common.level')}: ${save.progression.level}</span>
            <span class="tag success">${t('common.credits')}: ${save.progression.credits}</span>
            <span class="tag">XP: ${save.progression.xp}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderStatBar(value) {
  return `<div class="progress-bar"><span style="width:${Math.max(0, Math.min(100, value))}%"></span></div>`;
}

export function renderProgressMini(current, next) {
  const pct = Math.max(0, Math.min(100, (current / next) * 100));
  return `<div class="progress-bar compact"><span style="width:${pct}%"></span></div>`;
}
