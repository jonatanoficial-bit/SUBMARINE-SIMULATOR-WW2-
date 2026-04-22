let cleanupFns = [];

const SPEEDS = ['stop', 'slow', 'half', 'full', 'flank'];
const SPEED_ANGLES = { stop: -78, slow: -38, half: 0, full: 38, flank: 78 };
const SPEED_NOISE = { stop: 0, slow: 12, half: 24, full: 40, flank: 60 };
const SPEED_MOVE = { stop: 0, slow: 0.35, half: 0.7, full: 1.2, flank: 1.7 };
const DEPTH_MIN = 0;
const DEPTH_MAX = 300;
const PERISCOPE_MAX_DEPTH = 20;
const VIEW_STEP_X = 28;
const VIEW_STEP_Y = 14;
const VIEW_RANGE_X = 240;
const VIEW_RANGE_Y = 70;
const TARGET_LOCK_X = 84;
const TARGET_LOCK_Y = 52;
const ESCORT_THREAT_RANGE = 110;

function speedLabelMarkup(t) {
  const labels = [
    { key: 'flank', left: '14%', top: '40%' },
    { key: 'full', left: '30%', top: '24%' },
    { key: 'half', left: '50%', top: '16%' },
    { key: 'slow', left: '70%', top: '24%' },
    { key: 'stop', left: '86%', top: '40%' }
  ];
  const labelHtml = (value) => String(value).trim().split(/\s+/).join('<br>');
  return labels.map((item) => `<span class="telegraph-label telegraph-label-${item.key}" style="left:${item.left};top:${item.top}">${labelHtml(t('speed.' + item.key))}</span>`).join('');
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
                <text x="110" y="144" fill="#f7e7ae" font-size="26" font-weight="800" text-anchor="middle" letter-spacing="2">DEPTH</text>
                <text x="110" y="164" fill="#f7e7ae" font-size="12" font-weight="700" text-anchor="middle">m</text>
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
              </div>
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
            <div class="radar-base radar-css-base">
              ${radarGridMarkup()}
              <div id="radar-scan" class="radar-scan radar-css-scan"></div>
              <div id="radar-player" class="radar-icon radar-player radar-css-player"></div>
              <div id="radar-target" class="radar-icon radar-target radar-css-enemy"></div>
              <div id="radar-escort" class="radar-icon radar-escort radar-css-enemy"></div>
              <div id="radar-ally" class="radar-icon radar-ally radar-css-ally hidden"></div>
            </div>
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
        <div class="periscope-shell css-periscope" id="periscope-shell">
          <div class="periscope-window" id="periscope-window">
            <div id="periscope-ocean" class="periscope-ocean css-periscope-ocean"></div>
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
            </div>
          </div>
          <div class="periscope-rim"></div>
          <div class="periscope-glass-css"></div>
          <div id="periscope-lock" class="periscope-lock">${t('gameplay.lockSearching')}</div>
        </div>
        <div class="periscope-controls periscope-controls-grid">
          <button class="button secondary" id="view-left">${t('gameplay.left')}</button>
          <button class="button secondary" id="view-up">${t('gameplay.up')}</button>
          <button class="button secondary" id="view-right">${t('gameplay.right')}</button>
          <button class="button secondary" id="view-down">${t('gameplay.down')}</button>
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
    radarAlly: app.querySelector('#radar-ally'),
    targetRange: app.querySelector('#target-range'),
    escortRange: app.querySelector('#escort-range'),
    openPeriscope: app.querySelector('#open-periscope'),
    periscopeModal: app.querySelector('#periscope-modal'),
    closePeriscope: app.querySelector('#close-periscope'),
    fireTorpedo: app.querySelector('#fire-torpedo'),
    missionHint: app.querySelector('#mission-hint'),
    completeMission: app.querySelector('#complete-mission-btn'),
    periscopeWindow: app.querySelector('#periscope-window'),
    periscopeOcean: app.querySelector('#periscope-ocean'),
    targetShip: app.querySelector('#target-ship'),
    escortShip: app.querySelector('#escort-ship'),
    torpedoShot: app.querySelector('#torpedo-shot'),
    impactExplosion: app.querySelector('#impact-explosion'),
    impactSplash: app.querySelector('#impact-splash'),
    lockLabel: app.querySelector('#periscope-lock'),
    viewLeft: app.querySelector('#view-left'),
    viewRight: app.querySelector('#view-right'),
    viewUp: app.querySelector('#view-up'),
    viewDown: app.querySelector('#view-down')
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
    escortAggro: false,
    hull: 100,
    missionFailed: false,
    periscopeOpen: false,
    target: { x: 220, y: 18 },
    escort: { x: 310, y: 42 },
    torpedoActive: false,
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
    if (session.escortAggro) alertKey = 'gameplay.alertDetected';
    if (session.targetDestroyed) alertKey = 'gameplay.alertSuccess';
    if (session.missionFailed) alertKey = 'gameplay.alertCritical';
    els.hudAlert.textContent = t(alertKey);
  }

  function updateInstruments() {
    els.depthNeedle.style.transform = `rotate(${depthToAngle(session.depth)}deg)`;
    els.speedLever.style.transform = `translate(-50%, -88%) rotate(${SPEED_ANGLES[session.speed]}deg)`;
  }

  function updateRadar() {
    session.scanAngle = (session.scanAngle + 2.2) % 360;
    els.radarScan.style.transform = `translate(-50%, -50%) rotate(${session.scanAngle}deg)`;

    const escortX = clamp(50 + session.escort.x * 0.11, 18, 82);
    const escortY = clamp(50 + session.escort.y * 0.35, 18, 82);
    els.radarEscort.style.left = `${escortX}%`;
    els.radarEscort.style.top = `${escortY}%`;

    const escortRange = Math.round(Math.hypot(session.escort.x, session.escort.y) * 4);
    els.escortRange.textContent = `${escortRange} m`;

    if (session.targetDestroyed) {
      els.radarTarget.classList.add('hidden');
      els.targetRange.textContent = 'DESTROYED';
      return;
    }

    const targetX = clamp(50 + session.target.x * 0.11, 18, 82);
    const targetY = clamp(50 + session.target.y * 0.35, 18, 82);
    els.radarTarget.classList.remove('hidden');
    els.radarTarget.style.left = `${targetX}%`;
    els.radarTarget.style.top = `${targetY}%`;
    const targetRange = Math.round(Math.hypot(session.target.x, session.target.y) * 4);
    els.targetRange.textContent = `${targetRange} m`;
  }

  function updateWorld() {
    session.worldTime += 1;
    const movement = SPEED_MOVE[session.speed];
    if (!session.targetDestroyed) session.target.x -= movement * 0.7;
    session.escort.x -= movement * 0.95;
    session.playerDetected = SPEED_NOISE[session.speed] > 35 && session.depth < 40;
    if ((session.playerDetected || session.targetDestroyed) && !session.missionFailed) session.escortAggro = true;
    if (session.escortAggro) {
      session.escort.x += (0 - session.escort.x) * 0.012;
      session.escort.y += (0 - session.escort.y) * 0.02;
      const escortRange = Math.hypot(session.escort.x, session.escort.y);
      if (escortRange < ESCORT_THREAT_RANGE && session.worldTime % 25 === 0) {
        session.hull = clamp(session.hull - 4, 0, 100);
        if (!session.targetDestroyed) {
          els.missionHint.textContent = 'Destroyer em ataque. Afunde o mercante e recue.';
        } else {
          els.missionHint.textContent = 'Escolta em alerta. Retire-se e conclua a missão.';
        }
        if (session.hull <= 0) {
          session.missionFailed = true;
          session.canComplete = false;
          els.completeMission.classList.add('hidden');
          els.missionHint.textContent = 'Casco comprometido. Missão perdida.';
          closePeriscope();
        }
      }
    }
    updatePeriscopeVisuals();
  }

  function getShipScreenLeft(baseX) {
    return 50 + ((baseX + session.viewX) / 500) * 50;
  }
  function getShipScreenBottom(baseY) {
    return 22 + ((baseY + session.viewY) / 180) * 18;
  }

  function computeTargetLock() {
    if (!els.periscopeWindow || !els.targetShip || session.depth > PERISCOPE_MAX_DEPTH || session.targetDestroyed) return false;
    const windowRect = els.periscopeWindow.getBoundingClientRect();
    const targetRect = els.targetShip.getBoundingClientRect();
    const crosshairX = windowRect.left + windowRect.width * 0.5;
    const crosshairY = windowRect.top + windowRect.height * 0.5;
    const targetAimX = targetRect.left + targetRect.width * 0.5;
    const targetAimY = targetRect.top + targetRect.height * 0.58;
    const dx = Math.abs(targetAimX - crosshairX);
    const dy = Math.abs(targetAimY - crosshairY);
    return dx <= TARGET_LOCK_X && dy <= TARGET_LOCK_Y;
  }

  function updatePeriscopeVisuals() {
    els.periscopeOcean.style.transform = `translate(${session.viewX}px, ${session.viewY}px)`;
    const escortLeft = getShipScreenLeft(session.escort.x);
    const targetBottom = getShipScreenBottom(session.target.y);
    const escortBottom = getShipScreenBottom(session.escort.y);
    if (session.targetDestroyed) {
      els.targetShip.classList.add('hidden');
    } else {
      const targetLeft = getShipScreenLeft(session.target.x);
      els.targetShip.classList.remove('hidden');
      els.targetShip.style.left = `${targetLeft}%`;
      els.targetShip.style.bottom = `${targetBottom}%`;
    }
    els.escortShip.style.left = `${escortLeft}%`;
    els.escortShip.style.bottom = `${escortBottom}%`;
    const lock = computeTargetLock();
    if (session.missionFailed) {
      els.lockLabel.textContent = 'MISSÃO PERDIDA';
      els.lockLabel.classList.remove('active');
      return false;
    }
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
    if (session.torpedoActive || session.targetDestroyed || session.missionFailed) return;
    hideShotEffects();
    session.torpedoActive = true;
    els.torpedoShot.classList.remove('hidden');
    const hit = updatePeriscopeVisuals();
    const timeout1 = setTimeout(() => {
      els.torpedoShot.classList.add('hidden');
      if (hit) {
        session.targetDestroyed = true;
        session.canComplete = true;
        session.escortAggro = true;
        els.impactExplosion.classList.remove('hidden');
        els.completeMission.classList.remove('hidden');
        els.missionHint.textContent = t('gameplay.hintSuccess');
      } else {
        session.escortAggro = true;
        els.impactSplash.classList.remove('hidden');
        els.missionHint.textContent = t('gameplay.hintMiss');
      }
      updatePeriscopeVisuals();
      updateRadar();
      updateHUD();
      session.torpedoActive = false;
    }, 1000);
    const timeout2 = setTimeout(() => {
      els.impactExplosion.classList.add('hidden');
      els.impactSplash.classList.add('hidden');
      if (session.targetDestroyed) {
        els.targetShip.classList.add('hidden');
      }
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
  bind(els.completeMission, 'click', () => { if (!session.missionFailed && session.canComplete) onMissionComplete(session.missionId); });
  bind(els.viewLeft, 'click', () => { session.viewX = clamp(session.viewX + VIEW_STEP_X, -VIEW_RANGE_X, VIEW_RANGE_X); updatePeriscopeVisuals(); });
  bind(els.viewRight, 'click', () => { session.viewX = clamp(session.viewX - VIEW_STEP_X, -VIEW_RANGE_X, VIEW_RANGE_X); updatePeriscopeVisuals(); });
  bind(els.viewUp, 'click', () => { session.viewY = clamp(session.viewY - VIEW_STEP_Y, -VIEW_RANGE_Y, VIEW_RANGE_Y); updatePeriscopeVisuals(); });
  bind(els.viewDown, 'click', () => { session.viewY = clamp(session.viewY + VIEW_STEP_Y, -VIEW_RANGE_Y, VIEW_RANGE_Y); updatePeriscopeVisuals(); });

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
