import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { applyDoctrineToPatrolCost, findDoctrineForNation, normalizeDoctrineModifiers, resolveDoctrineStage, summarizeDoctrineImpact } from '../js/systems/campaignDoctrine.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

test('phase 12 metadata and package identify national doctrine build', () => {
  const build = readJson('BUILD_INFO.json');
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(build.semver, '2.0.0-alpha.43');
  assert.equal(build.phase, '28');
  assert.equal(pkg.version, '2.0.0-alpha.43');
  assert.equal(manifest.version, '2.0.0-alpha.43');
});

test('campaign doctrines cover Germany United Kingdom and United States', () => {
  const nations = readJson('data/nations.json');
  const doctrines = readJson('data/campaign_doctrines.json');
  assert.deepEqual(new Set(doctrines.map((item) => item.nationId)), new Set(nations.map((item) => item.id)));
  for (const doctrine of doctrines) {
    assert.ok(doctrine.id.startsWith('doctrine.'));
    assert.equal(doctrine.traitKeys.length, 3);
    assert.equal(doctrine.stages.length, 3);
    const mods = normalizeDoctrineModifiers(doctrine);
    assert.ok(mods.fuelMultiplier >= 0.72 && mods.fuelMultiplier <= 1.35);
    assert.ok(mods.tonnageMultiplier >= 0.75 && mods.tonnageMultiplier <= 1.35);
  }
});

test('doctrine modifiers affect patrol costs and stage progression deterministically', () => {
  const doctrines = readJson('data/campaign_doctrines.json');
  const campaigns = readJson('data/campaigns.json');
  const german = findDoctrineForNation(doctrines, 'de');
  const campaign = campaigns.find((item) => item.nationId === 'de');
  const stage0 = resolveDoctrineStage(german, campaign, []);
  const stage2 = resolveDoctrineStage(german, campaign, ['de1', 'de2', 'de3', 'de4']);
  const stage3 = resolveDoctrineStage(german, campaign, ['de1','de2','de3','de4','de5','de6']);
  assert.equal(stage0.index, 0);
  assert.equal(stage2.index, 1);
  assert.equal(stage3.index, 2);
  const adjusted = applyDoctrineToPatrolCost({ fuel: 1000, torpedoes: 10, deckAmmo: 50, rations: 12, spareParts: 4 }, german);
  assert.equal(adjusted.fuel, 960);
  assert.equal(adjusted.torpedoes, 11);
  const impact = summarizeDoctrineImpact(german);
  assert.equal(impact.tonnagePercent, 12);
  assert.equal(impact.stealthBonus, 7);
});

test('all doctrine translation keys exist in PT EN ES', () => {
  const doctrines = readJson('data/campaign_doctrines.json');
  const required = new Set(['campaign.doctrineDeck.title','campaign.modifier.fuel','campaign.modifier.risk','phase12.tag']);
  for (const doctrine of doctrines) {
    [doctrine.titleKey, doctrine.summaryKey, doctrine.focusKey, doctrine.bonusKey, doctrine.riskKey, ...doctrine.traitKeys].forEach((key) => required.add(key));
    doctrine.stages.forEach((stage) => { required.add(stage.titleKey); required.add(stage.descKey); });
  }
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    const missing = [...required].filter((key) => !dictionary[key]);
    assert.deepEqual(missing, [], lang);
  }
});
