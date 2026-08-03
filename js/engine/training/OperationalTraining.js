const STEP_IDS = Object.freeze(['contact', 'sonar', 'approach', 'solution', 'attack', 'evade']);

const STATION_BY_STEP = Object.freeze({
  contact: 'sensors',
  sonar: 'sensors',
  approach: 'instruments',
  solution: 'weapons',
  attack: 'weapons',
  evade: 'instruments',
});

const APPROACH_SPEEDS = new Set(['slow', 'half']);
const EVASION_SPEEDS = new Set(['stop', 'slow']);

function targetContact(snapshot = {}) {
  return snapshot.sensors?.contacts?.target || null;
}

export class OperationalTraining {
  constructor({ enabled = true, guided = false } = {}) {
    this.enabled = enabled !== false;
    this.guided = Boolean(guided);
    this.completed = new Set();
    this.visitedStations = new Set();
    this.dismissed = false;
    this.startedAt = 0;
  }

  reset() {
    this.completed.clear();
    this.visitedStations.clear();
    this.dismissed = false;
    this.startedAt = 0;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    if (this.enabled) this.dismissed = false;
  }

  visitStation(station) {
    if (station) this.visitedStations.add(station);
  }

  dismiss() {
    if (!this.guided) this.dismissed = true;
  }

  update(snapshot = {}) {
    if (!this.enabled) return this.snapshot(snapshot);
    const elapsedMs = Number(snapshot.elapsedMs || 0);
    if (!this.startedAt && elapsedMs > 0) this.startedAt = elapsedMs;
    if (snapshot.activeStation) this.visitStation(snapshot.activeStation);

    const contact = targetContact(snapshot);
    const contactDetected = Boolean(contact?.detected);
    const contactConfidence = Number(contact?.confidence || 0);
    const contactSource = String(contact?.source || 'none');
    const targetRange = Number(contact?.rangeMeters);
    const speed = String(snapshot.speed || 'stop');
    const shots = Number(snapshot.metrics?.shots || 0);
    const solution = Number(snapshot.weapons?.tdc?.solutionQuality || 0);

    // A guided lesson advances in strict order so later simulation events cannot
    // silently skip the procedure the player is expected to learn.
    if (this.currentStep() === 'contact' && this.visitedStations.has('sensors')) this.completed.add('contact');
    if (this.currentStep() === 'sonar' && snapshot.activeStation === 'sensors'
      && contactDetected && contactConfidence >= 20 && contactSource !== 'none') this.completed.add('sonar');
    if (this.currentStep() === 'approach' && snapshot.activeStation === 'instruments'
      && contactDetected && APPROACH_SPEEDS.has(speed)
      && (!Number.isFinite(targetRange) || targetRange <= 1900)) this.completed.add('approach');
    if (this.currentStep() === 'solution' && snapshot.activeStation === 'weapons' && solution >= 42) this.completed.add('solution');
    if (this.currentStep() === 'attack' && snapshot.activeStation === 'weapons' && shots > 0) this.completed.add('attack');
    if (this.currentStep() === 'evade' && snapshot.activeStation === 'instruments'
      && shots > 0 && Number(snapshot.depth || 0) >= 55
      && EVASION_SPEEDS.has(speed)) this.completed.add('evade');

    return this.snapshot(snapshot);
  }

  currentStep() {
    return STEP_IDS.find((id) => !this.completed.has(id)) || 'evade';
  }

  recommendedStation() {
    return STATION_BY_STEP[this.currentStep()] || 'command';
  }

  snapshot(snapshot = {}) {
    const current = this.currentStep();
    const finished = this.completed.size === STEP_IDS.length;
    return {
      enabled: this.enabled,
      guided: this.guided,
      dismissed: this.dismissed,
      stepIds: [...STEP_IDS],
      completed: [...this.completed],
      currentStep: current,
      recommendedStation: STATION_BY_STEP[current] || 'command',
      instructionKey: finished ? 'training.guideComplete' : `training.instruction.${current}`,
      progress: Math.round((this.completed.size / STEP_IDS.length) * 100),
      finished,
      dangerStation: this.recommendDangerStation(snapshot),
    };
  }

  recommendDangerStation(snapshot = {}) {
    if (snapshot.damageControl?.criticalCompartments > 0 || snapshot.damageControl?.totalFlooding >= 28 || snapshot.damageControl?.totalFire >= 20) return 'damage';
    if (snapshot.escortState === 'hunt' || Number(snapshot.detectionScore || 0) >= 58) return 'ai';
    return null;
  }
}

export const TRAINING_STEP_IDS = STEP_IDS;
