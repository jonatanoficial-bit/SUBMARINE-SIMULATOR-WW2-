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
import { renderCareer } from './screens/career.js';
import { renderStrategy } from './screens/strategy.js';
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
  career: 'strategy_room_alt',
  strategy: 'strategy_room_alt',
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
function getCampaignForNation(nationId = getCurrentNationId()) {
  return state.data.campaigns?.find((item) => item.nationId === nationId) || null;
}
function missionsForNation(nationId = getCurrentNationId()) {
  const campaign = getCampaignForNation(nationId);
  const source = state.data.missions.filter((mission) => mission.nationId === nationId);
  if (!campaign?.missionIds?.length) return source;
  return campaign.missionIds.map((id) => source.find((mission) => mission.id === id)).filter(Boolean);
}
function getCampaignProgress(nationId = getCurrentNationId()) {
  const missions = missionsForNation(nationId);
  const completed = new Set(state.save?.progression?.completedMissions || []);
  return { total: missions.length, completed: missions.filter((mission) => completed.has(mission.id)).length };
}


function getStrategyForNation(nationId = getCurrentNationId()) {
  const strategyData = state.data?.strategy || {};
  return strategyData.theaters?.find((item) => item.nationId === nationId) || null;
}
function strategySnapshot() {
  const nationId = getCurrentNationId();
  const theater = getStrategyForNation(nationId);
  return state.save?.strategy || {
    theaterId: theater?.id || `${nationId}_theater`, selectedLaneId: theater?.defaultLaneId || null,
    directiveId: 'directive_balanced', intelLevel: theater?.baselineIntel || 50, decryption: 0,
    falseContactRisk: 18, pressure: theater?.baselinePressure || 50, commandPoints: 2,
    ordersIssued: 0, commandHistory: [], intelligenceReports: []
  };
}
function getSelectedLane(nationId = getCurrentNationId()) {
  const snapshot = strategySnapshot();
  const lanes = state.data?.strategy?.convoyLanes?.filter((lane) => lane.nationId === nationId) || [];
  return lanes.find((lane) => lane.id === snapshot.selectedLaneId) || lanes.find((lane) => lane.id === getStrategyForNation(nationId)?.defaultLaneId) || lanes[0] || null;
}
function getSelectedDirective() {
  const snapshot = strategySnapshot();
  return state.data?.strategy?.directives?.find((directive) => directive.id === snapshot.directiveId) || state.data?.strategy?.directives?.[0] || null;
}
function assessStrategicPosture() {
  const snapshot = strategySnapshot();
  const theater = getStrategyForNation();
  const lane = getSelectedLane();
  const directive = getSelectedDirective();
  const intel = Math.max(0, Math.min(100, (snapshot.intelLevel ?? theater?.baselineIntel ?? 50) + (directive?.intelDelta || 0)));
  const risk = Math.max(0, Math.min(100, (lane?.risk ?? theater?.baselineAsw ?? 50) + (directive?.riskDelta || 0) + Math.round((snapshot.falseContactRisk || 0) * 0.2) - Math.round(snapshot.decryption / 12)));
  const pressure = Math.max(0, Math.min(100, snapshot.pressure ?? theater?.baselinePressure ?? 50));
  const opportunity = Math.max(0, Math.min(100, Math.round(((lane?.traffic || theater?.baselineTraffic || 50) * 0.55) + (intel * 0.45) - (risk * 0.18))));
  return { intel, risk, pressure, opportunity, lane, directive };
}
function strategicPatrolModifier() {
  const lane = getSelectedLane();
  const directive = getSelectedDirective();
  const assessment = assessStrategicPosture();
  return {
    fuelMultiplier: Math.max(0.75, Math.min(1.35, (lane?.fuelMultiplier || 1) * (directive?.fuelMultiplier || 1))),
    readinessBonus: Math.round((lane?.readinessBonus || 0) + (directive?.readinessBonus || 0) + Math.max(-4, Math.min(6, (assessment.intel - 55) / 10))),
    tonnageMultiplier: Math.max(0.75, Math.min(1.55, (lane?.tonnageBonus || 1) * (directive?.tonnageMultiplier || 1))),
    risk: assessment.risk,
    opportunity: assessment.opportunity,
    laneId: lane?.id || null,
    directiveId: directive?.id || 'directive_balanced'
  };
}
function pushStrategyHistory(entry) {
  if (!state.save?.strategy) return;
  const stamped = { at: new Date().toISOString(), ...entry };
  state.save.strategy.commandHistory = [stamped, ...(state.save.strategy.commandHistory || [])].slice(0, 20);
}
function pushIntelReport(entry) {
  if (!state.save?.strategy) return;
  const stamped = { at: new Date().toISOString(), ...entry };
  state.save.strategy.intelligenceReports = [stamped, ...(state.save.strategy.intelligenceReports || [])].slice(0, 20);
}
function exportIntelDossier() {
  if (!state.save) return;
  const payload = {
    product: BUILD_INFO.product,
    build: BUILD_INFO.version,
    commander: state.save.commander,
    nation: getCurrentNation(),
    theater: getStrategyForNation(),
    selectedLane: getSelectedLane(),
    directive: getSelectedDirective(),
    strategy: state.save.strategy,
    assessment: assessStrategicPosture(),
    exportedAt: new Date().toISOString()
  };
  downloadTextFile(`SCWW2-intel-${state.save.commander.name.replace(/\s+/g, '-')}.json`, JSON.stringify(payload, null, 2));
  showToast(t('toast.intelDossierExported'));
}

