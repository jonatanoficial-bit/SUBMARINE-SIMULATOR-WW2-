import { BUILD_INFO } from './build.js';
import {
  clampNumber,
  normalizeAssetPath,
  normalizeCommanderName,
  normalizeStringId,
  uniqueStringArray
} from './utils/sanitize.js';

const LEGACY_SAVE_KEY = 'valeGames.submarineCommander.save';
const LEGACY_BACKUP_KEY = 'valeGames.submarineCommander.save.backup';
const STORAGE_PREFIX = 'valeGames.submarineCommander.v3';
const INDEX_KEY = `${STORAGE_PREFIX}.profiles`;
const JOURNAL_KEY = `${STORAGE_PREFIX}.transaction`;
const MIGRATION_MARKER_KEY = `${STORAGE_PREFIX}.legacyMigrationComplete`;
const SETTINGS_KEY = 'valeGames.submarineCommander.settings';
const BACKUP_COUNT = 3;
const SAVE_SCHEMA_VERSION = Number(BUILD_INFO.saveSchemaVersion || 3);
const DEFAULT_AVATAR = 'assets/avatars/de/captain_01.png';
const VALID_NATIONS = new Set(['de', 'uk', 'us']);
export const PROFILE_SLOTS = Object.freeze(['slot-1', 'slot-2', 'slot-3']);

let lastLoadDiagnostics = {
  source: 'none', recovered: false, migrated: false, transactionRecovered: false,
  slotId: 'slot-1', error: null
};

function nowIso() { return new Date().toISOString(); }

export function checksum(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
function validIso(value, fallback) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback; }
function slotKey(slotId) { return `${STORAGE_PREFIX}.${slotId}.primary`; }
function tempKey(slotId) { return `${STORAGE_PREFIX}.${slotId}.temp`; }
function backupKey(slotId, revision) { return `${STORAGE_PREFIX}.${slotId}.backup.${revision}`; }
function operationKey(slotId) { return `${STORAGE_PREFIX}.${slotId}.operation`; }
function validSlot(slotId) { return PROFILE_SLOTS.includes(slotId); }

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch (error) { console.warn('[SaveV3] Storage write failed', error); return false; }
}
function safeRemove(key) { try { localStorage.removeItem(key); } catch {} }

function sanitizeSystems(value = {}) {
  return {
    engines: clampNumber(value.engines, 0, 100, 100),
    sonar: clampNumber(value.sonar, 0, 100, 100),
    periscope: clampNumber(value.periscope, 0, 100, 100),
    weapons: clampNumber(value.weapons, 0, 100, 100)
  };
}

function defaultLogisticsForNation(nationId = 'de') {
  const defaults = {
    de: { fuel: 8200, torpedoes: 18, deckAmmo: 280, rations: 46, spareParts: 22, morale: 78, fatigue: 8 },
    uk: { fuel: 7800, torpedoes: 16, deckAmmo: 260, rations: 44, spareParts: 24, morale: 82, fatigue: 7 },
    us: { fuel: 9000, torpedoes: 20, deckAmmo: 320, rations: 52, spareParts: 26, morale: 84, fatigue: 6 }
  };
  return defaults[nationId] || defaults.de;
}

function sanitizeCareer(value = {}) {
  const serviceRecord = Array.isArray(value.serviceRecord)
    ? value.serviceRecord.filter((item) => item && typeof item === 'object').slice(0, 24)
    : [];
  return {
    rankIndex: Math.floor(clampNumber(value.rankIndex, 0, 12, 0)),
    reputation: Math.floor(clampNumber(value.reputation, 0, 999999, 0)),
    prestige: Math.floor(clampNumber(value.prestige, 0, 999999, 0)),
    patrols: Math.floor(clampNumber(value.patrols, 0, 999999, 0)),
    victories: Math.floor(clampNumber(value.victories, 0, 999999, 0)),
    failedPatrols: Math.floor(clampNumber(value.failedPatrols, 0, 999999, 0)),
    tonnage: Math.floor(clampNumber(value.tonnage, 0, 999999999, 0)),
    convoyDisruption: Math.floor(clampNumber(value.convoyDisruption, 0, 100, 0)),
    campaignPressure: Math.floor(clampNumber(value.campaignPressure, 0, 100, 15)),
    medals: uniqueStringArray(value.medals),
    serviceRecord
  };
}

