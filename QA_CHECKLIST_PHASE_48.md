# QA Checklist — Fase 48

## Quadro de Execução
- [x] Ordem do capitão aparece no quadro vivo de execução.
- [x] Estação responsável é exibida: comando, sonar, máquinas, armas, periscópio, controle de avarias ou navegação.
- [x] Status, progresso, ETA, efeito prático e risco aparecem para a ordem atual.
- [x] Checklist de execução muda conforme ataque, evasão, reparo, patrulha ou espera.
- [x] Ordem bloqueada informa motivo sem executar efeito indevido.

## Realismo de Comando
- [x] Preparar ataque não dispara automaticamente.
- [x] Confirmar disparo registra execução no periscópio/armas.
- [x] Ordem de silêncio registra redução de ruído e disciplina operacional.
- [x] Ordem de evasão registra mergulho/afastamento.
- [x] Ordem de reparo registra controle de avarias.
- [x] Patrulha/rota registra navegação como estação responsável.

## Modo Manual
- [x] Modo Manual continua disponível.
- [x] Modo Manual não fica preso no fluxo automático da tripulação.
- [x] Controles diretos continuam registrando execução sem quebrar a operação.

## Interface e Compatibilidade
- [x] Interface mobile preservada.
- [x] Teste 320x568 aprovado.
- [x] Cache PWA inclui os novos arquivos da Fase 48.
- [x] Traduções PT/EN/ES incluem as chaves do quadro de execução.
- [x] Save schema mantido em 40.

## Testes
- [x] `npm test` aprovado.
- [x] `npm run smoke` aprovado.
- [x] `npm run audit` aprovado.