function getLogisticsBase(nationId = getCurrentNationId()) {
  const fallback = { nationId, homePortKey: 'logistics.port.generic', dockNameKey: 'logistics.dock.generic', staffKey: 'logistics.staff.generic', fuelMax: 10000, torpedoMax: 24, deckAmmoMax: 400, rationMax: 60, sparePartsMax: 30 };
  return state.data?.logistics?.bases?.find((item) => item.nationId === nationId) || fallback;
}
function difficultyValue(mission) {
  const map = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  return map[String(mission?.difficulty || 'I').toUpperCase()] || Math.max(1, Number(mission?.difficulty) || 1);
}
function supplySnapshot() {
  return state.save?.logistics || { fuel: 0, torpedoes: 0, deckAmmo: 0, rations: 0, spareParts: 0, morale: 50, fatigue: 50 };
}
function getReadiness(logistics = supplySnapshot(), base = getLogisticsBase()) {
  const supplyScore = Math.min(
    (logistics.fuel || 0) / Math.max(1, base.fuelMax * 0.34),
    (logistics.torpedoes || 0) / Math.max(1, base.torpedoMax * 0.32),
    (logistics.deckAmmo || 0) / Math.max(1, base.deckAmmoMax * 0.32),
    (logistics.rations || 0) / Math.max(1, base.rationMax * 0.32),
    (logistics.spareParts || 0) / Math.max(1, base.sparePartsMax * 0.25),
    1
  ) * 100;
  const moraleScore = Math.max(0, Math.min(100, logistics.morale ?? 70));
  const fatigueScore = Math.max(0, 100 - (logistics.fatigue ?? 25));
  const hullScore = Math.max(0, Math.min(100, state.save?.submarine?.hull ?? 100));
  const overall = Math.round((supplyScore * 0.36) + (moraleScore * 0.22) + (fatigueScore * 0.22) + (hullScore * 0.20));
  return { overall, supplyScore: Math.round(supplyScore), moraleScore, fatigueScore, hullScore, labelKey: overall >= 82 ? 'logistics.readyHigh' : overall >= 58 ? 'logistics.readyMedium' : 'logistics.readyLow' };
}
function currentRankInfo() {
  const ranks = state.data?.logistics?.ranks?.[getCurrentNationId()] || [];
  const career = state.save?.career || { rankIndex: 0 };
  return ranks[Math.min(career.rankIndex || 0, Math.max(0, ranks.length - 1))] || ranks[0] || { key: 'common.rank', reputation: 0 };
}
function calculatePatrolPlan(mission = getSelectedMission(), profileId = 'balanced') {
  const profile = state.data?.logistics?.planningProfiles?.find((item) => item.id === profileId) || state.data?.logistics?.planningProfiles?.[0] || { id: 'balanced', labelKey: 'logistics.plan.balanced', descKey: 'logistics.plan.balanced.desc', fuel: 1, torpedoes: 1, deckAmmo: 1, rations: 1, spareParts: 1, fatigue: 1, morale: 0 };
  const order = Math.max(1, Number(mission?.campaignOrder || 1));
  const diff = difficultyValue(mission);
  const baseCosts = {
    fuel: 920 + order * 155 + diff * 190,
    torpedoes: 3 + Math.ceil(diff * 1.4) + (order > 5 ? 1 : 0),
    deckAmmo: 42 + order * 6 + diff * 10,
    rations: 7 + Math.ceil(order * 1.25) + diff,
    spareParts: 2 + Math.ceil(diff * 1.4)
  };
  const strategic = strategicPatrolModifier();
  const costs = {
    fuel: Math.ceil(baseCosts.fuel * profile.fuel * strategic.fuelMultiplier),
    torpedoes: Math.ceil(baseCosts.torpedoes * profile.torpedoes),
    deckAmmo: Math.ceil(baseCosts.deckAmmo * profile.deckAmmo),
    rations: Math.ceil(baseCosts.rations * profile.rations),
    spareParts: Math.ceil(baseCosts.spareParts * profile.spareParts)
  };
  const logistics = supplySnapshot();
  const canAfford = ['fuel','torpedoes','deckAmmo','rations','spareParts'].every((key) => (logistics[key] || 0) >= costs[key]);
  const projected = { ...logistics };
  Object.entries(costs).forEach(([key, value]) => { projected[key] = Math.max(0, (projected[key] || 0) - value); });
  projected.fatigue = Math.min(100, (projected.fatigue || 0) + Math.ceil((8 + diff * 3 + order) * profile.fatigue));
  projected.morale = Math.max(0, Math.min(100, (projected.morale || 0) + (profile.morale || 0) - (diff > 3 ? 1 : 0)));
  const readiness = Math.max(0, Math.min(100, getReadiness(projected).overall + strategic.readinessBonus));
  return { id: profile.id, labelKey: profile.labelKey, descKey: profile.descKey, costs, canAfford, readiness, fatigueDelta: Math.ceil((8 + diff * 3 + order) * profile.fatigue), moraleDelta: (profile.morale || 0) - (diff > 3 ? 1 : 0), strategic };
}
function previewPatrolPlans() {
  return (state.data?.logistics?.planningProfiles || []).map((profile) => calculatePatrolPlan(getSelectedMission(), profile.id));
}
function maxLogisticsForCurrentNation() { return getLogisticsBase(getCurrentNationId()); }
function applyRankAndMedals() {
  const career = state.save?.career;
  if (!career) return [];
  const ranks = state.data?.logistics?.ranks?.[getCurrentNationId()] || [];
  let rankIndex = career.rankIndex || 0;
  ranks.forEach((rank, index) => { if ((career.reputation || 0) >= rank.reputation) rankIndex = index; });
  career.rankIndex = rankIndex;
  const added = [];
  const medals = state.data?.logistics?.medals || [];
  const readiness = getReadiness().overall;
  medals.forEach((medal) => {
    if (career.medals.includes(medal.id)) return;
    const value = medal.condition === 'readiness' ? readiness : medal.condition === 'bestScore' ? (state.save.progression.bestScore || 0) : (career[medal.condition] || 0);
    if (value >= medal.threshold) { career.medals.push(medal.id); added.push(medal.id); }
  });
  return added;
}
function applyPatrolPlan(profileId = 'balanced', options = {}) {
  if (!state.save) return false;
  const mission = getSelectedMission();
  const plan = calculatePatrolPlan(mission, profileId);
  if (!plan.canAfford) {
    if (!options.silent) { setToast(t('toast.logisticsInsufficient')); showToast(state.toast); }
    return false;
  }
  const logistics = state.save.logistics;
  Object.entries(plan.costs).forEach(([key, value]) => { logistics[key] = Math.max(0, (logistics[key] || 0) - value); });
  logistics.fatigue = Math.min(100, (logistics.fatigue || 0) + plan.fatigueDelta);
  logistics.morale = Math.max(0, Math.min(100, (logistics.morale || 0) + plan.moraleDelta));
  logistics.readiness = plan.readiness;
  logistics.activePlan = { missionId: mission.id, profileId: plan.id, costs: plan.costs, readiness: plan.readiness, strategic: plan.strategic, plannedAt: new Date().toISOString() };
  logistics.sortiePlans = [{ missionId: mission.id, profileId: plan.id, readiness: plan.readiness, costs: plan.costs, strategic: plan.strategic, plannedAt: logistics.activePlan.plannedAt }, ...(logistics.sortiePlans || [])].slice(0, 16);
  commitSave(options.silent ? null : 'toast.patrolPlanned');
  return true;
}
function ensurePatrolReadyForLaunch() {
  if (!state.save) return false;
  const mission = getSelectedMission();
  const activePlan = state.save.logistics?.activePlan;
  if (activePlan?.missionId === mission.id && activePlan.readiness >= 35) return true;
  const planned = applyPatrolPlan('balanced', { silent: true });
  if (!planned) { setToast(t('toast.logisticsBlocked')); showToast(state.toast); setScreen('career'); render(); return false; }
  showToast(t('toast.autoPatrolPlanned'));
  return true;
}
function getSelectedMission() {
  const missions = missionsForNation();
  return missions.find((item) => item.id === state.selectedMissionId) || missions.find((item) => item.status === 'available') || missions[0] || state.data.missions[0];
}
function ensureSelectedMissionForNation(nationId = getCurrentNationId()) {
  const missions = missionsForNation(nationId);
  if (!missions.length) return;
  if (!missions.some((mission) => mission.id === state.selectedMissionId)) {
    setMission((missions.find((mission) => mission.status === 'available') || missions[0]).id);
  }
}


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

