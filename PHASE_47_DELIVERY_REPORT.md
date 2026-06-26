# Relatório de Entrega — Fase 47

## Nome
Realismo Capitão/Tripulação / Fluxo de Ataque por Ordem

## Objetivo
Transformar a gameplay em uma experiência mais realista de submarino: o capitão recebe relatório, decide ordens, a tripulação executa, e o jogador só assume operação manual se quiser.

## Implementado
- `js/systems/captainCrewRealism.js` para controlar o fluxo de ordens realistas.
- `css/phase47-captain-crew-realism.css` para o novo painel de cadeia de comando.
- Painel visual de etapas da ordem do capitão no gameplay.
- Integração com o suboficial para falas objetivas com opções de ação.
- Fluxo de ataque: preparar torpedo/TDC → profundidade de periscópio → periscópio aberto → confirmar disparo.
- Modo Manual mantido e corrigido como alternativa total ao modo Capitão.
- Avatar do auxiliar/suboficial reaproveitando assets existentes de marinheiros/oficiais.
- Cache, manifesto, build, traduções PT/EN/ES, smoke e testes atualizados.

## Validação
- `node --check js/screens/gameplay.js` — PASS.
- `node --check js/systems/captainCrewRealism.js` — PASS.
- `npm test` — PASS: 353/353.
- `npm run smoke` — PASS: 50/50.
- `npm run audit` — PASS.

## Status
PASS. Build pronto para teste jogável e upload.
