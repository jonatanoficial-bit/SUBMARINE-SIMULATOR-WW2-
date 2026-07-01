export const PHASE52_CAPTAIN_DELEGATION_ADVISOR = Object.freeze({
  phase: 52,
  system: 'captain-delegation-advisor',
  version: 'v2.0.0-alpha.67',
  doctrine: 'captain-delegates-crew-executes-player-can-always-operate-manually',
  mobileFullscreen: true,
  preservesExistingAssetsAndAudio: true,
  usesExistingAssetsFolder: true,
  saveSchemaStable: true,
});

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, n(value)));
}

function roleOf(contact = {}, fallback = 'unknown') {
  const raw = String(contact.role || contact.type || contact.kind || fallback || 'unknown').toLowerCase();
  if (raw.includes('air') || raw.includes('plane') || raw.includes('aircraft') || raw.includes('aeronave')) return 'aircraft';
  if (raw.includes('destroyer') || raw.includes('escort') || raw.includes('contratorpedeiro') || raw.includes('escolta')) return 'destroyer';
  if (raw.includes('merchant') || raw.includes('cargo') || raw.includes('cargueiro') || raw.includes('tanker') || raw.includes('petroleiro')) return 'merchant';
  if (raw.includes('sub')) return 'submarine';
  if (raw.includes('warship') || raw.includes('navio militar')) return 'warship';
  return fallback === 'target' ? 'merchant' : fallback === 'escort' ? 'destroyer' : fallback === 'air' ? 'aircraft' : 'unknown';
}

function addContact(map, contact = null, fallback = 'unknown') {
  if (!contact || typeof contact !== 'object') return;
  const confidence = clamp(contact.confidence ?? contact.detection ?? contact.strength ?? 0, 0, 100);
  const hasIdentity = Boolean(contact.id || contact.name || contact.role || contact.type || contact.kind || contact.bearing !== undefined || contact.rangeMeters !== undefined);
  const detected = contact.detected === true || confidence > 0 || hasIdentity;
  if (!detected) return;
  const role = roleOf(contact, fallback);
  const id = String(contact.id || contact.name || `${fallback}-${role}-${map.size}`);
  map.set(id, {
    id,
    role,
    confidence,
    bearing: contact.bearing,
    rangeMeters: contact.rangeMeters,
    hostile: role !== 'merchant' || fallback === 'escort' || fallback === 'air',
  });
}

export function buildDelegationRadioReport(snapshot = {}) {
  const sensors = snapshot.sensors || {};
  const contacts = sensors.contacts || {};
  const map = new Map();
  Object.entries(contacts).forEach(([key, value]) => addContact(map, value, key));
  addContact(map, sensors.strongestContact, 'target');
  const convoyShips = snapshot.navalAI?.convoy?.ships || snapshot.convoy?.ships || [];
  if (Array.isArray(convoyShips)) convoyShips.forEach((ship, index) => addContact(map, { ...ship, id: ship.id || `convoy-${index}`, confidence: ship.confidence ?? 50 }, ship.role || 'merchant'));
  const list = Array.from(map.values()).filter((item) => item.confidence >= 1 || item.role !== 'unknown');
  const counts = list.reduce((acc, item) => {
    acc[item.role] = (acc[item.role] || 0) + 1;
    return acc;
  }, {});
  const total = list.length;
  const hostileTotal = list.filter((item) => item.hostile || ['destroyer', 'aircraft', 'submarine', 'warship'].includes(item.role)).length;
  const typeOrder = ['merchant', 'destroyer', 'aircraft', 'submarine', 'warship', 'unknown'];
  const typeKeys = typeOrder.filter((role) => counts[role]).map((role) => ({
    role,
    count: counts[role],
    key: `delegation.radio.type.${role}`,
  }));
  let titleKey = 'delegation.radio.title.clear';
  if (counts.aircraft) titleKey = 'delegation.radio.title.air';
  else if (counts.destroyer || counts.warship || counts.submarine) titleKey = 'delegation.radio.title.enemy';
  else if (counts.merchant) titleKey = 'delegation.radio.title.target';
  return {
    total,
    hostileTotal,
    counts,
    contacts: list,
    typeKeys,
    titleKey,
    textKey: total ? 'delegation.radio.text.contacts' : 'delegation.radio.text.clear',
    confidence: Math.round(Math.max(0, ...list.map((item) => item.confidence || 0))),
  };
}

