# Prompts recomendados para novos avatares e embarcações

## Diagnóstico do inventário atual

Todos os **73 assets originais** foram preservados byte a byte: `0` ausentes e `0` alterados.

Há, porém, duas lacunas visuais claras:

- os 15 submarinos jogáveis usam a mesma imagem genérica;
- a Alemanha tem quatro retratos-base, mas Reino Unido e Estados Unidos têm apenas dois cada, reutilizados entre 12 tripulantes por nação.

As imagens abaixo não são necessárias para o jogo funcionar, mas aumentariam bastante a sensação de produto comercial.

## Regras comuns para a IA geradora

Use os assets atuais como referência visual quando a ferramenta aceitar imagem de referência. Peça sempre **um arquivo por imagem, nunca uma colagem**.

### Avatares

- PNG 408×612, fundo transparente real, personagem centralizado da cintura para cima.
- Pintura digital realista/cinematográfica, Segunda Guerra Mundial, iluminação naval dramática azul-petróleo e âmbar.
- Mesma câmera, escala, contraste e acabamento dos retratos existentes.
- Sem texto, moldura, logotipo, marca d'água ou símbolos extremistas.
- Uniformes historicamente inspirados, porém sem insígnias controversas em destaque.

### Embarcações

- PNG 612×408, fundo transparente real, embarcação inteira sem cortes.
- Vista lateral em três quartos, proa apontando para a direita, linha d'água consistente.
- Pintura digital realista, metal naval envelhecido, leitura clara em tamanho pequeno.
- Luz lateral fria com recorte âmbar discreto, compatível com a interface atual.
- Sem oceano, fumaça extensa, texto, bandeira, tripulação visível, marca d'água ou colagem.

## Prompt — pacote de avatares britânicos

> Crie uma série consistente de três retratos individuais para um jogo premium de simulação naval da Segunda Guerra Mundial. Royal Navy britânica, 1940–1944, pintura digital realista e cinematográfica, personagem da cintura para cima, câmera frontal levemente em três quartos, expressão séria e competente, iluminação azul-petróleo de sala de comando com recorte âmbar, roupa e equipamento historicamente plausíveis, fundo totalmente transparente, sem texto, sem moldura, sem logotipo, sem marca d'água, sem símbolos políticos. Gere cada personagem como arquivo PNG separado em 408×612, mantendo exatamente a mesma escala e direção de luz: 1) imediato/oficial de convés experiente; 2) chefe de máquinas com roupa de trabalho naval e sinais discretos de graxa; 3) operador de sonar/hidrofone com fones de época. Não criar colagem.

Nomes sugeridos:

- `assets/avatars/uk/officer_01.png`
- `assets/avatars/uk/mechanic_01.png`
- `assets/avatars/uk/sonar_01.png`

## Prompt — pacote de avatares norte-americanos

> Crie uma série consistente de três retratos individuais para um jogo premium de simulação naval da Segunda Guerra Mundial. US Navy submarina no Pacífico, 1942–1945, pintura digital realista e cinematográfica, personagem da cintura para cima, câmera frontal levemente em três quartos, expressão séria e competente, iluminação azul-petróleo de compartimento interno com recorte âmbar, uniformes e equipamento historicamente plausíveis, fundo totalmente transparente, sem texto, sem moldura, sem logotipo, sem marca d'água. Gere cada personagem como arquivo PNG separado em 408×612, mantendo exatamente a mesma escala e direção de luz: 1) oficial executivo/imediato; 2) chefe de máquinas com roupa de trabalho naval; 3) operador de sonar com fones de época. Não criar colagem.

Nomes sugeridos:

- `assets/avatars/us/officer_01.png`
- `assets/avatars/us/mechanic_01.png`
- `assets/avatars/us/sonar_01.png`

## Prompt — submarinos alemães

> Gere cinco imagens individuais e historicamente diferenciadas de submarinos alemães da Segunda Guerra Mundial para um jogo premium: Type VIIA, Type VIIC, Type IIB costeiro, Type IXC de longo alcance e Type XXI Elektroboot. Uma embarcação por arquivo, PNG 612×408 com fundo transparente real, casco inteiro sem cortes, vista lateral em três quartos, proa para a direita, linha d'água e escala visual idênticas entre os arquivos, pintura digital realista, aço naval envelhecido, iluminação fria azul-petróleo com recorte âmbar sutil. Mostrar diferenças corretas de comprimento, torre, convés e perfil do casco. Sem oceano, sem texto, sem bandeiras, sem símbolos extremistas, sem marca d'água e sem colagem.

Nomes sugeridos: `de_type_viia.png`, `de_type_viic.png`, `de_type_iib.png`, `de_type_ixc.png`, `de_type_xxi.png`.

## Prompt — submarinos britânicos

> Gere cinco imagens individuais e historicamente diferenciadas de submarinos britânicos da Segunda Guerra Mundial para um jogo premium: T-class inicial, U-class, S-class, T-class veterano com modernizações discretas e Amphion-class do fim da guerra. Uma embarcação por arquivo, PNG 612×408 com fundo transparente real, casco inteiro sem cortes, vista lateral em três quartos, proa para a direita, linha d'água e escala visual idênticas entre os arquivos, pintura digital realista, aço naval envelhecido, iluminação fria azul-petróleo com recorte âmbar sutil. Mostrar diferenças corretas de casco, torre e armamento externo. Sem oceano, sem texto, sem bandeiras, sem marca d'água e sem colagem.

Nomes sugeridos: `uk_t_class_early.png`, `uk_u_class.png`, `uk_s_class.png`, `uk_t_class_veteran.png`, `uk_amphion.png`.

## Prompt — submarinos norte-americanos

> Gere cinco imagens individuais e historicamente diferenciadas de submarinos norte-americanos da Segunda Guerra Mundial para um jogo premium: Sargo-class, Gato-class inicial, Gato-class veterano com alterações de guerra, Balao-class e Tench-class. Uma embarcação por arquivo, PNG 612×408 com fundo transparente real, casco inteiro sem cortes, vista lateral em três quartos, proa para a direita, linha d'água e escala visual idênticas entre os arquivos, pintura digital realista, aço naval envelhecido do teatro do Pacífico, iluminação fria azul-petróleo com recorte âmbar sutil. Mostrar diferenças corretas de torre, convés e perfil do casco. Sem oceano, sem texto, sem bandeiras, sem marca d'água e sem colagem.

Nomes sugeridos: `us_sargo.png`, `us_gato_early.png`, `us_gato_veteran.png`, `us_balao.png`, `us_tench.png`.

## Prompt opcional — variedade de comboios e escoltas

> Crie seis embarcações individuais para ampliar a variedade visual de um simulador naval da Segunda Guerra Mundial: corveta de escolta, fragata ASW, contratorpedeiro tardio, cargueiro Liberty, petroleiro oceânico e transporte de tropas. PNG 612×408, fundo transparente real, embarcação inteira, mesma vista lateral em três quartos com proa para a direita, mesma escala e linha d'água, pintura digital realista, iluminação azul-petróleo com recorte âmbar, diferenças de silhueta legíveis no mobile. Sem oceano, sem texto, sem bandeiras, sem marca d'água e sem colagem.

## Antes de integrar

Confirme transparência, dimensões, consistência de direção da proa e legibilidade a 160 px de largura. Guarde os originais em alta resolução e exporte as versões do jogo nos tamanhos acima. Ao receber os arquivos, será necessário atualizar `data/crew.json`, `data/submarines.json` e o cache do service worker.
