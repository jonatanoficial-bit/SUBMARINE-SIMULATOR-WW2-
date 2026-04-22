let cleanupFns = [];

const SPEEDS = ['stop', 'slow', 'half', 'full', 'flank'];
const SPEED_ANGLES = { stop: 0, slow: 18, half: 36, full: 58, flank: 78 };
const SPEED_NOISE = { stop: 0, slow: 12, half: 24, full: 40, flank: 60 };
const SPEED_MOVE = { stop: 0, slow: 0.35, half: 0.7, full: 1.2, flank: 1.7 };
const DEPTH_MIN = 0;
const DEPTH_MAX = 300;
const PERISCOPE_MAX_DEPTH = 20;
const DEPTH_SWEEP = 270;
const DEPTH_START = -135;

function polar(cx, cy, radius, angleDeg) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function buildDepthTicks() {
  const majorValues = [0, 50, 100, 150, 200, 250, 300];
  const lines = [];
  for (let value = 0; value <= DEPTH_MAX; value += 10) {
    const angle = DEPTH_START + (value / DEPTH_MAX) * DEPTH_SWEEP;
    const outer = polar(110, 110, 80, angle);
    const inner = polar(110, 110, value % 50 === 0 ? 64 : 70, angle);
    lines.push(`<line x1="${outer.x.toFixed(2)}" y1="${outer.y.toFixed(2)}" x2="${inner.x.toFixed(2)}" y2="${inner.y.toFixed(2)}" class="depth-tick ${value % 50 === 0 ? 'major' : 'minor'}" />`);
  }
  const labels = majorValues.map((value) => {
    const angle = DEPTH_START + (value / DEPTH_MAX) * DEPTH_SWEEP;
    const point = polar(110, 110, 51, angle);
    return `<text x="${point.x.toFixed(2)}" y="${point.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" class="depth-svg-number">${value}</text>`;
  });
  return { lines: lines.join(''), labels: labels.join('') };
}

