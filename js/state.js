export const state = {
  currentScreen: 'splash',
  data: null,
  i18n: {},
  language: 'pt-BR',
  commanderDraft: {
    name: '',
    nationId: 'de',
    avatar: 'assets/avatars/de/captain_01.png'
  },
  save: null,
  settings: {
    language: 'pt-BR',
    music: 70,
    sound: 80,
    graphics: 'high',
    vibration: true
  },
  selectedMissionId: null,
  toast: ''
};

export function setScreen(screen) {
  state.currentScreen = screen;
}

export function setData(data) {
  state.data = data;
}

export function setLanguage(language) {
  state.language = language;
  state.settings.language = language;
}

export function setSave(save) {
  state.save = save;
}

export function setSettings(settings) {
  state.settings = { ...state.settings, ...settings };
}

export function setDraft(partial) {
  state.commanderDraft = { ...state.commanderDraft, ...partial };
}

export function setMission(id) {
  state.selectedMissionId = id;
}

export function setToast(message) {
  state.toast = message;
}
