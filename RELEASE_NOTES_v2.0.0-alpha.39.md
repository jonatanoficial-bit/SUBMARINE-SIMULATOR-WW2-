# Release Notes — v2.0.0-alpha.39

## Fase 24 — Rework Total do Periscópio Mobile / Operação Silent Depth

Esta fase inicia a macrofase **Operação Silent Depth**, focada em transformar a base técnica existente em uma experiência visual e imersiva de simulador de submarino.

### Principais mudanças

- Periscópio mobile com classe visual dedicada `phase24-silent-depth`.
- Correção do eixo natural do toque: arrastar para direita/esquerda/cima/baixo agora envia movimento natural para a câmera do periscópio.
- Correção dos botões horizontais do periscópio para manter direção coerente.
- Novo módulo puro `js/systems/silentDepthPeriscope.js` com normalização de toque, cálculo de transformação do oceano e classificação de HUD mobile.
- Novo CSS `css/phase24-silent-depth-periscope.css` com oceano limpo em celular, horizonte premium, vidro, aro e responsividade fullscreen.
- Telemetria técnica removida da área do oceano em telas pequenas para impedir letras/textos sobre a visão.
- Melhorias no horizonte, swell do oceano, iluminação, chuva e parallax.
- Cache/PWA atualizado para a nova build.
- Teste automatizado específico da fase.

### Compatibilidade

- Mantém PC, tablet e mobile.
- Preserva todos os sistemas de campanha, carreira, tripulação, oficiais, medalhas, operações e treinamentos anteriores.
- Save schema atualizado para 18.
