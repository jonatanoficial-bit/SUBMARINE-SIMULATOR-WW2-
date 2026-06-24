# Submarine Commander WW2 — v2.0.0-alpha.48

## Fase 33 — IA Naval Melhorada / Operação Silent Depth

Esta fase melhora a inteligência naval inimiga para deixar comboios e escoltas mais críveis e perigosos, sem transformar o jogo em arcade.

### Destaques
- Comboios agora elevam a intensidade de zig-zag defensivo conforme detecção, perdas e torpedos.
- Escoltas alternam entre tela aberta, triagem ativa, barreira de busca e pinça ASW.
- Busca em quadrado expansivo quando o submarino some após contato.
- Reação imediata a esteira de torpedo com manobra violenta do comboio.
- Painel mobile-first para o jogador entender a doutrina inimiga em tempo real.

### Arquivos principais
- `js/engine/ai/NavalAISystem.js`
- `js/systems/navalAITacticalCoordinator.js`
- `css/phase33-naval-ai-tactics.css`
- `tests/phase33_naval_ai_tactics.test.js`
- `tools/audit_phase33_naval_ai_tactics.py`
