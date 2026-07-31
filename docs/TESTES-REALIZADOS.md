# Testes realizados — build 2.0.0

## Automatizados

- Sintaxe: todos os arquivos JavaScript de produção e o service worker passaram em `node --check`.
- Dados: JSON de conteúdo, traduções, pacote, manifesto e build foram lidos sem erro.
- Suíte Node: **399/399 testes aprovados**, sem skips e sem falhas.
- Auditoria de retenção/carreira: **14/14 verificações aprovadas**.
- App shell offline: **215 entradas, 0 arquivos ausentes**.
- Manifesto: dois ícones presentes e com dimensões reais 192×192 e 512×512.
- Segurança estática: nenhuma execução dinâmica de código, segredo ou endpoint externo encontrado.

## Navegador real

Fluxos percorridos no app servido por HTTP:

- splash e menu principal;
- carregamento de perfil existente;
- retomar operação;
- briefing e campanha;
- campanha nacional, sandbox e linha narrativa;
- tripulação e loja;
- entrada na sala de combate;
- pause e retomada;
- autosave de operação;
- navegação entre telas;
- atualização e ativação do service worker.

Resultado: sem overflow horizontal, sem erro persistido pelo guardião de runtime e sem bloqueio de fluxo.

## Viewports

Mobile/retrato para menus e telas administrativas:

`320×568`, `360×800`, `375×812`, `390×844`, `412×915`, `430×932`, `480×900`, `600×960`, `768×1024`.

Gameplay horizontal:

`844×390`, com controles principais, estações, pause e retomada validados.

Desktop:

`1024×768`, `1280×720`, `1366×768`, `1440×900`, `1920×1080`.

Em todos os casos medidos, a diferença entre `scrollWidth` e `clientWidth` foi zero.

## Observação sobre o smoke Python

O arquivo legado `tests/smoke_test.py` não foi executado até o fim porque o ambiente não contém o pacote opcional `playwright` para Python. A mesma navegação foi realizada diretamente no navegador integrado, com cobertura adicional de viewports. Para reproduzir o smoke legado, instale `requirements-dev.txt` e os binários do Chromium do Playwright.
