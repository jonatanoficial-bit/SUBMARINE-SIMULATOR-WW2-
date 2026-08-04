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
  profiles: [],
  activeProfileId: 'slot-1',
  operationAutosave: null,
  resumeOperation: false,
  settings: {
    language: 'pt-BR',
    music: 70,
    sound: 80,
    voices: true,
    graphics: 'high',
    vibration: true,
    difficulty: 'officer',
    tutorials: true,
    contextualHelp: true
  },
  selectedMissionId: null,
  selectedCampaignNationId: null,
  toast: ''
};

export function setScreen(screen) { state.currentScreen = screen; }
export function setData(data) { state.data = data; }
export function setLanguage(language) { state.language = language; state.settings.language = language; }
export function setSave(save) { state.save = save; }
export function setProfiles(profiles) { state.profiles = Array.isArray(profiles) ? profiles : []; }
export function setActiveProfileId(slotId) { state.activeProfileId = slotId; }
export function setOperationAutosave(operation) { state.operationAutosave = operation || null; }
export function setResumeOperation(value) { state.resumeOperation = Boolean(value); }
export function setSettings(settings) { state.settings = { ...state.settings, ...settings }; }
export function setDraft(partial) { state.commanderDraft = { ...state.commanderDraft, ...partial }; }
export function setMission(id) { state.selectedMissionId = id; }
export function setCampaignNation(id) { state.selectedCampaignNationId = id || null; }
export function setToast(message) { state.toast = message; }
