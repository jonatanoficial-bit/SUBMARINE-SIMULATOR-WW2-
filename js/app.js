import { BUILD_INFO } from './build.js';
import {
  state, setActiveProfileId, setData, setDraft, setLanguage, setMission, setOperationAutosave,
  setProfiles, setResumeOperation, setSave, setScreen, setSettings, setToast
} from './state.js';
import { loadGameData } from './dataLoader.js';
import {
  clearOperationAutosave, clearProfile, clearSave, createInitialSave, exportProfile, getActiveProfileId,
  getSaveDiagnostics, importProfile, listProfiles, loadOperationAutosave, loadSave, loadSettings,
  restoreLatestBackup, saveGame, saveOperationAutosave, saveSettings, selectProfile
} from './save.js';
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
import { renderProfiles } from './screens/profiles.js';
import { renderBriefing } from './screens/briefing.js';
import { renderGameplay, mountGameplay, cleanupGameplay } from './screens/gameplay.js';
import { SceneManager } from './engine/scenes/SceneManager.js';
import { initSafety, reportRuntimeError, requestFullscreenSafe, requestImmersiveMode, vibrateSafe } from './safety.js';
import { normalizeCommanderName } from './utils/sanitize.js';
import { initAudio, setAudioLevels, playSfx } from './audio.js';

