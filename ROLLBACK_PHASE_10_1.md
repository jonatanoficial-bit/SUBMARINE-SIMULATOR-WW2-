# Rollback — Fase 10.1

1. Preserve o ZIP da Fase 10 e o ZIP desta fase.
2. Para rollback de código, substitua a pasta inteira pela build `v2.0.0-alpha.10`.
3. Não apague o armazenamento local: o schema de save permanece v3 e é compatível.
4. Caso um navegador mantenha cache antigo, remova o service worker e recarregue antes de abrir a versão anterior.
5. Nunca misture arquivos CSS/JS entre as duas builds.