function sanitizeLogistics(value = {}, nationId = 'de') {
  const defaults = defaultLogisticsForNation(nationId);
  const activePlan = value.activePlan && typeof value.activePlan === 'object' ? {
    missionId: normalizeStringId(value.activePlan.missionId, '') || null,
    profileId: normalizeStringId(value.activePlan.profileId, 'balanced') || 'balanced',
    readiness: Math.floor(clampNumber(value.activePlan.readiness, 0, 100, 0)),
    plannedAt: validIso(value.activePlan.plannedAt, nowIso()),
    costs: value.activePlan.costs && typeof value.activePlan.costs === 'object' ? {
      fuel: Math.floor(clampNumber(value.activePlan.costs.fuel, 0, 999999, 0)),
      torpedoes: Math.floor(clampNumber(value.activePlan.costs.torpedoes, 0, 9999, 0)),
      deckAmmo: Math.floor(clampNumber(value.activePlan.costs.deckAmmo, 0, 99999, 0)),
      rations: Math.floor(clampNumber(value.activePlan.costs.rations, 0, 9999, 0)),
      spareParts: Math.floor(clampNumber(value.activePlan.costs.spareParts, 0, 9999, 0))
    } : null
  } : null;
  const sortiePlans = Array.isArray(value.sortiePlans)
    ? value.sortiePlans.filter((item) => item && typeof item === 'object').slice(0, 16)
    : [];
  return {
    fuel: Math.floor(clampNumber(value.fuel, 0, 999999, defaults.fuel)),
    torpedoes: Math.floor(clampNumber(value.torpedoes, 0, 9999, defaults.torpedoes)),
    deckAmmo: Math.floor(clampNumber(value.deckAmmo, 0, 99999, defaults.deckAmmo)),
    rations: Math.floor(clampNumber(value.rations, 0, 9999, defaults.rations)),
    spareParts: Math.floor(clampNumber(value.spareParts, 0, 9999, defaults.spareParts)),
    morale: Math.floor(clampNumber(value.morale, 0, 100, defaults.morale)),
    fatigue: Math.floor(clampNumber(value.fatigue, 0, 100, defaults.fatigue)),
    readiness: Math.floor(clampNumber(value.readiness, 0, 100, 75)),
    dockDays: Math.floor(clampNumber(value.dockDays, 0, 9999, 0)),
    lastResupplyAt: validIso(value.lastResupplyAt, nowIso()),
    activePlan,
    sortiePlans
  };
}


function defaultStrategyForNation(nationId = 'de') {
  const defaults = {
    de: { theaterId: 'de_atlantic_command', laneId: 'lane_north_atlantic', directiveId: 'directive_balanced', intelLevel: 54, decryption: 18, pressure: 62 },
    uk: { theaterId: 'uk_western_approaches', laneId: 'lane_bay_biscay', directiveId: 'directive_balanced', intelLevel: 67, decryption: 24, pressure: 58 },
    us: { theaterId: 'us_pacific_command', laneId: 'lane_philippine_sea', directiveId: 'directive_balanced', intelLevel: 64, decryption: 22, pressure: 54 }
  };
  return defaults[nationId] || defaults.de;
}

