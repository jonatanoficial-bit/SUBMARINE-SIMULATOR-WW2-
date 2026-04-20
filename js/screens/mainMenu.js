import { BUILD_INFO } from '../build.js';
import { renderBuildBadge } from '../components/ui.js';
import { ASSETS } from '../assets.js';

export function renderMainMenu(t, hasSave, settingsLanguage) {
  return `
    <section class="screen main-menu">
      <div class="logo-stack panel hero-panel">
        <img class="main-logo" src="${ASSETS.logos.main}" alt="Submarine Commander WW2">
        <div class="stack" style="gap:8px; text-align:center; align-items:center;">
          <div class="screen-subtitle">${t('menu.choosePath')}</div>
          ${renderBuildBadge(t)}
          <span class="tag gold">${BUILD_INFO.progress}% ${t('app.progress').toLowerCase()}</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${t('menu.studio')}</div>
        <div class="panel-body main-menu-actions">
          <button class="button block" data-action="go-new-game">${t('menu.newGame')}</button>
          <button class="button secondary block" data-action="continue" ${hasSave ? '' : 'disabled'}>${t('menu.continue')}</button>
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