function hasCriticalDamage(snapshot = {}) {
  const hull = clamp(snapshot.hull ?? snapshot.damageControl?.hullIntegrity ?? 100, 0, 100);
  const damage = snapshot.damage || snapshot.damageControl || {};
  const systems = snapshot.systems || {};
  const failedSystem = Object.values(systems).some((value) => n(value, 100) <= 12);
  return hull <= 38 || n(damage.criticalCount, 0) > 0 || n(damage.criticalCompartments, 0) > 0 || failedSystem;
}

function weaponStatus(snapshot = {}) {
  const weapons = snapshot.weapons || {};
  const tdc = weapons.tdc || {};
  const quality = clamp(tdc.solutionQuality ?? weapons.solutionQuality ?? 0, 0, 100);
  const minimum = n(weapons.minimumSolutionQuality, 42);
  return {
    canFire: Boolean(weapons.canFire),
    quality,
    minimum,
    torpedoes: n(weapons.torpedoes ?? weapons.torpedoCount ?? weapons.reserveTorpedoes ?? snapshot.torpedoes, 0),
    ready: Boolean(weapons.canFire) && quality >= minimum,
  };
}

function contactFlags(snapshot = {}, radio = buildDelegationRadioReport(snapshot)) {
  const counts = radio.counts || {};
  const sensors = snapshot.sensors || {};
  const target = sensors.contacts?.target || sensors.strongestContact || {};
  const targetConfidence = clamp(target.confidence ?? 0, 0, 100);
  return {
    hasTarget: Boolean(counts.merchant || target.detected || targetConfidence >= 28),
    hasEscort: Boolean(counts.destroyer || counts.warship || snapshot.escortState === 'hunt' || snapshot.escortState === 'alert'),
    hasAir: Boolean(counts.aircraft || snapshot.navalAI?.aircraft?.active || ['attack', 'attack-run', 'tracking'].includes(snapshot.navalAI?.aircraft?.state)),
    targetConfidence,
  };
}

function hasAutoRouteNeeded(snapshot = {}) {
  const navigation = snapshot.navigation || {};
  const route = Array.isArray(navigation.route) ? navigation.route : [];
  const elapsed = n(snapshot.elapsedMs ?? snapshot.worldTime, 0);
  return !route.length || (!navigation.patrolEntered && elapsed < 45000);
}

