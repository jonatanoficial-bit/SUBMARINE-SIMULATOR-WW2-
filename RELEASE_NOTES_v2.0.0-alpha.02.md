# Release Notes — v2.0.0-alpha.02

## Fase 2 — Commercial Responsive & Immersive Shell

Esta versão transforma a interface estreita do protótipo em uma base adaptativa para celular, tablet e PC, mantendo toda a proteção de save, PWA e runtime da Fase 1.

### Destaques

- Prioridade total para celular com suporte a 320×568.
- Gameplay utilizável em retrato e otimizado em paisagem.
- Botão de periscópio e ações táticas visíveis antes dos instrumentos.
- Layouts de tablet e desktop que aproveitam a largura real da tela.
- Fullscreen e paisagem solicitados de forma segura ao iniciar missão.
- Navegação sticky sem cobrir botões ou conteúdo.
- Teste automatizado de cinco categorias de viewport.

### Compatibilidade

- Android Chrome/PWA: alvo principal.
- Navegadores móveis com suporte parcial a fullscreen: jogo continua em modo normal.
- Tablet: retrato e paisagem.
- PC: mouse, teclado e layouts largos.

### Observação

Navegadores não permitem fullscreen automático fora de uma ação do usuário. A ação “iniciar missão” é usada como gesto autorizado; quando a permissão é negada, o gameplay não é interrompido.
