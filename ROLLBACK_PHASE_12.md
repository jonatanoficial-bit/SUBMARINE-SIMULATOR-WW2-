# Rollback — Fase 12

Para voltar à Fase 11, usar o ZIP oficial enviado como base:

`SUBMARINE-COMMANDER-WW2-v2.0.0-alpha.11-FASE-11.zip`

Arquivos adicionados pela Fase 12 que podem ser removidos em rollback manual:

- `js/screens/career.js`
- `css/phase12-career-logistics.css`
- `data/logistics.json`
- `tests/career_logistics.test.js`
- `tools/audit_phase12.py`
- Documentos `PHASE_12`, `QA_CHECKLIST_PHASE_12`, `KNOWN_ISSUES_PHASE_12`, `ROLLBACK_PHASE_12`

Atenção: saves criados na Fase 12 usam schema 4. A Fase 11 usa schema 3 e não conhece os campos `career` e `logistics`.