function sanitizeStrategy(value = {}, nationId = 'de') {
  const defaults = defaultStrategyForNation(nationId);
  const commandHistory = Array.isArray(value.commandHistory)
    ? value.commandHistory.filter((item) => item && typeof item === 'object').slice(0, 20)
    : [];
  const intelligenceReports = Array.isArray(value.intelligenceReports)
    ? value.intelligenceReports.filter((item) => item && typeof item === 'object').slice(0, 20)
    : [];
  const highCommandOrders = value.highCommandOrders && typeof value.highCommandOrders === 'object' ? value.highCommandOrders : {};
  const highCommandLegacy = Array.isArray(value.highCommandApplied) ? value.highCommandApplied : [];
  const highCommandHistory = Array.isArray(highCommandOrders.history)
    ? highCommandOrders.history.filter((item) => item && typeof item === 'object').slice(0, 20)
    : [];
  return {
    theaterId: normalizeStringId(value.theaterId, defaults.theaterId) || defaults.theaterId,
    selectedLaneId: normalizeStringId(value.selectedLaneId || value.laneId, defaults.laneId) || defaults.laneId,
    directiveId: normalizeStringId(value.directiveId, defaults.directiveId) || defaults.directiveId,
    intelLevel: Math.floor(clampNumber(value.intelLevel, 0, 100, defaults.intelLevel)),
    decryption: Math.floor(clampNumber(value.decryption, 0, 100, defaults.decryption)),
    falseContactRisk: Math.floor(clampNumber(value.falseContactRisk, 0, 100, 18)),
    pressure: Math.floor(clampNumber(value.pressure, 0, 100, defaults.pressure)),
    commandPoints: Math.floor(clampNumber(value.commandPoints, 0, 99, 2)),
    ordersIssued: Math.floor(clampNumber(value.ordersIssued, 0, 999999, 0)),
    commandHistory,
    intelligenceReports,
    highCommandOrders: {
      appliedIds: uniqueStringArray([...(highCommandOrders.appliedIds || []), ...highCommandLegacy]),
      history: highCommandHistory
    }
  };
}

export function migrateSave(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const save = deepClone(input);
  const timestamp = nowIso();
  const nationId = VALID_NATIONS.has(save.commander?.nationId) ? save.commander.nationId : 'de';
  const avatarFallback = `assets/avatars/${nationId}/captain_01.png`;

  save.commander = {
    name: normalizeCommanderName(save.commander?.name) || 'Commander',
    nationId,
    avatar: normalizeAssetPath(save.commander?.avatar, avatarFallback || DEFAULT_AVATAR),
    createdBuild: String(save.commander?.createdBuild || BUILD_INFO.version).slice(0, 48)
  };
  save.progression = {
    level: Math.floor(clampNumber(save.progression?.level, 1, 999, 1)),
    xp: Math.floor(clampNumber(save.progression?.xp, 0, 99999999, 0)),
    credits: Math.floor(clampNumber(save.progression?.credits, 0, 999999999, 5000)),
    completedMissions: uniqueStringArray(save.progression?.completedMissions),
    campaignObjectiveRewards: uniqueStringArray(save.progression?.campaignObjectiveRewards),
    missionReports: Array.isArray(save.progression?.missionReports)
      ? save.progression.missionReports.filter((item) => item && typeof item === 'object').slice(0, 12)
      : [],
    bestScore: Math.floor(clampNumber(save.progression?.bestScore, 0, 999999999, 0))
  };
  save.submarine = {
    currentId: normalizeStringId(save.submarine?.currentId, '') || null,
    unlockedIds: uniqueStringArray(save.submarine?.unlockedIds),
    upgrades: uniqueStringArray(save.submarine?.upgrades),
    hull: clampNumber(save.submarine?.hull, 0, 100, 100),
    systems: sanitizeSystems(save.submarine?.systems)
  };
  if (save.submarine.currentId && !save.submarine.unlockedIds.includes(save.submarine.currentId)) {
    save.submarine.unlockedIds.unshift(save.submarine.currentId);
  }
  save.crew = { hiredIds: uniqueStringArray(save.crew?.hiredIds) };
  save.economy = {
    totalEarned: Math.floor(clampNumber(save.economy?.totalEarned, 0, 999999999, 0)),
    totalSpent: Math.floor(clampNumber(save.economy?.totalSpent, 0, 999999999, 0))
  };
  save.career = sanitizeCareer(save.career);
  save.logistics = sanitizeLogistics(save.logistics, nationId);
  save.strategy = sanitizeStrategy(save.strategy, nationId);
  save.meta = {
    createdAt: validIso(save.meta?.createdAt, timestamp),
    updatedAt: validIso(save.meta?.updatedAt, timestamp),
    schemaVersion: SAVE_SCHEMA_VERSION,
    lastBuild: BUILD_INFO.version,
    revision: Math.floor(clampNumber(save.meta?.revision, 0, 999999999, 0)),
    profileId: validSlot(save.meta?.profileId) ? save.meta.profileId : null
  };
  return save;
}

