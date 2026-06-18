# Notas de versão — v2.0.0-alpha.10

## Fase 10 — Controle de avarias e sobrevivência

### Adicionado

- Sete compartimentos internos com integridade própria.
- Alagamentos, incêndios e falhas elétricas progressivas.
- Feridos, mortos, moral e capacidade operacional da tripulação.
- Três equipes independentes de controle de avarias.
- Tarefas de bombeamento, combate a incêndio, reparo e atendimento médico.
- Portas estanques, bombas e energia de emergência.
- Painel responsivo de controle de avarias.
- Snapshot tático v7 com persistência completa do novo sistema.
- Testes unitários e jogáveis específicos da Fase 10.

### Alterado

- Danos de cargas de profundidade agora atingem compartimentos.
- Integridade de motores, sonar, periscópio e armas deriva das condições internas.
- Compressão de tempo é limitada em alagamentos e incêndios críticos.
- O reparo de emergência utiliza o novo sistema de controle de avarias.
- PWA inclui o novo módulo e o CSS da Fase 10.

### Corrigido

- Removida a criação repetida de listeners nos botões de recolhimento das equipes.
- Estado do controle de avarias recebe versão própria e serialização validável.
- Autosave mantém exatamente equipes, baixas, energia, incêndios e alagamentos.

### Estado da versão

Esta é uma versão alpha funcional. Balanceamento, arte interna avançada, áudio de emergência e simulação individual de cada tripulante permanecem planejados para fases posteriores.
