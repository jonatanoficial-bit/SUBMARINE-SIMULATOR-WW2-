# Pacote futuro de áudio e vozes humanas

A versão 2.2.0 funciona sem internet usando síntese de voz e efeitos Web Audio. Para uma futura versão APK ainda mais cinematográfica, estes prompts podem ser usados em uma IA de voz/áudio. Não substitua personagens ou embarcações existentes.

## Especificação geral

- Exportar cada fala separadamente em WAV, mono, 48 kHz, 24-bit, sem música e sem reverberação.
- Vozes em português do Brasil, naturais, contidas e profissionais; atmosfera de submarino militar da Segunda Guerra.
- Evitar interpretação teatral exagerada e qualquer imitação de pessoa real.
- Manter ruído de fundo separado das falas para permitir mixagem dinâmica no jogo.

## Voz — oficial de armas

> Voz masculina adulta, firme, disciplinada e urgente sem gritar, português brasileiro neutro. Grave cada frase como um arquivo separado: “Torpedo na água. Cronometrando corrida.”; “Impacto confirmado, comandante. O alvo está afundando.”; “Impacto confirmado na escolta. Contratorpedeiro neutralizado.”; “Torpedo passou ao largo. Recomendo corrigir a solução.”; “Falha de espoleta. O torpedo atingiu o alvo, mas não detonou.”; “Profundidade de corrida incorreta. O torpedo passou sob o casco.”; “Detonação prematura. O inimigo foi alertado.”

## Voz — sonarista

> Voz masculina adulta, concentrada, volume baixo de sala de sonar, português brasileiro neutro. Frases separadas: “Contato firme, marcação zero nove seis.”; “Ruído de hélice, três pás. Provável mercante.”; “Hélices rápidas aproximando. Provável escolta.”; “Explosão submarina confirmada.”; “Casco inimigo rompendo. Ruídos de afundamento.”

## Voz — imediato e chefe de máquinas

> Duas vozes masculinas claramente diferentes. O imediato é calmo e autoritário; o chefe de máquinas é rouco, técnico e objetivo. Frases separadas: “Equipe de evasão pronta. Aguardando sua ordem.”; “Evasão autorizada. Profundidade e rumo sob meu comando.”; “Avaria na casa de máquinas. Podemos reparar manualmente ou enviar a equipe de emergência.”; “Reparo de emergência autorizado.”; “Propulsão restabelecida.”

## Efeitos navais

> Criar arquivos separados, realistas e sem música: hélice de mercante distante em loop perfeito de 20 segundos; hélice de contratorpedeiro rápida em loop perfeito de 20 segundos; torpedo submerso em aproximação de 8 segundos; impacto de torpedo contra casco metálico com explosão submarina; casco de navio rompendo e afundando por 12 segundos; torpedo errando com passagem submersa e splash distante; sonar passivo com ruído oceânico em loop perfeito de 30 segundos; estática curta de rádio militar. Sem vozes, sem clipping, pico máximo em -3 dBFS.

## Nomes sugeridos

Use nomes simples, por exemplo `ptbr_weapons_hit_merchant.wav`, `ptbr_sonar_three_blades.wav`, `sfx_ship_sinking_12s.wav` e `amb_merchant_propeller_loop.wav`.