const app = document.getElementById('app');
const buildFooter = document.getElementById('build-footer');
const toastEl = document.getElementById('toast');
document.body.classList.add('alpha-build');
let toastTimer = null;
let lastRenderedScreen = null;
let pendingImportSlotId = null;
const sceneManager = new SceneManager();

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
  settings: 'submarine_control_room',
  profiles: 'strategy_room_alt'
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
function syncPersistentSettings() { saveSettings(state.settings); setAudioLevels(state.settings); }
function refreshProfileState({ reloadSave = false } = {}) {
  const profiles = listProfiles();
  const activeProfileId = getActiveProfileId();
  setProfiles(profiles);
  setActiveProfileId(activeProfileId);
  if (reloadSave) setSave(loadSave({ slotId: activeProfileId }));
  setOperationAutosave(loadOperationAutosave(activeProfileId));
  return profiles;
}
function activeProfile() { return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0] || null; }
function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function commitSave(messageKey) {
  if (state.save) {
    state.save.meta.updatedAt = new Date().toISOString();
    saveGame(state.save);
    refreshProfileState();
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
  const commanderName = normalizeCommanderName(draft.name);
  if (!commanderName) { showToast(t('setup.validation')); return; }
  const commander = { name: commanderName, nationId: nation.id, avatar: draft.avatar, createdBuild: BUILD_INFO.version };
  const save = createInitialSave({ commander, starterSubmarineId: nation.starterSubmarineId, credits: nation.starterCredits });
  setSave(save); saveGame(save); refreshProfileState(); setScreen('lobby'); showToast(t('toast.commanderCreated')); render();
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

function handleRepairSubmarine() {
  if (!state.save) return;
  const hull = state.save.submarine.hull ?? 100;
  const missingHull = Math.max(0, 100 - hull);
  const damagedSystems = Object.values(state.save.submarine.systems || {}).some((value) => value < 100);
  if (missingHull <= 0 && !damagedSystems) { showToast(t('toast.noRepairsNeeded')); return; }
  const cost = Math.max(250, Math.ceil(missingHull * 18) + (damagedSystems ? 400 : 0));
  if (!spendCredits(cost)) { showToast(t('toast.notEnoughCredits')); return; }
  state.save.submarine.hull = 100;
  state.save.submarine.systems = { engines: 100, sonar: 100, periscope: 100, weapons: 100 };
  commitSave('toast.submarineRepaired');
  render();
}

function handleHullUpdate(hull, systems) {
  if (!state.save) return;
  state.save.submarine.hull = Math.max(0, Math.min(100, Math.round(hull)));
  if (systems) state.save.submarine.systems = { ...(state.save.submarine.systems || {}), ...systems };
  commitSave();
}

function handleCompleteMission(id, report = null) {
  clearOperationAutosave(state.activeProfileId);
  setOperationAutosave(null);
  setResumeOperation(false);
  const mission = state.data.missions.find((item) => item.id === id);
  if (!mission) return;
  const alreadyCompleted = state.save.progression.completedMissions.includes(id);
  const bonusCredits = report?.bonusCredits || 0;
  const bonusXp = report?.bonusXp || 0;
  const totalCredits = mission.reward + bonusCredits;
  const totalXp = mission.xp + bonusXp;
  if (!alreadyCompleted) {
    state.save.progression.completedMissions.push(id);
    const idx = state.data.missions.findIndex((item) => item.id === id);
    const next = state.data.missions[idx + 1];
    if (next && next.status === 'locked') next.status = 'available';
  }
  addRewards(totalCredits, totalXp);
  state.save.progression.bestScore = Math.max(state.save.progression.bestScore || 0, report?.score || 0);
  state.save.progression.missionReports = [
    { missionId: id, score: report?.score || 0, bonusCredits, bonusXp, hull: report?.hull ?? null, stealth: report?.stealth ?? null, shots: report?.shots ?? null, completedAt: new Date().toISOString() },
    ...(state.save.progression.missionReports || [])
  ].slice(0, 12);
  commitSave('toast.missionCompleted');
  setScreen('lobby');
  render();
}

function syncMissionAvailability() {
  state.data?.missions?.forEach((mission) => { mission.status = mission._baseStatus || mission.status; });
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
  clearOperationAutosave(state.activeProfileId);
  setSave(null); setOperationAutosave(null); setResumeOperation(false);
  refreshProfileState();
  syncMissionAvailability();
  setScreen('mainMenu');
  showToast(t('toast.resetDone'));
  render();
}

function activateProfile(slotId, destination = 'lobby') {
  const save = selectProfile(slotId);
  setActiveProfileId(slotId);
  setSave(save);
  setOperationAutosave(loadOperationAutosave(slotId));
  setResumeOperation(false);
  refreshProfileState();
  syncMissionAvailability();
  setScreen(save ? destination : 'commander');
  showToast(t(save ? 'toast.profileActivated' : 'toast.profileReady'));
  render();
}

function createProfile(slotId) {
  const profile = state.profiles.find((item) => item.id === slotId);
  if (profile?.occupied && !confirm(t('profiles.overwriteConfirm'))) return;
  selectProfile(slotId); clearProfile(slotId);
  setActiveProfileId(slotId); setSave(null); setOperationAutosave(null); setResumeOperation(false);
  setDraft({ name: '', nationId: 'de', avatar: 'assets/avatars/de/captain_01.png' });
  refreshProfileState(); setScreen('commander'); render();
}

function deleteProfile(slotId) {
  if (!confirm(t('profiles.deleteConfirm'))) return;
  clearProfile(slotId);
  if (slotId === state.activeProfileId) { setSave(null); setOperationAutosave(null); setResumeOperation(false); }
  refreshProfileState(); syncMissionAvailability(); render(); showToast(t('toast.profileDeleted'));
}

function restoreProfile(slotId) {
  const restored = restoreLatestBackup(slotId);
  if (!restored) { showToast(t('toast.noBackup')); return; }
  selectProfile(slotId); setActiveProfileId(slotId); setSave(restored); setOperationAutosave(loadOperationAutosave(slotId));
  refreshProfileState(); syncMissionAvailability(); render(); showToast(t('toast.backupRestored'));
}

async function resumeOperation() {
  const operation = state.operationAutosave;
  if (!state.save || !operation?.missionId) { showToast(t('toast.noOperation')); return; }
  const mission = state.data.missions.find((item) => item.id === operation.missionId);
  if (!mission) { clearOperationAutosave(state.activeProfileId); setOperationAutosave(null); showToast(t('toast.noOperation')); return; }
  setMission(operation.missionId); setResumeOperation(true);
  await requestImmersiveMode({ preferLandscape: true });
  setScreen('gameplay'); render();
}

function initEvents() {
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-nav], [data-action]');
    if (!target) return;
    playSfx('tap');
    const nav = target.dataset.nav;
    if (nav) {
      if (nav !== 'settings' && !state.save && ['lobby', 'campaign', 'briefing', 'arsenal', 'crew', 'gameplay'].includes(nav)) { showToast(t('menu.noSave')); return; }
      setScreen(nav); render(); return;
    }
    switch (target.dataset.action) {
      case 'go-new-game': {
        const current = activeProfile();
        if (current?.occupied) setScreen('profiles'); else setScreen('commander');
        render(); break;
      }
      case 'continue': if (state.save) { setResumeOperation(false); setScreen('lobby'); render(); } break;
      case 'activate-profile': activateProfile(target.dataset.profile); break;
      case 'new-profile': createProfile(target.dataset.profile); break;
      case 'delete-profile': deleteProfile(target.dataset.profile); break;
      case 'restore-profile': restoreProfile(target.dataset.profile); break;
      case 'export-profile': {
        try {
          const slotId = target.dataset.profile;
          const archive = exportProfile(slotId);
          downloadTextFile(`SCWW2-${slotId}-${new Date().toISOString().slice(0, 10)}.scww2save.json`, archive);
          showToast(t('toast.profileExported'));
        } catch { showToast(t('toast.exportFailed')); }
        break;
      }
      case 'import-profile': {
        pendingImportSlotId = target.dataset.profile;
        document.querySelector('#profile-import-input')?.click();
        break;
      }
      case 'resume-operation': await resumeOperation(); break;
      case 'discard-operation':
        clearOperationAutosave(state.activeProfileId); setOperationAutosave(null); setResumeOperation(false); render(); showToast(t('toast.operationDiscarded')); break;
      case 'select-nation': {
        const nationId = target.dataset.nation;
        const nationAvatarMap = { de: 'assets/avatars/de/captain_01.png', uk: 'assets/avatars/uk/captain_01.png', us: 'assets/avatars/us/captain_01.png' };
        setDraft({ nationId, avatar: nationAvatarMap[nationId] || state.commanderDraft.avatar }); render(); break;
      }
      case 'select-avatar': setDraft({ avatar: target.dataset.avatar }); render(); break;
      case 'confirm-commander': createCommander(); break;
      case 'select-mission': setMission(target.dataset.mission); render(); break;
      case 'open-briefing': setScreen('briefing'); render(); break;
      case 'start-mission': {
        clearOperationAutosave(state.activeProfileId); setOperationAutosave(null); setResumeOperation(false);
        await requestImmersiveMode({ preferLandscape: true });
        setScreen('gameplay'); render(); break;
      }
      case 'complete-mission': handleCompleteMission(target.dataset.mission); break;
      case 'toggle-crew': handleCrewHire(target.dataset.crew); break;
      case 'set-language': setLanguage(target.dataset.lang); syncPersistentSettings(); applyDocumentLanguage(); render(); break;
      case 'toggle-vibration': setSettings({ vibration: !state.settings.vibration }); commitSave('toast.settingsSaved'); render(); break;
      case 'toggle-tutorials': setSettings({ tutorials: !state.settings.tutorials }); commitSave('toast.settingsSaved'); render(); break;
      case 'toggle-contextual-help': setSettings({ contextualHelp: !state.settings.contextualHelp }); commitSave('toast.settingsSaved'); render(); break;
      case 'reset-progress': handleReset(); break;
      case 'request-fullscreen': {
        const opened = await requestFullscreenSafe();
        vibrateSafe(12, state.settings.vibration);
        showToast(t(opened ? 'toast.fullscreenSuccess' : 'toast.fullscreenUnavailable'));
        break;
      }
      case 'unlock-submarine': handleUnlockSubmarine(target.dataset.submarine); break;
      case 'equip-submarine': handleEquipSubmarine(target.dataset.submarine); break;
      case 'buy-upgrade': handleBuyUpgrade(target.dataset.upgrade); break;
      case 'repair-submarine': handleRepairSubmarine(); break;
      default: break;
    }
  });
  document.addEventListener('input', (event) => {
    if (event.target.id === 'commander-name') { setDraft({ name: event.target.value }); return; }
    if (event.target.dataset.settingRange) { setSettings({ [event.target.dataset.settingRange]: Number(event.target.value) }); syncPersistentSettings(); render(); return; }
  });
  document.addEventListener('change', async (event) => {
    if (event.target.dataset.settingSelect) { setSettings({ [event.target.dataset.settingSelect]: event.target.value }); commitSave('toast.settingsSaved'); render(); return; }
    if (event.target.id === 'profile-import-input' && event.target.files?.[0] && pendingImportSlotId) {
      const slotId = pendingImportSlotId; pendingImportSlotId = null;
      try {
        const text = await event.target.files[0].text();
        const imported = importProfile(text, slotId);
        selectProfile(slotId); setActiveProfileId(slotId); setSave(imported); setOperationAutosave(null); setResumeOperation(false);
        refreshProfileState(); syncMissionAvailability(); setScreen('lobby'); render(); showToast(t('toast.profileImported'));
      } catch (error) { console.warn('[Import]', error); showToast(t('toast.importFailed')); }
      event.target.value = '';
    }
  });
}