function exportCareerLogbook() {
  if (!state.save) return;
  const payload = {
    product: BUILD_INFO.product,
    build: BUILD_INFO.version,
    commander: state.save.commander,
    nation: getCurrentNation(),
    rank: currentRankInfo(),
    career: state.save.career,
    logistics: state.save.logistics,
    strategy: state.save.strategy,
    strategicAssessment: assessStrategicPosture(),
    campaign: getCampaignForNation(),
    exportedAt: new Date().toISOString()
  };
  downloadTextFile(`SCWW2-logbook-${state.save.commander.name.replace(/\s+/g, '-')}.json`, JSON.stringify(payload, null, 2));
  showToast(t('toast.logbookExported'));
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
  setSave(save); saveGame(save); refreshProfileState(); ensureSelectedMissionForNation(nation.id); setScreen('lobby'); showToast(t('toast.commanderCreated')); render();
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
    const campaignMissions = missionsForNation(mission.nationId);
    const idx = campaignMissions.findIndex((item) => item.id === id);
    const next = campaignMissions[idx + 1];
    if (next && next.status === 'locked') next.status = 'available';
  }
  addRewards(totalCredits, totalXp);
  state.save.progression.bestScore = Math.max(state.save.progression.bestScore || 0, report?.score || 0);
  state.save.progression.missionReports = [
    { missionId: id, score: report?.score || 0, bonusCredits, bonusXp, hull: report?.hull ?? null, stealth: report?.stealth ?? null, shots: report?.shots ?? null, completedAt: new Date().toISOString() },
    ...(state.save.progression.missionReports || [])
  ].slice(0, 12);
  const score = report?.score || 0;
  const difficulty = difficultyValue(mission);
  const estimatedTonnage = Math.max(900, Math.round((mission.reward || 0) * 2.8 + difficulty * 1450 + score * 5));
  if (state.save.career) {
    state.save.career.patrols += 1;
    state.save.career.victories += 1;
    state.save.career.tonnage += estimatedTonnage;
    state.save.career.reputation += Math.max(8, Math.round((score / 35) + difficulty * 7 + (mission.campaignOrder || 1)));
    state.save.career.prestige += Math.max(4, Math.round((totalXp / 30) + difficulty * 2));
    state.save.career.convoyDisruption = Math.min(100, (state.save.career.convoyDisruption || 0) + difficulty + 1);
    state.save.career.campaignPressure = Math.max(0, (state.save.career.campaignPressure || 0) - Math.ceil(difficulty / 2));
    state.save.career.serviceRecord = [{
      missionId: id, missionTitle: t(mission.titleKey), score, tonnage: estimatedTonnage,
      reputationGained: Math.max(8, Math.round((score / 35) + difficulty * 7 + (mission.campaignOrder || 1))),
      completedAt: new Date().toISOString(), rankIndex: state.save.career.rankIndex || 0
    }, ...(state.save.career.serviceRecord || [])].slice(0, 24);
  }
  if (state.save.logistics) {
    state.save.logistics.activePlan = null;
    state.save.logistics.morale = Math.max(0, Math.min(100, (state.save.logistics.morale || 0) + (score >= 650 ? 4 : -2)));
    state.save.logistics.fatigue = Math.max(0, Math.min(100, (state.save.logistics.fatigue || 0) - (score >= 700 ? 4 : 0)));
    state.save.logistics.spareParts = Math.max(0, (state.save.logistics.spareParts || 0) - Math.max(1, Math.round((100 - (report?.hull ?? 86)) / 20)));
    state.save.logistics.readiness = getReadiness().overall;
  }
  if (state.save.strategy) {
    const modifier = strategicPatrolModifier();
    const strat = state.save.strategy;
    const intelGain = Math.max(1, Math.round((score || 0) / 240 + difficulty));
    strat.commandPoints = Math.min(99, (strat.commandPoints || 0) + (score >= 650 ? 2 : 1));
    strat.intelLevel = Math.min(100, (strat.intelLevel || 0) + intelGain);
    strat.decryption = Math.min(100, (strat.decryption || 0) + (score >= 700 ? 3 : 1));
    strat.falseContactRisk = Math.max(0, (strat.falseContactRisk || 0) - (score >= 650 ? 2 : 0));
    strat.pressure = Math.max(0, Math.min(100, (strat.pressure || 0) + (modifier.risk >= 78 ? 2 : -1) - (score >= 650 ? 2 : 0)));
    pushStrategyHistory({ type: 'patrol', title: t('strategy.historyPatrol'), detail: t('strategy.historyPatrolDetail', { lane: getSelectedLane()?.id || '--', score }) });
    pushIntelReport({ title: t('strategy.reportAfterAction'), detail: t('strategy.reportAfterActionDetail', { intel: strat.intelLevel, decryption: strat.decryption }) });
  }
  applyRankAndMedals();
  commitSave('toast.missionCompleted');
  setScreen('lobby');
  render();
}

