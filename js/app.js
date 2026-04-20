import { BUILD_INFO } from './build.js';
import { state, setData, setDraft, setLanguage, setMission, setSave, setScreen, setSettings, setToast } from './state.js';
import { loadGameData } from './dataLoader.js';
import { createInitialSave, clearSave, loadSave, loadSettings, saveGame, saveSettings } from './save.js';
import { applyDocumentLanguage, t } from './i18n.js';
import { renderBuildFooter } from './components/ui.js';
import { renderSplash } from './screens/splash.js';
import { renderMainMenu } from './screens/mainMenu.js';
import { renderCommanderScreen } from './screens/commander.js';
import { renderLobby } from './screens/lobby.js';
import { renderCampaign } from './screens/campaign.js';
import { renderArsenal } from './screens/arsenal.js';
import { renderCrew } from './screens/crew.js';
import { renderSettings } from './screens/settings.js';

const app = document.getElementById('app');
const buildFooter = document.getElementById('build-footer');
const toastEl = document.getElementById('toast');
let toastTimer = null;

const SCREEN_BACKGROUNDS = {
  splash: 'naval_battle',
  mainMenu: 'naval_base_lobby',
  commander: 'briefing_room',
  lobby: 'naval_base_lobby',
  campaign: 'strategy_room_alt',
  arsenal: 'arsenal_workshop',
  crew: 'briefing_room',
  settings: 'submarine_control_room'
};

function nationById(id) {
  return state.data.nations.find((item) => item.id === id);
}

function submarinesByNation(id) {
  return state.data.submarines.filter((item) => item.nation === id);
}

function crewByNation(id) {
  return state.data.crew.filter((item) => item.nation === id);
}

function getCurrentNationId() {
  return state.save?.commander?.nationId || state.commanderDraft.nationId;
}

function getCurrentNation() {
  return nationById(getCurrentNationId()) || state.data.nations[0];
}

function getCurrentSubmarine() {
  if (!state.save) return submarinesByNation(getCurrentNationId())[0];
  return state.data.submarines.find((item) => item.id === state.save.submarine.currentId) || submarinesByNation(getCurrentNationId())[0];
}

function getCurrentCrew() {
  if (!state.save) return [];
  return state.data.crew.filter((item) => state.save.crew.hiredIds.includes(item.id));
}

function showToast(message) {
  if (!message) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2200);
}

function setBackground(screen) {
  document.body.dataset.background = SCREEN_BACKGROUNDS[screen] || 'naval_base_lobby';
  const bg = document.querySelector('.app-background');
  bg.style.backgroundImage = `url(assets/backgrounds/${document.body.dataset.background}.png)`;
}

function updateFooter() {
  buildFooter.textContent = renderBuildFooter(t);
}

function syncPersistentSettings() {
  saveSettings(state.settings);
}

function saveAndRefreshToast(messageKey) {
  if (state.save) {
    state.save.meta.updatedAt = new Date().toISOString();
    saveGame(state.save);
  }
  syncPersistentSettings();
  setToast(t(messageKey));
  showToast(state.toast);
}

function createCommander() {
  const draft = state.commanderDraft;
  if (!draft.name.trim() || !draft.nationId || !draft.avatar) {
    showToast(t('setup.validation'));
    return;
  }
  const nation = nationById(draft.nationId);
  const commander = {
    name: draft.name.trim(),
    nationId: nation.id,
    avatar: draft.avatar,
    createdBuild: BUILD_INFO.version
  };
  const save = createInitialSave({
    commander,
    starterSubmarineId: nation.starterSubmarineId,
    credits: nation.starterCredits
  });
  setSave(save);
  saveGame(save);
  setScreen('lobby');
  showToast(t('toast.commanderCreated'));
  render();
}

function handleCrewToggle(id) {
  if (!state.save) return;
  const crew = state.data.crew.find((item) => item.id === id);
  if (!crew) return;
  const hired = state.save.crew.hiredIds.includes(id);
  const hiredIds = new Set(state.save.crew.hiredIds);
  const currentCrew = state.data.crew.filter((item) => hiredIds.has(item.id));
  const currentCost = currentCrew.reduce((sum, item) => sum + item.cost, 0);
  if (hired) {
    hiredIds.delete(id);
  } else {
    const budget = state.save.progression.credits;
    if (currentCost + crew.cost > budget) {
      showToast(`${t('crew.budget')}: ${budget}`);
      return;
    }
    hiredIds.add(id);
  }
  state.save.crew.hiredIds = [...hiredIds];
  saveAndRefreshToast('toast.crewUpdated');
  render();
}

function handleReset() {
  if (!confirm(t('settings.resetConfirm'))) return;
  clearSave();
  setSave(null);
  setScreen('mainMenu');
  showToast(t('toast.resetDone'));
  render();
}