function scenario({ snapshot = {}, commandMode = 'captain', radio = buildDelegationRadioReport(snapshot) } = {}) {
  const flags = contactFlags(snapshot, radio);
  const weapons = weaponStatus(snapshot);
  const criticalDamage = hasCriticalDamage(snapshot);
  const periscopeOpen = Boolean(snapshot.periscopeOpen);
  if (commandMode === 'manual') {
    return {
      id: 'manual', tone: 'manual', station: 'command', officerKey: 'delegation.officer.subofficer',
      titleKey: 'delegation.title.manual', questionKey: 'delegation.question.manual',
      autoCommand: 'captain-command', autoStation: 'command', autoLabelKey: 'delegation.action.backCaptain',
      manualCommand: '', manualStation: 'command', manualLabelKey: 'delegation.action.manualActive',
      infoCommand: 'radio-report', infoStation: 'sensors', infoLabelKey: 'delegation.action.radioInfo',
    };
  }
  if (snapshot.missionFailed) {
    return {
      id: 'mission-lost', tone: 'critical', station: 'damage', officerKey: 'delegation.officer.subofficer',
      titleKey: 'delegation.title.missionLost', questionKey: 'delegation.question.missionLost',
      autoCommand: '', autoStation: 'damage', autoLabelKey: 'delegation.action.noAuto',
      manualCommand: 'manual-damage', manualStation: 'damage', manualLabelKey: 'delegation.action.manualDamage',
      infoCommand: 'radio-report', infoStation: 'sensors', infoLabelKey: 'delegation.action.radioInfo',
    };
  }
  if (criticalDamage) {
    return {
      id: 'damage', tone: 'critical', station: 'damage', officerKey: 'delegation.officer.mechanic',
      titleKey: 'delegation.title.damage', questionKey: 'delegation.question.damage',
      autoCommand: 'authorize-repair', autoStation: 'damage', autoLabelKey: 'delegation.action.autoRepair',
      manualCommand: 'manual-damage', manualStation: 'damage', manualLabelKey: 'delegation.action.manualDamage',
      infoCommand: 'radio-report', infoStation: 'sensors', infoLabelKey: 'delegation.action.radioInfo',
    };
  }
  if (flags.hasAir) {
    return {
      id: 'air-danger', tone: 'critical', station: 'instruments', officerKey: 'delegation.officer.subofficer',
      titleKey: 'delegation.title.air', questionKey: 'delegation.question.air',
      autoCommand: 'emergency-dive', autoStation: 'instruments', autoLabelKey: 'delegation.action.autoDive',
      manualCommand: 'manual-evasion', manualStation: 'instruments', manualLabelKey: 'delegation.action.manualEvasion',
      infoCommand: 'radio-report', infoStation: 'sensors', infoLabelKey: 'delegation.action.radioInfo',
    };
  }
  if (snapshot.torpedoActive && flags.hasEscort) {
    return {
      id: 'post-shot-escort', tone: 'danger', station: 'instruments', officerKey: 'delegation.officer.subofficer',
      titleKey: 'delegation.title.postShot', questionKey: 'delegation.question.postShot',
      autoCommand: 'evade-now', autoStation: 'instruments', autoLabelKey: 'delegation.action.autoEvade',
      manualCommand: 'manual-evasion', manualStation: 'instruments', manualLabelKey: 'delegation.action.manualEvasion',
      infoCommand: 'radio-report', infoStation: 'sensors', infoLabelKey: 'delegation.action.radioInfo',
    };
  }
  if (flags.hasTarget && weapons.torpedoes > 0 && (weapons.quality >= weapons.minimum || weapons.canFire || periscopeOpen)) {
    return {
      id: weapons.canFire && periscopeOpen ? 'attack-ready' : 'attack-setup', tone: 'attack', station: 'weapons', officerKey: 'delegation.officer.weapons',
      titleKey: weapons.canFire && periscopeOpen ? 'delegation.title.attackReady' : 'delegation.title.target',
      questionKey: weapons.canFire && periscopeOpen ? 'delegation.question.attackReady' : 'delegation.question.target',
      autoCommand: 'auto-attack', autoStation: 'weapons', autoLabelKey: weapons.canFire && periscopeOpen ? 'delegation.action.autoFire' : 'delegation.action.autoAttack',
      manualCommand: 'manual-attack', manualStation: 'weapons', manualLabelKey: 'delegation.action.manualAttack',
      infoCommand: 'radio-report', infoStation: 'sensors', infoLabelKey: 'delegation.action.radioInfo',
    };
  }
  if (flags.hasEscort) {
    return {
      id: 'escort-danger', tone: 'danger', station: 'sensors', officerKey: 'delegation.officer.sonar',
      titleKey: 'delegation.title.escort', questionKey: 'delegation.question.escort',
      autoCommand: 'prepare-silent-approach', autoStation: 'sensors', autoLabelKey: 'delegation.action.autoSilent',
      manualCommand: 'manual-sensors', manualStation: 'sensors', manualLabelKey: 'delegation.action.manualSensors',
      infoCommand: 'radio-report', infoStation: 'sensors', infoLabelKey: 'delegation.action.radioInfo',
    };
  }
  if (flags.hasTarget) {
    return {
      id: 'contact', tone: 'watch', station: 'sensors', officerKey: 'delegation.officer.radio',
      titleKey: 'delegation.title.contact', questionKey: 'delegation.question.contact',
      autoCommand: 'hold-shadow', autoStation: 'sensors', autoLabelKey: 'delegation.action.autoShadow',
      manualCommand: 'manual-sensors', manualStation: 'sensors', manualLabelKey: 'delegation.action.manualSensors',
      infoCommand: 'radio-report', infoStation: 'sensors', infoLabelKey: 'delegation.action.radioInfo',
    };
  }
  if (hasAutoRouteNeeded(snapshot)) {
    return {
      id: 'route', tone: 'calm', station: 'navigation', officerKey: 'delegation.officer.navigation',
      titleKey: 'delegation.title.route', questionKey: 'delegation.question.route',
      autoCommand: 'auto-route', autoStation: 'navigation', autoLabelKey: 'delegation.action.autoRoute',
      manualCommand: 'manual-route', manualStation: 'navigation', manualLabelKey: 'delegation.action.manualRoute',
      infoCommand: 'radio-report', infoStation: 'sensors', infoLabelKey: 'delegation.action.radioInfo',
    };
  }
  return {
    id: 'patrol', tone: 'calm', station: 'navigation', officerKey: 'delegation.officer.subofficer',
    titleKey: 'delegation.title.patrol', questionKey: 'delegation.question.patrol',
    autoCommand: 'plan-patrol', autoStation: 'navigation', autoLabelKey: 'delegation.action.autoRoute',
    manualCommand: 'manual-route', manualStation: 'navigation', manualLabelKey: 'delegation.action.manualRoute',
    infoCommand: 'radio-report', infoStation: 'sensors', infoLabelKey: 'delegation.action.radioInfo',
  };
}

