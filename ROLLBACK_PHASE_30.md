# ROLLBACK — PHASE 30

Para reverter a Fase 30:

1. Remover `js/systems/waypointNavigation.js`.
2. Remover `css/phase30-waypoint-navigation.css`.
3. Remover integrações de `buildWaypointNavigationView` em `js/screens/gameplay.js`.
4. Reverter `NavigationSystem` para `navigationVersion: 1` e remover `planPatrolSectorRoute`/`replaceRoute`.
5. Reverter `SimulationEngine.planPatrolSectorRoute`.
6. Restaurar build `v2.0.0-alpha.44`.
