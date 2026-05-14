let ctx = null;
let master = null;
let soundLevel = 0.8;
let musicLevel = 0.7;
let ambientOsc = null;
let ambientGain = null;

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
}

export function setAudioLevels(settings = {}) {
  soundLevel = (Number(settings.sound ?? 80) || 0) / 100;
  musicLevel = (Number(settings.music ?? 70) || 0) / 100;
  if (ambientGain) ambientGain.gain.setTargetAtTime(0.015 * musicLevel, ctx?.currentTime || 0, 0.2);
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
    default: tone(440, 0.05, 'sine', 0.02);
  }
}