function stationAsset(station = 'command', nation = 'de') {
  if (station === 'damage') return 'assets/avatars/de/mechanic_01.png';
  if (station === 'sensors') return 'assets/avatars/de/sonar_01.png';
  if (station === 'weapons') return 'assets/avatars/de/officer_01.png';
  if (nation && nation !== 'de') return `assets/avatars/${nation}/sailor_01.png`;
  return 'assets/avatars/de/officer_01.png';
}

export function buildCaptainDelegationAdvisorView({ snapshot = {}, commandMode = 'captain', nation = 'de' } = {}) {
  const radio = buildDelegationRadioReport(snapshot);
  const current = scenario({ snapshot, commandMode, radio });
  return {
    phase: PHASE52_CAPTAIN_DELEGATION_ADVISOR.phase,
    system: PHASE52_CAPTAIN_DELEGATION_ADVISOR.system,
    version: PHASE52_CAPTAIN_DELEGATION_ADVISOR.version,
    scenario: current.id,
    tone: current.tone,
    station: current.station,
    officerKey: current.officerKey,
    officerAsset: stationAsset(current.station, nation),
    icon: current.station === 'weapons' ? 'assets/ui/instruments/torpedo_icon.png' : current.station === 'navigation' ? 'assets/ui/instruments/helm_icon.png' : current.station === 'damage' ? 'assets/ui/instruments/speed_telegraph_icon.png' : 'assets/ui/instruments/sonar_icon.png',
    titleKey: current.titleKey,
    questionKey: current.questionKey,
    autoCommand: current.autoCommand,
    autoStation: current.autoStation,
    autoLabelKey: current.autoLabelKey,
    manualCommand: current.manualCommand,
    manualStation: current.manualStation,
    manualLabelKey: current.manualLabelKey,
    infoCommand: current.infoCommand,
    infoStation: current.infoStation,
    infoLabelKey: current.infoLabelKey,
    radio,
    mode: commandMode === 'manual' ? 'manual' : 'captain',
    mobileFullscreen: PHASE52_CAPTAIN_DELEGATION_ADVISOR.mobileFullscreen,
    preserveAssets: PHASE52_CAPTAIN_DELEGATION_ADVISOR.preservesExistingAssetsAndAudio,
    saveSchemaStable: PHASE52_CAPTAIN_DELEGATION_ADVISOR.saveSchemaStable,
  };
}
