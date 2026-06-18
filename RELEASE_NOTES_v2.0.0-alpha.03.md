# Release Notes — v2.0.0-alpha.03

## Fase 3 — Deterministic Simulation Engine Architecture

Esta build transforma o combate existente em uma base técnica extensível. A experiência aprovada da Fase 2 foi preservada, mas as regras deixaram de ficar misturadas ao HTML e aos controles de tela.

### Destaques

- Motor de simulação sem dependência do DOM.
- Passo fixo de 80 ms para resultados reproduzíveis.
- Entidades separadas para submarino, alvo e escolta.
- Eventos desacoplados para dano, torpedo, reparo, detecção e falha da missão.
- Ciclo de cenas que elimina timers e listeners vazando entre telas.
- Sete testes unitários do núcleo.
- Trinta e sete testes jogáveis e responsivos.
- Cinquenta e nove verificações estruturais e de arquitetura.

### Compatibilidade

- Saves da Fase 1 e da Fase 2 permanecem no schema v2.
- Português, inglês e espanhol mantêm paridade completa.
- PWA continua funcional em modo offline após o primeiro carregamento.
- Mobile retrato continua sendo o modo prioritário; paisagem, tablet e PC permanecem compatíveis.

### Escopo preservado

Esta fase não pretende entregar ainda física naval realista ou navegação oceânica. Ela cria a fundação para que esses recursos sejam implementados em sistemas isolados e testáveis.
