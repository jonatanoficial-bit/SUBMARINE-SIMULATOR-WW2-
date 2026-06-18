# Relatório de Entrega — Fase 12

**Projeto:** Submarine Commander WW2  
**Build:** v2.0.0-alpha.12  
**Fase:** 12 — Carreira Estratégica e Logística  
**Base real usada:** `SUBMARINE-COMMANDER-WW2-v2.0.0-alpha.11-FASE-11.zip`  
**Data:** 2026-06-18 16:45 BRT

## Escopo entregue

A Fase 12 adiciona uma camada estratégica persistente ao jogo, sem substituir a simulação tática criada nas fases anteriores. O jogador agora precisa administrar carreira, patente, reputação, suprimentos, moral, fadiga e manutenção antes de lançar patrulhas.

## Arquivos principais adicionados

- `js/screens/career.js`
- `css/phase12-career-logistics.css`
- `data/logistics.json`
- `tests/career_logistics.test.js`
- `tools/audit_phase12.py`
- `RELEASE_NOTES_v2.0.0-alpha.12.md`
- `PHASE_12_DELIVERY_REPORT.md`
- `QA_CHECKLIST_PHASE_12.md`
- `KNOWN_ISSUES_PHASE_12.md`
- `ROLLBACK_PHASE_12.md`
- `docs/CAREER_LOGISTICS_ARCHITECTURE_V1.md`

## Arquivos principais atualizados

- `index.html`
- `package.json`
- `BUILD_INFO.json`
- `manifest.json`
- `service-worker.js`
- `js/build.js`
- `js/app.js`
- `js/save.js`
- `js/dataLoader.js`
- `js/components/ui.js`
- `js/screens/lobby.js`
- `js/screens/briefing.js`
- `tests/smoke_test.py`
- `data/translations/pt-BR.json`
- `data/translations/en.json`
- `data/translations/es.json`

## Resultado

- Build completa baseada na Fase 11 real.
- Núcleo de campanhas independentes preservado.
- Nova progressão estratégica persistente.
- Migração de save preservada.
- Auditoria e smoke test aprovados.
