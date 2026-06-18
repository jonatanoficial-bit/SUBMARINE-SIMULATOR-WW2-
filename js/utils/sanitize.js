const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const UNSAFE_NAME_CHARS = /[<>`]/g;
const SAFE_ASSET_PATH = /^assets\/[a-zA-Z0-9_./-]+\.(?:png|webp|jpe?g|svg)$/i;

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function normalizeCommanderName(value = '') {
  return String(value)
    .replace(CONTROL_CHARS, '')
    .replace(UNSAFE_NAME_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}

export function normalizeAssetPath(value, fallback) {
  const path = String(value || '');
  if (!SAFE_ASSET_PATH.test(path) || path.includes('..')) return fallback;
  return path;
}

export function normalizeStringId(value, fallback = '') {
  const id = String(value || '').trim();
  return /^[a-z0-9_-]{1,64}$/i.test(id) ? id : fallback;
}

export function clampNumber(value, min, max, fallback = min) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

export function uniqueStringArray(value, maxItems = 200) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === 'string').slice(0, maxItems))];
}
