import { renderBottomNav } from '../components/ui.js';

export function renderCrew(t, crewMembers, hiredIds, credits) {
  return `
    <section class="screen screen-shell">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('crew.title')}</div>
          <div class="screen-subtitle">${t('crew.subtitle')}</div>
        </div>
        <span class="tag success">${t('common.credits')}: ${credits}</span>
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
                    <p>${t(crew.roleKey)} • ${t(crew.bonusKey)} • ${t(crew.bioKey)}</p>
                  </div>
                  <span class="tag ${hired ? 'success' : 'gold'}">${hired ? t('crew.hired') : crew.cost}</span>
                </div>
                <div class="row wrap space-between">
                  <span>${t('crew.skill')}: ${crew.skill}%</span>
                  <span>${t('common.level')}: ${crew.level}</span>
                </div>
                <div class="progress-bar"><span style="width:${crew.skill}%"></span></div>
                ${hired ? '' : `<button class="button ghost" data-action="toggle-crew" data-crew="${crew.id}">${t('crew.hire')}</button>`}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${renderBottomNav('crew', t)}
    </section>
  `;
}
