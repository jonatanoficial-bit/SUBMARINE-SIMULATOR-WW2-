import { renderBuildBadge } from '../components/ui.js';

export function renderSplash(t) {
  return `
    <section class="screen splash-screen">
      <div class="logo-stack">
        <img class="main-logo" src="assets/logos/submarine_commander_logo.png" alt="Submarine Commander WW2">
        <img class="studio-mark" src="assets/logos/vale_games_logo_clean.png" alt="Vale Games">
      </div>
      <div class="panel hero-panel center">
        <div class="stack center">
          <div class="pulse"><div class="splash-ring"></div></div>
          <div class="stack" style="text-align:center; gap:8px;">
            <strong>${t('splash.loading')}</strong>
            <span class="muted">${t('splash.preparing')}</span>
          </div>
          ${renderBuildBadge(t)}
        </div>
      </div>
    </section>
  `;
}
