import { analyzeCaptainCommandThreat } from './captainCommandChain.js';

export const PHASE51_CAPTAIN_COMMAND_ROOM = Object.freeze({
  phase: 51,
  system: 'definitive-captain-command-room',
  version: 'v2.0.0-alpha.66',
  doctrine: 'mobile-first-fullscreen-command-room-captain-decides-crew-executes',
  manualOverride: true,
  preservesExistingAssetsAndAudio: true,
  saveSchemaStable: true,
});

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, n(value)));
}

function pct(value) {
  return Math.round(clamp(value, 0, 100));
}

function hasCriticalDamage(snapshot = {}) {
  const systems = snapshot.systems || {};
  const hull = clamp(snapshot.hull ?? snapshot.damageControl?.hullIntegrity ?? 100, 0, 100);
  const damage = snapshot.damage || snapshot.damageControl || {};
  const failedSystem = Object.values(systems).some((value) => n(value, 100) <= 12);
  return hull <= 35 || n(damage.criticalCount, 0) > 0 || failedSystem;
}

function weaponStatus(snapshot = {}) {
  const weapons = snapshot.weapons || {};
  const quality = clamp(weapons.tdc?.solutionQuality ?? weapons.solutionQuality ?? 0, 0, 100);
  const minimum = n(weapons.minimumSolutionQuality, 42);
  const depth = n(snapshot.depth ?? snapshot.physics?.depth, 0);
  const maxLaunchDepth = n(weapons.profile?.maxLaunchDepth, 60);
  return {
    quality,
    minimum,
    canFire: Boolean(weapons.canFire),
    torpedoes: n(weapons.torpedoes ?? weapons.torpedoCount ?? snapshot.torpedoes, 0),
    depthAllowed: depth <= maxLaunchDepth,
    depth,
    maxLaunchDepth,
  };
}

function stationCard({ station, roleKey, asset, icon, statusKey, detailKey, urgency = 'normal', progress = 0, command = '', actionKey = 'commandRoom.action.station' } = {}) {
  return {
    station,
    roleKey,
    asset,
    icon,
    statusKey,
    detailKey,
    urgency,
    progress: pct(progress),
    command,
    actionKey,
  };
}

