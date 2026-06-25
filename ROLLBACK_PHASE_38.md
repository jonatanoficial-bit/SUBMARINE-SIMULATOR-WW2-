# Rollback — Fase 38

Para reverter a Fase 38:
1. Remover `js/systems/cinematicBriefing.js`.
2. Remover `css/phase38-cinematic-briefing.css`.
3. Reverter alterações em `js/screens/briefing.js`.
4. Restaurar `BUILD_INFO.json`, `js/build.js`, `manifest.json`, `service-worker.js`, `package.json` e traduções da Fase 37.
5. Reempacotar como v2.0.0-alpha.52.
