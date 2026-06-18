# Rollback — Fase 10

## Retorno recomendado

A versão de retorno é `v2.0.0-alpha.09`, Fase 9.

1. Preserve uma cópia do ZIP da Fase 10 e de qualquer arquivo exportado pelo gerenciador de perfis.
2. Substitua todos os arquivos da aplicação pelos arquivos íntegros da Fase 9; não misture módulos entre versões.
3. Limpe o cache do service worker ou altere a publicação para que o cache `2.0.0-alpha.09` volte a ser servido.
4. Reabra o jogo e valide versão/build no rodapé.
5. O save schema permanece v3. O autosave tático v7 da Fase 10 contém campos adicionais; descarte a operação em andamento caso a Fase 9 não consiga retomá-la.
6. Campanhas de perfil, progresso, créditos e inventário permanecem compatíveis no schema v3.

## Arquivos exclusivos da Fase 10

- `js/engine/damage/DamageControlSystem.js`
- `css/phase10-damage.css`
- `tests/damage_control.test.js`
- `docs/DAMAGE_CONTROL_ARCHITECTURE_V1.md`

Nunca remova somente esses arquivos mantendo o restante da Fase 10, pois o motor e a interface importam o subsistema obrigatoriamente.
