# Career & Logistics Architecture V1 — Fase 12

## Objetivo

Adicionar uma camada estratégica persistente sobre o simulador tático, preservando o núcleo da Fase 11.

## Blocos de save

### `career`

Registra patente, reputação, prestígio, patrulhas, vitórias, tonelagem, pressão de campanha, medalhas e histórico de serviço.

### `logistics`

Registra combustível, torpedos, munição de convés, víveres, peças, moral, fadiga, dias em doca, prontidão e plano ativo de patrulha.

## Fluxo de lançamento

1. Jogador escolhe missão na campanha nacional.
2. Briefing mostra prontidão logística.
3. Se houver plano ativo para a missão, o lançamento é permitido.
4. Se não houver plano, o jogo tenta criar plano equilibrado automaticamente.
5. Se faltarem suprimentos, o jogador é levado à tela Carreira/Logística.

## Migração

Saves antigos são migrados por `migrateSave()` em `js/save.js`.

- Schema anterior: 3.
- Schema novo: 4.
- Campos novos recebem defaults seguros por nação.

## Regressão preservada

- Campanhas independentes continuam filtradas por nação.
- Slots de perfil continuam independentes.
- Autosave de operação continua separado do save estratégico.
- Núcleo tático não foi substituído.
