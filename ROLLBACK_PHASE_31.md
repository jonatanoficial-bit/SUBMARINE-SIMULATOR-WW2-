# Rollback — Fase 31

Para reverter a Fase 31:

1. Remover `js/systems/visualHorizonContacts.js`.
2. Remover `css/phase31-visual-horizon-contacts.css`.
3. Remover import e chamadas `buildHorizonContactView` / `updateHorizonContacts` de `js/screens/gameplay.js`.
4. Remover CSS do `index.html`, `service-worker.js` e `tests/smoke_test.py`.
5. Restaurar build para `v2.0.0-alpha.45` se necessário.