function baseCards({ snapshot = {}, threat = {}, weapon = {}, criticalDamage = false } = {}) {
  const hull = clamp(snapshot.hull ?? 100, 0, 100);
  const oxygen = clamp(snapshot.physics?.oxygen ?? 100, 0, 100);
  const battery = clamp(snapshot.physics?.battery ?? 100, 0, 100);
  const navProgress = pct(snapshot.navigation?.patrolProgress ?? snapshot.patrolProgress ?? 0);
  const contactProgress = Math.max(threat.targetConfidence || 0, threat.escortConfidence || 0, threat.airConfidence || 0);
  const weaponProgress = weapon.canFire ? 100 : weapon.quality;
  return [
    stationCard({
      station: 'command',
      roleKey: 'commandRoom.role.subofficer',
      asset: 'assets/avatars/de/officer_01.png',
      icon: 'assets/ui/icons/icon_crew.png',
      statusKey: threat.hasTarget ? 'commandRoom.status.commandContact' : 'commandRoom.status.commandPatrol',
      detailKey: threat.hasEscortThreat || threat.hasAirThreat ? 'commandRoom.detail.commandThreat' : 'commandRoom.detail.commandWaiting',
      urgency: threat.hasEscortThreat || threat.hasAirThreat ? 'danger' : 'normal',
      progress: Math.max(45, contactProgress),
      command: threat.hasTarget ? 'hold-shadow' : 'plan-patrol',
    }),
    stationCard({
      station: 'sensors',
      roleKey: 'commandRoom.role.sonar',
      asset: 'assets/avatars/de/sonar_01.png',
      icon: 'assets/ui/instruments/sonar_icon.png',
      statusKey: threat.hasTarget ? 'commandRoom.status.sonarContact' : 'commandRoom.status.sonarListening',
      detailKey: threat.hasTarget ? 'commandRoom.detail.sonarClassifying' : 'commandRoom.detail.sonarSweep',
      urgency: threat.hasEscortThreat || threat.hasAirThreat ? 'danger' : threat.hasTarget ? 'watch' : 'normal',
      progress: contactProgress,
      command: threat.hasTarget ? 'hold-shadow' : 'silent-running',
    }),
    stationCard({
      station: 'weapons',
      roleKey: 'commandRoom.role.weapons',
      asset: 'assets/avatars/de/officer_01.png',
      icon: 'assets/ui/instruments/torpedo_icon.png',
      statusKey: weapon.canFire ? 'commandRoom.status.weaponsReady' : weapon.torpedoes > 0 ? 'commandRoom.status.weaponsPreparing' : 'commandRoom.status.weaponsEmpty',
      detailKey: weapon.canFire ? 'commandRoom.detail.weaponsAwaitFire' : 'commandRoom.detail.weaponsTdc',
      urgency: weapon.canFire ? 'attack' : threat.hasTarget ? 'watch' : 'normal',
      progress: weaponProgress,
      command: weapon.canFire ? 'fire-confirm' : 'prepare-attack',
    }),
    stationCard({
      station: 'damage',
      roleKey: 'commandRoom.role.mechanic',
      asset: 'assets/avatars/de/mechanic_01.png',
      icon: 'assets/ui/instruments/speed_telegraph_icon.png',
      statusKey: criticalDamage ? 'commandRoom.status.damageCritical' : 'commandRoom.status.damageStable',
      detailKey: oxygen <= 35 ? 'commandRoom.detail.damageOxygen' : battery <= 28 ? 'commandRoom.detail.damageBattery' : 'commandRoom.detail.damageHull',
      urgency: criticalDamage ? 'critical' : hull <= 62 || oxygen <= 45 || battery <= 35 ? 'watch' : 'normal',
      progress: 100 - Math.min(100 - hull, 100 - oxygen, 100 - battery),
      command: criticalDamage ? 'authorize-repair' : 'slow-speed',
    }),
  ];
}

