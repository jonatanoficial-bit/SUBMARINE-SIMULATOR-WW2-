# Arquitetura de realismo operacional v1 — Fase 10.3

## Objetivo

Transformar sensores e periscópio em instrumentos condicionados pelo ambiente, preservando o motor determinístico, o equilíbrio da Fase 10.2 e a compatibilidade de autosave.

## Ambiente marítimo

`EnvironmentSystem` usa missão, ano, teatro e dificuldade como semente determinística. O snapshot inclui hora, luz, estado do mar, vento, precipitação, visibilidade, camada térmica, ruído ambiente, propagação acústica, clutter de radar, balanço, arfagem e deslocamento do horizonte.

O sistema não usa chamadas aleatórias durante a simulação. A mesma missão, snapshot e sequência de passos produzem os mesmos resultados.

## Fusão de contatos

`SensorSystem v2` atribui qualidade relativa às fontes: hidrofone, radar, sonar ativo e periscópio. Uma observação fraca pode confirmar a presença e elevar o sinal, mas não substitui automaticamente uma solução recente e mais precisa.

Cada contato mantém no máximo 12 amostras com marcação, distância, fonte e tempo. O motor deriva taxa de marcação, taxa de distância, velocidade estimada, tendência e aspecto.

## Sensores e ambiente

- Hidrofone: afetado por ruído próprio, cavitação, estado acústico do mar e camada térmica.
- Sonar ativo: alcance modulado pela propagação acústica.
- Radar: alcance e incerteza afetados por clutter de mar e precipitação.
- Periscópio: alcance óptico, contraste e identificação afetados por luz, visibilidade, chuva e estado do mar.

## Interface

A estação de sensores exibe seis condições ambientais, waterfall acústico, histórico de marcações e dados de movimento. O periscópio exibe horizonte dinâmico, balanço, chuva, névoa, qualidade visual e estado do mar.

## Persistência

O snapshot de operação foi atualizado para v9. `environmentVersion: 1` e `sensorVersion: 2` são restaurados pelo mesmo save schema 3, sem alterar os perfis de carreira.
