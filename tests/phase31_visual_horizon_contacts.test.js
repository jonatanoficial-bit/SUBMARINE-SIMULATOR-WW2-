import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE31_VISUAL_HORIZON_CONTACTS, buildHorizonContactView } from '../js/systems/visualHorizonContacts.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('phase 31 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.60');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.60');
  assert.equal(BUILD_INFO.phase, '45');
  assert.equal(BUILD_INFO.saveSchemaVersion, 39);
  assert.equal(pkg.version, '2.0.0-alpha.60');
  assert.equal(manifest.version, '2.0.0-alpha.60');
  assert.equal(PHASE31_VISUAL_HORIZON_CONTACTS.system, 'visual-horizon-contacts');
  assert.ok(PHASE31_VISUAL_HORIZON_CONTACTS.layers.includes('smoke-plumes'));
});

test('horizon view renders visible merchant smoke masts and escort silhouettes', () => {
  const view = buildHorizonContactView({
    periscopeZoom: 1.2,
    snapshot: {
      periscopeOpen: true,
      view: { x: 0, y: -100 },
      target: { x: 80, y: -1400 },
      escort: { x: -60, y: -2100 },
      environment: { visualFactor: 0.82, visibilityMeters: 7000, precipitation: 8, horizonOffset: 1 },
      sensors: {
        profile: { currentVisualRangeMeters: 7600 },
        contacts: {
          target: { detected: true, confidence: 78 },
          escort: { detected: true, confidence: 58 },
        },
      },
    },
  });
  assert.equal(view.phase, '31');
  assert.equal(view.fogBand, 'light');
  assert.ok(view.visibleCount >= 2);
  assert.ok(view.smokeCount >= 1);
  assert.ok(view.mastCount >= 1);
  assert.equal(view.reportKey, 'horizonContacts.reportMultiple');
  assert.ok(view.contacts.every((contact) => contact.style.includes('--h-left')));
});

test('aircraft contact escalates optical report when air patrol is active', () => {
  const view = buildHorizonContactView({
    snapshot: {
      periscopeOpen: true,
      view: { x: 0, y: -100 },
      target: { x: 9000, y: -9000 },
      escort: { x: 9000, y: -9000 },
      environment: { visualFactor: 0.65, visibilityMeters: 5000 },
      sensors: { contacts: {} },
      navalAI: { aircraft: { active: true, state: 'attack', confidence: 76, bearing: 14 } },
    },
  });
  assert.equal(view.priority, 'danger');
  assert.equal(view.reportKey, 'horizonContacts.reportAircraft');
  assert.ok(view.contacts.some((contact) => contact.role === 'aircraft' && contact.visible));
});

test('phase 31 assets are wired into gameplay index service worker and smoke harness', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/phase31-visual-horizon-contacts.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase31-visual-horizon-ready/);
  assert.match(gameplay, /phase31-horizon-contact-layer/);
  assert.match(gameplay, /buildHorizonContactView/);
  assert.match(css, /phase31-horizon-contact/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(index, /phase31-visual-horizon-contacts\.css/);
  assert.match(serviceWorker, /visualHorizonContacts\.js/);
  assert.match(smoke, /phase31-visual-horizon-contacts\.css/);
  assert.match(smoke, /visualHorizonContacts\.js/);
});

test('translations include horizon contact keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['horizonContacts.kicker', 'horizonContacts.reportTarget', 'horizonContacts.reportAircraft', 'horizonContacts.contactEscort']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