function createSceneContext() {
  const nationId = getCurrentNationId();
  return {
    app,
    t,
    state,
    nationId,
    nation: getCurrentNation(),
    submarine: getCurrentSubmarine(),
    crew: getCurrentCrew(),
    mission: getSelectedMission(),
    submarines: submarinesByNation(nationId),
    nationCrew: crewByNation(nationId),
    avatarsByNation: {
      de: ['assets/avatars/de/captain_01.png','assets/avatars/de/officer_01.png','assets/avatars/de/mechanic_01.png','assets/avatars/de/sonar_01.png'],
      uk: ['assets/avatars/uk/captain_01.png','assets/avatars/uk/sailor_01.png'],
      us: ['assets/avatars/us/captain_01.png','assets/avatars/us/sailor_01.png']
    },
  };
}

sceneManager
  .register('splash', { render: ({ t: translate }) => renderSplash(translate) })
  .register('mainMenu', { render: ({ t: translate }) => renderMainMenu(translate, Boolean(state.save), state.settings.language, activeProfile(), Boolean(state.operationAutosave)) })
  .register('commander', { render: ({ t: translate, nationId, avatarsByNation }) => renderCommanderScreen(translate, state.data.nations, state.commanderDraft, avatarsByNation[nationId]) })
  .register('lobby', { render: ({ t: translate, nation, submarine, crew }) => renderLobby(translate, state.save, nation, submarine, crew) })
  .register('campaign', { render: ({ t: translate, mission }) => renderCampaign(translate, state.data.missions, mission) })
  .register('briefing', { render: ({ t: translate, mission }) => renderBriefing(translate, mission, state.operationAutosave) })
  .register('gameplay', {
    render: ({ t: translate, mission }) => renderGameplay(translate, mission, state.settings),
    enter: ({ app: root, mission, submarine, t: translate }) => mountGameplay({
      app: root,
      mission,
      submarine,
      initialHull: state.save?.submarine?.hull ?? 100,
      initialSystems: state.save?.submarine?.systems || {},
      initialSnapshot: state.resumeOperation && state.operationAutosave?.missionId === mission?.id ? state.operationAutosave.snapshot : null,
      difficulty: state.settings.difficulty,
      tutorialEnabled: state.settings.tutorials,
      contextualHelp: state.settings.contextualHelp,
      onHullUpdate: handleHullUpdate,
      onMissionComplete: handleCompleteMission,
      onOperationAutosave: (snapshot) => {
        const operation = { missionId: snapshot.missionId, snapshot, saveRevision: state.save?.meta?.revision || 0 };
        if (saveOperationAutosave(operation, state.activeProfileId)) setOperationAutosave({ ...operation, savedAt: new Date().toISOString() });
      },
      onOperationCleared: () => { clearOperationAutosave(state.activeProfileId); setOperationAutosave(null); setResumeOperation(false); },
      t: translate,
    }),
    exit: cleanupGameplay,
  })
  .register('arsenal', { render: ({ t: translate, nationId, submarines }) => renderArsenal(translate, submarines, state.save?.submarine.currentId, state.save?.progression.level || 1, state.save?.progression.credits || 0, state.save?.submarine.upgrades || [], state.data.upgrades, state.save?.submarine || null) })
  .register('crew', { render: ({ t: translate, nationCrew }) => renderCrew(translate, nationCrew, state.save?.crew.hiredIds || [], state.save?.progression.credits || 0) })
  .register('settings', { render: ({ t: translate }) => renderSettings(translate, state.settings) })
  .register('profiles', { render: ({ t: translate }) => renderProfiles(translate, state.profiles, state.language, state.operationAutosave) });

