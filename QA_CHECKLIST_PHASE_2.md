# Checklist de QA — Fase 2

## Build

- [x] Versão centralizada em `BUILD_INFO.json`.
- [x] Data, hora, fase e QA visíveis.
- [x] Cache do service worker alinhado à versão.
- [x] CSS da Fase 2 incluído no app shell offline.

## Responsividade

- [x] 320×568 sem overflow horizontal.
- [x] 360×640 sem overflow horizontal.
- [x] 640×360 sem overflow horizontal.
- [x] 768×1024 com layout de duas colunas.
- [x] 1366×768 com shell maior que 900 px.
- [x] Botão principal de combate integralmente visível na primeira viewport mobile.
- [x] Periscópio cabe em paisagem de baixa altura.
- [x] Navegação inferior não cobre conteúdo.

## Fluxo jogável

- [x] Menu abre.
- [x] PT-BR, EN e ES alternam corretamente.
- [x] Criação do comandante funciona.
- [x] Lobby, campanha e briefing funcionam.
- [x] Missão inicia mesmo quando fullscreen/orientação são recusados.
- [x] Periscópio abre.
- [x] Save, backup e recuperação continuam funcionando.

## Acessibilidade e segurança

- [x] Zoom não é bloqueado por `user-scalable=no`.
- [x] Foco de teclado visível.
- [x] Redução de movimento respeitada.
- [x] Áreas seguras aplicadas.
- [x] `aria-hidden` do periscópio sincronizado.
- [x] Nenhum erro JavaScript não tratado no smoke test.