function makeEnvelope(save, slotId) {
  const data = migrateSave(save);
  if (!data) throw new Error('Invalid save data');
  data.meta.updatedAt = nowIso();
  data.meta.lastBuild = BUILD_INFO.version;
  data.meta.revision = (data.meta.revision || 0) + 1;
  data.meta.profileId = slotId;
  const payload = JSON.stringify(data);
  return {
    format: 'SCWW2_SAVE', schemaVersion: SAVE_SCHEMA_VERSION, buildVersion: BUILD_INFO.version,
    slotId, savedAt: data.meta.updatedAt, checksum: checksum(payload), data
  };
}

function decodeRaw(raw) {
  if (!raw) return { save: null, migrated: false };
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && parsed.data && parsed.checksum) {
    const payload = JSON.stringify(parsed.data);
    if (checksum(payload) !== parsed.checksum) throw new Error('Save checksum mismatch');
    return { save: migrateSave(parsed.data), migrated: Number(parsed.schemaVersion) !== SAVE_SCHEMA_VERSION };
  }
  return { save: migrateSave(parsed), migrated: true };
}
function isDecodable(raw) { try { return Boolean(decodeRaw(raw).save); } catch { return false; } }

function defaultIndex() {
  return {
    format: 'SCWW2_PROFILE_INDEX', version: 1, activeSlotId: 'slot-1', updatedAt: nowIso(),
    slots: Object.fromEntries(PROFILE_SLOTS.map((id) => [id, null]))
  };
}
function sanitizeIndex(input) {
  const index = input && typeof input === 'object' ? input : defaultIndex();
  const slots = {};
  PROFILE_SLOTS.forEach((id) => {
    const value = index.slots?.[id];
    slots[id] = value && typeof value === 'object' ? {
      commanderName: normalizeCommanderName(value.commanderName) || 'Commander',
      nationId: VALID_NATIONS.has(value.nationId) ? value.nationId : 'de',
      level: Math.floor(clampNumber(value.level, 1, 999, 1)),
      updatedAt: validIso(value.updatedAt, nowIso()),
      revision: Math.floor(clampNumber(value.revision, 0, 999999999, 0)),
      buildVersion: String(value.buildVersion || BUILD_INFO.version).slice(0, 48)
    } : null;
  });
  return {
    format: 'SCWW2_PROFILE_INDEX', version: 1,
    activeSlotId: validSlot(index.activeSlotId) ? index.activeSlotId : 'slot-1',
    updatedAt: validIso(index.updatedAt, nowIso()), slots
  };
}
function loadIndexRaw() {
  try { return sanitizeIndex(JSON.parse(safeGet(INDEX_KEY) || 'null')); }
  catch { return defaultIndex(); }
}
function saveIndex(index) {
  const clean = sanitizeIndex(index);
  clean.updatedAt = nowIso();
  if (!safeSet(INDEX_KEY, JSON.stringify(clean))) throw new Error('Profile index write failed');
  return clean;
}
function metadataFromSave(save) {
  return {
    commanderName: save.commander.name, nationId: save.commander.nationId,
    level: save.progression.level, updatedAt: save.meta.updatedAt,
    revision: save.meta.revision, buildVersion: save.meta.lastBuild
  };
}

function recoverPendingTransaction() {
  const raw = safeGet(JOURNAL_KEY);
  if (!raw) return false;
  try {
    const journal = JSON.parse(raw);
    if (!validSlot(journal.slotId)) throw new Error('Invalid transaction slot');
    const current = safeGet(slotKey(journal.slotId));
    const temp = safeGet(tempKey(journal.slotId));
    if (current && checksum(current) === journal.nextRecordChecksum && isDecodable(current)) {
      safeRemove(tempKey(journal.slotId)); safeRemove(JOURNAL_KEY); return true;
    }
    if (temp && checksum(temp) === journal.nextRecordChecksum && isDecodable(temp)) {
      if (!safeSet(slotKey(journal.slotId), temp)) throw new Error('Could not finish pending transaction');
      safeRemove(tempKey(journal.slotId)); safeRemove(JOURNAL_KEY); return true;
    }
    if (journal.previousRaw && isDecodable(journal.previousRaw)) safeSet(slotKey(journal.slotId), journal.previousRaw);
    else safeRemove(slotKey(journal.slotId));
    safeRemove(tempKey(journal.slotId)); safeRemove(JOURNAL_KEY); return true;
  } catch (error) {
    console.warn('[SaveV3] Transaction recovery failed', error);
    safeRemove(JOURNAL_KEY);
    return false;
  }
}

