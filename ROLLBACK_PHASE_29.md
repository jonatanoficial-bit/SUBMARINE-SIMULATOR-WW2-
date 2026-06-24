# Rollback — Fase 29

Para reverter a Fase 29:

1. Remover `js/systems/tacticalNavalChart.js`.
2. Remover `css/phase29-tactical-naval-chart.css`.
3. Remover integrações da carta tática em `js/screens/gameplay.js`.
4. Restaurar `BUILD_INFO.json`, `js/build.js`, `manifest.json`, `package.json`, `index.html` e `service-worker.js` para a build `v2.0.0-alpha.43`.
5. Remover `tests/phase29_tactical_naval_chart.test.js` e `tools/audit_phase29_tactical_naval_chart.py`.

Rollback recomendado: restaurar o ZIP completo da Fase 28.
