# Rollback — Fase 1

## Retorno de código

Mantenha o ZIP original `v1.0.0` arquivado separadamente. Para rollback completo, substitua todos os arquivos publicados pelo pacote anterior; não misture arquivos entre versões.

## Compatibilidade do save

A Fase 1 lê o save legado usado pela versão anterior e o converte para o envelope schema v2. A versão antiga pode não entender o novo envelope. Antes de retornar para uma build antiga, preserve uma cópia do armazenamento local ou limpe o save no navegador e inicie uma carreira nova.

## Recuperação dentro da própria Fase 1

O jogo mantém:

- save principal: `valeGames.submarineCommander.save`;
- backup: `valeGames.submarineCommander.save.backup`.

Quando o checksum ou JSON principal falha, o backup válido é restaurado automaticamente.
