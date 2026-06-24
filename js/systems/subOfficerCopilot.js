const phase26Clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export const PHASE26_SUBOFFICER = Object.freeze({
  phase: 26,
  operation: 'Silent Depth',
  role: 'subofficer-copilot',
  avatar: 'assets/avatars/subofficer_ww2.svg',
  typewriter: true,
  mobileFirst: true,
  confirmButton: 'OK / RECEBIDO'
});

export function classifySubOfficerSituation({ snapshot = {}, station = 'command' } = {}) {
  const physics = snapshot.physics || {};
  const sensors = snapshot.sensors || {};
  const ai = snapshot.navalAI || {};
  const weapons = snapshot.weapons || {};
  const damage = snapshot.damage || {};
  const contact = sensors.contacts?.target || sensors.strongestContact || {};
  const escort = sensors.contacts?.escort || {};
  const aircraft = ai.aircraft || {};
  const speedKnots = Number(physics.actualSpeedKnots ?? snapshot.speedKnots ?? 0);
  const detection = phase26Clamp(snapshot.detectionScore ?? contact.confidence ?? 0, 0, 100);
  const hull = phase26Clamp(snapshot.hull ?? 100, 0, 100);
  const pressure = phase26Clamp(physics.pressurePercent ?? snapshot.pressure ?? 0, 0, 120);
  const depth = Number(physics.depth ?? snapshot.depth ?? 0);
  const damageCritical = Number(damage.criticalCount || 0);
  const targetVisible = Boolean(contact.detected) || Boolean(snapshot.periscopeOpen && !snapshot.targetDestroyed && Number(weapons.tdc?.solutionQuality || 0) > 18);
  const escortThreat = snapshot.escortState === 'hunt' || snapshot.escortState === 'alert' || Number(escort.confidence || 0) >= 58;

  if (snapshot.missionFailed || hull <= 0) return { id: 'mission-lost', tone: 'critical', priority: 10, titleKey: 'subofficer.title.damage', textKey: 'subofficer.msg.missionLost', stationHint: 'damage' };
  if (aircraft.active || aircraft.state === 'attack' || aircraft.state === 'tracking') return { id: 'aircraft-inbound', tone: 'critical', priority: 9, titleKey: 'subofficer.title.air', textKey: 'subofficer.msg.aircraft', stationHint: 'command' };
  if (snapshot.damageFlashTicks > 0 || hull < 45 || damageCritical > 0) return { id: 'damage-critical', tone: 'critical', priority: 8, titleKey: 'subofficer.title.damage', textKey: 'subofficer.msg.damage', stationHint: 'damage' };
  if (snapshot.depth > 220 || pressure > 86 || physics.depthZone === 'collapse' || physics.depthZone === 'overdepth') return { id: 'deep-pressure', tone: 'critical', priority: 8, titleKey: 'subofficer.title.depth', textKey: 'subofficer.msg.deepPressure', stationHint: 'command' };
  if (escortThreat) return { id: 'enemy-hunt', tone: 'danger', priority: 7, titleKey: 'subofficer.title.contact', textKey: 'subofficer.msg.enemyDetected', stationHint: 'sensors' };
  if (targetVisible && Number(weapons.tdc?.solutionQuality || 0) >= 70 && weapons.canFire) return { id: 'fire-solution', tone: 'attack', priority: 6, titleKey: 'subofficer.title.attack', textKey: 'subofficer.msg.fireSolution', stationHint: 'weapons' };
  if (targetVisible) return { id: 'visual-contact', tone: 'watch', priority: 5, titleKey: 'subofficer.title.contact', textKey: 'subofficer.msg.visualContact', stationHint: 'periscope' };
  if (snapshot.periscopeOpen) return { id: 'periscope-watch', tone: 'watch', priority: 4, titleKey: 'subofficer.title.periscope', textKey: 'subofficer.msg.periscopeWatch', stationHint: 'periscope' };
  if (speedKnots < 0.4 && depth < 30 && station === 'command') return { id: 'standing-by', tone: 'calm', priority: 3, titleKey: 'subofficer.title.standby', textKey: 'subofficer.msg.standby', stationHint: 'navigation' };
  if (snapshot.canComplete || snapshot.targetDestroyed) return { id: 'mission-success', tone: 'success', priority: 6, titleKey: 'subofficer.title.success', textKey: 'subofficer.msg.success', stationHint: 'command' };
  if (depth >= 80 && speedKnots < 4) return { id: 'silent-patrol', tone: 'calm', priority: 2, titleKey: 'subofficer.title.silent', textKey: 'subofficer.msg.silentPatrol', stationHint: 'sensors' };
  return { id: 'patrol-steady', tone: 'calm', priority: 1, titleKey: 'subofficer.title.standby', textKey: 'subofficer.msg.patrolSteady', stationHint: 'command' };
}

export function buildSubOfficerDialogue({ snapshot = {}, station = 'command', commanderName = '' } = {}) {
  const situation = classifySubOfficerSituation({ snapshot, station });
  const watch = Number(snapshot.worldTime || snapshot.elapsedMs || 0);
  const watchGroup = Math.floor(watch / 9000);
  return {
    ...situation,
    commanderName: commanderName || 'Commander',
    key: `${situation.id}:${watchGroup}`,
    mustInterrupt: situation.priority >= 7,
    shouldAutoOpen: situation.priority >= 5 || ['standing-by', 'mission-success'].includes(situation.id),
    typewriterMs: situation.priority >= 7 ? 12 : situation.priority >= 5 ? 16 : 20,
    ackLabelKey: situation.priority >= 7 ? 'subofficer.ackEmergency' : 'subofficer.ack'
  };
}

export function shouldSubOfficerInterrupt({ current = null, next = null, acknowledged = [] } = {}) {
  if (!next) return false;
  if (next.mustInterrupt) return true;
  if (acknowledged.includes(next.key) || acknowledged.includes(next.id)) return false;
  if (!current) return Boolean(next.shouldAutoOpen);
  if (next.id !== current.id && next.priority >= current.priority) return true;
  return false;
}

export function renderSubOfficerLine({ text = '', maxChars = 220 } = {}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}
