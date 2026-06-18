# Arquitetura de armas e TDC — versão 1

## Objetivo

A Fase 8 move o armamento para um subsistema determinístico que não depende do DOM, de animações ou de temporizadores visuais. A interface apenas envia ordens e representa snapshots.

## Módulo principal

`js/engine/weapons/WeaponSystem.js`

Responsabilidades:

- criar o perfil histórico de tubos, reservas, recarga e confiabilidade;
- manter cada tubo como unidade independente;
- calcular a solução TDC a partir dos contatos da Fase 7;
- validar profundidade de lançamento, arco de proa/popa e qualidade mínima;
- criar salvas e resolver cada torpedo em tempo simulado;
- emitir eventos de resolução e exposição;
- serializar e restaurar integralmente o estado da estação.

## Dados do TDC

O TDC mantém marcação, distância, velocidade e rumo estimados do alvo, AOB, ângulo gyro, profundidade de corrida, tipo de torpedo, confiança do contato, idade da solução e qualidade final.

A qualidade não é aleatória. Ela combina saúde do sistema, confiança, fonte do contato, conhecimento da distância, envelhecimento, incerteza e erro dos dados manuais.

## Fluxo de disparo

1. Um sensor detecta e acompanha o contato.
2. O comandante escolhe alvo, tubo, tipo de torpedo e tamanho da salva.
3. O TDC sincroniza os dados conhecidos.
4. O motor valida solução, profundidade e arco de tiro.
5. Cada tubo selecionado é descarregado e inicia recarga se houver reserva.
6. Cada torpedo percorre seu tempo de viagem dentro do relógio determinístico.
7. O motor resolve impacto ou falha e atualiza alvo, escolta, detecção e métricas.

## Persistência

O snapshot v5 inclui `weapons` com perfil, tubos, reserva, TDC, salvas, recargas, tiros ativos, contador e última resolução. Um autosave retomado continua exatamente com os mesmos tubos e tempos restantes.

## Extensão futura

A arquitetura permite adicionar torpedos específicos por modelo, dispersão angular, lançamento externo, minas, decoys ofensivos e carregadores de tripulação sem alterar a interface básica do motor.
