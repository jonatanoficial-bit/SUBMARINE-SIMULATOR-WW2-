export class SimulationClock {
  constructor({ fixedStepMs = 80, maxFrameMs = 250, maxSubSteps = 5, onStep = () => {}, onRender = () => {} } = {}) {
    this.fixedStepMs = fixedStepMs;
    this.maxFrameMs = maxFrameMs;
    this.maxSubSteps = maxSubSteps;
    this.onStep = onStep;
    this.onRender = onRender;
    this.running = false;
    this.paused = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.frameHandle = null;
    this.elapsedMs = 0;
    this.tickCount = 0;
    this.boundFrame = (time) => this.frame(time);
  }

  now() {
    return globalThis.performance?.now?.() ?? Date.now();
  }

  schedule() {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      this.frameHandle = globalThis.requestAnimationFrame(this.boundFrame);
    } else {
      this.frameHandle = globalThis.setTimeout(() => this.boundFrame(this.now()), this.fixedStepMs);
    }
  }

  cancel() {
    if (this.frameHandle === null) return;
    if (typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(this.frameHandle);
    else globalThis.clearTimeout(this.frameHandle);
    this.frameHandle = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.accumulator = 0;
    this.lastTime = this.now();
    this.schedule();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.cancel();
    this.accumulator = 0;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (!this.running) return this.start();
    this.paused = false;
    this.lastTime = this.now();
  }

  stepOnce() {
    this.onStep(this.fixedStepMs);
    this.elapsedMs += this.fixedStepMs;
    this.tickCount += 1;
    this.onRender(0);
  }

  frame(time) {
    if (!this.running) return;
    if (this.paused) {
      this.lastTime = time;
      this.schedule();
      return;
    }

    const frameDelta = Math.min(Math.max(0, time - this.lastTime), this.maxFrameMs);
    this.lastTime = time;
    this.accumulator += frameDelta;
    let steps = 0;

    while (this.accumulator >= this.fixedStepMs && steps < this.maxSubSteps) {
      this.onStep(this.fixedStepMs);
      this.accumulator -= this.fixedStepMs;
      this.elapsedMs += this.fixedStepMs;
      this.tickCount += 1;
      steps += 1;
    }

    if (steps === this.maxSubSteps && this.accumulator >= this.fixedStepMs) this.accumulator = 0;
    this.onRender(this.accumulator / this.fixedStepMs);
    this.schedule();
  }

  diagnostics() {
    return {
      running: this.running,
      paused: this.paused,
      fixedStepMs: this.fixedStepMs,
      tickCount: this.tickCount,
      elapsedMs: this.elapsedMs,
    };
  }
}
