# Arquitetura dos sensores v1 — Fase 7

## Objetivo

A Fase 7 transforma hidrofone, sonar ativo, radar e periscópio em subsistemas determinísticos do motor. A interface apenas envia comandos e apresenta o snapshot; alcance, incerteza, classificação, exposição e persistência pertencem a `SensorSystem`.

## Fontes de detecção

### Hidrofone passivo

- Opera submerso sem emitir energia.
- Sofre degradação pelo ruído próprio, cavitação e avarias do sonar.
- Entrega marcação estimada, intensidade e confiança.
- A distância permanece incerta até confiança suficiente ou confirmação por outro sensor.

### Sonar ativo

- Produz marcação e distância de alta precisão.
- Possui recarga determinística.
- Gera evento de exposição, aumentando o risco de detecção pelo inimigo.
- É bloqueado quando o sistema sonar está inoperante.

### Radar

- Disponibilidade depende da nação e do ano da missão.
- Exige mastro elevado e profundidade compatível.
- O mastro é recolhido automaticamente ao mergulhar além do limite.
- A operação aumenta a assinatura do submarino.

### Periscópio

- Somente opera na profundidade permitida.
- Confirma contatos dentro do campo visual.
- Aumenta confiança, precisão e classificação.
- A trava de torpedo exige contato visual válido e confiança mínima.

## Modelo de contato

Cada contato armazena:

- identidade interna e função (`target` ou `escort`);
- tipo provável;
- detectado ou perdido;
- marcação e incerteza angular;
- distância estimada e incerteza;
- confiança de 0 a 100;
- intensidade do sinal;
- classificação;
- fonte da última solução;
- idade da solução e estado obsoleto.

As soluções envelhecem quando não são atualizadas. Um contato não desaparece instantaneamente: sua confiança diminui e a marcação passa a representar uma estimativa antiga.

## Determinismo

O sistema utiliza o tempo fixo do `SimulationEngine`. Pequenas imprecisões são produzidas por offsets determinísticos derivados do ciclo do mundo, permitindo repetir testes e reproduzir uma operação salva.

## Snapshot e autosave

O bloco `sensors` usa `sensorVersion: 1` e é armazenado dentro do snapshot v4. O autosave conserva:

- modo selecionado;
- direção do hidrofone;
- estado do mastro de radar;
- recargas e animações operacionais;
- perfil histórico do equipamento;
- todos os contatos e suas soluções.

## Regras de extensão

1. Nenhum cálculo de sensor deve ser colocado no DOM.
2. Novos sensores devem publicar estado serializável.
3. Toda emissão que revele o submarino deve gerar evento de exposição.
4. Mudanças no formato exigem incremento de `sensorVersion` e migração.
5. A interface não pode inventar distância, confiança ou classificação.
