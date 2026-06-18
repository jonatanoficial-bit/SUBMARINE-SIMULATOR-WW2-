# Release Notes — v2.0.0-alpha.12 — Fase 12

## Fase 12 — Carreira Estratégica e Logística

Esta build foi recriada diretamente sobre o ZIP real da Fase 11 enviado pelo usuário. Nada da Fase 11 foi removido: campanhas nacionais independentes, assets, PWA, saves, auditorias, testes, UI mobile/desktop e núcleo do simulador foram preservados.

### Novidades jogáveis
- Nova tela **Carreira** no menu inferior.
- Sistema persistente de carreira do comandante.
- Patentes por nação: Alemanha, Reino Unido e Estados Unidos.
- Reputação, prestígio, patrulhas, vitórias, tonelagem e pressão da campanha.
- Histórico de serviço com registro de patrulhas concluídas.
- Condecorações desbloqueáveis por desempenho e prontidão.
- Logística por base naval com combustível, torpedos, munição de convés, víveres e peças.
- Moral, fadiga, dias em doca e prontidão operacional.
- Planejamento de patrulha com perfis Equilibrado, Furtivo, Agressivo e Econômico.
- Gatilho seguro antes de iniciar missão: sem suprimentos, a missão não lança.
- Planejamento automático equilibrado ao iniciar briefing, quando houver recursos suficientes.
- Reabastecimento, descanso da tripulação e manutenção de doca.
- Exportação do diário de bordo da carreira em JSON.

### Compatibilidade
- Saves antigos schema 3 migram para schema 4 com blocos `career` e `logistics`.
- Três slots de perfil continuam independentes.
- Campanhas Fase 11 continuam separadas por nação.
- `service-worker.js` atualizado para cache dos novos arquivos da Fase 12.

### Auditoria
- `npm test`: 119/119 PASS.
- `npm run audit`: 26/26 PASS.
- `npm run smoke`: 56/56 PASS.
