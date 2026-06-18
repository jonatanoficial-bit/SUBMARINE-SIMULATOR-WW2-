# Arquitetura do encontro tático v1 — Fase 10.2

## Objetivo

Substituir o ciclo arcade “localizar, disparar e concluir” por um encontro naval com preparação, exposição, reação inimiga, perda de contato e retirada confirmada.

## Estados

`patrol → approach → shadow → attack → evade → disengage → complete`

`failed` é terminal. A transição é calculada pelo `TacticalEncounterSystem`, sem temporizadores de interface.

## Variáveis operacionais

- **Qualidade do contato:** confiança dos sensores, incerteza, alcance conhecido e idade do contato.
- **Prontidão de ataque:** contato, TDC, distância, profundidade, exposição e ameaça ASW.
- **Solução inimiga:** confiança da escolta, solução de ataque, detecção e cargas já em trânsito.
- **Progresso de evasão:** janela contínua de segurança de 22 segundos simulados.
- **Exposição do mastro:** tempo acumulado do periscópio, reduzido após recolhimento.

## Doutrinas

- `shadow`: acompanhar com baixa exposição.
- `attack`: priorizar solução e janela de tiro.
- `evade`: quebrar solução inimiga após ação hostil.
- `disengage`: priorizar distância, silêncio e perda de contato.

## Critério de conclusão

A destruição do objetivo não encerra a missão. A conclusão exige simultaneamente:

1. objetivo destruído;
2. IA em formação ou reagrupamento;
3. nenhuma carga ou torpedo em trânsito;
4. profundidade mínima de 42 m ou escolta a pelo menos 185 unidades;
5. detecção abaixo de 12%;
6. ruído inferior a 46 ou navegação silenciosa;
7. periscópio recolhido;
8. 22 segundos simulados contínuos nessas condições.

Qualquer nova exposição reduz o progresso já acumulado.

## IA naval v2

A ação hostil cria uma reação de 32 segundos. Depois disso, confiança e solução podem decair. A IA percorre `hunt → search → regroup → formation`, em vez de permanecer eternamente em caça. O estado, confiança e solução são serializados.

## Persistência

O snapshot operacional v8 inclui `encounter` e IA v2. Saves anteriores continuam migráveis; na ausência do bloco tático, o motor reconstrói uma doutrina segura a partir de tiros e objetivo destruído.

## Interface

A estação de comando apresenta fase, linha do encontro, contato, prontidão, solução inimiga, evasão, doutrina e recomendação. O comando do periscópio permanece antes do painel tático em celular para continuar acima da dobra.
