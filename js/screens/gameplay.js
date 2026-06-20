import { playSfx, updateOperationalAmbience } from '../audio.js';
import { SimulationEngine } from '../engine/simulation/SimulationEngine.js';
import { PERISCOPE_MAX_DEPTH, SPEED_ANGLES, SPEEDS, VIEW_STEP_X, VIEW_STEP_Y } from '../engine/simulation/constants.js';
import { clamp, depthToAngle, worldToViewPosition } from '../engine/simulation/simulationMath.js';
import { OperationalTraining } from '../engine/training/OperationalTraining.js';
import { classifyOceanWeather } from '../oceanWeather.js';

let cleanupFns = [];

function speedLabelMarkup(t) {
  const labels = [
    { key: 'flank', left: '14%', top: '40%' },
    { key: 'full', left: '30%', top: '24%' },
    { key: 'half', left: '50%', top: '16%' },
    { key: 'slow', left: '70%', top: '24%' },
    { key: 'stop', left: '86%', top: '40%' },
  ];
  const labelHtml = (value) => String(value).trim().split(/\s+/).join('<br>');
  return labels.map((item) => `<span class="telegraph-label telegraph-label-${item.key}" style="left:${item.left};top:${item.top}">${labelHtml(t(`speed.${item.key}`))}</span>`).join('');
}

function radarGridMarkup() {
  return `
    <div class="radar-ring radar-ring-1"></div>
    <div class="radar-ring radar-ring-2"></div>
    <div class="radar-ring radar-ring-3"></div>
    <div class="radar-cross radar-cross-h"></div>
    <div class="radar-cross radar-cross-v"></div>
  `;
}


function hydrophoneWaterfallMarkup() {
  return Array.from({ length: 26 }, (_, index) => `<i class="hydrophone-waterfall-row" data-waterfall-row="${index}"><span></span><b></b></i>`).join('');
}

function periscopeWeatherMarkup() {
  return Array.from({ length: 14 }, (_, index) => `<i style="--drop:${index}"></i>`).join('');
}

export function createPeriscopeOpticsSolution({ snapshot = {}, periscopeZoom = 1 } = {}) {
  const environment = snapshot.environment || {};
  const physics = snapshot.physics || {};
  const sensors = snapshot.sensors || {};
  const contact = sensors.contacts?.target || {};
  const depth = Number(snapshot.depth ?? physics.depth ?? 0);
  const visualRange = Math.max(700, Number(sensors.profile?.currentVisualRangeMeters || environment.visibilityMeters || 6000));
  const visualFactor = clamp(Number(environment.visualFactor || 1), 0.16, 1.12);
  const target = snapshot.target || {};
  const targetTrueRange = Math.hypot(Number(target.x || 0), Number(target.y || 0)) * 4;
  const periscopeDepth = Number(sensors.profile?.radarMastMaxDepth || 12);
  const depthDelta = Math.abs(depth - periscopeDepth);
  const depthPenalty = depthDelta <= 3 ? 0 : Math.min(38, depthDelta * 3.8);
  const mastWakeRisk = clamp((snapshot.detectionScore || 0) * 0.52 + depthPenalty + (Number(environment.seaState || 0) < 35 ? 8 : 0), 0, 100);
  const rangeError = clamp((1 - visualFactor) * 34 + depthDelta * 2.2 + Math.max(0, targetTrueRange / visualRange - 0.55) * 18, 3, 64);
  const speedError = clamp((1 - visualFactor) * 3.2 + (Number(environment.precipitation || 0) / 100) * 2.5 + depthDelta * 0.16, 0.3, 8.5);
  const opticalQuality = clamp((contact.confidence || 0) * 0.42 + visualFactor * 42 + Number(periscopeZoom || 1) * 6 - depthPenalty, 0, 100);
  let state = 'safe';
  if (mastWakeRisk >= 68 || opticalQuality < 28) state = 'critical';
  else if (mastWakeRisk >= 38 || opticalQuality < 52) state = 'warning';
  return {
    periscopeDepth,
    depthDelta,
    mastWakeRisk: Math.round(mastWakeRisk),
    rangeError: Math.round(rangeError),
    speedError: Math.round(speedError * 10) / 10,
    opticalQuality: Math.round(opticalQuality),
    estimatedRangeMeters: targetTrueRange ? Math.round(targetTrueRange * (1 + (rangeError / 100) * 0.34)) : null,
    estimatedSpeedKnots: contact.speedEstimateKnots ? Math.max(0, Math.round((contact.speedEstimateKnots + speedError * 0.18) * 10) / 10) : null,
    visualRange: Math.round(visualRange),
    state
  };
}



export function createTdcFireControlSolution({ snapshot = {} } = {}) {
  const weapons = snapshot.weapons || {};
  const tdc = weapons.tdc || {};
  const torpedo = weapons.torpedoTypes?.[tdc.torpedoType] || { speedKnots: Number(tdc.torpedoSpeedKnots || 44), maxRangeMeters: 5200, wake: true };
  const quality = clamp(Number(tdc.solutionQuality || 0), 0, 100);
  const range = Math.max(0, Number(tdc.rangeMeters || 0));
  const targetSpeed = Math.max(0, Number(tdc.targetSpeedKnots || 0));
  const torpedoSpeed = Math.max(1, Number(torpedo.speedKnots || tdc.torpedoSpeedKnots || 44));
  const aob = clamp(Number(tdc.aobDegrees || 0), 0, 180);
  const ratio = clamp((targetSpeed / torpedoSpeed) * Math.sin((aob * Math.PI) / 180), -0.95, 0.95);
  const leadAngle = Math.asin(ratio) * 180 / Math.PI;
  const impactSeconds = range > 0 ? Math.round(range / (torpedoSpeed * 0.514444)) : null;
  const gyroAngle = ((Number(tdc.gyroAngle || 0) % 360) + 360) % 360;
  const rangeFactor = range && torpedo.maxRangeMeters ? clamp(range / torpedo.maxRangeMeters, 0, 1.35) : 0;
  const stalePenalty = Math.min(22, Number(tdc.lastContactAgeMs || 0) / 900);
  const wakePenalty = torpedo.wake ? 8 : 2;
  const depthPenalty = Number(snapshot.depth || 0) > Number(weapons.profile?.maxLaunchDepth || 60) ? 45 : 0;
  const fireRisk = clamp(100 - quality + stalePenalty + rangeFactor * 12 + wakePenalty + depthPenalty - (weapons.canFire ? 4 : 0), 0, 100);
  const spread = Math.max(1, Number(weapons.salvoSize || 1));
  const spreadDegrees = spread === 1 ? 0 : Math.round((1.4 + (100 - quality) / 70) * 10) / 10;
  const hitWindowMeters = range ? Math.max(18, Math.round(range * clamp((100 - quality) / 260, 0.04, 0.34))) : null;
  const discipline = !weapons.canFire ? 'hold' : quality >= 78 && fireRisk < 35 ? 'fire' : quality >= weapons.minimumSolutionQuality ? 'wait' : 'hold';
  const state = discipline === 'fire' ? 'safe' : discipline === 'wait' ? 'warning' : 'critical';
  return {
    quality: Math.round(quality),
    leadAngle: Math.round(leadAngle * 10) / 10,
    gyroAngle: Math.round(gyroAngle),
    impactSeconds,
    fireRisk: Math.round(fireRisk),
    spreadDegrees,
    hitWindowMeters,
    targetMotion: targetSpeed >= 12 ? 'fast' : targetSpeed >= 6 ? 'steady' : 'slow',
    salvoPattern: spread === 1 ? 'single' : spread === 2 ? 'paired' : 'fan',
    discipline,
    state
  };
}

