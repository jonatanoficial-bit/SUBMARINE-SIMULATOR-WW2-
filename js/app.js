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
import { renderBriefing } from './screens/briefing.js';
import { renderGameplay, mountGameplay, cleanupGameplay } from './screens/gameplay.js';

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
  briefing: 'briefing_room',
  gameplay: 'submarine_control_room',
  arsenal: 'arsenal_workshop',
  crew: 'briefing_room',
  settings: 'submarine_control_room'
};

function nationById(id) { return state.data.nations.find((item) => item.id === id); }
function submarinesByNation(id) {
  return state.data.submarines.filter((item) => item.nation === id).map((sub) => ({ ...sub, owned: state.save?.submarine?.unlockedIds?.includes(sub.id) }));
}
function crewByNation(id) { return state.data.crew.filter((item) => item.nation === id); }
function getCurrentNationId() { return state.save?.commander?.nationId || state.commanderDraft.nationId; }
function getCurrentNation() { return nationById(getCurrentNationId()) || state.data.nations[0]; }
function getCurrentSubmarine() {
  if (!state.save) return submarinesByNation(getCurrentNationId())[0];
  const sub = state.data.submarines.find((item) => item.id === state.save.submarine.currentId) || submarinesByNation(getCurrentNationId())[0];
  const bonus = getUpgradeBonus();
  return { ...sub, stats: applyStatsBonus(sub.stats, bonus) };
}
function getCurrentCrew() { return !state.save ? [] : state.data.crew.filter((item) => state.save.crew.hiredIds.includes(item.id)); }
function getSelectedMission() { return state.data.missions.find((item) => item.id === state.selectedMissionId) || state.data.missions[0]; }

function getUpgradeBonus() {
  const bonus = { speed: 0, range: 0, stealth: 0, depth: 0, torpedoes: 0 };
  (state.save?.submarine?.upgrades || []).forEach((id) => {
    const upgrade = state.data.upgrades.find((item) => item.id === id);
    if (!upgrade) return;
    Object.entries(upgrade.effect).forEach(([key, value]) => { bonus[key] = (bonus[key] || 0) + value; });
  });
  return bonus;
}

function applyStatsBonus(stats, bonus) {
  const merged = { ...stats };
  Object.keys(merged).forEach((key) => { merged[key] += bonus[key] || 0; });
  return merged;
}

