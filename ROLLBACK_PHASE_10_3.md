# Rollback — Fase 10.3

1. Preserve uma cópia dos perfis exportados pelo menu de saves.
2. Substitua todos os arquivos pela build v2.0.0-alpha.10.2.
3. Não misture `service-worker.js` ou arquivos CSS entre versões.
4. Recarregue duas vezes ou remova o PWA instalado para limpar o cache 10.3.
5. O save schema continua em 3; campanhas e perfis permanecem compatíveis. Autosaves táticos v9 devem ser descartados ao voltar para uma build que espera snapshot v8.
