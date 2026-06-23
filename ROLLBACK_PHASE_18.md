# Rollback Plan — Phase 18

To rollback Phase 18, restore the previous alpha.32 build and remove these additions:

- `data/operation_chains.json`
- `js/systems/operationChains.js`
- `css/phase18-operation-chains.css`
- Phase 18 imports and render calls in `js/app.js`, `js/screens/campaign.js`, `js/screens/strategy.js`
- `operationChains` save state migration in `js/save.js`
- Phase 18 data loader entry and validation rules
- Phase 18 tests and audit tool

Recommended rollback target: `v2.0.0-alpha.32-F17-OPERACOES-ESPECIAIS-CAMPANHA`.
