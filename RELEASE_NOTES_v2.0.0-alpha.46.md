# Release Notes — v2.0.0-alpha.46 — Fase 31

## Fase 31 — Contatos Visuais no Horizonte / Operação Silent Depth

Esta fase torna o periscópio mais vivo e menos técnico, adicionando uma camada visual de silhuetas no horizonte: fumaça de mercantes, mastros, escoltas distantes, aeronave hostil e relatório ótico contextual.

## Principais mudanças

- Nova camada `phase31-horizon-contact-layer` dentro do periscópio.
- Novo relatório visual `phase31-horizon-report` com prioridade clara/contato/alerta/perigo.
- Silhuetas CSS de mercantes, escoltas e aeronave.
- Fumaça e mastros surgem de acordo com alcance, visibilidade, confiança de contato e zoom.
- Neblina dinâmica baseada no clima/visibilidade.
- Totalmente responsivo para mobile.
- Preserva F24 a F30 e todos os sistemas anteriores.

## QA

Executar:

```bash
npm test
npm run audit
npm run smoke
python3 tests/campaigns_smoke.py
```
