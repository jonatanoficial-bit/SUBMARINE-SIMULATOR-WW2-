import { BUILD_INFO } from './build.js';

const ERROR_LOG_KEY = 'valeGames.submarineCommander.runtimeErrors';
const FALLBACK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
  <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#111a24"/><stop offset="1" stop-color="#2e2415"/></linearGradient></defs>
  <rect width="320" height="200" rx="18" fill="url(#g)"/>
  <path d="M70 112h170c18 0 29-7 34-18l8 18h20l-14 18H74c-20 0-36-9-48-24 12 5 27 6 44 6Z" fill="#d9b56d" opacity=".75"/>
  <text x="160" y="152" fill="#f3cc87" text-anchor="middle" font-family="Arial" font-size="16">ASSET FALLBACK</text>
</svg>`)}`;

function safeErrorMessage(value) {
  if (value instanceof Error) return value.message || value.name;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return 'Unknown runtime error'; }
}

function persistRuntimeError(type, value, details = {}) {
  const entry = {
    type,
    message: safeErrorMessage(value).slice(0, 500),
    build: BUILD_INFO.version,
    buildId: BUILD_INFO.buildId,
    screen: document.body?.dataset?.screen || null,
    at: new Date().toISOString(),
    ...details
  };
  try {
    const previous = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]');
    const next = [entry, ...(Array.isArray(previous) ? previous : [])].slice(0, 20);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(next));
  } catch {}
  if (document.body) document.body.dataset.lastError = `${BUILD_INFO.version}:${type}`;
  console.warn('[Submarine Commander safety]', entry);
  return entry;
}

function viewportSize() {
  const visual = window.visualViewport;
  return {
    width: Math.max(1, Math.round(visual?.width || window.innerWidth || document.documentElement.clientWidth || 1)),
    height: Math.max(1, Math.round(visual?.height || window.innerHeight || document.documentElement.clientHeight || 1))
  };
}

function isStandaloneMode() {
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches || navigator.standalone);
}

export function setViewportUnit() {
  const { width, height } = viewportSize();
  const root = document.documentElement;
  root.style.setProperty('--vh', `${height * 0.01}px`);
  root.style.setProperty('--vw', `${width * 0.01}px`);
  root.style.setProperty('--app-height', `${height}px`);
  root.style.setProperty('--app-width', `${width}px`);
  root.dataset.orientation = width >= height ? 'landscape' : 'portrait';
  root.dataset.viewport = width < 480 ? 'phone' : (width < 1024 ? 'tablet' : 'desktop');
  root.dataset.standalone = isStandaloneMode() ? 'true' : 'false';
  root.dataset.fullscreen = (document.fullscreenElement || document.webkitFullscreenElement) ? 'true' : 'false';
}

export async function requestFullscreenSafe() {
  if (document.fullscreenElement || document.webkitFullscreenElement || isStandaloneMode()) {
    setViewportUnit();
    return true;
  }
  const root = document.documentElement;
  const fn = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
  if (!fn) return false;
  try {
    await fn.call(root, { navigationUI: 'hide' });
    setViewportUnit();
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  } catch (error) {
    persistRuntimeError('fullscreen', error);
    return false;
  }
}

export async function requestImmersiveMode({ preferLandscape = false } = {}) {
  const fullscreen = await requestFullscreenSafe();
  let orientationLocked = false;
  if (preferLandscape && screen.orientation?.lock) {
    try {
      await screen.orientation.lock('landscape');
      orientationLocked = true;
    } catch (error) {
      persistRuntimeError('orientation-lock', error, { nonCritical: true });
    }
  }
  setTimeout(setViewportUnit, 80);
  return { fullscreen, orientationLocked };
}

export function vibrateSafe(pattern = 18, enabled = true) {
  if (!enabled) return false;
  try {
    if (navigator.vibrate) return navigator.vibrate(pattern);
  } catch (error) {
    persistRuntimeError('vibration', error);
  }
  return false;
}

export function guardAction(condition, message, onFail = () => {}) {
  if (condition) return true;
  try { onFail(message); } catch (error) { persistRuntimeError('guard', error); }
  return false;
}

export function reportRuntimeError(error, context = {}) {
  return persistRuntimeError('runtime', error, context);
}

export function getRuntimeErrors() {
  try {
    const data = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export function initSafety() {
  setViewportUnit();
  window.addEventListener('resize', setViewportUnit, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(setViewportUnit, 180), { passive: true });
  window.visualViewport?.addEventListener('resize', setViewportUnit, { passive: true });
  window.visualViewport?.addEventListener('scroll', setViewportUnit, { passive: true });
  document.addEventListener('fullscreenchange', setViewportUnit, { passive: true });
  document.addEventListener('webkitfullscreenchange', setViewportUnit, { passive: true });

  document.addEventListener('error', (event) => {
    const target = event.target;
    if (target && target.tagName === 'IMG' && !target.dataset.fallbackApplied) {
      const failedSource = target.currentSrc || target.src || '';
      target.dataset.fallbackApplied = '1';
      target.src = FALLBACK_SVG;
      target.classList.add('asset-fallback');
      persistRuntimeError('asset', `Image failed: ${failedSource}`);
    }
  }, true);

  window.addEventListener('error', (event) => {
    persistRuntimeError('window-error', event.error || event.message, {
      file: event.filename || null,
      line: event.lineno || null,
      column: event.colno || null
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    persistRuntimeError('promise-rejection', event.reason);
  });
}
