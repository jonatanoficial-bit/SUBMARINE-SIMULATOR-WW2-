let ctx = null;
let master = null;
let soundLevel = 0.8;
let musicLevel = 0.7;
let ambientOsc = null;
let ambientGain = null;

const MUSIC_PLAYLIST = Object.freeze([
  { id: 'official-theme-01', title: 'Submarine Commander Theme 01', src: 'assets/audio/music/submarine_commander_theme_01.mp3' },
  { id: 'official-theme-02', title: 'Submarine Commander Theme 02', src: 'assets/audio/music/submarine_commander_theme_02.mp3' },
  { id: 'official-theme-03', title: 'Submarine Commander Theme 03', src: 'assets/audio/music/submarine_commander_theme_03.mp3' },
  { id: 'official-theme-04', title: 'Submarine Commander Theme 04', src: 'assets/audio/music/submarine_commander_theme_04.mp3' },
  { id: 'official-theme-05', title: 'Submarine Commander Theme 05', src: 'assets/audio/music/submarine_commander_theme_05.mp3' },
  { id: 'official-theme-06', title: 'Submarine Commander Theme 06', src: 'assets/audio/music/submarine_commander_theme_06.mp3' }
]);
let musicAudio = null;
let musicIndex = 0;
let unlockListenersBound = false;
let soundtrackRequested = false;


function musicVolume() {
  return Math.max(0, Math.min(1, musicLevel)) * 0.55;
}

