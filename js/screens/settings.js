import { renderBottomNav } from '../components/ui.js';

export function renderSettings(t, settings) {
  return `
    <section class="screen screen-shell settings-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <button class="button ghost" style="align-self:flex-start; margin-bottom:10px;" data-nav="mainMenu">${t('common.back')}</button>
          <div class="screen-title">${t('settings.title')}</div>
          <div class="screen-subtitle">${t('settings.subtitle')}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${t('common.language')}</div>
        <div class="panel-body row wrap">
          <button class="chip ${settings.language === 'pt-BR' ? 'active' : ''}" data-action="set-language" data-lang="pt-BR">${t('languages.ptBR')}</button>
          <button class="chip ${settings.language === 'en' ? 'active' : ''}" data-action="set-language" data-lang="en">${t('languages.en')}</button>
          <button class="chip ${settings.language === 'es' ? 'active' : ''}" data-action="set-language" data-lang="es">${t('languages.es')}</button>
        </div>
      </div>

      <div class="panel immersive-settings-panel">
        <div class="panel-header">${t('settings.mobile')}</div>
        <div class="panel-body stack">
          <button class="button block" data-action="request-fullscreen">${t('settings.fullscreen')}</button>
          <div class="empty-state compact">${t('settings.fullscreenHint')}</div>
          <div class="orientation-note"><strong>${t('settings.orientation')}</strong><span>${t('settings.orientationHint')}</span></div>
        </div>
      </div>

      <div class="panel difficulty-settings-panel">
        <div class="panel-header">${t('training.difficultyTitle')}</div>
        <div class="panel-body stack">
          <label class="slider-row">
            <span>${t('training.difficultyLabel')}</span>
            <select class="select" data-setting-select="difficulty">
              <option value="cadet" ${settings.difficulty === 'cadet' ? 'selected' : ''}>${t('training.difficulty.cadet')}</option>
              <option value="officer" ${settings.difficulty === 'officer' ? 'selected' : ''}>${t('training.difficulty.officer')}</option>
              <option value="simulator" ${settings.difficulty === 'simulator' ? 'selected' : ''}>${t('training.difficulty.simulator')}</option>
              <option value="hardcore" ${settings.difficulty === 'hardcore' ? 'selected' : ''}>${t('training.difficulty.hardcore')}</option>
            </select>
          </label>
          <div class="difficulty-description" data-difficulty-description="${settings.difficulty}">${t(`training.difficultyDesc.${settings.difficulty || 'officer'}`)}</div>
          <div class="row wrap space-between">
            <span>${t('training.tutorials')}</span>
            <button class="chip ${settings.tutorials ? 'active' : ''}" data-action="toggle-tutorials">${settings.tutorials ? t('common.on') : t('common.off')}</button>
          </div>
          <div class="row wrap space-between">
            <span>${t('training.contextualHelp')}</span>
            <button class="chip ${settings.contextualHelp ? 'active' : ''}" data-action="toggle-contextual-help">${settings.contextualHelp ? t('common.on') : t('common.off')}</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-body stack">
          <label class="slider-row">
            <span>${t('settings.music')}: ${settings.music}</span>
            <input type="range" min="0" max="100" value="${settings.music}" data-setting-range="music">
          </label>
          <label class="slider-row">
            <span>${t('settings.sound')}: ${settings.sound}</span>
            <input type="range" min="0" max="100" value="${settings.sound}" data-setting-range="sound">
          </label>
          <label class="slider-row">
            <span>${t('settings.graphics')}</span>
            <select class="select" data-setting-select="graphics">
              <option value="low" ${settings.graphics === 'low' ? 'selected' : ''}>${t('settings.low')}</option>
              <option value="medium" ${settings.graphics === 'medium' ? 'selected' : ''}>${t('settings.medium')}</option>
              <option value="high" ${settings.graphics === 'high' ? 'selected' : ''}>${t('settings.high')}</option>
            </select>
          </label>
          <div class="row wrap space-between">
            <span>${t('settings.vibration')}</span>
            <button class="chip active" data-action="toggle-vibration">${settings.vibration ? t('settings.vibration.on') : t('settings.vibration.off')}</button>
          </div>
        </div>
      </div>

      <button class="button ghost block" data-nav="profiles">${t('profiles.manage')}</button>
      <button class="button warn block" data-action="reset-progress">${t('settings.reset')}</button>
      ${renderBottomNav('settings', t)}
    </section>
  `;
}
