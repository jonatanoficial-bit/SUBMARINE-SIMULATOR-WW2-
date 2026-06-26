import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const logistics = readJson('data/logistics.json');
const nations = readJson('data/nations.json');
const translations = ['pt-BR','en','es'].map((lang)=>readJson(`data/translations/${lang}.json`));
const build = readJson('BUILD_INFO.json');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
  clear() { this.map.clear(); }
  key(index) { return [...this.map.keys()][index] ?? null; }
  get length() { return this.map.size; }
}

globalThis.localStorage = new MemoryStorage();
const saveModule = await import('../js/save.js');

function commander(nationId = 'de') {
  return { name: `Logistics ${nationId}`, nationId, avatar: `assets/avatars/${nationId}/captain_01.png`, createdBuild: 'test' };
}

test.beforeEach(() => localStorage.clear());

test('phase 12 career/logistics systems remain active in current build', () => {
  assert.equal(build.semver, '2.0.0-alpha.58');
  assert.equal(build.phase, '43');
  assert.equal(build.saveSchemaVersion, 37);
});

test('logistics data covers all independent campaign nations', () => {
  assert.deepEqual(new Set(logistics.bases.map((base) => base.nationId)), new Set(nations.map((nation) => nation.id)));
  assert.ok(logistics.planningProfiles.length >= 4);
  for (const nation of nations) assert.ok(logistics.ranks[nation.id].length >= 4);
});

test('new saves include career and logistics blocks without breaking profile slots', () => {
  const save = saveModule.createInitialSave({ commander: commander('uk'), starterSubmarineId: 't_class', credits: 5000 });
  assert.equal(save.meta.schemaVersion, 37);
  assert.equal(save.career.rankIndex, 0);
  assert.equal(save.career.patrols, 0);
  assert.ok(save.logistics.fuel > 0);
  assert.ok(save.logistics.torpedoes > 0);
  assert.equal(saveModule.saveGame(save), true);
  const loaded = saveModule.loadSave({ slotId: 'slot-1' });
  assert.equal(loaded.commander.nationId, 'uk');
  assert.ok(loaded.logistics.rations > 0);
});

test('legacy phase 11 save migrates with career/logistics into current schema', () => {
  const legacy = {
    commander: commander('us'),
    progression: { level: 3, xp: 20, credits: 6000, completedMissions: ['us1'], missionReports: [], bestScore: 0 },
    submarine: { currentId: 'gato_class', unlockedIds: ['gato_class'], upgrades: [], hull: 91, systems: { engines: 100, sonar: 90, periscope: 100, weapons: 100 } },
    crew: { hiredIds: [] },
    economy: { totalEarned: 6000, totalSpent: 0 },
    meta: { schemaVersion: 3, revision: 0 }
  };
  const migrated = saveModule.migrateSave(legacy);
  assert.equal(migrated.meta.schemaVersion, 37);
  assert.equal(migrated.career.reputation, 0);
  assert.ok(migrated.logistics.spareParts > 0);
});

test('phase 12 translation keys are present in all languages', () => {
  const keys = [
    'nav.career','career.title','career.serviceRecord','logistics.sortiePlanning','logistics.plan.aggressive',
    'logistics.readyHigh','toast.patrolPlanned','medal.firstPatrol','rank.de.3','rank.uk.3','rank.us.3'
  ];
  for (const dictionary of translations) {
    const missing = keys.filter((key) => !dictionary[key]);
    assert.deepEqual(missing, []);
  }
});
