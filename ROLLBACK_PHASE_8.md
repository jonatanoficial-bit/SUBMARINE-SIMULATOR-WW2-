# Rollback — Fase 8

## Retorno recomendado

Use o ZIP íntegro da Fase 7 (`v2.0.0-alpha.07`) e substitua todos os arquivos da publicação. Não misture módulos de fases diferentes.

## Saves

O save de campanha continua no schema v3. O snapshot de operação da Fase 8 é v5; ao retornar para uma versão anterior, descarte apenas a operação em andamento pelo briefing se ela não puder ser lida. O perfil, progresso e backups permanecem compatíveis.

## Verificação

Após o rollback:

1. limpe o cache do PWA ou desinstale/reinstale o aplicativo;
2. confirme a versão no rodapé;
3. execute `npm test`, `python3 tools/audit_project.py` e `python3 tests/smoke_test.py` na versão restaurada.
