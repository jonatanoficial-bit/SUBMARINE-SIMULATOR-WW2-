# Submarine Commander WW2 — v2.0.0-alpha.30

## Fase 15 — Alto Comando Estratégico

Esta fase adiciona um sistema de decisões estratégicas persistentes para as três campanhas independentes:

- Alemanha / Kriegsmarine: ordens do B.d.U. focadas em alcateia, B-Dienst, reabastecimento e sobrevivência no Atlântico.
- Reino Unido / Royal Navy: ordens do Western Approaches Command focadas em comboios, HF/DF, escoltas e cobertura aérea.
- Estados Unidos / US Navy: ordens do ComSubPac focadas em interceptações MAGIC, logística avançada, radar e bloqueio no Pacífico.

## Sistemas integrados

- Novo arquivo `data/high_command_orders.json`.
- Novo sistema `js/systems/highCommandOrders.js`.
- Novo painel mobile/desktop em `js/screens/strategy.js`.
- Persistência em `save.strategy.highCommandOrders`.
- Integração com avaliação estratégica, planejamento de patrulha e dossiê exportado.
- Traduções completas PT-BR, EN e ES.
- Cache PWA atualizado.

## Anti-quebra

Cada ordem possui custo, requisito de missão concluída e trava anti-duplicação. Uma ordem aplicada não pode ser reaplicada para evitar exploração de créditos, inteligência, pressão e bônus de prontidão.
