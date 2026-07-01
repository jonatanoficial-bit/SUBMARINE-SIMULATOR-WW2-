# Submarine Commander WW2 — Fase 52

## v2.0.0-alpha.67 — Auxiliar de Delegação Automática/Manual

A Fase 52 transforma a sala de comando em uma cadeia de comando mais realista: o capitão recebe a situação e decide se delega a execução para a tripulação ou se assume manualmente a estação.

### Principais entregas

- Novo sistema `captainDelegationAdvisor.js`.
- Novo painel mobile-first `phase52-delegation-advisor` dentro da sala de comando.
- Em cada cenário importante o auxiliar oferece:
  - opção automática executada pela tripulação;
  - opção manual, levando o jogador para a estação correta;
  - relatório rádio/sonar com quantidade e tipo de contatos.
- Cenários cobertos:
  - início da missão / rota;
  - patrulha;
  - contato no hidrofone;
  - escolta inimiga;
  - alvo localizado;
  - ataque pronto;
  - ameaça aérea;
  - pós-disparo com escolta reagindo;
  - avaria crítica;
  - modo manual ativo.
- Ataque automático tenta preparar alvo, sincronizar TDC, abrir periscópio e lançar quando a solução estiver pronta.
- Rota automática usa o planejamento existente da missão.
- Modo manual continua preservado para o jogador operar sozinho.
- Imagens, assets e músicas/áudios existentes foram preservados.
- Foco mobile fullscreen mantido.

### Validação

- `node --check js/systems/captainDelegationAdvisor.js` — PASS
- `node --check js/screens/gameplay.js` — PASS
- `npm run test:captain-delegation` — PASS
- `npm test` — 383/383 PASS
- `npm run audit` — PASS
- `npm run smoke` — 50/50 PASS

### Save

- Save schema mantido em 40.
- Sem migração obrigatória.
