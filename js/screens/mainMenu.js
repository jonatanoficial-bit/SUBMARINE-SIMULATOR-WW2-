import { renderBuildBadge } from '../components/ui.js';

export function renderMainMenu(t, hasSave, settingsLanguage, activeProfile = null, hasOperationAutosave = false) {
  const profileText = activeProfile?.metadata
    ? `${t('profiles.slot', { number: activeProfile.number })} • ${activeProfile.metadata.commanderName} • ${t('common.level')} ${activeProfile.metadata.level}`
    : `${t('profiles.slot', { number: activeProfile?.number || 1 })} • ${t('profiles.empty')}`;
  return `
    <section class="screen main-menu main-menu-responsive">
      <div class="logo-stack panel hero-panel">
        <img class="main-logo" src="assets/logos/submarine_commander_logo.png" alt="Submarine Commander WW2">
        <div class="stack" style="gap:8px; text-align:center; align-items:center;">
          <div class="screen-subtitle">${t('menu.choosePath')}</div>
          ${renderBuildBadge(t)}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${t('menu.studio')}</div>
        <div class="panel-body main-menu-actions">
          <div class="active-profile-summary">
            <span class="kicker">${t('profiles.activeProfile')}</span>
            <strong>${profileText}</strong>
            ${hasOperationAutosave ? `<span class="tag success">${t('profiles.operationAvailable')}</span>` : ''}
          </div>
          <button class="button block" data-action="go-new-game">${t('menu.newGame')}</button>
          <button class="button secondary block" data-action="continue" ${hasSave ? '' : 'disabled'}>${t('menu.continue')}</button>
          ${hasSave && hasOperationAutosave ? `<button class="button block" data-action="resume-operation">${t('profiles.resumeOperation')}</button>` : ''}
          <button class="button ghost block" data-nav="profiles">${t('profiles.manage')}</button>
          <button class="button ghost block" data-action="request-fullscreen">${t('menu.fullscreen')}</button>
          <button class="button ghost block" data-nav="settings">${t('menu.settings')}</button>
          <div class="main-menu-grid">
            <button class="chip ${settingsLanguage === 'pt-BR' ? 'active' : ''}" data-action="set-language" data-lang="pt-BR">${t('languages.ptBR')}</button>
            <button class="chip ${settingsLanguage === 'en' ? 'active' : ''}" data-action="set-language" data-lang="en">${t('languages.en')}</button>
            <button class="chip ${settingsLanguage === 'es' ? 'active' : ''}" data-action="set-language" data-lang="es">${t('languages.es')}</button>
          </div>
          ${hasSave ? '' : `<div class="empty-state">${t('menu.noSave')}</div>`}
        </div>
      </div>
    </section>
  `;
}
