import { renderBottomNav, renderStatBar } from '../components/ui.js';

let bridgeTimer = null;
let bridgeMode = 'cruise';
let bridgeTick = 0;

function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}
function pct(value) { return `${clamp(Math.round(value), 0, 100)}%`; }
function signed(value, digits = 0) { return `${value >= 0 ? '+' : ''}${round(value, digits)}`; }

const MODE_PROFILES = {
  surface: { depth: 4, speed: 10.5, batteryDrain: -4, oxygen: 98, noise: 58, trim: 1.6, labelKey: 'bridge.mode.surface' },
  cruise: { depth: 42, speed: 6.2, batteryDrain: 8, oxygen: 89, noise: 35, trim: -1.2, labelKey: 'bridge.mode.cruise' },
  silent: { depth: 82, speed: 2.4, batteryDrain: 5, oxygen: 83, noise: 16, trim: -0.4, labelKey: 'bridge.mode.silent' },
  deep: { depth: 128, speed: 3.1, batteryDrain: 11, oxygen: 75, noise: 24, trim: -3.2, labelKey: 'bridge.mode.deep' },
  emergency: { depth: 178, speed: 7.6, batteryDrain: 18, oxygen: 71, noise: 64, trim: -7.8, labelKey: 'bridge.mode.emergency' }
};

export function createBridgeTelemetry({ save = {}, submarine = {}, readiness = {}, strategicAssessment = {}, mission = {}, mode = 'cruise', tick = 0 } = {}) {
  const profile = MODE_PROFILES[mode] || MODE_PROFILES.cruise;
  const stats = submarine.stats || {};
  const hull = clamp(save.submarine?.hull ?? 100, 0, 100);
  const logistics = save.logistics || {};
  const stealth = clamp(stats.stealth ?? 62, 0, 100);
  const depthRating = clamp(stats.depth ?? 60, 1, 100);
  const safeDepth = Math.round(70 + depthRating * 1.9);
  const crushDepth = Math.round(safeDepth + 58 + depthRating * 0.8);
  const readinessOverall = clamp(readiness.overall ?? logistics.readiness ?? 72, 0, 100);
  const strategicRisk = clamp(strategicAssessment.risk ?? 45, 0, 100);
  const missionDifficulty = { I: 1, II: 2, III: 3, IV: 4, V: 5 }[String(mission.difficulty || 'II').toUpperCase()] || 2;
  const wave = Math.sin(tick / 3.4);
  const smallerWave = Math.cos(tick / 2.2);
  const depth = clamp(profile.depth + wave * (mode === 'surface' ? 1.2 : 3.8) + missionDifficulty * 1.5, 0, crushDepth + 20);
  const speed = clamp(profile.speed + smallerWave * 0.45 + (stats.speed || 50) / 120, 0, 21);
  const pressure = clamp((depth / Math.max(1, crushDepth)) * 100 + (100 - hull) * 0.12, 0, 120);
  const battery = clamp((logistics.readiness ?? readinessOverall) - profile.batteryDrain - tick * 0.06 + stealth * 0.08, 0, 100);
  const oxygen = clamp(profile.oxygen - (depth > 90 ? 4 : 0) - (mode === 'emergency' ? 8 : 0) + Math.min(5, readinessOverall / 20), 0, 100);
  const noise = clamp(profile.noise + speed * 2.2 - stealth * 0.18 + strategicRisk * 0.07 + Math.abs(wave) * 3, 0, 100);
  const ballast = clamp(50 + profile.trim * 3 + wave * 6, 0, 100);
  const trim = clamp(profile.trim + smallerWave * 0.35, -12, 12);
  const detection = clamp(noise * 0.58 + strategicRisk * 0.32 + (depth < 20 ? 18 : 0) - stealth * 0.17, 0, 100);
  let statusKey = 'bridge.status.normal';
  if (pressure > 88 || detection > 78 || oxygen < 38 || battery < 24) statusKey = 'bridge.status.critical';
  else if (pressure > 68 || detection > 56 || oxygen < 58 || battery < 42) statusKey = 'bridge.status.alert';
  const depthZone = depth <= 6 ? 'surface' : depth <= 18 ? 'periscope' : depth <= safeDepth * 0.55 ? 'patrol' : depth <= safeDepth ? 'deep' : depth <= crushDepth ? 'overdepth' : 'collapse';
  const buoyancyState = trim < -0.18 ? 'positive' : trim > 0.18 ? 'negative' : 'neutral';
  const reserveBuoyancy = clamp(100 - ballast - pressure * 0.18 + (depth <= 6 ? 16 : 0), 0, 100);
  const depthMargin = Math.max(0, Math.round(safeDepth - depth));
  return {
    mode, modeLabelKey: profile.labelKey, depth: round(depth), speed: round(speed, 1), pressure: round(pressure), battery: round(battery), oxygen: round(oxygen), noise: round(noise), ballast: round(ballast), trim: round(trim, 1), detection: round(detection), hull: round(hull), safeDepth, crushDepth, readiness: round(readinessOverall), statusKey,
    depthZone, buoyancyState, reserveBuoyancy: round(reserveBuoyancy), depthMargin
  };
}

