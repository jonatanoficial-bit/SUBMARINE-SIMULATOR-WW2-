import test from 'node:test';
import assert from 'node:assert/strict';

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

function commander(name, nationId = 'de') {
  return { name, nationId, avatar: `assets/avatars/${nationId}/captain_01.png`, createdBuild: 'test' };
}
function initial(name, nationId = 'de') {
  return saveModule.createInitialSave({ commander: commander(name, nationId), starterSubmarineId: nationId === 'de' ? 'type_vii_c' : nationId === 'uk' ? 't_class' : 'gato_class', credits: 5000 });
}

test.beforeEach(() => localStorage.clear());

test('legacy save migrates once into slot 1', () => {
  localStorage.setItem('valeGames.submarineCommander.save', JSON.stringify(initial('Legacy Captain')));
  const profiles = saveModule.listProfiles();
  assert.equal(profiles[0].occupied, true);
  assert.equal(saveModule.loadSave({ slotId: 'slot-1' }).commander.name, 'Legacy Captain');
  saveModule.clearProfile('slot-1');
  assert.equal(saveModule.listProfiles()[0].occupied, false, 'deleted profile must not remigrate from archived legacy data');
});

test('three profile slots remain independent', () => {
  saveModule.listProfiles();
  saveModule.selectProfile('slot-1');
  const alpha = initial('Alpha');
  assert.equal(saveModule.saveGame(alpha), true);
  saveModule.selectProfile('slot-2');
  const bravo = initial('Bravo', 'uk');
  bravo.progression.level = 7;
  assert.equal(saveModule.saveGame(bravo), true);
  assert.equal(saveModule.loadSave({ slotId: 'slot-1' }).commander.name, 'Alpha');
  assert.equal(saveModule.loadSave({ slotId: 'slot-2' }).commander.name, 'Bravo');
  assert.equal(saveModule.listProfiles().filter((item) => item.occupied).length, 2);
});

test('corrupted primary recovers from rotating backup', () => {
  saveModule.listProfiles(); saveModule.selectProfile('slot-1');
  const save = initial('Backup Captain');
  save.progression.credits = 1000; saveModule.saveGame(save);
  save.progression.credits = 2000; saveModule.saveGame(save);
  save.progression.credits = 3000; saveModule.saveGame(save);
  localStorage.setItem('valeGames.submarineCommander.v3.slot-1.primary', '{corrupt');
  const recovered = saveModule.loadSave({ slotId: 'slot-1' });
  assert.equal(recovered.progression.credits, 2000);
  assert.equal(saveModule.getSaveDiagnostics().recovered, true);
  assert.equal(saveModule.getSaveDiagnostics().source, 'backup-1');
});

test('export and import validate archive checksum', () => {
  saveModule.listProfiles(); saveModule.selectProfile('slot-1'); saveModule.saveGame(initial('Exporter'));
  const archive = saveModule.exportProfile('slot-1');
  const imported = saveModule.importProfile(archive, 'slot-3');
  assert.equal(imported.commander.name, 'Exporter');
  const tampered = JSON.parse(archive);
  tampered.data.save.commander.name = 'Tampered';
  assert.throws(() => saveModule.importProfile(JSON.stringify(tampered), 'slot-2'), /checksum/i);
});

test('operation autosave preserves tactical snapshot and rejects corruption', () => {
  saveModule.listProfiles(); saveModule.selectProfile('slot-1'); saveModule.saveGame(initial('Operator'));
  const snapshot = { missionId: 'mission_01', depth: 88, speed: 'slow', hull: 72, systems: { engines: 60 }, worldTime: 44 };
  assert.equal(saveModule.saveOperationAutosave({ missionId: 'mission_01', snapshot, saveRevision: 1 }), true);
  assert.equal(saveModule.loadOperationAutosave().snapshot.depth, 88);
  localStorage.setItem('valeGames.submarineCommander.v3.slot-1.operation', '{bad');
  assert.equal(saveModule.loadOperationAutosave(), null);
});

test('pending transaction journal is completed from verified temporary record', () => {
  saveModule.listProfiles(); saveModule.selectProfile('slot-1'); saveModule.saveGame(initial('Journal Captain'));
  const primaryKey = 'valeGames.submarineCommander.v3.slot-1.primary';
  const tempKey = 'valeGames.submarineCommander.v3.slot-1.temp';
  const journalKey = 'valeGames.submarineCommander.v3.transaction';
  const record = localStorage.getItem(primaryKey);
  localStorage.removeItem(primaryKey);
  localStorage.setItem(tempKey, record);
  localStorage.setItem(journalKey, JSON.stringify({ slotId: 'slot-1', previousRaw: null, nextRecordChecksum: saveModule.checksum(record) }));
  const result = saveModule.initializeSaveSystem();
  assert.equal(result.transactionRecovered, true);
  assert.equal(saveModule.loadSave({ slotId: 'slot-1' }).commander.name, 'Journal Captain');
  assert.equal(localStorage.getItem(journalKey), null);
});
