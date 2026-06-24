# Rollback — Fase 36

Para reverter a Fase 36:
1. Remover `js/systems/cinematicInterface.js`.
2. Remover `css/phase36-cinematic-interface.css`.
3. Reverter alterações em `js/screens/gameplay.js`.
4. Restaurar `BUILD_INFO.json`, `js/build.js`, `manifest.json`, `service-worker.js`, `package.json` e traduções da Fase 35.
5. Reempacotar como `v2.0.0-alpha.50`.
