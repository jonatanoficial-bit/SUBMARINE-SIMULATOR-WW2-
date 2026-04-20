import { renderBottomNav, renderStatBar } from '../components/ui.js';

export function renderArsenal(t, submarines, currentId, level) {
  return `
    <section class="screen screen-shell">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('arsenal.title')}</div>
          <div class="screen-subtitle">${t('arsenal.subtitle')}</div>
        </div>
      </div>

      <div class="stack">
        ${submarines.map((submarine) => {
          const isCurrent = submarine.id === currentId;
          const unlocked = submarine.unlocked || level >= submarine.levelRequired;
          return `
            <div class="sub-card ${isCurrent ? 'active' : ''}">
              <div class="sub-visual"><img src="${submarine.image}" alt="${submarine.name}"></div>
              <div class="row space-between align-start" style="margin-top: 10px;">
                <div>
                  <h3>${submarine.name}</h3>
                  <p>${unlocked ? t('arsenal.note') : t('arsenal.locked', { level: submarine.levelRequired })}</p>
                </div>
                <span class="tag ${unlocked ? 'success' : 'warn'}">${isCurrent ? t('arsenal.current') : (unlocked ? t('common.available') : t('common.locked'))}</span>
              </div>
              <div class="stack" style="margin-top: 12px; gap: 10px;">
                ${Object.entries(submarine.stats).map(([key, value]) => `
                  <div class="stack" style="gap: 6px;">
                    <div class="row space-between"><span>${t(`arsenal.stats.${key}`)}</span><strong>${value}</strong></div>
                    ${renderStatBar(value)}
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${renderBottomNav('arsenal', t)}
    </section>
  `;
}
