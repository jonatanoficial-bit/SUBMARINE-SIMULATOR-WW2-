# Release Notes — v2.0.0-alpha.26

## Fase 11 — Campanhas Independentes

Esta versão reforça a Fase 11 usando a base real mais recente do projeto e preserva todos os sistemas posteriores já presentes na build enviada.

### Novidades

- Campanha independente para Alemanha/Kriegsmarine.
- Campanha independente para Reino Unido/Royal Navy.
- Campanha independente para Estados Unidos/US Navy.
- Seletor visual de campanha por nação.
- Linha do tempo operacional por campanha.
- Mapa de atos por campanha, com dois capítulos de missão por ato.
- Trava anti-mistura de comandante: campanhas de outra nação ficam em modo prévia e não lançam briefing.
- Auditoria e smoke test mobile específicos da Fase 11.

### Validação

- `npm test`: PASS.
- `npm run audit`: PASS.
- `python3 tests/campaigns_smoke.py`: PASS.
