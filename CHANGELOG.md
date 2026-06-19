
## v2.0.0-alpha.20 — Fase 20 — Mobile Scroll Stabilization
- Corrigido painel de medições da sala de combate que ficava preso/sobreposto no mobile.
- Gameplay voltou ao fluxo natural da página para rolagem com dedo.
- Mantido periscópio fixo somente enquanto o modal está aberto.
- Preservadas Fases 15–19.

## v2.0.0-alpha.19 — Fase 19 TDC / Controle de Fogo Realista
- Triângulo de ataque, lead angle, tempo até impacto, risco de disparo e disciplina de fogo.
- Integra periscópio, sonar/hidrofone, alvo e torpedo ao painel TDC.

# v2.0.0-alpha.18 — Fase 18: Periscópio Realista

- Envelope de profundidade do periscópio.
- Qualidade óptica, rastro do mastro, estimativa de distância/velocidade e janela de erro.
- UI de periscópio aprimorada para mobile.

## v2.0.0-alpha.16 — Fase 16 — Lastro e Flutuabilidade Realista

- Adiciona envelope de profundidade e zona operacional.
- Adiciona reserva de flutuabilidade e estado de flutuabilidade.
- Amplia o painel da Ponte e da Central de Física.
- Mantém assets internos da Fase 15 e navegação sem fundo decorativo.


## v2.0.0-alpha.14 — Fase 14 — Ponte Imersiva Mobile e Instrumentos Vivos

- Adicionada nova tela `Ponte` com central de comando imersiva.
- Criados medidores digitais e ponteiros simulados para profundidade, velocidade e pressão.
- Adicionados instrumentos vivos para oxigênio, bateria, ruído, detecção, lastro, trim e casco.
- Adicionados modos superfície, cruzeiro, silêncio total, profundidade e mergulho de emergência.
- Atualizado menu inferior para incluir a ponte sem remover campanhas, carreira, logística ou estratégia.
- Atualizados PT-BR, EN e ES.
- Incluídos teste e auditoria próprios da Fase 14.


## v2.0.0-alpha.13 — Fase 13: Comando Naval Estratégico e Inteligência

- Adicionada tela Estratégia com rotas de comboio, diretrizes e rede de inteligência.
- Adicionados teatros estratégicos para Alemanha, Reino Unido e Estados Unidos.
- Save migrado para schema 5 com bloco `strategy`.
- Planejamento de patrulha agora considera inteligência, rota selecionada e diretriz ativa.
- Preservados carreira/logística da Fase 12 e campanhas independentes da Fase 11.

# Changelog

## v2.0.0-alpha.12 — Fase 12 — Carreira Estratégica e Logística

- Build recriada sobre o ZIP real da Fase 11.
- Adicionada tela Carreira no menu inferior.
- Adicionado sistema persistente de patentes, reputação, prestígio, medalhas, tonelagem e histórico de serviço.
- Adicionada logística de base naval: combustível, torpedos, munição de convés, víveres, peças, moral e fadiga.
- Adicionados quatro perfis de planejamento de patrulha: equilibrado, furtivo, agressivo e econômico.
- Briefing agora exibe prontidão logística e acesso à carreira.
- Lançamento de missão passa por gate de suprimentos.
- Saves migrados para schema 4.
- Auditoria F12, teste de carreira/logística e smoke test atualizados.


## v2.0.0-alpha.11 — Phase 11

- Added independent national campaigns for Germany, United Kingdom and United States.
- Added 24 nation-specific missions with campaign order, base, doctrine, chronology, enemy force and strategic goals.
- Campaign screen now filters missions by commander nation.
- Mission unlock progression is now isolated by campaign lane.
- Briefing includes campaign intelligence.
- Added Phase 11 campaign audit, unit tests and browser smoke test.

# Changelog

