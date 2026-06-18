# Arquitetura de estabilização v1 — Fase 10.1

## Rolagem

Durante gameplay, `body` permanece preso ao viewport e `.app-shell` é o único contêiner vertical. Isso evita conflito entre rolagem do documento, footer e gesto táctil. O contêiner usa `overflow-y:auto`, `-webkit-overflow-scrolling:touch` e `touch-action:pan-y pinch-zoom`.

## Estações

Cada painel recebe `data-station-panel`. `setStation()` ativa somente os painéis associados à estação escolhida, atualiza `aria-selected` e retorna o contêiner ao topo. Comando possui dois painéis ativos: ações e objetivos.

## Instrumentação

- Ponteiro de profundidade: `physics.depth`.
- Marcador de ordem: `physics.orderedDepth`.
- Velocidade digital: `physics.actualSpeedKnots`.
- Telégrafo: `snapshot.speed`.

A interface não calcula física; apenas apresenta o snapshot do motor.

## Detecção

O ganho é uma taxa por segundo simulado. O motor calcula fatores acústicos, visuais, radar e torpedo, subtrai decaimento por profundidade, silêncio e isca e aplica `netRate * simulatedSeconds`.

## Ataque ASW

A IA precisa permanecer em caça por um tempo mínimo antes de lançar. O padrão possui preparação, trajetória e fusível. Ataques repetidos possuem cooldown. Nenhum dano é aplicado diretamente na transição para caça.

## Periscópio

A janela aceita pointer drag, botões e zoom. A marcação central representa a direção de visada; o contato continua apresentando sua própria marcação e distância no readout de sensores.
