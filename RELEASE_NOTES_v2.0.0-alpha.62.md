# Submarine Commander WW2 — v2.0.0-alpha.62

## Fase 47 — Realismo Capitão/Tripulação

Esta fase aprofunda a gameplay principal no modelo realista de comando: o jogador atua como capitão, recebe a situação do suboficial, decide a ordem, e a tripulação executa. O controle manual total continua disponível para quem preferir operar cada sistema diretamente.

### Principais melhorias
- Novo fluxo de ordem do capitão com painel de etapas: situação, ordem, execução e decisão.
- O suboficial passa a consolidar ameaça, falha, avaria e oportunidade tática em falas com opções de ação.
- Ataque agora é encadeado: preparar torpedo/TDC, ir à profundidade de periscópio, abrir periscópio, confirmar disparo.
- A ordem “atacar” não dispara mais automaticamente; o capitão precisa confirmar no periscópio.
- Ordens realistas de evasão, silêncio, reparo, patrulha e acompanhamento recebem feedback de tripulação executando.
- Avatar do suboficial usa assets já existentes dos marinheiros/oficiais do jogo, respeitando a nação da campanha.
- Modo Manual preservado e acessível, sem bloquear o jogador que quer controlar tudo sozinho.

### Compatibilidade
- Schema de save preservado em 40: fase nova não altera a estrutura do save, apenas UI, fluxo de ordens e decisões.
- PWA/cache atualizado com os novos arquivos da Fase 47.

### QA
- `npm test`: 353/353 testes aprovados.
- `npm run smoke`: 50/50 verificações aprovadas.
- `npm run audit`: auditoria da Fase 47 aprovada.
