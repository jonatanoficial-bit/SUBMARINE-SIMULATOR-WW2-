# Submarine Commander WW2 — v2.0.0-alpha.01

## Fase 1: Foundation Safety Baseline

Esta versão não tenta transformar ainda o protótipo em simulador completo. Ela cria a fundação necessária para evoluir o jogo sem quebrar saves, PWA, dados ou telas já existentes.

### Resultado

- Protótipo original preservado e jogável.
- Pacote limpo de módulos estranhos ao jogo.
- Build e versão centralizadas.
- Save antigo migrado automaticamente.
- Save corrompido recuperável por backup local.
- PWA corrigida para não mascarar assets ausentes.
- Auditoria técnica e teste de navegação incorporados ao projeto.

### Próxima fase planejada

**Fase 2 — Fullscreen e responsividade comercial:** reconstrução do shell para celular, tablet e PC; layouts portrait/landscape; comandos acessíveis sem sobreposição; safe areas e tratamento correto de tela cheia/PWA.
