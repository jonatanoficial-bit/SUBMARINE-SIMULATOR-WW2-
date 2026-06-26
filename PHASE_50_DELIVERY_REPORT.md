# Fase 50 — Ciclo Realista de Combate do Capitão

## Build
- Versão: v2.0.0-alpha.65
- BuildId: SCWW2-20260626-1758-BRT-F50-CAPTAIN-COMBAT-CYCLE
- Save schema: 40, mantido estável

## Objetivo
Transformar a cadeia de comando em um ciclo de combate compreensível para o jogador: a tripulação detecta e relata, o suboficial formula a decisão, e o capitão confirma a ordem.

## Entregas
- Novo sistema `captainCombatCycle.js`.
- Novo painel `phase50-combat-cycle` na estação de comando.
- Nova folha `css/phase50-captain-combat-cycle.css`.
- Traduções PT-BR, EN e ES.
- Cache PWA e smoke test atualizados.
- Teste dedicado `phase50_captain_combat_cycle.test.js`.
- Auditoria dedicada `audit_phase50_captain_combat_cycle.py`.

## Fluxo realista
1. Contato.
2. Classificação.
3. Solução de tiro/TDC.
4. Pergunta ao capitão.
5. Execução pela estação responsável.
6. Consequência: impacto, evasão, reparo ou encerramento.

## Validação
- npm test: 372/372 PASS.
- npm run audit: PASS.
- npm run smoke: 50/50 PASS.
