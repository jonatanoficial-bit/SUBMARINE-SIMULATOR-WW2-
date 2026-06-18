import { Entity } from './Entity.js';
import { clamp } from '../simulation/simulationMath.js';

export class SubmarineEntity extends Entity {
  constructor({ id = 'player-submarine', depth = 12, speed = 'slow', hull = 100, systems = {}, resources = {}, metadata = {} } = {}) {
    super({ id, type: 'submarine', x: 0, y: 0, metadata });
    this.depth = clamp(depth, 0, 300);
    this.speed = speed;
    this.hull = clamp(hull, 0, 100);
    this.systems = { engines: 100, sonar: 100, periscope: 100, weapons: 100, ...systems };
    this.resources = { torpedoes: 4, decoys: 2, ...resources };
  }

  setDepth(depth, maxDepth = 300) {
    this.depth = clamp(depth, 0, maxDepth);
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  applyDamage(amount, systemKey) {
    const hullDamage = Math.max(1, Math.round(amount));
    this.hull = clamp(this.hull - hullDamage, 0, 100);
    if (systemKey) this.systems[systemKey] = clamp((this.systems[systemKey] ?? 100) - Math.max(2, Math.round(amount * 0.72)), 0, 100);
    return hullDamage;
  }

  snapshot() {
    return {
      ...super.snapshot(),
      depth: this.depth,
      speed: this.speed,
      hull: this.hull,
      systems: { ...this.systems },
      resources: { ...this.resources },
    };
  }
}
