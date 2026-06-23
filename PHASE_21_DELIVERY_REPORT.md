# Phase 21 Delivery Report — Patentes e Carreira Naval

Build: v2.0.0-alpha.36  
Phase: 21  
Focus: ranks, naval career advancement and commander authority progression.

## Implementado
- Novo arquivo de dados `data/command_advancement.json`.
- Novo sistema `js/systems/commandAdvancement.js`.
- Trilhas de promoção separadas para Alemanha, Reino Unido e Estados Unidos.
- Cinco marcos de patente por nação, totalizando quinze promoções.
- Requisitos por reputação, prestígio, missões, tonelagem, medalhas, cadeias de operações e desfechos estratégicos.
- Função de consolidação de promoção com trava anti-duplicação.
- Recompensas e efeitos persistentes no save.
- Painel de carreira na Campanha e painel de autoridade no Comando Estratégico.
- Exportação do resumo de carreira no dossiê/logbook.
- Migração segura para save schema 15.
- PWA/cache atualizado para a nova build.

## Integrações preservadas
- Campanhas independentes, doutrinas nacionais, objetivos históricos, consequências estratégicas e Alto Comando.
- Eventos dinâmicos, operações especiais, cadeias, desfechos e medalhas de campanha.
- Sistemas de logística, carreira, estratégia, TDC, periscópio, sonar, comboios/escoltas e trilha sonora.

## Validação
- `npm test`: 212/212 PASS.
- `npm run audit`: 364 checks PASS.
- `npm run smoke`: 56/56 PASS.
- `python3 tests/campaigns_smoke.py`: 16/16 PASS.
- ZIP integrity: PASS.
