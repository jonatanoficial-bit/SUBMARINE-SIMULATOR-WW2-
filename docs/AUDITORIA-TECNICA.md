# Auditoria técnica — Submarine Commander WW2 2.0.0

Data: 31 de julho de 2026  
Build: `SCWW2-2.0.0-20260731-1511-BRT`  
Save schema preservado: `40`

## Resultado executivo

O projeto foi auditado como aplicação web/PWA estática e teve seus sistemas existentes preservados. A base é extensa e funcional: campanhas nacionais, carreira, logística, estratégia, tripulação, submarinos, oficina, combate, sensores, torpedos, IA naval, avarias, clima, áudio, perfis e autosave continuam ligados ao mesmo motor e formato de dados.

A entrega foi consolidada como versão estável `2.0.0`. A interface pública não exibe mais marcações de alpha, fase interna, QA, revisão de save ou identificadores técnicos. A experiência mobile ganhou hierarquia progressiva, alvos de toque seguros, pause e proteção no envio do app para segundo plano.

## Problemas encontrados e correções

| Área | Problema observado | Correção aplicada |
|---|---|---|
| Apresentação | Alpha, F54, QA PASS, build ID, datas e revisão apareciam ao jogador | Interface pública reduzida a produto e versão |
| Mobile | Campanha chegava a aproximadamente 17 mil px de rolagem inicial | Sistemas avançados agrupados em seções recolhíveis |
| Gameplay | Entrada mobile e orientação não estavam alinhadas à futura distribuição APK | Entrada da patrulha solicita fullscreen e landscape; manifesto PWA também declara ambos |
| Ciclo de vida | Simulação não tinha pause explícito e podia continuar ao trocar de aba | Pause/retomar, autosave e pausa automática em `visibilitychange`/`pagehide` |
| Gameplay | Faixa técnica do núcleo de simulação era exibida ao jogador | Telemetria técnica ocultada na camada comercial |
| Perfis | Tela mostrava checksum, transação, migração, revisão e ID interno | Mantidas as proteções; removida a exposição técnica |
| Campanha | Percentual apresentava precisão flutuante excessiva | Valor arredondado para leitura humana |
| Tripulação | Bloqueados competiam visualmente com opções compráveis | Contratados e disponíveis priorizados; painéis avançados recolhidos |
| Layout | Shell da gameplay podia usar largura baseada em viewport e gerar overflow | Largura limitada ao contêiner real |
| Windows | Testes resolviam caminhos como `C:\C:\...` | Normalização de URL/caminho corrigida em toda a suíte |
| Build/PWA | Identidade alpha e cache sem identificador temporal | Metadados estáveis sincronizados e cache versionado por data/hora |

## Preservação comprovada

- Nenhum asset de imagem ou áudio original foi substituído.
- Save schema 40 foi mantido.
- Migração, backups e checksum continuam ativos na camada interna.
- Os três idiomas e todas as campanhas existentes foram mantidos.
- Relatórios e documentos históricos continuam incluídos no projeto.
- O ZIP original foi usado apenas como fonte; as correções foram feitas em cópia de trabalho.

## Segurança e privacidade

- Não foram encontrados `eval`, `new Function`, chaves, senhas, tokens ou endpoints externos na aplicação de produção.
- O jogo é local-first; saves permanecem no armazenamento do navegador.
- Não há dependências de runtime externas nem chamadas de rede de terceiros.
- Entradas de nome passam pela rotina de normalização/sanitização já existente.

## Limitações e riscos residuais

- Fullscreen e bloqueio de orientação na web dependem da permissão e do suporte do navegador. No APK, a orientação horizontal deve ser declarada nativamente no manifesto Android.
- A sala de combate ainda é densa. Parte da profundidade foi recolhida, mas a próxima evolução recomendada é renderizar somente a estação ativa, com navegação por abas e alertas globais persistentes.
- Os smokes Python legados exigem o pacote opcional Playwright para Python. Nesta auditoria, o fluxo equivalente foi executado diretamente no navegador integrado; a dependência ausente não afeta o jogo entregue.
- A avaliação foi feita no navegador/PWA. O APK ainda precisa de testes próprios de ciclo de vida, botão Voltar, áudio, permissões, rotação, safe areas, desempenho térmico e retomada após o sistema encerrar o processo.

## Conclusão

A versão 2.0.0 está coerente como build web/PWA estável e como base para empacotamento Android. O núcleo é mais avançado que a apresentação anterior sugeria. O maior risco deixou de ser falta de sistemas e passou a ser excesso de informação simultânea; por isso, a prioridade futura deve ser onboarding, hierarquia de estações e acabamento audiovisual, não adicionar mais subsistemas.