function browserCanPlayMusic() {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

function ensureMusicElement() {
  if (!browserCanPlayMusic()) return null;
  if (musicAudio) return musicAudio;
  musicAudio = new Audio();
  musicAudio.preload = 'auto';
  musicAudio.loop = false;
  musicAudio.volume = musicVolume();
  musicAudio.addEventListener('ended', () => playNextSoundtrackTrack());
  musicAudio.addEventListener('error', () => playNextSoundtrackTrack());
  return musicAudio;
}

function armPlaybackUnlock() {
  if (unlockListenersBound || typeof window === 'undefined') return;
  unlockListenersBound = true;
  const unlock = () => {
    ensureContext();
    if (soundtrackRequested) startSoundtrackPlaylist();
  };
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((eventName) => {
    window.addEventListener(eventName, unlock, { passive: true });
  });
}

function playCurrentSoundtrackTrack({ reset = false } = {}) {
  const audio = ensureMusicElement();
  if (!audio || musicLevel <= 0 || !MUSIC_PLAYLIST.length) return;
  const track = MUSIC_PLAYLIST[musicIndex % MUSIC_PLAYLIST.length];
  let expected = track.src;
  try {
    expected = new URL(track.src, document?.baseURI || window.location.href || './').href;
  } catch {
    expected = track.src;
  }
  if (audio.src !== expected && audio.src !== track.src) {
    audio.src = track.src;
    audio.load();
  }
  if (reset) audio.currentTime = 0;
  audio.volume = musicVolume();
  const promise = audio.play();
  if (promise?.catch) promise.catch(() => armPlaybackUnlock());
}

function playNextSoundtrackTrack() {
  if (!MUSIC_PLAYLIST.length) return;
  musicIndex = (musicIndex + 1) % MUSIC_PLAYLIST.length;
  playCurrentSoundtrackTrack({ reset: true });
}

export function getSoundtrackPlaylist() {
  return MUSIC_PLAYLIST.map((track, index) => ({ ...track, order: index + 1 }));
}

export function startSoundtrackPlaylist() {
  soundtrackRequested = true;
  if (musicLevel <= 0) {
    if (musicAudio) musicAudio.pause();
    return;
  }
  playCurrentSoundtrackTrack();
  armPlaybackUnlock();
}

function ensureContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function initAudio(settings = {}) {
  soundLevel = (Number(settings.sound ?? 80) || 0) / 100;
  musicLevel = (Number(settings.music ?? 70) || 0) / 100;
  ensureContext();
  startAmbient(settings);
  startSoundtrackPlaylist();
}

export function setAudioLevels(settings = {}) {
  soundLevel = (Number(settings.sound ?? 80) || 0) / 100;
  musicLevel = (Number(settings.music ?? 70) || 0) / 100;
  if (ambientGain) ambientGain.gain.setTargetAtTime(0.015 * musicLevel, ctx?.currentTime || 0, 0.2);
  if (musicAudio) musicAudio.volume = musicVolume();
  if (musicLevel <= 0) musicAudio?.pause();
  else if (soundtrackRequested) startSoundtrackPlaylist();
}

export function startAmbient(settings = {}) {
  const c = ensureContext();
  if (!c || ambientOsc) return;
  ambientGain = c.createGain();
  ambientGain.gain.value = 0.012 * ((Number(settings.music ?? 70) || 0) / 100);
  ambientOsc = c.createOscillator();
  ambientOsc.type = 'sine';
  ambientOsc.frequency.value = 44;
  const tremolo = c.createOscillator();
  const tremoloGain = c.createGain();
  tremolo.frequency.value = 0.18;
  tremoloGain.gain.value = 0.006;
  tremolo.connect(tremoloGain);
  tremoloGain.connect(ambientGain.gain);
  ambientOsc.connect(ambientGain).connect(master);
  ambientOsc.start();
  tremolo.start();
}

function tone(freq, duration = 0.12, type = 'sine', gainValue = 0.08, when = 0) {
  const c = ensureContext();
  if (!c || soundLevel <= 0) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue * soundLevel), t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

function noise(duration = 0.25, gainValue = 0.06, when = 0) {
  const c = ensureContext();
  if (!c || soundLevel <= 0) return;
  const t = c.currentTime + when;
  const buffer = c.createBuffer(1, Math.max(1, c.sampleRate * duration), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 360;
  gain.gain.value = gainValue * soundLevel;
  src.buffer = buffer;
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

export function playSfx(name) {
  ensureContext();
  switch (name) {
    case 'tap': tone(520, 0.035, 'triangle', 0.025); break;
    case 'sonar': tone(880, 0.13, 'sine', 0.045); tone(1320, 0.09, 'sine', 0.018, 0.08); break;
    case 'torpedo': tone(120, 0.22, 'sawtooth', 0.045); tone(190, 0.16, 'triangle', 0.035, 0.06); break;
    case 'hit': noise(0.45, 0.12); tone(70, 0.48, 'sawtooth', 0.08); break;
    case 'miss': noise(0.22, 0.05); tone(260, 0.1, 'triangle', 0.02); break;
    case 'damage': noise(0.25, 0.08); tone(92, 0.24, 'square', 0.04); break;
    case 'success': tone(520, 0.12, 'triangle', 0.035); tone(720, 0.14, 'triangle', 0.035, 0.12); break;
    case 'alert': tone(300, 0.16, 'sawtooth', 0.045); tone(300, 0.16, 'sawtooth', 0.045, 0.22); break;
    case 'hydrophoneMerchant': tone(74, 0.16, 'triangle', 0.025); tone(74, 0.12, 'triangle', 0.018, 0.32); tone(74, 0.1, 'triangle', 0.014, 0.64); break;
    case 'hydrophoneEscort': tone(118, 0.08, 'square', 0.024); tone(118, 0.08, 'square', 0.021, 0.18); tone(118, 0.08, 'square', 0.018, 0.36); tone(164, 0.06, 'triangle', 0.012, 0.54); break;
    case 'hydrophoneUnknown': noise(0.42, 0.018); tone(92, 0.18, 'sine', 0.014, 0.08); break;
    default: tone(440, 0.05, 'sine', 0.02);
  }
}


export function updateOperationalAmbience(snapshot = {}) {
  const c = ensureContext();
  if (!c || !ambientOsc || !ambientGain) return;
  const environment = snapshot.environment || {};
  const physics = snapshot.physics || {};
  const seaState = Math.max(0, Math.min(6, Number(environment.seaState) || 0));
  const depth = Math.max(0, Number(snapshot.depth) || 0);
  const noiseLevel = Math.max(0, Math.min(100, Number(physics.noise) || 0));
  const targetFrequency = 38 + seaState * 1.8 + Math.min(10, depth / 28);
  const targetGain = (0.008 + seaState * 0.0012 + noiseLevel * 0.000045) * musicLevel;
  ambientOsc.frequency.setTargetAtTime(targetFrequency, c.currentTime, 0.45);
  ambientGain.gain.setTargetAtTime(targetGain, c.currentTime, 0.55);
}
