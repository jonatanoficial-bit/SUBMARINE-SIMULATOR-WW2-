# Release Notes — v2.0.0-alpha.06

## Fase 6 — Física submarina e instrumentação funcional

Esta build transforma os principais medidores do gameplay em instrumentos conectados diretamente ao motor determinístico.

### Implementado

- Profundidade real separada da profundidade ordenada.
- Mergulho e subida progressivos.
- Velocidade vertical.
- Lastro automático, inundar, neutro e soprar.
- Trimagem manual e nivelamento automático.
- Subida de emergência com tempo de recarga.
- Limites operacional e de colapso por classe de submarino.
- Pressão e estresse do casco.
- Propulsão diesel na superfície e elétrica submersa.
- Combustível, bateria, oxigênio e CO₂.
- Velocidade real afetada por energia, danos e classe.
- Ruído e cavitação calculados.
- Intertravamento da compressão de tempo em situações críticas.
- Snapshot e autosave completos da física.
- Console responsivo com medidores em tempo real.
- Traduções PT-BR, EN e ES.

### Correção herdada

Foi corrigida a criação duplicada de waypoint personalizado ao tocar uma vez na carta naval.

### Compatibilidade

- Save schema permanece em v3.
- Perfis e saves da Fase 5 são migrados sem perda.
- PWA/offline atualizado com os novos módulos.
