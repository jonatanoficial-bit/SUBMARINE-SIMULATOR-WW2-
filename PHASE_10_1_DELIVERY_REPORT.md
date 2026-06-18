# Relatório de entrega — Fase 10.1

## Identificação

- Produto: **Submarine Commander WW2**
- Versão: **v2.0.0-alpha.10.1**
- Build: **SCWW2-20260617-1612-BRT**
- Fase: **10.1 — Mobile UX, Instrumentation & Combat Balance Stabilization**
- Status: **QA PASS**
- Data: **17/06/2026 — 16:12 BRT**

## Motivo da fase corretiva

A Fase 11 foi suspensa após a auditoria jogável detectar quatro problemas críticos na base da Fase 10:

1. rolagem por gesto inconsistente no mobile;
2. combate organizado como uma página contínua superior a 10.000 px;
3. profundidade ordenada e profundidade real, além de ordem de máquinas e velocidade real, apresentadas de modo confuso;
4. detecção e ataque ASW rápidos demais, com alerta em aproximadamente 0,8 s, caça em 1,52 s e primeiro dano perto de 10 s em condições iniciais.

## Correções entregues

### Mobile e leitura da interface

- contêiner próprio de rolagem táctil com `overflow-y: auto`;
- gesto real de deslizar validado em Chromium mobile;
- interface dividida em sete estações: comando, instrumentos, sensores, armas, navegação, ameaça e avarias;
- comando principal do periscópio mantido acima da dobra em 320×568 e 360×640;
- rodapé da build fixo sem bloquear os controles;
- ausência de overflow horizontal em celular, tablet e desktop.

### Medidores

- profundidade real separada da profundidade comandada;
- ponteiro real e marcador de ordem movimentam-se independentemente;
- velocidade real em nós separada da ordem do telégrafo;
- HUD, carta naval e instrumentos usam a velocidade física do motor;
- regressão preservada para lastro, trimagem, pressão, bateria, combustível, oxigênio, CO₂, ruído e cavitação.

### Periscópio

- marcação em graus;
- distância estimada;
- indicador de exposição;
- zoom progressivo de 1× a 3×;
- controle por arrasto/toque e roda do mouse;
- mira e orientação independentes do alvo;
- integração preservada com sensores e solução de tiro.

### Balanceamento

- detecção convertida para taxas por segundo simulado;
- escoltas precisam localizar, aproximar e preparar o ataque;
- caça coordenada exige 27 s antes da liberação do primeiro padrão;
- fusíveis de 7 s para ataque aéreo e 9 s para cargas navais;
- intervalo maior entre ataques sucessivos;
- deslocamento de escoltas escalado corretamente pelo tempo;
- danos ASW reduzidos e contramedidas preservadas.

## Telemetria das 13 missões

- 13/13 missões sem dano nos primeiros 60 s de patrulha silenciosa;
- primeiro dano com periscópio continuamente exposto: **mínimo de 50,4 s**;
- primeiro dano após lançamento de torpedo: **mínimo de 36,0 s**;
- nenhuma missão termina nos primeiros 90 s após um lançamento;
- medição determinística registrada em `reports/phase10_1_balance_telemetry.json`.

## Auditoria final

- **195/195 verificações estruturais e de segurança aprovadas**;
- **87/87 testes unitários aprovados**;
- **14/14 testes específicos de estabilização mobile aprovados**;
- **56/56 testes jogáveis e responsivos de regressão aprovados**;
- três idiomas preservados e com paridade de chaves;
- save transacional, autosave, física, sensores, TDC, IA naval e controle de avarias preservados;
- nenhum erro JavaScript não tratado;
- nenhum overflow horizontal nos dispositivos obrigatórios.

## Decisão de produto

A build corrige os defeitos críticos relatados e deixa a simulação legível e jogável. Entretanto, a auditoria não considera o combate ainda equivalente a um simulador AAA. A Fase 11 de campanhas permanece bloqueada. A próxima etapa recomendada é a **Fase 10.2 — reconstrução do encontro tático**, com busca, aproximação, ataque, evasão e desengajamento, antes da inclusão de novas missões.
