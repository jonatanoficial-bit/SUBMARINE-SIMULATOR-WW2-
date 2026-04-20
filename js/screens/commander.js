import { renderBuildBadge } from '../components/ui.js';

export function renderCommanderScreen(t, nations, draft, avatarsByNation) {
  return `
    <section class="screen commander-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('setup.title')}</div>
          <div class="screen-subtitle">${t('app.subtitle')}</div>
        </div>
        ${renderBuildBadge(t)}
      </div>

      <div class="panel">
        <div class="panel-header">${t('setup.name')}</div>
        <div class="panel-body">
          <input class="input" id="commander-name" type="text" maxlength="24" value="${draft.name}" placeholder="${t('setup.namePlaceholder')}">
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${t('setup.chooseNation')}</div>
        <div class="panel-body row wrap">
          ${nations.map((nation) => `
            <button class="chip ${draft.nationId === nation.id ? 'active' : ''}" data-action="select-nation" data-nation="${nation.id}">${t(nation.nameKey)}</button>
          `).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${t('setup.chooseAvatar')}</div>
        <div class="panel-body avatar-grid">
          ${avatarsByNation.map((avatarPath) => `
            <button class="avatar-option ${draft.avatar === avatarPath ? 'active' : ''}" data-action="select-avatar" data-avatar="${avatarPath}">
              <div class="avatar-frame"><img src="${avatarPath}" alt="avatar"></div>
              <div class="avatar-caption">${t(`nation.${draft.nationId}.name`)}</div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="row wrap mt-auto">
        <button class="button ghost grow" data-nav="mainMenu">${t('common.back')}</button>
        <button class="button grow" data-action="confirm-commander">${t('setup.confirm')}</button>
      </div>
    </section>
  `;
}