function chooseDecision({ snapshot = {}, threat = {}, weapon = {}, criticalDamage = false, chain = {}, combat = {}, commandMode = 'captain' } = {}) {
  if (commandMode === 'manual') {
    return {
      tone: 'manual',
      headlineKey: 'commandRoom.headline.manual',
      situationKey: 'commandRoom.situation.manual',
      decisionKey: 'commandRoom.decision.manual',
      primaryCommand: '',
      primaryStation: 'command',
      secondaryCommand: 'captain-command',
      secondaryStation: 'command',
      primaryActionKey: 'commandRoom.action.manualDisabled',
      secondaryActionKey: 'commandRoom.action.returnCaptain',
      priority: 100,
    };
  }
  if (snapshot.missionFailed) {
    return {
      tone: 'critical',
      headlineKey: 'commandRoom.headline.missionLost',
      situationKey: 'commandRoom.situation.missionLost',
      decisionKey: 'commandRoom.decision.missionLost',
      primaryCommand: '',
      primaryStation: 'command',
      secondaryCommand: '',
      secondaryStation: 'command',
      primaryActionKey: 'commandRoom.action.standby',
      secondaryActionKey: 'commandRoom.action.none',
      priority: 100,
    };
  }
  if (snapshot.targetDestroyed || snapshot.canComplete) {
    return {
      tone: 'success',
      headlineKey: 'commandRoom.headline.objectiveDone',
      situationKey: 'commandRoom.situation.objectiveDone',
      decisionKey: 'commandRoom.decision.objectiveDone',
      primaryCommand: 'hold-shadow',
      primaryStation: 'sensors',
      secondaryCommand: 'silent-running',
      secondaryStation: 'sensors',
      primaryActionKey: 'commandRoom.action.clearArea',
      secondaryActionKey: 'commandRoom.action.silence',
      priority: 95,
    };
  }
  if (criticalDamage) {
    return {
      tone: 'critical',
      headlineKey: 'commandRoom.headline.damage',
      situationKey: 'commandRoom.situation.damage',
      decisionKey: 'commandRoom.decision.damage',
      primaryCommand: 'authorize-repair',
      primaryStation: 'damage',
      secondaryCommand: 'stop-boat',
      secondaryStation: 'damage',
      primaryActionKey: 'commandRoom.action.authorizeRepair',
      secondaryActionKey: 'commandRoom.action.stopBoat',
      priority: 92,
    };
  }
  if (threat.hasAirThreat) {
    return {
      tone: 'danger',
      headlineKey: 'commandRoom.headline.air',
      situationKey: 'commandRoom.situation.air',
      decisionKey: 'commandRoom.decision.air',
      primaryCommand: 'emergency-dive',
      primaryStation: 'instruments',
      secondaryCommand: 'silent-running',
      secondaryStation: 'sensors',
      primaryActionKey: 'commandRoom.action.emergencyDive',
      secondaryActionKey: 'commandRoom.action.silence',
      priority: 90,
    };
  }
  if (snapshot.torpedoActive) {
    return {
      tone: threat.hasEscortThreat ? 'danger' : 'attack',
      headlineKey: 'commandRoom.headline.torpedo',
      situationKey: threat.hasEscortThreat ? 'commandRoom.situation.torpedoEscort' : 'commandRoom.situation.torpedo',
      decisionKey: threat.hasEscortThreat ? 'commandRoom.decision.torpedoEscort' : 'commandRoom.decision.torpedo',
      primaryCommand: threat.hasEscortThreat ? 'evade-now' : 'hold-shadow',
      primaryStation: threat.hasEscortThreat ? 'instruments' : 'sensors',
      secondaryCommand: 'silent-running',
      secondaryStation: 'sensors',
      primaryActionKey: threat.hasEscortThreat ? 'commandRoom.action.evade' : 'commandRoom.action.holdShadow',
      secondaryActionKey: 'commandRoom.action.silence',
      priority: 86,
    };
  }
  if (weapon.canFire && snapshot.periscopeOpen && threat.hasTarget) {
    return {
      tone: threat.hasEscortThreat ? 'danger' : 'attack',
      headlineKey: 'commandRoom.headline.fire',
      situationKey: threat.hasEscortThreat ? 'commandRoom.situation.fireEscort' : 'commandRoom.situation.fire',
      decisionKey: 'commandRoom.decision.fire',
      primaryCommand: 'fire-confirm',
      primaryStation: 'periscope',
      secondaryCommand: 'cancel-attack',
      secondaryStation: 'sensors',
      primaryActionKey: 'commandRoom.action.fire',
      secondaryActionKey: 'commandRoom.action.cancelAttack',
      priority: 84,
    };
  }
  if (threat.hasTarget && weapon.quality >= weapon.minimum && !snapshot.periscopeOpen) {
    return {
      tone: 'attack',
      headlineKey: 'commandRoom.headline.visual',
      situationKey: 'commandRoom.situation.visual',
      decisionKey: 'commandRoom.decision.visual',
      primaryCommand: 'open-periscope',
      primaryStation: 'periscope',
      secondaryCommand: 'hold-shadow',
      secondaryStation: 'sensors',
      primaryActionKey: 'commandRoom.action.openScope',
      secondaryActionKey: 'commandRoom.action.holdShadow',
      priority: 78,
    };
  }
  if (threat.hasTarget && weapon.depth > weapon.maxLaunchDepth) {
    return {
      tone: 'warning',
      headlineKey: 'commandRoom.headline.depth',
      situationKey: 'commandRoom.situation.depth',
      decisionKey: 'commandRoom.decision.depth',
      primaryCommand: 'order-periscope-depth',
      primaryStation: 'instruments',
      secondaryCommand: 'hold-shadow',
      secondaryStation: 'sensors',
      primaryActionKey: 'commandRoom.action.periscopeDepth',
      secondaryActionKey: 'commandRoom.action.holdShadow',
      priority: 76,
    };
  }
  if (threat.hasTarget && threat.targetConfidence >= 45) {
    return {
      tone: 'watch',
      headlineKey: 'commandRoom.headline.target',
      situationKey: 'commandRoom.situation.target',
      decisionKey: 'commandRoom.decision.target',
      primaryCommand: 'prepare-attack',
      primaryStation: 'weapons',
      secondaryCommand: 'hold-shadow',
      secondaryStation: 'sensors',
      primaryActionKey: 'commandRoom.action.prepareAttack',
      secondaryActionKey: 'commandRoom.action.holdShadow',
      priority: 70,
    };
  }
  if (threat.hasTarget || (chain?.nextCommand && combat?.state !== 'patrol')) {
    return {
      tone: 'watch',
      headlineKey: 'commandRoom.headline.contact',
      situationKey: 'commandRoom.situation.contact',
      decisionKey: 'commandRoom.decision.contact',
      primaryCommand: chain?.nextCommand || 'hold-shadow',
      primaryStation: chain?.actionStation || chain?.station || 'sensors',
      secondaryCommand: 'silent-running',
      secondaryStation: 'sensors',
      primaryActionKey: 'commandRoom.action.executeCrew',
      secondaryActionKey: 'commandRoom.action.silence',
      priority: 62,
    };
  }
  return {
    tone: 'calm',
    headlineKey: 'commandRoom.headline.patrol',
    situationKey: 'commandRoom.situation.patrol',
    decisionKey: 'commandRoom.decision.patrol',
    primaryCommand: 'plan-patrol',
    primaryStation: 'navigation',
    secondaryCommand: 'silent-running',
    secondaryStation: 'sensors',
    primaryActionKey: 'commandRoom.action.planPatrol',
    secondaryActionKey: 'commandRoom.action.silence',
    priority: 40,
  };
}

