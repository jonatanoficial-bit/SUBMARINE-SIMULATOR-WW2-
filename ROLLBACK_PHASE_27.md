# Rollback — Fase 27

Para reverter a Fase 27:

1. Remover `js/systems/alertAtmosphere.js`.
2. Remover `css/phase27-alert-atmosphere.css`.
3. Remover import e chamadas `buildAlertAtmosphereView`, `shouldAlertEscalate` e `updateAlertAtmosphere` de `js/screens/gameplay.js`.
4. Remover o painel `phase27-alert-atmosphere` do gameplay.
5. Remover entradas do service worker, index, package e smoke test.
6. Retornar BUILD_INFO para v2.0.0-alpha.41 / fase 26 / save schema 20.
