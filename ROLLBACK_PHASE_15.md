# Rollback — Fase 15

Para reverter a Fase 15:

1. Restaurar a build v2.0.0-alpha.29 F14.
2. Remover `data/high_command_orders.json`.
3. Remover `js/systems/highCommandOrders.js`.
4. Remover `css/phase15-high-command-orders.css`.
5. Reverter alterações em `js/app.js`, `js/dataLoader.js`, `js/save.js`, `js/screens/strategy.js`, `index.html`, `service-worker.js`, `manifest.json`, `BUILD_INFO.json` e `package.json`.
6. O save schema voltaria para 8; saves gerados na Fase 15 devem ser migrados com cuidado se o rollback for aplicado após testes reais.
