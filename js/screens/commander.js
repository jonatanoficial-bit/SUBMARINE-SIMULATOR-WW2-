import { renderBuildBadge } from '../components/ui.js';
import { escapeHtml, normalizeAssetPath } from '../utils/sanitize.js';

export function renderCommanderScreen(t, nations, draft, avatarsByNation) {
  const safeDraftName = escapeHtml(draft.name || '');
  return `
    <section class="screen commander-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('setup.title')}</div>
          <div class="screen-subtitle">${t('app.subtitle')}</div>
        </div>
        ${renderBuildBadge(t)}
      </div>

      <div class="panel commander-name-panel">
        <div class="panel-header">${t('setup.name')}</div>
        <div class="panel-body">
          <input class="input" id="commander-name" type="text" maxlength="24" autocomplete="off" value="${safeDraftName}" placeholder="${escapeHtml(t('setup.namePlaceholder'))}">
        </div>
      </div>

      <div class="panel commander-nation-panel">
        <div class="panel-header">${t('setup.chooseNation')}</div>
        <div class="panel-body row wrap">
          ${nations.map((nation) => `
            <button class="chip ${draft.nationId === nation.id ? 'active' : ''}" data-action="select-nation" data-nation="${nation.id}">${t(nation.nameKey)}</button>
          `).join('')}
        </div>
      </div>

      <div class="panel commander-avatar-panel">
        <div class="panel-header">${t('setup.chooseAvatar')}</div>
        <div class="panel-body avatar-grid">
          ${avatarsByNation.map((avatarPath) => {
            const safeAvatar = normalizeAssetPath(avatarPath, 'assets/avatars/de/captain_01.png');
            return `
            <button class="avatar-option ${draft.avatar === avatarPath ? 'active' : ''}" data-action="select-avatar" data-avatar="${safeAvatar}">
              <div class="avatar-frame"><img src="${safeAvatar}" alt="avatar"></div>
              <div class="avatar-caption">${t(`nation.${draft.nationId}.name`)}</div>
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="row wrap mt-auto commander-actions">
        <button class="button ghost grow" data-nav="mainMenu">${t('common.back')}</button>
        <button class="button grow" data-action="confirm-commander">${t('setup.confirm')}</button>
      </div>
    </section>
  `;
}
