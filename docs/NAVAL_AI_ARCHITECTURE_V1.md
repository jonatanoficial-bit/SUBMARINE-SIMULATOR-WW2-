# Arquitetura de IA naval e guerra antissubmarino — versão 1

## Objetivo

A Fase 9 substitui o cenário de alvo único por um sistema determinístico de comboio. Mercantes, petroleiros, destróieres, corvetas, padrões de cargas de profundidade e aeronaves ASW passam a existir como estados reais do motor, independentes da interface.

## Módulo principal

`js/engine/ai/NavalAISystem.js`

Responsabilidades:

- gerar comboios de três a seis mercantes conforme missão e dificuldade;
- gerar uma a três escoltas com atributos e posições próprias;
- manter formação, velocidade, rumo, manobras evasivas e perdas;
- coordenar estados de formação, alerta, busca, caça e reagrupamento;
- registrar a última posição provável do submarino;
- executar padrões determinísticos de cargas de profundidade;
- controlar disponibilidade, patrulha, rastreamento e ataque de aeronaves ASW;
- calcular exposição, ameaça, dano e mensagens táticas;
- serializar e restaurar integralmente o estado da força naval.

## Estados da IA

- `formation`: comboio em navegação regular e escoltas no perímetro.
- `alert`: ameaça suspeita, formação mais fechada e escoltas reposicionadas.
- `search`: busca coordenada em pernas e raios progressivos.
- `hunt`: posição provável adquirida, ataques e cargas de profundidade autorizados.
- `regroup`: recomposição temporária após perda ou dispersão.

As transições usam tempo simulado, detecção, lançamentos de torpedo, destruição de navios, ruído do submarino e idade da última posição conhecida.

## Comboio e formação

Cada navio é uma `ShipEntity` com identificador, função, classe, posição, estado, integridade e metadados. O primeiro mercante permanece como objetivo principal para compatibilidade com campanhas anteriores, enquanto os demais formam o comboio real. A primeira escolta permanece como referência de compatibilidade, mas todas as escoltas participam da IA.

## Cargas de profundidade

Uma escolta em alcance e com solução suficiente cria um padrão com:

- navio lançador;
- centro estimado;
- número de cargas;
- raio de dispersão;
- tempo até detonação;
- precisão dependente da dificuldade e do sonar;
- contador e identificação persistentes.

A resolução considera distância, profundidade, ruído, cavitação, contramedidas e manobra. O resultado pode ser erro, quase impacto ou dano a um sistema e ao casco.

## Aeronaves ASW

A disponibilidade é histórica, ativada em missões a partir de 1942 conforme teatro e dificuldade. A aeronave possui posição, estado, autonomia, confiança de detecção, recarga de ataque e número de passagens. Ela pode patrulhar, rastrear, atacar e deixar o setor.

## Interface

A estação de IA naval em `js/screens/gameplay.js` representa o snapshot do motor e nunca decide regras. Ela exibe:

- plot tático do comboio;
- mercantes e escoltas ativas;
- aeronave ASW;
- estado global da formação;
- escolta mais próxima;
- padrões de cargas em queda;
- nível de ameaça antissubmarino;
- mensagens operacionais.

## Persistência

O snapshot de operação foi elevado para v6. O bloco `navalAI` preserva perfil, todos os navios, formação, estado global, última posição conhecida, padrões de cargas, aeronave, métricas, temporizadores e contadores. Saves táticos anteriores continuam sendo aceitos; quando não há bloco de IA, o sistema cria a força naval padrão da missão.

## Determinismo e sistema antiquebra

O módulo não usa `setTimeout`, `setInterval` ou aleatoriedade não controlada. Todo avanço depende do passo do `SimulationClock`, permitindo testes reproduzíveis, compressão de tempo segura, autosave exato e retomada sem divergências.

## Extensões futuras

A arquitetura permite incluir escoltas por doutrina nacional, grupos de caça, porta-aviões de escolta, minas, comboios divididos, comunicações de rádio, clima e cooperação entre aeronaves e navios sem reescrever o contrato principal do motor.
