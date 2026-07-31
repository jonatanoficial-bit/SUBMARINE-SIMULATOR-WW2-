import { escapeHtml } from '../utils/sanitize.js';

function formatDate(value, language) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch { return value; }
}

function nationLabel(t, nationId) {
  const map = { de: 'nation.de.name', uk: 'nation.uk.name', us: 'nation.us.name' };
  return t(map[nationId] || 'nation.de.name');
}

export function renderProfiles(t, profiles, language, operationAutosave = null) {
  const cards = profiles.map((profile) => {
    const metadata = profile.metadata;
    const active = profile.active ? 'active' : '';
    const operation = profile.active && operationAutosave
      ? `<div class="profile-operation"><strong>${t('profiles.operationAutosave')}</strong><small>${formatDate(operationAutosave.savedAt, language)}</small></div>`
      : '';
    return `
      <article class="panel profile-card ${active}" data-profile-card="${profile.id}">
        <div class="panel-header profile-card-header">
          <span>${t('profiles.slot', { number: profile.number })}</span>
          ${profile.active ? `<span class="tag success">${t('profiles.active')}</span>` : ''}
        </div>
        <div class="panel-body stack">
          ${metadata ? `
            <div class="profile-commander">${escapeHtml(metadata.commanderName)}</div>
            <div class="profile-meta-grid">
              <span><b>${t('profiles.nation')}</b>${nationLabel(t, metadata.nationId)}</span>
              <span><b>${t('common.level')}</b>${metadata.level}</span>
              <span><b>${t('profiles.updated')}</b>${formatDate(metadata.updatedAt, language)}</span>
            </div>
            ${operation}
            <div class="profile-actions">
              <button class="button ${profile.active ? 'secondary' : ''}" data-action="activate-profile" data-profile="${profile.id}">${profile.active ? t('profiles.continue') : t('profiles.activate')}</button>
              <button class="button ghost" data-action="export-profile" data-profile="${profile.id}">${t('profiles.export')}</button>
              <button class="button ghost" data-action="import-profile" data-profile="${profile.id}">${t('profiles.import')}</button>
              <button class="button ghost" data-action="restore-profile" data-profile="${profile.id}">${t('profiles.restoreBackup')}</button>
              <button class="button warn" data-action="delete-profile" data-profile="${profile.id}">${t('profiles.delete')}</button>
            </div>
          ` : `
            <div class="empty-state profile-empty">
              <strong>${t('profiles.empty')}</strong>
              <span>${t('profiles.emptyHint')}</span>
            </div>
            <div class="profile-actions">
              <button class="button" data-action="new-profile" data-profile="${profile.id}">${t('profiles.create')}</button>
              <button class="button ghost" data-action="import-profile" data-profile="${profile.id}">${t('profiles.import')}</button>
            </div>
          `}
        </div>
      </article>
    `;
  }).join('');

  return `
    <section class="screen screen-shell profiles-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <button class="button ghost" data-nav="mainMenu">${t('common.back')}</button>
          <div class="screen-title">${t('profiles.title')}</div>
          <div class="screen-subtitle">${t('profiles.subtitle')}</div>
        </div>
      </div>
      <div class="profiles-grid">${cards}</div>
      <input id="profile-import-input" type="file" accept="application/json,.json,.scww2save" hidden>
    </section>
  `;
}