function navigationGridMarkup() {
  const vertical = [125, 250, 375, 500, 625, 750, 875].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="560"></line>`).join('');
  const horizontal = [112, 224, 336, 448].map((y) => `<line x1="0" y1="${y}" x2="1000" y2="${y}"></line>`).join('');
  return `${vertical}${horizontal}`;
}

export function renderGameplay(t, mission, settings = {}) {
  return `
    <section class="screen gameplay-screen phase15-command-room-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <button class="button ghost" data-nav="briefing">${t('common.back')}</button>
          <div class="screen-title">${t('gameplay.title')}</div>
          <div class="screen-subtitle">${mission ? t(mission.titleKey) : t('gameplay.subtitle')}</div>
        </div>
        <div class="header-actions gameplay-header-actions">
          <button class="button ghost immersive-button" data-action="request-fullscreen">${t('viewport.immersive')}</button>
          <div class="top-badge difficulty-badge" data-difficulty="${settings.difficulty || 'officer'}"><span>${t(`training.difficulty.${settings.difficulty || 'officer'}`)}</span></div>
          <div class="top-badge"><span>${t('gameplay.phase')}</span></div>
        </div>
      </div>

      <div class="panel hero-panel gameplay-status-panel">
        <button class="button block primary-command top-quick-periscope" id="open-periscope">${t('gameplay.openPeriscope')}</button>
        <div class="command-room-ribbon">
          <div class="command-room-ribbon-title">${t('bridge.commandRoom')}</div>
          <div class="command-room-ribbon-grid">
            <div><img src="assets/ui/instruments/helm_icon.png" alt=""><span>${t('stabilization.stationCommand')}</span></div>
            <div><img src="assets/ui/instruments/sonar_icon.png" alt=""><span>${t('stabilization.stationSensors')}</span></div>
            <div><img src="assets/ui/instruments/periscope_icon.png" alt=""><span>${t('bridge.station.periscope')}</span></div>
            <div><img src="assets/ui/instruments/torpedo_icon.png" alt=""><span>${t('stabilization.stationWeapons')}</span></div>
            <div><img src="assets/ui/instruments/speed_telegraph_icon.png" alt=""><span>${t('bridge.station.engines')}</span></div>
          </div>
        </div>
        <div class="gameplay-kpis">
          <div class="stat-box"><div class="stat-label">${t('gameplay.depth')}</div><div id="hud-depth" class="stat-value">0 m</div></div>
          <div class="stat-box"><div class="stat-label">${t('gameplay.speed')}</div><div id="hud-speed" class="stat-value">STOP</div></div>
          <div class="stat-box"><div class="stat-label">${t('gameplay.alert')}</div><div id="hud-alert" class="stat-value">${t('gameplay.alertSilent')}</div></div>
          <div class="stat-box"><div class="stat-label">${t('repair.hull')}</div><div id="hud-hull" class="stat-value">100%</div></div>
          <div class="stat-box"><div class="stat-label">${t('gameplay.torpedoes')}</div><div id="hud-torpedoes" class="stat-value">4</div></div>
          <div class="stat-box"><div class="stat-label">${t('gameplay.condition')}</div><div id="hud-condition" class="stat-value">OK</div></div>
          <div class="stat-box navigation-kpi"><div class="stat-label">${t('navigation.position')}</div><div id="hud-position" class="stat-value compact-value">--</div></div>
          <div class="stat-box navigation-kpi"><div class="stat-label">${t('navigation.heading')}</div><div id="hud-heading" class="stat-value">000°</div></div>
          <div class="stat-box navigation-kpi"><div class="stat-label">${t('navigation.timeCompression')}</div><div id="hud-compression" class="stat-value">×1</div></div>
          <div class="stat-box physics-kpi"><div class="stat-label">${t('physics.battery')}</div><div id="hud-battery" class="stat-value">100%</div></div>
          <div class="stat-box physics-kpi"><div class="stat-label">${t('physics.oxygen')}</div><div id="hud-oxygen" class="stat-value">100%</div></div>
          <div class="stat-box sensor-kpi"><div class="stat-label">${t('sensors.contacts')}</div><div id="hud-contacts" class="stat-value">0</div></div>
          <div class="stat-box ai-kpi"><div class="stat-label">${t('ai.convoyShips')}</div><div id="hud-convoy" class="stat-value">0/0</div></div>
          <div class="stat-box ai-kpi"><div class="stat-label">${t('ai.aswThreat')}</div><div id="hud-asw" class="stat-value">${t('ai.threat.clear')}</div></div>
          <div class="stat-box environment-kpi"><div class="stat-label">${t('environment.sea')}</div><div id="hud-environment" class="stat-value compact-value">--</div></div>
        </div>
      </div>

      <div class="simulation-core-strip" role="status" aria-live="polite">
        <span><b>${t('engine.core')}</b> <span id="engine-status">${t('engine.online')}</span></span>
        <span id="engine-tick">${t('engine.tick', { tick: 0 })}</span>
        <span id="engine-entities">${t('engine.entities', { count: 3 })}</span>
        <span>${t('engine.fixedStep')}</span>
      </div>

      <div class="orientation-note gameplay-orientation-note">
        <strong>${t('settings.orientation')}</strong>
        <span>${t('viewport.landscapeRecommended')}</span>
      </div>

      <nav class="station-tabs" aria-label="${t('stabilization.stationNavigation')}">
        <button class="station-tab active" data-station="command">${t('stabilization.stationCommand')}</button>
        <button class="station-tab" data-station="instruments">${t('stabilization.stationInstruments')}</button>
        <button class="station-tab" data-station="sensors">${t('stabilization.stationSensors')}</button>
        <button class="station-tab" data-station="weapons">${t('stabilization.stationWeapons')}</button>
        <button class="station-tab" data-station="navigation">${t('stabilization.stationNavigationShort')}</button>
        <button class="station-tab" data-station="ai">${t('stabilization.stationThreat')}</button>
        <button class="station-tab" data-station="damage">${t('stabilization.stationDamage')}</button>
        <button class="station-help-trigger" id="station-help-trigger" type="button" aria-label="${t('training.help')}" title="${t('training.help')}">?</button>
      </nav>

      <div class="gameplay-console-grid">
      <div class="panel mission-live-panel station-panel active" data-station-panel="command">
        <div class="panel-header">${t('gameplay.objectives')}</div>
        <div class="panel-body stack">
          <div class="objective-line"><span id="obj-primary" class="objective-dot"></span><b>${t('gameplay.objPrimary')}</b><small>${t('gameplay.objPrimaryDesc')}</small></div>
          <div class="objective-line"><span id="obj-survive" class="objective-dot"></span><b>${t('gameplay.objSurvive')}</b><small>${t('gameplay.objSurviveDesc')}</small></div>
          <div class="objective-line"><span id="obj-stealth" class="objective-dot"></span><b>${t('gameplay.objStealth')}</b><small>${t('gameplay.objStealthDesc')}</small></div>
          <div class="objective-line"><span id="obj-navigation" class="objective-dot"></span><b>${t('navigation.objectivePatrol')}</b><small>${t('navigation.objectivePatrolDesc')}</small></div>
          <div class="tutorial-strip">${t('gameplay.tutorialTip')}</div>
          <section class="operational-guide ${settings.tutorials === false ? 'hidden' : ''}" id="operational-guide" aria-live="polite">
            <div class="operational-guide-header">
              <div><strong>${t('training.guideTitle')}</strong><span id="training-progress-label">0%</span></div>
              <div class="row wrap">
                <button class="chip" id="training-go-station">${t('training.goToStation')}</button>
                <button class="chip" id="training-dismiss">${t('training.hide')}</button>
              </div>
            </div>
            <div class="training-progress"><i id="training-progress-bar"></i></div>
            <div class="training-current"><span>${t('training.currentStep')}</span><strong id="training-current-step">${t('training.step.orientation')}</strong></div>
            <ol class="training-checklist" id="training-checklist">
              ${['orientation','propulsion','depth','contact','periscope','solution','attack','evade','safe'].map((id) => `<li data-training-step="${id}"><i></i><span>${t(`training.step.${id}`)}</span></li>`).join('')}
            </ol>
          </section>
        </div>
      </div>

      <div class="instrument-grid station-panel" data-station-panel="instruments">
        <div class="panel instrument-card">
          <div class="panel-header">${t('gameplay.depthGauge')}</div>
          <div class="panel-body instrument-wrap">
            <div class="depth-gauge-css" aria-label="${t('gameplay.depthGauge')}">
              <svg class="depth-gauge-svg" viewBox="0 0 220 220" aria-hidden="true">
                <defs>
                  <radialGradient id="depthFace" cx="50%" cy="38%" r="70%">
                    <stop offset="0%" stop-color="#1a443b"/>
                    <stop offset="55%" stop-color="#12312b"/>
                    <stop offset="100%" stop-color="#091914"/>
                  </radialGradient>
                </defs>
                <circle cx="110" cy="110" r="102" fill="#6f4a16"/>
                <circle cx="110" cy="110" r="93" fill="#241609" stroke="#c99a42" stroke-width="10"/>
                <circle cx="110" cy="110" r="76" fill="url(#depthFace)" stroke="#d6ba74" stroke-width="3"/>
                <path d="M44 147 A76 76 0 0 0 176 147" fill="none" stroke="rgba(90,255,160,.22)" stroke-width="9" stroke-linecap="round"/>
                <path d="M147 44 A76 76 0 0 1 176 73" fill="none" stroke="rgba(255,190,90,.28)" stroke-width="9" stroke-linecap="round"/>
                <path d="M176 73 A76 76 0 0 1 176 147" fill="none" stroke="rgba(255,92,92,.26)" stroke-width="9" stroke-linecap="round"/>
                <g stroke="#dcc98e" stroke-width="2">
                  <line x1="44.2" y1="147.5" x2="33.8" y2="153.5"/>
                  <line x1="46.8" y1="69.0" x2="37.6" y2="61.1"/>
                  <line x1="110.0" y1="34.0" x2="110.0" y2="22.0"/>
                  <line x1="173.2" y1="69.0" x2="182.4" y2="61.1"/>
                  <line x1="175.8" y1="147.5" x2="186.2" y2="153.5"/>
                  <line x1="141.1" y1="40.7" x2="145.9" y2="29.7" stroke-width="1.5"/>
                  <line x1="74.4" y1="47.4" x2="67.4" y2="37.7" stroke-width="1.5"/>
                  <line x1="34.5" y1="106.0" x2="22.6" y2="104.9" stroke-width="1.5"/>
                  <line x1="185.5" y1="106.0" x2="197.4" y2="104.9" stroke-width="1.5"/>
                  <line x1="159.8" y1="164.4" x2="168.9" y2="172.2" stroke-width="1.5"/>
                </g>
                <g fill="#f1e3b0" font-size="16" font-weight="700" text-anchor="middle">
                  <text x="33" y="160">0</text>
                  <text x="46" y="63">50</text>
                  <text x="110" y="20">150</text>
                  <text x="174" y="63">250</text>
                  <text x="188" y="160">300</text>
                </g>
                <text x="110" y="138" fill="#f7e7ae" font-size="13" font-weight="800" text-anchor="middle" letter-spacing="1">${t('physics.depth')}</text>
                <text id="depth-digital" x="110" y="160" fill="#ffffff" font-size="18" font-weight="900" text-anchor="middle">12.0 m</text>
                <text id="depth-order-digital" x="110" y="177" fill="#66ddff" font-size="10" font-weight="700" text-anchor="middle">CMD 12 m</text>
                <g id="depth-command-marker" class="depth-command-marker-svg">
                  <line x1="110" y1="110" x2="110" y2="42" stroke="#54d9ff" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/>
                  <circle cx="110" cy="40" r="5" fill="#54d9ff"/>
                </g>
                <g id="depth-needle" class="depth-needle-svg">
                  <line x1="110" y1="110" x2="110" y2="54" stroke="#f0d79b" stroke-width="5" stroke-linecap="round"/>
                  <polygon points="110,40 104,57 116,57" fill="#ff8b4f"/>
                  <line x1="110" y1="110" x2="110" y2="132" stroke="#f0d79b" stroke-width="3" stroke-linecap="round"/>
                </g>
                <circle cx="110" cy="110" r="11" fill="#a73422" stroke="#ffd990" stroke-width="4"/>
                <circle cx="110" cy="110" r="4" fill="#fff4d1"/>
              </svg>
            </div>
            <div class="instrument-controls">
              <button class="button secondary block" id="depth-up">${t('gameplay.surface')}</button>
              <button class="button block" id="depth-down">${t('gameplay.dive')}</button>
            </div>
          </div>
        </div>

        <div class="panel instrument-card">
          <div class="panel-header">${t('gameplay.engineTelegraph')}</div>
          <div class="panel-body instrument-wrap">
            <div class="telegraph-stage">
              <div class="telegraph-shell">
                <div class="telegraph-arc telegraph-arc-port"></div>
                <div class="telegraph-arc telegraph-arc-starboard"></div>
                ${speedLabelMarkup(t)}
                <div class="telegraph-center"></div>
                <div id="speed-lever" class="telegraph-lever"><span class="telegraph-knob"></span></div>
                <div class="telegraph-digital"><strong id="speed-actual-digital">0.0 kn</strong><span id="speed-command-digital">STOP</span></div>
              </div>
            </div>
            <div class="chip-grid speed-grid">
              ${SPEEDS.map((speed) => `<button class="chip speed-chip" data-speed="${speed}">${t('speed.' + speed)}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="panel physics-panel station-panel" data-station-panel="instruments">
        <div class="panel-header physics-panel-header">
          <span>${t('physics.station')}</span>
          <span id="physics-status" class="physics-status normal">${t('physics.statusNormal')}</span>
        </div>
        <div class="panel-body physics-layout">
          <div class="physics-readout-grid">
            <div class="physics-readout"><span>${t('physics.actualDepth')}</span><strong id="physics-depth">12.0 m</strong></div>
            <div class="physics-readout"><span>${t('physics.orderedDepth')}</span><strong id="physics-ordered-depth">12 m</strong></div>
            <div class="physics-readout"><span>${t('physics.verticalSpeed')}</span><strong id="physics-vertical-speed">0.0 m/s</strong></div>
            <div class="physics-readout"><span>${t('physics.actualSpeed')}</span><strong id="physics-actual-speed">0.0 kn</strong></div>
            <div class="physics-readout"><span>${t('physics.ballast')}</span><strong id="physics-ballast">54%</strong></div>
            <div class="physics-readout"><span>${t('physics.trim')}</span><strong id="physics-trim">0.0°</strong></div>
            <div class="physics-readout"><span>${t('physics.pressure')}</span><strong id="physics-pressure">0%</strong></div>
            <div class="physics-readout"><span>${t('physics.depthZone')}</span><strong id="physics-depth-zone">${t('physics.zone.patrol')}</strong></div>
            <div class="physics-readout"><span>${t('physics.reserveBuoyancy')}</span><strong id="physics-reserve-buoyancy">50%</strong></div>
            <div class="physics-readout"><span>${t('physics.buoyancyState')}</span><strong id="physics-buoyancy-state">${t('physics.buoyancy.neutral')}</strong></div>
            <div class="physics-readout"><span>${t('physics.propulsion')}</span><strong id="physics-propulsion">${t('physics.electric')}</strong></div>
          </div>
          <div class="physics-meter-grid">
            <div class="physics-meter" data-meter="fuel"><div><span>${t('physics.fuel')}</span><b id="physics-fuel-value">100%</b></div><i><em id="physics-fuel-bar" style="width:100%"></em></i></div>
            <div class="physics-meter" data-meter="battery"><div><span>${t('physics.battery')}</span><b id="physics-battery-value">100%</b></div><i><em id="physics-battery-bar" style="width:100%"></em></i></div>
            <div class="physics-meter" data-meter="oxygen"><div><span>${t('physics.oxygen')}</span><b id="physics-oxygen-value">100%</b></div><i><em id="physics-oxygen-bar" style="width:100%"></em></i></div>
            <div class="physics-meter inverse" data-meter="co2"><div><span>${t('physics.co2')}</span><b id="physics-co2-value">0%</b></div><i><em id="physics-co2-bar" style="width:0%"></em></i></div>
            <div class="physics-meter inverse" data-meter="noise"><div><span>${t('physics.noise')}</span><b id="physics-noise-value">0%</b></div><i><em id="physics-noise-bar" style="width:0%"></em></i></div>
            <div class="physics-meter inverse" data-meter="cavitation"><div><span>${t('physics.cavitation')}</span><b id="physics-cavitation-value">0%</b></div><i><em id="physics-cavitation-bar" style="width:0%"></em></i></div>
          </div>
          <div class="physics-control-grid">
            <div class="physics-control-block">
              <div class="navigation-control-title">${t('physics.ballastControl')}</div>
              <div class="chip-grid physics-chip-grid">
                <button class="chip ballast-chip" data-ballast="blow">${t('physics.blow')}</button>
                <button class="chip ballast-chip" data-ballast="auto">${t('physics.auto')}</button>
                <button class="chip ballast-chip" data-ballast="neutral">${t('physics.neutral')}</button>
                <button class="chip ballast-chip" data-ballast="flood">${t('physics.flood')}</button>
              </div>
            </div>
            <div class="physics-control-block">
              <div class="navigation-control-title">${t('physics.trimControl')}</div>
              <div class="chip-grid physics-chip-grid">
                <button class="chip trim-chip" data-trim="-3">${t('physics.bowUp')}</button>
                <button class="chip" id="trim-level">${t('physics.level')}</button>
                <button class="chip trim-chip" data-trim="3">${t('physics.bowDown')}</button>
              </div>
            </div>
            <button class="button warn block" id="emergency-blow-btn">${t('physics.emergencyBlow')}</button>
          </div>
          <div id="physics-interlock" class="physics-interlock">${t('physics.interlockReady')}</div>
        </div>
      </div>

      <div class="panel radar-panel sensor-panel station-panel" data-station-panel="sensors">
        <div class="panel-header sensor-panel-header">
          <span>${t('sensors.station')}</span>
          <span id="sensor-mode-badge" class="sensor-mode-badge">${t('sensors.modeHydrophone')}</span>
        </div>
        <div class="panel-body sensor-layout">
          <div class="environment-strip" id="environment-strip">
            <div><span>${t('environment.time')}</span><strong id="environment-time">--:--</strong></div>
            <div><span>${t('environment.seaState')}</span><strong id="environment-sea-state">--</strong></div>
            <div><span>${t('environment.visibility')}</span><strong id="environment-visibility">--</strong></div>
            <div><span>${t('environment.wind')}</span><strong id="environment-wind">--</strong></div>
            <div><span>${t('environment.thermalLayer')}</span><strong id="environment-layer">--</strong></div>
            <div><span>${t('environment.ambientNoise')}</span><strong id="environment-noise">--</strong></div>
          </div>
          <div class="ocean-weather-panel" id="ocean-weather-panel">
            <div class="ocean-weather-title">${t('ocean.title')}</div>
            <div class="ocean-weather-grid">
              <div><span>${t('ocean.severity')}</span><strong id="ocean-severity">--</strong></div>
              <div><span>${t('ocean.cover')}</span><strong id="ocean-cover">--</strong></div>
              <div><span>${t('ocean.surfaceRisk')}</span><strong id="ocean-surface-risk">--</strong></div>
              <div><span>${t('ocean.sonarEffect')}</span><strong id="ocean-sonar-effect">--</strong></div>
              <div><span>${t('ocean.recommendedDepth')}</span><strong id="ocean-recommended-depth">--</strong></div>
              <div class="ocean-advice"><span>${t('ocean.advice')}</span><strong id="ocean-advice">--</strong></div>
            </div>
          </div>
          <div class="sensor-scope-column">
            <div class="radar-stage sensor-scope" id="radar-stage">
              <div class="radar-base radar-css-base">
                ${radarGridMarkup()}
                <div id="radar-scan" class="radar-scan radar-css-scan"></div>
                <div id="hydrophone-bearing-line" class="hydrophone-bearing-line"></div>
                <div id="active-ping-wave" class="active-ping-wave hidden"></div>
                <div id="radar-player" class="radar-icon radar-player radar-css-player"></div>
                <div id="radar-target" class="radar-icon radar-target radar-css-enemy hidden"></div>
                <div id="radar-escort" class="radar-icon radar-escort radar-css-enemy hidden"></div>
              </div>
            </div>
            <div class="sensor-scope-legend">
              <span><i class="sensor-legend-dot target"></i>${t('sensors.targetContact')}</span>
              <span><i class="sensor-legend-dot escort"></i>${t('sensors.escortContact')}</span>
            </div>
            <div class="hydrophone-waterfall phase17-waterfall" id="hydrophone-waterfall" aria-label="${t('environment.acousticWaterfall')}">${hydrophoneWaterfallMarkup()}</div>
            <div class="sonar-room-status-grid" aria-label="${t('sonarRoom.acousticStatus')}">
              <div><span>${t('sonarRoom.waterfall')}</span><strong>${t('sonarRoom.waterfallLive')}</strong></div>
              <div><span>${t('sonarRoom.bearingTuner')}</span><strong id="sonar-bearing-tuner">000°</strong></div>
              <div><span>${t('sonarRoom.pingRisk')}</span><strong id="sonar-ping-risk">${t('sonarRoom.riskLow')}</strong></div>
            </div>
            <button class="button secondary block sonar-listen-button" id="hydrophone-listen">${t('environment.listenContact')}</button>
          </div>
          <div class="sensor-console">
            <div class="chip-grid sensor-mode-grid">
              <button class="chip sensor-mode-chip" data-sensor-mode="hydrophone">${t('sensors.modeHydrophone')}</button>
              <button class="chip sensor-mode-chip" data-sensor-mode="radar">${t('sensors.modeRadar')}</button>
            </div>
            <div class="sensor-bearing-control">
              <span>${t('sensors.listeningBearing')}</span>
              <strong id="sensor-bearing">000°</strong>
              <div class="chip-grid sensor-bearing-grid">
                <button class="chip hydrophone-bearing-chip" data-bearing-delta="-15">−15°</button>
                <button class="chip hydrophone-bearing-chip" data-bearing-delta="15">+15°</button>
              </div>
            </div>
            <div class="sensor-action-grid">
              <button class="button secondary" id="active-sonar-ping">${t('sensors.activePing')}</button>
              <button class="button secondary" id="radar-mast-toggle">${t('sensors.raiseRadarMast')}</button>
            </div>
            <div class="sensor-profile-grid">
              <div><span>${t('sensors.passiveRange')}</span><strong id="sensor-passive-range">--</strong></div>
              <div><span>${t('sensors.radarRange')}</span><strong id="sensor-radar-range">--</strong></div>
              <div><span>${t('sensors.sonarIntegrity')}</span><strong id="sensor-integrity">100%</strong></div>
              <div><span>${t('sensors.contactCount')}</span><strong id="sensor-contact-count">0</strong></div>
            </div>
            <div id="sensor-message" class="sensor-message">${t('sensors.ready')}</div>
            <div class="sonar-room-acoustic-board">
              <div class="sonar-room-board-title">${t('sonarRoom.signatureBoard')}</div>
              <div class="sonar-room-board-grid">
                <div><span>${t('sonarRoom.merchantSignature')}</span><strong>${t('sonarRoom.lowCadence')}</strong></div>
                <div><span>${t('sonarRoom.escortSignature')}</span><strong>${t('sonarRoom.highCadence')}</strong></div>
                <div><span>${t('sonarRoom.ownNoise')}</span><strong id="sonar-own-noise">--</strong></div>
                <div><span>${t('sonarRoom.thermalLayer')}</span><strong id="sonar-layer-effect">--</strong></div>
              </div>
            </div>
          </div>
          <div class="sensor-contact-list">
            <article class="sensor-contact-card" id="sensor-contact-target" data-contact="target">
              <header><span>${t('sensors.targetContact')}</span><b id="sensor-target-confidence">0%</b></header>
              <div><span>${t('sensors.classification')}</span><strong id="sensor-target-class">${t('sensors.classUnknown')}</strong></div>
              <div><span>${t('sensors.bearing')}</span><strong id="sensor-target-bearing">--</strong></div>
              <div><span>${t('sensors.range')}</span><strong id="sensor-target-range">--</strong></div>
              <div><span>${t('sensors.source')}</span><strong id="sensor-target-source">--</strong></div>
              <div><span>${t('environment.signal')}</span><strong id="sensor-target-signal">0%</strong></div>
              <div><span>${t('environment.motionTrend')}</span><strong id="sensor-target-trend">--</strong></div>
              <div><span>${t('environment.estimatedSpeed')}</span><strong id="sensor-target-speed">--</strong></div>
              <div><span>${t('environment.contactAge')}</span><strong id="sensor-target-age">--</strong></div>
              <div class="contact-history" id="sensor-target-history" aria-hidden="true"></div>
              <i><em id="sensor-target-confidence-bar" style="width:0%"></em></i>
            </article>
            <article class="sensor-contact-card" id="sensor-contact-escort" data-contact="escort">
              <header><span>${t('sensors.escortContact')}</span><b id="sensor-escort-confidence">0%</b></header>
              <div><span>${t('sensors.classification')}</span><strong id="sensor-escort-class">${t('sensors.classUnknown')}</strong></div>
              <div><span>${t('sensors.bearing')}</span><strong id="sensor-escort-bearing">--</strong></div>
              <div><span>${t('sensors.range')}</span><strong id="sensor-escort-range">--</strong></div>
              <div><span>${t('sensors.source')}</span><strong id="sensor-escort-source">--</strong></div>
              <div><span>${t('environment.signal')}</span><strong id="sensor-escort-signal">0%</strong></div>
              <div><span>${t('environment.motionTrend')}</span><strong id="sensor-escort-trend">--</strong></div>
              <div><span>${t('environment.estimatedSpeed')}</span><strong id="sensor-escort-speed">--</strong></div>
              <div><span>${t('environment.contactAge')}</span><strong id="sensor-escort-age">--</strong></div>
              <div class="contact-history" id="sensor-escort-history" aria-hidden="true"></div>
              <i><em id="sensor-escort-confidence-bar" style="width:0%"></em></i>
            </article>
          </div>
        </div>
      </div>

      <div class="panel naval-ai-panel station-panel" data-station-panel="ai">
        <div class="panel-header naval-ai-panel-header">
          <span>${t('ai.station')}</span>
          <span id="ai-state-badge" class="ai-state-badge">${t('ai.state.formation')}</span>
        </div>
        <div class="panel-body naval-ai-layout">
          <div class="convoy-tactical-column">
            <div id="convoy-tactical-plot" class="convoy-tactical-plot" role="img" aria-label="${t('ai.tacticalPlot')}">
              <i class="ai-range-ring ring-one"></i><i class="ai-range-ring ring-two"></i>
              <span class="ai-player-marker" title="${t('ai.playerSubmarine')}"></span>
            </div>
            <div class="ai-legend">
              <span><i class="merchant"></i>${t('ai.merchant')}</span>
              <span><i class="escort"></i>${t('ai.escort')}</span>
              <span><i class="aircraft"></i>${t('ai.aircraft')}</span>
            </div>
          </div>
          <div class="ai-command-column">
            <div class="ai-readout-grid">
              <div><span>${t('ai.merchantsActive')}</span><strong id="ai-merchants-active">0/0</strong></div>
              <div><span>${t('ai.escortsActive')}</span><strong id="ai-escorts-active">0/0</strong></div>
              <div><span>${t('ai.nearestEscort')}</span><strong id="ai-nearest-escort">--</strong></div>
              <div><span>${t('ai.formation')}</span><strong id="ai-formation-status">${t('ai.formationIntact')}</strong></div>
              <div><span>${t('ai.aircraftStatus')}</span><strong id="ai-aircraft-status">${t('ai.aircraftStandby')}</strong></div>
              <div><span>${t('ai.depthChargePatterns')}</span><strong id="ai-pattern-count">0</strong></div>
              <div><span>${t('encounter.enemyContactConfidence')}</span><strong id="ai-contact-confidence">0%</strong></div>
              <div><span>${t('encounter.attackSolution')}</span><strong id="ai-attack-solution">0%</strong></div>
            </div>
            <div id="ai-depth-charge-alert" class="ai-depth-charge-alert clear">${t('ai.noDepthCharges')}</div>
            <div id="ai-message" class="ai-message">${t('ai.formationHolding')}</div>
          </div>
        </div>
      </div>

      <div class="panel damage-control-panel station-panel" data-station-panel="damage">
        <div class="panel-header damage-control-header">
          <span>${t('damage.station')}</span>
          <span id="damage-status-badge" class="damage-status-badge">${t('damage.statusSecure')}</span>
        </div>
        <div class="panel-body damage-control-layout">
          <div class="damage-summary-column">
            <div class="damage-summary-grid">
              <div><span>${t('damage.flooding')}</span><strong id="damage-total-flooding">0%</strong><i><em id="damage-flooding-bar" style="width:0%"></em></i></div>
              <div><span>${t('damage.fire')}</span><strong id="damage-total-fire">0%</strong><i><em id="damage-fire-bar" style="width:0%"></em></i></div>
              <div><span>${t('damage.power')}</span><strong id="damage-power">100%</strong><i><em id="damage-power-bar" style="width:100%"></em></i></div>
              <div><span>${t('damage.morale')}</span><strong id="damage-morale">100%</strong><i><em id="damage-morale-bar" style="width:100%"></em></i></div>
            </div>
            <div class="damage-casualty-grid">
              <div><span>${t('damage.crewFit')}</span><strong id="damage-crew-fit">44</strong></div>
              <div><span>${t('damage.crewInjured')}</span><strong id="damage-crew-injured">0</strong></div>
              <div><span>${t('damage.crewDead')}</span><strong id="damage-crew-dead">0</strong></div>
              <div><span>${t('damage.criticalCompartments')}</span><strong id="damage-critical-count">0</strong></div>
            </div>
            <div class="damage-emergency-grid">
              <div><span>${t('damage.pressureIngress')}</span><strong id="damage-pressure-ingress">0%</strong><i><em id="damage-pressure-bar" style="width:0%"></em></i></div>
              <div><span>${t('damage.smokeLoad')}</span><strong id="damage-smoke-load">0%</strong><i><em id="damage-smoke-bar" style="width:0%"></em></i></div>
              <div><span>${t('damage.compartmentStability')}</span><strong id="damage-stability">100%</strong><i><em id="damage-stability-bar" style="width:100%"></em></i></div>
              <div><span>${t('damage.emergencyPosture')}</span><strong id="damage-posture">Normal</strong></div>
            </div>
            <div class="damage-posture-controls">
              <button class="chip damage-posture-chip" data-damage-posture="normal">${t('damage.posture.normal.short')}</button>
              <button class="chip damage-posture-chip" data-damage-posture="brace">${t('damage.posture.brace.short')}</button>
              <button class="chip damage-posture-chip" data-damage-posture="silent">${t('damage.posture.silent.short')}</button>
              <button class="chip damage-posture-chip" data-damage-posture="evacuateForward">${t('damage.posture.evacuateForward.short')}</button>
              <button class="chip damage-ventilation-chip" id="damage-ventilation">${t('damage.ventilate')}</button>
            </div>
            <div class="damage-global-controls">
              <button class="button secondary" id="damage-doors-toggle">${t('damage.closeDoors')}</button>
              <button class="button secondary" id="damage-pumps-toggle">${t('damage.pumpsOn')}</button>
              <button class="button secondary" id="damage-emergency-power">${t('damage.emergencyPowerOff')}</button>
            </div>
            <div id="damage-message" class="damage-message">${t('damage.ready')}</div>
          </div>
          <div class="damage-teams-column">
            <div class="damage-assignment-console">
              <label><span>${t('damage.selectTeam')}</span>
                <select id="damage-team-select">
                  <option value="dc-team-1">${t('damage.team.1')}</option>
                  <option value="dc-team-2">${t('damage.team.2')}</option>
                  <option value="dc-team-3">${t('damage.team.3')}</option>
                </select>
              </label>
              <label><span>${t('damage.selectTask')}</span>
                <select id="damage-task-select">
                  <option value="pump">${t('damage.task.pump')}</option>
                  <option value="fire">${t('damage.task.fire')}</option>
                  <option value="repair">${t('damage.task.repair')}</option>
                  <option value="medical">${t('damage.task.medical')}</option>
                </select>
              </label>
            </div>
            <div id="damage-team-list" class="damage-team-list"></div>
            <div id="damage-compartment-grid" class="damage-compartment-grid">
              ${['bowTorpedo','forwardBattery','controlRoom','sonarRoom','engineRoom','aftBattery','sternTorpedo'].map((id) => `<button class="damage-compartment-card" data-compartment-id="${id}"><header><strong>${t(`damage.compartment.${id}`)}</strong><span data-role="condition">100%</span></header><div class="damage-mini-grid"><span>${t('damage.floodShort')} <b data-role="flooding">0%</b></span><span>${t('damage.fireShort')} <b data-role="fire">0%</b></span><span>${t('damage.electricalShort')} <b data-role="electrical">0%</b></span><span>${t('damage.crewShort')} <b data-role="crew">0</b></span></div><footer data-role="assignment">${t('damage.unassigned')}</footer></button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="panel action-panel station-panel active" data-station-panel="command">
        <div class="panel-header">${t('gameplay.combatStation')}</div>
        <div class="panel-body combat-station-layout">
          <div class="combat-controls stack">
            <button class="button block primary-command" id="open-periscope-secondary">${t('gameplay.openPeriscope')}</button>
            <section class="encounter-console" aria-live="polite">
              <header>
                <div><span>${t('encounter.station')}</span><strong id="encounter-phase">${t('encounter.phase.patrol')}</strong></div>
                <b id="encounter-contact-state">${t('encounter.contactUncertain')}</b>
              </header>
              <div class="encounter-timeline" id="encounter-timeline">
                ${['approach','shadow','attack','evade','disengage'].map((phase) => `<span data-encounter-step="${phase}">${t(`encounter.phase.${phase}`)}</span>`).join('')}
              </div>
              <div class="encounter-readouts">
                <div><span>${t('encounter.contactQuality')}</span><strong id="encounter-contact-quality">0%</strong><i><em id="encounter-contact-bar" style="width:0%"></em></i></div>
                <div><span>${t('encounter.attackReadiness')}</span><strong id="encounter-attack-readiness">0%</strong><i><em id="encounter-attack-bar" style="width:0%"></em></i></div>
                <div><span>${t('encounter.enemySolution')}</span><strong id="encounter-enemy-solution">0%</strong><i><em id="encounter-enemy-bar" style="width:0%"></em></i></div>
                <div><span>${t('encounter.escapeProgress')}</span><strong id="encounter-escape-progress">0%</strong><i><em id="encounter-escape-bar" style="width:0%"></em></i></div>
              </div>
              <div class="encounter-doctrine-grid">
                ${['shadow','attack','evade','disengage'].map((doctrine) => `<button class="chip encounter-doctrine" data-doctrine="${doctrine}">${t(`encounter.doctrine.${doctrine}`)}</button>`).join('')}
              </div>
              <div id="encounter-recommendation" class="encounter-recommendation">${t('encounter.recommendObserve')}</div>
            </section>
            <div class="tactical-grid">
              <button class="button secondary" id="silent-running-btn">${t('gameplay.silentRunning')}</button>
              <button class="button secondary" id="emergency-dive-btn">${t('gameplay.emergencyDive')}</button>
              <button class="button secondary" id="decoy-btn">${t('gameplay.decoy')}</button>
              <button class="button secondary" id="open-navigation-station">${t('navigation.openStation')}</button>
              <button class="button secondary" id="open-weapons-station">${t('weapons.openStation')}</button>
              <button class="button secondary" id="open-damage-control">${t('damage.openStation')}</button>
            </div>
            <button class="button secondary block hidden" id="emergency-repair-btn">${t('repair.emergency')}</button>
            <button class="button secondary block hidden" id="complete-mission-btn">${t('gameplay.completeMission')}</button>
            <div class="empty-state" id="mission-hint">${t('gameplay.hint')}</div>
            <div id="mission-result" class="mission-result hidden">
              <strong id="mission-result-title"></strong>
              <span id="mission-result-text"></span>
              <button class="button block" data-nav="lobby">${t('repair.returnLobby')}</button>
              <button class="button secondary block" data-nav="arsenal">${t('repair.goWorkshop')}</button>
            </div>
          </div>
          <div class="systems-panel">
            <div class="systems-title">${t('gameplay.systems')}</div>
            <div class="system-row"><span>${t('repair.engines')}</span><b id="sys-engines">100%</b><i><em id="bar-engines" style="width:100%"></em></i></div>
            <div class="system-row"><span>${t('repair.sonar')}</span><b id="sys-sonar">100%</b><i><em id="bar-sonar" style="width:100%"></em></i></div>
            <div class="system-row"><span>${t('repair.periscope')}</span><b id="sys-periscope">100%</b><i><em id="bar-periscope" style="width:100%"></em></i></div>
            <div class="system-row"><span>${t('repair.weapons')}</span><b id="sys-weapons">100%</b><i><em id="bar-weapons" style="width:100%"></em></i></div>
          </div>
        </div>
      </div>

      <div class="panel weapons-panel station-panel" data-station-panel="weapons">
        <div class="panel-header weapons-panel-header">
          <span>${t('weapons.station')}</span>
          <span id="weapons-status" class="weapons-status">${t('weapons.statusNoContact')}</span>
        </div>
        <div class="panel-body weapons-layout">
          <div class="tube-console">
            <div class="navigation-control-title">${t('weapons.tubeBank')}</div>
            <div class="tube-rack">
              ${Array.from({ length: 6 }, (_, index) => `<button class="torpedo-tube" data-tube-id="tube-${index + 1}"><span>T${index + 1}</span><b>${t('weapons.loaded')}</b><i></i></button>`).join('')}
            </div>
            <div class="weapon-stock-grid">
              <div><span>${t('weapons.loadedTubes')}</span><strong id="weapons-loaded-count">0</strong></div>
              <div><span>${t('weapons.reserve')}</span><strong id="weapons-reserve-count">0</strong></div>
              <div><span>${t('weapons.failureRate')}</span><strong id="weapons-failure-rate">0%</strong></div>
              <div><span>${t('weapons.maxDepth')}</span><strong id="weapons-max-depth">60 m</strong></div>
            </div>
          </div>
          <div class="tdc-console">
            <div class="tdc-header">
              <div><span>${t('weapons.tdc')}</span><strong id="tdc-quality">0%</strong></div>
              <i class="tdc-quality-track"><em id="tdc-quality-bar" style="width:0%"></em></i>
            </div>
            <div class="weapon-target-grid chip-grid">
              <button class="chip weapon-target-chip" data-weapon-target="target">${t('weapons.targetPrimary')}</button>
              <button class="chip weapon-target-chip" data-weapon-target="escort">${t('weapons.targetEscort')}</button>
            </div>
            <div class="tdc-readout-grid">
              <label><span>${t('weapons.bearing')}</span><strong id="tdc-bearing">--</strong></label>
              <label><span>${t('weapons.range')}</span><strong id="tdc-range">--</strong></label>
              <label><span>${t('weapons.gyro')}</span><strong id="tdc-gyro">000°</strong></label>
              <label><span>${t('weapons.contactConfidence')}</span><strong id="tdc-confidence">0%</strong></label>
              <label><span>${t('weapons.targetSpeed')}</span><input id="tdc-target-speed" type="number" min="0" max="40" step="0.5" value="8"></label>
              <label><span>${t('weapons.targetCourse')}</span><input id="tdc-target-course" type="number" min="0" max="359" step="1" value="270"></label>
              <label><span>${t('weapons.aob')}</span><input id="tdc-aob" type="number" min="0" max="180" step="1" value="90"></label>
              <label><span>${t('weapons.runDepth')}</span><input id="tdc-run-depth" type="number" min="1" max="15" step="1" value="3"></label>
            </div>
            <div class="phase19-tdc-solution" data-state="critical">
              <div class="phase19-tdc-plot">
                <span class="tdc-plot-line ownship"></span>
                <span class="tdc-plot-line target"></span>
                <span class="tdc-plot-line torpedo" id="tdc-plot-torpedo"></span>
                <strong>${t('tdc.attackTriangle')}</strong>
              </div>
              <div class="phase19-tdc-grid">
                <div><span>${t('tdc.leadAngle')}</span><strong id="tdc-lead-angle">--</strong></div>
                <div><span>${t('tdc.impactTime')}</span><strong id="tdc-impact-time">--</strong></div>
                <div><span>${t('tdc.fireRisk')}</span><strong id="tdc-fire-risk">--</strong></div>
                <div><span>${t('tdc.hitWindow')}</span><strong id="tdc-hit-window">--</strong></div>
                <div><span>${t('tdc.salvoPattern')}</span><strong id="tdc-salvo-pattern">--</strong></div>
                <div><span>${t('tdc.fireDiscipline')}</span><strong id="tdc-fire-discipline">--</strong></div>
              </div>
            </div>
            <div class="navigation-control-title">${t('weapons.torpedoType')}</div>
            <div class="chip-grid weapon-type-grid">
              <button class="chip torpedo-type-chip" data-torpedo-type="steam">${t('weapons.typeSteam')}</button>
              <button class="chip torpedo-type-chip" data-torpedo-type="electric">${t('weapons.typeElectric')}</button>
            </div>
            <div class="navigation-control-title">${t('weapons.salvo')}</div>
            <div class="chip-grid salvo-grid">
              ${[1, 2, 3].map((value) => `<button class="chip salvo-chip" data-salvo-size="${value}">${value}</button>`).join('')}
            </div>
            <div class="weapon-actions">
              <button class="button secondary" id="tdc-sync">${t('weapons.syncSolution')}</button>
              <button class="button warn" id="weapons-fire">${t('weapons.fireSolution')}</button>
            </div>
            <div id="weapons-message" class="weapons-message">${t('weapons.ready')}</div>
          </div>
        </div>
      </div>
      </div>

      <div class="panel navigation-panel station-panel" data-station-panel="navigation">
        <div class="panel-header navigation-panel-header">
          <span>${t('navigation.station')}</span>
          <span id="nav-sector-badge" class="navigation-sector-badge">${t('navigation.sectorOutside')}</span>
        </div>
        <div class="panel-body navigation-layout">
          <div class="navigation-map-wrap">
            <svg id="navigation-map" class="navigation-map" viewBox="0 0 1000 560" role="img" aria-label="${t('navigation.map')}">
              <defs>
                <linearGradient id="navigationOcean" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#0b3040"></stop>
                  <stop offset="100%" stop-color="#071b27"></stop>
                </linearGradient>
                <filter id="navigationGlow"><feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
              </defs>
              <rect class="navigation-ocean" x="0" y="0" width="1000" height="560"></rect>
              <g class="navigation-grid-lines">${navigationGridMarkup()}</g>
              <rect id="nav-sector" class="navigation-sector" x="0" y="0" width="0" height="0"></rect>
              <polyline id="nav-route-line" class="navigation-route-line" points=""></polyline>
              <g id="nav-waypoints" class="navigation-waypoints"></g>
              <g id="nav-player" class="navigation-player" transform="translate(0 0) rotate(0)">
                <circle r="18"></circle><path d="M0 -27 L12 18 L0 11 L-12 18 Z"></path>
              </g>
              <g id="nav-heading-vector" class="navigation-heading-vector"><line x1="0" y1="0" x2="0" y2="0"></line></g>
            </svg>
            <div class="navigation-map-note">${t('navigation.mapTap')}</div>
          </div>
          <div class="navigation-console">
            <div class="navigation-readout-grid">
              <div><span>${t('navigation.position')}</span><strong id="nav-position">--</strong></div>
              <div><span>${t('navigation.heading')}</span><strong id="nav-heading">000°</strong></div>
              <div><span>${t('navigation.orderedCourse')}</span><strong id="nav-ordered">000°</strong></div>
              <div><span>${t('navigation.rudder')}</span><strong id="nav-rudder">0°</strong></div>
              <div><span>${t('navigation.speedKnots')}</span><strong id="nav-speed">0.0 kn</strong></div>
              <div><span>${t('navigation.nextWaypoint')}</span><strong id="nav-waypoint">--</strong></div>
              <div><span>${t('navigation.routeDistance')}</span><strong id="nav-distance">--</strong></div>
              <div><span>${t('navigation.eta')}</span><strong id="nav-eta">--</strong></div>
            </div>
            <div class="navigation-control-block">
              <div class="navigation-control-title">${t('navigation.rudderControl')}</div>
              <div class="chip-grid navigation-rudder-grid">
                <button class="chip rudder-chip" data-rudder="-35">${t('navigation.hardPort')}</button>
                <button class="chip rudder-chip" data-rudder="-15">${t('navigation.port')}</button>
                <button class="chip rudder-chip" data-rudder="0">${t('navigation.midships')}</button>
                <button class="chip rudder-chip" data-rudder="15">${t('navigation.starboard')}</button>
                <button class="chip rudder-chip" data-rudder="35">${t('navigation.hardStarboard')}</button>
              </div>
              <div class="navigation-heading-controls">
                <button class="button secondary heading-chip" data-heading-delta="-15">−15°</button>
                <button class="button secondary heading-chip" data-heading-delta="-5">−5°</button>
                <button class="button secondary" id="nav-autopilot">${t('navigation.autopilot')}</button>
                <button class="button secondary heading-chip" data-heading-delta="5">+5°</button>
                <button class="button secondary heading-chip" data-heading-delta="15">+15°</button>
              </div>
            </div>
            <div class="navigation-control-block">
              <div class="navigation-control-title">${t('navigation.route')}</div>
              <div class="navigation-route-actions">
                <button class="button secondary" id="nav-next-waypoint">${t('navigation.skipWaypoint')}</button>
                <button class="button secondary" id="nav-remove-waypoint">${t('navigation.removeLast')}</button>
                <button class="button ghost" id="nav-reset-route">${t('navigation.resetRoute')}</button>
              </div>
            </div>
            <div class="navigation-control-block">
              <div class="navigation-control-title">${t('navigation.timeCompression')}</div>
              <div class="chip-grid navigation-compression-grid">
                ${[1, 2, 4, 8, 16].map((value) => `<button class="chip compression-chip" data-compression="${value}">×${value}</button>`).join('')}
              </div>
              <div id="nav-compression-status" class="navigation-status">${t('navigation.compressionSafe')}</div>
            </div>
          </div>
        </div>
      </div>


      <div id="periscope-modal" class="periscope-modal hidden" aria-hidden="true">
        <div class="periscope-actions">
          <button class="button ghost" id="close-periscope">${t('common.back')}</button>
          <button class="button warn" id="fire-torpedo">${t('gameplay.fireTorpedo')}</button>
        </div>
        <div class="periscope-shell css-periscope" id="periscope-shell">
          <div class="periscope-window" id="periscope-window">
            <div id="periscope-ocean" class="periscope-ocean css-periscope-ocean"></div>
            <div id="periscope-horizon" class="periscope-horizon"></div>
            <div id="periscope-weather" class="periscope-weather">${periscopeWeatherMarkup()}</div>
            <div id="periscope-visibility-layer" class="periscope-visibility-layer"></div>
            <img id="target-ship" class="periscope-entity target-ship" src="assets/ships/merchant_ship_01.png" alt="merchant">
            <img id="escort-ship" class="periscope-entity escort-ship" src="assets/ships/destroyer_01.png" alt="destroyer">
            <img id="torpedo-shot" class="periscope-effect torpedo-shot hidden" src="assets/effects/torpedo_moving_01.png" alt="torpedo">
            <img id="impact-explosion" class="periscope-effect impact-explosion hidden" src="assets/effects/ocean_explosion_01.png" alt="explosion">
            <img id="impact-splash" class="periscope-effect impact-splash hidden" src="assets/effects/water_splash_01.png" alt="splash">
            <div class="periscope-vignette"></div>
            <div class="periscope-crosshair-css">
              <span class="line h"></span>
              <span class="line v"></span>
              <span class="ring"></span>
              <span class="range-mark range-mark-1"></span>
              <span class="range-mark range-mark-2"></span>
              <span class="range-mark range-mark-3"></span>
            </div>
            <div class="periscope-compass"><span>330</span><span>345</span><strong id="periscope-bearing">000°</strong><span>015</span><span>030</span></div>
            <div class="periscope-data-ribbon">
              <span>${t('stabilization.range')} <b id="periscope-range">--</b></span>
              <span>${t('stabilization.zoom')} <b id="periscope-zoom-value">1.0×</b></span>
              <span>${t('stabilization.exposure')} <b id="periscope-exposure">0%</b></span>
              <span>${t('encounter.mastTime')} <b id="periscope-mast-time">0 s</b></span>
              <span>${t('environment.visualQuality')} <b id="periscope-visual-quality">--</b></span>
              <span>${t('environment.seaShort')} <b id="periscope-sea-state">--</b></span>
              <span>${t('periscope.opticalQuality')} <b id="periscope-optical-quality">--</b></span>
              <span>${t('periscope.mastWake')} <b id="periscope-mast-wake">--</b></span>
            </div>
            <div class="phase18-periscope-solution">
              <div><span>${t('periscope.depthEnvelope')}</span><strong id="periscope-depth-envelope">--</strong></div>
              <div><span>${t('periscope.estimatedRange')}</span><strong id="periscope-estimated-range">--</strong></div>
              <div><span>${t('periscope.estimatedSpeed')}</span><strong id="periscope-estimated-speed">--</strong></div>
              <div><span>${t('periscope.errorWindow')}</span><strong id="periscope-error-window">--</strong></div>
            </div>
          </div>
          <div class="periscope-rim"></div>
          <div class="periscope-glass-css"></div>
          <div id="periscope-lock" class="periscope-lock">${t('gameplay.lockSearching')}</div>
          <div id="periscope-sensor-readout" class="periscope-sensor-readout">${t('sensors.visualAwaiting')}</div>
        </div>
        <div class="periscope-controls periscope-controls-grid">
          <button class="button secondary" id="view-left">${t('gameplay.left')}</button>
          <button class="button secondary" id="view-up">${t('gameplay.up')}</button>
          <button class="button secondary" id="view-right">${t('gameplay.right')}</button>
          <button class="button secondary" id="view-down">${t('gameplay.down')}</button>
          <button class="button secondary" id="periscope-zoom-out">${t('stabilization.zoomOut')}</button>
          <button class="button secondary" id="periscope-zoom-in">${t('stabilization.zoomIn')}</button>
        </div>
      </div>

      <aside class="station-help-drawer hidden" id="station-help-drawer" aria-hidden="true">
        <div class="station-help-card">
          <div class="station-help-header"><strong id="station-help-title">${t('training.help')}</strong><button class="chip" id="station-help-close">×</button></div>
          <p id="station-help-body"></p>
          <div class="station-help-actions" id="station-help-actions"></div>
        </div>
      </aside>
    </section>
  `;
}

export function mountGameplay({
  app, mission, submarine = null, initialHull = 100, initialSystems = {}, initialSnapshot = null,
  onHullUpdate = () => {}, onMissionComplete, onOperationAutosave = () => {},
  onOperationCleared = () => {}, difficulty = 'officer', tutorialEnabled = true, contextualHelp = true, t
}) {
  cleanupGameplay();

  const els = {
    depthNeedle: app.querySelector('#depth-needle'),
    depthDigital: app.querySelector('#depth-digital'),
    depthOrderDigital: app.querySelector('#depth-order-digital'),
    depthCommandMarker: app.querySelector('#depth-command-marker'),
    speedLever: app.querySelector('#speed-lever'),
    speedActualDigital: app.querySelector('#speed-actual-digital'),
    speedCommandDigital: app.querySelector('#speed-command-digital'),
    hudDepth: app.querySelector('#hud-depth'),
    hudSpeed: app.querySelector('#hud-speed'),
    hudAlert: app.querySelector('#hud-alert'),
    hudHull: app.querySelector('#hud-hull'),
    hudTorpedoes: app.querySelector('#hud-torpedoes'),
    hudCondition: app.querySelector('#hud-condition'),
    hudBattery: app.querySelector('#hud-battery'),
    hudOxygen: app.querySelector('#hud-oxygen'),
    hudContacts: app.querySelector('#hud-contacts'),
    hudConvoy: app.querySelector('#hud-convoy'),
    hudAsw: app.querySelector('#hud-asw'),
    hudEnvironment: app.querySelector('#hud-environment'),
    encounterPhase: app.querySelector('#encounter-phase'),
    encounterContactState: app.querySelector('#encounter-contact-state'),
    encounterContactQuality: app.querySelector('#encounter-contact-quality'),
    encounterAttackReadiness: app.querySelector('#encounter-attack-readiness'),
    encounterEnemySolution: app.querySelector('#encounter-enemy-solution'),
    encounterEscapeProgress: app.querySelector('#encounter-escape-progress'),
    encounterContactBar: app.querySelector('#encounter-contact-bar'),
    encounterAttackBar: app.querySelector('#encounter-attack-bar'),
    encounterEnemyBar: app.querySelector('#encounter-enemy-bar'),
    encounterEscapeBar: app.querySelector('#encounter-escape-bar'),
    encounterRecommendation: app.querySelector('#encounter-recommendation'),
    aiStateBadge: app.querySelector('#ai-state-badge'),
    aiTacticalPlot: app.querySelector('#convoy-tactical-plot'),
    aiMerchantsActive: app.querySelector('#ai-merchants-active'),
    aiEscortsActive: app.querySelector('#ai-escorts-active'),
    aiNearestEscort: app.querySelector('#ai-nearest-escort'),
    aiFormationStatus: app.querySelector('#ai-formation-status'),
    aiAircraftStatus: app.querySelector('#ai-aircraft-status'),
    aiPatternCount: app.querySelector('#ai-pattern-count'),
    aiContactConfidence: app.querySelector('#ai-contact-confidence'),
    aiAttackSolution: app.querySelector('#ai-attack-solution'),
    aiDepthChargeAlert: app.querySelector('#ai-depth-charge-alert'),
    aiMessage: app.querySelector('#ai-message'),
    damageStatusBadge: app.querySelector('#damage-status-badge'),
    damageTotalFlooding: app.querySelector('#damage-total-flooding'),
    damageTotalFire: app.querySelector('#damage-total-fire'),
    damagePower: app.querySelector('#damage-power'),
    damageMorale: app.querySelector('#damage-morale'),
    damageFloodingBar: app.querySelector('#damage-flooding-bar'),
    damageFireBar: app.querySelector('#damage-fire-bar'),
    damagePowerBar: app.querySelector('#damage-power-bar'),
    damageMoraleBar: app.querySelector('#damage-morale-bar'),
    damageCrewFit: app.querySelector('#damage-crew-fit'),
    damageCrewInjured: app.querySelector('#damage-crew-injured'),
    damageCrewDead: app.querySelector('#damage-crew-dead'),
    damageCriticalCount: app.querySelector('#damage-critical-count'),
    damagePressureIngress: app.querySelector('#damage-pressure-ingress'),
    damageSmokeLoad: app.querySelector('#damage-smoke-load'),
    damageStability: app.querySelector('#damage-stability'),
    damagePosture: app.querySelector('#damage-posture'),
    damagePressureBar: app.querySelector('#damage-pressure-bar'),
    damageSmokeBar: app.querySelector('#damage-smoke-bar'),
    damageStabilityBar: app.querySelector('#damage-stability-bar'),
    damageVentilation: app.querySelector('#damage-ventilation'),
    damageDoorsToggle: app.querySelector('#damage-doors-toggle'),
    damagePumpsToggle: app.querySelector('#damage-pumps-toggle'),
    damageEmergencyPower: app.querySelector('#damage-emergency-power'),
    damageMessage: app.querySelector('#damage-message'),
    damageTeamSelect: app.querySelector('#damage-team-select'),
    damageTaskSelect: app.querySelector('#damage-task-select'),
    damageTeamList: app.querySelector('#damage-team-list'),
    damageCompartmentGrid: app.querySelector('#damage-compartment-grid'),
    sysEngines: app.querySelector('#sys-engines'),
    sysSonar: app.querySelector('#sys-sonar'),
    sysPeriscope: app.querySelector('#sys-periscope'),
    sysWeapons: app.querySelector('#sys-weapons'),
    barEngines: app.querySelector('#bar-engines'),
    barSonar: app.querySelector('#bar-sonar'),
    barPeriscope: app.querySelector('#bar-periscope'),
    barWeapons: app.querySelector('#bar-weapons'),
    physicsStatus: app.querySelector('#physics-status'),
    physicsDepth: app.querySelector('#physics-depth'),
    physicsOrderedDepth: app.querySelector('#physics-ordered-depth'),
    physicsVerticalSpeed: app.querySelector('#physics-vertical-speed'),
    physicsActualSpeed: app.querySelector('#physics-actual-speed'),
    physicsBallast: app.querySelector('#physics-ballast'),
    physicsTrim: app.querySelector('#physics-trim'),
    physicsPressure: app.querySelector('#physics-pressure'),
    physicsDepthZone: app.querySelector('#physics-depth-zone'),
    physicsReserveBuoyancy: app.querySelector('#physics-reserve-buoyancy'),
    physicsBuoyancyState: app.querySelector('#physics-buoyancy-state'),
    physicsPropulsion: app.querySelector('#physics-propulsion'),
    physicsFuelValue: app.querySelector('#physics-fuel-value'),
    physicsBatteryValue: app.querySelector('#physics-battery-value'),
    physicsOxygenValue: app.querySelector('#physics-oxygen-value'),
    physicsCo2Value: app.querySelector('#physics-co2-value'),
    physicsNoiseValue: app.querySelector('#physics-noise-value'),
    physicsCavitationValue: app.querySelector('#physics-cavitation-value'),
    physicsFuelBar: app.querySelector('#physics-fuel-bar'),
    physicsBatteryBar: app.querySelector('#physics-battery-bar'),
    physicsOxygenBar: app.querySelector('#physics-oxygen-bar'),
    physicsCo2Bar: app.querySelector('#physics-co2-bar'),
    physicsNoiseBar: app.querySelector('#physics-noise-bar'),
    physicsCavitationBar: app.querySelector('#physics-cavitation-bar'),
    physicsInterlock: app.querySelector('#physics-interlock'),
    trimLevel: app.querySelector('#trim-level'),
    emergencyBlow: app.querySelector('#emergency-blow-btn'),
    radarScan: app.querySelector('#radar-scan'),
    radarTarget: app.querySelector('#radar-target'),
    radarEscort: app.querySelector('#radar-escort'),
    hydrophoneBearingLine: app.querySelector('#hydrophone-bearing-line'),
    activePingWave: app.querySelector('#active-ping-wave'),
    sensorModeBadge: app.querySelector('#sensor-mode-badge'),
    sensorBearing: app.querySelector('#sensor-bearing'),
    sonarBearingTuner: app.querySelector('#sonar-bearing-tuner'),
    sonarPingRisk: app.querySelector('#sonar-ping-risk'),
    sonarOwnNoise: app.querySelector('#sonar-own-noise'),
    sonarLayerEffect: app.querySelector('#sonar-layer-effect'),
    sensorPassiveRange: app.querySelector('#sensor-passive-range'),
    sensorRadarRange: app.querySelector('#sensor-radar-range'),
    sensorIntegrity: app.querySelector('#sensor-integrity'),
    sensorContactCount: app.querySelector('#sensor-contact-count'),
    sensorMessage: app.querySelector('#sensor-message'),
    environmentStrip: app.querySelector('#environment-strip'),
    environmentTime: app.querySelector('#environment-time'),
    environmentSeaState: app.querySelector('#environment-sea-state'),
    environmentVisibility: app.querySelector('#environment-visibility'),
    environmentWind: app.querySelector('#environment-wind'),
    environmentLayer: app.querySelector('#environment-layer'),
    environmentNoise: app.querySelector('#environment-noise'),
    oceanWeatherPanel: app.querySelector('#ocean-weather-panel'),
    oceanSeverity: app.querySelector('#ocean-severity'),
    oceanCover: app.querySelector('#ocean-cover'),
    oceanSurfaceRisk: app.querySelector('#ocean-surface-risk'),
    oceanSonarEffect: app.querySelector('#ocean-sonar-effect'),
    oceanRecommendedDepth: app.querySelector('#ocean-recommended-depth'),
    oceanAdvice: app.querySelector('#ocean-advice'),
    hydrophoneWaterfall: app.querySelector('#hydrophone-waterfall'),
    hydrophoneListen: app.querySelector('#hydrophone-listen'),
    activeSonarPing: app.querySelector('#active-sonar-ping'),
    radarMastToggle: app.querySelector('#radar-mast-toggle'),
    sensorTargetCard: app.querySelector('#sensor-contact-target'),
    sensorEscortCard: app.querySelector('#sensor-contact-escort'),
    sensorTargetConfidence: app.querySelector('#sensor-target-confidence'),
    sensorEscortConfidence: app.querySelector('#sensor-escort-confidence'),
    sensorTargetClass: app.querySelector('#sensor-target-class'),
    sensorEscortClass: app.querySelector('#sensor-escort-class'),
    sensorTargetBearing: app.querySelector('#sensor-target-bearing'),
    sensorEscortBearing: app.querySelector('#sensor-escort-bearing'),
    sensorTargetRange: app.querySelector('#sensor-target-range'),
    sensorEscortRange: app.querySelector('#sensor-escort-range'),
    sensorTargetSource: app.querySelector('#sensor-target-source'),
    sensorEscortSource: app.querySelector('#sensor-escort-source'),
    sensorTargetConfidenceBar: app.querySelector('#sensor-target-confidence-bar'),
    sensorEscortConfidenceBar: app.querySelector('#sensor-escort-confidence-bar'),
    sensorTargetSignal: app.querySelector('#sensor-target-signal'),
    sensorEscortSignal: app.querySelector('#sensor-escort-signal'),
    sensorTargetTrend: app.querySelector('#sensor-target-trend'),
    sensorEscortTrend: app.querySelector('#sensor-escort-trend'),
    sensorTargetSpeed: app.querySelector('#sensor-target-speed'),
    sensorEscortSpeed: app.querySelector('#sensor-escort-speed'),
    sensorTargetAge: app.querySelector('#sensor-target-age'),
    sensorEscortAge: app.querySelector('#sensor-escort-age'),
    sensorTargetHistory: app.querySelector('#sensor-target-history'),
    sensorEscortHistory: app.querySelector('#sensor-escort-history'),
    weaponsStatus: app.querySelector('#weapons-status'),
    weaponsLoadedCount: app.querySelector('#weapons-loaded-count'),
    weaponsReserveCount: app.querySelector('#weapons-reserve-count'),
    weaponsFailureRate: app.querySelector('#weapons-failure-rate'),
    weaponsMaxDepth: app.querySelector('#weapons-max-depth'),
    tdcQuality: app.querySelector('#tdc-quality'),
    tdcQualityBar: app.querySelector('#tdc-quality-bar'),
    tdcBearing: app.querySelector('#tdc-bearing'),
    tdcRange: app.querySelector('#tdc-range'),
    tdcGyro: app.querySelector('#tdc-gyro'),
    tdcConfidence: app.querySelector('#tdc-confidence'),
    tdcTargetSpeed: app.querySelector('#tdc-target-speed'),
    tdcTargetCourse: app.querySelector('#tdc-target-course'),
    tdcAob: app.querySelector('#tdc-aob'),
    tdcRunDepth: app.querySelector('#tdc-run-depth'),
    tdcLeadAngle: app.querySelector('#tdc-lead-angle'),
    tdcImpactTime: app.querySelector('#tdc-impact-time'),
    tdcFireRisk: app.querySelector('#tdc-fire-risk'),
    tdcHitWindow: app.querySelector('#tdc-hit-window'),
    tdcSalvoPattern: app.querySelector('#tdc-salvo-pattern'),
    tdcFireDiscipline: app.querySelector('#tdc-fire-discipline'),
    tdcPlotTorpedo: app.querySelector('#tdc-plot-torpedo'),
    tdcSolutionPanel: app.querySelector('.phase19-tdc-solution'),
    tdcSync: app.querySelector('#tdc-sync'),
    weaponsFire: app.querySelector('#weapons-fire'),
    weaponsMessage: app.querySelector('#weapons-message'),
    openWeaponsStation: app.querySelector('#open-weapons-station'),
    openDamageControl: app.querySelector('#open-damage-control'),
    openPeriscope: app.querySelector('#open-periscope'),
    openPeriscopeSecondary: app.querySelector('#open-periscope-secondary'),
    periscopeModal: app.querySelector('#periscope-modal'),
    periscopeWindow: app.querySelector('.periscope-window'),
    closePeriscope: app.querySelector('#close-periscope'),
    fireTorpedo: app.querySelector('#fire-torpedo'),
    missionHint: app.querySelector('#mission-hint'),
    completeMission: app.querySelector('#complete-mission-btn'),
    emergencyRepair: app.querySelector('#emergency-repair-btn'),
    silentRunning: app.querySelector('#silent-running-btn'),
    emergencyDive: app.querySelector('#emergency-dive-btn'),
    decoy: app.querySelector('#decoy-btn'),
    missionResult: app.querySelector('#mission-result'),
    missionResultTitle: app.querySelector('#mission-result-title'),
    missionResultText: app.querySelector('#mission-result-text'),
    periscopeOcean: app.querySelector('#periscope-ocean'),
    periscopeHorizon: app.querySelector('#periscope-horizon'),
    periscopeWeather: app.querySelector('#periscope-weather'),
    periscopeVisibilityLayer: app.querySelector('#periscope-visibility-layer'),
    targetShip: app.querySelector('#target-ship'),
    escortShip: app.querySelector('#escort-ship'),
    torpedoShot: app.querySelector('#torpedo-shot'),
    impactExplosion: app.querySelector('#impact-explosion'),
    impactSplash: app.querySelector('#impact-splash'),
    lockLabel: app.querySelector('#periscope-lock'),
    periscopeSensorReadout: app.querySelector('#periscope-sensor-readout'),
    periscopeBearing: app.querySelector('#periscope-bearing'),
    periscopeRange: app.querySelector('#periscope-range'),
    periscopeZoomValue: app.querySelector('#periscope-zoom-value'),
    periscopeExposure: app.querySelector('#periscope-exposure'),
    periscopeMastTime: app.querySelector('#periscope-mast-time'),
    periscopeVisualQuality: app.querySelector('#periscope-visual-quality'),
    periscopeSeaState: app.querySelector('#periscope-sea-state'),
    periscopeOpticalQuality: app.querySelector('#periscope-optical-quality'),
    periscopeMastWake: app.querySelector('#periscope-mast-wake'),
    periscopeDepthEnvelope: app.querySelector('#periscope-depth-envelope'),
    periscopeEstimatedRange: app.querySelector('#periscope-estimated-range'),
    periscopeEstimatedSpeed: app.querySelector('#periscope-estimated-speed'),
    periscopeErrorWindow: app.querySelector('#periscope-error-window'),
    periscopeZoomOut: app.querySelector('#periscope-zoom-out'),
    periscopeZoomIn: app.querySelector('#periscope-zoom-in'),
    viewLeft: app.querySelector('#view-left'),
    viewRight: app.querySelector('#view-right'),
    viewUp: app.querySelector('#view-up'),
    viewDown: app.querySelector('#view-down'),
    objPrimary: app.querySelector('#obj-primary'),
    objSurvive: app.querySelector('#obj-survive'),
    objStealth: app.querySelector('#obj-stealth'),
    engineStatus: app.querySelector('#engine-status'),
    engineTick: app.querySelector('#engine-tick'),
    engineEntities: app.querySelector('#engine-entities'),
    hudPosition: app.querySelector('#hud-position'),
    hudHeading: app.querySelector('#hud-heading'),
    hudCompression: app.querySelector('#hud-compression'),
    navigationMap: app.querySelector('#navigation-map'),
    navSector: app.querySelector('#nav-sector'),
    navRouteLine: app.querySelector('#nav-route-line'),
    navWaypoints: app.querySelector('#nav-waypoints'),
    navPlayer: app.querySelector('#nav-player'),
    navHeadingVector: app.querySelector('#nav-heading-vector line'),
    navPosition: app.querySelector('#nav-position'),
    navHeading: app.querySelector('#nav-heading'),
    navOrdered: app.querySelector('#nav-ordered'),
    navRudder: app.querySelector('#nav-rudder'),
    navSpeed: app.querySelector('#nav-speed'),
    navWaypoint: app.querySelector('#nav-waypoint'),
    navDistance: app.querySelector('#nav-distance'),
    navEta: app.querySelector('#nav-eta'),
    navAutopilot: app.querySelector('#nav-autopilot'),
    navNextWaypoint: app.querySelector('#nav-next-waypoint'),
    navRemoveWaypoint: app.querySelector('#nav-remove-waypoint'),
    navResetRoute: app.querySelector('#nav-reset-route'),
    navCompressionStatus: app.querySelector('#nav-compression-status'),
    navSectorBadge: app.querySelector('#nav-sector-badge'),
    openNavigationStation: app.querySelector('#open-navigation-station'),
    objNavigation: app.querySelector('#obj-navigation'),
    trainingGuide: app.querySelector('#operational-guide'),
    trainingProgressLabel: app.querySelector('#training-progress-label'),
    trainingProgressBar: app.querySelector('#training-progress-bar'),
    trainingCurrentStep: app.querySelector('#training-current-step'),
    trainingChecklist: app.querySelector('#training-checklist'),
    trainingGoStation: app.querySelector('#training-go-station'),
    trainingDismiss: app.querySelector('#training-dismiss'),
    stationHelpTrigger: app.querySelector('#station-help-trigger'),
    stationHelpDrawer: app.querySelector('#station-help-drawer'),
    stationHelpClose: app.querySelector('#station-help-close'),
    stationHelpTitle: app.querySelector('#station-help-title'),
    stationHelpBody: app.querySelector('#station-help-body'),
    stationHelpActions: app.querySelector('#station-help-actions'),
  };

  const engine = new SimulationEngine({ mission: mission || {}, submarine, initialHull, initialSystems, initialSnapshot, difficulty });
  const training = new OperationalTraining({ enabled: tutorialEnabled });
  app.__simulationEngine = engine;
  let operationResolved = false;
  let lastAutosaveElapsed = Number(initialSnapshot?.elapsedMs || 0);
  const persistOperation = (snapshot = engine.snapshot(), force = false) => {
    if (operationResolved || snapshot.missionFailed || snapshot.canComplete) return false;
    if (!force && snapshot.elapsedMs - lastAutosaveElapsed < 10000) return false;
    lastAutosaveElapsed = snapshot.elapsedMs;
    onOperationAutosave(snapshot);
    return true;
  };
  cleanupFns.push(() => {
    if (!operationResolved) persistOperation(engine.snapshot(), true);
    engine.dispose();
    if (app.__simulationEngine === engine) delete app.__simulationEngine;
  });

  const targetSpriteMap = {
    merchant: 'assets/ships/merchant_ship_01.png',
    destroyer: 'assets/ships/destroyer_01.png',
    submarine: 'assets/ships/submarine_ww2_01.png',
  };
  if (els.targetShip) {
    els.targetShip.src = targetSpriteMap[mission?.targetType] || targetSpriteMap.merchant;
    els.targetShip.alt = mission?.targetType || 'target';
  }

  const addCleanup = (fn) => cleanupFns.push(fn);
  const bind = (element, eventName, handler) => {
    if (!element) return;
    element.addEventListener(eventName, handler);
    addCleanup(() => element.removeEventListener(eventName, handler));
  };
  const schedule = (fn, delay) => {
    const id = setTimeout(fn, delay);
    addCleanup(() => clearTimeout(id));
    return id;
  };

  let activeStation = 'command';
  let periscopeZoom = 1;
  const gameplayScroller = app.closest('.app-shell') || app;
  function setStation(station, { focus = true } = {}) {
    const allowed = new Set(['command','instruments','sensors','weapons','navigation','ai','damage']);
    if (!allowed.has(station)) station = 'command';
    activeStation = station;
    app.querySelectorAll('[data-station-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.stationPanel === station));
    app.querySelectorAll('.station-tab').forEach((button) => {
      const selected = button.dataset.station === station;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    if (focus) gameplayScroller.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const stationHelpKeys = {
    command: 'training.help.command', instruments: 'training.help.instruments', sensors: 'training.help.sensors',
    weapons: 'training.help.weapons', navigation: 'training.help.navigation', ai: 'training.help.ai', damage: 'training.help.damage',
  };
  function updateTraining(snapshot) {
    const guide = training.update(snapshot);
    if (!els.trainingGuide) return guide;
    els.trainingGuide.classList.toggle('hidden', !guide.enabled || guide.dismissed);
    if (els.trainingProgressLabel) els.trainingProgressLabel.textContent = `${guide.progress}%`;
    if (els.trainingProgressBar) els.trainingProgressBar.style.width = `${guide.progress}%`;
    if (els.trainingCurrentStep) els.trainingCurrentStep.textContent = t(`training.step.${guide.currentStep}`);
    els.trainingChecklist?.querySelectorAll('[data-training-step]').forEach((item) => {
      item.classList.toggle('complete', guide.completed.includes(item.dataset.trainingStep));
      item.classList.toggle('current', item.dataset.trainingStep === guide.currentStep);
    });
    const dangerStation = guide.dangerStation;
    app.querySelectorAll('.station-tab').forEach((button) => button.classList.toggle('recommended', button.dataset.station === dangerStation && button.dataset.station !== activeStation));
    if (els.trainingGoStation) els.trainingGoStation.dataset.targetStation = dangerStation || guide.recommendedStation;
    return guide;
  }
  function openStationHelp() {
    if (!contextualHelp || !els.stationHelpDrawer) return;
    const key = stationHelpKeys[activeStation] || stationHelpKeys.command;
    if (els.stationHelpTitle) els.stationHelpTitle.textContent = t(`training.station.${activeStation}`);
    if (els.stationHelpBody) els.stationHelpBody.textContent = t(key);
    if (els.stationHelpActions) els.stationHelpActions.textContent = t(`training.helpAction.${activeStation}`);
    els.stationHelpDrawer.classList.remove('hidden');
    els.stationHelpDrawer.setAttribute('aria-hidden', 'false');
  }
  function closeStationHelp() {
    els.stationHelpDrawer?.classList.add('hidden');
    els.stationHelpDrawer?.setAttribute('aria-hidden', 'true');
  }

  function setPeriscopeZoom(value) {
    periscopeZoom = clamp(value, 1, 3);
    els.periscopeModal?.style.setProperty('--periscope-zoom', String(periscopeZoom));
    if (els.periscopeZoomValue) els.periscopeZoomValue.textContent = `${periscopeZoom.toFixed(1)}×`;
  }

  function escortStateLabel(snapshot) {
    if (snapshot.escortState === 'hunt') return t('gameplay.alertDetected');
    if (snapshot.escortState === 'alert') return t('gameplay.alertWarning');
    return t('gameplay.alertSilent');
  }

  function systemCondition(snapshot) {
    const minimum = Math.min(...Object.values(snapshot.systems || {}), snapshot.hull);
    if (snapshot.missionFailed || snapshot.hull <= 0) return t('gameplay.conditionLost');
    if (minimum < 35) return t('gameplay.conditionCritical');
    if (minimum < 65) return t('gameplay.conditionDamaged');
    return t('gameplay.conditionOk');
  }

  function updateSystemBars(snapshot) {
    const map = [
      ['engines', els.sysEngines, els.barEngines],
      ['sonar', els.sysSonar, els.barSonar],
      ['periscope', els.sysPeriscope, els.barPeriscope],
      ['weapons', els.sysWeapons, els.barWeapons],
    ];
    map.forEach(([key, label, bar]) => {
      const value = clamp(Math.round(snapshot.systems[key] ?? 100), 0, 100);
      if (label) label.textContent = `${value}%`;
      if (bar) {
        bar.style.width = `${value}%`;
        bar.dataset.level = value < 35 ? 'critical' : value < 65 ? 'warning' : 'ok';
      }
    });
  }

  function updateHint(snapshot) {
    if (!els.missionHint) return;
    if (snapshot.missionFailed) els.missionHint.textContent = t('gameplay.hintMissionFailed');
    else if (snapshot.repairTicks > 0) els.missionHint.textContent = t('repair.inProgress');
    else if (snapshot.damageFlashTicks > 0 || snapshot.silentTicks > 0 || snapshot.decoyTicks > 0 || snapshot.emergencyDiveCooldown > 130) els.missionHint.textContent = t(snapshot.lastEventKey || 'gameplay.hint');
    else if (snapshot.hull < 55) els.missionHint.textContent = t('repair.hintEmergency');
    else if (snapshot.targetDestroyed) els.missionHint.textContent = snapshot.escortState === 'hunt'
      ? `${t('gameplay.hintSuccess')} ${t('gameplay.escortHuntSuffix')}`
      : t('gameplay.hintSuccess');
    else if (snapshot.escortState === 'hunt') els.missionHint.textContent = t('gameplay.hintEscortHunt');
    else if (snapshot.escortState === 'alert') els.missionHint.textContent = t('gameplay.hintEscortAlert');
    else els.missionHint.textContent = t('gameplay.hint');
  }

  function updateObjectives(snapshot) {
    els.objPrimary?.classList.toggle('done', snapshot.targetDestroyed);
    els.objSurvive?.classList.toggle('done', snapshot.hull > 0 && !snapshot.missionFailed);
    els.objStealth?.classList.toggle('done', snapshot.metrics.maxDetection < 72);
    els.objNavigation?.classList.toggle('done', Boolean(snapshot.navigation?.patrolEntered));
  }

  function setMeter(valueElement, barElement, value, inverse = false) {
    const safe = clamp(value, 0, 100);
    if (valueElement) valueElement.textContent = `${Math.round(safe)}%`;
    if (barElement) {
      barElement.style.width = `${safe}%`;
      const dangerValue = inverse ? safe : 100 - safe;
      barElement.dataset.state = dangerValue >= 75 ? 'critical' : dangerValue >= 45 ? 'warning' : 'ok';
    }
  }

  function updateInstruments(snapshot) {
    const physics = snapshot.physics || {};
    const actualDepth = Number(physics.depth ?? snapshot.depth ?? 0);
    const orderedDepth = Number(physics.orderedDepth ?? actualDepth);
    const actualSpeed = Number(physics.actualSpeedKnots || 0);
    if (els.depthNeedle) els.depthNeedle.style.transform = `rotate(${depthToAngle(actualDepth, 300)}deg)`;
    if (els.depthCommandMarker) els.depthCommandMarker.style.transform = `rotate(${depthToAngle(orderedDepth, 300)}deg)`;
    if (els.depthDigital) els.depthDigital.textContent = `${actualDepth.toFixed(1)} m`;
    if (els.depthOrderDigital) els.depthOrderDigital.textContent = `CMD ${Math.round(orderedDepth)} m`;
    if (els.speedLever) els.speedLever.style.transform = `translate(-50%, -88%) rotate(${SPEED_ANGLES[snapshot.speed]}deg)`;
    if (els.speedActualDigital) els.speedActualDigital.textContent = `${actualSpeed.toFixed(1)} kn`;
    if (els.speedCommandDigital) els.speedCommandDigital.textContent = t(`speed.${snapshot.speed}`).toUpperCase();
  }

  function updatePhysics(snapshot) {
    const physics = snapshot.physics;
    if (!physics) return;
    if (els.physicsDepth) els.physicsDepth.textContent = `${Number(physics.depth).toFixed(1)} m`;
    if (els.physicsOrderedDepth) els.physicsOrderedDepth.textContent = `${Math.round(physics.orderedDepth)} m`;
    if (els.physicsVerticalSpeed) {
      const vertical = Number(physics.verticalSpeed || 0);
      const arrow = vertical > 0.08 ? '↓' : vertical < -0.08 ? '↑' : '—';
      els.physicsVerticalSpeed.textContent = `${arrow} ${Math.abs(vertical).toFixed(2)} m/s`;
    }
    if (els.physicsActualSpeed) els.physicsActualSpeed.textContent = `${Number(physics.actualSpeedKnots || 0).toFixed(1)} kn`;
    if (els.physicsBallast) els.physicsBallast.textContent = `${Math.round(physics.ballast)}% · ${t(`physics.ballastMode.${physics.ballastCommand || 'auto'}`)}`;
    if (els.physicsTrim) els.physicsTrim.textContent = `${Number(physics.trim || 0).toFixed(1)}°`;
    if (els.physicsPressure) els.physicsPressure.textContent = `${Math.round(physics.pressurePercent || 0)}% · ${Math.round(physics.maxOperationalDepth || 0)} m`;
    if (els.physicsDepthZone) els.physicsDepthZone.textContent = t(`physics.zone.${physics.depthZone || 'patrol'}`);
    if (els.physicsReserveBuoyancy) els.physicsReserveBuoyancy.textContent = `${Math.round(physics.reserveBuoyancy ?? 50)}%`;
    if (els.physicsBuoyancyState) els.physicsBuoyancyState.textContent = t(`physics.buoyancy.${physics.buoyancyState || 'neutral'}`);
    if (els.physicsPropulsion) els.physicsPropulsion.textContent = t(physics.propulsionMode === 'diesel' ? 'physics.diesel' : 'physics.electric');
    setMeter(els.physicsFuelValue, els.physicsFuelBar, physics.fuel);
    setMeter(els.physicsBatteryValue, els.physicsBatteryBar, physics.battery);
    setMeter(els.physicsOxygenValue, els.physicsOxygenBar, physics.oxygen);
    setMeter(els.physicsCo2Value, els.physicsCo2Bar, physics.co2, true);
    setMeter(els.physicsNoiseValue, els.physicsNoiseBar, physics.noise, true);
    setMeter(els.physicsCavitationValue, els.physicsCavitationBar, physics.cavitation, true);
    if (els.physicsStatus) {
      const statusKey = physics.status === 'critical' ? 'physics.statusCritical' : physics.status === 'warning' ? 'physics.statusWarning' : 'physics.statusNormal';
      els.physicsStatus.textContent = t(statusKey);
      els.physicsStatus.className = `physics-status ${physics.status || 'normal'}`;
    }
    if (els.physicsInterlock) {
      const flags = physics.criticalFlags || [];
      const key = flags.length ? `physics.flag.${flags[0]}` : 'physics.interlockReady';
      els.physicsInterlock.textContent = t(key);
      els.physicsInterlock.classList.toggle('warning', flags.length > 0);
    }
    app.querySelectorAll('.ballast-chip').forEach((button) => button.classList.toggle('active', button.dataset.ballast === physics.ballastCommand));
    if (els.emergencyBlow) els.emergencyBlow.disabled = snapshot.missionFailed || physics.emergencyBlowCooldownMs > 0;
  }

  function sensorClassLabel(contact) {
    const key = String(contact?.classification || 'unknown').toLowerCase();
    const known = new Set(['unknown', 'warship', 'merchant', 'destroyer', 'submarine']);
    return t(`sensors.class.${known.has(key) ? key : 'unknown'}`);
  }

  function sensorSourceLabel(contact) {
    const source = String(contact?.source || 'none');
    const known = new Set(['none', 'hydrophone', 'activeSonar', 'radar', 'periscope']);
    return t(`sensors.source.${known.has(source) ? source : 'none'}`);
  }

  function formatSensorRange(contact) {
    if (!contact?.detected || contact.rangeMeters === null || contact.rangeMeters === undefined) return '--';
    const range = Math.max(0, Number(contact.rangeMeters) || 0);
    if (!contact.rangeKnown) return `≈ ${Math.round(range / 100) * 100} m`;
    return range >= 1000 ? `${(range / 1000).toFixed(2)} km` : `${Math.round(range)} m`;
  }

  function updateContactPlot(element, contact, profile) {
    if (!element) return;
    const visible = Boolean(contact?.detected) && contact?.bearing !== null;
    element.classList.toggle('hidden', !visible);
    if (!visible) return;
    const maximum = Math.max(1200, Number(profile?.radarRangeMeters || 0), Number(profile?.hydrophoneRangeMeters || 0), Number(profile?.activeSonarRangeMeters || 0));
    const range = contact.rangeMeters === null ? maximum * 0.82 : Number(contact.rangeMeters);
    const radius = clamp(range / maximum, 0.08, 1) * 39;
    const radians = Number(contact.bearing) * Math.PI / 180;
    element.style.left = `${50 + Math.sin(radians) * radius}%`;
    element.style.top = `${50 - Math.cos(radians) * radius}%`;
    element.dataset.confidence = Number(contact.confidence || 0) < 35 ? 'low' : Number(contact.confidence || 0) < 68 ? 'medium' : 'high';
    element.classList.toggle('stale', Boolean(contact.stale));
  }

  function contactTrendLabel(contact) {
    const trend = ['closing', 'opening', 'steady'].includes(contact?.trend) ? contact.trend : 'steady';
    const aspect = ['bow', 'stern', 'crossing', 'unknown'].includes(contact?.aspect) ? contact.aspect : 'unknown';
    return `${t(`environment.trend.${trend}`)} · ${t(`environment.aspect.${aspect}`)}`;
  }

  function formatContactAge(contact) {
    if (!contact?.detected) return '--';
    const seconds = Math.max(0, Math.round(Number(contact.ageMs || 0) / 1000));
    return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  function renderContactHistory(container, contact) {
    if (!container) return;
    container.replaceChildren();
    const history = Array.isArray(contact?.history) ? contact.history.slice(-10) : [];
    for (const sample of history) {
      if (sample.bearing === null || sample.bearing === undefined) continue;
      const marker = document.createElement('i');
      marker.style.left = `${clamp(Number(sample.bearing) / 360, 0, 1) * 100}%`;
      marker.dataset.source = sample.source || 'none';
      container.append(marker);
    }
  }

  function updateContactCard(role, contact) {
    const isTarget = role === 'target';
    const card = isTarget ? els.sensorTargetCard : els.sensorEscortCard;
    const confidenceLabel = isTarget ? els.sensorTargetConfidence : els.sensorEscortConfidence;
    const classLabel = isTarget ? els.sensorTargetClass : els.sensorEscortClass;
    const bearingLabel = isTarget ? els.sensorTargetBearing : els.sensorEscortBearing;
    const rangeLabel = isTarget ? els.sensorTargetRange : els.sensorEscortRange;
    const sourceLabel = isTarget ? els.sensorTargetSource : els.sensorEscortSource;
    const confidenceBar = isTarget ? els.sensorTargetConfidenceBar : els.sensorEscortConfidenceBar;
    const signalLabel = isTarget ? els.sensorTargetSignal : els.sensorEscortSignal;
    const trendLabel = isTarget ? els.sensorTargetTrend : els.sensorEscortTrend;
    const speedLabel = isTarget ? els.sensorTargetSpeed : els.sensorEscortSpeed;
    const ageLabel = isTarget ? els.sensorTargetAge : els.sensorEscortAge;
    const historyContainer = isTarget ? els.sensorTargetHistory : els.sensorEscortHistory;
    const confidence = clamp(Number(contact?.confidence || 0), 0, 100);
    const signal = clamp(Number(contact?.signal || 0), 0, 100);
    card?.classList.toggle('detected', Boolean(contact?.detected));
    card?.classList.toggle('stale', Boolean(contact?.stale));
    card?.setAttribute('data-trend', contact?.trend || 'steady');
    if (confidenceLabel) confidenceLabel.textContent = `${Math.round(confidence)}%`;
    if (classLabel) classLabel.textContent = sensorClassLabel(contact);
    if (bearingLabel) bearingLabel.textContent = contact?.detected && contact?.bearing !== null
      ? `${String(Math.round(contact.bearing) % 360).padStart(3, '0')}° ±${Math.round(contact.bearingUncertainty || 0)}°`
      : '--';
    if (rangeLabel) rangeLabel.textContent = formatSensorRange(contact);
    if (sourceLabel) sourceLabel.textContent = sensorSourceLabel(contact);
    if (signalLabel) signalLabel.textContent = `${Math.round(signal)}%`;
    if (trendLabel) trendLabel.textContent = contact?.detected ? contactTrendLabel(contact) : '--';
    if (speedLabel) speedLabel.textContent = contact?.detected && Number(contact?.speedEstimateKnots || 0) > 0.1 ? `≈ ${Number(contact.speedEstimateKnots).toFixed(1)} kn` : '--';
    if (ageLabel) ageLabel.textContent = formatContactAge(contact);
    renderContactHistory(historyContainer, contact);
    if (confidenceBar) {
      confidenceBar.style.width = `${confidence}%`;
      confidenceBar.dataset.state = confidence < 35 ? 'low' : confidence < 68 ? 'medium' : 'high';
    }
  }

  function formatEnvironmentTime(hour) {
    const normalized = ((Number(hour) % 24) + 24) % 24;
    const h = Math.floor(normalized);
    const m = Math.floor((normalized - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function updateEnvironment(snapshot) {
    const environment = snapshot.environment;
    if (!environment) return;
    const sea = Math.round(Number(environment.seaState || 0));
    const visibilityKm = Number(environment.visibilityMeters || 0) / 1000;
    if (els.environmentTime) els.environmentTime.textContent = formatEnvironmentTime(environment.hour);
    if (els.environmentSeaState) els.environmentSeaState.textContent = `${sea}/6 · B${environment.beaufort}`;
    if (els.environmentVisibility) els.environmentVisibility.textContent = visibilityKm >= 10 ? `${visibilityKm.toFixed(0)} km` : `${visibilityKm.toFixed(1)} km`;
    if (els.environmentWind) els.environmentWind.textContent = `${Math.round(environment.windKnots)} kn · ${String(Math.round(environment.windBearing) % 360).padStart(3, '0')}°`;
    if (els.environmentLayer) els.environmentLayer.textContent = `${Math.round(environment.thermalLayerDepth)} m`;
    if (els.environmentNoise) els.environmentNoise.textContent = `${Math.round(environment.ambientNoise)}%`;
    if (els.hudEnvironment) els.hudEnvironment.textContent = `${t(`environment.light.${environment.lightCondition || 'day'}`)} · ${sea}/6`;
    const ocean = classifyOceanWeather({ environment, physics: snapshot.physics || {}, sensors: snapshot.sensors || {} });
    if (els.oceanWeatherPanel) {
      els.oceanWeatherPanel.dataset.sea = ocean.seaBand;
      els.oceanWeatherPanel.dataset.visibility = ocean.visibilityBand;
      els.oceanWeatherPanel.dataset.storm = ocean.isStorm ? 'true' : 'false';
    }
    if (els.oceanSeverity) els.oceanSeverity.textContent = `${ocean.seaSeverity}% · ${t(`ocean.sea.${ocean.seaBand}`)}`;
    if (els.oceanCover) els.oceanCover.textContent = `${ocean.coverScore}% · ${t(`ocean.visibility.${ocean.visibilityBand}`)}`;
    if (els.oceanSurfaceRisk) els.oceanSurfaceRisk.textContent = `${ocean.surfaceRisk}%`;
    if (els.oceanSonarEffect) els.oceanSonarEffect.textContent = `${ocean.sonarDegradation}%`;
    if (els.oceanRecommendedDepth) els.oceanRecommendedDepth.textContent = `${ocean.recommendedDepth} m`;
    if (els.oceanAdvice) els.oceanAdvice.textContent = t(ocean.adviceKey);
    if (els.environmentStrip) {
      els.environmentStrip.dataset.sea = sea >= 5 ? 'heavy' : sea >= 3 ? 'moderate' : 'calm';
      els.environmentStrip.dataset.light = environment.lightCondition || 'day';
    }
    const screen = app.querySelector('.gameplay-screen');
    if (screen) {
      screen.dataset.environmentLight = environment.lightCondition || 'day';
      screen.dataset.environmentSea = sea >= 5 ? 'heavy' : sea >= 3 ? 'moderate' : 'calm';
    }
    const optics = createPeriscopeOpticsSolution({ snapshot, periscopeZoom });
    if (els.periscopeOpticalQuality) {
      els.periscopeOpticalQuality.textContent = `${optics.opticalQuality}%`;
      els.periscopeOpticalQuality.dataset.state = optics.opticalQuality < 32 ? 'critical' : optics.opticalQuality < 58 ? 'warning' : 'safe';
    }
    if (els.periscopeMastWake) {
      els.periscopeMastWake.textContent = `${optics.mastWakeRisk}%`;
      els.periscopeMastWake.dataset.state = optics.mastWakeRisk >= 68 ? 'critical' : optics.mastWakeRisk >= 38 ? 'warning' : 'safe';
    }
    if (els.periscopeDepthEnvelope) {
      els.periscopeDepthEnvelope.textContent = t('periscope.depthEnvelopeValue', { depth: Math.round(snapshot.depth || 0), ideal: Math.round(optics.periscopeDepth), delta: optics.depthDelta.toFixed(1) });
      els.periscopeDepthEnvelope.dataset.state = optics.depthDelta > 10 ? 'critical' : optics.depthDelta > 4 ? 'warning' : 'safe';
    }
    if (els.periscopeEstimatedRange) els.periscopeEstimatedRange.textContent = optics.estimatedRangeMeters ? `${Math.round(optics.estimatedRangeMeters)} m` : '--';
    if (els.periscopeEstimatedSpeed) els.periscopeEstimatedSpeed.textContent = optics.estimatedSpeedKnots ? `${optics.estimatedSpeedKnots.toFixed(1)} kn` : '--';
    if (els.periscopeErrorWindow) {
      els.periscopeErrorWindow.textContent = `±${optics.rangeError}% / ±${optics.speedError.toFixed(1)} kn`;
      els.periscopeErrorWindow.dataset.state = optics.state;
    }

    if (els.periscopeModal) {
      els.periscopeModal.dataset.light = environment.lightCondition || 'day';
      els.periscopeModal.dataset.sea = sea >= 5 ? 'heavy' : sea >= 3 ? 'moderate' : 'calm';
      els.periscopeModal.style.setProperty('--environment-daylight', `${clamp(environment.daylight, 0, 100) / 100}`);
      els.periscopeModal.style.setProperty('--environment-rain', `${clamp(environment.precipitation, 0, 100) / 100}`);
      els.periscopeModal.style.setProperty('--environment-visibility', `${clamp(environment.visualFactor, 0.16, 1.12)}`);
      els.periscopeModal.style.setProperty('--environment-roll', `${Number(environment.rollDegrees || 0).toFixed(2)}deg`);
      els.periscopeModal.style.setProperty('--environment-pitch', `${Number(environment.pitchDegrees || 0).toFixed(2)}deg`);
    }
    if (els.periscopeVisualQuality) {
      const quality = clamp(Number(environment.visualFactor || 0) * 100, 0, 100);
      els.periscopeVisualQuality.textContent = `${Math.round(quality)}%`;
      els.periscopeVisualQuality.dataset.state = quality < 35 ? 'critical' : quality < 65 ? 'warning' : 'safe';
    }
    if (els.periscopeSeaState) els.periscopeSeaState.textContent = `${sea}/6`;
    updateOperationalAmbience(snapshot);
  }

  function updateHydrophoneWaterfall(sensors) {
    if (!els.hydrophoneWaterfall) return;
    const rows = [...els.hydrophoneWaterfall.querySelectorAll('[data-waterfall-row]')];
    const targetHistory = sensors.contacts?.target?.history || [];
    const escortHistory = sensors.contacts?.escort?.history || [];
    rows.forEach((row, index) => {
      const target = targetHistory[targetHistory.length - rows.length + index];
      const escort = escortHistory[escortHistory.length - rows.length + index];
      const targetMarker = row.querySelector('span');
      const escortMarker = row.querySelector('b');
      const setMarker = (marker, sample, contact) => {
        if (!marker) return;
        const visible = sample && sample.bearing !== null && contact?.detected;
        marker.classList.toggle('visible', Boolean(visible));
        if (!visible) return;
        marker.style.left = `${clamp(Number(sample.bearing) / 360, 0, 1) * 100}%`;
        marker.style.opacity = `${clamp((contact.signal || 0) / 100, 0.18, 1)}`;
      };
      setMarker(targetMarker, target, sensors.contacts?.target);
      setMarker(escortMarker, escort, sensors.contacts?.escort);
    });
  }

  function updateSensors(snapshot) {
    const sensors = snapshot.sensors;
    if (!sensors) return;
    const profile = sensors.profile || {};
    const target = sensors.contacts?.target || {};
    const escort = sensors.contacts?.escort || {};
    if (els.radarScan) {
      els.radarScan.style.transform = `translate(-50%, -50%) rotate(${sensors.radarSweepAngle || 0}deg)`;
      els.radarScan.classList.toggle('inactive', sensors.mode !== 'radar' || !sensors.radarMastRaised);
    }
    if (els.hydrophoneBearingLine) {
      els.hydrophoneBearingLine.style.transform = `translate(-50%, -100%) rotate(${sensors.hydrophoneBearing || 0}deg)`;
      els.hydrophoneBearingLine.classList.toggle('inactive', sensors.mode !== 'hydrophone');
    }
    els.activePingWave?.classList.toggle('hidden', !(sensors.activePingFlashMs > 0));
    updateContactPlot(els.radarTarget, target, profile);
    updateContactPlot(els.radarEscort, escort, profile);
    updateContactCard('target', target);
    updateContactCard('escort', escort);
    updateHydrophoneWaterfall(sensors);
    if (els.sensorModeBadge) els.sensorModeBadge.textContent = t(sensors.mode === 'radar' ? 'sensors.modeRadar' : 'sensors.modeHydrophone');
    if (els.sonarBearingTuner) els.sonarBearingTuner.textContent = `${String(Math.round(snapshot.sensors?.hydrophoneBearing ?? 0)).padStart(3, '0')}°`;
    if (els.sensorBearing) els.sensorBearing.textContent = `${String(Math.round(sensors.hydrophoneBearing || 0) % 360).padStart(3, '0')}°`;
    if (els.sensorPassiveRange) els.sensorPassiveRange.textContent = `${Math.round((profile.hydrophoneRangeMeters || 0) / 100) / 10} km`;
    if (els.sensorRadarRange) els.sensorRadarRange.textContent = profile.radarAvailable ? `${Math.round((profile.radarRangeMeters || 0) / 100) / 10} km` : t('sensors.unavailableForYear');
    if (els.sensorIntegrity) els.sensorIntegrity.textContent = `${Math.round(snapshot.systems?.sonar ?? 100)}%`;
    if (els.sensorContactCount) els.sensorContactCount.textContent = `${sensors.visibleContactCount || 0}`;
    if (els.hudContacts) els.hudContacts.textContent = `${sensors.visibleContactCount || 0}`;
    if (els.hydrophoneListen) {
      els.hydrophoneListen.disabled = !sensors.strongestContact || snapshot.missionFailed || (snapshot.systems?.sonar ?? 100) <= 10;
      els.hydrophoneListen.dataset.role = sensors.strongestContact?.role || 'unknown';
    }
    if (els.sensorMessage) {
      els.sensorMessage.textContent = t(sensors.lastMessageKey || 'sensors.ready', { year: profile.radarIntroduction || 1941 });
      els.sensorMessage.classList.toggle('warning', !profile.radarAvailable || sensors.activePingCooldownMs > 0);
    }
    if (els.activeSonarPing) {
      const seconds = Math.ceil((sensors.activePingCooldownMs || 0) / 1000);
      els.activeSonarPing.disabled = snapshot.missionFailed || snapshot.repairTicks > 0 || seconds > 0 || (snapshot.systems?.sonar ?? 100) <= 10;
      els.activeSonarPing.textContent = seconds > 0 ? t('sensors.activePingCooldown', { seconds }) : t('sensors.activePing');
    }
    if (els.sonarOwnNoise) els.sonarOwnNoise.textContent = `${Math.round(snapshot.physics?.noise ?? 0)}%`;
    if (els.sonarLayerEffect) els.sonarLayerEffect.textContent = `${Math.round(snapshot.environment?.thermalLayerDepth ?? 0)} m`;
    if (els.sonarPingRisk) els.sonarPingRisk.textContent = t((sensors.activePingCooldownMs || 0) > 0 ? 'sonarRoom.riskHigh' : (snapshot.physics?.noise || 0) > 55 ? 'sonarRoom.riskMedium' : 'sonarRoom.riskLow');
    if (els.radarMastToggle) {
      els.radarMastToggle.disabled = snapshot.missionFailed || snapshot.repairTicks > 0 || !profile.radarAvailable || (!sensors.radarMastRaised && snapshot.depth > profile.radarMastMaxDepth);
      els.radarMastToggle.textContent = sensors.radarMastRaised ? t('sensors.lowerRadarMast') : t('sensors.raiseRadarMast');
      els.radarMastToggle.classList.toggle('active', sensors.radarMastRaised);
    }
    app.querySelectorAll('.sensor-mode-chip').forEach((button) => {
      button.classList.toggle('active', button.dataset.sensorMode === sensors.mode);
      if (button.dataset.sensorMode === 'radar') button.disabled = !profile.radarAvailable;
    });
  }

  function formatCoordinate(value, positive, negative) {
    const absolute = Math.abs(Number(value) || 0);
    const degrees = Math.floor(absolute);
    const minutes = (absolute - degrees) * 60;
    return `${degrees}°${minutes.toFixed(2)}′${Number(value) >= 0 ? positive : negative}`;
  }

  function formatPosition(position) {
    if (!position) return '--';
    return `${formatCoordinate(position.lat, 'N', 'S')} ${formatCoordinate(position.lon, 'E', 'W')}`;
  }

  function mapPoint(position, bounds) {
    const width = 1000;
    const height = 560;
    const lonSpan = Math.max(0.001, Number(bounds.east) - Number(bounds.west));
    const latSpan = Math.max(0.001, Number(bounds.north) - Number(bounds.south));
    return {
      x: clamp(((Number(position.lon) - Number(bounds.west)) / lonSpan) * width, 0, width),
      y: clamp(((Number(bounds.north) - Number(position.lat)) / latSpan) * height, 0, height),
    };
  }

  function updateNavigation(snapshot) {
    const navigation = snapshot.navigation;
    if (!navigation) return;
    const heading = Math.round(navigation.heading) % 360;
    const ordered = Math.round(navigation.orderedHeading) % 360;
    const positionText = formatPosition(navigation.position);
    if (els.hudPosition) els.hudPosition.textContent = positionText;
    if (els.hudHeading) els.hudHeading.textContent = `${String(heading).padStart(3, '0')}°`;
    if (els.hudCompression) els.hudCompression.textContent = `×${navigation.timeCompression}`;
    if (els.navPosition) els.navPosition.textContent = positionText;
    if (els.navHeading) els.navHeading.textContent = `${String(heading).padStart(3, '0')}°`;
    if (els.navOrdered) els.navOrdered.textContent = `${String(ordered).padStart(3, '0')}°`;
    if (els.navRudder) {
      const rudder = Math.round(navigation.rudder);
      const side = rudder < 0 ? t('navigation.portShort') : rudder > 0 ? t('navigation.starboardShort') : t('navigation.midshipsShort');
      els.navRudder.textContent = `${Math.abs(rudder)}° ${side}`;
    }
    if (els.navSpeed) els.navSpeed.textContent = `${Number(navigation.speedKnots || 0).toFixed(1)} kn`;
    const activeWaypoint = navigation.route?.[navigation.activeWaypointIndex] || null;
    if (els.navWaypoint) {
      els.navWaypoint.textContent = activeWaypoint
        ? `${navigation.activeWaypointIndex + 1}/${navigation.route.length} · ${t(activeWaypoint.labelKey || 'navigation.waypointCustom')}`
        : t('navigation.routeComplete');
    }
    if (els.navDistance) els.navDistance.textContent = `${Number(navigation.routeDistanceNm || 0).toFixed(2)} NM`;
    if (els.navEta) {
      const eta = navigation.etaHours;
      els.navEta.textContent = eta === null || !Number.isFinite(Number(eta))
        ? '--'
        : Number(eta) < 1 ? `${Math.max(1, Math.round(Number(eta) * 60))} min` : `${Number(eta).toFixed(1)} h`;
    }
    if (els.navAutopilot) {
      els.navAutopilot.textContent = navigation.autopilot ? t('navigation.autopilotOn') : t('navigation.autopilotOff');
      els.navAutopilot.classList.toggle('active', navigation.autopilot);
    }
    if (els.navSectorBadge) {
      els.navSectorBadge.textContent = navigation.patrolEntered ? t('navigation.sectorEntered') : t('navigation.sectorOutside');
      els.navSectorBadge.classList.toggle('inside', navigation.patrolEntered);
    }
    els.objNavigation?.classList.toggle('done', navigation.patrolEntered);
    if (els.navCompressionStatus) {
      els.navCompressionStatus.textContent = navigation.safetyLimited
        ? t('navigation.compressionLimited', { value: navigation.timeCompression })
        : t('navigation.compressionSafe');
      els.navCompressionStatus.classList.toggle('warning', navigation.safetyLimited);
    }
    app.querySelectorAll('.compression-chip').forEach((button) => {
      const value = Number(button.dataset.compression);
      button.classList.toggle('active', value === navigation.timeCompression);
      button.classList.toggle('requested', value === navigation.requestedTimeCompression && value !== navigation.timeCompression);
      button.disabled = value > navigation.safetyLimit;
    });
    app.querySelectorAll('.rudder-chip').forEach((button) => {
      button.classList.toggle('active', Math.round(Number(button.dataset.rudder)) === Math.round(navigation.rudder));
    });

    const bounds = navigation.mapBounds;
    if (!bounds) return;
    const playerPoint = mapPoint(navigation.position, bounds);
    if (els.navPlayer) els.navPlayer.setAttribute('transform', `translate(${playerPoint.x.toFixed(2)} ${playerPoint.y.toFixed(2)}) rotate(${navigation.heading.toFixed(2)})`);
    if (els.navHeadingVector) {
      const length = 82;
      const radians = navigation.orderedHeading * Math.PI / 180;
      els.navHeadingVector.setAttribute('x1', playerPoint.x.toFixed(2));
      els.navHeadingVector.setAttribute('y1', playerPoint.y.toFixed(2));
      els.navHeadingVector.setAttribute('x2', (playerPoint.x + Math.sin(radians) * length).toFixed(2));
      els.navHeadingVector.setAttribute('y2', (playerPoint.y - Math.cos(radians) * length).toFixed(2));
    }
    const sector = navigation.patrolSector;
    if (els.navSector && sector) {
      const topLeft = mapPoint({ lat: sector.north, lon: sector.west }, bounds);
      const bottomRight = mapPoint({ lat: sector.south, lon: sector.east }, bounds);
      els.navSector.setAttribute('x', topLeft.x.toFixed(2));
      els.navSector.setAttribute('y', topLeft.y.toFixed(2));
      els.navSector.setAttribute('width', Math.max(0, bottomRight.x - topLeft.x).toFixed(2));
      els.navSector.setAttribute('height', Math.max(0, bottomRight.y - topLeft.y).toFixed(2));
      els.navSector.classList.toggle('entered', navigation.patrolEntered);
    }
    const points = [navigation.position, ...(navigation.route || []).slice(navigation.activeWaypointIndex)].map((item) => mapPoint(item, bounds));
    if (els.navRouteLine) els.navRouteLine.setAttribute('points', points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '));
    if (els.navWaypoints) {
      const svgNamespace = 'http://www.w3.org/2000/svg';
      els.navWaypoints.replaceChildren();
      (navigation.route || []).forEach((waypoint, index) => {
        const point = mapPoint(waypoint, bounds);
        const group = document.createElementNS(svgNamespace, 'g');
        group.setAttribute('class', `navigation-waypoint${index === navigation.activeWaypointIndex ? ' active' : ''}${index < navigation.activeWaypointIndex ? ' completed' : ''}`);
        group.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
        const circle = document.createElementNS(svgNamespace, 'circle');
        circle.setAttribute('r', index === navigation.activeWaypointIndex ? '17' : '13');
        const text = document.createElementNS(svgNamespace, 'text');
        text.setAttribute('y', '5');
        text.textContent = String(index + 1);
        group.append(circle, text);
        els.navWaypoints.append(group);
      });
    }
  }

  function weaponStatusKey(weapons = {}) {
    const status = weapons.tdc?.solutionStatus || 'noContact';
    const map = {
      noContact: 'weapons.statusNoContact', poor: 'weapons.statusPoor', marginal: 'weapons.statusMarginal',
      good: 'weapons.statusGood', excellent: 'weapons.statusExcellent',
    };
    return map[status] || 'weapons.statusNoContact';
  }

  function updateWeapons(snapshot) {
    const weapons = snapshot.weapons;
    if (!weapons) return;
    const tdc = weapons.tdc || {};
    const quality = clamp(Number(tdc.solutionQuality || 0), 0, 100);
    if (els.weaponsStatus) {
      els.weaponsStatus.textContent = t(weaponStatusKey(weapons));
      els.weaponsStatus.dataset.state = quality >= 78 ? 'excellent' : quality >= 58 ? 'good' : quality >= weapons.minimumSolutionQuality ? 'marginal' : 'poor';
    }
    if (els.weaponsLoadedCount) els.weaponsLoadedCount.textContent = String(weapons.loadedTubeCount || 0);
    if (els.weaponsReserveCount) els.weaponsReserveCount.textContent = String(weapons.reserveTorpedoes || 0);
    if (els.weaponsFailureRate) els.weaponsFailureRate.textContent = `${Math.round((weapons.profile?.baseFailureRate || 0) * 100)}%`;
    if (els.weaponsMaxDepth) els.weaponsMaxDepth.textContent = `${Math.round(weapons.profile?.maxLaunchDepth || 60)} m`;
    if (els.tdcQuality) els.tdcQuality.textContent = `${Math.round(quality)}%`;
    if (els.tdcQualityBar) {
      els.tdcQualityBar.style.width = `${quality}%`;
      els.tdcQualityBar.dataset.state = quality >= 78 ? 'excellent' : quality >= 58 ? 'good' : quality >= weapons.minimumSolutionQuality ? 'marginal' : 'poor';
    }
    if (els.tdcBearing) els.tdcBearing.textContent = tdc.bearing === null || tdc.bearing === undefined ? '--' : `${String(Math.round(tdc.bearing) % 360).padStart(3, '0')}°`;
    if (els.tdcRange) els.tdcRange.textContent = tdc.rangeMeters === null || tdc.rangeMeters === undefined ? '--' : `${Math.round(tdc.rangeMeters)} m`;
    if (els.tdcGyro) els.tdcGyro.textContent = `${String(Math.round(tdc.gyroAngle || 0) % 360).padStart(3, '0')}°`;
    if (els.tdcConfidence) els.tdcConfidence.textContent = `${Math.round(tdc.contactConfidence || 0)}%`;
    const inputMap = [[els.tdcTargetSpeed, tdc.targetSpeedKnots], [els.tdcTargetCourse, tdc.targetCourse], [els.tdcAob, tdc.aobDegrees], [els.tdcRunDepth, tdc.runDepthMeters]];
    inputMap.forEach(([input, value]) => { if (input && document.activeElement !== input) input.value = Number(value || 0).toFixed(input.step === '0.5' ? 1 : 0); });
    app.querySelectorAll('.torpedo-tube').forEach((button) => {
      const tube = weapons.tubes?.find((item) => item.id === button.dataset.tubeId);
      button.classList.toggle('hidden', !tube);
      if (!tube) return;
      button.classList.toggle('selected', tube.id === weapons.selectedTubeId);
      button.classList.toggle('loaded', tube.loaded);
      button.classList.toggle('reloading', !tube.loaded && tube.reloadMs > 0);
      button.classList.toggle('empty', !tube.loaded && tube.reloadMs <= 0);
      button.querySelector('span').textContent = tube.label;
      const label = tube.loaded ? t('weapons.loaded') : tube.reloadMs > 0 ? t('weapons.reloading', { seconds: Math.ceil(tube.reloadMs / 1000) }) : t('weapons.empty');
      button.querySelector('b').textContent = label;
      const progress = tube.loaded ? 100 : tube.reloadMs > 0 ? 100 - (tube.reloadMs / Math.max(1, tube.reloadDurationMs)) * 100 : 0;
      button.querySelector('i').style.setProperty('--tube-progress', `${clamp(progress, 0, 100)}%`);
      button.disabled = snapshot.missionFailed;
    });
    app.querySelectorAll('.weapon-target-chip').forEach((button) => button.classList.toggle('active', button.dataset.weaponTarget === weapons.selectedTarget));
    app.querySelectorAll('.salvo-chip').forEach((button) => button.classList.toggle('active', Number(button.dataset.salvoSize) === weapons.salvoSize));
    app.querySelectorAll('.torpedo-type-chip').forEach((button) => button.classList.toggle('active', button.dataset.torpedoType === tdc.torpedoType));
    if (els.weaponsMessage) els.weaponsMessage.textContent = t(weapons.lastMessageKey || 'weapons.ready');
    if (els.weaponsFire) els.weaponsFire.disabled = !weapons.canFire || snapshot.repairTicks > 0 || snapshot.missionFailed;
    if (els.tdcSync) els.tdcSync.disabled = snapshot.missionFailed || snapshot.repairTicks > 0;
  }

  function updateDamageControl(snapshot) {
    const damage = snapshot.damageControl;
    if (!damage) return;
    const flooding = clamp(Number(damage.totalFlooding || 0), 0, 100);
    const fire = clamp(Number(damage.totalFire || 0), 0, 100);
    const power = clamp(Number(damage.busVoltage || 0), 0, 100);
    const morale = clamp(Number(damage.morale || 0), 0, 100);
    const status = damage.criticalFailure || damage.criticalCompartments >= 2 ? 'critical' : damage.criticalCompartments > 0 || flooding >= 25 || fire >= 20 ? 'danger' : flooding > 3 || fire > 3 || damage.casualtyTotals?.injured > 0 ? 'warning' : 'secure';
    if (els.damageStatusBadge) {
      els.damageStatusBadge.textContent = t(`damage.status.${status}`);
      els.damageStatusBadge.dataset.state = status;
    }
    const setDamageMeter = (valueEl, barEl, value, inverse = false) => {
      if (valueEl) valueEl.textContent = `${Math.round(value)}%`;
      if (barEl) {
        barEl.style.width = `${clamp(value, 0, 100)}%`;
        const risk = inverse ? 100 - value : value;
        barEl.dataset.state = risk >= 70 ? 'critical' : risk >= 35 ? 'warning' : 'safe';
      }
    };
    setDamageMeter(els.damageTotalFlooding, els.damageFloodingBar, flooding);
    setDamageMeter(els.damageTotalFire, els.damageFireBar, fire);
    setDamageMeter(els.damagePower, els.damagePowerBar, power, true);
    setDamageMeter(els.damageMorale, els.damageMoraleBar, morale, true);
    setDamageMeter(els.damagePressureIngress, els.damagePressureBar, Number(damage.pressureIngress || 0));
    setDamageMeter(els.damageSmokeLoad, els.damageSmokeBar, Number(damage.smokeLoad || 0));
    setDamageMeter(els.damageStability, els.damageStabilityBar, Number(damage.compartmentStability ?? 100), true);
    if (els.damagePosture) els.damagePosture.textContent = t(`damage.posture.${damage.emergencyPosture || 'normal'}.short`);
    app.querySelectorAll('.damage-posture-chip').forEach((button) => {
      button.classList.toggle('active', button.dataset.damagePosture === (damage.emergencyPosture || 'normal'));
      button.disabled = snapshot.missionFailed;
    });
    if (els.damageVentilation) els.damageVentilation.disabled = snapshot.missionFailed || (!damage.mainPower && !damage.emergencyPower);
    if (els.damageCrewFit) els.damageCrewFit.textContent = String(damage.casualtyTotals?.fit || 0);
    if (els.damageCrewInjured) els.damageCrewInjured.textContent = String(damage.casualtyTotals?.injured || 0);
    if (els.damageCrewDead) els.damageCrewDead.textContent = String(damage.casualtyTotals?.dead || 0);
    if (els.damageCriticalCount) els.damageCriticalCount.textContent = String(damage.criticalCompartments || 0);
    if (els.damageDoorsToggle) {
      els.damageDoorsToggle.textContent = damage.watertightDoorsClosed ? t('damage.openDoors') : t('damage.closeDoors');
      els.damageDoorsToggle.classList.toggle('active', damage.watertightDoorsClosed);
    }
    if (els.damagePumpsToggle) {
      els.damagePumpsToggle.textContent = damage.pumpsActive ? t('damage.pumpsOn') : t('damage.pumpsOff');
      els.damagePumpsToggle.classList.toggle('active', damage.pumpsActive);
      els.damagePumpsToggle.disabled = !damage.mainPower && !damage.emergencyPower && !damage.pumpsActive;
    }
    if (els.damageEmergencyPower) {
      els.damageEmergencyPower.textContent = damage.emergencyPower ? t('damage.emergencyPowerOn') : t('damage.emergencyPowerOff');
      els.damageEmergencyPower.classList.toggle('active', damage.emergencyPower);
    }
    if (els.damageMessage) els.damageMessage.textContent = t(damage.lastMessageKey || 'damage.ready');
    if (els.damageTeamList) {
      els.damageTeamList.innerHTML = (damage.teams || []).map((team) => {
        const room = (damage.compartments || []).find((item) => item.id === team.compartmentId);
        const assignment = room ? `${t(room.labelKey)} · ${t(`damage.task.${team.task}`)}` : t('damage.teamIdle');
        return `<article class="damage-team-card${team.compartmentId ? ' assigned' : ''}"><div><strong>${t(team.labelKey)}</strong><span>${assignment}</span></div><i><em style="width:${clamp(100 - Number(team.fatigue || 0), 0, 100)}%"></em></i><button class="damage-recall-team" data-team-id="${team.id}" ${team.compartmentId ? '' : 'disabled'}>${t('damage.recall')}</button></article>`;
      }).join('');
    }
    app.querySelectorAll('.damage-compartment-card').forEach((card) => {
      const compartment = (damage.compartments || []).find((item) => item.id === card.dataset.compartmentId);
      if (!compartment) return;
      const condition = clamp(Number(compartment.integrity || 0) - Number(compartment.flooding || 0) * 0.35 - Number(compartment.fire || 0) * 0.4, 0, 100);
      card.querySelector('[data-role="condition"]').textContent = `${Math.round(condition)}%`;
      card.querySelector('[data-role="flooding"]').textContent = `${Math.round(compartment.flooding || 0)}%`;
      card.querySelector('[data-role="fire"]').textContent = `${Math.round(compartment.fire || 0)}%`;
      card.querySelector('[data-role="electrical"]').textContent = `${Math.round(compartment.electricalDamage || 0)}%`;
      card.querySelector('[data-role="crew"]').textContent = `${compartment.casualties?.fit || 0}/${compartment.crew || 0}`;
      const team = (damage.teams || []).find((item) => item.id === compartment.assignedTeamId);
      card.querySelector('[data-role="assignment"]').textContent = team ? `${t(team.labelKey)} · ${t(`damage.task.${team.task}`)}` : t('damage.assignSelected');
      card.dataset.state = compartment.flooding >= 75 || compartment.fire >= 75 || compartment.integrity <= 25 ? 'critical' : compartment.flooding >= 30 || compartment.fire >= 25 || compartment.integrity <= 60 ? 'warning' : 'safe';
      card.classList.toggle('assigned', Boolean(team));
      card.disabled = snapshot.missionFailed;
    });
  }

  function updateNavalAI(snapshot) {
    const ai = snapshot.navalAI;
    if (!ai) return;
    const profile = ai.profile || {};
    const state = ai.globalState || ai.state?.globalState || 'formation';
    const threat = ai.threatLevel || 'clear';
    if (els.hudConvoy) els.hudConvoy.textContent = `${ai.activeMerchants || 0}/${profile.merchantCount || 0}`;
    if (els.hudAsw) {
      els.hudAsw.textContent = t(`ai.threat.${threat}`);
      els.hudAsw.dataset.state = threat;
    }
    if (els.aiStateBadge) {
      els.aiStateBadge.textContent = t(`ai.state.${state}`);
      els.aiStateBadge.dataset.state = state;
    }
    if (els.aiMerchantsActive) els.aiMerchantsActive.textContent = `${ai.activeMerchants || 0}/${profile.merchantCount || 0}`;
    if (els.aiEscortsActive) els.aiEscortsActive.textContent = `${ai.activeEscorts || 0}/${profile.escortCount || 0}`;
    if (els.aiNearestEscort) els.aiNearestEscort.textContent = ai.nearestEscortRange === null || ai.nearestEscortRange === undefined ? '--' : `${Math.round(ai.nearestEscortRange * 4)} m`;
    if (els.aiFormationStatus) els.aiFormationStatus.textContent = ai.destroyedShips > 0 ? t('ai.formationDisrupted') : state === 'formation' ? t('ai.formationIntact') : t('ai.formationEvasive');
    const aircraft = ai.aircraft || {};
    if (els.aiAircraftStatus) {
      const aircraftKey = !aircraft.available ? 'ai.aircraftUnavailable' : !aircraft.active ? 'ai.aircraftStandby' : aircraft.state === 'attack' ? 'ai.aircraftAttacking' : aircraft.state === 'tracking' ? 'ai.aircraftTracking' : 'ai.aircraftPatrol';
      els.aiAircraftStatus.textContent = t(aircraftKey);
      els.aiAircraftStatus.dataset.state = aircraft.active ? aircraft.state : 'standby';
    }
    const patterns = ai.depthChargePatterns || [];
    if (els.aiPatternCount) els.aiPatternCount.textContent = `${patterns.length}`;
    if (els.aiContactConfidence) els.aiContactConfidence.textContent = `${Math.round(ai.contactConfidence || 0)}%`;
    if (els.aiAttackSolution) els.aiAttackSolution.textContent = `${Math.round(ai.attackSolution || 0)}%`;
    if (els.aiDepthChargeAlert) {
      const nextPattern = patterns.slice().sort((a, b) => Number(a.remainingMs || 0) - Number(b.remainingMs || 0))[0];
      els.aiDepthChargeAlert.textContent = nextPattern
        ? t('ai.depthChargeCountdown', { seconds: Math.max(1, Math.ceil(Number(nextPattern.remainingMs || 0) / 1000)), count: nextPattern.charges || 1 })
        : t('ai.noDepthCharges');
      els.aiDepthChargeAlert.className = `ai-depth-charge-alert ${nextPattern ? 'critical' : threat}`;
    }
    if (els.aiMessage) els.aiMessage.textContent = t(ai.lastMessageKey || 'ai.formationHolding');
    if (els.aiTacticalPlot) {
      const persistent = '<i class="ai-range-ring ring-one"></i><i class="ai-range-ring ring-two"></i><span class="ai-player-marker" title="' + t('ai.playerSubmarine') + '"></span>';
      const shipMarkup = (ai.ships || []).map((ship) => {
        const left = clamp(50 + Number(ship.x || 0) / 8, 4, 96);
        const top = clamp(50 + Number(ship.y || 0) / 6, 4, 96);
        const roleClass = ship.role === 'target' || ship.role === 'convoy' ? 'merchant' : 'escort';
        const destroyed = ship.destroyed ? ' destroyed' : '';
        const label = `${ship.shipType || roleClass} · ${ship.state || ''}`;
        return `<span class="ai-contact-marker ${roleClass}${destroyed}" style="left:${left.toFixed(1)}%;top:${top.toFixed(1)}%" title="${label}"></span>`;
      }).join('');
      const aircraftMarkup = aircraft.active
        ? `<span class="ai-contact-marker aircraft" style="left:${clamp(50 + Number(aircraft.x || 0) / 8, 4, 96).toFixed(1)}%;top:${clamp(50 + Number(aircraft.y || 0) / 6, 4, 96).toFixed(1)}%" title="${t('ai.aircraft')}"></span>`
        : '';
      els.aiTacticalPlot.innerHTML = persistent + shipMarkup + aircraftMarkup;
      els.aiTacticalPlot.dataset.threat = threat;
    }
  }

  function updateEncounter(snapshot) {
    const encounter = snapshot.encounter;
    if (!encounter) return;
    const phase = encounter.phase || 'patrol';
    if (els.encounterPhase) {
      els.encounterPhase.textContent = t(`encounter.phase.${phase}`);
      els.encounterPhase.dataset.phase = phase;
    }
    if (els.encounterContactState) {
      const key = encounter.contactLost
        ? 'encounter.contactLost'
        : encounter.contactQuality >= 65
          ? 'encounter.contactFirm'
          : encounter.contactQuality >= 30 ? 'encounter.contactProbable' : 'encounter.contactUncertain';
      els.encounterContactState.textContent = t(key);
      els.encounterContactState.dataset.state = encounter.contactLost ? 'lost' : encounter.contactQuality >= 65 ? 'firm' : encounter.contactQuality >= 30 ? 'probable' : 'uncertain';
    }
    const values = [
      [els.encounterContactQuality, els.encounterContactBar, encounter.contactQuality],
      [els.encounterAttackReadiness, els.encounterAttackBar, encounter.attackReadiness],
      [els.encounterEnemySolution, els.encounterEnemyBar, encounter.enemySolution],
      [els.encounterEscapeProgress, els.encounterEscapeBar, encounter.escapeProgress],
    ];
    values.forEach(([label, bar, raw]) => {
      const value = clamp(Number(raw || 0), 0, 100);
      if (label) label.textContent = `${Math.round(value)}%`;
      if (bar) {
        bar.style.width = `${value}%`;
        bar.dataset.state = value >= 70 ? 'high' : value >= 35 ? 'medium' : 'low';
      }
    });
    if (els.encounterRecommendation) els.encounterRecommendation.textContent = t(encounter.recommendedKey || 'encounter.recommendObserve');
    const order = ['approach', 'shadow', 'attack', 'evade', 'disengage'];
    const phaseIndex = order.indexOf(phase);
    app.querySelectorAll('[data-encounter-step]').forEach((step) => {
      const index = order.indexOf(step.dataset.encounterStep);
      step.classList.toggle('active', step.dataset.encounterStep === phase);
      step.classList.toggle('complete', phase === 'complete' || (phaseIndex >= 0 && index < phaseIndex));
    });
    app.querySelectorAll('.encounter-doctrine').forEach((button) => {
      const selected = button.dataset.doctrine === encounter.doctrine;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.disabled = snapshot.missionFailed || phase === 'complete';
    });
  }

  function updatePeriscope(snapshot) {
    const environment = snapshot.environment || {};
    const roll = Number(environment.rollDegrees || 0);
    const pitch = Number(environment.pitchDegrees || 0);
    const horizonOffset = Number(environment.horizonOffset || 0);
    const visualFactor = clamp(Number(environment.visualFactor || 1), 0.16, 1.12);
    const precipitation = clamp(Number(environment.precipitation || 0), 0, 100);
    if (els.periscopeOcean) {
      const oceanX = -220 - (snapshot.view.x * 0.72);
      const oceanY = -18 - (snapshot.view.y * 0.52) + horizonOffset;
      els.periscopeOcean.style.transform = `translate(${oceanX}px, ${oceanY}px) rotate(${(roll * 0.42).toFixed(2)}deg)`;
      els.periscopeOcean.style.filter = `brightness(${(0.46 + clamp(environment.daylight, 0, 100) / 180).toFixed(2)}) saturate(${(0.62 + visualFactor * 0.38).toFixed(2)}) contrast(${(1.12 + precipitation / 500).toFixed(2)})`;
    }
    if (els.periscopeHorizon) {
      els.periscopeHorizon.style.transform = `translateY(${horizonOffset.toFixed(2)}px) rotate(${roll.toFixed(2)}deg)`;
      els.periscopeHorizon.style.opacity = `${clamp(visualFactor, 0.22, 0.88)}`;
    }
    if (els.periscopeWeather) {
      els.periscopeWeather.style.opacity = `${clamp(precipitation / 72, 0, 0.92)}`;
      els.periscopeWeather.dataset.active = precipitation >= 18 ? 'true' : 'false';
    }
    if (els.periscopeVisibilityLayer) {
      els.periscopeVisibilityLayer.style.opacity = `${clamp(1 - visualFactor, 0, 0.74)}`;
    }

    const escortPosition = worldToViewPosition(snapshot.escort, snapshot.view);
    const targetPosition = worldToViewPosition(snapshot.target, snapshot.view);
    const targetContact = snapshot.sensors?.contacts?.target;
    const visualRange = Math.max(700, Number(snapshot.sensors?.profile?.currentVisualRangeMeters || environment.visibilityMeters || 6000));
    const targetTrueRange = Math.hypot(Number(snapshot.target?.x || 0), Number(snapshot.target?.y || 0)) * 4;
    const targetInField = targetPosition.left >= 3 && targetPosition.left <= 97 && targetPosition.bottom >= 4 && targetPosition.bottom <= 92;
    const targetOpticallyVisible = targetTrueRange <= visualRange && visualFactor >= 0.16;
    if (snapshot.targetDestroyed || !snapshot.periscopeOpen || !targetInField || !targetOpticallyVisible) els.targetShip?.classList.add('hidden');
    else if (els.targetShip) {
      els.targetShip.classList.remove('hidden');
      els.targetShip.style.left = `${targetPosition.left}%`;
      els.targetShip.style.bottom = `${clamp(targetPosition.bottom + horizonOffset * 0.07, 2, 94)}%`;
      const distanceScale = clamp(1850 / Math.max(500, targetTrueRange), 0.24, 1.35);
      els.targetShip.style.scale = `${(distanceScale * periscopeZoom).toFixed(3)}`;
      els.targetShip.style.opacity = `${clamp(0.28 + visualFactor * 0.72, 0.22, 1)}`;
      els.targetShip.style.filter = `blur(${clamp((1 - visualFactor) * 2.2, 0, 2).toFixed(2)}px) saturate(.72) contrast(${(1.02 + (1 - visualFactor) * 0.35).toFixed(2)}) drop-shadow(0 5px 4px rgba(0,0,0,.45))`;
    }
    const escortContact = snapshot.sensors?.contacts?.escort;
    const escortTrueRange = Math.hypot(Number(snapshot.escort?.x || 0), Number(snapshot.escort?.y || 0)) * 4;
    const escortInField = escortPosition.left >= 3 && escortPosition.left <= 97 && escortPosition.bottom >= 4 && escortPosition.bottom <= 92;
    const escortOpticallyVisible = escortTrueRange <= visualRange && visualFactor >= 0.16;
    if (els.escortShip) {
      els.escortShip.classList.toggle('hidden', !snapshot.periscopeOpen || !escortInField || !escortOpticallyVisible || snapshot.escort?.destroyed);
      els.escortShip.style.left = `${escortPosition.left}%`;
      els.escortShip.style.bottom = `${clamp(escortPosition.bottom + horizonOffset * 0.07, 2, 94)}%`;
      const distanceScale = clamp(1850 / Math.max(500, escortTrueRange), 0.24, 1.35);
      els.escortShip.style.scale = `${(distanceScale * periscopeZoom).toFixed(3)}`;
      els.escortShip.style.opacity = `${clamp(0.24 + visualFactor * 0.68, 0.2, 0.94)}`;
      els.escortShip.style.filter = `blur(${clamp((1 - visualFactor) * 2.4, 0, 2.2).toFixed(2)}px) saturate(.68) contrast(1.12) drop-shadow(0 5px 4px rgba(0,0,0,.45))`;
    }
    if (els.lockLabel) {
      const locked = engine.targetLock();
      const solution = snapshot.weapons?.tdc?.solutionQuality || 0;
      els.lockLabel.textContent = snapshot.missionFailed
        ? t('gameplay.lockMissionLost')
        : snapshot.targetDestroyed
          ? t('gameplay.lockDestroyed')
          : snapshot.weapons?.canFire ? t('weapons.periscopeSolutionReady', { quality: Math.round(solution) })
            : locked ? t('weapons.periscopeSyncRequired') : t('gameplay.lockSearching');
      els.lockLabel.classList.toggle('active', Boolean(snapshot.weapons?.canFire) && !snapshot.missionFailed);
    }
    if (els.periscopeSensorReadout) {
      const contact = snapshot.sensors?.contacts?.target;
      els.periscopeSensorReadout.textContent = contact?.detected
        ? t('sensors.visualReadout', {
          bearing: `${String(Math.round(contact.bearing || 0) % 360).padStart(3, '0')}°`,
          range: formatSensorRange(contact),
          confidence: Math.round(contact.confidence || 0),
        })
        : t('sensors.visualAwaiting');
      els.periscopeSensorReadout.classList.toggle('active', Boolean(contact?.detected) && Number(contact?.confidence || 0) >= 35);
    }
    const visualContact = snapshot.sensors?.contacts?.target;
    if (els.periscopeBearing) {
      const sightBearing = ((Math.atan2(Number(snapshot.view?.x || 0), -Number(snapshot.view?.y || 0)) * 180 / Math.PI) + 360) % 360;
      els.periscopeBearing.textContent = `${String(Math.round(sightBearing) % 360).padStart(3, '0')}°`;
    }
    if (els.periscopeRange) els.periscopeRange.textContent = formatSensorRange(visualContact);
    if (els.periscopeExposure) {
      els.periscopeExposure.textContent = `${Math.round(snapshot.detectionScore || 0)}%`;
      els.periscopeExposure.dataset.state = snapshot.detectionScore >= 56 ? 'critical' : snapshot.detectionScore >= 28 ? 'warning' : 'safe';
    }
    if (els.periscopeMastTime) {
      const seconds = Math.round(Number(snapshot.encounter?.periscopeExposureMs || 0) / 1000);
      els.periscopeMastTime.textContent = `${seconds} s`;
      els.periscopeMastTime.dataset.state = seconds >= 22 ? 'critical' : seconds >= 12 ? 'warning' : 'safe';
    }
    if (els.periscopeModal) {
      els.periscopeModal.classList.toggle('hidden', !snapshot.periscopeOpen);
      els.periscopeModal.setAttribute('aria-hidden', snapshot.periscopeOpen ? 'false' : 'true');
      els.periscopeModal.style.setProperty('--scope-pitch', `${pitch.toFixed(2)}deg`);
    }
    return engine.targetLock();
  }

  function updateHUD(snapshot) {
    if (els.hudDepth) els.hudDepth.textContent = `${Math.round(snapshot.depth)} m`;
    if (els.hudSpeed) els.hudSpeed.textContent = `${Number(snapshot.physics?.actualSpeedKnots || 0).toFixed(1)} kn`;
    let alertText = escortStateLabel(snapshot);
    if (snapshot.depth > 230) alertText = t('gameplay.alertCritical');
    else if (snapshot.depth > 180) alertText = t('gameplay.alertWarning');
    else if (snapshot.speed === 'full' || snapshot.speed === 'flank') alertText = snapshot.escortState === 'patrol' ? t('gameplay.alertLoud') : alertText;
    if (snapshot.targetDestroyed) alertText = t('gameplay.alertSuccess');
    if (snapshot.missionFailed) alertText = t('gameplay.alertCritical');
    if (els.hudAlert) els.hudAlert.textContent = alertText;
    if (els.hudHull) els.hudHull.textContent = `${Math.round(snapshot.hull)}%`;
    if (els.hudTorpedoes) els.hudTorpedoes.textContent = `${snapshot.torpedoes}`;
    if (els.hudCondition) els.hudCondition.textContent = systemCondition(snapshot);
    if (els.hudBattery) els.hudBattery.textContent = `${Math.round(snapshot.physics?.battery ?? 100)}%`;
    if (els.hudOxygen) els.hudOxygen.textContent = `${Math.round(snapshot.physics?.oxygen ?? 100)}%`;
    if (els.engineStatus) els.engineStatus.textContent = snapshot.missionFailed ? t('engine.stopped') : t('engine.online');
    if (els.engineTick) els.engineTick.textContent = t('engine.tick', { tick: snapshot.worldTime });
    if (els.engineEntities) els.engineEntities.textContent = t('engine.entities', { count: snapshot.entityCount });
    updateSystemBars(snapshot);

    const canRepair = !snapshot.missionFailed && snapshot.hull > 0 && snapshot.hull < 92 && snapshot.repairUses > 0 && snapshot.repairTicks <= 0;
    if (els.emergencyRepair) {
      els.emergencyRepair.classList.toggle('hidden', !canRepair);
      els.emergencyRepair.disabled = !canRepair;
      if (canRepair) els.emergencyRepair.textContent = t('repair.emergencyWithUses', { uses: snapshot.repairUses });
    }
    const periscopeDisabled = snapshot.missionFailed || snapshot.repairTicks > 0 || (snapshot.systems.periscope ?? 100) <= 10;
    if (els.openPeriscope) els.openPeriscope.disabled = periscopeDisabled;
    if (els.openPeriscopeSecondary) els.openPeriscopeSecondary.disabled = periscopeDisabled;
    if (els.fireTorpedo) els.fireTorpedo.disabled = snapshot.missionFailed || snapshot.repairTicks > 0 || !snapshot.weapons?.canFire || (snapshot.systems.weapons ?? 100) <= 10;
    if (els.silentRunning) els.silentRunning.disabled = snapshot.missionFailed || snapshot.repairTicks > 0 || snapshot.silentTicks > 0;
    if (els.emergencyDive) els.emergencyDive.disabled = snapshot.missionFailed || snapshot.repairTicks > 0 || snapshot.emergencyDiveCooldown > 0;
    if (els.decoy) {
      els.decoy.disabled = snapshot.missionFailed || snapshot.repairTicks > 0 || snapshot.decoys <= 0;
      els.decoy.textContent = t('gameplay.decoyWithCount', { count: snapshot.decoys });
    }
    els.completeMission?.classList.toggle('hidden', !snapshot.canComplete || snapshot.missionFailed);
    updateHint(snapshot);
    updateObjectives(snapshot);
  }

  function updateAll(snapshot = engine.snapshot()) {
    updateTraining(snapshot);
    persistOperation(snapshot);
    updateInstruments(snapshot);
    updatePhysics(snapshot);
    updateEnvironment(snapshot);
    updateSensors(snapshot);
    updateWeapons(snapshot);
    updateDamageControl(snapshot);
    updateNavalAI(snapshot);
    updateEncounter(snapshot);
    updateHUD(snapshot);
    updateNavigation(snapshot);
    updatePeriscope(snapshot);
  }

  function showMissionFailure(snapshot) {
    operationResolved = true;
    onOperationCleared();
    els.completeMission?.classList.add('hidden');
    els.emergencyRepair?.classList.add('hidden');
    els.missionResult?.classList.remove('hidden');
    if (els.missionResultTitle) els.missionResultTitle.textContent = t('repair.missionLostTitle');
    if (els.missionResultText) els.missionResultText.textContent = t('repair.missionLostText');
    onHullUpdate(snapshot.hull, snapshot.systems);
  }

  function commandHint(result) {
    if (result.ok) return false;
    const keyMap = {
      repair: 'repair.inProgress',
      periscopeDown: 'gameplay.hintPeriscopeDown',
      tooDeep: 'gameplay.hintTooDeep',
      weaponsDown: 'gameplay.hintWeaponsDown',
      noTorpedoes: 'gameplay.hintNoTorpedoes',
      failed: 'gameplay.hintMissionFailed',
      routeFull: 'navigation.routeFull',
      emptyRoute: 'navigation.routeEmpty',
      invalidCompression: 'navigation.compressionInvalid',
      invalidBallast: 'physics.invalidBallast',
      cooldown: 'physics.emergencyBlowCooldown',
      invalidSensorMode: 'sensors.invalidMode',
      radarEraUnavailable: 'sensors.radarEraUnavailable',
      radarTooDeep: 'sensors.radarTooDeep',
      activeSonarUnavailable: 'sensors.activeUnavailable',
      sonarDown: 'sensors.sonarDown',
      sensorCooldown: 'sensors.pingCooling',
      noSensorContact: 'environment.noContactToListen',
      invalidWeaponTarget: 'weapons.invalidTarget',
      invalidTube: 'weapons.invalidTube',
      invalidSalvo: 'weapons.invalidSalvo',
      invalidTorpedoType: 'weapons.invalidType',
      invalidTdcField: 'weapons.invalidTdc',
      invalidTdcValue: 'weapons.invalidTdc',
      noWeaponContact: 'weapons.noContact',
      solutionPoor: 'weapons.solutionPoor',
      tubeArc: 'weapons.tubeArc',
      tubesReloading: 'weapons.tubesReloading',
      torpedoTooDeep: 'weapons.tooDeep',
      invalidTeam: 'damage.invalidTeam',
      invalidCompartment: 'damage.invalidCompartment',
      invalidDamageTask: 'damage.invalidTask',
      damageTaskOccupied: 'damage.taskOccupied',
      damageNoPower: 'damage.noPower',
    };
    if (els.missionHint && keyMap[result.reason]) els.missionHint.textContent = t(keyMap[result.reason]);
    if (els.lockLabel && result.reason === 'tooDeep') els.lockLabel.textContent = t('gameplay.lockTooDeep');
    return true;
  }

  addCleanup(engine.on('simulation:tick', updateAll));
  addCleanup(engine.on('state:changed', updateAll));
  addCleanup(engine.on('escort:state', ({ current }) => {
    if (current !== 'patrol') playSfx(current === 'hunt' ? 'alert' : 'sonar');
  }));
  addCleanup(engine.on('damage:applied', ({ snapshot }) => {
    playSfx('damage');
    document.body.classList.add('damage-flash');
    schedule(() => document.body.classList.remove('damage-flash'), 360);
    onHullUpdate(snapshot.hull, snapshot.systems);
  }));
  addCleanup(engine.on('repair:completed', (snapshot) => {
    onHullUpdate(snapshot.hull, snapshot.systems);
  }));
  addCleanup(engine.on('mission:failed', showMissionFailure));
  addCleanup(engine.on('torpedo:fired', () => {
    playSfx('torpedo');
    [els.impactExplosion, els.impactSplash].forEach((element) => element?.classList.add('hidden'));
    els.torpedoShot?.classList.remove('hidden');
  }));
  addCleanup(engine.on('torpedo:resolved', ({ hit, outcome, snapshot }) => {
    els.torpedoShot?.classList.toggle('hidden', !snapshot?.torpedoActive);
    if (hit) {
      els.impactExplosion?.classList.remove('hidden');
      playSfx('hit');
      document.body.classList.add('combat-success');
      schedule(() => document.body.classList.remove('combat-success'), 520);
    } else {
      els.impactSplash?.classList.remove('hidden');
      playSfx('miss');
    }
    schedule(() => {
      els.impactExplosion?.classList.add('hidden');
      els.impactSplash?.classList.add('hidden');
    }, 1400);
  }));

  app.querySelectorAll('.station-tab').forEach((button) => bind(button, 'click', () => setStation(button.dataset.station)));
  bind(els.stationHelpTrigger, 'click', openStationHelp);
  bind(els.stationHelpClose, 'click', closeStationHelp);
  bind(els.stationHelpDrawer, 'click', (event) => { if (event.target === els.stationHelpDrawer) closeStationHelp(); });
  bind(els.trainingDismiss, 'click', () => { training.dismiss(); updateTraining(engine.snapshot()); });
  bind(els.trainingGoStation, 'click', () => setStation(els.trainingGoStation?.dataset.targetStation || training.recommendedStation()));
  app.querySelectorAll('.encounter-doctrine').forEach((button) => bind(button, 'click', () => commandHint(engine.setTacticalDoctrine(button.dataset.doctrine))));
  setStation('command', { focus: false });
  setPeriscopeZoom(1);
  updateTraining(engine.snapshot());
  app.querySelectorAll('.speed-chip').forEach((button) => bind(button, 'click', () => engine.setSpeed(button.dataset.speed)));
  bind(app.querySelector('#depth-up'), 'click', () => engine.adjustDepth(-15));
  bind(app.querySelector('#depth-down'), 'click', () => engine.adjustDepth(15));
  app.querySelectorAll('.ballast-chip').forEach((button) => bind(button, 'click', () => commandHint(engine.setBallastCommand(button.dataset.ballast))));
  app.querySelectorAll('.trim-chip').forEach((button) => bind(button, 'click', () => commandHint(engine.nudgeTrim(Number(button.dataset.trim)))));
  bind(els.trimLevel, 'click', () => commandHint(engine.levelTrim()));
  bind(els.emergencyBlow, 'click', () => {
    const result = engine.emergencyBlow();
    if (result.ok) playSfx('alert');
    else commandHint(result);
  });
  app.querySelectorAll('.rudder-chip').forEach((button) => bind(button, 'click', () => commandHint(engine.setRudder(Number(button.dataset.rudder)))));
  app.querySelectorAll('.heading-chip').forEach((button) => bind(button, 'click', () => commandHint(engine.nudgeHeading(Number(button.dataset.headingDelta)))));
  app.querySelectorAll('.compression-chip').forEach((button) => bind(button, 'click', () => {
    const result = engine.requestTimeCompression(Number(button.dataset.compression));
    if (!result.ok) commandHint(result);
  }));
  bind(els.openNavigationStation, 'click', () => setStation('navigation'));
  bind(els.navAutopilot, 'click', () => commandHint(engine.toggleAutopilot()));
  bind(els.navNextWaypoint, 'click', () => commandHint(engine.advanceWaypoint()));
  bind(els.navRemoveWaypoint, 'click', () => commandHint(engine.removeLastWaypoint()));
  bind(els.navResetRoute, 'click', () => commandHint(engine.resetRoute()));
  bind(els.navigationMap, 'click', (event) => {
    const bounds = engine.snapshot().navigation?.mapBounds;
    if (!bounds) return;
    const rectangle = els.navigationMap.getBoundingClientRect();
    const xRatio = clamp((event.clientX - rectangle.left) / Math.max(1, rectangle.width), 0, 1);
    const yRatio = clamp((event.clientY - rectangle.top) / Math.max(1, rectangle.height), 0, 1);
    const lon = Number(bounds.west) + xRatio * (Number(bounds.east) - Number(bounds.west));
    const lat = Number(bounds.north) - yRatio * (Number(bounds.north) - Number(bounds.south));
    commandHint(engine.addWaypoint(lat, lon));
  });
  const keyboardNavigation = (event) => {
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
    const key = event.key.toLowerCase();
    const commands = {
      a: () => engine.setRudder(-15),
      d: () => engine.setRudder(15),
      s: () => engine.setRudder(0),
      q: () => engine.nudgeHeading(-5),
      e: () => engine.nudgeHeading(5),
    };
    if (!commands[key]) return;
    event.preventDefault();
    commandHint(commands[key]());
  };
  document.addEventListener('keydown', keyboardNavigation);
  addCleanup(() => document.removeEventListener('keydown', keyboardNavigation));
  app.querySelectorAll('.sensor-mode-chip').forEach((button) => bind(button, 'click', () => commandHint(engine.setSensorMode(button.dataset.sensorMode))));
  app.querySelectorAll('.hydrophone-bearing-chip').forEach((button) => bind(button, 'click', () => commandHint(engine.nudgeHydrophoneBearing(Number(button.dataset.bearingDelta)))));
  bind(els.activeSonarPing, 'click', () => {
    const result = engine.activeSonarPing();
    if (result.ok) playSfx('sonar');
    else commandHint(result);
  });
  bind(els.radarMastToggle, 'click', () => commandHint(engine.toggleRadarMast()));
  bind(els.hydrophoneListen, 'click', () => {
    const contact = engine.snapshot().sensors?.strongestContact;
    if (!contact) return commandHint({ ok: false, reason: 'noSensorContact' });
    playSfx(contact.role === 'escort' ? 'hydrophoneEscort' : contact.role === 'target' ? 'hydrophoneMerchant' : 'hydrophoneUnknown');
    if (els.sensorMessage) els.sensorMessage.textContent = t(contact.role === 'escort' ? 'environment.signatureEscort' : 'environment.signatureMerchant');
  });
  app.querySelectorAll('.torpedo-tube').forEach((button) => bind(button, 'click', () => commandHint(engine.selectTorpedoTube(button.dataset.tubeId))));
  app.querySelectorAll('.weapon-target-chip').forEach((button) => bind(button, 'click', () => commandHint(engine.setWeaponTarget(button.dataset.weaponTarget))));
  app.querySelectorAll('.salvo-chip').forEach((button) => bind(button, 'click', () => commandHint(engine.setSalvoSize(Number(button.dataset.salvoSize)))));
  app.querySelectorAll('.torpedo-type-chip').forEach((button) => bind(button, 'click', () => commandHint(engine.setTorpedoType(button.dataset.torpedoType))));
  [[els.tdcTargetSpeed, 'targetSpeedKnots'], [els.tdcTargetCourse, 'targetCourse'], [els.tdcAob, 'aobDegrees'], [els.tdcRunDepth, 'runDepthMeters']].forEach(([input, key]) => bind(input, 'change', () => commandHint(engine.setTdcValue(key, Number(input.value)))));
  bind(els.tdcSync, 'click', () => commandHint(engine.syncTdcSolution()));
  bind(els.weaponsFire, 'click', () => commandHint(engine.fireTorpedo()));
  bind(els.openWeaponsStation, 'click', () => setStation('weapons'));
  bind(els.openDamageControl, 'click', () => setStation('damage'));
  app.querySelectorAll('.damage-posture-chip').forEach((button) => bind(button, 'click', () => commandHint(engine.setDamageEmergencyPosture(button.dataset.damagePosture))));
  bind(els.damageVentilation, 'click', () => commandHint(engine.runEmergencyVentilation()));
  bind(els.damageDoorsToggle, 'click', () => commandHint(engine.toggleWatertightDoors()));
  bind(els.damagePumpsToggle, 'click', () => commandHint(engine.toggleDamageControlPumps()));
  bind(els.damageEmergencyPower, 'click', () => commandHint(engine.toggleEmergencyPower()));
  bind(els.damageTeamList, 'click', (event) => {
    const button = event.target.closest('.damage-recall-team');
    if (button && !button.disabled) commandHint(engine.recallDamageControlTeam(button.dataset.teamId));
  });
  app.querySelectorAll('.damage-compartment-card').forEach((button) => bind(button, 'click', () => commandHint(engine.assignDamageControlTeam(els.damageTeamSelect?.value || 'dc-team-1', button.dataset.compartmentId, els.damageTaskSelect?.value || 'repair'))));
  bind(els.openPeriscope, 'click', () => commandHint(engine.openPeriscope()));
  bind(els.openPeriscopeSecondary, 'click', () => commandHint(engine.openPeriscope()));
  bind(els.closePeriscope, 'click', () => engine.closePeriscope());
  bind(els.fireTorpedo, 'click', () => commandHint(engine.fireTorpedo()));
  bind(els.emergencyRepair, 'click', () => commandHint(engine.startEmergencyRepair()));
  bind(els.silentRunning, 'click', () => {
    const result = engine.activateSilentRunning();
    if (result.ok) playSfx('sonar');
    else commandHint(result);
  });
  bind(els.emergencyDive, 'click', () => {
    const result = engine.activateEmergencyDive();
    if (result.ok) playSfx('alert');
    else commandHint(result);
  });
  bind(els.decoy, 'click', () => {
    const result = engine.launchDecoy();
    if (result.ok) playSfx('sonar');
    else commandHint(result);
  });
  bind(els.completeMission, 'click', () => {
    const report = engine.missionReport();
    if (report) {
      operationResolved = true;
      onOperationCleared();
      onMissionComplete(engine.snapshot().missionId, report);
    }
  });
  bind(els.viewLeft, 'click', () => engine.moveView(VIEW_STEP_X, 0));
  bind(els.viewRight, 'click', () => engine.moveView(-VIEW_STEP_X, 0));
  bind(els.viewUp, 'click', () => engine.moveView(0, -VIEW_STEP_Y));
  bind(els.viewDown, 'click', () => engine.moveView(0, VIEW_STEP_Y));
  bind(els.periscopeZoomOut, 'click', () => setPeriscopeZoom(periscopeZoom - 0.5));
  bind(els.periscopeZoomIn, 'click', () => setPeriscopeZoom(periscopeZoom + 0.5));

  let periscopeDrag = null;
  bind(els.periscopeWindow, 'pointerdown', (event) => {
    if (!engine.snapshot().periscopeOpen) return;
    periscopeDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    els.periscopeWindow.classList.add('dragging');
    els.periscopeWindow.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  bind(els.periscopeWindow, 'pointermove', (event) => {
    if (!periscopeDrag || event.pointerId !== periscopeDrag.pointerId) return;
    const deltaX = event.clientX - periscopeDrag.x;
    const deltaY = event.clientY - periscopeDrag.y;
    periscopeDrag.x = event.clientX;
    periscopeDrag.y = event.clientY;
    engine.moveView((-deltaX * 0.9) / periscopeZoom, (-deltaY * 0.45) / periscopeZoom);
    event.preventDefault();
  });
  const finishPeriscopeDrag = (event) => {
    if (!periscopeDrag || (event.pointerId != null && event.pointerId !== periscopeDrag.pointerId)) return;
    try { els.periscopeWindow.releasePointerCapture?.(periscopeDrag.pointerId); } catch {}
    periscopeDrag = null;
    els.periscopeWindow.classList.remove('dragging');
  };
  bind(els.periscopeWindow, 'pointerup', finishPeriscopeDrag);
  bind(els.periscopeWindow, 'pointercancel', finishPeriscopeDrag);
  bind(els.periscopeWindow, 'wheel', (event) => {
    event.preventDefault();
    setPeriscopeZoom(periscopeZoom + (event.deltaY < 0 ? 0.5 : -0.5));
  });

  updateAll();
  if (initialSnapshot) onOperationAutosave(engine.snapshot());
  if (initialHull <= 0 && !initialSnapshot) engine.failMission();
  engine.start();
}

export function cleanupGameplay() {
  while (cleanupFns.length) {
    const cleanup = cleanupFns.pop();
    try { cleanup(); } catch {}
  }
}
