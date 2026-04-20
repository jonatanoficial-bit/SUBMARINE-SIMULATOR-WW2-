export const ASSETS = {
  logos: {
    main: './assets/logos/submarine_commander_logo.png',
    valeClean: './assets/logos/vale_games_logo_clean.png'
  },
  backgrounds: {
    naval_base_lobby: './assets/backgrounds/naval_base_lobby.png',
    briefing_room: './assets/backgrounds/briefing_room.png',
    arsenal_workshop: './assets/backgrounds/arsenal_workshop.png',
    strategy_room_alt: './assets/backgrounds/strategy_room_alt.png',
    submarine_control_room: './assets/backgrounds/submarine_control_room.png',
    naval_battle: './assets/backgrounds/naval_battle.png'
  },
  icons: {
    submarine: './assets/ui/icons/icon_submarine.png',
    crew: './assets/ui/icons/icon_crew.png',
    navigation: './assets/ui/icons/icon_navigation.png',
    economy: './assets/ui/icons/icon_economy.png',
    settings: './assets/ui/icons/icon_settings.png'
  },
  gauges: {
    depthBase: './assets/gauges/depth_gauge_base.png',
    depthNeedle: './assets/gauges/depth_gauge_needle.png',
    speedBase: './assets/gauges/speed_telegraph_base.png',
    speedLever: './assets/gauges/speed_telegraph_lever.png'
  },
  radar: {
    base: './assets/radar/radar_base.png',
    scan: './assets/radar/radar_scan.png',
    player: './assets/radar/radar_player.png',
    enemy: './assets/radar/radar_enemy.png',
    ally: './assets/radar/radar_ally.png'
  },
  periscope: {
    oceanDay: './assets/periscope/ocean_panorama_day.png',
    crosshair: './assets/periscope/periscope_crosshair.png',
    glass: './assets/periscope/periscope_glass.png',
    overlay: './assets/periscope/periscope_overlay.png'
  },
  ships: {
    merchant: './assets/ships/merchant_ship_01.png',
    destroyer: './assets/ships/destroyer_01.png',
    submarine: './assets/ships/submarine_ww2_01.png'
  },
  effects: {
    torpedo: './assets/effects/torpedo_moving_01.png',
    explosion: './assets/effects/ocean_explosion_01.png',
    splash: './assets/effects/water_splash_01.png',
    splashLarge: './assets/effects/water_splash_large.png',
    alert: './assets/effects/alert_light.png'
  },
  avatars: {
    de: {
      captain: './assets/avatars/de/captain_01.png',
      officer: './assets/avatars/de/officer_01.png',
      mechanic: './assets/avatars/de/mechanic_01.png',
      sonar: './assets/avatars/de/sonar_01.png'
    },
    uk: {
      captain: './assets/avatars/uk/captain_01.png',
      sailor: './assets/avatars/uk/sailor_01.png'
    },
    us: {
      captain: './assets/avatars/us/captain_01.png',
      sailor: './assets/avatars/us/sailor_01.png'
    }
  },
  meta: {
    favicon: './assets/meta/icons/favicon.png',
    appleTouch: './assets/meta/icons/apple-touch-icon.png',
    icon192: './assets/meta/icons/icon-192.png',
    icon512: './assets/meta/icons/icon-512.png'
  }
};

export function backgroundPath(key) {
  return ASSETS.backgrounds[key] || ASSETS.backgrounds.naval_base_lobby;
}
