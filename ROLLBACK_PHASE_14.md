# Rollback — Fase 14

Para retornar à Fase 13, remover ou reverter:

- `js/screens/bridge.js`
- `css/phase14-bridge-instruments.css`
- Entradas `bridge` em `js/app.js`, `js/components/ui.js`, `js/screens/lobby.js`
- Link da Fase 14 em `index.html`
- Chaves `bridge.*` e `nav.bridge` dos arquivos de tradução
- `tests/bridge_instruments.test.js`
- `tools/audit_phase14.py`

Também restaurar `BUILD_INFO.json`, `js/build.js`, `package.json` e `service-worker.js` para v2.0.0-alpha.13.
