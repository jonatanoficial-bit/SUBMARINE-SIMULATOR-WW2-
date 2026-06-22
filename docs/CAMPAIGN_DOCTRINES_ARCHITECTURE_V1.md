# Campaign Doctrines Architecture V1

A Fase 12 adiciona uma camada de assimetria nacional sobre as campanhas independentes.

## Dados

`data/campaign_doctrines.json` contém uma entrada por nação:

- `nationId`: vincula a doutrina à campanha.
- `traitKeys`: três traços de identidade exibidos na interface.
- `modifiers`: impacto mecânico normalizado.
- `stages`: estágios desbloqueados conforme missões da campanha são completadas.

## Sistema

`js/systems/campaignDoctrine.js` é um módulo puro e testável. Ele normaliza modificadores, localiza a doutrina por nação, calcula estágio por progresso e aplica custo de patrulha.

## Integração no app

`js/app.js` aplica doutrina em dois pontos:

1. **Planejamento de patrulha**: combustível, torpedos, prontidão, moral, risco e oportunidade.
2. **Conclusão de missão**: tonelagem, ganho de inteligência e pressão estratégica.

## Interface

`js/screens/campaign.js` renderiza o deck visual de doutrina dentro da tela Campanha. O CSS está em `css/phase12-campaign-doctrines.css`, com prioridade mobile.

## Segurança anti-quebra

- O loader valida cobertura de doutrina para todas as nações.
- O audit valida cache, dados, traduções, integração e sintaxe JS.
- O save schema não foi alterado, evitando migração destrutiva.
