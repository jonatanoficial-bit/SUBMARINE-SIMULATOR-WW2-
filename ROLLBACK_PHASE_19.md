# Rollback Phase 19 — Strategic Chain Outcomes

Rollback target: `v2.0.0-alpha.33` / Phase 18 — Special Operation Chains.

## Files added in Phase 19

- `data/operation_outcomes.json`
- `js/systems/operationOutcomes.js`
- `css/phase19-operation-outcomes.css`
- `tests/phase19_operation_outcomes.test.js`
- `tools/audit_phase19_operation_outcomes.py`
- `RELEASE_NOTES_v2.0.0-alpha.34.md`

## Files modified in Phase 19

- `BUILD_INFO.json`
- `package.json`
- `manifest.json`
- `service-worker.js`
- `index.html`
- `js/dataLoader.js`
- `js/save.js`
- `js/app.js`
- `js/screens/campaign.js`
- `js/screens/strategy.js`
- `locales/pt-BR.json`
- `locales/en.json`
- `locales/es.json`
- `tests/smoke_test.py`
- phase documentation and changelog files

## Rollback procedure

1. Restore the Phase 18 build folder or checkout the previous commit.
2. Remove Phase 19 files listed above.
3. Revert modified files to their Phase 18 versions.
4. Re-run `npm test`, `npm run audit`, `npm run smoke` and `python3 tests/campaigns_smoke.py`.
