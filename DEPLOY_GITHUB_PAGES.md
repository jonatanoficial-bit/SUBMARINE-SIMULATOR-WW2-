# Publicação no GitHub Pages

1. Envie o conteúdo da pasta principal da build para o repositório.
2. Mantenha `index.html` na raiz do branch publicado.
3. Em GitHub > Settings > Pages, selecione o branch e a pasta raiz.
4. Depois de atualizar uma build, limpe cache do navegador ou abra em guia anônima para validar service worker.
5. No Android, abra o site no Chrome e use "Adicionar à tela inicial" para instalar como PWA fullscreen.

## Estrutura obrigatória

A raiz publicada deve conter:

- `index.html`
- `manifest.json`
- `service-worker.js`
- `css/`
- `js/`
- `data/`
- `assets/`

Não publique várias pastas de versões dentro do mesmo ZIP.
