# Submarine Commander WW2 — v2.0.0-alpha.63

## Fase 48 — Quadro Vivo de Execução das Ordens do Capitão

Esta fase faz a gameplay parecer mais próxima de um submarino real: o capitão não apenas aperta botões, ele dá uma ordem e acompanha a execução da tripulação. O jogador vê qual estação recebeu a ordem, o que está em andamento, quanto falta e qual efeito prático aquela ordem deve causar.

### Principais melhorias
- Novo quadro vivo de execução das ordens dentro da gameplay.
- Cada ordem mostra estação responsável, progresso, ETA, efeito esperado e risco operacional.
- Ataque, evasão, silêncio, reparo, patrulha e comandos manuais agora geram feedback de execução mais claro.
- O fluxo realista da Fase 47 foi preservado: preparar ataque, ir ao periscópio, confirmar e disparar.
- Modo Manual continua disponível para quem quiser operar a embarcação inteira sozinho.
- Smoke mobile 320x568 mantido e estabilizado para evitar falha intermitente de contexto no Playwright.

### Compatibilidade
- Schema de save preservado em 40.
- PWA/cache atualizado com `captainOrderExecution.js` e `phase48-captain-order-execution.css`.

### QA
- `npm test`: 359/359 testes aprovados.
- `npm run smoke`: 50/50 verificações aprovadas.
- `npm run audit`: auditoria da Fase 48 aprovada.
