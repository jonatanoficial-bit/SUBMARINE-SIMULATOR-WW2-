let cleanupFns = [];

const SPEEDS = ['stop', 'slow', 'half', 'full', 'flank'];
const SPEED_ANGLES = { stop: 0, slow: 18, half: 36, full: 58, flank: 78 };
const SPEED_NOISE = { stop: 0, slow: 12, half: 24, full: 40, flank: 60 };
const SPEED_MOVE = { stop: 0, slow: 0.35, half: 0.7, full: 1.2, flank: 1.7 };
const DEPTH_MIN = 0;
const DEPTH_MAX = 300;
const PERISCOPE_MAX_DEPTH = 20;

import { ASSETS } from '../assets.js';

export function renderGameplay(t, mission) {
  return `
    <section class="screen gameplay-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <button class="button ghost" data-nav="briefing">${t('common.back')}</button>
          <div class="screen-title">${t('gameplay.title')}</div>
          <div class="screen-subtitle">${mission ? t(mission.titleKey) : t('gameplay.subtitle')}</div>
        </div>
        <div class="top-badge"><span>${t('gameplay.phase')}</span></div>
      </div>

      <div class="panel hero-panel gameplay-status-panel">
        <div class="gameplay-kpis">
          <div class="stat-box"><div class="stat-label">${t('gameplay.depth')}</div><div id="hud-depth" class="stat-value">0 m</div></div>
          <div class="stat-box"><div class="stat-label">${t('gameplay.speed')}</div><div id="hud-speed" class="stat-value">STOP</div></div>
          <div class="stat-box"><div class="stat-label">${t('gameplay.alert')}</div><div id="hud-alert" class="stat-value">${t('gameplay.alertSilent')}</div></div>
        </div>
      </div>

      <div class="instrument-grid">
        <div class="panel instrument-card">
          <div class="panel-header">${t('gameplay.depthGauge')}</div>
          <div class="panel-body instrument-wrap">
            <div class="gauge depth-gauge">
              <img class="gauge-base" src="${ASSETS.gauges.depthBase}" alt="${t('gameplay.depthGauge')}">
              <img id="depth-needle" class="gauge-needle" src="${ASSETS.gauges.depthNeedle}" alt="needle">
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
            <div class="gauge speed-gauge">
              <img class="gauge-base" src="${ASSETS.gauges.speedBase}" alt="${t('gameplay.engineTelegraph')}">
              <img id="speed-lever" class="gauge-lever" src="${ASSETS.gauges.speedLever}" alt="lever">
            </div>
            <div class="chip-grid speed-grid">
              ${SPEEDS.map((speed) => `<button class="chip speed-chip" data-speed="${speed}">${t('speed.' + speed)}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="panel radar-panel">
        <div class="panel-header">${t('gameplay.radar')}</div>
        <div class="panel-body radar-wrap">
          <div class="radar-stage" id="radar-stage">
            <img class="radar-base" src="${ASSETS.radar.base}" alt="${t('gameplay.radar')}">
            <img id="radar-scan" class="radar-scan" src="${ASSETS.radar.scan}" alt="scan">
            <img id="radar-player" class="radar-icon radar-player" src="${ASSETS.radar.player}" alt="player">
            <img id="radar-target" class="radar-icon radar-target" src="${ASSETS.radar.enemy}" alt="target">
            <img id="radar-escort" class="radar-icon radar-escort" src="${ASSETS.radar.enemy}" alt="escort">
            <img id="radar-ally" class="radar-icon radar-ally hidden" src="${ASSETS.radar.ally}" alt="ally">
          </div>
          <div class="radar-readout">
            <div class="row space-between"><span>${t('gameplay.target')}</span><strong id="target-range">--</strong></div>
            <div class="row space-between"><span>${t('gameplay.escort')}</span><strong id="escort-range">--</strong></div>
          </div>
        </div>
      </div>

      <div class="panel action-panel">
        <div class="panel-header">${t('gameplay.combatStation')}</div>
        <div class="panel-body stack">
          <button class="button block" id="open-periscope">${t('gameplay.openPeriscope')}</button>
          <button class="button secondary block hidden" id="complete-mission-btn">${t('gameplay.completeMission')}</button>
          <div class="empty-state" id="mission-hint">${t('gameplay.hint')}</div>
        </div>
      </div>

      <div id="periscope-modal" class="periscope-modal hidden" aria-hidden="true">
        <div class="periscope-actions">
          <button class="button ghost" id="close-periscope">${t('common.back')}</button>
          <button class="button warn" id="fire-torpedo">${t('gameplay.fireTorpedo')}</button>
        </div>
        <div class="periscope-shell" id="periscope-shell">
          <div class="periscope-window" id="periscope-window">
            <img id="periscope-ocean" class="periscope-ocean" src="${ASSETS.periscope.oceanDay}" alt="ocean">
            <img id="target-ship" class="periscope-entity target-ship" src="${ASSETS.ships.merchant}" alt="merchant">
            <img id="escort-ship" class="periscope-entity escort-ship" src="${ASSETS.ships.destroyer}" alt="destroyer">
            <img id="torpedo-shot" class="periscope-effect torpedo-shot hidden" src="${ASSETS.effects.torpedo}" alt="torpedo">
            <img id="impact-explosion" class="periscope-effect impact-explosion hidden" src="${ASSETS.effects.explosion}" alt="explosion">
            <img id="impact-splash" class="periscope-effect impact-splash hidden" src="${ASSETS.effects.splash}" alt="splash">
          </div>
          <img class="periscope-layer periscope-crosshair" src="${ASSETS.periscope.crosshair}" alt="crosshair">
          <img class="periscope-layer periscope-glass" src="${ASSETS.periscope.glass}" alt="glass">
          <img class="periscope-layer periscope-overlay" src="${ASSETS.periscope.overlay}" alt="overlay">
          <div id="periscope-lock" class="periscope-lock">${t('gameplay.lockSearching')}</div>
        </div>
        <div class="periscope-controls">
          <button class="button secondary" id="view-left">${t('gameplay.left')}</button>
          <button class="button secondary" id="view-right">${t('gameplay.right')}</button>
        </div>
      </div>
    </section>
  `;
}

export function mountGameplay({ app, missionId, onMissionComplete, t }) {
  cleanupGameplay();

  const els = {
    depthNeedle: app.querySelector('#depth-needle'),
    speedLever: app.querySelector('#speed-lever'),
    hudDepth: app.querySelector('#hud-depth'),
    hudSpeed: app.querySelector('#hud-speed'),
    hudAlert: app.querySelector('#hud-alert'),
    radarScan: app.querySelector('#radar-scan'),
    radarTarget: app.querySelector('#radar-target'),
    radarEscort: app.querySelector('#radar-escort'),
    targetRange: app.querySelector('#target-range'),
    escortRange: app.querySelector('#escort-range'),
    openPeriscope: app.querySelector('#open-periscope'),
    periscopeModal: app.querySelector('#periscope-modal'),
    closePeriscope: app.querySelector('#close-periscope'),
    fireTorpedo: app.querySelector('#fire-torpedo'),
    missionHint: app.querySelector('#mission-hint'),
    completeMission: app.querySelector('#complete-mission-btn'),
    periscopeOcean: app.querySelector('#periscope-ocean'),
    targetShip: app.querySelector('#target-ship'),
    escortShip: app.querySelector('#escort-ship'),
    torpedoShot: app.querySelector('#torpedo-shot'),
    impactExplosion: app.querySelector('#impact-explosion'),
    impactSplash: app.querySelector('#impact-splash'),
    lockLabel: app.querySelector('#periscope-lock'),
    viewLeft: app.querySelector('#view-left'),
    viewRight: app.querySelector('#view-right')
  };

  const session = {
    missionId,
    depth: 12,
    speed: 'slow',
    scanAngle: 0,
    viewX: -120,
    viewY: 0,
    worldTime: 0,
    playerDetected: false,
    targetDestroyed: false,
    periscopeOpen: false,
    target: { x: 220, y: 28 },
    escort: { x: 310, y: 42 },
    torpedoActive: false,
    torpedoHit: false,
    canComplete: false
  };

  function clamp(num, min, max) { return Math.max(min, Math.min(max, num)); }
  function depthToAngle(depth) { return -120 + (clamp(depth, DEPTH_MIN, DEPTH_MAX) / DEPTH_MAX) * 240; }

  function updateHUD() {
    els.hudDepth.textContent = `${Math.round(session.depth)} m`;
    els.hudSpeed.textContent = t('speed.' + session.speed).toUpperCase();
    let alertKey = 'gameplay.alertSilent';
    if (session.depth > 230) alertKey = 'gameplay.alertCritical';
    else if (session.depth > 180) alertKey = 'gameplay.alertWarning';
    else if (SPEED_NOISE[session.speed] >= 40) alertKey = 'gameplay.alertLoud';
    if (session.playerDetected) alertKey = 'gameplay.alertDetected';
    if (session.targetDestroyed) alertKey = 'gameplay.alertSuccess';
    els.hudAlert.textContent = t(alertKey);
  }

  function updateInstruments() {
    els.depthNeedle.style.transform = `translate(-50%, -50%) rotate(${depthToAngle(session.depth)}deg)`;
    els.speedLever.style.transform = `translate(-50%, -50%) rotate(${SPEED_ANGLES[session.speed]}deg)`;
  }

  function updateRadar() {
    session.scanAngle = (session.scanAngle + 2.2) % 360;
    els.radarScan.style.transform = `translate(-50%, -50%) rotate(${session.scanAngle}deg)`;

    const targetX = clamp(50 + session.target.x * 0.42, 26, 74);
    const targetY = clamp(50 + session.target.y * 0.42, 26, 74);
    const escortX = clamp(50 + session.escort.x * 0.42, 26, 74);
    const escortY = clamp(50 + session.escort.y * 0.42, 26, 74);

    els.radarTarget.style.left = `${targetX}%`;
    els.radarTarget.style.top = `${targetY}%`;
    els.radarEscort.style.left = `${escortX}%`;
    els.radarEscort.style.top = `${escortY}%`;

    const targetRange = Math.round(Math.hypot(session.target.x, session.target.y) * 4);
    const escortRange = Math.round(Math.hypot(session.escort.x, session.escort.y) * 4);
    els.targetRange.textContent = `${targetRange} m`;
    els.escortRange.textContent = `${escortRange} m`;
  }

  function updateWorld() {
    session.worldTime += 1;
    const movement = SPEED_MOVE[session.speed];
    session.target.x -= movement * 0.7;
    session.escort.x -= movement * 0.95;
    session.playerDetected = SPEED_NOISE[session.speed] > 35 && session.depth < 40;
    if (session.playerDetected && session.worldTime % 180 === 0) {
      session.escort.y += session.escort.y > 0 ? -6 : 6;
    }
    updatePeriscopeVisuals();
  }

  function getShipScreenLeft(baseX) {
    return 50 + ((baseX + session.viewX) / 500) * 50;
  }

  function updatePeriscopeVisuals() {
    els.periscopeOcean.style.transform = `translate(${session.viewX}px, ${session.viewY}px)`;
    const targetLeft = getShipScreenLeft(session.target.x);
    const escortLeft = getShipScreenLeft(session.escort.x);
    els.targetShip.style.left = `${targetLeft}%`;
    els.targetShip.style.bottom = `${26 + session.target.y * 0.2}%`;
    els.escortShip.style.left = `${escortLeft}%`;
    els.escortShip.style.bottom = `${25 + session.escort.y * 0.18}%`;
    const lock = Math.abs(targetLeft - 50) < 6 && session.depth <= PERISCOPE_MAX_DEPTH;
    els.lockLabel.textContent = session.targetDestroyed ? t('gameplay.lockDestroyed') : (lock ? t('gameplay.lockReady') : t('gameplay.lockSearching'));
    els.lockLabel.classList.toggle('active', lock);
    return lock;
  }

  function hideShotEffects() {
    [els.torpedoShot, els.impactExplosion, els.impactSplash].forEach((el) => el.classList.add('hidden'));
  }

  function fire() {
    if (session.depth > PERISCOPE_MAX_DEPTH) {
      els.lockLabel.textContent = t('gameplay.lockTooDeep');
      return;
    }
    if (session.torpedoActive) return;
    hideShotEffects();
    session.torpedoActive = true;
    els.torpedoShot.classList.remove('hidden');
    const hit = updatePeriscopeVisuals();
    const timeout1 = setTimeout(() => {
      els.torpedoShot.classList.add('hidden');
      if (hit) {
        session.targetDestroyed = true;
        session.canComplete = true;
        els.impactExplosion.classList.remove('hidden');
        els.targetShip.style.opacity = '0.2';
        els.completeMission.classList.remove('hidden');
        els.missionHint.textContent = t('gameplay.hintSuccess');
      } else {
        els.impactSplash.classList.remove('hidden');
        els.missionHint.textContent = t('gameplay.hintMiss');
      }
      updateHUD();
      session.torpedoActive = false;
    }, 1000);
    const timeout2 = setTimeout(() => {
      els.impactExplosion.classList.add('hidden');
      els.impactSplash.classList.add('hidden');
    }, 2400);
    cleanupFns.push(() => clearTimeout(timeout1), () => clearTimeout(timeout2));
  }

  function openPeriscope() {
    if (session.depth > PERISCOPE_MAX_DEPTH) {
      els.missionHint.textContent = t('gameplay.hintTooDeep');
      updateHUD();
      return;
    }
    session.periscopeOpen = true;
    els.periscopeModal.classList.remove('hidden');
    updatePeriscopeVisuals();
  }

  function closePeriscope() {
    session.periscopeOpen = false;
    els.periscopeModal.classList.add('hidden');
  }

  function tick() {
    updateWorld();
    updateRadar();
    updateHUD();
  }

  const interval = setInterval(tick, 80);
  cleanupFns.push(() => clearInterval(interval));

  app.querySelectorAll('.speed-chip').forEach((button) => {
    const handler = () => { session.speed = button.dataset.speed; updateInstruments(); updateHUD(); };
    button.addEventListener('click', handler);
    cleanupFns.push(() => button.removeEventListener('click', handler));
  });

  const bind = (el, event, handler) => {
    if (!el) return;
    el.addEventListener(event, handler);
    cleanupFns.push(() => el.removeEventListener(event, handler));
  };

  bind(app.querySelector('#depth-up'), 'click', () => { session.depth = clamp(session.depth - 12, DEPTH_MIN, DEPTH_MAX); updateInstruments(); updateHUD(); });
  bind(app.querySelector('#depth-down'), 'click', () => { session.depth = clamp(session.depth + 12, DEPTH_MIN, DEPTH_MAX); updateInstruments(); updateHUD(); });
  bind(els.openPeriscope, 'click', openPeriscope);
  bind(els.closePeriscope, 'click', closePeriscope);
  bind(els.fireTorpedo, 'click', fire);
  bind(els.completeMission, 'click', () => onMissionComplete(session.missionId));
  bind(els.viewLeft, 'click', () => { session.viewX = clamp(session.viewX + 70, -420, 420); updatePeriscopeVisuals(); });
  bind(els.viewRight, 'click', () => { session.viewX = clamp(session.viewX - 70, -420, 420); updatePeriscopeVisuals(); });

  updateInstruments();
  updateRadar();
  updateHUD();
  updatePeriscopeVisuals();
}

export function cleanupGameplay() {
  while (cleanupFns.length) {
    const fn = cleanupFns.pop();
    try { fn(); } catch {}
  }
}
