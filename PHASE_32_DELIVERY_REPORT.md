# Fase 32 — Rework de Ataque Torpédico / Diretor de Tiro

Build: `v2.0.0-alpha.47`  
Fase: `32`  
Save schema: `26`

## Entrega

A Fase 32 adiciona um diretor visual de ataque por torpedo para transformar o disparo técnico em um fluxo de simulador mais claro e imersivo.

## Incluído

- Novo módulo `js/systems/torpedoAttackDirector.js`.
- Novo CSS `css/phase32-torpedo-attack-director.css`.
- Painel na estação de armas com fase de ataque, plot visual, barras de solução e ordem de fogo.
- Cálculo de aquisição, movimento do alvo, qualidade de giro e prontidão de disparo.
- Feedback de torpedo ativo, previsão de acerto, impacto/miss e recomendação contextual.
- Integração preservada com as fases Silent Depth anteriores.

## QA

- Testes JavaScript adicionados para Fase 32.
- Auditoria anti-quebra adicionada.
- Smoke e campanhas preservados.
