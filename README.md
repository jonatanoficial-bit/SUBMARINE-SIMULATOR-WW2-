# Submarine Commander WW2

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
