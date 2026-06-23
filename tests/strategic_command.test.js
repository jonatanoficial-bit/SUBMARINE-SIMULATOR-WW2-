import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const build = readJson('BUILD_INFO.json');
const nations = readJson('data/nations.json');
const strategy = readJson('data/strategy.json');
const translations = ['pt-BR','en','es'].map((lang)=>readJson(`data/translations/${lang}.json`));

class MemoryStorage { constructor(){ this.map=new Map(); } getItem(k){ return this.map.has(k) ? this.map.get(k) : null; } setItem(k,v){ this.map.set(String(k),String(v)); } removeItem(k){ this.map.delete(k); } clear(){ this.map.clear(); } key(i){ return [...this.map.keys()][i] ?? null; } get length(){ return this.map.size; } }
globalThis.localStorage = new MemoryStorage();
const saveModule = await import('../js/save.js');

function commander(nationId='de'){ return { name:`Strategy ${nationId}`, nationId, avatar:`assets/avatars/${nationId}/captain_01.png`, createdBuild:'test' }; }

test.beforeEach(() => localStorage.clear());

test('phase 13 metadata and schema are active', () => {
  assert.equal(build.semver, '2.0.0-alpha.35');
  assert.equal(build.phase, '20');
  assert.equal(build.saveSchemaVersion, 14);
});

test('strategy data covers each campaign nation', () => {
  const nationIds = new Set(nations.map((nation) => nation.id));
  assert.deepEqual(new Set(strategy.theaters.map((item) => item.nationId)), nationIds);
  assert.deepEqual(new Set(strategy.intelNetworks.map((item) => item.nationId)), nationIds);
  for (const nation of nations) {
    assert.ok(strategy.convoyLanes.filter((lane) => lane.nationId === nation.id).length >= 3);
    assert.ok(strategy.theaters.find((theater) => theater.nationId === nation.id).defaultLaneId);
  }
  assert.ok(strategy.directives.length >= 4);
});

test('new saves include strategy block without breaking career and logistics', () => {
  const save = saveModule.createInitialSave({ commander: commander('us'), starterSubmarineId: 'gato_class', credits: 7000 });
  assert.equal(save.meta.schemaVersion, 14);
  assert.equal(save.commander.nationId, 'us');
  assert.ok(save.logistics.fuel > 0);
  assert.equal(save.career.patrols, 0);
  assert.ok(save.strategy.theaterId.includes('us'));
  assert.ok(save.strategy.selectedLaneId);
  assert.equal(save.strategy.directiveId, 'directive_balanced');
  assert.ok(save.strategy.commandPoints >= 2);
});

test('legacy phase 12 save migrates to current schema 10', () => {
  const migrated = saveModule.migrateSave({
    commander: commander('uk'),
    progression: { level: 4, xp: 120, credits: 5000, completedMissions: [], missionReports: [], bestScore: 0 },
    submarine: { currentId: 't_class', unlockedIds: ['t_class'], upgrades: [], hull: 98, systems: { engines: 100, sonar: 100, periscope: 100, weapons: 100 } },
    crew: { hiredIds: [] }, economy: { totalEarned: 5000, totalSpent: 0 },
    career: { patrols: 1, reputation: 30 }, logistics: { fuel: 6000, torpedoes: 12 },
    meta: { schemaVersion: 4, revision: 0 }
  });
  assert.equal(migrated.meta.schemaVersion, 14);
  assert.equal(migrated.strategy.theaterId, 'uk_western_approaches');
  assert.equal(migrated.strategy.selectedLaneId, 'lane_bay_biscay');
});

test('phase 13 translation keys are present in all languages', () => {
  const keys = ['nav.strategy','strategy.title','strategy.convoyLanes','strategy.commandDirectives','strategy.lane.philippineSea','strategy.directive.deception','strategy.network.us','toast.directiveIssued'];
  for (const dictionary of translations) assert.deepEqual(keys.filter((key)=>!dictionary[key]), []);
});
