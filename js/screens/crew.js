import { renderBottomNav } from '../components/ui.js';

export function renderCrew(t, crewMembers, hiredIds, budgetAvailable, totalCost) {
  return `
    <section class="screen screen-shell">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('crew.title')}</div>
          <div class="screen-subtitle">${t('crew.subtitle')}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-body compact row wrap space-between">
          <span class="tag gold">${t('crew.budget')}: ${budgetAvailable}</span>
          <span class="tag">${t('crew.total')}: ${totalCost}</span>
        </div>
      </div>

      <div class="stack">
        ${crewMembers.map((crew) => {
          const hired = hiredIds.includes(crew.id);
          return `
            <div class="crew-card ${hired ? 'active' : ''}">
              <div class="crew-avatar"><img src="${crew.avatar}" alt="${crew.name}"></div>
              <div class="stack" style="gap: 8px;">
                <div class="row space-between align-start">
                  <div>
                    <h3>${crew.name}</h3>
                    <p>${t(crew.roleKey)} • ${t(crew.bonusKey)}</p>
                  </div>
                  <span class="tag ${hired ? 'success' : ''}">${crew.cost}</span>
                </div>
                <p class="muted">${t(crew.bioKey)}</p>
                <div class="row space-between">
                  <span>${t('crew.skill')}: <strong>${crew.skill}</strong></span>
                  <button class="button ${hired ? 'warn' : 'secondary'}" data-action="toggle-crew" data-crew="${crew.id}">${hired ? t('crew.remove') : t('crew.hire')}</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${renderBottomNav('crew', t)}
    </section>
  `;
}
