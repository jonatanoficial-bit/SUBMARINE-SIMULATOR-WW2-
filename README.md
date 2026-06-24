# Submarine Commander WW2 — v2.0.0-alpha.27

Fase 12 — Doutrinas nacionais e progressão assimétrica para Alemanha, Reino Unido e Estados Unidos.

Esta build continua a linha das campanhas independentes da Fase 11 e transforma cada nação em uma experiência jogável diferente. Alemanha recebe doutrina de alcateia e tonelagem; Reino Unido recebe defesa/inteligência e menor pressão operacional; Estados Unidos recebe longo alcance, radar/logística e poder de torpedos no Pacífico.

## O que mudou nesta entrega

- Novo arquivo `data/campaign_doctrines.json` com uma doutrina por nação.
- Novo sistema `js/systems/campaignDoctrine.js` com modificadores normalizados, estágios e impacto de planejamento.
- Tela Campanha agora exibe um deck de doutrina com foco, vantagem, risco, traços, modificadores e estágio atual.
- Planejamento de patrulha usa doutrina nacional para alterar combustível, torpedos, prontidão, risco, oportunidade e moral.
- Conclusão de missão usa doutrina para tonelagem estimada, inteligência e pressão estratégica.
- Cache PWA, manifesto, build visível e auditoria atualizados para `v2.0.0-alpha.27`.
- Sistemas já existentes preservados: campanha independente, carreira, logística, estratégia, ponte, periscópio, TDC, rolagem mobile, trilha sonora, clima/oceano e comboios/escoltas IA.

## Auditoria desta entrega

```bash
npm test
npm run audit
npm run smoke
python3 tests/campaigns_smoke.py
```

Resultados registrados em `reports/phase12_campaign_doctrines_audit.json`, `reports/PHASE_12_CAMPAIGN_DOCTRINES_AUDIT.md`, `reports/phase10_4_regression_smoke.json` e `reports/phase11_campaigns_smoke.json`.

---

# Submarine Commander WW2 — v2.0.0-alpha.26

Fase 11 — Campanhas independentes para Alemanha, Reino Unido e Estados Unidos.

Esta build foi evoluída sobre a base real mais recente enviada pelo usuário e preserva os sistemas posteriores já existentes até a Fase 25. A Fase 11 foi reforçada com seletor de campanhas por nação, prévia estratégica, linha do tempo, atos de campanha e trava anti-mistura para impedir lançamento de missão de uma marinha com comandante de outra.

## Auditoria desta entrega

```bash
npm test
npm run audit
python3 tests/campaigns_smoke.py
```

Resultados registrados em `reports/phase11_tri_campaigns_audit.json`, `reports/PHASE_11_TRI_CAMPAIGNS_AUDIT.md` e `reports/phase11_campaigns_smoke.json`.

---

# Submarine Commander WW2 — v2.0.0-alpha.24

Fase 21: dano interno, vazamentos, fumaça, entrada de pressão, estabilidade de compartimentos e controle de emergência.

Esta build preserva as fases anteriores, incluindo a correção de rolagem mobile da Fase 20.

# Submarine Commander WW2 — v2.0.0-alpha.24

Fase 18: Periscópio Realista e Estimativa Óptica.

# Submarine Commander WW2 — v2.0.0-alpha.24

Fase 13 adiciona Comando Naval Estratégico e Inteligência sobre a base real da Fase 12, preservando carreira, logística, campanhas independentes e núcleo homologado.

# Submarine Commander WW2 — v2.0.0-alpha.24

Fase 12: Carreira Estratégica e Logística. Esta build usa a Fase 11 real como base e adiciona carreira persistente, patentes nacionais, medalhas, histórico de patrulhas, suprimentos, planejamento de saída, moral, fadiga e prontidão operacional.

**Vale Games — reconstrução internacional em desenvolvimento**

- Versão: `v2.0.0-alpha.10.3`
- Fase: `10.3 — Operational Realism, Sea Environment & Sensor Fusion`
- Build: consulte `BUILD_INFO.json`
- Idiomas: Português do Brasil, English e Español
- Estado: alpha funcional; ainda não é versão comercial final

## Build atual

A Fase 10.1 interrompe a expansão de conteúdo para estabilizar o núcleo jogável:

- rolagem mobile real por gesto;
- sete estações de combate;
- comandos principais visíveis na primeira tela;
- profundidade real separada da ordem de mergulho;
- velocidade física separada do telégrafo;
- detecção e ataques ASW reequilibrados por tempo simulado;
- periscópio com zoom, marcação, distância, exposição e controle por arrasto;
- telemetria determinística nas 13 missões;
- save schema v3 e snapshot tático v7 preservados.

A auditoria completa está em `AUDITORIA_DETALHADA_ESTABILIZACAO.md`.

## Como executar

O jogo usa módulos JavaScript e deve ser aberto por servidor HTTP:

```bash
python3 -m http.server 8080
```

Depois abra `http://localhost:8080`. Para GitHub Pages, publique o conteúdo desta pasta na raiz do repositório.

## Auditoria

```bash
python3 tools/sync_build.py
npm test
python3 tools/audit_stabilization.py
python3 tests/stabilization_smoke.py
python3 tests/smoke_test.py
```

Os resultados são gravados em `reports/`.

## Regra de build

`BUILD_INFO.json` é a fonte oficial de versão. Não altere manualmente `js/build.js`, o nome do manifesto ou a versão do cache. Execute `python3 tools/sync_build.py` antes de empacotar.

## Próxima evolução

A Fase 11 permanece bloqueada. A Fase 10.3 aprofunda ambiente marítimo, periscópio, hidrofone e fusão de contatos; o próximo gate será a Fase 10.4 de tutorial operacional e homologação do núcleo antes das campanhas.

## Realismo operacional da Fase 10.3

O ambiente, os sensores e o periscópio compartilham o mesmo estado determinístico. Uma leitura de hidrofone não apaga mais uma solução precisa recém-obtida por periscópio, radar ou sonar ativo. O autosave preserva ambiente, histórico de contato e instrumentação.


## Fase 14 — Ponte Imersiva Mobile

A build agora inclui uma tela `Ponte` com instrumentos vivos de profundidade, velocidade, pressão do casco, oxigênio, bateria, ruído, detecção, lastro e trim. A interface foi priorizada para celular em tela cheia horizontal e prepara a base para flutuabilidade realista nas próximas fases.


## v2.0.0-alpha.20 — Fase 19
TDC / controle de fogo realista com solução de disparo, risco e padrão de salva.


## Phase 20 — Mobile Scroll Stabilization
Gameplay mobile scroll was stabilized: measurement dashboard and station tabs are no longer sticky/fixed over the rest of the content.


## Phase 22 — Official Soundtrack Playlist

Six user-composed MP3 tracks are included as an official sequential soundtrack playlist.


## Fase 23 — Tripulação Viva

A build adiciona prontidão operacional da tripulação, moral, fadiga, cobertura de postos e escala de quartos, mantendo a trilha sonora oficial e todos os sistemas anteriores.


### Fase 25
Convoy and Escort Tactical Intelligence: análise tática de comboio, escoltas e recomendação de ataque/evasão dentro da estação de IA.


## Fase 23 — Treinamentos de Prontidão da Tripulação
Sistema de rotinas de prontidão por nação, com custos, requisitos, efeitos persistentes e painel funcional na tela Tripulação.
