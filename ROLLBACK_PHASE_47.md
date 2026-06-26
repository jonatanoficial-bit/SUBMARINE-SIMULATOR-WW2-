# Rollback — Fase 47

Para voltar à Fase 46:

1. Remover de `index.html` o CSS `css/phase47-captain-crew-realism.css`.
2. Remover de `service-worker.js` os arquivos da Fase 47.
3. Remover de `js/screens/gameplay.js` a integração com `captainCrewRealism.js` e o painel `phase47-captain-flow-panel`.
4. Remover de `js/systems/subOfficerCopilot.js` a leitura de `captainCrewFlow`.
5. Remover `js/systems/captainCrewRealism.js`, `css/phase47-captain-crew-realism.css`, `tests/phase47_captain_crew_realism.test.js` e `tools/audit_phase47_captain_crew_realism.py`.
6. Restaurar `BUILD_INFO.json`, `js/build.js`, `package.json` e `manifest.json` para `v2.0.0-alpha.61`, fase 46.

Observação: a Fase 47 manteve o `saveSchemaVersion` em 40, então o rollback não exige migração de save.
