# Rollback — Fase 9

## Versão segura anterior

`v2.0.0-alpha.08 — Fase 8`

## Procedimento

1. Preserve uma exportação dos perfis antes da substituição.
2. Remova a instalação PWA atual ou limpe o cache `submarine-commander-2.0.0-alpha.9`.
3. Reimplante integralmente o ZIP da Fase 8.
4. Reabra o jogo e importe o perfil exportado quando necessário.
5. Uma operação salva como snapshot v6 não deve ser retomada na Fase 8; descarte apenas o autosave de operação e preserve a campanha.

## Integridade

O save schema continua em v3. Dados de campanha são compatíveis; somente o bloco tático `navalAI` e o snapshot v6 não existem na versão anterior.
