export class Entity {
  constructor({ id, type = 'entity', x = 0, y = 0, active = true, metadata = {} } = {}) {
    if (!id) throw new Error('Entity id is required');
    this.id = id;
    this.type = type;
    this.position = { x: Number(x) || 0, y: Number(y) || 0 };
    this.velocity = { x: 0, y: 0 };
    this.active = Boolean(active);
    this.metadata = { ...metadata };
  }

  moveTo(x, y) {
    this.position.x = Number(x) || 0;
    this.position.y = Number(y) || 0;
    return this;
  }

  translate(dx = 0, dy = 0) {
    this.position.x += Number(dx) || 0;
    this.position.y += Number(dy) || 0;
    return this;
  }

  distanceTo(other) {
    const otherPosition = other?.position || other || { x: 0, y: 0 };
    return Math.hypot(this.position.x - otherPosition.x, this.position.y - otherPosition.y);
  }

  snapshot() {
    return {
      id: this.id,
      type: this.type,
      x: this.position.x,
      y: this.position.y,
      active: this.active,
      metadata: { ...this.metadata },
    };
  }
}
