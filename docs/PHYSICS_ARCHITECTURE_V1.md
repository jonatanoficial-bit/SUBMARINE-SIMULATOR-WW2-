# Arquitetura de Física Submarina v1

Build de referência: **v2.0.0-alpha.06 — Fase 6**.

## Objetivo

A Fase 6 substitui alterações instantâneas e indicadores decorativos por um subsistema físico determinístico. A interface apenas envia ordens; profundidade, velocidade real, recursos, pressão, ruído e cavitação são calculados pelo motor e publicados em snapshots serializáveis.

## Componentes

- `SubmarinePhysicsSystem`: estado e fórmulas físicas.
- `SimulationEngine`: coordena física, navegação, combate e eventos.
- `gameplay.js`: renderiza instrumentos a partir do snapshot, sem inventar valores.
- `phase6-physics.css`: console responsivo e estados visuais dos medidores.
- `physics.test.js`: regressão determinística do subsistema.

## Fluxo de dados

1. O jogador envia uma ordem de profundidade, lastro, trimagem ou telégrafo.
2. O motor registra a ordem sem teletransportar o submarino.
3. A cada passo fixo, o sistema calcula forças de lastro, trimagem e controle automático.
4. A profundidade e a velocidade vertical evoluem progressivamente.
5. Propulsão, consumo, atmosfera, pressão e assinatura acústica são recalculados.
6. O snapshot atualizado alimenta todos os medidores.
7. O mesmo snapshot é usado no autosave de operação.

## Instrumentos vinculados ao motor

- Profundidade real e profundidade ordenada.
- Velocidade vertical.
- Velocidade real em nós.
- Lastro e modo de lastro.
- Trimagem.
- Pressão relativa e limite operacional.
- Propulsão diesel/elétrica.
- Combustível.
- Bateria.
- Oxigênio.
- CO₂.
- Ruído.
- Cavitação.

Nenhum desses instrumentos usa valores aleatórios ou animações independentes.

## Profundidade, lastro e trimagem

A profundidade ordenada é separada da profundidade real. O piloto de profundidade usa erro de profundidade, velocidade vertical, lastro e trimagem para convergir gradualmente. Comandos manuais de inundar ou soprar tanques desligam temporariamente o controle automático. A ordem de nivelar restaura o controle de profundidade no ponto atual.

## Propulsão e recursos

- Na superfície, a propulsão é diesel: consome combustível, recarrega bateria e renova a atmosfera.
- Submerso, a propulsão é elétrica: consome bateria, oxigênio e eleva o CO₂.
- Danos nos motores e energia baixa reduzem a velocidade real, mesmo que o telégrafo permaneça na mesma ordem.
- A navegação recebe a velocidade real calculada, não a velocidade nominal do botão.

## Pressão e sobrevivência

Cada classe de submarino deriva profundidade operacional e profundidade de colapso a partir de seus atributos. Operar além do limite aumenta estresse do casco e gera eventos determinísticos de dano. Oxigênio crítico e CO₂ extremo também geram risco operacional e limitam automaticamente a compressão de tempo.

## Assinatura acústica

Ruído e cavitação consideram ordem de máquinas, velocidade real, profundidade, uso de lastro, velocidade vertical, danos e navegação silenciosa. Alta velocidade em pouca profundidade produz cavitação elevada.

## Persistência

O snapshot físico usa `physicsVersion: 1` e está incluído no snapshot geral `snapshotVersion: 3`. A restauração valida e limita todos os valores antes de reativar a simulação. Autosaves antigos sem bloco de física continuam aceitos com valores seguros derivados do estado anterior.

## Limites desta versão

A Fase 6 entrega uma base sistêmica jogável, não uma simulação hidrodinâmica militar certificada. Correntes, densidade variável da água, estado do mar, temperatura, falhas detalhadas por compartimento e consumo por tripulação serão aprofundados nas fases seguintes sem alterar o contrato de snapshot.
