# Fase 11 — Campanhas Independentes Alemanha, Reino Unido e Estados Unidos

Build: `v2.0.0-alpha.26`  
Data: 2026-06-22 12:40 BRT  
Base preservada: build real enviada `v2.0.0-alpha.25-F25`.

## Entrega

- Alemanha, Reino Unido e Estados Unidos agora aparecem em um seletor visual único na tela de Campanha.
- Cada marinha mantém sua própria campanha de oito operações, progresso, linha do tempo e mapa de atos.
- O jogador pode visualizar campanhas de outras nações, mas não pode abrir briefing ou lançar missão com comandante de marinha diferente.
- A seleção de missão é filtrada pela nação visualizada, evitando vazamento de missão entre campanhas.
- Foram adicionadas traduções completas em PT-BR, EN e ES.
- Sistemas posteriores já existentes na base, incluindo carreira, logística, estratégia, ponte, periscópio, TDC, rolagem mobile, trilha sonora, prontidão, clima/oceano e comboios/escoltas, foram preservados.

## Auditoria executada

- `npm test`: 164/164 testes aprovados.
- `npm run audit`: 26/26 verificações aprovadas.
- `python3 tests/campaigns_smoke.py`: 16/16 verificações aprovadas em viewport mobile 360x640.

## Arquivos principais alterados

- `data/campaigns.json`
- `data/translations/pt-BR.json`
- `data/translations/en.json`
- `data/translations/es.json`
- `js/state.js`
- `js/app.js`
- `js/screens/campaign.js`
- `css/phase11-campaigns.css`
- `tests/campaigns.test.js`
- `tools/audit_phase11_tri_campaigns.py`
- `BUILD_INFO.json`
- `js/build.js`
- `package.json`
- `manifest.json`
- `service-worker.js`

## Status

Aprovado para teste manual no navegador e upload no GitHub Pages.