function gaugeMarkup({ id, label, value, unit = '', danger = false, wide = false }) {
  return `
    <div class="bridge-gauge ${danger ? 'danger' : ''} ${wide ? 'wide' : ''}" data-gauge="${id}">
      <div class="bridge-gauge-label">${label}</div>
      <div class="bridge-digital"><span data-readout="${id}">${value}</span><small>${unit}</small></div>
      <div class="bridge-led-track"><span data-fill="${id}" style="width:${pct(value)}"></span></div>
    </div>`;
}

function dialMarkup({ id, label, value, unit = '', max = 100, danger = false }) {
  const angle = -130 + clamp(value / max, 0, 1) * 260;
  return `
    <div class="bridge-dial ${danger ? 'danger' : ''}" data-dial="${id}">
      <div class="bridge-dial-face">
        <span class="tick t0"></span><span class="tick t1"></span><span class="tick t2"></span><span class="tick t3"></span><span class="tick t4"></span>
        <span class="needle" data-needle="${id}" style="transform:rotate(${angle}deg)"></span>
        <span class="hub"></span>
      </div>
      <div class="bridge-dial-meta"><strong data-readout="${id}">${value}</strong><small>${unit}</small><span>${label}</span></div>
    </div>`;
}

function stationCardMarkup(t, { icon, labelKey, statusKey }) {
  return `
    <div class="command-room-card">
      <img src="${icon}" alt="" class="command-room-icon">
      <div class="command-room-meta">
        <span>${t(labelKey)}</span>
        <strong>${t(statusKey)}</strong>
      </div>
    </div>`;
}

