# Rollback — Fase 3

## Versão anterior segura

`SUBMARINE-COMMANDER-WW2-v2.0.0-alpha.02-FASE-2.zip`

## Procedimento

1. Preserve uma cópia do ZIP da Fase 3 e do save exportado pelo navegador.
2. Remova os arquivos da Fase 3 do local de hospedagem.
3. Publique integralmente o conteúdo do ZIP da Fase 2.
4. Limpe ou atualize o service worker para remover o cache `submarine-commander-2.0.0-alpha.3`.
5. Recarregue a aplicação duas vezes ou reinstale o PWA.
6. Confirme no rodapé a versão `v2.0.0-alpha.02`.

O schema do save não mudou nesta fase. O rollback para a Fase 2 não exige migração reversa de dados.
