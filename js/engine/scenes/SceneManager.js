export class SceneManager {
  constructor() {
    this.scenes = new Map();
    this.activeSceneName = null;
    this.activeContext = null;
  }

  register(name, definition) {
    if (!name || typeof definition?.render !== 'function') throw new Error(`Invalid scene: ${name}`);
    this.scenes.set(name, { enter: null, exit: null, ...definition });
    return this;
  }

  has(name) {
    return this.scenes.has(name);
  }

  render(name, context) {
    if (!this.has(name)) throw new Error(`Scene not registered: ${name}`);
    this.exitActive();
    this.activeSceneName = name;
    this.activeContext = context;
    return this.scenes.get(name).render(context);
  }

  enterActive(context = this.activeContext) {
    const scene = this.scenes.get(this.activeSceneName);
    if (scene?.enter) scene.enter(context);
  }

  exitActive() {
    const scene = this.scenes.get(this.activeSceneName);
    if (scene?.exit) scene.exit(this.activeContext);
    this.activeSceneName = null;
    this.activeContext = null;
  }

  diagnostics() {
    return {
      registeredScenes: [...this.scenes.keys()],
      activeScene: this.activeSceneName,
    };
  }
}
