# Fase 12 — Doutrinas nacionais de campanha

**Build:** v2.0.0-alpha.27  
**Data:** 2026-06-22 15:48 BRT  
**Base preservada:** v2.0.0-alpha.26 F11 campanhas independentes + sistemas posteriores até comboios/escoltas IA.

## Entrega

A fase adiciona personalidade mecânica para cada campanha independente:

- **Alemanha / Kriegsmarine:** doutrina Rudeltaktik, furtividade, intercepção e tonelagem com risco maior.
- **Reino Unido / Royal Navy:** doutrina de defesa/inteligência, mais prontidão e menor pressão operacional.
- **Estados Unidos / US Navy:** doutrina de longo alcance no Pacífico, logística forte, radar e torpedos.

## Arquivos principais alterados

- `data/campaign_doctrines.json`
- `js/systems/campaignDoctrine.js`
- `js/app.js`
- `js/screens/campaign.js`
- `css/phase12-campaign-doctrines.css`
- `data/translations/pt-BR.json`
- `data/translations/en.json`
- `data/translations/es.json`
- `service-worker.js`
- `BUILD_INFO.json`, `manifest.json`, `package.json`, `js/build.js`

## Auditoria executada

- `npm test` — 168/168 PASS
- `npm run audit` — 20/20 PASS
- `npm run smoke` — 56/56 PASS
- `python3 tests/campaigns_smoke.py` — 16/16 PASS

## Observação

O save schema permanece em `6`, pois a Fase 12 não exige migração destrutiva de saves. As doutrinas são aplicadas por dados da campanha e pelo planejamento atual.
