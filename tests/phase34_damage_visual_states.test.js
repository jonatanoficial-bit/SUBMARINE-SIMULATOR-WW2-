import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { PHASE34_SUBMARINE_DAMAGE_VISUALS, buildSubmarineDamageVisualView, shouldDamageVisualEscalate } from '../js/systems/submarineDamageVisuals.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

function snapshot(overrides = {}) {
  return {
    hull: 100,
    physics: { battery: 80, oxygen: 90 },
    systems: { engines: 100, sonar: 100, periscope: 100, weapons: 100 },
    damageControl: {
      hullIntegrity: 100,
      pressureIngress: 0,
      smokeLoad: 0,
      totalFlooding: 0,
      totalFire: 0,
      criticalCompartments: 0,
      compartmentStability: 100,
      systems: { engines: 100, sonar: 100, periscope: 100, weapons: 100 },
      compartments: [
        { id: 'bowTorpedo', name: 'Proa', integrity: 100, flooding: 0, fire: 0, electricalDamage: 0 },
        { id: 'controlRoom', name: 'Comando', integrity: 100, flooding: 0, fire: 0, electricalDamage: 0 },
        { id: 'engineRoom', name: 'Máquinas', integrity: 100, flooding: 0, fire: 0, electricalDamage: 0 },
      ],
    },
    ...overrides,
  };
}

test('phase 34 metadata and build are active', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.62');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.62');
  assert.equal(BUILD_INFO.phase, '47');
  assert.equal(BUILD_INFO.saveSchemaVersion, 40);
  assert.equal(pkg.version, '2.0.0-alpha.62');
  assert.equal(manifest.version, '2.0.0-alpha.62');
  assert.equal(PHASE34_SUBMARINE_DAMAGE_VISUALS.system, 'submarine-damage-visual-states');
  assert.ok(PHASE34_SUBMARINE_DAMAGE_VISUALS.layers.includes('emergency-lighting'));
});

test('damage visual view classifies stable, damaged and critical states', () => {
  const stable = buildSubmarineDamageVisualView({ snapshot: snapshot() });
  assert.equal(stable.severity, 'stable');
  assert.equal(stable.lights, 'normal');

  const damaged = buildSubmarineDamageVisualView({ snapshot: snapshot({ damageControl: { ...snapshot().damageControl, hullIntegrity: 63, smokeLoad: 28, totalFlooding: 22, compartmentStability: 72 } }) });
  assert.equal(damaged.severity, 'damaged');
  assert.equal(damaged.lights, 'amber');

  const critical = buildSubmarineDamageVisualView({ snapshot: snapshot({ damageControl: { ...snapshot().damageControl, hullIntegrity: 18, pressureIngress: 75, smokeLoad: 80, totalFlooding: 65, totalFire: 45, criticalCompartments: 3, compartmentStability: 20, criticalFailure: true } }) });
  assert.equal(critical.severity, 'critical');
  assert.equal(critical.lights, 'red');
  assert.equal(critical.crewKey, 'damageVisual.crewCritical');
});

test('damage visual view exposes rooms and system severity', () => {
  const view = buildSubmarineDamageVisualView({ snapshot: snapshot({ damageControl: { ...snapshot().damageControl, systems: { engines: 22, sonar: 48, periscope: 75, weapons: 91 }, compartments: [{ id: 'engineRoom', name: 'Máquinas', integrity: 31, flooding: 74, fire: 8, electricalDamage: 50 }] } }) });
  assert.equal(view.systems.engines.state, 'critical');
  assert.equal(view.systems.sonar.state, 'damaged');
  assert.equal(view.compartments[0].state, 'flooded');
  assert.match(view.cssVars['--phase34-damage-score'], /%$/);
});

test('visual escalation triggers on meaningful damage increases', () => {
  const previous = buildSubmarineDamageVisualView({ snapshot: snapshot() });
  const next = buildSubmarineDamageVisualView({ snapshot: snapshot({ damageControl: { ...snapshot().damageControl, hullIntegrity: 40, totalFlooding: 50, smokeLoad: 45, criticalCompartments: 2 } }) });
  assert.equal(shouldDamageVisualEscalate({ previous, next }), true);
});

test('phase 34 assets are wired into gameplay index service worker and smoke harness', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/phase34-damage-visual-states.css');
  const index = readText('index.html');
  const serviceWorker = readText('service-worker.js');
  const smoke = readText('tests/smoke_test.py');
  assert.match(gameplay, /phase34-damage-visual-ready/);
  assert.match(gameplay, /buildSubmarineDamageVisualView/);
  assert.match(gameplay, /phase34-damage-visual/);
  assert.match(css, /phase34-hull-cutaway/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(index, /phase34-damage-visual-states\.css/);
  assert.match(serviceWorker, /submarineDamageVisuals\.js/);
  assert.match(smoke, /phase34-damage-visual-states\.css/);
  assert.match(smoke, /submarineDamageVisuals\.js/);
});

test('translations include damage visual keys in all supported languages', () => {
  for (const language of ['pt-BR', 'en', 'es']) {
    const dictionary = readJson(`data/translations/${language}.json`);
    for (const key of ['damageVisual.kicker', 'damageVisual.severity.critical', 'damageVisual.crewCritical']) {
      assert.ok(key in dictionary, `${language} missing ${key}`);
    }
  }
});