export function buildCaptainCommandRoomView({ snapshot = {}, execution = null, flow = null, chain = null, combat = null, commandMode = 'captain', nation = 'de' } = {}) {
  const threat = analyzeCaptainCommandThreat(snapshot);
  const weapon = weaponStatus(snapshot);
  const criticalDamage = hasCriticalDamage(snapshot);
  const decision = chooseDecision({ snapshot, threat, weapon, criticalDamage, chain, combat, commandMode });
  const cards = baseCards({ snapshot, threat, weapon, criticalDamage }).map((card) => {
    if (nation && nation !== 'de' && card.asset?.includes('/de/')) {
      if (card.roleKey === 'commandRoom.role.subofficer') return { ...card, asset: `assets/avatars/${nation}/sailor_01.png` };
    }
    if (card.command === decision.primaryCommand) return { ...card, urgency: decision.tone === 'success' ? 'normal' : decision.tone, progress: Math.max(card.progress, decision.priority) };
    return card;
  });
  return {
    phase: PHASE51_CAPTAIN_COMMAND_ROOM.phase,
    system: PHASE51_CAPTAIN_COMMAND_ROOM.system,
    version: PHASE51_CAPTAIN_COMMAND_ROOM.version,
    mode: commandMode === 'manual' ? 'manual' : 'captain',
    tone: decision.tone,
    headlineKey: decision.headlineKey,
    situationKey: decision.situationKey,
    decisionKey: decision.decisionKey,
    primaryCommand: decision.primaryCommand,
    primaryStation: decision.primaryStation,
    secondaryCommand: decision.secondaryCommand,
    secondaryStation: decision.secondaryStation,
    primaryActionKey: decision.primaryActionKey,
    secondaryActionKey: decision.secondaryActionKey,
    priority: pct(decision.priority),
    manualOverride: PHASE51_CAPTAIN_COMMAND_ROOM.manualOverride,
    preserveAssets: PHASE51_CAPTAIN_COMMAND_ROOM.preservesExistingAssetsAndAudio,
    saveSchemaStable: PHASE51_CAPTAIN_COMMAND_ROOM.saveSchemaStable,
    cards,
  };
}
