# Rollback — Fase 50

Para reverter a Fase 50, remover:

- `js/systems/captainCombatCycle.js`
- `css/phase50-captain-combat-cycle.css`
- `tests/phase50_captain_combat_cycle.test.js`
- `tools/audit_phase50_captain_combat_cycle.py`
- bloco `phase50-combat-cycle` de `js/screens/gameplay.js`
- entradas phase50 no `index.html`, `service-worker.js`, `tests/smoke_test.py` e traduções.

Restaurar versão anterior: v2.0.0-alpha.64 — Fase 49.
Save schema permanece 40.
