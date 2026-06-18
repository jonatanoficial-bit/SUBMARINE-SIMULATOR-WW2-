# Release Notes — v2.0.0-alpha.07

## Fase 7 — Hidrofone, sonar, radar e aquisição de contatos

Esta build substitui o painel decorativo de sensores por uma estação conectada ao motor determinístico.

### Implementado

- `SensorSystem` independente da interface.
- Hidrofone passivo afetado por ruído próprio, cavitação e avarias.
- Varredura direcional do hidrofone.
- Sonar ativo com distância precisa, recarga e risco de exposição.
- Radar condicionado à nação, ano histórico, profundidade e mastro.
- Recolhimento automático do mastro ao mergulhar.
- Observação visual real pelo periscópio.
- Contatos com confiança, marcação, distância, incerteza, fonte e classificação.
- Envelhecimento e perda gradual das soluções.
- Trava de torpedo dependente de contato visual válido.
- Instrumentos responsivos para celular, tablet e PC.
- Snapshot v4 e restauração integral dos sensores pelo autosave.
- Traduções completas em português, inglês e espanhol.
- Cache PWA atualizado.

### Compatibilidade

- Save schema permanece em v3.
- Perfis e campanhas das fases anteriores continuam compatíveis.
- Navegação, física, medidores e combate determinístico foram preservados.
