# Problemas conhecidos — Fase 2

Nenhum erro crítico permanece aberto na auditoria desta fase.

## Limitações deliberadas

- Fullscreen e orientação horizontal dependem da API e da permissão do navegador.
- Safari/iOS pode operar apenas em modo PWA/standalone, sem fullscreen web equivalente ao Android.
- O layout foi reconstruído, mas os instrumentos e a lógica de gameplay ainda pertencem ao protótipo original.
- A configuração gráfica ainda não altera qualidade real de renderização; será tratada na fase de performance.
- O tutorial atual é apenas uma dica operacional, não o tutorial completo do simulador.
- Campanhas, tripulação, upgrades e submarinos ainda não estão totalmente integrados ao motor de simulação.
- Testes visuais automatizados usam um harness determinístico porque a política administrativa do navegador do ambiente bloqueia navegação para servidor localhost. Arquivos, CSS, JavaScript e dados reais são auditados estaticamente; o fluxo DOM é exercitado no Chromium pelo harness.