## v2.0.0-alpha.10.4 — Phase 10.4
- Added four operational difficulty profiles with deterministic engine modifiers.
- Added automatic operational qualification checklist and station recommendations.
- Added contextual help for all seven combat stations.
- Added difficulty persistence, autosave reproducibility and offline cache coverage.
- Added progressive propulsion inertia so telegraph orders no longer teleport actual speed.
- Expanded core homologation for mobile, desktop, translations, settings and simulation regression.

## v2.0.0-alpha.10.3 — Fase 10.3

- Ambiente marítimo determinístico com luz, vento, chuva, visibilidade, ruído e camada térmica.
- SensorSystem v2 com fusão de contatos e histórico de marcações.
- Periscópio com horizonte, balanço, chuva, névoa e qualidade visual.
- Waterfall acústico, tendência, aspecto e velocidade estimada.
- Snapshot operacional v9 e cache PWA atualizado.

## v2.0.0-alpha.10.1 — Estabilização crítica — 2026-06-17

- Rolagem mobile reconstruída com contêiner táctil real.
- Combate dividido em sete estações para evitar página de mais de 10 mil pixels.
- Comandos principais movidos para a primeira tela.
- Medidores de profundidade real/ordenada e velocidade real/telégrafo separados.
- Detecção convertida para taxa por segundo simulado.
- Preparação, fusíveis e cooldown da IA ASW reequilibrados.
- Treze missões sem dano automático durante o primeiro minuto silencioso.
- Periscópio com zoom, marcação da visada, distância, exposição e arrasto.
- Fase 11 suspensa até a reconstrução do encontro tático nas Fases 10.2–10.4.

## v2.0.0-alpha.10 — Fase 10 — 2026-06-13

- Sete compartimentos com integridade, alagamento, incêndio e dano elétrico.
- Feridos, mortos, moral e falha crítica da tripulação.
- Três equipes de controle de avarias com bombeamento, incêndio, reparo e medicina.
- Portas estanques, bombas e energia de emergência.
- Danos de cargas de profundidade encaminhados ao compartimento atingido.
- Snapshot tático v7 e autosave completo do estado de sobrevivência.
- Painel responsivo e localização PT-BR/EN/ES.
- Regressão de medidores, navegação, sensores, TDC, IA naval e save.

## v2.0.0-alpha.09 — Fase 9 — 2026-06-13

- Comboios com múltiplos mercantes e escoltas independentes.
- Estados coordenados de formação, alerta, busca, caça e reagrupamento.
- Cargas de profundidade e aeronaves antissubmarino determinísticas.
- Plot tático, ameaça ASW e autosave do estado naval completo.

## v2.0.0-alpha.08 — Fase 8 — 2026-06-13

- Motor determinístico de armas com `WeaponSystem`.
- Tubos individuais de proa e popa, reserva e recarga simulada.
- Salvas de até três torpedos e seleção de alvo.
- TDC funcional com marcação, distância, velocidade, rumo, AOB, gyro e profundidade.
- Torpedos a vapor/elétricos e falhas históricas por nação/ano.
- Snapshot v5 e restauração completa pelo autosave.
- Estação responsiva e tradução PT-BR/EN/ES.

## v2.0.0-alpha.07 — Fase 7 — 2026-06-13

- Motor determinístico de sensores com `SensorSystem`.
- Hidrofone passivo afetado por ruído, cavitação e avarias.
- Sonar ativo com solução precisa, recarga e exposição tática.
- Radar histórico por nação/ano, mastro e profundidade.
- Periscópio integrado à aquisição visual e trava de torpedo.
- Contatos com confiança, incerteza, classificação, fonte e envelhecimento.
- Snapshot v4 e restauração integral pelo autosave.
- Estação responsiva e tradução PT-BR/EN/ES.

## v2.0.0-alpha.06 — Fase 6 — 2026-06-13

