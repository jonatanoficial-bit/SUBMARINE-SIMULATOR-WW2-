# Protocolo Antiquebra

Toda fase deve seguir esta sequência antes da geração do ZIP:

1. Atualizar versão, fase, data e hora em `BUILD_INFO.json`.
2. Executar `python3 tools/sync_build.py`.
3. Executar `node --test tests/engine.test.js`.
4. Executar `python3 tools/audit_project.py`.
5. Executar `python3 tests/smoke_test.py`.
6. Corrigir qualquer resultado `FAIL`; não empacotar build reprovada.
7. Marcar `qaStatus` como `PASS`, sincronizar novamente e repetir as auditorias.
8. Atualizar changelog, release notes, problemas conhecidos e rollback.
9. Gerar ZIP completo sem arquivos temporários, caches ou dados de outro projeto.
10. Extrair o ZIP em diretório limpo e repetir auditoria e smoke test.
11. Guardar o SHA-256 do ZIP no relatório final.

## Bloqueadores obrigatórios

A build não pode ser entregue quando houver:

- erro de sintaxe JavaScript;
- falha em qualquer teste unitário do motor;
- regras de simulação reintroduzidas diretamente em arquivos de tela;
- relógio ou listener do gameplay ativo depois da saída da cena;
- JSON inválido ou IDs duplicados;
- divergência entre as três traduções;
- arquivo do app shell ausente;
- versão divergente entre build, interface, manifesto e service worker;
- falha na abertura do menu, criação do comandante, save ou gameplay;
- corrupção de save sem recuperação;
- erro JavaScript não tratado durante o smoke test;
- overflow horizontal em qualquer viewport obrigatório;
- botão primário de combate fora da primeira viewport mobile;
- navegação ou rodapé cobrindo comandos;
- periscópio inacessível em 640×360;
- falha de fallback quando fullscreen ou orientação não forem permitidos.

## Matriz mínima responsiva

- 320×568 — telefone compacto em retrato;
- 360×640 — telefone base em retrato;
- 393×852 e 412×915 — verificação manual recomendada;
- 640×360 — telefone em paisagem;
- 768×1024 — tablet em retrato;
- 1024×768 — tablet/desktop compacto;
- 1366×768 — desktop padrão.

## Extensão obrigatória — Fase 10

- Todo impacto deve passar por `DamageControlSystem`; alterações diretas de UI são proibidas.
- O snapshot tático deve permanecer serializável e carregar `snapshotVersion: 7`.
- Nenhum reparo pode reviver mortos ou operar bombas sem energia.
- Toda alteração futura deve testar compartimentos, equipes, propagação, energia e autosave.
- O portão final exige regressão de todos os medidores e sistemas das fases anteriores.

