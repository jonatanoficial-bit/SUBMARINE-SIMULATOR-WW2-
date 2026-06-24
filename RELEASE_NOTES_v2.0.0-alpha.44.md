# Submarine Commander WW2 — v2.0.0-alpha.44

## Fase 29 — Mapa Tático Realista / Carta Naval de Waypoints

A Fase 29 inaugura a camada de navegação **Silent Depth Tactical Naval Chart**, substituindo a sensação de mapa arcade por uma carta naval tática, visualmente mais séria e adequada a um simulador de submarino WW2 mobile/PC.

### Principais entregas

- Carta naval tática com visual de papel náutico/war room.
- Grade hidrográfica mais densa, quadrantes e limites de coordenadas.
- Rotas de comboio marcadas como lanes HX, SC e ON.
- Zonas de perigo dinâmicas para patrulha, varredura aérea e escoltas em caça.
- Anel visual do submarino e rota de waypoints preservada.
- Faixa de leitura com nome da carta, escala operacional, limites e ameaça.
- Layout mobile-first com mapa maior no celular e controles preservados.
- Integração com F24, F25, F26, F27 e F28.

### Arquivos principais

- `js/systems/tacticalNavalChart.js`
- `css/phase29-tactical-naval-chart.css`
- `tests/phase29_tactical_naval_chart.test.js`
- `tools/audit_phase29_tactical_naval_chart.py`

### QA

- Testes automatizados do sistema de carta naval.
- Auditoria específica da Fase 29.
- Smoke test PWA/mobile.
- Validação das campanhas existentes.
