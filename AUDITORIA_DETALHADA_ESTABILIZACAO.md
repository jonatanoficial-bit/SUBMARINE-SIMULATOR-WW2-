# Auditoria detalhada — estabilização do combate e experiência mobile

**Projeto:** Submarine Commander WW2  
**Build auditada:** v2.0.0-alpha.10.1  
**Escopo:** rolagem mobile, legibilidade, instrumentos, ritmo de detecção/ataque, periscópio e qualidade de simulação  
**Decisão de produção:** Fase 11 suspensa até a estabilização do núcleo de combate

## 1. Diagnóstico executivo

A build da Fase 10 continha sistemas tecnicamente numerosos, porém a experiência real de jogo não acompanhava a quantidade de recursos. O problema central era a combinação de três fatores:

1. **Interface acumulativa:** todas as estações eram renderizadas em uma única página de combate com mais de 10 mil pixels de altura no celular.
2. **Escala temporal incorreta:** a detecção era somada a cada passo de 80 ms como se cada passo representasse um segundo completo.
3. **Feedback pouco confiável:** alguns instrumentos misturavam ordem e valor físico real, dando a impressão de medidores travados ou errados.

O resultado era um combate difícil de ler, com ataques quase imediatos e sensação arcade, mesmo existindo física, sensores, TDC, IA e controle de avarias no motor.

## 2. Problemas confirmados antes da correção

### 2.1 Rolagem e usabilidade mobile

- Altura medida da tela de combate em 360 × 640: aproximadamente **10.617 px**.
- O documento inteiro era usado como área de rolagem, sem contêiner táctil confiável.
- Gesto real de arrastar no Chromium mobile não alterava a posição da tela.
- O botão principal do periscópio aparecia por volta de **702 px** do topo, fora da primeira área visível.
- Instrumentos, sensores, TDC, mapa, IA e avarias competiam pela mesma coluna.
- A barra de build podia ocupar espaço útil sobre o conteúdo.

### 2.2 Ritmo de detecção e ataque

Medições na primeira missão antes do balanceamento:

| Evento | Tempo aproximado |
|---|---:|
| Alerta | 0,8 s |
| Estado de caça | 1,52 s |
| Primeiro dano | 10 s |

A causa principal estava na fórmula de detecção: o ganho era aplicado a cada tick de 80 ms sem conversão para taxa por segundo. A aproximação das escoltas também tinha um fator mínimo excessivo, e as cargas de profundidade possuíam preparação e fusível curtos demais.

### 2.3 Medidores de profundidade e velocidade

- O HUD de velocidade podia exibir a ordem de máquinas em vez da velocidade física em nós.
- Profundidade real e profundidade ordenada não estavam suficientemente separadas visualmente.
- Ponteiro real e marcador de comando dependiam de transformações sem origem explicitamente protegida no CSS.
- Uma ordem de mergulho podia parecer uma mudança errada do instrumento, embora o motor trabalhasse progressivamente.

### 2.4 Periscópio

- Dependência excessiva de quatro botões direcionais.
- Ausência de zoom operacional.
- Falta de uma faixa de marcação central claramente ligada à visada.
- Distância, exposição e confiança estavam dispersas.
- A câmera não podia ser movimentada diretamente por arrasto ou toque.
- A apresentação continuava mais próxima de uma mira arcade do que de uma estação óptica.

## 3. Correções realizadas na Fase 10.1

### 3.1 Nova arquitetura de interface por estações

O combate foi dividido em sete estações:

1. Comando
2. Instrumentos
3. Sensores
4. Torpedos
5. Navegação
6. Ameaça ASW
7. Avarias

Somente a estação selecionada permanece expandida. A estação de comando prioriza as ações imediatas antes do texto longo de objetivos.

Resultados medidos:

- A página deixou de ser um documento de mais de 10 mil pixels.
- O corpo do documento permanece limitado ao viewport.
- A área `.app-shell` passou a ser o contêiner de rolagem real.
- Gesto táctil real alterou o `scrollTop` em centenas de pixels durante o teste.
- O botão principal do periscópio passou para aproximadamente **343 px** do topo em 360 × 640.
- Em 320 × 568, o comando principal continua acessível.

### 3.2 Instrumentos corrigidos

- Profundidade real e ordem de profundidade possuem leituras digitais separadas.
- Ponteiro de profundidade acompanha apenas a profundidade física.
- Marcador azul acompanha apenas a ordem comandada.
- Velocidade real em nós aparece separada da ordem do telégrafo.
- O HUD principal usa `actualSpeedKnots` do motor.
- Origem de rotação dos ponteiros foi fixada explicitamente.
- Navegação continua usando velocidade física, não o nome da ordem de máquinas.

### 3.3 Balanceamento temporal

- Detecção convertida para **taxa por segundo simulado**.
- Ruído, distância, profundidade, silêncio, periscópio, radar, torpedo e isca entram na mesma equação temporal.
- Aproximação de escoltas foi desacelerada.
- A escolta precisa manter o estado de caça por **27 segundos** antes de alinhar o primeiro ataque.
- Fusível das cargas de profundidade de escolta passou para **9 segundos**.
- Ataques repetidos receberam intervalo maior.
- Aeronaves usam ganho de confiança por segundo e tempos de ataque maiores.

