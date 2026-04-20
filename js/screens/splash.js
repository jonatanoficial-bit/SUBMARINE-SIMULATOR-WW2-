import { renderBuildBadge } from '../components/ui.js';
import { ASSETS } from '../assets.js';

export function renderSplash(t) {
  return `
    <section class="screen splash-screen">
      <div class="logo-stack">
        <img class="main-logo" src="${ASSETS.logos.main}" alt="Submarine Commander WW2">
        <img class="studio-mark" src="${ASSETS.logos.valeClean}" alt="Vale Games">
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