function buildDepthGaugeMarkup() {
  const ticks = buildDepthTicks();
  return `
    <div class="gauge depth-gauge clean-depth-gauge" aria-label="Depth gauge">
      <svg class="depth-face" viewBox="0 0 220 220" role="img" aria-hidden="true">
        <defs>
          <radialGradient id="depthDialGlow" cx="50%" cy="42%" r="68%">
            <stop offset="0%" stop-color="#203b35" />
            <stop offset="55%" stop-color="#142821" />
            <stop offset="100%" stop-color="#0b1411" />
          </radialGradient>
          <linearGradient id="depthNeedleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ffe59b" />
            <stop offset="55%" stop-color="#ff9844" />
            <stop offset="100%" stop-color="#a11b13" />
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r="100" fill="#221609"/>
        <circle cx="110" cy="110" r="92" fill="#8b6828"/>
        <circle cx="110" cy="110" r="84" fill="#3c2910"/>
        <circle cx="110" cy="110" r="76" fill="url(#depthDialGlow)" stroke="#ccb06b" stroke-width="1.4"/>
        <path d="M 53.43 166.57 A 80 80 0 0 1 166.57 166.57" class="depth-zone safe" />
        <path d="M 30.00 110.00 A 80 80 0 0 1 53.43 53.43" class="depth-zone warn" />
        <path d="M 166.57 53.43 A 80 80 0 0 1 190.00 110.00" class="depth-zone danger" />
        ${ticks.lines}
        ${ticks.labels}
        <text x="110" y="141" text-anchor="middle" class="depth-svg-label">DEPTH</text>
        <text x="110" y="158" text-anchor="middle" class="depth-svg-sub">m</text>
        <g id="depth-needle-group" transform="rotate(${DEPTH_START} 110 110)">
          <polygon points="110,30 105,56 110,118 115,56" fill="url(#depthNeedleGrad)" stroke="#311408" stroke-width="1" />
          <polygon points="110,118 106,149 114,149" fill="#ffad62" stroke="#311408" stroke-width="0.8" opacity="0.9" />
          <circle cx="110" cy="110" r="14" fill="#57442f" opacity="0.92"/>
          <circle cx="110" cy="110" r="9.8" fill="#d24d23" stroke="#f6d88a" stroke-width="2.2"/>
          <circle cx="110" cy="110" r="3.2" fill="#fff0bf"/>
        </g>
      </svg>
    </div>`;
}

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
            ${buildDepthGaugeMarkup()}
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
              <img class="gauge-base" src="assets/gauges/speed_telegraph_base.png" alt="${t('gameplay.engineTelegraph')}">
              <img id="speed-lever" class="gauge-lever" src="assets/gauges/speed_telegraph_lever.png" alt="lever">
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
            <img class="radar-base" src="assets/radar/radar_base.png" alt="${t('gameplay.radar')}">
            <img id="radar-scan" class="radar-scan" src="assets/radar/radar_scan.png" alt="scan">
            <img id="radar-player" class="radar-icon radar-player" src="assets/radar/radar_player.png" alt="player">
            <img id="radar-target" class="radar-icon radar-target" src="assets/radar/radar_enemy.png" alt="target">
            <img id="radar-escort" class="radar-icon radar-escort" src="assets/radar/radar_enemy.png" alt="escort">
            <img id="radar-ally" class="radar-icon radar-ally hidden" src="assets/radar/radar_ally.png" alt="ally">
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
            <img id="periscope-ocean" class="periscope-ocean" src="assets/periscope/ocean_panorama_day.png" alt="ocean">
            <div class="periscope-horizon" aria-hidden="true"></div>
            <img id="target-ship" class="periscope-entity target-ship" src="assets/ships/merchant_ship_01.png" alt="merchant">
            <img id="escort-ship" class="periscope-entity escort-ship" src="assets/ships/destroyer_01.png" alt="destroyer">
            <img id="torpedo-shot" class="periscope-effect torpedo-shot hidden" src="assets/effects/torpedo_moving_01.png" alt="torpedo">
            <img id="impact-explosion" class="periscope-effect impact-explosion hidden" src="assets/effects/ocean_explosion_01.png" alt="explosion">
            <img id="impact-splash" class="periscope-effect impact-splash hidden" src="assets/effects/water_splash_01.png" alt="splash">
          </div>
          <div class="periscope-crosshair-clean" aria-hidden="true">
            <div class="crosshair-v"></div>
            <div class="crosshair-h"></div>
            <div class="crosshair-center"></div>
            <div class="crosshair-bottom-arc"></div>
          </div>
          <div class="periscope-heading-scale" aria-hidden="true">
            <span>350</span><span>000</span><span>010</span>
          </div>
          <div class="periscope-glass-clean" aria-hidden="true"></div>
          <div class="periscope-ring-clean" aria-hidden="true"></div>
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
    depthNeedle: app.querySelector('#depth-needle-group'),
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
    viewX: -70,
    viewY: 0,
    worldTime: 0,
    playerDetected: false,
    targetDestroyed: false,
    periscopeOpen: false,
    target: { x: 82, y: 0 },
    escort: { x: 210, y: -6 },
    torpedoActive: false,
    torpedoHit: false,
    canComplete: false,
    currentLock: false
  };

  function clamp(num, min, max) { return Math.max(min, Math.min(max, num)); }
  function depthToAngle(depth) {
    return DEPTH_START + (clamp(depth, DEPTH_MIN, DEPTH_MAX) / DEPTH_MAX) * DEPTH_SWEEP;
  }

  function updateHUD() {
    els.hudDepth.textContent = `${Math.round(session.depth)} m`;
    els.hudSpeed.textContent = t('speed.' + session.speed).toUpperCase();
    let alertKey = 'gameplay.alertSilent';
    if (session.depth > 240) alertKey = 'gameplay.alertCritical';
    else if (session.depth > 180) alertKey = 'gameplay.alertWarning';
    else if (SPEED_NOISE[session.speed] >= 40) alertKey = 'gameplay.alertLoud';
    if (session.playerDetected) alertKey = 'gameplay.alertDetected';
    if (session.targetDestroyed) alertKey = 'gameplay.alertSuccess';
    els.hudAlert.textContent = t(alertKey);
  }

  function updateInstruments() {
    els.depthNeedle.setAttribute('transform', `rotate(${depthToAngle(session.depth)} 110 110)`);
    els.speedLever.style.transform = `translate(-50%, -50%) rotate(${SPEED_ANGLES[session.speed]}deg)`;
  }

  function updateRadar() {
    session.scanAngle = (session.scanAngle + 2.2) % 360;
    els.radarScan.style.transform = `translate(-50%, -50%) rotate(${session.scanAngle}deg)`;

    const targetX = clamp(50 + session.target.x * 0.45, 18, 82);
    const targetY = clamp(50 + session.target.y * 0.45, 18, 82);
    const escortX = clamp(50 + session.escort.x * 0.45, 18, 82);
    const escortY = clamp(50 + session.escort.y * 0.45, 18, 82);

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
    session.target.x -= movement * 0.55;
    session.escort.x -= movement * 0.82;
    session.playerDetected = SPEED_NOISE[session.speed] > 35 && session.depth < 40;
    if (session.playerDetected && session.worldTime % 160 === 0) {
      session.escort.y += session.escort.y > 0 ? -4 : 4;
    }
    updatePeriscopeVisuals();
  }

  function getShipScreenLeft(baseX) {
    return 50 + ((baseX + session.viewX) / 250) * 34;
  }

  function updatePeriscopeVisuals() {
    els.periscopeOcean.style.transform = `translate(${session.viewX * 1.6}px, ${session.viewY}px)`;
    const targetLeft = clamp(getShipScreenLeft(session.target.x), 10, 90);
    const escortLeft = clamp(getShipScreenLeft(session.escort.x), 12, 92);
    const targetBottom = 21 + session.target.y * 0.16;
    const escortBottom = 24 + session.escort.y * 0.12;
    els.targetShip.style.left = `${targetLeft}%`;
    els.targetShip.style.bottom = `${targetBottom}%`;
    els.escortShip.style.left = `${escortLeft}%`;
    els.escortShip.style.bottom = `${escortBottom}%`;
    const lock = Math.abs(targetLeft - 50) < 9 && session.depth <= PERISCOPE_MAX_DEPTH && !session.targetDestroyed;
    session.currentLock = lock;
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
    if (session.torpedoActive || session.targetDestroyed) return;
    hideShotEffects();
    session.torpedoActive = true;
    els.torpedoShot.classList.remove('hidden');
    const hit = session.currentLock;
    const timeout1 = setTimeout(() => {
      els.torpedoShot.classList.add('hidden');
      if (hit) {
        session.targetDestroyed = true;
        session.canComplete = true;
        els.impactExplosion.classList.remove('hidden');
        els.targetShip.style.opacity = '0.15';
        els.completeMission.classList.remove('hidden');
        els.missionHint.textContent = t('gameplay.hintSuccess');
      } else {
        els.impactSplash.classList.remove('hidden');
        els.missionHint.textContent = t('gameplay.hintMiss');
      }
      updatePeriscopeVisuals();
      updateHUD();
    }, 850);
    const timeout2 = setTimeout(() => {
      hideShotEffects();
      session.torpedoActive = false;
    }, 2100);
    cleanupFns.push(() => clearTimeout(timeout1), () => clearTimeout(timeout2));
  }

  function openPeriscope() {
    if (session.depth > PERISCOPE_MAX_DEPTH) {
      showInlineHint(t('gameplay.lockTooDeep')); return;
    }
    session.periscopeOpen = true;
    els.periscopeModal.classList.remove('hidden');
    els.periscopeModal.setAttribute('aria-hidden', 'false');
    updatePeriscopeVisuals();
  }

  function closePeriscope() {
    session.periscopeOpen = false;
    els.periscopeModal.classList.add('hidden');
    els.periscopeModal.setAttribute('aria-hidden', 'true');
  }

  function showInlineHint(text) { els.missionHint.textContent = text; }

  function bind(node, event, handler) {
    if (!node) return;
    node.addEventListener(event, handler);
    cleanupFns.push(() => node.removeEventListener(event, handler));
  }

  app.querySelectorAll('.speed-chip').forEach((button) => {
    const handler = () => { session.speed = button.dataset.speed; updateInstruments(); updateHUD(); };
    button.addEventListener('click', handler);
    cleanupFns.push(() => button.removeEventListener('click', handler));
  });

  bind(app.querySelector('#depth-up'), 'click', () => { session.depth = clamp(session.depth - 12, DEPTH_MIN, DEPTH_MAX); updateInstruments(); updateHUD(); updatePeriscopeVisuals(); });
  bind(app.querySelector('#depth-down'), 'click', () => { session.depth = clamp(session.depth + 12, DEPTH_MIN, DEPTH_MAX); updateInstruments(); updateHUD(); updatePeriscopeVisuals(); });
  bind(els.openPeriscope, 'click', openPeriscope);
  bind(els.closePeriscope, 'click', closePeriscope);
  bind(els.fireTorpedo, 'click', fire);
  bind(els.viewLeft, 'click', () => { session.viewX = clamp(session.viewX + 32, -180, 120); updatePeriscopeVisuals(); });
  bind(els.viewRight, 'click', () => { session.viewX = clamp(session.viewX - 32, -180, 120); updatePeriscopeVisuals(); });
  bind(els.completeMission, 'click', () => { if (session.canComplete) onMissionComplete?.(missionId); });

  const interval = setInterval(() => {
    updateRadar();
    updateWorld();
    updateHUD();
  }, 120);
  cleanupFns.push(() => clearInterval(interval));

  hideShotEffects();
  updateInstruments();
  updateRadar();
  updateHUD();
  updatePeriscopeVisuals();
}

export function cleanupGameplay() {
  cleanupFns.forEach((fn) => fn());
  cleanupFns = [];
}