Resultados determinísticos após a correção:

| Cenário | Alerta | Caça | Primeiro dano |
|---|---:|---:|---:|
| Patrulha silenciosa por 60 s | nenhum | nenhum | nenhum |
| Periscópio continuamente exposto | ~14 s | ~27,7 s | ~65,4 s |
| Velocidade de flanco | ~94,7 s | ~119,6 s | ~221,4 s |
| Lançamento de torpedo | reação imediata à esteira | imediata | ~36,0 s |

A reação imediata à esteira do torpedo é intencional, mas o dano não é instantâneo: existe tempo para mergulhar, usar silêncio, manobrar ou lançar isca.

### 3.4 Periscópio estabilizado

- Zoom de 1× a 3×.
- Faixa central de marcação.
- Distância estimada.
- Exposição percentual.
- Marcas de elevação e distância.
- Controle por arrasto no mouse e por toque/pointer.
- Botões direcionais mantidos como alternativa de acessibilidade.
- Intertravamento de compressão em 1× durante exposição.

## 4. O que ainda impede a classificação como simulador AAA

A Fase 10.1 corrige falhas críticas, mas não transforma sozinha o combate em simulação premium. Permanecem limitações estruturais:

### 4.1 Encontro tático ainda começa perto demais da ação

O jogador entra diretamente em uma cena tática. Um simulador completo deve ter as etapas:

1. busca de contato;
2. classificação acústica;
3. cálculo de rota de interceptação;
4. aproximação fora da escolta;
5. observação curta por periscópio;
6. solução de tiro;
7. ataque;
8. evasão;
9. perda de contato inimigo;
10. retirada e retorno à patrulha.

### 4.2 Periscópio ainda usa representação 2D simplificada

Ainda faltam:

- horizonte e mar animados por clima;
- noite, neblina, chuva e estado do mar;
- silhueta em escala baseada na distância;
- oclusão por ondas;
- embaçamento, gotas, vibração e danos ópticos;
- elevação de mastro e tempo de exposição;
- stadímetro manual;
- cálculo de distância por altura do alvo;
- alternância entre baixa e alta ampliação historicamente coerente.

### 4.3 Sensores precisam de fluxo de trabalho mais profundo

- hidrofone com histórico de marcações;
- waterfall acústico;
- contatos que se dividem ou se fundem;
- perda de contato;
- erro crescente com informação antiga;
- operador de sonar e fadiga influenciando resultados;
- classificação por assinatura e hélices.

### 4.4 TDC ainda precisa de plotting manual

O TDC calcula dados, mas um simulador forte deve permitir:

- três ou mais marcações em intervalos de tempo;
- estimativa manual de velocidade;
- AOB visual e por plotting;
- tubo, gyro, profundidade e espoleta por torpedo;
- dispersão planejada da salva;
- solução degradada por dados antigos ou contraditórios.

### 4.5 IA precisa de doutrina, não apenas estados

As escoltas já possuem formação, alerta, busca e caça, porém faltam:

- contato provável versus confirmado;
- busca em caixa, creeping attack e barragem;
- coordenação entre duas escoltas;
- perda gradual da solução;
- comportamento por marinha, ano e comandante;
- proteção de navios danificados;
- retirada ou chamada de reforço.

## 5. Plano obrigatório antes da Fase 11

### Fase 10.2 — Reconstrução do encontro tático

- iniciar missões fora do contato visual;
- fluxo completo busca → aproximação → ataque → evasão → retirada;
- distâncias e escalas consistentes;
- perfis Arcade, Realista e Simulador;
- curvas de detecção por dificuldade;
- telemetria de tempo até alerta, ataque e derrota.

### Fase 10.3 — Periscópio e ambiente marítimo

- ótica mais realista;
- clima, noite, mar e visibilidade;
- stadímetro;
- escala correta dos navios;
- elevação, exposição e danos do mastro.

### Fase 10.4 — Sensores, TDC e tutorial operacional

- plotting acústico;
- histórico de contatos;
- solução manual assistida;
- tutorial interativo por estação;
- áudio e alertas de tripulação;
- testes de novato sem conhecimento prévio.

Somente depois desses três gates a **Fase 11 — campanhas independentes** deve ser retomada. Criar novas missões antes disso multiplicaria um loop de combate ainda incompleto.

## 6. Critério de aprovação desta estabilização

A build 10.1 só pode receber `QA PASS` quando:

- gesto táctil real rolar a estação;
- o comando principal estiver dentro da primeira tela;
- profundidade real e ordenada divergirem corretamente;
- velocidade real e telégrafo divergirem corretamente;
- patrulha silenciosa não sofrer ataque automático no primeiro minuto;
- periscópio contínuo oferecer pelo menos 50 segundos em todas as missões antes do primeiro dano;
- torpedo não causar contra-ataque com dano antes de 34 segundos;
- toda a regressão das Fases 1–10 continuar aprovada.
