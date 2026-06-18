import { state } from './state.js';

export function t(key, vars = {}) {
  const dictionary = state.data?.translations?.[state.language] || {};
  const template = dictionary[key] ?? key;
  return Object.entries(vars).reduce((acc, [name, value]) => acc.replace(`{${name}}`, value), template);
}

export function applyDocumentLanguage() {
  document.documentElement.lang = state.language;
}
