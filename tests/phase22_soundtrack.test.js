import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const build = JSON.parse(fs.readFileSync(path.join(ROOT, 'BUILD_INFO.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const serviceWorker = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
const audioSource = fs.readFileSync(path.join(ROOT, 'js/audio.js'), 'utf8');

test('phase 22 metadata identifies official soundtrack integration', () => {
  assert.equal(build.semver, '2.0.0-alpha.30');
  assert.equal(build.phase, '15');
  assert.equal(pkg.version, '2.0.0-alpha.30');
});

test('official soundtrack playlist includes six sequential mp3 assets', async () => {
  const { getSoundtrackPlaylist } = await import('../js/audio.js');
  const playlist = getSoundtrackPlaylist();
  assert.equal(playlist.length, 6);
  assert.deepEqual(playlist.map((track) => track.order), [1, 2, 3, 4, 5, 6]);
  for (const track of playlist) {
    assert.match(track.src, /^assets\/audio\/music\/submarine_commander_theme_0[1-6]\.mp3$/);
    const assetPath = path.join(ROOT, track.src);
    assert.ok(fs.existsSync(assetPath), `${track.src} missing`);
    assert.ok(fs.statSync(assetPath).size > 1000000, `${track.src} too small`);
  }
});

test('soundtrack advances by ended event and loops through service worker cache', () => {
  for (let index = 1; index <= 6; index += 1) {
    const file = `./assets/audio/music/submarine_commander_theme_0${index}.mp3`;
    assert.ok(serviceWorker.includes(file), `${file} not cached`);
  }
  assert.ok(audioSource.includes("addEventListener('ended', () => playNextSoundtrackTrack())"));
  assert.ok(audioSource.includes('musicIndex = (musicIndex + 1) % MUSIC_PLAYLIST.length'));
  assert.ok(audioSource.includes('startSoundtrackPlaylist();'));
});