function rotateBackups(slotId, currentRaw) {
  for (let revision = BACKUP_COUNT; revision >= 2; revision -= 1) {
    const previous = safeGet(backupKey(slotId, revision - 1));
    if (previous && isDecodable(previous)) safeSet(backupKey(slotId, revision), previous);
    else safeRemove(backupKey(slotId, revision));
  }
  if (currentRaw && isDecodable(currentRaw)) safeSet(backupKey(slotId, 1), currentRaw);
}

function commitSlot(slotId, save, options = {}) {
  if (!validSlot(slotId)) throw new Error('Invalid profile slot');
  const envelope = makeEnvelope(save, slotId);
  const serialized = JSON.stringify(envelope);
  const primaryKey = slotKey(slotId);
  const previousRaw = safeGet(primaryKey);
  const journal = {
    format: 'SCWW2_TRANSACTION', slotId, startedAt: nowIso(),
    previousRaw, nextRecordChecksum: checksum(serialized)
  };
  if (!safeSet(JOURNAL_KEY, JSON.stringify(journal))) return false;
  try {
    if (!safeSet(tempKey(slotId), serialized) || !isDecodable(safeGet(tempKey(slotId)))) throw new Error('Temporary save verification failed');
    if (!options.skipBackup) rotateBackups(slotId, previousRaw);
    if (!safeSet(primaryKey, serialized)) throw new Error('Primary save write failed');
    const verified = decodeRaw(safeGet(primaryKey)).save;
    if (!verified) throw new Error('Primary save verification failed');
    const index = loadIndexRaw();
    index.activeSlotId = slotId;
    index.slots[slotId] = metadataFromSave(verified);
    saveIndex(index);
    safeRemove(tempKey(slotId)); safeRemove(JOURNAL_KEY);
    if (save && typeof save === 'object') Object.assign(save, verified);
    return true;
  } catch (error) {
    console.warn('[SaveV3] Transaction rolled back', error);
    if (previousRaw && isDecodable(previousRaw)) safeSet(primaryKey, previousRaw); else safeRemove(primaryKey);
    safeRemove(tempKey(slotId)); safeRemove(JOURNAL_KEY);
    return false;
  }
}

function migrateLegacyIfNeeded() {
  if (safeGet(MIGRATION_MARKER_KEY) === '1') return false;
  const index = loadIndexRaw();
  const hasAnyV3 = PROFILE_SLOTS.some((id) => isDecodable(safeGet(slotKey(id))));
  if (hasAnyV3) { safeSet(MIGRATION_MARKER_KEY, '1'); return false; }
  const candidates = [safeGet(LEGACY_SAVE_KEY), safeGet(LEGACY_BACKUP_KEY)];
  for (const raw of candidates) {
    try {
      const decoded = decodeRaw(raw);
      if (!decoded.save) continue;
      decoded.save.meta.profileId = 'slot-1';
      if (commitSlot('slot-1', decoded.save, { skipBackup: true })) {
        safeSet(`${STORAGE_PREFIX}.legacyArchive`, raw);
        safeSet(MIGRATION_MARKER_KEY, '1');
        const migratedIndex = loadIndexRaw();
        migratedIndex.activeSlotId = 'slot-1';
        saveIndex(migratedIndex);
        return true;
      }
    } catch {}
  }
  saveIndex(index);
  safeSet(MIGRATION_MARKER_KEY, '1');
  return false;
}

export function initializeSaveSystem() {
  const transactionRecovered = recoverPendingTransaction();
  const migrated = migrateLegacyIfNeeded();
  return { transactionRecovered, migrated };
}

