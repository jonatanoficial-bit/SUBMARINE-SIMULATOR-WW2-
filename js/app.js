import { BUILD_INFO } from './build.js';
import {
  state, setActiveProfileId, setCampaignNation, setData, setDraft, setLanguage, setMission, setOperationAutosave,
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
import { renderBridge, mountBridge, cleanupBridge } from './screens/bridge.js';
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
import { applyDoctrineToPatrolCost, findDoctrineForNation, normalizeDoctrineModifiers, resolveDoctrineStage, summarizeDoctrineImpact } from './systems/campaignDoctrine.js';
import { buildCampaignObjectiveDeck, findCampaignObjectivesForNation, getNewlyCompletedObjectiveRewards } from './systems/campaignObjectives.js';
import { buildCampaignConsequenceDeck, findCampaignConsequenceForNation } from './systems/campaignConsequences.js';
import { canApplyHighCommandOrder, findHighCommandDeckForNation, getHighCommandAppliedIds, summarizeHighCommandOrders } from './systems/highCommandOrders.js';
import { canAcknowledgeCampaignEvent, findCampaignEventDeckForNation, getCampaignEventAcknowledgedIds, summarizeCampaignEvents } from './systems/campaignEvents.js';
import { canLaunchSpecialOperation, findSpecialOperationDeckForNation, getSpecialOperationLaunchedIds, summarizeSpecialOperations } from './systems/specialOperations.js';
import { canExecuteOperationChainStep, findOperationChainDeckForNation, getOperationChainCompletedStepIds, summarizeOperationChains } from './systems/operationChains.js';
import { canChooseOperationOutcome, findOperationOutcomeDeckForNation, getOperationOutcomeChosenIds, summarizeOperationOutcomes } from './systems/operationOutcomes.js';
import { canAwardOperationalHonor, findOperationalHonorDeckForNation, getOperationalHonorAwardedIds, summarizeOperationalHonors } from './systems/operationalHonors.js';
import { canClaimCommandPromotion, findCommandAdvancementDeckForNation, getCommandAdvancementClaimedIds, summarizeCommandAdvancement } from './systems/commandAdvancement.js';
import { canAssignVeteranOfficer, findVeteranOfficerDeckForNation, getVeteranOfficerAssignedIds, summarizeVeteranOfficers } from './systems/veteranOfficers.js';
import { canRunCrewDrill, findCrewDrillDeckForNation, getCrewDrillCompletedIds, summarizeCrewDrills } from './systems/crewDrills.js';
import { buildSandboxMission } from './systems/sandboxPatrolPlanner.js';
import { applyUpgradeStats, buildWorkshopImpactReport, calculateUpgradeBonus } from './systems/baseWorkshopIntegration.js';
import { buildCrewProgressionImpact, applyCrewImpactToMissionReport } from './systems/captainCrewProgressionImpact.js';
import { buildCareerRetentionDeck, applyRetentionAccuracyModifiers, calculateMissionMoraleOutcome, evaluateCareerGate } from './systems/captainCareerRetention.js';

const app = document.getElementById('app');
const buildFooter = document.getElementById('build-footer');
const toastEl = document.getElementById('toast');
document.body.classList.add('production-build');
let toastTimer = null;
let lastRenderedScreen = null;
let pendingImportSlotId = null;
const sceneManager = new SceneManager();

function shouldAutoFullscreenMobile() {
  return window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768;
}

async function enterMobileGameplayMode() {
  if (shouldAutoFullscreenMobile()) await requestImmersiveMode({ preferLandscape: true });
}

const SCREEN_BACKGROUNDS = {
  splash: 'naval_battle',
  mainMenu: 'naval_base_lobby',
  commander: 'briefing_room',
  lobby: 'naval_base_lobby',
  campaign: 'strategy_room_alt',
  career: 'strategy_room_alt',
  strategy: 'strategy_room_alt',
  bridge: 'submarine_control_room',
  briefing: 'briefing_room',
  gameplay: 'submarine_control_room',
  arsenal: 'arsenal_workshop',
  crew: 'briefing_room',
  settings: 'submarine_control_room',
  profiles: 'strategy_room_alt'
};

const BACKGROUND_MODE = {
  gameplay: 'none',
  bridge: 'local'
};

const LOCAL_ASSET_SCREENS = new Set(['bridge', 'gameplay']);

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
function getDoctrineForNation(nationId = getCurrentNationId()) {
  return findDoctrineForNation(state.data?.campaignDoctrines || [], nationId);
}
function getDoctrineStageForNation(nationId = getCurrentNationId()) {
  return resolveDoctrineStage(getDoctrineForNation(nationId), getCampaignForNation(nationId), state.save?.progression?.completedMissions || []);
}
function getDoctrineImpactForNation(nationId = getCurrentNationId()) {
  return summarizeDoctrineImpact(getDoctrineForNation(nationId));
}
function getCampaignObjectivesForNation(nationId = getCurrentNationId()) {
  return findCampaignObjectivesForNation(state.data?.campaignObjectives || [], nationId);
}
function getCampaignObjectiveDeckForNation(nationId = getCurrentNationId()) {
  return buildCampaignObjectiveDeck(
    getCampaignObjectivesForNation(nationId),
    state.save?.progression?.completedMissions || [],
    state.save?.progression?.campaignObjectiveRewards || []
  );
}
function getCampaignConsequenceForNation(nationId = getCurrentNationId()) {
  return findCampaignConsequenceForNation(state.data?.campaignConsequences || [], nationId);
}
function getCampaignConsequenceDeckForNation(nationId = getCurrentNationId()) {
  return buildCampaignConsequenceDeck({
    consequence: getCampaignConsequenceForNation(nationId),
    campaign: getCampaignForNation(nationId),
    objectiveSet: getCampaignObjectivesForNation(nationId),
    completedMissionIds: state.save?.progression?.completedMissions || [],
    claimedRewardIds: state.save?.progression?.campaignObjectiveRewards || [],
  });
}
function getCampaignConsequenceEffect(nationId = getCurrentNationId()) {
  return getCampaignConsequenceDeckForNation(nationId)?.effect || { riskDelta: 0, intelBonus: 0, readinessBonus: 0, tonnageMultiplier: 1 };
}
function getHighCommandDeckForNation(nationId = getCurrentNationId()) {
  return findHighCommandDeckForNation(state.data?.highCommandOrders || [], nationId);
}
function getHighCommandSummaryForNation(nationId = getCurrentNationId()) {
  return summarizeHighCommandOrders({
    deck: getHighCommandDeckForNation(nationId),
    campaign: getCampaignForNation(nationId),
    completedMissionIds: state.save?.progression?.completedMissions || [],
    appliedOrderIds: getHighCommandAppliedIds(state.save || {}),
  });
}
function getHighCommandEffect(nationId = getCurrentNationId()) {
  return getHighCommandSummaryForNation(nationId)?.combinedEffect || { riskDelta: 0, intelBonus: 0, readinessBonus: 0, pressureRelief: 0, decryptionBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 };
}
function getCampaignEventDeckForNation(nationId = getCurrentNationId()) {
  return findCampaignEventDeckForNation(state.data?.campaignEvents || [], nationId);
}
function getCampaignEventSummaryForNation(nationId = getCurrentNationId()) {
  const snapshot = strategySnapshot();
  return summarizeCampaignEvents({
    deck: getCampaignEventDeckForNation(nationId),
    campaign: getCampaignForNation(nationId),
    completedMissionIds: state.save?.progression?.completedMissions || [],
    strategySnapshot: snapshot,
    activeOrderIds: getHighCommandAppliedIds(state.save || {}),
    acknowledgedIds: getCampaignEventAcknowledgedIds(state.save || {}),
  });
}
function getCampaignEventEffect(nationId = getCurrentNationId()) {
  return getCampaignEventSummaryForNation(nationId)?.combinedEffect || { riskDelta: 0, intelBonus: 0, decryptionBonus: 0, pressureDelta: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleDelta: 0, fatigueDelta: 0 };
}
function getSpecialOperationDeckForNation(nationId = getCurrentNationId()) {
  return findSpecialOperationDeckForNation(state.data?.specialOperations || [], nationId);
}
function getSpecialOperationSummaryForNation(nationId = getCurrentNationId()) {
  const eventSummary = getCampaignEventSummaryForNation(nationId);
  return summarizeSpecialOperations({
    deck: getSpecialOperationDeckForNation(nationId),
    campaign: getCampaignForNation(nationId),
    completedMissionIds: state.save?.progression?.completedMissions || [],
    launchedIds: getSpecialOperationLaunchedIds(state.save || {}),
    activeEventIds: (eventSummary?.activeEvents || []).map((item) => item.id),
    activeOrderIds: getHighCommandAppliedIds(state.save || {}),
    strategySnapshot: strategySnapshot(),
  });
}
function getSpecialOperationEffect(nationId = getCurrentNationId()) {
  return getSpecialOperationSummaryForNation(nationId)?.combinedEffect || { riskDelta: 0, intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 };
}

function getOperationChainDeckForNation(nationId = getCurrentNationId()) {
  return findOperationChainDeckForNation(state.data?.operationChains || [], nationId);
}
function getOperationChainSummaryForNation(nationId = getCurrentNationId()) {
  const eventSummary = getCampaignEventSummaryForNation(nationId);
  return summarizeOperationChains({
    deck: getOperationChainDeckForNation(nationId),
    campaign: getCampaignForNation(nationId),
    completedMissionIds: state.save?.progression?.completedMissions || [],
    completedStepIds: getOperationChainCompletedStepIds(state.save || {}),
    launchedOperationIds: getSpecialOperationLaunchedIds(state.save || {}),
    activeEventIds: (eventSummary?.activeEvents || []).map((item) => item.id),
    strategySnapshot: strategySnapshot(),
  });
}
function getOperationChainEffect(nationId = getCurrentNationId()) {
  return getOperationChainSummaryForNation(nationId)?.combinedEffect || { riskDelta: 0, intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 };
}

function getOperationOutcomeDeckForNation(nationId = getCurrentNationId()) {
  return findOperationOutcomeDeckForNation(state.data?.operationOutcomes || [], nationId);
}
function getOperationOutcomeSummaryForNation(nationId = getCurrentNationId()) {
  const chainSummary = getOperationChainSummaryForNation(nationId);
  return summarizeOperationOutcomes({
    deck: getOperationOutcomeDeckForNation(nationId),
    campaign: getCampaignForNation(nationId),
    completedMissionIds: state.save?.progression?.completedMissions || [],
    chosenIds: getOperationOutcomeChosenIds(state.save || {}),
    operationChainSummary: chainSummary,
    completedStepIds: getOperationChainCompletedStepIds(state.save || {}),
  });
}
function getOperationOutcomeEffect(nationId = getCurrentNationId()) {
  return getOperationOutcomeSummaryForNation(nationId)?.combinedEffect || { riskDelta: 0, intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 };
}

function getOperationalHonorDeckForNation(nationId = getCurrentNationId()) {
  return findOperationalHonorDeckForNation(state.data?.operationalHonors || [], nationId);
}
function getOperationalHonorSummaryForNation(nationId = getCurrentNationId()) {
  return summarizeOperationalHonors({
    deck: getOperationalHonorDeckForNation(nationId),
    campaign: getCampaignForNation(nationId),
    completedMissionIds: state.save?.progression?.completedMissions || [],
    awardedIds: getOperationalHonorAwardedIds(state.save || {}),
    career: state.save?.career || {},
    strategySnapshot: strategySnapshot(),
    launchedOperationIds: getSpecialOperationLaunchedIds(state.save || {}),
    completedStepIds: getOperationChainCompletedStepIds(state.save || {}),
    chosenOutcomeIds: getOperationOutcomeChosenIds(state.save || {}),
  });
}
function getOperationalHonorEffect(nationId = getCurrentNationId()) {
  return getOperationalHonorSummaryForNation(nationId)?.combinedEffect || { riskDelta: 0, intelBonus: 0, pressureRelief: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 };
}

function getCommandAdvancementDeckForNation(nationId = getCurrentNationId()) {
  return findCommandAdvancementDeckForNation(state.data?.commandAdvancement || [], nationId);
}
function getCommandAdvancementSummaryForNation(nationId = getCurrentNationId()) {
  return summarizeCommandAdvancement({
    deck: getCommandAdvancementDeckForNation(nationId),
    campaign: getCampaignForNation(nationId),
    completedMissionIds: state.save?.progression?.completedMissions || [],
    claimedIds: getCommandAdvancementClaimedIds(state.save || {}),
    career: state.save?.career || {},
    strategySnapshot: strategySnapshot(),
    awardedHonorIds: getOperationalHonorAwardedIds(state.save || {}),
    completedStepIds: getOperationChainCompletedStepIds(state.save || {}),
    chosenOutcomeIds: getOperationOutcomeChosenIds(state.save || {}),
  });
}
function getCommandAdvancementEffect(nationId = getCurrentNationId()) {
  return getCommandAdvancementSummaryForNation(nationId)?.combinedEffect || { riskDelta: 0, intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0 };
}


function getVeteranOfficerDeckForNation(nationId = getCurrentNationId()) {
  return findVeteranOfficerDeckForNation(state.data?.veteranOfficers || [], nationId);
}
function getVeteranOfficerSummaryForNation(nationId = getCurrentNationId()) {
  return summarizeVeteranOfficers({
    deck: getVeteranOfficerDeckForNation(nationId),
    campaign: getCampaignForNation(nationId),
    completedMissionIds: state.save?.progression?.completedMissions || [],
    assignedIds: getVeteranOfficerAssignedIds(state.save || {}),
    career: state.save?.career || {},
    awardedHonorIds: getOperationalHonorAwardedIds(state.save || {}),
    claimedPromotionIds: getCommandAdvancementClaimedIds(state.save || {}),
  });
}
function getVeteranOfficerEffect(nationId = getCurrentNationId()) {
  return getVeteranOfficerSummaryForNation(nationId)?.combinedEffect || { riskDelta: 0, intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0, sonarBonus: 0, engineeringBonus: 0, torpedoBonus: 0, stealthBonus: 0 };
}


function getCrewDrillDeckForNation(nationId = getCurrentNationId()) {
  return findCrewDrillDeckForNation(state.data?.crewDrills || [], nationId);
}
function getCrewDrillSummaryForNation(nationId = getCurrentNationId()) {
  return summarizeCrewDrills({
    deck: getCrewDrillDeckForNation(nationId),
    campaign: getCampaignForNation(nationId),
    completedMissionIds: state.save?.progression?.completedMissions || [],
    completedIds: getCrewDrillCompletedIds(state.save || {}),
    assignedOfficerIds: getVeteranOfficerAssignedIds(state.save || {}),
    readiness: getReadiness(),
  });
}
function getCrewDrillEffect(nationId = getCurrentNationId()) {
  return getCrewDrillSummaryForNation(nationId)?.combinedEffect || { riskDelta: 0, intelBonus: 0, decryptionBonus: 0, pressureRelief: 0, readinessBonus: 0, tonnageMultiplier: 1, moraleBonus: 0, fatigueDelta: 0, sonarBonus: 0, engineeringBonus: 0, torpedoBonus: 0, stealthBonus: 0 };
}

function getCrewProgressionImpact(nationId = getCurrentNationId()) {
  const allCrew = (state.data?.crew || []).filter((crew) => crew.nation === nationId);
  const baseImpact = buildCrewProgressionImpact({
    allCrew,
    hiredIds: state.save?.crew?.hiredIds || [],
    save: state.save || {},
    crewDrillSummary: getCrewDrillSummaryForNation(nationId),
    veteranOfficerSummary: getVeteranOfficerSummaryForNation(nationId),
  });
  const retention = buildCareerRetentionDeck({
    allCrew: state.data?.crew || [],
    submarines: submarinesByNation(nationId),
    save: state.save || {},
    nationId,
    crewImpact: baseImpact,
  });
  return applyRetentionAccuracyModifiers(baseImpact, retention);
}

function getCareerRetentionDeck(nationId = getCurrentNationId()) {
  const baseImpact = buildCrewProgressionImpact({
    allCrew: (state.data?.crew || []).filter((crew) => crew.nation === nationId),
    hiredIds: state.save?.crew?.hiredIds || [],
    save: state.save || {},
    crewDrillSummary: getCrewDrillSummaryForNation(nationId),
    veteranOfficerSummary: getVeteranOfficerSummaryForNation(nationId),
  });
  return buildCareerRetentionDeck({
    allCrew: state.data?.crew || [],
    submarines: submarinesByNation(nationId),
    save: state.save || {},
    nationId,
    crewImpact: baseImpact,
  });
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

function getCampaignViewNationId() {
  const fallback = getCurrentNationId();
  const requested = state.selectedCampaignNationId || fallback;
  return nationById(requested)?.id || fallback;
}
function getCampaignProgressByNation() {
  return Object.fromEntries((state.data?.nations || []).map((nation) => [nation.id, getCampaignProgress(nation.id)]));
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
  const consequenceEffect = getCampaignConsequenceEffect();
  const highCommandEffect = getHighCommandEffect();
  const campaignEventEffect = getCampaignEventEffect();
  const specialOperationEffect = getSpecialOperationEffect();
  const operationChainEffect = getOperationChainEffect();
  const operationOutcomeEffect = getOperationOutcomeEffect();
  const operationalHonorEffect = getOperationalHonorEffect();
  const commandAdvancementEffect = getCommandAdvancementEffect();
  const veteranOfficerEffect = getVeteranOfficerEffect();
  const crewDrillEffect = getCrewDrillEffect();
  const combinedTonnageMultiplier = (consequenceEffect.tonnageMultiplier || 1) * (highCommandEffect.tonnageMultiplier || 1) * (campaignEventEffect.tonnageMultiplier || 1) * (specialOperationEffect.tonnageMultiplier || 1) * (operationChainEffect.tonnageMultiplier || 1) * (operationOutcomeEffect.tonnageMultiplier || 1) * (operationalHonorEffect.tonnageMultiplier || 1) * (commandAdvancementEffect.tonnageMultiplier || 1) * (veteranOfficerEffect.tonnageMultiplier || 1) * (crewDrillEffect.tonnageMultiplier || 1);
  const intel = Math.max(0, Math.min(100, (snapshot.intelLevel ?? theater?.baselineIntel ?? 50) + (directive?.intelDelta || 0) + consequenceEffect.intelBonus + highCommandEffect.intelBonus + campaignEventEffect.intelBonus + specialOperationEffect.intelBonus + operationChainEffect.intelBonus + operationOutcomeEffect.intelBonus + operationalHonorEffect.intelBonus + commandAdvancementEffect.intelBonus + veteranOfficerEffect.intelBonus + crewDrillEffect.intelBonus));
  const decryptionBonus = (highCommandEffect.decryptionBonus || 0) + (campaignEventEffect.decryptionBonus || 0) + (specialOperationEffect.decryptionBonus || 0) + (operationChainEffect.decryptionBonus || 0) + (operationOutcomeEffect.decryptionBonus || 0) + (commandAdvancementEffect.decryptionBonus || 0) + (veteranOfficerEffect.decryptionBonus || 0) + (crewDrillEffect.decryptionBonus || 0);
  const risk = Math.max(0, Math.min(100, (lane?.risk ?? theater?.baselineAsw ?? 50) + (directive?.riskDelta || 0) + consequenceEffect.riskDelta + highCommandEffect.riskDelta + campaignEventEffect.riskDelta + specialOperationEffect.riskDelta + operationChainEffect.riskDelta + operationOutcomeEffect.riskDelta + operationalHonorEffect.riskDelta + commandAdvancementEffect.riskDelta + veteranOfficerEffect.riskDelta + crewDrillEffect.riskDelta + Math.round((snapshot.falseContactRisk || 0) * 0.2) - Math.round((snapshot.decryption + decryptionBonus) / 12)));
  const pressure = Math.max(0, Math.min(100, (snapshot.pressure ?? theater?.baselinePressure ?? 50) + Math.round((consequenceEffect.riskDelta + highCommandEffect.riskDelta + campaignEventEffect.riskDelta + specialOperationEffect.riskDelta + operationChainEffect.riskDelta + operationOutcomeEffect.riskDelta + operationalHonorEffect.riskDelta + commandAdvancementEffect.riskDelta + veteranOfficerEffect.riskDelta + crewDrillEffect.riskDelta) * 0.45) - Math.round((consequenceEffect.intelBonus + highCommandEffect.intelBonus + campaignEventEffect.intelBonus + specialOperationEffect.intelBonus + operationChainEffect.intelBonus + operationOutcomeEffect.intelBonus + operationalHonorEffect.intelBonus + commandAdvancementEffect.intelBonus + veteranOfficerEffect.intelBonus + crewDrillEffect.intelBonus) * 0.35) - Math.round(highCommandEffect.pressureRelief || 0) - Math.round(specialOperationEffect.pressureRelief || 0) - Math.round(operationChainEffect.pressureRelief || 0) - Math.round(operationOutcomeEffect.pressureRelief || 0) - Math.round(operationalHonorEffect.pressureRelief || 0) - Math.round(commandAdvancementEffect.pressureRelief || 0) - Math.round(veteranOfficerEffect.pressureRelief || 0) - Math.round(crewDrillEffect.pressureRelief || 0) + Math.round(campaignEventEffect.pressureDelta || 0)));
  const opportunity = Math.max(0, Math.min(100, Math.round(((lane?.traffic || theater?.baselineTraffic || 50) * 0.55 * combinedTonnageMultiplier) + (intel * 0.45) - (risk * 0.18))));
  return { intel, risk, pressure, opportunity, lane, directive, consequenceEffect, highCommandEffect, campaignEventEffect, specialOperationEffect, operationChainEffect, operationOutcomeEffect, operationalHonorEffect, commandAdvancementEffect, veteranOfficerEffect, crewDrillEffect };
}
function strategicPatrolModifier() {
  const lane = getSelectedLane();
  const directive = getSelectedDirective();
  const assessment = assessStrategicPosture();
  return {
    fuelMultiplier: Math.max(0.75, Math.min(1.35, (lane?.fuelMultiplier || 1) * (directive?.fuelMultiplier || 1))),
    readinessBonus: Math.round((lane?.readinessBonus || 0) + (directive?.readinessBonus || 0) + (assessment.consequenceEffect?.readinessBonus || 0) + (assessment.highCommandEffect?.readinessBonus || 0) + (assessment.campaignEventEffect?.readinessBonus || 0) + (assessment.specialOperationEffect?.readinessBonus || 0) + (assessment.operationChainEffect?.readinessBonus || 0) + (assessment.operationOutcomeEffect?.readinessBonus || 0) + (assessment.operationalHonorEffect?.readinessBonus || 0) + (assessment.commandAdvancementEffect?.readinessBonus || 0) + (assessment.veteranOfficerEffect?.readinessBonus || 0) + (assessment.crewDrillEffect?.readinessBonus || 0) + Math.max(-4, Math.min(6, (assessment.intel - 55) / 10))),
    tonnageMultiplier: Math.max(0.75, Math.min(1.75, (lane?.tonnageBonus || 1) * (directive?.tonnageMultiplier || 1) * (assessment.consequenceEffect?.tonnageMultiplier || 1) * (assessment.highCommandEffect?.tonnageMultiplier || 1) * (assessment.campaignEventEffect?.tonnageMultiplier || 1) * (assessment.specialOperationEffect?.tonnageMultiplier || 1) * (assessment.operationChainEffect?.tonnageMultiplier || 1) * (assessment.operationOutcomeEffect?.tonnageMultiplier || 1) * (assessment.operationalHonorEffect?.tonnageMultiplier || 1) * (assessment.commandAdvancementEffect?.tonnageMultiplier || 1) * (assessment.veteranOfficerEffect?.tonnageMultiplier || 1) * (assessment.crewDrillEffect?.tonnageMultiplier || 1))),
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
    campaignConsequences: getCampaignConsequenceDeckForNation(),
    highCommandOrders: getHighCommandSummaryForNation(),
    campaignEvents: getCampaignEventSummaryForNation(),
    specialOperations: getSpecialOperationSummaryForNation(),
    operationChains: getOperationChainSummaryForNation(),
    operationOutcomes: getOperationOutcomeSummaryForNation(),
    operationalHonors: getOperationalHonorSummaryForNation(),
    commandAdvancement: getCommandAdvancementSummaryForNation(),
    veteranOfficers: getVeteranOfficerSummaryForNation(),
    crewDrills: getCrewDrillSummaryForNation(),
    assessment: assessStrategicPosture(),
    exportedAt: new Date().toISOString()
  };
  downloadTextFile(`SCWW2-intel-${state.save.commander.name.replace(/\s+/g, '-')}.json`, JSON.stringify(payload, null, 2));
  showToast(t('toast.intelDossierExported'));
}

function applyHighCommandOrder(orderId) {
  if (!state.save?.strategy) return;
  const nationId = getCurrentNationId();
  const deck = getHighCommandDeckForNation(nationId);
  const order = deck?.orders?.find((item) => item.id === orderId);
  if (!order) return;
  const progress = getCampaignProgress(nationId);
  const verdict = canApplyHighCommandOrder({ save: state.save, order, completedMissions: progress.completed });
  if (!verdict.ok) { showToast(t(verdict.reason, { count: Math.max(0, Number(order.requires?.completedMissions || 0)) })); return; }
  const cost = order.cost || {};
  if (!spendCredits(cost.credits || 0)) { showToast(t('toast.notEnoughCredits')); return; }
  state.save.strategy.commandPoints = Math.max(0, (state.save.strategy.commandPoints || 0) - (cost.commandPoints || 0));
  state.save.strategy.ordersIssued = (state.save.strategy.ordersIssued || 0) + 1;
  const effect = order.effect || {};
  state.save.strategy.intelLevel = Math.max(0, Math.min(100, (state.save.strategy.intelLevel || 0) + (effect.intelBonus || 0)));
  state.save.strategy.decryption = Math.max(0, Math.min(100, (state.save.strategy.decryption || 0) + (effect.decryptionBonus || 0)));
  state.save.strategy.pressure = Math.max(0, Math.min(100, (state.save.strategy.pressure || 0) - (effect.pressureRelief || 0)));
  state.save.strategy.falseContactRisk = Math.max(0, Math.min(100, (state.save.strategy.falseContactRisk || 0) + (effect.riskDelta || 0)));
  if (state.save.logistics) {
    state.save.logistics.morale = Math.max(0, Math.min(100, (state.save.logistics.morale || 0) + (effect.moraleBonus || 0)));
    state.save.logistics.fatigue = Math.max(0, Math.min(100, (state.save.logistics.fatigue || 0) + (effect.fatigueDelta || 0)));
    state.save.logistics.readiness = getReadiness().overall;
  }
  state.save.strategy.highCommandOrders = state.save.strategy.highCommandOrders && typeof state.save.strategy.highCommandOrders === 'object'
    ? state.save.strategy.highCommandOrders
    : { appliedIds: [], history: [] };
  const applied = new Set(state.save.strategy.highCommandOrders.appliedIds || []);
  applied.add(order.id);
  state.save.strategy.highCommandOrders.appliedIds = [...applied];
  const record = { at: new Date().toISOString(), id: order.id, title: t(order.nameKey), detail: t(order.descKey), effect };
  state.save.strategy.highCommandOrders.history = [record, ...(state.save.strategy.highCommandOrders.history || [])].slice(0, 20);
  pushStrategyHistory({ type: 'high-command', title: t('highCommand.historyTitle'), detail: t('highCommand.historyDetail', { order: t(order.nameKey) }) });
  pushIntelReport({ title: t('highCommand.reportTitle'), detail: t('highCommand.reportDetail', { order: t(order.nameKey) }) });
  commitSave('toast.highCommandApplied');
  render();
}

function acknowledgeCampaignEvent(eventId) {
  if (!state.save?.strategy) return;
  const summary = getCampaignEventSummaryForNation(getCurrentNationId());
  const event = summary?.events?.find((item) => item.id === eventId);
  const verdict = canAcknowledgeCampaignEvent({ save: state.save, event });
  if (!verdict.ok) { showToast(t(verdict.reason)); return; }
  state.save.strategy.campaignEvents = state.save.strategy.campaignEvents && typeof state.save.strategy.campaignEvents === 'object'
    ? state.save.strategy.campaignEvents
    : { acknowledgedIds: [], currentIds: [], history: [] };
  const acknowledged = new Set(state.save.strategy.campaignEvents.acknowledgedIds || []);
  acknowledged.add(event.id);
  state.save.strategy.campaignEvents.acknowledgedIds = [...acknowledged];
  state.save.strategy.campaignEvents.currentIds = (summary.activeEvents || []).map((item) => item.id);
  const record = { at: new Date().toISOString(), id: event.id, title: t(event.nameKey), detail: t(event.descKey), severity: event.severity, effect: event.effect };
  state.save.strategy.campaignEvents.history = [record, ...(state.save.strategy.campaignEvents.history || [])].slice(0, 24);
  pushStrategyHistory({ type: 'campaign-event', title: t('campaignEvents.historyTitle'), detail: t('campaignEvents.historyDetail', { event: t(event.nameKey) }) });
  pushIntelReport({ title: t('campaignEvents.reportTitle'), detail: t('campaignEvents.reportDetail', { event: t(event.nameKey) }) });
  commitSave('toast.campaignEventAcknowledged');
  render();
}
function launchSpecialOperation(operationId) {
  if (!state.save?.strategy) return;
  const nationId = getCurrentNationId();
  const summary = getSpecialOperationSummaryForNation(nationId);
  const operation = summary?.operations?.find((item) => item.id === operationId);
  const eventSummary = getCampaignEventSummaryForNation(nationId);
  const progress = getCampaignProgress(nationId);
  const verdict = canLaunchSpecialOperation({
    save: state.save,
    operation,
    completedMissions: progress.completed,
    activeEventIds: (eventSummary?.activeEvents || []).map((item) => item.id),
    activeOrderIds: getHighCommandAppliedIds(state.save || {}),
    strategySnapshot: strategySnapshot(),
  });
  if (!verdict.ok) { showToast(t(verdict.reason, { count: operation?.requiredMissions || operation?.requires?.completedMissions || 0 })); return; }
  const cost = operation.cost || {};
  if (!spendCredits(cost.credits || 0)) { showToast(t('toast.notEnoughCredits')); return; }
  state.save.strategy.commandPoints = Math.max(0, (state.save.strategy.commandPoints || 0) - (cost.commandPoints || 0));
  state.save.strategy.ordersIssued = (state.save.strategy.ordersIssued || 0) + 1;
  const effect = operation.effect || {};
  state.save.strategy.intelLevel = Math.max(0, Math.min(100, (state.save.strategy.intelLevel || 0) + (effect.intelBonus || 0)));
  state.save.strategy.decryption = Math.max(0, Math.min(100, (state.save.strategy.decryption || 0) + (effect.decryptionBonus || 0)));
  state.save.strategy.pressure = Math.max(0, Math.min(100, (state.save.strategy.pressure || 0) - (effect.pressureRelief || 0)));
  state.save.strategy.falseContactRisk = Math.max(0, Math.min(100, (state.save.strategy.falseContactRisk || 0) + (effect.riskDelta || 0)));
  if (state.save.logistics) {
    state.save.logistics.morale = Math.max(0, Math.min(100, (state.save.logistics.morale || 0) + (effect.moraleBonus || 0)));
    state.save.logistics.fatigue = Math.max(0, Math.min(100, (state.save.logistics.fatigue || 0) + (effect.fatigueDelta || 0)));
    state.save.logistics.readiness = getReadiness().overall;
  }
  state.save.strategy.specialOperations = state.save.strategy.specialOperations && typeof state.save.strategy.specialOperations === 'object'
    ? state.save.strategy.specialOperations
    : { launchedIds: [], availableIds: [], history: [] };
  const launched = new Set(state.save.strategy.specialOperations.launchedIds || []);
  launched.add(operation.id);
  state.save.strategy.specialOperations.launchedIds = [...launched];
  state.save.strategy.specialOperations.availableIds = (summary.operations || []).filter((item) => item.unlocked && !item.launched).map((item) => item.id);
  const record = { at: new Date().toISOString(), id: operation.id, title: t(operation.nameKey), detail: t(operation.descKey), severity: operation.severity, effect };
  state.save.strategy.specialOperations.history = [record, ...(state.save.strategy.specialOperations.history || [])].slice(0, 24);
  pushStrategyHistory({ type: 'special-operation', title: t('specialOps.historyTitle'), detail: t('specialOps.historyDetail', { operation: t(operation.nameKey) }) });
  pushIntelReport({ title: t('specialOps.reportTitle'), detail: t('specialOps.reportDetail', { operation: t(operation.nameKey) }) });
  commitSave('toast.specialOperationLaunched');
  render();
}


function executeOperationChainStep(stepId) {
  if (!state.save?.strategy) return;
  const nationId = getCurrentNationId();
  const summary = getOperationChainSummaryForNation(nationId);
  const step = summary?.steps?.find((item) => item.id === stepId);
  const eventSummary = getCampaignEventSummaryForNation(nationId);
  const progress = getCampaignProgress(nationId);
  const completedStepIds = getOperationChainCompletedStepIds(state.save || {});
  const verdict = canExecuteOperationChainStep({
    save: state.save,
    step,
    completedMissions: progress.completed,
    completedStepIds,
    launchedOperationIds: getSpecialOperationLaunchedIds(state.save || {}),
    activeEventIds: (eventSummary?.activeEvents || []).map((item) => item.id),
    strategySnapshot: strategySnapshot(),
  });
  if (!verdict.ok) { showToast(t(verdict.reason, { count: step?.requiredMissions || step?.requires?.completedMissions || 0 })); return; }
  const cost = step.cost || {};
  if (!spendCredits(cost.credits || 0)) { showToast(t('toast.notEnoughCredits')); return; }
  state.save.strategy.commandPoints = Math.max(0, (state.save.strategy.commandPoints || 0) - (cost.commandPoints || 0));
  state.save.strategy.ordersIssued = (state.save.strategy.ordersIssued || 0) + 1;
  const effect = step.effect || {};
  state.save.strategy.intelLevel = Math.max(0, Math.min(100, (state.save.strategy.intelLevel || 0) + (effect.intelBonus || 0)));
  state.save.strategy.decryption = Math.max(0, Math.min(100, (state.save.strategy.decryption || 0) + (effect.decryptionBonus || 0)));
  state.save.strategy.pressure = Math.max(0, Math.min(100, (state.save.strategy.pressure || 0) - (effect.pressureRelief || 0)));
  state.save.strategy.falseContactRisk = Math.max(0, Math.min(100, (state.save.strategy.falseContactRisk || 0) + (effect.riskDelta || 0)));
  if (state.save.logistics) {
    state.save.logistics.morale = Math.max(0, Math.min(100, (state.save.logistics.morale || 0) + (effect.moraleBonus || 0)));
    state.save.logistics.fatigue = Math.max(0, Math.min(100, (state.save.logistics.fatigue || 0) + (effect.fatigueDelta || 0)));
    state.save.logistics.readiness = getReadiness().overall;
  }
  state.save.strategy.operationChains = state.save.strategy.operationChains && typeof state.save.strategy.operationChains === 'object'
    ? state.save.strategy.operationChains
    : { completedStepIds: [], availableStepIds: [], history: [] };
  const completed = new Set(state.save.strategy.operationChains.completedStepIds || []);
  completed.add(step.id);
  state.save.strategy.operationChains.completedStepIds = [...completed];
  state.save.strategy.operationChains.availableStepIds = (summary.steps || []).filter((item) => item.unlocked && !item.completed).map((item) => item.id);
  const record = { at: new Date().toISOString(), id: step.id, title: t(step.nameKey), detail: t(step.descKey), tone: step.tone, effect };
  state.save.strategy.operationChains.history = [record, ...(state.save.strategy.operationChains.history || [])].slice(0, 24);
  pushStrategyHistory({ type: 'operation-chain', title: t('operationChains.historyTitle'), detail: t('operationChains.historyDetail', { step: t(step.nameKey) }) });
  pushIntelReport({ title: t('operationChains.reportTitle'), detail: t('operationChains.reportDetail', { step: t(step.nameKey) }) });
  commitSave('toast.operationChainStepCompleted');
  render();
}


function chooseOperationOutcome(outcomeId) {
  if (!state.save?.strategy) return;
  const nationId = getCurrentNationId();
  const summary = getOperationOutcomeSummaryForNation(nationId);
  const outcome = summary?.outcomes?.find((item) => item.id === outcomeId);
  const verdict = canChooseOperationOutcome({ save: state.save, outcome, summary });
  if (!verdict.ok) { showToast(t(verdict.reason, { count: summary?.lockCount || outcome?.lockCount || 0 })); return; }
  const cost = outcome.cost || {};
  if (!spendCredits(cost.credits || 0)) { showToast(t('toast.notEnoughCredits')); return; }
  state.save.strategy.commandPoints = Math.max(0, (state.save.strategy.commandPoints || 0) - (cost.commandPoints || 0));
  state.save.strategy.ordersIssued = (state.save.strategy.ordersIssued || 0) + 1;
  const effect = outcome.effect || {};
  state.save.strategy.intelLevel = Math.max(0, Math.min(100, (state.save.strategy.intelLevel || 0) + (effect.intelBonus || 0)));
  state.save.strategy.decryption = Math.max(0, Math.min(100, (state.save.strategy.decryption || 0) + (effect.decryptionBonus || 0)));
  state.save.strategy.pressure = Math.max(0, Math.min(100, (state.save.strategy.pressure || 0) - (effect.pressureRelief || 0)));
  state.save.strategy.falseContactRisk = Math.max(0, Math.min(100, (state.save.strategy.falseContactRisk || 0) + (effect.riskDelta || 0)));
  if (state.save.logistics) {
    state.save.logistics.morale = Math.max(0, Math.min(100, (state.save.logistics.morale || 0) + (effect.moraleBonus || 0)));
    state.save.logistics.fatigue = Math.max(0, Math.min(100, (state.save.logistics.fatigue || 0) + (effect.fatigueDelta || 0)));
    state.save.logistics.readiness = getReadiness().overall;
  }
  state.save.strategy.operationOutcomes = state.save.strategy.operationOutcomes && typeof state.save.strategy.operationOutcomes === 'object'
    ? state.save.strategy.operationOutcomes
    : { chosenIds: [], availableIds: [], history: [] };
  const chosen = new Set(state.save.strategy.operationOutcomes.chosenIds || []);
  chosen.add(outcome.id);
  state.save.strategy.operationOutcomes.chosenIds = [...chosen];
  state.save.strategy.operationOutcomes.availableIds = [];
  const record = { at: new Date().toISOString(), id: outcome.id, title: t(outcome.nameKey), detail: t(outcome.descKey), tone: outcome.tone, effect };
  state.save.strategy.operationOutcomes.history = [record, ...(state.save.strategy.operationOutcomes.history || [])].slice(0, 24);
  pushStrategyHistory({ type: 'operation-outcome', title: t('operationOutcomes.historyTitle'), detail: t('operationOutcomes.historyDetail', { outcome: t(outcome.nameKey) }) });
  pushIntelReport({ title: t('operationOutcomes.reportTitle'), detail: t('operationOutcomes.reportDetail', { outcome: t(outcome.nameKey) }) });
  commitSave('toast.operationOutcomeChosen');
  render();
}


function awardOperationalHonor(honorId) {
  if (!state.save?.career) return;
  const nationId = getCurrentNationId();
  const summary = getOperationalHonorSummaryForNation(nationId);
  const honor = summary?.honors?.find((item) => item.id === honorId);
  const verdict = canAwardOperationalHonor({ save: state.save, honor, summary });
  if (!verdict.ok) { showToast(t(verdict.reason, { count: honor?.lockCount || 0 })); return; }
  const reward = honor.reward || {};
  state.save.progression.credits = Math.max(0, (state.save.progression.credits || 0) + (reward.credits || 0));
  state.save.progression.xp = Math.max(0, (state.save.progression.xp || 0) + (reward.xp || 0));
  state.save.strategy.commandPoints = Math.max(0, Math.min(99, (state.save.strategy.commandPoints || 0) + (reward.commandPoints || 0)));
  state.save.career.reputation = Math.max(0, (state.save.career.reputation || 0) + (reward.reputation || 0));
  state.save.career.prestige = Math.max(0, (state.save.career.prestige || 0) + (reward.prestige || 0));
  state.save.strategy.intelLevel = Math.max(0, Math.min(100, (state.save.strategy.intelLevel || 0) + (reward.intelBonus || 0)));
  state.save.strategy.pressure = Math.max(0, Math.min(100, (state.save.strategy.pressure || 0) - (reward.pressureRelief || 0)));
  state.save.strategy.falseContactRisk = Math.max(0, Math.min(100, (state.save.strategy.falseContactRisk || 0) + (reward.riskDelta || 0)));
  if (state.save.logistics) {
    state.save.logistics.morale = Math.max(0, Math.min(100, (state.save.logistics.morale || 0) + (reward.moraleBonus || 0)));
    state.save.logistics.fatigue = Math.max(0, Math.min(100, (state.save.logistics.fatigue || 0) + (reward.fatigueDelta || 0)));
    state.save.logistics.readiness = getReadiness().overall;
  }
  state.save.career.operationalHonors = state.save.career.operationalHonors && typeof state.save.career.operationalHonors === 'object'
    ? state.save.career.operationalHonors
    : { awardedIds: [], availableIds: [], history: [] };
  const awarded = new Set(state.save.career.operationalHonors.awardedIds || []);
  awarded.add(honor.id);
  state.save.career.operationalHonors.awardedIds = [...awarded];
  state.save.career.operationalHonors.availableIds = (summary.honors || []).filter((item) => item.unlocked && !item.awarded && item.id !== honor.id).map((item) => item.id);
  state.save.career.medals = [...new Set([...(state.save.career.medals || []), `honor:${honor.id}`])];
  const record = { at: new Date().toISOString(), id: honor.id, title: t(honor.nameKey), detail: t(honor.descKey), tier: honor.tier, reward };
  state.save.career.operationalHonors.history = [record, ...(state.save.career.operationalHonors.history || [])].slice(0, 30);
  pushStrategyHistory({ type: 'operational-honor', title: t('operationalHonors.historyTitle'), detail: t('operationalHonors.historyDetail', { honor: t(honor.nameKey) }) });
  pushIntelReport({ title: t('operationalHonors.reportTitle'), detail: t('operationalHonors.reportDetail', { honor: t(honor.nameKey) }) });
  applyRankAndMedals();
  commitSave('toast.operationalHonorAwarded');
  render();
}


function claimCommandPromotion(rankId) {
  if (!state.save?.career) return;
  applyRankAndMedals();
  const nationId = getCurrentNationId();
  const summary = getCommandAdvancementSummaryForNation(nationId);
  const rank = summary?.ranks?.find((item) => item.id === rankId);
  const verdict = canClaimCommandPromotion({ save: state.save, rank, summary });
  if (!verdict.ok) { showToast(t(verdict.reason, { count: rank?.lockCount || 0 })); return; }
  const reward = rank.reward || {};
  const effect = rank.effect || {};
  state.save.progression.credits = Math.max(0, (state.save.progression.credits || 0) + (reward.credits || 0));
  state.save.progression.xp = Math.max(0, (state.save.progression.xp || 0) + (reward.xp || 0));
  state.save.strategy.commandPoints = Math.max(0, Math.min(99, (state.save.strategy.commandPoints || 0) + (reward.commandPoints || 0)));
  state.save.career.prestige = Math.max(0, (state.save.career.prestige || 0) + (reward.prestige || 0));
  state.save.strategy.intelLevel = Math.max(0, Math.min(100, (state.save.strategy.intelLevel || 0) + (effect.intelBonus || 0)));
  state.save.strategy.decryption = Math.max(0, Math.min(100, (state.save.strategy.decryption || 0) + (effect.decryptionBonus || 0)));
  state.save.strategy.pressure = Math.max(0, Math.min(100, (state.save.strategy.pressure || 0) - (effect.pressureRelief || 0)));
  state.save.strategy.falseContactRisk = Math.max(0, Math.min(100, (state.save.strategy.falseContactRisk || 0) + (effect.riskDelta || 0)));
  if (state.save.logistics) {
    state.save.logistics.morale = Math.max(0, Math.min(100, (state.save.logistics.morale || 0) + (effect.moraleBonus || 0)));
    state.save.logistics.fatigue = Math.max(0, Math.min(100, (state.save.logistics.fatigue || 0) + (effect.fatigueDelta || 0)));
    state.save.logistics.readiness = getReadiness().overall;
  }
  state.save.career.commandAdvancement = state.save.career.commandAdvancement && typeof state.save.career.commandAdvancement === 'object'
    ? state.save.career.commandAdvancement
    : { claimedIds: [], availableIds: [], history: [] };
  const claimed = new Set(state.save.career.commandAdvancement.claimedIds || []);
  claimed.add(rank.id);
  state.save.career.commandAdvancement.claimedIds = [...claimed];
  state.save.career.commandAdvancement.availableIds = (summary.ranks || []).filter((item) => item.unlocked && !item.claimed && item.id !== rank.id).map((item) => item.id);
  const record = { at: new Date().toISOString(), id: rank.id, rankKey: rank.rankKey, title: t(rank.rankKey), billet: t(rank.billetKey), detail: t(rank.descKey), reward, effect };
  state.save.career.commandAdvancement.history = [record, ...(state.save.career.commandAdvancement.history || [])].slice(0, 30);
  pushStrategyHistory({ type: 'command-advancement', title: t('commandAdvancement.historyTitle'), detail: t('commandAdvancement.historyDetail', { rank: t(rank.rankKey) }) });
  pushIntelReport({ title: t('commandAdvancement.reportTitle'), detail: t('commandAdvancement.reportDetail', { rank: t(rank.rankKey) }) });
  commitSave('toast.commandPromotionClaimed');
  render();
}


function assignVeteranOfficer(officerId) {
  if (!state.save?.career) return;
  applyRankAndMedals();
  const nationId = getCurrentNationId();
  const summary = getVeteranOfficerSummaryForNation(nationId);
  const officer = summary?.officers?.find((item) => item.id === officerId);
  const verdict = canAssignVeteranOfficer({ save: state.save, officer, summary });
  if (!verdict.ok) { showToast(t(verdict.reason, { count: officer?.lockCount || 0 })); return; }
  const cost = officer.cost || {};
  if (!spendCredits(cost.credits || 0)) { showToast(t('toast.notEnoughCredits')); return; }
  state.save.strategy.commandPoints = Math.max(0, (state.save.strategy.commandPoints || 0) - (cost.commandPoints || 0));
  const effect = officer.effect || {};
  state.save.strategy.intelLevel = Math.max(0, Math.min(100, (state.save.strategy.intelLevel || 0) + (effect.intelBonus || 0)));
  state.save.strategy.decryption = Math.max(0, Math.min(100, (state.save.strategy.decryption || 0) + (effect.decryptionBonus || 0)));
  state.save.strategy.pressure = Math.max(0, Math.min(100, (state.save.strategy.pressure || 0) - (effect.pressureRelief || 0)));
  state.save.strategy.falseContactRisk = Math.max(0, Math.min(100, (state.save.strategy.falseContactRisk || 0) + (effect.riskDelta || 0)));
  if (state.save.logistics) {
    state.save.logistics.morale = Math.max(0, Math.min(100, (state.save.logistics.morale || 0) + (effect.moraleBonus || 0)));
    state.save.logistics.fatigue = Math.max(0, Math.min(100, (state.save.logistics.fatigue || 0) + (effect.fatigueDelta || 0)));
    state.save.logistics.readiness = getReadiness().overall;
  }
  state.save.career.veteranOfficers = state.save.career.veteranOfficers && typeof state.save.career.veteranOfficers === 'object'
    ? state.save.career.veteranOfficers
    : { assignedIds: [], availableIds: [], history: [] };
  const assigned = new Set(state.save.career.veteranOfficers.assignedIds || []);
  assigned.add(officer.id);
  state.save.career.veteranOfficers.assignedIds = [...assigned];
  state.save.career.veteranOfficers.availableIds = (summary.officers || []).filter((item) => item.unlocked && !item.assigned && item.id !== officer.id).map((item) => item.id);
  const record = { at: new Date().toISOString(), id: officer.id, title: t(officer.nameKey), role: t(officer.roleKey), detail: t(officer.descKey), cost, effect };
  state.save.career.veteranOfficers.history = [record, ...(state.save.career.veteranOfficers.history || [])].slice(0, 30);
  pushStrategyHistory({ type: 'veteran-officer', title: t('veteranOfficers.historyTitle'), detail: t('veteranOfficers.historyDetail', { officer: t(officer.nameKey) }) });
  pushIntelReport({ title: t('veteranOfficers.reportTitle'), detail: t('veteranOfficers.reportDetail', { officer: t(officer.nameKey) }) });
  commitSave('toast.veteranOfficerAssigned');
  render();
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
  const doctrine = getDoctrineForNation(mission?.nationId || getCurrentNationId());
  const doctrineMods = normalizeDoctrineModifiers(doctrine);
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
  const costs = applyDoctrineToPatrolCost({
    fuel: Math.ceil(baseCosts.fuel * profile.fuel * strategic.fuelMultiplier),
    torpedoes: Math.ceil(baseCosts.torpedoes * profile.torpedoes),
    deckAmmo: Math.ceil(baseCosts.deckAmmo * profile.deckAmmo),
    rations: Math.ceil(baseCosts.rations * profile.rations),
    spareParts: Math.ceil(baseCosts.spareParts * profile.spareParts)
  }, doctrine);
  const logistics = supplySnapshot();
  const canAfford = ['fuel','torpedoes','deckAmmo','rations','spareParts'].every((key) => (logistics[key] || 0) >= costs[key]);
  const projected = { ...logistics };
  Object.entries(costs).forEach(([key, value]) => { projected[key] = Math.max(0, (projected[key] || 0) - value); });
  projected.fatigue = Math.min(100, (projected.fatigue || 0) + Math.ceil((8 + diff * 3 + order) * profile.fatigue));
  projected.morale = Math.max(0, Math.min(100, (projected.morale || 0) + (profile.morale || 0) + doctrineMods.moraleDelta - (diff > 3 ? 1 : 0)));
  const doctrineStrategic = { ...strategic, risk: Math.max(0, Math.min(100, (strategic.risk || 0) + doctrineMods.riskDelta)), opportunity: Math.max(0, Math.min(100, (strategic.opportunity || 0) + doctrineMods.opportunityBonus)), doctrineId: doctrine?.id || null, doctrineTitleKey: doctrine?.titleKey || null, doctrineStealthBonus: doctrineMods.stealthBonus };
  const readiness = Math.max(0, Math.min(100, getReadiness(projected).overall + strategic.readinessBonus + doctrineMods.readinessBonus));
  return { id: profile.id, labelKey: profile.labelKey, descKey: profile.descKey, costs, canAfford, readiness, fatigueDelta: Math.ceil((8 + diff * 3 + order) * profile.fatigue), moraleDelta: (profile.morale || 0) + doctrineMods.moraleDelta - (diff > 3 ? 1 : 0), strategic: doctrineStrategic, doctrineImpact: summarizeDoctrineImpact(doctrine) };
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

function runCrewDrill(drillId) {
  if (!state.save?.career) return;
  const nationId = getCurrentNationId();
  const summary = getCrewDrillSummaryForNation(nationId);
  const drill = summary?.drills?.find((item) => item.id === drillId);
  const verdict = canRunCrewDrill({ save: state.save, drill, summary });
  if (!verdict.ok) { showToast(t(verdict.reason, { count: drill?.lockCount || 0 })); return; }
  const cost = drill.cost || {};
  const effect = drill.effect || {};
  state.save.progression.credits = Math.max(0, (state.save.progression.credits || 0) - (cost.credits || 0));
  state.save.strategy.commandPoints = Math.max(0, (state.save.strategy.commandPoints || 0) - (cost.commandPoints || 0));
  state.save.strategy.intelLevel = Math.max(0, Math.min(100, (state.save.strategy.intelLevel || 0) + (effect.intelBonus || 0)));
  state.save.strategy.decryption = Math.max(0, Math.min(100, (state.save.strategy.decryption || 0) + (effect.decryptionBonus || 0)));
  state.save.strategy.pressure = Math.max(0, Math.min(100, (state.save.strategy.pressure || 0) - (effect.pressureRelief || 0)));
  state.save.strategy.falseContactRisk = Math.max(0, Math.min(100, (state.save.strategy.falseContactRisk || 0) + (effect.riskDelta || 0)));
  if (state.save.logistics) {
    state.save.logistics.morale = Math.max(0, Math.min(100, (state.save.logistics.morale || 0) + (effect.moraleBonus || 0)));
    state.save.logistics.fatigue = Math.max(0, Math.min(100, (state.save.logistics.fatigue || 0) + (effect.fatigueDelta || 0)));
    state.save.logistics.readiness = Math.max(0, Math.min(100, getReadiness().overall + (effect.readinessBonus || 0)));
  }
  state.save.career.crewDrills = state.save.career.crewDrills && typeof state.save.career.crewDrills === 'object'
    ? state.save.career.crewDrills
    : { completedIds: [], availableIds: [], history: [] };
  const completed = new Set(state.save.career.crewDrills.completedIds || []);
  completed.add(drill.id);
  state.save.career.crewDrills.completedIds = [...completed];
  state.save.career.crewDrills.availableIds = (summary.drills || []).filter((item) => item.unlocked && !item.completed && item.id !== drill.id).map((item) => item.id);
  const record = { id: drill.id, at: new Date().toISOString(), nationId, titleKey: drill.nameKey, effect };
  state.save.career.crewDrills.history = [record, ...(state.save.career.crewDrills.history || [])].slice(0, 30);
  pushStrategyHistory({ type: 'crew-drill', title: t('crewDrills.historyTitle'), detail: t('crewDrills.historyDetail', { drill: t(drill.nameKey) }) });
  pushIntelReport({ title: t('crewDrills.reportTitle'), detail: t('crewDrills.reportDetail', { drill: t(drill.nameKey) }) });
  commitSave('toast.crewDrillCompleted');
  render();
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
function getSelectedMission(nationId = getCurrentNationId()) {
  const selected = state.data?.missions?.find((item) => item.id === state.selectedMissionId && item.nationId === nationId);
  if (selected?.sandbox || selected?.missionMode === 'sandbox') return selected;
  const missions = missionsForNation(nationId);
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
  return calculateUpgradeBonus(state.data?.upgrades || [], state.save?.submarine?.upgrades || []);
}

function applyStatsBonus(stats, bonus) {
  return applyUpgradeStats(stats, bonus);
}

function getWorkshopImpactReport() {
  const current = getCurrentSubmarine();
  return buildWorkshopImpactReport({
    upgrades: state.data?.upgrades || [],
    ownedIds: state.save?.submarine?.upgrades || [],
    submarine: current || {},
    logistics: state.save?.logistics || {},
    hull: state.save?.submarine?.hull ?? 100,
    systems: state.save?.submarine?.systems || {},
  });
}

function showToast(message) {
  if (!message) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function setBackground(screen) {
  const backgroundKey = SCREEN_BACKGROUNDS[screen] || 'naval_base_lobby';
  const mode = BACKGROUND_MODE[screen] || 'global';
  document.body.dataset.background = backgroundKey;
  document.body.dataset.backgroundMode = mode;
  document.body.dataset.localAssetScreen = LOCAL_ASSET_SCREENS.has(screen) ? 'true' : 'false';
  const appBackground = document.querySelector('.app-background');
  if (appBackground) appBackground.style.backgroundImage = `url(assets/backgrounds/${backgroundKey}.png)`;
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
    campaignConsequences: getCampaignConsequenceDeckForNation(),
    campaignEvents: getCampaignEventSummaryForNation(),
    specialOperations: getSpecialOperationSummaryForNation(),
    operationChains: getOperationChainSummaryForNation(),
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
  setSave(save); setCampaignNation(nation.id); saveGame(save); refreshProfileState(); ensureSelectedMissionForNation(nation.id); setScreen('lobby'); showToast(t('toast.commanderCreated')); render();
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
  const gate = evaluateCareerGate(crew, state.save, 'crew');
  if (!gate.ok) { showToast(t(gate.reasonKey, { current: gate.reason?.current || 0, required: gate.reason?.required || 0 })); return; }
  if (!spendCredits(crew.cost)) { showToast(t('toast.notEnoughCredits')); return; }
  state.save.crew.hiredIds.push(id);
  commitSave('toast.crewUpdated');
  render();
}

function handleUnlockSubmarine(id) {
  const sub = state.data.submarines.find((item) => item.id === id);
  if (!sub || state.save.submarine.unlockedIds.includes(id)) return;
  const unlockCost = sub.unlockCost || 0;
  const gate = evaluateCareerGate(sub, state.save, 'submarine');
  if (!gate.ok) { showToast(t(gate.reasonKey, { current: gate.reason?.current || 0, required: gate.reason?.required || 0 })); return; }
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



function applyCampaignObjectiveRewards(nationId, completedBefore = [], completedAfter = []) {
  if (!state.save?.progression) return [];
  const objectiveSet = getCampaignObjectivesForNation(nationId);
  const claimed = state.save.progression.campaignObjectiveRewards || [];
  const newlyCompleted = getNewlyCompletedObjectiveRewards(objectiveSet, completedBefore, completedAfter, claimed);
  if (!newlyCompleted.length) return [];
  const nextClaimed = new Set(claimed);
  newlyCompleted.forEach((objective) => {
    nextClaimed.add(objective.id);
    addRewards(objective.reward.credits, objective.reward.xp);
    if (state.save.career) {
      state.save.career.reputation += objective.reward.reputation;
      state.save.career.prestige += objective.reward.prestige;
      state.save.career.serviceRecord = [{
        missionId: objective.id,
        missionTitle: t(objective.titleKey),
        score: 0,
        tonnage: 0,
        reputationGained: objective.reward.reputation,
        completedAt: new Date().toISOString(),
        rankIndex: state.save.career.rankIndex || 0,
        objectiveReward: true,
      }, ...(state.save.career.serviceRecord || [])].slice(0, 24);
    }
    if (state.save.strategy) {
      state.save.strategy.commandPoints = Math.min(99, (state.save.strategy.commandPoints || 0) + objective.reward.commandPoints);
      state.save.strategy.intelLevel = Math.min(100, (state.save.strategy.intelLevel || 0) + objective.reward.intel);
      state.save.strategy.pressure = Math.max(0, (state.save.strategy.pressure || 0) - objective.reward.pressureRelief);
      pushStrategyHistory({ type: 'campaign-objective', title: t(objective.titleKey), detail: t(objective.effectKey) });
      pushIntelReport({ title: t('campaignObjectives.rewardReport'), detail: t(objective.effectKey) });
    }
  });
  state.save.progression.campaignObjectiveRewards = [...nextClaimed].slice(-32);
  return newlyCompleted;
}

function handleCompleteMission(id, report = null) {
  clearOperationAutosave(state.activeProfileId);
  setOperationAutosave(null);
  setResumeOperation(false);
  const mission = state.data.missions.find((item) => item.id === id);
  if (!mission) return;
  const crewImpact = getCrewProgressionImpact(mission.nationId);
  const missionReport = applyCrewImpactToMissionReport(report || {}, crewImpact);
  const completedBefore = [...(state.save.progression.completedMissions || [])];
  const alreadyCompleted = state.save.progression.completedMissions.includes(id);
  const moraleOutcome = calculateMissionMoraleOutcome({ mission, report: missionReport, alreadyCompleted });
  const bonusCredits = missionReport?.bonusCredits || 0;
  const bonusXp = missionReport?.bonusXp || 0;
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
  const completedAfter = [...(state.save.progression.completedMissions || [])];
  const objectiveRewards = applyCampaignObjectiveRewards(mission.nationId, completedBefore, completedAfter);
  state.save.progression.bestScore = Math.max(state.save.progression.bestScore || 0, missionReport?.score || 0);
  state.save.progression.missionReports = [
    { missionId: id, score: missionReport?.score || 0, baseScore: missionReport?.baseScore || report?.score || 0, bonusCredits, bonusXp, crewScoreMultiplier: missionReport?.crewScoreMultiplier || 1, crewImpactApplied: Boolean(missionReport?.crewImpactApplied), moraleDelta: moraleOutcome.moraleDelta, fatigueDelta: moraleOutcome.fatigueDelta, moraleOutcomeKey: moraleOutcome.labelKey, objectiveRewardIds: objectiveRewards.map((item) => item.id), hull: missionReport?.hull ?? report?.hull ?? null, stealth: missionReport?.stealth ?? report?.stealth ?? null, shots: missionReport?.shots ?? report?.shots ?? null, completedAt: new Date().toISOString() },
    ...(state.save.progression.missionReports || [])
  ].slice(0, 12);
  const score = missionReport?.score || 0;
  const difficulty = difficultyValue(mission);
  const doctrine = getDoctrineForNation(mission.nationId);
  const doctrineMods = normalizeDoctrineModifiers(doctrine);
  const estimatedTonnage = Math.max(900, Math.round(((mission.reward || 0) * 2.8 + difficulty * 1450 + score * 5) * doctrineMods.tonnageMultiplier));
  if (state.save.career) {
    state.save.career.patrols += 1;
    state.save.career.victories += 1;
    state.save.career.tonnage += estimatedTonnage;
    state.save.career.reputation += Math.max(8, Math.round((score / 35) + difficulty * 7 + (mission.campaignOrder || 1))) + Math.max(0, moraleOutcome.reputationBonus);
    state.save.career.prestige += Math.max(4, Math.round((totalXp / 30) + difficulty * 2));
    state.save.career.convoyDisruption = Math.min(100, (state.save.career.convoyDisruption || 0) + difficulty + 1);
    state.save.career.campaignPressure = Math.max(0, (state.save.career.campaignPressure || 0) - Math.ceil(difficulty / 2));
    state.save.career.serviceRecord = [{
      missionId: id, missionTitle: t(mission.titleKey), score, tonnage: estimatedTonnage,
      reputationGained: Math.max(8, Math.round((score / 35) + difficulty * 7 + (mission.campaignOrder || 1))) + Math.max(0, moraleOutcome.reputationBonus),
      moraleDelta: moraleOutcome.moraleDelta, moraleOutcomeKey: moraleOutcome.labelKey,
      completedAt: new Date().toISOString(), rankIndex: state.save.career.rankIndex || 0
    }, ...(state.save.career.serviceRecord || [])].slice(0, 24);
  }
  if (state.save.logistics) {
    state.save.logistics.activePlan = null;
    state.save.logistics.morale = Math.max(0, Math.min(100, (state.save.logistics.morale || 0) + moraleOutcome.moraleDelta));
    state.save.logistics.fatigue = Math.max(0, Math.min(100, (state.save.logistics.fatigue || 0) + moraleOutcome.fatigueDelta));
    state.save.logistics.spareParts = Math.max(0, (state.save.logistics.spareParts || 0) - Math.max(1, Math.round((100 - (report?.hull ?? 86)) / 20)));
    state.save.logistics.readiness = getReadiness().overall;
  }
  if (state.save.strategy) {
    const modifier = strategicPatrolModifier();
    const strat = state.save.strategy;
    const intelGain = Math.max(1, Math.round((score || 0) / 240 + difficulty + doctrineMods.intelGain));
    strat.commandPoints = Math.min(99, (strat.commandPoints || 0) + (score >= 650 ? 2 : 1));
    strat.intelLevel = Math.min(100, (strat.intelLevel || 0) + intelGain);
    strat.decryption = Math.min(100, (strat.decryption || 0) + (score >= 700 ? 3 : 1));
    strat.falseContactRisk = Math.max(0, (strat.falseContactRisk || 0) - (score >= 650 ? 2 : 0));
    strat.pressure = Math.max(0, Math.min(100, (strat.pressure || 0) + (modifier.risk >= 78 ? 2 : -1) - (score >= 650 ? 2 : 0) + doctrineMods.pressureDelta));
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
  ensureSelectedMissionForNation(state.currentScreen === 'campaign' ? getCampaignViewNationId() : getCurrentNationId());
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
  setCampaignNation(save?.commander?.nationId || null);
  syncMissionAvailability();
  ensureSelectedMissionForNation(save?.commander?.nationId || getCurrentNationId());
  setScreen(save ? destination : 'commander');
  showToast(t(save ? 'toast.profileActivated' : 'toast.profileReady'));
  render();
}

function createProfile(slotId) {
  const profile = state.profiles.find((item) => item.id === slotId);
  if (profile?.occupied && !confirm(t('profiles.overwriteConfirm'))) return;
  selectProfile(slotId); clearProfile(slotId);
  setActiveProfileId(slotId); setSave(null); setCampaignNation(null); setOperationAutosave(null); setResumeOperation(false);
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
  selectProfile(slotId); setActiveProfileId(slotId); setSave(restored); setCampaignNation(restored?.commander?.nationId || null); setOperationAutosave(loadOperationAutosave(slotId));
  refreshProfileState(); syncMissionAvailability(); render(); showToast(t('toast.backupRestored'));
}

async function resumeOperation() {
  const operation = state.operationAutosave;
  if (!state.save || !operation?.missionId) { showToast(t('toast.noOperation')); return; }
  const mission = state.data.missions.find((item) => item.id === operation.missionId);
  if (!mission) { clearOperationAutosave(state.activeProfileId); setOperationAutosave(null); showToast(t('toast.noOperation')); return; }
  await enterMobileGameplayMode();
  setMission(operation.missionId); setResumeOperation(true);
  setScreen('gameplay'); render();
}

function initEvents() {
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-nav], [data-action]');
    if (!target) return;
    playSfx('tap');
    const nav = target.dataset.nav;
    if (nav) {
      if (nav !== 'settings' && !state.save && ['lobby', 'campaign', 'career', 'strategy', 'bridge', 'briefing', 'arsenal', 'crew', 'gameplay'].includes(nav)) { showToast(t('menu.noSave')); return; }
      if (nav === 'campaign' && !state.selectedCampaignNationId) setCampaignNation(getCurrentNationId());
      if (nav === 'campaign') ensureSelectedMissionForNation(getCampaignViewNationId());
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
        setDraft({ nationId, avatar: nationAvatarMap[nationId] || state.commanderDraft.avatar }); setCampaignNation(nationId); ensureSelectedMissionForNation(nationId); render(); break;
      }
      case 'select-avatar': setDraft({ avatar: target.dataset.avatar }); render(); break;
      case 'confirm-commander': createCommander(); break;
      case 'select-campaign-nation': {
        const nationId = target.dataset.nation;
        if (!nationById(nationId)) break;
        setCampaignNation(nationId); ensureSelectedMissionForNation(nationId); render(); break;
      }
      case 'select-mission': {
        const missionId = target.dataset.mission;
        const viewNationId = state.currentScreen === 'campaign' ? getCampaignViewNationId() : getCurrentNationId();
        if (missionsForNation(viewNationId).some((mission) => mission.id === missionId)) setMission(missionId);
        render(); break;
      }
      case 'open-briefing': {
        if (getCampaignViewNationId() !== getCurrentNationId()) { showToast(t('toast.campaignCreateCommander')); break; }
        ensureSelectedMissionForNation(getCurrentNationId());
        setScreen('briefing'); render(); break;
      }
      case 'launch-sandbox': {
        const mission = buildSandboxMission({ scenarioId: target.dataset.sandbox, nationId: getCurrentNationId(), campaigns: state.data?.campaigns || [] });
        state.data.missions = [mission, ...(state.data.missions || []).filter((item) => item.id !== mission.id)];
        setMission(mission.id);
        clearOperationAutosave(state.activeProfileId); setOperationAutosave(null); setResumeOperation(false);
        showToast(t('toast.sandboxReady'));
        setScreen('briefing'); render(); break;
      }
      case 'start-mission': {
        if (getSelectedMission()?.nationId !== getCurrentNationId()) { showToast(t('toast.campaignCreateCommander')); break; }
        if (!ensurePatrolReadyForLaunch()) break;
        clearOperationAutosave(state.activeProfileId); setOperationAutosave(null); setResumeOperation(false);
        await enterMobileGameplayMode();
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
      case 'apply-high-command-order': applyHighCommandOrder(target.dataset.order); break;
      case 'acknowledge-campaign-event': acknowledgeCampaignEvent(target.dataset.event); break;
      case 'launch-special-operation': launchSpecialOperation(target.dataset.operation); break;
      case 'execute-operation-chain-step': executeOperationChainStep(target.dataset.step); break;
      case 'choose-operation-outcome': chooseOperationOutcome(target.dataset.outcome); break;
      case 'award-operational-honor': awardOperationalHonor(target.dataset.honor); break;
      case 'claim-command-promotion': claimCommandPromotion(target.dataset.rank); break;
      case 'assign-veteran-officer': assignVeteranOfficer(target.dataset.officer); break;
      case 'run-crew-drill': runCrewDrill(target.dataset.drill); break;
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
        selectProfile(slotId); setActiveProfileId(slotId); setSave(imported); setCampaignNation(imported?.commander?.nationId || null); setOperationAutosave(null); setResumeOperation(false);
        refreshProfileState(); syncMissionAvailability(); setScreen('lobby'); render(); showToast(t('toast.profileImported'));
      } catch (error) { console.warn('[Import]', error); showToast(t('toast.importFailed')); }
      event.target.value = '';
    }
  });
}

function createSceneContext() {
  const nationId = getCurrentNationId();
  const campaignViewNationId = getCampaignViewNationId();
  return {
    app,
    t,
    state,
    nationId,
    campaignViewNationId,
    nation: getCurrentNation(),
    campaignViewNation: nationById(campaignViewNationId) || getCurrentNation(),
    submarine: getCurrentSubmarine(),
    crew: getCurrentCrew(),
    mission: getSelectedMission(),
    campaign: getCampaignForNation(),
    campaignProgress: getCampaignProgress(),
    campaignViewMission: getSelectedMission(campaignViewNationId),
    campaignViewCampaign: getCampaignForNation(campaignViewNationId),
    campaignViewMissions: missionsForNation(campaignViewNationId),
    campaignViewProgress: getCampaignProgress(campaignViewNationId),
    campaignViewDoctrine: getDoctrineForNation(campaignViewNationId),
    campaignViewDoctrineStage: getDoctrineStageForNation(campaignViewNationId),
    campaignViewDoctrineImpact: getDoctrineImpactForNation(campaignViewNationId),
    campaignViewObjectives: getCampaignObjectiveDeckForNation(campaignViewNationId),
    campaignViewConsequences: getCampaignConsequenceDeckForNation(campaignViewNationId),
    campaignViewEvents: getCampaignEventSummaryForNation(campaignViewNationId),
    campaignViewSpecialOperations: getSpecialOperationSummaryForNation(campaignViewNationId),
    campaignViewOperationChains: getOperationChainSummaryForNation(campaignViewNationId),
    campaignViewOperationOutcomes: getOperationOutcomeSummaryForNation(campaignViewNationId),
    campaignViewOperationalHonors: getOperationalHonorSummaryForNation(campaignViewNationId),
    campaignViewCommandAdvancement: getCommandAdvancementSummaryForNation(campaignViewNationId),
    campaignViewVeteranOfficers: getVeteranOfficerSummaryForNation(campaignViewNationId),
    campaignViewCrewDrills: getCrewDrillSummaryForNation(campaignViewNationId),
    campaignProgressByNation: getCampaignProgressByNation(),
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
    campaignConsequences: getCampaignConsequenceDeckForNation(nationId),
    campaignEvents: getCampaignEventSummaryForNation(nationId),
    specialOperations: getSpecialOperationSummaryForNation(nationId),
    operationChains: getOperationChainSummaryForNation(nationId),
    operationOutcomes: getOperationOutcomeSummaryForNation(nationId),
    operationalHonors: getOperationalHonorSummaryForNation(nationId),
    commandAdvancement: getCommandAdvancementSummaryForNation(nationId),
    veteranOfficers: getVeteranOfficerSummaryForNation(nationId),
    crewDrills: getCrewDrillSummaryForNation(nationId),
    crewProgressionImpact: getCrewProgressionImpact(nationId),
    careerRetention: getCareerRetentionDeck(nationId),
    highCommandOrders: getHighCommandSummaryForNation(nationId),
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
  .register('campaign', { render: ({ t: translate, campaignViewNation, campaignViewNationId, campaignViewMissions, campaignViewMission, campaignViewCampaign, campaignViewProgress, campaignViewDoctrine, campaignViewDoctrineStage, campaignViewDoctrineImpact, campaignViewObjectives, campaignViewConsequences, campaignViewEvents, campaignViewSpecialOperations, campaignViewOperationChains, campaignViewOperationOutcomes, campaignViewOperationalHonors, campaignViewCommandAdvancement, campaignViewVeteranOfficers, campaignViewCrewDrills, campaignProgressByNation }) => renderCampaign(translate, campaignViewMissions, campaignViewMission, campaignViewCampaign, campaignViewNation, campaignViewProgress, { allNations: state.data.nations, allCampaigns: state.data.campaigns, currentNationId: getCurrentNationId(), viewNationId: campaignViewNationId, progressByNation: campaignProgressByNation, completedMissions: state.save?.progression?.completedMissions || [], campaignObjectives: campaignViewObjectives, campaignConsequences: campaignViewConsequences, campaignEvents: campaignViewEvents, specialOperations: campaignViewSpecialOperations, operationChains: campaignViewOperationChains, operationOutcomes: campaignViewOperationOutcomes, operationalHonors: campaignViewOperationalHonors, commandAdvancement: campaignViewCommandAdvancement, veteranOfficers: campaignViewVeteranOfficers, crewDrills: campaignViewCrewDrills, doctrine: campaignViewDoctrine, doctrineStage: campaignViewDoctrineStage, doctrineImpact: campaignViewDoctrineImpact }) })
  .register('career', { render: ({ t: translate, nation, campaign, mission, logisticsBase, logisticsData, careerRank, readiness, previewPlans }) => renderCareer(translate, state.save, nation, campaign, mission, logisticsBase, logisticsData, careerRank, readiness, previewPlans) })
  .register('strategy', { render: ({ t: translate, nation, strategyData, strategyTheater, selectedLane, selectedDirective, strategicAssessment, campaignConsequences, campaignEvents, specialOperations, operationChains, operationOutcomes, operationalHonors, commandAdvancement, veteranOfficers, highCommandOrders }) => renderStrategy(translate, state.save, nation, strategyData, strategyTheater, selectedLane, selectedDirective, strategicAssessment, campaignConsequences, highCommandOrders, campaignEvents, specialOperations, operationChains, operationOutcomes, operationalHonors, commandAdvancement, veteranOfficers) })
  .register('bridge', {
    render: ({ t: translate, nation, submarine, mission, readiness, strategicAssessment }) => renderBridge(translate, state.save, nation, submarine, mission, readiness, strategicAssessment),
    enter: ({ app: root, t: translate, nation, submarine, mission, readiness, strategicAssessment }) => mountBridge({ app: root, t: translate, save: state.save, nation, submarine, mission, readiness, strategicAssessment }),
    exit: cleanupBridge,
  })
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
      crewImpact: getCrewProgressionImpact(mission?.nationId || getCurrentNationId()),
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
  .register('arsenal', { render: ({ t: translate, nationId, submarines, careerRetention }) => renderArsenal(translate, submarines, state.save?.submarine.currentId, state.save?.progression.level || 1, state.save?.progression.credits || 0, state.save?.submarine.upgrades || [], state.data.upgrades, state.save?.submarine || null, getWorkshopImpactReport(), careerRetention) })
  .register('crew', { render: ({ t: translate, nationCrew, crewDrills, crewProgressionImpact, careerRetention }) => renderCrew(translate, nationCrew, state.save?.crew?.hiredIds || [], state.save?.progression?.credits || 0, state.save || {}, crewDrills, crewProgressionImpact, careerRetention) })
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
    if (save) { setSave(save); setCampaignNation(save.commander?.nationId || null); }
    setOperationAutosave(loadOperationAutosave(state.activeProfileId));
    const saveDiagnostics = getSaveDiagnostics();
    if (saveDiagnostics.recovered) setTimeout(() => showToast(t('toast.saveRecovered')), 1400);
    else if (saveDiagnostics.transactionRecovered) setTimeout(() => showToast(t('toast.transactionRecovered')), 1400);
    else if (saveDiagnostics.migrated) setTimeout(() => showToast(t('toast.legacyMigrated')), 1400);
    syncMissionAvailability();
    if (!state.selectedMissionId) ensureSelectedMissionForNation();
    buildFooter.textContent = renderBuildFooter(t);
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
