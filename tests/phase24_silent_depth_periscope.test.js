import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILD_INFO } from '../js/build.js';
import { classifyPeriscopeMobileReadability, computeSilentDepthOceanTransform, normalizePeriscopeDragDelta, SILENT_DEPTH_PERISCOPE_PHASE } from '../js/systems/silentDepthPeriscope.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const pkg = readJson('package.json');
const translations = ['pt-BR','en','es'].map((lang)=>readJson(`data/translations/${lang}.json`));

test('phase 24 silent depth metadata is active', () => {
  assert.equal(BUILD_INFO.version, 'v2.0.0-alpha.39');
  assert.equal(BUILD_INFO.semver, '2.0.0-alpha.39');
  assert.equal(BUILD_INFO.phase, '24');
  assert.equal(BUILD_INFO.saveSchemaVersion, 18);
  assert.equal(pkg.version, '2.0.0-alpha.39');
  assert.equal(SILENT_DEPTH_PERISCOPE_PHASE.axisMode, 'natural-camera');
});

test('mobile drag axis is natural for camera rotation', () => {
  const rightDown = normalizePeriscopeDragDelta({ deltaX: 28, deltaY: 18, zoom: 1, input: 'touch' });
  const leftUp = normalizePeriscopeDragDelta({ deltaX: -28, deltaY: -18, zoom: 1, input: 'touch' });
  assert.ok(rightDown.dx > 0, 'finger right must rotate the periscope to starboard/right');
  assert.ok(rightDown.dy > 0, 'finger down must pitch the periscope down, not up');
  assert.ok(leftUp.dx < 0, 'finger left must rotate the periscope to port/left');
  assert.ok(leftUp.dy < 0, 'finger up must pitch the periscope up');
});

test('periscope drag sensitivity scales down at high zoom and clamps spikes', () => {
  const zoom1 = normalizePeriscopeDragDelta({ deltaX: 30, deltaY: 20, zoom: 1 });
  const zoom3 = normalizePeriscopeDragDelta({ deltaX: 30, deltaY: 20, zoom: 3 });
  const spike = normalizePeriscopeDragDelta({ deltaX: 1000, deltaY: 1000, zoom: 1 });
  assert.ok(Math.abs(zoom3.dx) < Math.abs(zoom1.dx));
  assert.ok(Math.abs(zoom3.dy) < Math.abs(zoom1.dy));
  assert.equal(spike.dx, 42);
  assert.equal(spike.dy, 24);
});

test('silent depth ocean transform uses cinematic CSS without textual artifacts', () => {
  const transform = computeSilentDepthOceanTransform({
    view: { x: 120, y: -36 },
    environment: { rollDegrees: 6.3, pitchDegrees: -2.4, horizonOffset: 10, daylight: 74, precipitation: 20, visualFactor: 0.72, seaState: 54 },
    zoom: 2,
  });
  assert.match(transform.transform, /translate3d\(/);
  assert.match(transform.transform, /rotate\(/);
  assert.match(transform.transform, /scale\(/);
  assert.match(transform.filter, /brightness\(/);
  assert.ok(!/range|zoom|exposure|qualidade|letras/i.test(JSON.stringify(transform)));
});

test('mobile readability mode hides inline telemetry from the ocean viewport', () => {
  const phone = classifyPeriscopeMobileReadability({ width: 390, height: 780, dataItems: 8 });
  const desktop = classifyPeriscopeMobileReadability({ width: 1280, height: 800, dataItems: 8 });
  assert.equal(phone.hudMode, 'clean-ocean');
  assert.equal(phone.maxInlineItems, 0);
  assert.equal(desktop.hudMode, 'instrumented');
  assert.ok(desktop.maxInlineItems >= 4);
});

test('phase 24 files and translation keys are present', () => {
  for (const relative of ['js/systems/silentDepthPeriscope.js', 'css/phase24-silent-depth-periscope.css', 'tests/phase24_silent_depth_periscope.test.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, relative)), `${relative} missing`);
  }
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  assert.match(index, /phase24-silent-depth-periscope\.css/);
  assert.match(sw, /silentDepthPeriscope\.js/);
  assert.match(sw, /phase24-silent-depth-periscope\.css/);
  for (const dictionary of translations) {
    for (const key of ['periscope.mobileAxisCue', 'phase24.title', 'phase24.summary']) {
      assert.ok(dictionary[key], `${key} missing`);
    }
  }
});
