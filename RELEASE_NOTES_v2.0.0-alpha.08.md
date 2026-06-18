# Release Notes — v2.0.0-alpha.08

## Fase 8 — Tubos de torpedo, recarga e computador de tiro TDC

Esta build substitui o disparo único simplificado por uma estação de torpedos integrada ao motor determinístico.

### Implementado

- `WeaponSystem` independente da interface.
- Bancos de tubos de proa e popa conforme o perfil da nação.
- Torpedos carregados, reserva e ciclos de recarga em tempo simulado.
- Seleção individual de tubo e arcos de tiro por geometria.
- Salvas configuráveis de um, dois ou três torpedos.
- Computador de dados de torpedo (TDC) com marcação, distância, velocidade e rumo do alvo, AOB, gyro e profundidade de corrida.
- Qualidade de solução baseada em confiança do contato, fonte, incerteza, idade, saúde do sistema e dados inseridos.
- Torpedos a vapor e elétricos com velocidade, alcance, esteira e exposição diferentes.
- Taxas históricas determinísticas de falha por nação e ano.
- Resultados de impacto, erro, falha de espoleta, manutenção de profundidade e detonação prematura.
- Possibilidade de atacar o alvo principal ou a escolta.
- Snapshot v5 e restauração integral de tubos, reservas, TDC, recargas e torpedos em trânsito.
- Interface responsiva em português, inglês e espanhol.
- Cache PWA atualizado.

### Compatibilidade

- Save schema permanece em v3.
- Perfis e campanhas anteriores continuam compatíveis.
- Saves antigos migram automaticamente o estoque simples de torpedos para o novo banco de tubos.
- Navegação, física, medidores, sensores e combate determinístico foram preservados.
