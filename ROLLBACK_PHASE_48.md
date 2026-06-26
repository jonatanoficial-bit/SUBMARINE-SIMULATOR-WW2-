# Rollback — Fase 48

Para voltar à Fase 47:

1. Remover de `index.html` o CSS `css/phase48-captain-order-execution.css`.
2. Remover de `service-worker.js` os arquivos `css/phase48-captain-order-execution.css` e `js/systems/captainOrderExecution.js`.
3. Remover de `js/screens/gameplay.js` a integração com `captainOrderExecution.js`, o estado `captainExecutionState`, o painel `phase48-order-board` e as chamadas `registerCaptainExecution`/`updateCaptainExecutionBoard`.
4. Remover `js/systems/captainOrderExecution.js`, `css/phase48-captain-order-execution.css`, `tests/phase48_captain_order_execution.test.js` e `tools/audit_phase48_captain_order_execution.py`.
5. Restaurar `BUILD_INFO.json`, `js/build.js`, `package.json` e `manifest.json` para `v2.0.0-alpha.62`, fase 47.
6. Restaurar o smoke test para a versão da Fase 47 se desejar reproduzir exatamente a build anterior.

Observação: a Fase 48 manteve o `saveSchemaVersion` em 40, então o rollback não exige migração de save.
