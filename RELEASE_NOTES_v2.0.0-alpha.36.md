# Release Notes — v2.0.0-alpha.36 — Fase 21

Fase 21 adiciona patentes e carreira naval ao comandante, conectando reputação operacional, medalhas de campanha, operações especiais, cadeias e desfechos estratégicos a promoções permanentes. Alemanha, Reino Unido e Estados Unidos possuem trilhas próprias de carreira com cinco marcos cada.

## Principais novidades
- Sistema `commandAdvancement` com 15 promoções totais.
- Trilhas independentes para Kriegsmarine, Royal Navy e US Navy.
- Promoções dependem de reputação, prestígio, missões concluídas, tonelagem, medalhas, etapas de cadeia e desfechos.
- Painel de carreira naval na tela Campanha.
- Painel de autoridade do comandante no Comando Estratégico.
- Recompensas persistentes: créditos, XP, pontos de comando, reputação e prestígio.
- Modificadores persistentes: inteligência, decifração, pressão estratégica, risco ASW, prontidão, tonelagem projetada, moral e fadiga.
- Registro automático no dossiê/logbook.
- Migração segura do save para schema 15.

## Validação
- `npm test`: 212/212 PASS.
- `npm run audit`: 364 checks PASS.
- `npm run smoke`: 56/56 PASS.
- `python3 tests/campaigns_smoke.py`: 16/16 PASS.
- ZIP validado sem erro de compactação.