export function getActiveProfileId() { return loadIndexRaw().activeSlotId; }
export function listProfiles() {
  initializeSaveSystem();
  const index = loadIndexRaw();
  return PROFILE_SLOTS.map((id, position) => {
    let metadata = index.slots[id];
    const raw = safeGet(slotKey(id));
    if (raw && isDecodable(raw)) {
      try { metadata = metadataFromSave(decodeRaw(raw).save); } catch {}
    } else metadata = null;
    return { id, number: position + 1, active: index.activeSlotId === id, occupied: Boolean(metadata), metadata };
  });
}

export function selectProfile(slotId) {
  if (!validSlot(slotId)) return null;
  const index = loadIndexRaw(); index.activeSlotId = slotId; saveIndex(index);
  return loadSave({ slotId });
}

export function loadSave(options = {}) {
  const init = initializeSaveSystem();
  const slotId = validSlot(options.slotId) ? options.slotId : getActiveProfileId();
  lastLoadDiagnostics = {
    source: 'none', recovered: false, migrated: init.migrated,
    transactionRecovered: init.transactionRecovered, slotId, error: null
  };
  const candidates = [
    { source: 'primary', raw: safeGet(slotKey(slotId)) },
    ...Array.from({ length: BACKUP_COUNT }, (_, index) => ({ source: `backup-${index + 1}`, raw: safeGet(backupKey(slotId, index + 1)) }))
  ];
  for (const candidate of candidates) {
    try {
      const decoded = decodeRaw(candidate.raw);
      if (!decoded.save) continue;
      decoded.save.meta.profileId = slotId;
      const recovered = candidate.source !== 'primary';
      lastLoadDiagnostics = {
        ...lastLoadDiagnostics, source: candidate.source, recovered,
        migrated: lastLoadDiagnostics.migrated || decoded.migrated
      };
      if (recovered || decoded.migrated) commitSlot(slotId, decoded.save, { skipBackup: true });
      return decoded.save;
    } catch (error) {
      lastLoadDiagnostics.error = `${lastLoadDiagnostics.error || ''} ${candidate.source}: ${error.message}`.trim();
    }
  }
  return null;
}

export function saveGame(save, options = {}) {
  const slotId = validSlot(options.slotId) ? options.slotId : getActiveProfileId();
  return commitSlot(slotId, save, options);
}

export function clearProfile(slotId = getActiveProfileId()) {
  if (!validSlot(slotId)) return false;
  [slotKey(slotId), tempKey(slotId), operationKey(slotId), ...Array.from({ length: BACKUP_COUNT }, (_, i) => backupKey(slotId, i + 1))].forEach(safeRemove);
  const index = loadIndexRaw(); index.slots[slotId] = null; saveIndex(index); return true;
}
export function clearSave() { return clearProfile(getActiveProfileId()); }

export function restoreLatestBackup(slotId = getActiveProfileId()) {
  for (let revision = 1; revision <= BACKUP_COUNT; revision += 1) {
    const raw = safeGet(backupKey(slotId, revision));
    try {
      const decoded = decodeRaw(raw);
      if (decoded.save && commitSlot(slotId, decoded.save, { skipBackup: true })) return decoded.save;
    } catch {}
  }
  return null;
}

function operationEnvelope(slotId, operation) {
  const clean = {
    missionId: normalizeStringId(operation?.missionId, '') || null,
    savedAt: nowIso(), buildVersion: BUILD_INFO.version,
    saveRevision: Math.floor(clampNumber(operation?.saveRevision, 0, 999999999, 0)),
    snapshot: operation?.snapshot && typeof operation.snapshot === 'object' ? deepClone(operation.snapshot) : null
  };
  if (!clean.missionId || !clean.snapshot) throw new Error('Invalid operation autosave');
  const payload = JSON.stringify(clean);
  return { format: 'SCWW2_OPERATION_AUTOSAVE', version: 1, slotId, checksum: checksum(payload), data: clean };
}
export function saveOperationAutosave(operation, slotId = getActiveProfileId()) {
  if (!validSlot(slotId)) return false;
  try { return safeSet(operationKey(slotId), JSON.stringify(operationEnvelope(slotId, operation))); }
  catch { return false; }
}
export function loadOperationAutosave(slotId = getActiveProfileId()) {
  try {
    const parsed = JSON.parse(safeGet(operationKey(slotId)) || 'null');
    if (!parsed?.data || parsed.format !== 'SCWW2_OPERATION_AUTOSAVE') return null;
    if (checksum(JSON.stringify(parsed.data)) !== parsed.checksum) throw new Error('Operation checksum mismatch');
    return deepClone(parsed.data);
  } catch (error) { console.warn('[SaveV3] Invalid operation autosave', error); safeRemove(operationKey(slotId)); return null; }
}
export function clearOperationAutosave(slotId = getActiveProfileId()) { safeRemove(operationKey(slotId)); }

