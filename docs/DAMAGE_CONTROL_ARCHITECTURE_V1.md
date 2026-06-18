# Arquitetura de controle de avarias v1

## Objetivo

A Fase 10 introduz um subsistema determinístico de sobrevivência do submarino. Impactos deixam de reduzir apenas uma barra global: eles atingem compartimentos, produzem alagamento, incêndio, falhas elétricas e baixas, e exigem decisões de controle de avarias.

## Módulo principal

Arquivo: `js/engine/damage/DamageControlSystem.js`

O módulo não acessa DOM, temporizadores do navegador ou números aleatórios externos. Todo avanço ocorre por `update(deltaMs)` e usa o relógio fixo do `SimulationEngine`.

### Compartimentos

1. Sala de torpedos de proa
2. Bateria de vante
3. Central de comando
4. Sala de sonar
5. Praça de máquinas
6. Bateria de ré
7. Sala de torpedos de popa

Cada compartimento mantém:

- integridade estrutural;
- nível de alagamento;
- intensidade do incêndio;
- dano elétrico;
- oxigênio local;
- estado de isolamento;
- tripulantes aptos, feridos e mortos;
- equipe e tarefa designadas;
- sistema funcional associado.

## Equipes

Existem três equipes independentes. Cada uma pode executar:

- bombeamento;
- combate a incêndio;
- reparo estrutural/elétrico;
- atendimento médico.

As equipes acumulam fadiga enquanto trabalham. A eficiência deriva da tripulação e do perfil da embarcação, mas permanece limitada e determinística.

## Sistemas globais

- Portas estanques: reduzem a propagação entre compartimentos, mas isolam áreas.
- Bombas: dependem de energia principal ou de emergência.
- Energia de emergência: mantém serviços essenciais quando a rede principal cai.
- Moral: calculada a partir de feridos, mortos, fogo e alagamento.
- Integridade do casco: sincronizada com o jogador e reduzida progressivamente em condições críticas.

## Integração com o motor

`SimulationEngine`:

- cria uma instância de `DamageControlSystem`;
- encaminha impactos de cargas de profundidade e outros danos;
- atualiza o subsistema a cada passo de 80 ms;
- sincroniza casco e integridade de motores, sonar, periscópio e armas;
- limita compressão de tempo em emergências;
- encerra a missão em falha estrutural ou perda crítica da tripulação;
- publica o estado em `snapshot.damageControl`.

## Snapshot v7

O snapshot tático passa à versão 7 e inclui:

- sete compartimentos;
- três equipes e suas tarefas;
- portas, bombas e energia;
- alagamento, fogo e dano elétrico;
- feridos, mortos e moral;
- métricas de impactos e reparos;
- versão interna `damageControlVersion: 1`.

Snapshots anteriores continuam aceitos. Quando o bloco de controle de avarias não existe, o motor cria um estado íntegro e compatível.

## Regras anti-quebra

- nenhum `setTimeout`, `setInterval` ou `Math.random` dentro do subsistema;
- todos os valores restaurados são limitados a faixas válidas;
- o estado é serializável em JSON;
- equipes não podem ocupar dois compartimentos;
- mortos não retornam ao serviço por tratamento médico;
- bombas não operam sem alguma fonte de energia;
- UI somente envia comandos e renderiza snapshots;
- regressão obrigatória de física, sensores, armas, IA e save.

## Extensões futuras

A arquitetura permite adicionar pressão por compartimento, gases tóxicos, inventário de peças, tripulantes individuais, ordens de evacuação, colapso localizado e animações internas sem acoplar essas regras à interface.
