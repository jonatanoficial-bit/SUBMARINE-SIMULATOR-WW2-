# Release Notes — v2.0.0-alpha.34

## Phase 19 — Strategic Chain Outcomes

This release adds strategic outcomes for completed special-operation chains. Germany, United Kingdom and United States now each have a set of irreversible national campaign outcomes that can be chosen after completing the required chain.

### Highlights

- 9 strategic outcomes total, 3 for each national campaign.
- Mutual-exclusion logic: one selected outcome per nation.
- Persistent cost, effect and history tracking.
- Campaign and Strategic Command panels for outcome review and execution.
- Integration with theater metrics: intelligence, decryption, ASW risk, pressure, readiness, tonnage, morale and fatigue.
- Dossier/logbook export support.
- PT-BR, EN and ES translation parity.
- PWA cache and visible build metadata updated.

### Validation

- `npm test` — 202/202 PASS
- `npm run audit` — 199 checks PASS
- `npm run smoke` — 56/56 PASS
- `python3 tests/campaigns_smoke.py` — 16/16 PASS
