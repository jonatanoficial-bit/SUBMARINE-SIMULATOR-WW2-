const STEP_IDS = Object.freeze([
  'orientation', 'propulsion', 'depth', 'contact', 'periscope', 'solution', 'attack', 'evade', 'safe'
]);

const STATION_BY_STEP = Object.freeze({
  orientation: 'command', propulsion: 'instruments', depth: 'instruments', contact: 'sensors',
  periscope: 'command', solution: 'weapons', attack: 'weapons', evade: 'command', safe: 'command',
});

export class OperationalTraining {
  constructor({ enabled = true } = {}) {
    this.enabled = enabled !== false;
    this.completed = new Set();
    this.seenPeriscope = false;
    this.dismissed = false;
    this.startedAt = 0;
  }

  reset() {
    this.completed.clear();
    this.seenPeriscope = false;
    this.dismissed = false;
    this.startedAt = 0;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    if (this.enabled) this.dismissed = false;
  }

  dismiss() { this.dismissed = true; }

  update(snapshot = {}) {
    if (!this.enabled) return this.snapshot(snapshot);
    const elapsedMs = Number(snapshot.elapsedMs || 0);
    if (!this.startedAt && elapsedMs > 0) this.startedAt = elapsedMs;
    if (elapsedMs >= 600) this.completed.add('orientation');
    if (snapshot.speed && snapshot.speed !== 'stop') this.completed.add('propulsion');
    if (Number(snapshot.depth || 0) >= 18 || Number(snapshot.physics?.orderedDepth || 0) >= 18) this.completed.add('depth');
    const contactCount = Number(snapshot.sensors?.contactsDetected || snapshot.sensors?.visibleContacts?.length || 0);
    if (contactCount > 0 || snapshot.sensors?.contacts?.target?.detected || snapshot.sensors?.contacts?.escort?.detected) this.completed.add('contact');
    if (snapshot.periscopeOpen) this.seenPeriscope = true;
    if (this.seenPeriscope) this.completed.add('periscope');
    if (Number(snapshot.weapons?.tdc?.solutionQuality || 0) >= 42) this.completed.add('solution');
    if (Number(snapshot.metrics?.shots || 0) > 0) this.completed.add('attack');
    const phase = snapshot.encounter?.phase || '';
    if (['evade', 'lostContact', 'disengage', 'safe'].includes(phase) || ['evade', 'disengage'].includes(snapshot.encounter?.doctrine)) this.completed.add('evade');
    if (snapshot.canComplete || snapshot.encounter?.completionAuthorized) this.completed.add('safe');
    return this.snapshot(snapshot);
  }

  currentStep() {
    return STEP_IDS.find((id) => !this.completed.has(id)) || 'safe';
  }

  recommendedStation() { return STATION_BY_STEP[this.currentStep()] || 'command'; }

  snapshot(snapshot = {}) {
    const current = this.currentStep();
    return {
      enabled: this.enabled,
      dismissed: this.dismissed,
      stepIds: [...STEP_IDS],
      completed: [...this.completed],
      currentStep: current,
      recommendedStation: STATION_BY_STEP[current] || 'command',
      progress: Math.round((this.completed.size / STEP_IDS.length) * 100),
      finished: this.completed.size === STEP_IDS.length,
      dangerStation: this.recommendDangerStation(snapshot),
    };
  }

  recommendDangerStation(snapshot = {}) {
    if (snapshot.damageControl?.criticalCompartments > 0 || snapshot.damageControl?.totalFlooding >= 28 || snapshot.damageControl?.totalFire >= 20) return 'damage';
    if (snapshot.escortState === 'hunt' || Number(snapshot.detectionScore || 0) >= 58) return 'ai';
    if (!snapshot.sensors?.contacts?.target?.detected) return 'sensors';
    if (Number(snapshot.weapons?.tdc?.solutionQuality || 0) < 42 && snapshot.sensors?.contacts?.target?.detected) return 'weapons';
    return STATION_BY_STEP[this.currentStep()] || 'command';
  }
}

export const TRAINING_STEP_IDS = STEP_IDS;