- Motor determinístico de física submarina.
- Profundidade real e ordenada, velocidade vertical, lastro e trimagem.
- Limites de pressão e estresse do casco derivados da classe.
- Propulsão diesel/elétrica, combustível, bateria, oxigênio e CO₂.
- Velocidade real, ruído e cavitação conectados ao motor.
- Todos os medidores funcionais e restauráveis pelo autosave.
- Intertravamento de compressão em risco físico.
- Correção de waypoint personalizado duplicado.
- Console responsivo e localização PT-BR/EN/ES.

## v2.0.0-alpha.04 — Fase 4

### Adicionado

- Três perfis locais e independentes de comandante.
- Gerenciador de perfis com ativação, criação, exclusão, exportação, importação e restauração.
- Save schema v3 com diário transacional e registro temporário verificado.
- Três backups rotativos por perfil.
- Migração única do save legado com arquivo preservado.
- Arquivo externo `SCWW2_SAVE_ARCHIVE` protegido por checksum.
- Autosave de operação e retomada do estado tático.
- Restauração de snapshots no motor determinístico.
- Testes unitários dedicados ao save e à recuperação.

### Alterado

- Menu principal exibe o perfil ativo e operações recuperáveis.
- Briefing permite retomar ou descartar uma operação em andamento.
- Gameplay grava snapshots periódicos e ao sair da cena.
- Save, backup e recuperação passam a operar por slot.
- Service worker inclui a tela e o CSS da Fase 4.

### Corrigido

- Gravação interrompida não substitui o último save válido.
- Corrupção do registro principal recupera automaticamente um backup válido.
- Exclusão de perfil migrado não recria a campanha a partir do arquivo legado.
- Importações adulteradas ou incompatíveis são rejeitadas.

## v2.0.0-alpha.03 — Fase 3

### Adicionado

- `SimulationEngine` determinístico e independente do DOM.
- `SimulationClock` com passo fixo de 80 ms, acumulador e limite de subpassos.
- `EventBus` com inscrição, remoção, eventos únicos e limpeza total.
- Entidades independentes para submarino, alvo e escolta.
- `SceneManager` com ciclo de entrada, saída e descarte.
- Camada de cálculos puros para instrumentos, periscópio, trava de alvo e pontuação.
- Snapshots serializáveis e diagnóstico do motor.
- Testes unitários executáveis por Node.js.
- Documento de arquitetura e regras de extensão do motor.
- Telemetria do núcleo de simulação em tablet e desktop.
- Traduções do estado do motor e dos textos restantes de destruição/derrota.

### Alterado

- A tela de gameplay passou de 865 para uma camada de interface/controlador menor.
- Detecção, IA de escolta, dano, reparo, torpedos e relatório de missão foram movidos para o motor.
- Torpedos agora são resolvidos por ciclos determinísticos, não por temporizadores de regra no DOM.
- Navegação entre telas passa pelo gerenciador de cenas.
- Saída do gameplay encerra relógio, eventos e listeners automaticamente.
- O submarino equipado é entregue ao motor como metadado de entidade para futuras físicas.
- Service worker passa a armazenar todos os módulos do motor para funcionamento offline.

### Corrigido

- Textos fixos `DESTROYED` e `MISSÃO PERDIDA` foram incorporados à internacionalização.
- Relógios de missão não permanecem ativos ao sair da cena.
- Regras do mundo deixam de depender da taxa de renderização da interface.

## v2.0.0-alpha.02 — Fase 2

### Adicionado

- Folha isolada `css/phase2-responsive.css` para evolução responsiva sem destruir estilos anteriores.
- Shell fluido de celular, tablet e PC.
- Breakpoints dedicados para 320×568, telefone retrato, telefone paisagem, tablet e desktop.
- Sincronização com `visualViewport`, largura, altura, orientação, tipo de viewport, standalone e fullscreen.
- Modo imersivo best-effort ao iniciar a missão.
- Orientação adaptativa no manifesto PWA.
- Layout horizontal próprio para o periscópio.
- Retorno automático ao topo nas mudanças de tela.
- Indicador e explicação de orientação adaptativa nos três idiomas.
- Foco visível e respeito a `prefers-reduced-motion`.