export function renderBridge(t, save, nation, submarine, mission, readiness, strategicAssessment) {
  const telemetry = createBridgeTelemetry({ save, submarine, readiness, strategicAssessment, mission, mode: bridgeMode, tick: bridgeTick });
  const plan = save?.logistics?.activePlan;
  return `
    <section class="screen screen-shell phase14-bridge-screen">
      <div class="screen-header bridge-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('nav.bridge')}</div>
          <div class="screen-subtitle">${t('bridge.subtitle')}</div>
        </div>
        <span class="top-badge bridge-watch-badge">${t(nation.nameKey)} • ${submarine.name}</span>
      </div>

      <div class="bridge-shell" data-bridge-root>
        <div class="bridge-canopy">
          <div class="bridge-red-light"></div>
          <div class="bridge-window-grid"><span></span><span></span><span></span></div>
          <div class="bridge-status-line">
            <strong data-readout="status">${t(telemetry.statusKey)}</strong>
            <span>${t('bridge.watchOfficer')}: ${save.commander.name}</span>
            <span>${t('bridge.activePlan')}: ${plan ? t(`logistics.plan.${plan.profileId}`) : t('bridge.noPlan')}</span>
          </div>
        </div>

        <div class="bridge-console-grid">
          <div class="bridge-primary-panel">
            <div class="bridge-panel-title">${t('bridge.depthStation')}</div>
            <div class="bridge-instruments main-instruments">
              ${dialMarkup({ id: 'depth', label: t('bridge.depth'), value: telemetry.depth, unit: 'm', max: telemetry.crushDepth, danger: telemetry.pressure > 75 })}
              ${dialMarkup({ id: 'speed', label: t('bridge.speed'), value: telemetry.speed, unit: t('bridge.knots'), max: 22 })}
              ${dialMarkup({ id: 'pressure', label: t('bridge.hullPressure'), value: telemetry.pressure, unit: '%', max: 100, danger: telemetry.pressure > 70 })}
            </div>
            <div class="bridge-depth-strip">
              <span>${t('bridge.safeDepth')}: <strong data-readout="safeDepth">${telemetry.safeDepth}</strong> m</span>
              <span>${t('bridge.crushDepth')}: <strong data-readout="crushDepth">${telemetry.crushDepth}</strong> m</span>
              <span>${t('bridge.trim')}: <strong data-readout="trim">${signed(telemetry.trim, 1)}</strong>°</span>
            </div>
            <div class="phase16-depth-envelope" data-depth-zone="${telemetry.depthZone}">
              <div><span>${t('physics.depthZone')}</span><strong data-readout="depthZone">${t(`physics.zone.${telemetry.depthZone}`)}</strong></div>
              <div><span>${t('physics.reserveBuoyancy')}</span><strong data-readout="reserveBuoyancy">${telemetry.reserveBuoyancy}%</strong></div>
              <div><span>${t('physics.buoyancyState')}</span><strong data-readout="buoyancyState">${t(`physics.buoyancy.${telemetry.buoyancyState}`)}</strong></div>
              <div><span>${t('physics.depthMargin')}</span><strong data-readout="depthMargin">${telemetry.depthMargin} m</strong></div>
            </div>
          </div>

          <div class="bridge-secondary-panel">
            <div class="bridge-panel-title">${t('bridge.lifeSupport')}</div>
            <div class="bridge-gauge-grid">
              ${gaugeMarkup({ id: 'oxygen', label: t('bridge.oxygen'), value: telemetry.oxygen, unit: '%', danger: telemetry.oxygen < 45 })}
              ${gaugeMarkup({ id: 'battery', label: t('bridge.battery'), value: telemetry.battery, unit: '%', danger: telemetry.battery < 35 })}
              ${gaugeMarkup({ id: 'noise', label: t('bridge.noise'), value: telemetry.noise, unit: '%', danger: telemetry.noise > 65 })}
              ${gaugeMarkup({ id: 'detection', label: t('bridge.detection'), value: telemetry.detection, unit: '%', danger: telemetry.detection > 65 })}
              ${gaugeMarkup({ id: 'ballast', label: t('bridge.ballast'), value: telemetry.ballast, unit: '%' })}
              ${gaugeMarkup({ id: 'hull', label: t('bridge.hull'), value: telemetry.hull, unit: '%', danger: telemetry.hull < 55 })}
            </div>
          </div>
        </div>

        <div class="bridge-command-row">
          ${Object.keys(MODE_PROFILES).map((mode) => `
            <button class="bridge-command ${mode === telemetry.mode ? 'active' : ''}" type="button" data-bridge-command="${mode}">
              <span>${t(MODE_PROFILES[mode].labelKey)}</span>
              <small>${t(`bridge.command.${mode}`)}</small>
            </button>
          `).join('')}
        </div>

        <div class="bridge-command-room-strip">
          <div class="bridge-panel-title">${t('bridge.commandRoom')}</div>
          <div class="command-room-grid">
            ${stationCardMarkup(t, { icon: 'assets/ui/instruments/helm_icon.png', labelKey: 'stabilization.stationCommand', statusKey: 'bridge.station.manned' })}
            ${stationCardMarkup(t, { icon: 'assets/ui/instruments/sonar_icon.png', labelKey: 'stabilization.stationSensors', statusKey: 'bridge.station.monitoring' })}
            ${stationCardMarkup(t, { icon: 'assets/ui/instruments/periscope_icon.png', labelKey: 'bridge.station.periscope', statusKey: 'bridge.station.standby' })}
            ${stationCardMarkup(t, { icon: 'assets/ui/instruments/torpedo_icon.png', labelKey: 'stabilization.stationWeapons', statusKey: 'bridge.station.armed' })}
            ${stationCardMarkup(t, { icon: 'assets/ui/instruments/speed_telegraph_icon.png', labelKey: 'bridge.station.engines', statusKey: 'bridge.station.nominal' })}
          </div>
        </div>

        <div class="bridge-bottom-grid">
          <div class="panel bridge-note-panel">
            <div class="panel-header">${t('bridge.operationalReadout')}</div>
            <div class="panel-body stack">
              <div class="stat-strip">
                <div class="stat-box"><div class="stat-label">${t('bridge.readiness')}</div><div class="stat-value" data-readout="readiness">${telemetry.readiness}%</div></div>
                <div class="stat-box"><div class="stat-label">${t('bridge.mode')}</div><div class="stat-value small" data-readout="modeLabel">${t(telemetry.modeLabelKey)}</div></div>
                <div class="stat-box"><div class="stat-label">${t('bridge.mission')}</div><div class="stat-value small">${t(mission.titleKey)}</div></div>
              </div>
              ${renderStatBar(telemetry.readiness)}
              <div class="bridge-simulation-note">${t('bridge.simulationNote')}</div>
            </div>
          </div>
          <div class="panel bridge-note-panel">
            <div class="panel-header">${t('bridge.mobileImmersion')}</div>
            <div class="panel-body stack">
              <div class="bridge-phone-frame">
                <span>${t('bridge.mobileLine1')}</span>
                <strong>${t('bridge.mobileLine2')}</strong>
                <span>${t('bridge.mobileLine3')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${renderBottomNav('bridge', t)}
    </section>
  `;
}

