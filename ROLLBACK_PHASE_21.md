# Rollback — Phase 21 — Patentes e Carreira Naval

Para reverter a Fase 21 manualmente:

1. Restaurar `BUILD_INFO.json`, `js/build.js`, `package.json`, `index.html` e `service-worker.js` para a build v2.0.0-alpha.35.
2. Remover `data/command_advancement.json`.
3. Remover `js/systems/commandAdvancement.js`.
4. Remover `css/phase21-command-advancement.css` e sua referência em `index.html`/cache.
5. Reverter alterações em `js/app.js`, `js/dataLoader.js`, `js/save.js`, `js/screens/campaign.js` e `js/screens/strategy.js` relacionadas a `commandAdvancement`.
6. Remover `tests/phase21_command_advancement.test.js` e `tools/audit_phase21_command_advancement.py`.
7. Restaurar save schema 14 somente se a build anterior for exigida.

Rollback recomendado: usar o ZIP da Fase 20 v2.0.0-alpha.35 como fonte íntegra.