function initEvents() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-nav], [data-action]');
    if (!target) return;

    const nav = target.dataset.nav;
    if (nav) {
      if (nav !== 'settings' && !state.save && ['lobby', 'campaign', 'arsenal', 'crew'].includes(nav)) {
        showToast(t('menu.noSave'));
        return;
      }
      setScreen(nav);
      render();
      return;
    }

    switch (target.dataset.action) {
      case 'go-new-game':
        setScreen('commander');
        render();
        break;
      case 'continue':
        if (state.save) {
          setScreen('lobby');
          render();
        }
        break;
      case 'select-nation': {
        const nationId = target.dataset.nation;
        const avatar = crewByNation(nationId)[0]?.avatar || state.commanderDraft.avatar;
        const nationAvatarMap = {
          de: 'assets/avatars/de/captain_01.png',
          uk: 'assets/avatars/uk/captain_01.png',
          us: 'assets/avatars/us/captain_01.png'
        };
        setDraft({ nationId, avatar: nationAvatarMap[nationId] || avatar });
        render();
        break;
      }
      case 'select-avatar':
        setDraft({ avatar: target.dataset.avatar });
        render();
        break;
      case 'confirm-commander':
        createCommander();
        break;
      case 'select-mission':
        setMission(target.dataset.mission);
        render();
        break;
      case 'toast-briefing':
        showToast(t('campaign.placeholder'));
        break;
      case 'toggle-crew':
        handleCrewToggle(target.dataset.crew);
        break;
      case 'set-language':
        setLanguage(target.dataset.lang);
        syncPersistentSettings();
        applyDocumentLanguage();
        render();
        break;
      case 'toggle-vibration':
        setSettings({ vibration: !state.settings.vibration });
        saveAndRefreshToast('toast.settingsSaved');
        render();
        break;
      case 'reset-progress':
        handleReset();
        break;
      default:
        break;
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'commander-name') {
      setDraft({ name: event.target.value });
      return;
    }
    if (event.target.dataset.settingRange) {
      setSettings({ [event.target.dataset.settingRange]: Number(event.target.value) });
      syncPersistentSettings();
      render();
      return;
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.dataset.settingSelect) {
      setSettings({ [event.target.dataset.settingSelect]: event.target.value });
      saveAndRefreshToast('toast.settingsSaved');
      render();
    }
  });
}

function render() {
  if (!state.data) {
    app.innerHTML = renderSplash((key) => key);
    return;
  }

  setBackground(state.currentScreen);
  applyDocumentLanguage();
  updateFooter();

  const nationId = getCurrentNationId();
  const nation = getCurrentNation();
  const avatarsByNation = {
    de: [
      'assets/avatars/de/captain_01.png',
      'assets/avatars/de/officer_01.png',
      'assets/avatars/de/mechanic_01.png',
      'assets/avatars/de/sonar_01.png'
    ],
    uk: [
      'assets/avatars/uk/captain_01.png',
      'assets/avatars/uk/sailor_01.png'
    ],
    us: [
      'assets/avatars/us/captain_01.png',
      'assets/avatars/us/sailor_01.png'
    ]
  };

  switch (state.currentScreen) {
    case 'splash':
      app.innerHTML = renderSplash(t);
      break;
    case 'mainMenu':
      app.innerHTML = renderMainMenu(t, Boolean(state.save), state.settings.language);
      break;
    case 'commander':
      app.innerHTML = renderCommanderScreen(t, state.data.nations, state.commanderDraft, avatarsByNation[nationId]);
      break;
    case 'lobby':
      app.innerHTML = renderLobby(t, state.save, nation, getCurrentSubmarine(), getCurrentCrew());
      break;
    case 'campaign':
      app.innerHTML = renderCampaign(t, state.data.missions, state.data.missions.find((item) => item.id === state.selectedMissionId) || state.data.missions[0]);
      break;
    case 'arsenal':
      app.innerHTML = renderArsenal(t, submarinesByNation(nationId), state.save?.submarine.currentId, state.save?.progression.level || 1);
      break;
    case 'crew': {
      const nationCrew = crewByNation(nationId);
      const hiredIds = state.save?.crew.hiredIds || [];
      const total = nationCrew.filter((item) => hiredIds.includes(item.id)).reduce((sum, item) => sum + item.cost, 0);
      const budget = (state.save?.progression.credits || 0) - total;
      app.innerHTML = renderCrew(t, nationCrew, hiredIds, budget, total);
      break;
    }
    case 'settings':
      app.innerHTML = renderSettings(t, state.settings);
      break;
    default:
      setScreen('mainMenu');
      render();
      break;
  }
}

async function boot() {
  try {
    const [data, settings, save] = await Promise.all([
      loadGameData(),
      Promise.resolve(loadSettings()),
      Promise.resolve(loadSave())
    ]);
    setData(data);
    if (settings) setSettings(settings);
    setLanguage(settings?.language || 'pt-BR');
    if (save) setSave(save);
    buildFooter.textContent = `${BUILD_INFO.version} • ${BUILD_INFO.date} • ${BUILD_INFO.time}`;
    render();
    setTimeout(() => {
      if (state.currentScreen === 'splash') {
        setScreen('mainMenu');
        render();
      }
    }, 1200);
  } catch (error) {
    app.innerHTML = `<section class="screen splash-screen"><div class="panel hero-panel center"><strong>Load error</strong><span class="muted">${error.message}</span></div></section>`;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

initEvents();
render();
boot();
