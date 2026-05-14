import { BUILD_INFO } from './build.js';

const FALLBACK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
  <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#111a24"/><stop offset="1" stop-color="#2e2415"/></linearGradient></defs>
  <rect width="320" height="200" rx="18" fill="url(#g)"/>
  <path d="M70 112h170c18 0 29-7 34-18l8 18h20l-14 18H74c-20 0-36-9-48-24 12 5 27 6 44 6Z" fill="#d9b56d" opacity=".75"/>
  <text x="160" y="152" fill="#f3cc87" text-anchor="middle" font-family="Arial" font-size="16">ASSET FALLBACK</text>
</svg>`)}`;

export function setViewportUnit() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

export function requestFullscreenSafe() {
  const root = document.documentElement;
  const fn = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
  if (fn) return fn.call(root).catch?.(() => false);
  return false;
}

export function vibrateSafe(pattern = 18) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

export function guardAction(condition, message, onFail = () => {}) {
  if (condition) return true;
  try { onFail(message); } catch {}
  return false;
}

export function initSafety() {
  setViewportUnit();
  window.addEventListener('resize', setViewportUnit, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(setViewportUnit, 250), { passive: true });

  document.addEventListener('error', (event) => {
    const target = event.target;
    if (target && target.tagName === 'IMG' && !target.dataset.fallbackApplied) {
      target.dataset.fallbackApplied = '1';
      target.src = FALLBACK_SVG;
      target.classList.add('asset-fallback');
    }
  }, true);

  window.addEventListener('error', (event) => {
    document.body.dataset.lastError = `${BUILD_INFO.version}: ${event.message || 'runtime-error'}`;
    console.warn('[Submarine Commander safety]', event.message, event.filename, event.lineno);
  });

  window.addEventListener('unhandledrejection', (event) => {
    document.body.dataset.lastError = `${BUILD_INFO.version}: promise-error`;
    console.warn('[Submarine Commander safety promise]', event.reason);
  });
}