function showToast(message) {
  if (!message) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function setBackground(screen) {
  document.body.dataset.background = SCREEN_BACKGROUNDS[screen] || 'naval_base_lobby';
  document.querySelector('.app-background').style.backgroundImage = `url(assets/backgrounds/${document.body.dataset.background}.png)`;
}
function updateFooter() { buildFooter.textContent = renderBuildFooter(t); }
function syncPersistentSettings() { saveSettings(state.settings); }
function commitSave(messageKey) {
  if (state.save) {
    state.save.meta.updatedAt = new Date().toISOString();
    saveGame(state.save);
  }
  syncPersistentSettings();
  if (messageKey) { setToast(t(messageKey)); showToast(state.toast); }
}

function createCommander() {
  const draft = state.commanderDraft;
  if (!draft.name.trim() || !draft.nationId || !draft.avatar) {
    showToast(t('setup.validation')); return;
  }
  const nation = nationById(draft.nationId);
  const commander = { name: draft.name.trim(), nationId: nation.id, avatar: draft.avatar, createdBuild: BUILD_INFO.version };
  const save = createInitialSave({ commander, starterSubmarineId: nation.starterSubmarineId, credits: nation.starterCredits });
  setSave(save); saveGame(save); setScreen('lobby'); showToast(t('toast.commanderCreated')); render();
}

function spendCredits(amount) {
  if (state.save.progression.credits < amount) return false;
  state.save.progression.credits -= amount;
  state.save.economy.totalSpent += amount;
  return true;
}

function addRewards(credits, xp) {
  state.save.progression.credits += credits;
  state.save.economy.totalEarned += credits;
  state.save.progression.xp += xp;
  while (state.save.progression.xp >= state.save.progression.level * 300) {
    state.save.progression.xp -= state.save.progression.level * 300;
    state.save.progression.level += 1;
    showToast(t('toast.levelUp', { level: state.save.progression.level }));
  }
}

function handleCrewHire(id) {
  if (!state.save) return;
  const crew = state.data.crew.find((item) => item.id === id);
  if (!crew || state.save.crew.hiredIds.includes(id)) return;
  if (!spendCredits(crew.cost)) { showToast(t('toast.notEnoughCredits')); return; }
  state.save.crew.hiredIds.push(id);
  commitSave('toast.crewUpdated');
  render();
}

function handleUnlockSubmarine(id) {
  const sub = state.data.submarines.find((item) => item.id === id);
  if (!sub || state.save.submarine.unlockedIds.includes(id)) return;
  const unlockCost = sub.unlockCost || 0;
  if (state.save.progression.level < sub.levelRequired) { showToast(t('toast.levelRequired', { level: sub.levelRequired })); return; }
  if (!spendCredits(unlockCost)) { showToast(t('toast.notEnoughCredits')); return; }
  state.save.submarine.unlockedIds.push(id);
  commitSave('toast.submarineUnlocked');
  render();
}

function handleEquipSubmarine(id) {
  if (!state.save.submarine.unlockedIds.includes(id)) return;
  state.save.submarine.currentId = id;
  commitSave('toast.submarineEquipped');
  render();
}

function handleBuyUpgrade(id) {
  const upgrade = state.data.upgrades.find((item) => item.id === id);
  if (!upgrade || state.save.submarine.upgrades.includes(id)) return;
  if (state.save.progression.level < upgrade.levelRequired) { showToast(t('toast.levelRequired', { level: upgrade.levelRequired })); return; }
  if (!spendCredits(upgrade.cost)) { showToast(t('toast.notEnoughCredits')); return; }
  state.save.submarine.upgrades.push(id);
  commitSave('toast.upgradeInstalled');
  render();
}

function handleCompleteMission(id) {
  const mission = state.data.missions.find((item) => item.id === id);
  if (!mission) return;
  if (!state.save.progression.completedMissions.includes(id)) {
    state.save.progression.completedMissions.push(id);
    addRewards(mission.reward, mission.xp);
    const idx = state.data.missions.findIndex((item) => item.id === id);
    const next = state.data.missions[idx + 1];
    if (next && next.status === 'locked') next.status = 'available';
  }
  commitSave('toast.missionCompleted');
  setScreen('lobby');
  render();
}

function syncMissionAvailability() {
  if (!state.save) return;
  const completed = state.save.progression.completedMissions || [];
  state.data.missions.forEach((mission, index) => {
    if (completed.includes(mission.id)) {
      mission.status = 'available';
      const next = state.data.missions[index + 1];
      if (next && next.status === 'locked') next.status = 'available';
    }
  });
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
      if (nav !== 'settings' && !state.save && ['lobby', 'campaign', 'briefing', 'arsenal', 'crew', 'gameplay'].includes(nav)) { showToast(t('menu.noSave')); return; }
      cleanupGameplay();
      setScreen(nav); render(); return;
    }
    switch (target.dataset.action) {
      case 'go-new-game': cleanupGameplay(); setScreen('commander'); render(); break;
      case 'continue': if (state.save) { cleanupGameplay(); setScreen('lobby'); render(); } break;
      case 'select-nation': {
        const nationId = target.dataset.nation;
        const nationAvatarMap = { de: 'assets/avatars/de/captain_01.png', uk: 'assets/avatars/uk/captain_01.png', us: 'assets/avatars/us/captain_01.png' };
        setDraft({ nationId, avatar: nationAvatarMap[nationId] || state.commanderDraft.avatar }); render(); break;
      }
      case 'select-avatar': setDraft({ avatar: target.dataset.avatar }); render(); break;
      case 'confirm-commander': createCommander(); break;
      case 'select-mission': setMission(target.dataset.mission); render(); break;
      case 'open-briefing': cleanupGameplay(); setScreen('briefing'); render(); break;
      case 'start-mission': cleanupGameplay(); setScreen('gameplay'); render(); break;
      case 'complete-mission': handleCompleteMission(target.dataset.mission); break;
      case 'toggle-crew': handleCrewHire(target.dataset.crew); break;
      case 'set-language': setLanguage(target.dataset.lang); syncPersistentSettings(); applyDocumentLanguage(); render(); break;
      case 'toggle-vibration': setSettings({ vibration: !state.settings.vibration }); commitSave('toast.settingsSaved'); render(); break;
      case 'reset-progress': handleReset(); break;
      case 'unlock-submarine': handleUnlockSubmarine(target.dataset.submarine); break;
      case 'equip-submarine': handleEquipSubmarine(target.dataset.submarine); break;
      case 'buy-upgrade': handleBuyUpgrade(target.dataset.upgrade); break;
      default: break;
    }
  });
  document.addEventListener('input', (event) => {
    if (event.target.id === 'commander-name') { setDraft({ name: event.target.value }); return; }
    if (event.target.dataset.settingRange) { setSettings({ [event.target.dataset.settingRange]: Number(event.target.value) }); syncPersistentSettings(); render(); return; }
  });
  document.addEventListener('change', (event) => {
    if (event.target.dataset.settingSelect) { setSettings({ [event.target.dataset.settingSelect]: event.target.value }); commitSave('toast.settingsSaved'); render(); }
  });
}

