# Rollback — Fase 7

## Build anterior estável

`v2.0.0-alpha.06 — Fase 6`

## Procedimento

1. Exporte a campanha pelo gerenciador de perfis.
2. Conclua ou descarte uma operação em andamento para máxima compatibilidade.
3. Substitua os arquivos da Fase 7 pelo ZIP completo da Fase 6.
4. Limpe o cache do PWA ou reinstale o aplicativo.
5. Reabra o jogo e selecione o perfil.

O schema de save permanece em v3. A Fase 6 ignora o bloco `sensors` do snapshot v4; campanha, perfil, inventário e progressão permanecem preservados. Uma operação salva pela Fase 7 deve ser concluída ou descartada antes do rollback para evitar perda apenas do estado tático dos sensores.
