import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const build = JSON.parse(read('BUILD_INFO.json'));
const packageJson = JSON.parse(read('package.json'));
const css = read('css/phase20-mobile-scroll.css');
const index = read('index.html');
const sw = read('service-worker.js');

test('phase 20 metadata and mobile scroll stylesheet are active', () => {
  assert.equal(build.semver, '2.0.0-alpha.25');
  assert.equal(build.phase, '25');
  assert.equal(packageJson.version, '2.0.0-alpha.25');
  assert.match(index, /phase20-mobile-scroll\.css/);
  assert.match(sw, /phase20-mobile-scroll\.css/);
});

test('gameplay scroll is returned to natural mobile document flow', () => {
  assert.match(css, /body\[data-screen="gameplay"\]\s*\{[\s\S]*overflow-y:\s*auto !important/);
  assert.match(css, /body\[data-screen="gameplay"\]\s*\.app-shell\s*\{[\s\S]*overflow-y:\s*visible !important/);
  assert.match(css, /touch-action:\s*pan-y pinch-zoom/);
});

test('combat measurement dashboard is not sticky or fixed over content', () => {
  assert.match(css, /\.gameplay-status-panel,[\s\S]*\.station-tabs,[\s\S]*position:\s*relative !important/);
  assert.match(css, /\.gameplay-status-panel\s*\{[\s\S]*display:\s*block !important/);
  assert.doesNotMatch(css, /\.gameplay-status-panel\s*\{[^}]*position:\s*(fixed|sticky)/);
});

test('periscope modal keeps drag isolation while normal page remains scrollable', () => {
  assert.match(css, /\.periscope-modal\s*\{[\s\S]*position:\s*fixed !important/);
  assert.match(css, /#open-periscope\s*\{[\s\S]*position:\s*relative !important/);
});
