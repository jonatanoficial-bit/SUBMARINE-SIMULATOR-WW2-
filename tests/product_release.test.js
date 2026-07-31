import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.normalize(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = (file) => JSON.parse(read(file));

test('commercial release metadata is synchronized', () => {
  const build = readJson('BUILD_INFO.json');
  const pkg = readJson('package.json');
  const manifest = readJson('manifest.json');
  assert.equal(build.version, '2.0.0');
  assert.equal(build.channel, 'stable');
  assert.equal(build.release, true);
  assert.equal(pkg.version, build.version);
  assert.equal(manifest.version, build.version);
  assert.equal(manifest.display, 'fullscreen');
  assert.equal(manifest.orientation, 'landscape');
});

test('public interface omits internal build and QA labels', () => {
  const menu = read('js/screens/mainMenu.js');
  const ui = read('js/components/ui.js');
  assert.doesNotMatch(menu, /QA PASS|ALPHA|F54/);
  assert.doesNotMatch(ui, /phaseName|qaStatus|buildId/);
});

test('gameplay exposes pause and requests mobile fullscreen landscape on entry', () => {
  const app = read('js/app.js');
  const gameplay = read('js/screens/gameplay.js');
  assert.match(app, /shouldAutoFullscreenMobile/);
  assert.match(app, /if \(shouldAutoFullscreenMobile\(\)\) await requestImmersiveMode\(\{ preferLandscape: true \}\)/);
  assert.match(gameplay, /engine\.pause\(\)/);
  assert.match(gameplay, /engine\.resume\(\)/);
  assert.match(gameplay, /visibilitychange/);
  assert.match(gameplay, /id="gameplay-pause-button"/);
});

test('mobile product polish and progressive disclosure ship in the offline shell', () => {
  const index = read('index.html');
  const sw = read('service-worker.js');
  const polish = read('css/product-polish.css');
  assert.match(index, /css\/product-polish\.css/);
  assert.match(sw, /css\/product-polish\.css/);
  assert.match(polish, /\.progressive-section/);
  assert.match(polish, /min-height:\s*44px/);
  assert.match(polish, /prefers-reduced-motion/);
});
