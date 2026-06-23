const CACHE_PREFIX = 'submarine-commander-';
const CACHE_VERSION = '2.0.0-alpha.35';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './BUILD_INFO.json',
  './css/reset.css',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/screens.css',
  './css/responsive.css',
  './css/phase2-responsive.css',
  './css/phase3-engine.css',
  './css/phase4-save.css',
  './css/phase5-navigation.css',
  './css/phase6-physics.css',
  './css/phase7-sensors.css',
  './css/phase8-weapons.css',
  './css/phase9-ai.css',
  './css/phase10-damage.css',
  './css/phase10-1-stabilization.css',
  './css/phase10-2-tactical.css',
  './css/phase10-3-realism.css',
  './css/phase10-4-training.css',
  './css/phase11-campaigns.css',
  './css/phase12-career-logistics.css',
  './css/phase12-campaign-doctrines.css',
  './css/phase13-strategic-command.css',
  './css/phase13-campaign-objectives.css',
  './css/phase14-campaign-consequences.css',
  './css/phase15-high-command-orders.css',
  './css/phase16-campaign-events.css',
  './css/phase17-special-operations.css',
  './css/phase18-operation-chains.css',
  './css/phase19-operation-outcomes.css',
  './css/phase14-bridge-instruments.css',
  './css/phase15-command-room.css',
  './css/phase16-buoyancy-depth.css',
  './css/phase17-sonar-room.css',
  './css/phase18-periscope-optics.css',
  './css/phase19-tdc-fire-control.css',
  './css/phase20-mobile-scroll.css',
  './css/phase21-damage-emergency.css',
  './css/phase23-crew-readiness.css',
  './css/phase24-ocean-weather.css',
  './css/phase25-convoy-doctrine.css',
  './js/app.js',
  './js/build.js',
  './js/state.js',
  './js/save.js',
  './js/i18n.js',
  './js/dataLoader.js',
  './js/safety.js',
  './js/audio.js',
  './js/oceanWeather.js',
  './js/utils/sanitize.js',
  './js/components/ui.js',
  './js/engine/core/EventBus.js',
  './js/engine/core/SimulationClock.js',
  './js/engine/navigation/NavigationSystem.js',
  './js/engine/physics/SubmarinePhysicsSystem.js',
  './js/engine/sensors/SensorSystem.js',
  './js/engine/weapons/WeaponSystem.js',
  './js/engine/ai/NavalAISystem.js',
  './js/engine/damage/DamageControlSystem.js',
  './js/engine/tactical/TacticalEncounterSystem.js',
  './js/engine/environment/EnvironmentSystem.js',
  './js/engine/training/DifficultyProfile.js',
  './js/engine/training/OperationalTraining.js',
  './js/engine/entities/Entity.js',
  './js/engine/entities/SubmarineEntity.js',
  './js/engine/entities/ShipEntity.js',
  './js/engine/simulation/constants.js',
  './js/engine/simulation/simulationMath.js',
  './js/engine/simulation/SimulationEngine.js',
  './js/engine/scenes/SceneManager.js',
  './js/screens/splash.js',
  './js/screens/mainMenu.js',
  './js/screens/commander.js',
  './js/screens/lobby.js',
  './js/screens/campaign.js',
  './js/screens/career.js',
  './js/screens/strategy.js',
  './js/screens/bridge.js',
  './js/screens/arsenal.js',
  './js/screens/crew.js',
  './js/screens/settings.js',
  './js/screens/profiles.js',
  './js/screens/briefing.js',
  './js/screens/gameplay.js',
  './js/systems/crewReadiness.js',
  './js/systems/convoyDoctrine.js',
  './js/systems/campaignDoctrine.js',
  './js/systems/campaignObjectives.js',
  './js/systems/campaignConsequences.js',
  './js/systems/highCommandOrders.js',
  './js/systems/campaignEvents.js',
  './js/systems/specialOperations.js',
  './js/systems/operationChains.js',
  './js/systems/operationOutcomes.js',
  './data/nations.json',
  './data/submarines.json',
  './data/crew.json',
  './data/missions.json',
  './data/campaigns.json',
  './data/campaign_doctrines.json',
  './data/campaign_objectives.json',
  './data/campaign_consequences.json',
  './data/high_command_orders.json',
  './data/campaign_events.json',
  './data/special_operations.json',
  './data/operation_chains.json',
  './data/operation_outcomes.json',
  './data/logistics.json',
  './data/strategy.json',
  './data/upgrades.json',
  './data/translations/pt-BR.json',
  './data/translations/en.json',
  './data/translations/es.json',
  './assets/logos/submarine_commander_logo.png',
  './assets/meta/icons/icon-192.png',
  './assets/meta/icons/icon-512.png',
  './assets/backgrounds/naval_base_lobby.png',
  './assets/backgrounds/briefing_room.png',
  './assets/backgrounds/arsenal_workshop.png',
  './assets/backgrounds/strategy_room_alt.png',
  './assets/backgrounds/submarine_control_room.png',
  './assets/backgrounds/naval_battle.png',
  './assets/periscope/ocean_panorama_day.png',
  './assets/ships/merchant_ship_01.png',
  './assets/ships/destroyer_01.png',
  './assets/effects/torpedo_moving_01.png',
  './assets/effects/ocean_explosion_01.png',
  './assets/effects/water_splash_01.png',
  './assets/audio/music/submarine_commander_theme_01.mp3',
  './assets/audio/music/submarine_commander_theme_02.mp3',
  './assets/audio/music/submarine_commander_theme_03.mp3',
  './assets/audio/music/submarine_commander_theme_04.mp3',
  './assets/audio/music/submarine_commander_theme_05.mp3',
  './assets/audio/music/submarine_commander_theme_06.mp3',
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const failures = [];
  for (const asset of APP_SHELL) {
    try {
      const response = await fetch(new Request(asset, { cache: 'reload' }));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await cache.put(asset, response);
    } catch (error) {
      failures.push(`${asset}: ${error.message}`);
    }
  }
  if (failures.length) throw new Error(`App shell incomplete: ${failures.join(' | ')}`);
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

async function networkFirst(request, fallbackUrl = null) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  if (url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
