import { Entity } from './Entity.js';

export class ShipEntity extends Entity {
  constructor({ id, role = 'target', shipType = 'merchant', x = 0, y = 0, state = 'patrol', metadata = {} } = {}) {
    super({ id, type: 'ship', x, y, metadata });
    this.role = role;
    this.shipType = shipType;
    this.state = state;
    this.destroyed = false;
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.destroyed = true;
    this.active = false;
  }

  snapshot() {
    return {
      ...super.snapshot(),
      role: this.role,
      shipType: this.shipType,
      state: this.state,
      destroyed: this.destroyed,
    };
  }
}