export function exportProfile(slotId = getActiveProfileId()) {
  const save = loadSave({ slotId });
  if (!save) throw new Error('Profile is empty');
  const data = { save: deepClone(save), sourceSlotId: slotId };
  const payload = JSON.stringify(data);
  return JSON.stringify({
    format: 'SCWW2_SAVE_ARCHIVE', formatVersion: 1, exportedAt: nowIso(),
    buildVersion: BUILD_INFO.version, checksum: checksum(payload), data
  }, null, 2);
}

export function importProfile(serialized, slotId = getActiveProfileId()) {
  if (!validSlot(slotId)) throw new Error('Invalid destination profile');
  const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
  let candidate = parsed;
  if (parsed?.format === 'SCWW2_SAVE_ARCHIVE') {
    if (checksum(JSON.stringify(parsed.data)) !== parsed.checksum) throw new Error('Archive checksum mismatch');
    candidate = parsed.data?.save;
  } else if (parsed?.data && parsed?.checksum) {
    candidate = decodeRaw(JSON.stringify(parsed)).save;
  }
  const save = migrateSave(candidate);
  if (!save) throw new Error('Unsupported save file');
  save.meta.profileId = slotId;
  if (!commitSlot(slotId, save)) throw new Error('Import transaction failed');
  clearOperationAutosave(slotId);
  return loadSave({ slotId });
}

function sanitizeSettings(settings = {}) {
  const language = ['pt-BR', 'en', 'es'].includes(settings.language) ? settings.language : 'pt-BR';
  const graphics = ['low', 'medium', 'high'].includes(settings.graphics) ? settings.graphics : 'high';
  const difficulty = ['cadet', 'officer', 'simulator', 'hardcore'].includes(settings.difficulty) ? settings.difficulty : 'officer';
  return {
    language, music: Math.round(clampNumber(settings.music, 0, 100, 70)),
    sound: Math.round(clampNumber(settings.sound, 0, 100, 80)), graphics, difficulty,
    vibration: settings.vibration !== false,
    tutorials: settings.tutorials !== false,
    contextualHelp: settings.contextualHelp !== false
  };
}
export function loadSettings() { try { const raw = safeGet(SETTINGS_KEY); return raw ? sanitizeSettings(JSON.parse(raw)) : null; } catch { return null; } }
export function saveSettings(settings) { return safeSet(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings))); }
export function getSaveDiagnostics() { return { ...lastLoadDiagnostics }; }

export function createInitialSave({ commander, starterSubmarineId, credits }) {
  const timestamp = nowIso();
  return migrateSave({
    commander,
    progression: { level: 1, xp: 0, credits, completedMissions: [], campaignObjectiveRewards: [], missionReports: [], bestScore: 0 },
    submarine: {
      currentId: starterSubmarineId, unlockedIds: [starterSubmarineId], upgrades: [], hull: 100,
      systems: { engines: 100, sonar: 100, periscope: 100, weapons: 100 }
    },
    crew: { hiredIds: [] }, economy: { totalEarned: credits, totalSpent: 0 },
    career: sanitizeCareer({}),
    logistics: sanitizeLogistics({}, commander.nationId),
    strategy: sanitizeStrategy({}, commander.nationId),
    meta: { createdAt: timestamp, updatedAt: timestamp, schemaVersion: SAVE_SCHEMA_VERSION, revision: 0, profileId: getActiveProfileId() }
  });
}