function writeText(root, id, value) {
  const el = root.querySelector(`[data-readout="${id}"]`);
  if (el) el.textContent = value;
}
function writeFill(root, id, value) {
  const el = root.querySelector(`[data-fill="${id}"]`);
  if (el) el.style.width = pct(value);
}
function writeNeedle(root, id, value, max) {
  const el = root.querySelector(`[data-needle="${id}"]`);
  if (el) el.style.transform = `rotate(${-130 + clamp(value / max, 0, 1) * 260}deg)`;
}

export function mountBridge({ app, t, save, nation, submarine, mission, readiness, strategicAssessment }) {
  const root = app.querySelector('[data-bridge-root]');
  if (!root) return;
  const update = () => {
    bridgeTick += 1;
    const telemetry = createBridgeTelemetry({ save, submarine, readiness, strategicAssessment, mission, mode: bridgeMode, tick: bridgeTick });
    root.dataset.bridgeStatus = telemetry.statusKey.includes('critical') ? 'critical' : telemetry.statusKey.includes('alert') ? 'alert' : 'normal';
    writeText(root, 'status', t(telemetry.statusKey));
    writeText(root, 'depth', telemetry.depth);
    writeText(root, 'speed', telemetry.speed);
    writeText(root, 'pressure', telemetry.pressure);
    writeText(root, 'safeDepth', telemetry.safeDepth);
    writeText(root, 'crushDepth', telemetry.crushDepth);
    writeText(root, 'trim', `${signed(telemetry.trim, 1)}`);
    writeText(root, 'depthZone', t(`physics.zone.${telemetry.depthZone}`));
    writeText(root, 'reserveBuoyancy', `${telemetry.reserveBuoyancy}%`);
    writeText(root, 'buoyancyState', t(`physics.buoyancy.${telemetry.buoyancyState}`));
    writeText(root, 'depthMargin', `${telemetry.depthMargin} m`);
    const envelope = root.querySelector('.phase16-depth-envelope');
    if (envelope) envelope.dataset.depthZone = telemetry.depthZone;
    ['oxygen','battery','noise','detection','ballast','hull'].forEach((key) => { writeText(root, key, telemetry[key]); writeFill(root, key, telemetry[key]); });
    writeText(root, 'readiness', `${telemetry.readiness}%`);
    writeText(root, 'modeLabel', t(telemetry.modeLabelKey));
    writeNeedle(root, 'depth', telemetry.depth, telemetry.crushDepth);
    writeNeedle(root, 'speed', telemetry.speed, 22);
    writeNeedle(root, 'pressure', telemetry.pressure, 100);
    root.querySelectorAll('[data-bridge-command]').forEach((button) => button.classList.toggle('active', button.dataset.bridgeCommand === bridgeMode));
  };
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-bridge-command]');
    if (!button) return;
    bridgeMode = button.dataset.bridgeCommand || 'cruise';
    update();
  });
  update();
  bridgeTimer = setInterval(update, 950);
}

export function cleanupBridge() {
  if (bridgeTimer) clearInterval(bridgeTimer);
  bridgeTimer = null;
}
