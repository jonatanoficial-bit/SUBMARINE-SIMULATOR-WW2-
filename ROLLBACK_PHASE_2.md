# Rollback — Fase 2

## Build anterior estável

- Versão: `v2.0.0-alpha.01`
- Pasta/pacote esperado: `SUBMARINE-COMMANDER-WW2-v2.0.0-alpha.01-FASE-1.zip`

## Procedimento

1. Preserve uma cópia do save local; a Fase 2 continua usando schema v2 e não exige migração nova.
2. Substitua todos os arquivos publicados pelos arquivos da Fase 1.
3. Não misture `service-worker.js`, `BUILD_INFO.json` ou `js/build.js` entre versões.
4. Limpe somente o cache `submarine-commander-2.0.0-alpha.2` ou aguarde a ativação do service worker anterior.
5. Reabra o jogo e confirme no rodapé `v2.0.0-alpha.01`.
6. Execute auditoria e smoke test da Fase 1 antes de republicar.

## Compatibilidade do save

Não houve alteração do `saveSchemaVersion`; saves da Fase 2 podem ser carregados pela Fase 1, desde que nenhum recurso de fases futuras tenha sido adicionado manualmente.
