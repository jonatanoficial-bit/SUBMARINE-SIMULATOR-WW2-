# Documentação técnica de entrega

## Execução local

Na raiz do projeto, inicie um servidor HTTP:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`.

## Verificações

```bash
npm test
python tools/audit_phase54_career_retention.py
```

Para os smokes Python com navegador:

```bash
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/smoke_test.py
```

## Fonte única de versão

Edite `BUILD_INFO.json` e execute:

```bash
python tools/sync_build.py
```

O script sincroniza `js/build.js`, título/metadados do HTML, manifesto e chave de cache do service worker.

## PWA e offline

O `service-worker.js` usa estratégia app-shell para recursos locais e fallback para `index.html` em navegação. A build 2.0.0 contém 215 recursos declarados e nenhum caminho ausente. O manifesto solicita fullscreen e landscape.

## Diretriz para APK

Ao empacotar a PWA em Android, configure:

- orientação nativa `landscape`;
- tela cheia/immersive mode;
- tratamento do botão Voltar para fechar modal, pausar ou pedir confirmação antes de sair;
- pause e autosave em `onPause`/`onStop`;
- safe areas para recortes e barras do sistema;
- persistência testada após atualização do APK;
- áudio interrompido em chamadas e perda de foco;
- testes em aparelhos fracos e com 2–4 GB de RAM.

O jogo não depende de servidor de aplicação. Para APK, pode ser empacotado como WebView/Capacitor/TWA, desde que os arquivos locais, o armazenamento e o ciclo de vida sejam validados.
