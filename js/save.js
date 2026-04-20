const SAVE_KEY = 'valeGames.submarineCommander.save';
const SETTINGS_KEY = 'valeGames.submarineCommander.settings';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGame(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function createInitialSave({ commander, starterSubmarineId, credits }) {
  return {
    commander,
    progression: {
      level: 1,
      xp: 0,
      credits,
      completedMissions: []
    },
    submarine: {
      currentId: starterSubmarineId,
      unlockedIds: [starterSubmarineId]
    },
    crew: {
      hiredIds: []
    },
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}
