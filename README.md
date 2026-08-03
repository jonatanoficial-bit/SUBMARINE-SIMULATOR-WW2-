# Submarine Commander WW2

Simulador tático de submarinos da Segunda Guerra Mundial, jogável no navegador e preparado como PWA. A versão 2.1.0 reúne campanhas independentes para Alemanha, Reino Unido e Estados Unidos, progressão persistente, tripulação, oficina, logística, comando estratégico, combate naval determinístico e treinamento de combate dirigido.

O capitão pode operar cada estação manualmente ou delegar navegação, acompanhamento, ataque, evasão e reparos aos chefes de setor. As decisões exibem a consequência provável e a eficiência automática depende da experiência da tripulação.

## Executar

O projeto usa módulos JavaScript e precisa ser servido por HTTP. Na raiz do projeto:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`.

No celular, a entrada na patrulha solicita tela cheia e orientação horizontal. Em um futuro APK, declare também a orientação `landscape` no manifesto Android para garanti-la nativamente.

## Testar

```bash
npm test
python tests/smoke_test.py
```

A suíte automatizada cobre simulação, campanhas, save/migração, PWA, traduções, progressão, combate, interface e os contratos da versão comercial.

## Estrutura

- `assets/`: imagens, ícones e áudio.
- `css/`: interface responsiva e estilos dos sistemas.
- `data/`: conteúdo, campanhas e traduções.
- `js/`: aplicação, telas, persistência e motor de simulação.
- `tests/`: testes Node e smokes Python.
- `tools/`: auditorias e sincronização de build.
- `docs/`: documentação das arquiteturas.

Metadados da entrega ficam em `BUILD_INFO.json`. A auditoria final e os testes manuais ficam em `docs/AUDITORIA-TECNICA.md` e `docs/TESTES-REALIZADOS.md`.

## Compatibilidade

- Mobile-first, com gameplay horizontal em tela cheia.
- Desktop e tablet responsivos.
- Instalação PWA e cache offline do app shell.
- Saves locais com backups, checksum, migração e três slots de perfil.
- Português do Brasil, inglês e espanhol.

## Versão

Submarine Commander WW2 2.0.0 — Vale Games.
