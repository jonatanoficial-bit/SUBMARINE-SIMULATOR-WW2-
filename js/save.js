const SAVE_KEY = 'valeGames.submarineCommander.save';
const SETTINGS_KEY = 'valeGames.submarineCommander.settings';

function migrateSave(save) {
  if (!save) return null;
  save.progression = {
    level: 1,
    xp: 0,
    credits: 5000,
    completedMissions: [],
    ...save.progression
  };
  save.submarine = {
    currentId: save.submarine?.currentId || null,
    unlockedIds: save.submarine?.unlockedIds || [],
    upgrades: save.submarine?.upgrades || []
  };
  save.crew = {
    hiredIds: save.crew?.hiredIds || []
  };
  save.economy = {
    totalEarned: 0,
    totalSpent: 0,
    ...save.economy
  };
  save.meta = {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...save.meta
  };
  return save;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? migrateSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveGame(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function clearSave() { localStorage.removeItem(SAVE_KEY); }

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

export function createInitialSave({ commander, starterSubmarineId, credits }) {
  return migrateSave({
    commander,
    progression: {
      level: 1,
      xp: 0,
      credits,
      completedMissions: []
    },
    submarine: {
      currentId: starterSubmarineId,
      unlockedIds: [starterSubmarineId],
      upgrades: []
    },
    crew: {
      hiredIds: []
    },
    economy: {
      totalEarned: credits,
      totalSpent: 0
    },
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
}
