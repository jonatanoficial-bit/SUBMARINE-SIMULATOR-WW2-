export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, handler) {
    if (typeof handler !== 'function') throw new TypeError('Event handler must be a function');
    const handlers = this.listeners.get(eventName) || new Set();
    handlers.add(handler);
    this.listeners.set(eventName, handlers);
    return () => this.off(eventName, handler);
  }

  once(eventName, handler) {
    const unsubscribe = this.on(eventName, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off(eventName, handler) {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return;
    handlers.delete(handler);
    if (!handlers.size) this.listeners.delete(eventName);
  }

  emit(eventName, payload) {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return 0;
    let delivered = 0;
    [...handlers].forEach((handler) => {
      try {
        handler(payload);
        delivered += 1;
      } catch (error) {
        console.error(`[EventBus:${eventName}]`, error);
      }
    });
    return delivered;
  }

  listenerCount(eventName) {
    return this.listeners.get(eventName)?.size || 0;
  }

  clear(eventName = null) {
    if (eventName === null) this.listeners.clear();
    else this.listeners.delete(eventName);
  }
}
