# Simulation Engine Architecture — Phase 3

The browser game now uses a layered, deterministic simulation core:

1. **Scene layer** — `SceneManager` owns screen lifecycle and prevents gameplay timers/listeners from leaking between screens.
2. **Interface layer** — files in `js/screens/` render HTML and translate player input into engine commands.
3. **Simulation layer** — `SimulationEngine` owns mission rules, combat state, detection, repairs and mission scoring.
4. **Entity layer** — player submarine, target and escort are independent entities with stable IDs and snapshots.
5. **Event layer** — `EventBus` decouples simulation outcomes from sound, animation, save updates and UI.
6. **Clock layer** — `SimulationClock` uses a fixed 80 ms step with a capped accumulator, making calculations deterministic and resistant to slow frames.
7. **Calculation layer** — pure functions contain clamping, instrument angles, periscope projection, target lock and scoring.

## Rules

- Screens may not own world rules.
- Engine modules may not query the DOM.
- Entity state must be serializable through snapshots.
- Every event subscription must return an unsubscribe function.
- Every active clock must be stopped during scene exit.
- New navigation, physics and AI systems must be introduced as engine systems rather than added directly to screen files.