function syncMissionAvailability() {
  state.data?.missions?.forEach((mission) => { mission.status = mission._baseStatus || mission.status; });
  if (!state.data?.missions?.length) return;
  const completed = new Set(state.save?.progression?.completedMissions || []);
  const nationIds = state.data.nations.map((nation) => nation.id);
  nationIds.forEach((nationId) => {
    const missions = missionsForNation(nationId);
    missions.forEach((mission, index) => {
      if (index === 0 || completed.has(mission.id)) mission.status = 'available';
      const previous = missions[index - 1];
      if (previous && completed.has(previous.id)) mission.status = 'available';
    });
  });
  ensureSelectedMissionForNation();
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
  ensureSelectedMissionForNation();
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
      if (nav !== 'settings' && !state.save && ['lobby', 'campaign', 'career', 'strategy', 'briefing', 'arsenal', 'crew', 'gameplay'].includes(nav)) { showToast(t('menu.noSave')); return; }
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
        setDraft({ nationId, avatar: nationAvatarMap[nationId] || state.commanderDraft.avatar }); ensureSelectedMissionForNation(nationId); render(); break;
      }
      case 'select-avatar': setDraft({ avatar: target.dataset.avatar }); render(); break;
      case 'confirm-commander': createCommander(); break;
      case 'select-mission': setMission(target.dataset.mission); render(); break;
      case 'open-briefing': setScreen('briefing'); render(); break;
      case 'start-mission': {
        if (!ensurePatrolReadyForLaunch()) break;
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
      case 'plan-patrol': applyPatrolPlan(target.dataset.plan || 'balanced'); render(); break;
      case 'restock-logistics': {
        if (!state.save) break;
        const base = maxLogisticsForCurrentNation();
        const costs = state.data.logistics.supplyCosts || {};
        const missing = {
          fuel: Math.max(0, base.fuelMax - (state.save.logistics.fuel || 0)),
          torpedoes: Math.max(0, base.torpedoMax - (state.save.logistics.torpedoes || 0)),
          deckAmmo: Math.max(0, base.deckAmmoMax - (state.save.logistics.deckAmmo || 0)),
          rations: Math.max(0, base.rationMax - (state.save.logistics.rations || 0)),
          spareParts: Math.max(0, base.sparePartsMax - (state.save.logistics.spareParts || 0))
        };
        const restockCost = Math.ceil(missing.fuel * (costs.fuel || 1) + missing.torpedoes * (costs.torpedoes || 190) + missing.deckAmmo * (costs.deckAmmo || 4) + missing.rations * (costs.rations || 18) + missing.spareParts * (costs.spareParts || 85));
        if (restockCost <= 0) { showToast(t('toast.logisticsAlreadyFull')); break; }
        if (!spendCredits(restockCost)) { showToast(t('toast.notEnoughCredits')); break; }
        Object.assign(state.save.logistics, { fuel: base.fuelMax, torpedoes: base.torpedoMax, deckAmmo: base.deckAmmoMax, rations: base.rationMax, spareParts: base.sparePartsMax, lastResupplyAt: new Date().toISOString() });
        state.save.logistics.readiness = getReadiness().overall;
        applyRankAndMedals();
        commitSave('toast.logisticsRestocked'); render(); break;
      }
      case 'rest-crew': {
        if (!state.save) break;
        if (!spendCredits(420)) { showToast(t('toast.notEnoughCredits')); break; }
        state.save.logistics.fatigue = Math.max(0, (state.save.logistics.fatigue || 0) - 28);
        state.save.logistics.morale = Math.min(100, (state.save.logistics.morale || 0) + 9);
        state.save.logistics.dockDays = (state.save.logistics.dockDays || 0) + 2;
        state.save.logistics.readiness = getReadiness().overall;
        commitSave('toast.crewRested'); render(); break;
      }
      case 'dock-maintenance': {
        if (!state.save) break;
        const hullMissing = Math.max(0, 100 - (state.save.submarine.hull || 100));
        const partNeed = Math.max(2, Math.ceil(hullMissing / 12));
        const dockCost = Math.max(380, Math.ceil(hullMissing * 12));
        if ((state.save.logistics.spareParts || 0) < partNeed) { showToast(t('toast.sparePartsLow')); break; }
        if (!spendCredits(dockCost)) { showToast(t('toast.notEnoughCredits')); break; }
        state.save.logistics.spareParts = Math.max(0, (state.save.logistics.spareParts || 0) - partNeed);
        state.save.logistics.dockDays = (state.save.logistics.dockDays || 0) + 1;
        state.save.submarine.hull = 100;
        state.save.submarine.systems = { engines: 100, sonar: 100, periscope: 100, weapons: 100 };
        state.save.logistics.readiness = getReadiness().overall;
        commitSave('toast.dockComplete'); render(); break;
      }
      case 'select-convoy-lane': {
        if (!state.save?.strategy) break;
        const lane = state.data.strategy.convoyLanes.find((item) => item.id === target.dataset.lane && item.nationId === getCurrentNationId());
        if (!lane) break;
        state.save.strategy.selectedLaneId = lane.id;
        pushStrategyHistory({ type: 'lane', title: t('strategy.historyLane'), detail: t('strategy.historyLaneDetail', { lane: t(lane.nameKey) }) });
        commitSave('toast.convoyLaneSelected'); render(); break;
      }
      case 'set-directive': {
        if (!state.save?.strategy) break;
        const directive = state.data.strategy.directives.find((item) => item.id === target.dataset.directive);
        if (!directive) break;
        if (state.save.strategy.directiveId !== directive.id) {
          if ((state.save.strategy.commandPoints || 0) < (directive.commandCost || 0)) { showToast(t('toast.commandPointsLow')); break; }
          if (!spendCredits(directive.cost || 0)) { showToast(t('toast.notEnoughCredits')); break; }
          state.save.strategy.commandPoints = Math.max(0, (state.save.strategy.commandPoints || 0) - (directive.commandCost || 0));
          state.save.strategy.ordersIssued = (state.save.strategy.ordersIssued || 0) + 1;
          state.save.strategy.directiveId = directive.id;
          state.save.strategy.intelLevel = Math.max(0, Math.min(100, (state.save.strategy.intelLevel || 0) + (directive.intelDelta || 0)));
          state.save.strategy.falseContactRisk = Math.max(0, Math.min(100, (state.save.strategy.falseContactRisk || 0) + Math.max(0, directive.riskDelta || 0) - Math.max(0, -(directive.riskDelta || 0))));
          pushStrategyHistory({ type: 'directive', title: t('strategy.historyDirective'), detail: t('strategy.historyDirectiveDetail', { directive: t(directive.nameKey) }) });
        }
        commitSave('toast.directiveIssued'); render(); break;
      }
      case 'invest-intelligence': {
        if (!state.save?.strategy) break;
        const network = state.data.strategy.intelNetworks.find((item) => item.nationId === getCurrentNationId());
        if (!network) break;
        if (!spendCredits(network.cost || 0)) { showToast(t('toast.notEnoughCredits')); break; }
        state.save.strategy.intelLevel = Math.min(100, (state.save.strategy.intelLevel || 0) + (network.intelGain || 0));
        state.save.strategy.decryption = Math.min(100, (state.save.strategy.decryption || 0) + (network.decryptionGain || 0));
        state.save.strategy.pressure = Math.max(0, (state.save.strategy.pressure || 0) - (network.pressureRelief || 0));
        state.save.strategy.falseContactRisk = Math.max(0, (state.save.strategy.falseContactRisk || 0) - 3);
        pushIntelReport({ title: t('strategy.reportNetwork'), detail: t('strategy.reportNetworkDetail', { intel: state.save.strategy.intelLevel, decryption: state.save.strategy.decryption }) });
        commitSave('toast.intelInvested'); render(); break;
      }
      case 'run-decryption': {
        if (!state.save?.strategy) break;
        if ((state.save.strategy.commandPoints || 0) < 1) { showToast(t('toast.commandPointsLow')); break; }
        state.save.strategy.commandPoints = Math.max(0, (state.save.strategy.commandPoints || 0) - 1);
        state.save.strategy.ordersIssued = (state.save.strategy.ordersIssued || 0) + 1;
        state.save.strategy.decryption = Math.min(100, (state.save.strategy.decryption || 0) + 12);
        state.save.strategy.falseContactRisk = Math.max(0, (state.save.strategy.falseContactRisk || 0) - 5);
        pushIntelReport({ title: t('strategy.reportDecryption'), detail: t('strategy.reportDecryptionDetail', { decryption: state.save.strategy.decryption }) });
        commitSave('toast.decryptionRun'); render(); break;
      }
      case 'export-intel-dossier': exportIntelDossier(); break;
      case 'export-logbook': exportCareerLogbook(); break;
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
    campaign: getCampaignForNation(),
    campaignProgress: getCampaignProgress(),
    logisticsBase: getLogisticsBase(nationId),
    logisticsData: state.data.logistics,
    careerRank: currentRankInfo(),
    readiness: getReadiness(),
    previewPlans: previewPatrolPlans(),
    strategyData: state.data.strategy,
    strategyTheater: getStrategyForNation(nationId),
    selectedLane: getSelectedLane(nationId),
    selectedDirective: getSelectedDirective(),
    strategicAssessment: assessStrategicPosture(),
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
  .register('campaign', { render: ({ t: translate, nation }) => renderCampaign(translate, missionsForNation(), getSelectedMission(), getCampaignForNation(), nation, getCampaignProgress()) })
  .register('career', { render: ({ t: translate, nation, campaign, mission, logisticsBase, logisticsData, careerRank, readiness, previewPlans }) => renderCareer(translate, state.save, nation, campaign, mission, logisticsBase, logisticsData, careerRank, readiness, previewPlans) })
  .register('strategy', { render: ({ t: translate, nation, strategyData, strategyTheater, selectedLane, selectedDirective, strategicAssessment }) => renderStrategy(translate, state.save, nation, strategyData, strategyTheater, selectedLane, selectedDirective, strategicAssessment) })
  .register('briefing', { render: ({ t: translate, mission, readiness }) => renderBriefing(translate, mission, state.operationAutosave, getCampaignForNation(mission?.nationId), state.save?.logistics?.activePlan || null, readiness) })
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
    if (!state.selectedMissionId) ensureSelectedMissionForNation();
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
