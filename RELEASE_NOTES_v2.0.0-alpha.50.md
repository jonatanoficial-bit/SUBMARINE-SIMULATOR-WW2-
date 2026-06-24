# Submarine Commander WW2 — v2.0.0-alpha.50

## Fase 35 — Profundidade, Camadas e Furtividade Realista

Esta fase melhora a leitura de furtividade do submarino, simulando camada térmica, assinatura acústica, cavitação, pressão do casco e faixa recomendada de profundidade silenciosa.

### Destaques
- Novo modelo de furtividade por profundidade.
- Camada térmica calculada por ambiente e estado do mar.
- Bônus acústico abaixo da camada.
- Penalidade por rasura, velocidade, cavitação e pressão.
- Painel mobile-first na estação de instrumentos.
- Recomendações táticas de profundidade e silêncio.

### Arquivos principais
- `js/systems/depthStealthRealism.js`
- `css/phase35-depth-stealth-realism.css`
- `tests/phase35_depth_stealth_realism.test.js`
- `tools/audit_phase35_depth_stealth_realism.py`
