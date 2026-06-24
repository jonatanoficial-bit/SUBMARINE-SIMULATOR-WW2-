import { clamp } from '../engine/simulation/simulationMath.js';

export const SILENT_DEPTH_PERISCOPE_PHASE = Object.freeze({
  id: 'phase24-silent-depth-periscope',
  phase: 24,
  version: '2.0.0-alpha.39',
  axisMode: 'natural-camera',
});

export function normalizePeriscopeDragDelta({ deltaX = 0, deltaY = 0, zoom = 1, input = 'touch' } = {}) {
  const safeZoom = clamp(Number(zoom) || 1, 1, 3);
  const touchMultiplier = input === 'mouse' ? 0.72 : 0.92;
  const horizontal = clamp((Number(deltaX) || 0) * touchMultiplier / safeZoom, -42, 42);
  const vertical = clamp((Number(deltaY) || 0) * (touchMultiplier * 0.56) / safeZoom, -24, 24);
  return {
    dx: horizontal,
    dy: vertical,
    axisMode: SILENT_DEPTH_PERISCOPE_PHASE.axisMode,
    sensitivity: touchMultiplier,
    zoom: safeZoom,
  };
}

export function computeSilentDepthOceanTransform({ view = {}, environment = {}, zoom = 1 } = {}) {
  const safeZoom = clamp(Number(zoom) || 1, 1, 3);
  const viewX = clamp(Number(view.x) || 0, -260, 260);
  const viewY = clamp(Number(view.y) || 0, -88, 88);
  const roll = clamp(Number(environment.rollDegrees) || 0, -18, 18);
  const pitch = clamp(Number(environment.pitchDegrees) || 0, -12, 12);
  const horizonOffset = clamp(Number(environment.horizonOffset) || 0, -36, 36);
  const visualFactor = clamp(Number(environment.visualFactor) || 1, 0.16, 1.12);
  const daylight = clamp(Number(environment.daylight) || 72, 0, 100);
  const rain = clamp(Number(environment.precipitation) || 0, 0, 100);
  const seaState = clamp(Number(environment.seaState) || 0, 0, 100);
  const x = -50 - viewX * 0.055;
  const y = -27 - viewY * 0.058 + horizonOffset * 0.06;
  const parallax = 1 + safeZoom * 0.035 + seaState * 0.0009;
  const brightness = 0.48 + daylight / 175;
  const saturate = 0.7 + visualFactor * 0.34;
  const contrast = 1.1 + rain / 520;
  return {
    x,
    y,
    roll,
    pitch,
    scale: parallax,
    transform: `translate3d(${x.toFixed(2)}%, ${y.toFixed(2)}%, 0) rotate(${(roll * 0.36).toFixed(2)}deg) scale(${parallax.toFixed(3)})`,
    filter: `brightness(${brightness.toFixed(2)}) saturate(${saturate.toFixed(2)}) contrast(${contrast.toFixed(2)})`,
    backgroundPosition: `${(50 + viewX * 0.045).toFixed(2)}% ${(50 + viewY * 0.075 + pitch * 0.18).toFixed(2)}%`,
  };
}

export function classifyPeriscopeMobileReadability({ width = 390, height = 760, dataItems = 8 } = {}) {
  const narrow = Number(width) <= 720;
  const short = Number(height) <= 540;
  const cleanOceanRequired = narrow || short;
  const maxInlineItems = cleanOceanRequired ? 0 : Math.max(4, Math.min(8, Number(dataItems) || 0));
  return {
    cleanOceanRequired,
    hudMode: cleanOceanRequired ? 'clean-ocean' : 'instrumented',
    maxInlineItems,
  };
}
