# Fase 13 — Objetivos históricos de campanha

Build: `v2.0.0-alpha.28`  
Base preservada: `v2.0.0-alpha.27-F12-DOCTRINAS-NACIONAIS`

## Entrega
- Adicionado `data/campaign_objectives.json` com objetivos independentes para Alemanha, Reino Unido e Estados Unidos.
- Cada campanha ganhou 4 objetivos de ato, alinhados com seus 8 capítulos/missões.
- A tela Campanha agora exibe painel próprio de objetivos históricos, progresso por ato, recompensa e efeito estratégico.
- O save recebeu `progression.campaignObjectiveRewards` com schema 7 para impedir recompensa duplicada.
- Ao fechar um ato, o jogo concede créditos, XP, pontos de comando, reputação, prestígio, inteligência e alívio de pressão.
- Service worker, manifesto, build footer, pacote e testes foram atualizados para `v2.0.0-alpha.28`.

## Auditoria
- Testes Node completos via `npm test`.
- Auditoria de fase via `npm run audit`.
- Smoke Python via `npm run smoke`.
- Sintaxe JavaScript verificada pela auditoria.

## Anti-quebra
- As recompensas de objetivo são calculadas por diferença entre missões completas antes/depois da missão.
- Repetir missão concluída não reabre recompensa já registrada.
- Objetivos são validados por nação e por IDs reais de missão.
