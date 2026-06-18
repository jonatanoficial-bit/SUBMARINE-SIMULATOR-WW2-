# Relatório de entrega — Fase 10.3

## Identificação

- Produto: Submarine Commander WW2
- Versão: `v2.0.0-alpha.10.3`
- Build ID: `SCWW2-20260617-1808-BRT`
- Data/hora visível: `17/06/2026 18:08 BRT`
- Fase: `10.3 — Operational Realism, Sea Environment & Sensor Fusion`
- QA: `PASS`
- Save schema: `3`
- Snapshot de operação: `9`
- Sensor snapshot: `2`

## Entrega funcional

- Ambiente marítimo determinístico por missão.
- Hora, luz, estado do mar, vento, chuva, visibilidade, camada térmica e ruído ambiente.
- Influência real do ambiente em hidrofone, sonar, radar, periscópio e detecção.
- Fusão de contatos por qualidade de fonte.
- Histórico de marcações, taxa de distância, tendência, aspecto e velocidade estimada.
- Waterfall acústico e comando de escuta do contato mais forte.
- Periscópio com horizonte móvel, balanço, arfagem, chuva, névoa, qualidade visual e distância óptica.
- Ambiência operacional dinâmica.
- Autosave preservando ambiente e contatos.

## Certificação

- Auditoria estrutural: **332/332**.
- Testes unitários: **105/105**.
- Smoke de realismo operacional: **13/13**.
- Smoke de estabilização mobile: **14/14**.
- Smoke de encontro tático: **12/12**.
- Regressão jogável completa: **56/56**.
- Telemetria: **13/13 missões**.
- Traduções: **796 chaves por idioma**, com paridade PT-BR/EN/ES.

## Equilíbrio confirmado

- Patrulha silenciosa: sem dano ou padrão de cargas no primeiro minuto do cenário certificado.
- Periscópio continuamente exposto: primeiro dano em 88,72 s no teste de referência.
- Telemetria das missões: reação sob exposição entre 36 s e 139,04 s, conforme missão e condições.
- Desengajamento cauteloso: conclusão em aproximadamente 91,2 s, sem dano.

## Gate de conteúdo

A Fase 11 permanece pausada. O próximo gate recomendado é a Fase 10.4, com tutorial operacional, ajuda contextual, calibração de dificuldades e homologação manual do núcleo antes de novas campanhas.
