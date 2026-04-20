const CACHE_NAME = 'submarine-commander-v0-3-3';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/reset.css',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/screens.css',
  './css/responsive.css',
  './js/app.js',
  './js/build.js',
  './js/state.js',
  './js/save.js',
  './js/i18n.js',
  './js/dataLoader.js',
  './js/components/ui.js',
  './js/screens/splash.js',
  './js/screens/mainMenu.js',
  './js/screens/commander.js',
  './js/screens/lobby.js',
  './js/screens/campaign.js',
  './js/screens/arsenal.js',
  './js/screens/crew.js',
  './js/screens/settings.js',
  './data/nations.json',
  './data/submarines.json',
  './data/crew.json',
  './data/missions.json',
  './data/translations/pt-BR.json',
  './data/translations/en.json',
  './data/translations/es.json',
  './assets/logos/submarine_commander_logo.png',
  './assets/backgrounds/naval_base_lobby.png',
  './assets/backgrounds/briefing_room.png',
  './assets/backgrounds/arsenal_workshop.png',
  './assets/backgrounds/strategy_room_alt.png',
  './assets/backgrounds/submarine_control_room.png',
  './assets/ui/icons/icon_submarine.png',
  './assets/ui/icons/icon_crew.png',
  './assets/ui/icons/icon_navigation.png',
  './assets/ui/icons/icon_economy.png',
  './assets/ui/icons/icon_settings.png',
  './assets/meta/icons/icon-192.png',
  './assets/meta/icons/icon-512.png',
  './assets/gauges/depth_gauge_base.png',
  './assets/gauges/depth_gauge_needle.png',
  './assets/gauges/speed_telegraph_base.png',
  './assets/gauges/speed_telegraph_lever.png',
  './assets/radar/radar_base.png',
  './assets/radar/radar_scan.png',
  './assets/radar/radar_player.png',
  './assets/radar/radar_enemy.png',
  './assets/radar/radar_ally.png',
  './assets/periscope/ocean_panorama_day.png',
  './assets/periscope/periscope_crosshair.png',
  './assets/periscope/periscope_glass.png',
  './assets/periscope/periscope_overlay.png',
  './assets/ships/merchant_ship_01.png',
  './assets/ships/destroyer_01.png',
  './assets/effects/torpedo_moving_01.png',
  './assets/effects/ocean_explosion_01.png',
  './assets/effects/water_splash_01.png',
  './js/screens/gameplay.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
