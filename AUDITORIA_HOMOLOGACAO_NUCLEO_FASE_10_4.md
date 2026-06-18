# Auditoria de homologação do núcleo — Fase 10.4

## Identificação
- Versão: `v2.0.0-alpha.10.4`
- Build: `SCWW2-20260617-1907-BRT`
- Data/hora: `2026-06-17 19:07 BRT`
- QA: `PASS`
- Fase: `10.4 — Operational Tutorial, Difficulty Profiles & Core Homologation`

## Portões aprovados
| Portão | Resultado |
|---|---:|
| Auditoria estrutural geral | 522/522 |
| Auditoria específica 10.4 | 25/25 |
| Testes unitários | 110/110 |
| Tutorial e dificuldades no navegador | 16/16 |
| Estabilização/rolagem mobile | 14/14 |
| Encontro tático | 12/12 |
| Realismo operacional | 13/13 |
| Regressão jogável completa | 56/56 |
| Patrulhas silenciosas por dificuldade | 52/52 |
| Missões na telemetria tática | 13/13 |

Total de verificações executadas nos portões listados: **833**, além da conferência arquivo por arquivo do manifesto SHA-256.

## Resultado dos perfis
| Perfil | Alerta | Caça | Primeiro dano |
|---|---:|---:|---:|
| Cadet | 40.24 s | 63.44 s | 165.28 s |
| Officer | 23.68 s | 41.36 s | 143.20 s |
| Simulator | 20.16 s | 36.32 s | 138.16 s |
| Hardcore | 16.80 s | 31.36 s | 133.20 s |

- 52 de 52 patrulhas silenciosas ficaram sem dano e sem padrões de cargas nos primeiros 60 segundos.
- Retirada cautelosa nas 13 missões: 91.2–91.2 s.
- Primeiro dano em evasão exposta nas 13 missões: 36–139.04 s.

## Instrumentação homologada
- Profundidade atual separada da profundidade comandada.
- Velocidade real separada da ordem do telégrafo.
- Aceleração e desaceleração progressivas.
- Lastro, trimagem, pressão, combustível, bateria, oxigênio, CO₂, ruído e cavitação ligados ao snapshot real.
- Autosave preserva física, sensores, TDC, IA, avarias, ambiente, encontro e dificuldade.

## Mobile e desktop
- Rolagem táctil em contêiner dedicado aprovada.
- Sem overflow horizontal nos viewports auditados.
- Comando principal alcançável em 320×568.
- Estações responsivas e painéis multicoluna em desktop.

## Limite da certificação
A certificação automatizada reduz regressões e confirma o pacote em Chromium, mas não substitui homologação manual em aparelhos físicos Android/iOS e navegadores de fabricantes distintos.