function renderUnsafe() {
  if (!state.data) {
    sceneManager.exitActive();
    app.innerHTML = renderSplash((key) => key);
    return;
  }
  setBackground(state.currentScreen);
  applyDocumentLanguage();
  updateFooter();
  if (!sceneManager.has(state.currentScreen)) setScreen('mainMenu');
  const context = createSceneContext();
  app.innerHTML = sceneManager.render(state.currentScreen, context);
  sceneManager.enterActive(context);
  document.body.dataset.screen = state.currentScreen;
  if (lastRenderedScreen !== state.currentScreen) {
    const nextScreen = state.currentScreen;
    lastRenderedScreen = nextScreen;
    requestAnimationFrame(() => {
      if (state.currentScreen === nextScreen) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
  }
}

function renderFatalError(error) {
  sceneManager.exitActive();
  reportRuntimeError(error, { stage: 'render', screen: state.currentScreen });
  app.replaceChildren();
  const section = document.createElement('section');
  section.className = 'screen splash-screen';
  const panel = document.createElement('div');
  panel.className = 'panel hero-panel center stack';
  const title = document.createElement('strong');
  title.textContent = 'Safe mode';
  const message = document.createElement('span');
  message.className = 'muted';
  message.textContent = `${BUILD_INFO.version} • ${error?.message || 'Unexpected rendering error'}`;
  const button = document.createElement('button');
  button.className = 'button';
  button.type = 'button';
  button.textContent = 'Reload';
  button.addEventListener('click', () => window.location.reload());
  panel.append(title, message, button);
  section.append(panel);
  app.append(section);
}

function render() {
  try { renderUnsafe(); } catch (error) { renderFatalError(error); }
}

async function boot() {
  try {
    const [data, settings] = await Promise.all([loadGameData(), Promise.resolve(loadSettings())]);
    setData(data);
    if (settings) setSettings(settings);
    initAudio(state.settings);
    setLanguage(settings?.language || 'pt-BR');
    refreshProfileState();
    const save = loadSave({ slotId: state.activeProfileId });
    if (save) setSave(save);
    setOperationAutosave(loadOperationAutosave(state.activeProfileId));
    const saveDiagnostics = getSaveDiagnostics();
    if (saveDiagnostics.recovered) setTimeout(() => showToast(t('toast.saveRecovered')), 1400);
    else if (saveDiagnostics.transactionRecovered) setTimeout(() => showToast(t('toast.transactionRecovered')), 1400);
    else if (saveDiagnostics.migrated) setTimeout(() => showToast(t('toast.legacyMigrated')), 1400);
    syncMissionAvailability();
    if (!state.selectedMissionId) setMission(data.missions[0]?.id || null);
    buildFooter.textContent = `${BUILD_INFO.version} • ${BUILD_INFO.date} • ${BUILD_INFO.time}`;
    render();
    setTimeout(() => { if (state.currentScreen === 'splash') { setScreen('mainMenu'); render(); } }, 1200);
  } catch (error) {
    reportRuntimeError(error, { stage: 'boot' });
    renderFatalError(error);
  }
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
initSafety();
initEvents(); render(); boot();
