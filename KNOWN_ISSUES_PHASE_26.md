# Known Issues — Fase 26

Build: v2.0.0-alpha.41
Fase: 26 — Suboficial/Copiloto Imersivo
Operação: Silent Depth

## Entrega
- Avatar do suboficial/copiloto em SVG local.
- Painel contextual mobile-first com confirmação OK / RECEBIDO.
- Efeito de texto em máquina de escrever.
- Mensagens para prontidão, contato inimigo, ataque aéreo, danos, pressão do casco, solução de torpedo e sucesso de missão.
- Novo módulo `js/systems/subOfficerCopilot.js`.
- Novo CSS `css/phase26-subofficer-copilot.css`.
- PWA/cache, manifest, build e testes atualizados.

## Validação esperada
- `npm test`
- `npm run audit`
- `npm run smoke`
- `python3 tests/campaigns_smoke.py`
- `unzip -t` no pacote final
