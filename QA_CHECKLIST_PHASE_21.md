# QA Checklist — Phase 21 — Patentes e Carreira Naval

## Testes obrigatórios
- [x] Build visível atualizada para v2.0.0-alpha.36.
- [x] Save schema atualizado para 15.
- [x] Dados de patentes carregam para as três nações.
- [x] Cada nação possui cinco marcos de promoção.
- [x] Promoções verificam requisitos de carreira, medalhas, cadeias e desfechos.
- [x] Promoção já consolidada não pode ser aplicada novamente.
- [x] Painel de carreira aparece na Campanha.
- [x] Painel de autoridade aparece no Comando Estratégico.
- [x] Efeitos de promoção entram no cálculo estratégico.
- [x] Dossiê/logbook inclui resumo da carreira naval.
- [x] Traduções PT-BR, EN e ES preservadas.
- [x] PWA/cache referencia novos arquivos.

## Resultado
- `npm test`: 212/212 PASS.
- `npm run audit`: 364 checks PASS.
- `npm run smoke`: 56/56 PASS.
- `python3 tests/campaigns_smoke.py`: 16/16 PASS.