### Alterado

- Container deixou de ser limitado a 460 px em tablet e PC.
- Menu principal passa a usar duas colunas em desktop.
- Lobby, campanha, arsenal, tripulação e configurações usam grids progressivos.
- Navegação inferior passa a ser sticky e não sobrepõe conteúdo.
- Estação de combate aparece antes de objetivos, instrumentos e radar em celulares.
- Botão de abrir periscópio aparece integralmente na primeira viewport de 320×568 e 360×640.
- Instrumentos e KPIs são compactados em paisagem de baixa altura.
- Viewport não bloqueia mais zoom por `user-scalable=no`.
- Manifesto passa de orientação fixa em retrato para `any`.

### Corrigido

- Scroll anterior não é mais mantido ao navegar para uma nova tela.
- Conteúdo não apresenta overflow horizontal nos viewports auditados.
- Periscópio mantém controles acessíveis em 640×360.
- Estado `aria-hidden` do periscópio acompanha abertura e fechamento.

## v2.0.0-alpha.01 — Fase 1

### Adicionado

- Fonte única de versão em `BUILD_INFO.json`.
- Gerador `tools/sync_build.py`.
- Auditoria automatizada `tools/audit_project.py`.
- Smoke test mobile e desktop em `tests/smoke_test.py`.
- Save schema v2 com checksum, backup e recuperação.
- Registro local dos últimos 20 erros de runtime.
- Safe mode de renderização com opção de recarregar.
- Validação de dados e paridade das traduções.
- Relatórios de QA e protocolo antiquebra.

### Corrigido

- O service worker não devolve mais `index.html` quando uma imagem ou JSON falha.
- O service worker remove somente caches pertencentes ao Submarine Commander.
- O botão fullscreen agora informa sucesso ou indisponibilidade real.
- A configuração de vibração passa a ser respeitada no botão fullscreen.
- Reset da carreira restaura o bloqueio original das missões na memória.
- Nome do comandante é normalizado e escapado antes de entrar no HTML.
- Removida a identificação falsa de “Commercial Release 100%”.

### Removido

- Painel, scripts, CSS e biblioteca online do projeto Stage Music incluídos indevidamente no ZIP.

## v2.0.0-alpha.05 — Phase 5

- Added deterministic geographic navigation, heading, rudder and autopilot.
- Added operational sea charts, mission routes, custom waypoints and patrol sectors.
- Added guarded ×1–×16 time compression.
- Added navigation restoration to operation autosaves (snapshot v2).
- Added mission-navigation schema validation and 8 navigation unit tests.
- Fixed the missing `SPEEDS` import in the real gameplay ES module.
## v2.0.0-alpha.09 — Fase 9

- Comboios com múltiplos mercantes e escoltas independentes.
- IA coordenada em formação, alerta, busca, caça e reagrupamento.
- Padrões determinísticos de cargas de profundidade e aeronaves ASW.
- Plot tático, ameaça ASW e snapshot operacional v6.
- Autosave restaura integralmente navios, formação e ataques em andamento.


## v2.0.0-alpha.10.2 — Fase 10.2

- Reconstruído o encontro tático em fases: aproximação, acompanhamento, ataque, evasão, desengajamento e conclusão segura.
- Adicionados qualidade de contato, prontidão de ataque, solução inimiga e progresso de evasão.
- Adicionadas quatro doutrinas táticas selecionáveis.
- Destruir o alvo não encerra mais a missão imediatamente.
- A IA perde contato, executa busca e se reagrupa antes de autorizar o fim da operação.
- Corrigido o estado de caça permanente após a destruição do alvo.
- Periscópio passou a respeitar campo de visão e tempo de exposição do mastro.
- Snapshot tático atualizado para v8 e IA naval para v2.