function render() {
  cleanupGameplay();
  if (!state.data) { app.innerHTML = renderSplash((key) => key); return; }
  setBackground(state.currentScreen); applyDocumentLanguage(); updateFooter();
  const nationId = getCurrentNationId();
  const nation = getCurrentNation();
  const avatarsByNation = {
    de: ['assets/avatars/de/captain_01.png','assets/avatars/de/officer_01.png','assets/avatars/de/mechanic_01.png','assets/avatars/de/sonar_01.png'],
    uk: ['assets/avatars/uk/captain_01.png','assets/avatars/uk/sailor_01.png'],
    us: ['assets/avatars/us/captain_01.png','assets/avatars/us/sailor_01.png']
  };
  switch (state.currentScreen) {
    case 'splash': app.innerHTML = renderSplash(t); break;
    case 'mainMenu': app.innerHTML = renderMainMenu(t, Boolean(state.save), state.settings.language); break;
    case 'commander': app.innerHTML = renderCommanderScreen(t, state.data.nations, state.commanderDraft, avatarsByNation[nationId]); break;
    case 'lobby': app.innerHTML = renderLobby(t, state.save, nation, getCurrentSubmarine(), getCurrentCrew()); break;
    case 'campaign': app.innerHTML = renderCampaign(t, state.data.missions, getSelectedMission()); break;
    case 'briefing': app.innerHTML = renderBriefing(t, getSelectedMission()); break;
    case 'gameplay': app.innerHTML = renderGameplay(t, getSelectedMission()); mountGameplay({ app, mission: getSelectedMission(), onMissionComplete: handleCompleteMission, t }); break;
    case 'arsenal': app.innerHTML = renderArsenal(t, submarinesByNation(nationId), state.save?.submarine.currentId, state.save?.progression.level || 1, state.save?.progression.credits || 0, state.save?.submarine.upgrades || [], state.data.upgrades); break;
    case 'crew': app.innerHTML = renderCrew(t, crewByNation(nationId), state.save?.crew.hiredIds || [], state.save?.progression.credits || 0); break;
    case 'settings': app.innerHTML = renderSettings(t, state.settings); break;
    default: setScreen('mainMenu'); render(); break;
  }
}

async function boot() {
  try {
    const [data, settings, save] = await Promise.all([loadGameData(), Promise.resolve(loadSettings()), Promise.resolve(loadSave())]);
    setData(data);
    if (settings) setSettings(settings);
    setLanguage(settings?.language || 'pt-BR');
    if (save) setSave(save);
    syncMissionAvailability();
    if (!state.selectedMissionId) setMission(data.missions[0]?.id || null);
    buildFooter.textContent = `${BUILD_INFO.version} • ${BUILD_INFO.date} • ${BUILD_INFO.time}`;
    render();
    setTimeout(() => { if (state.currentScreen === 'splash') { setScreen('mainMenu'); render(); } }, 1200);
  } catch (error) {
    app.innerHTML = `<section class="screen splash-screen"><div class="panel hero-panel center"><strong>Load error</strong><span class="muted">${error.message}</span></div></section>`;
  }
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
initEvents(); render(); boot();
