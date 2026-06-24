# Rollback — Fase 33

Para reverter a Fase 33:
1. Remover `js/systems/navalAITacticalCoordinator.js`.
2. Remover `css/phase33-naval-ai-tactics.css`.
3. Reverter alterações em `js/engine/ai/NavalAISystem.js` e `js/screens/gameplay.js`.
4. Restaurar `BUILD_INFO.json`, `js/build.js`, `manifest.json`, `service-worker.js`, `package.json` e traduções da Fase 32.
5. Reempacotar como v2.0.0-alpha.47.
