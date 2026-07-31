# Changelog

## 2.0.0 — 2026-07-31

### Produto e interface

- Removidos da interface pública rótulos de alpha, fase, QA, revisão e identificadores internos.
- Versão comercial simplificada nos menus e rodapé.
- Seções estratégicas extensas passaram a usar abertura progressiva, reduzindo rolagem inicial no mobile.
- Tripulantes contratados e disponíveis agora aparecem antes dos bloqueados.
- Alvos de toque e cabeçalhos compactados para telas pequenas.
- Respeito à preferência de redução de movimento.

### Gameplay mobile

- Entrada na patrulha solicita fullscreen e orientação horizontal apenas em dispositivos mobile.
- Adicionado pause visível com retomada segura.
- Troca de aba e envio do app ao fundo pausam a simulação e salvam a operação.
- Corrigida largura do shell da gameplay para evitar overflow lateral.
- Telemetria técnica do núcleo deixou de ser exibida ao jogador.

### Integridade e compatibilidade

- Save schema 40 preservado.
- Campanhas, progressão, tripulação, submarinos, oficina, áudio e simulação preservados.
- Metadados sincronizados entre `BUILD_INFO.json`, pacote, manifesto e service worker.
- Caminhos da suíte Node corrigidos para execução no Windows.
- Testes comerciais adicionados para fullscreen mobile, pausa, apresentação pública e cache PWA.

### Conteúdo anterior

O histórico detalhado das iterações alpha permanece nos relatórios e notas legadas incluídos no projeto e no ZIP original fornecido para a auditoria.
