# CyberSimpatia

Instrumento de escuta. Não é uma coleção de três minijogos e não tem vitória.

O gesto entra, um filtro o traduz, um mediador o atrasa ou recusa, e o campo responde. O jogador não controla um objeto: observa a relação entre o que fez e o que o sistema entendeu. Essa observação da observação é a cibernética de segunda ordem do projeto. A lógica é triádica — ação, mediação, ressonância — e não binária. Não existe `score`, `victory` nem `game over`.

Este repositório é a realização no navegador do documento de definição 2.0. O contrato epistemológico (sinais, schema, três circuitos, léxico, espelho) está preservado. O motor não é Godot 4.6: os passes de compute viraram um solver de fluido na CPU, e o `AudioStreamGenerator` virou síntese granular em Web Audio. Onde o documento pedia um shader, o código desenha em Canvas 2D com a mesma paleta e as mesmas marcas.

---

## Como se usa

Há três telas e um único gesto que importa.

1. **Sintonizar.** A primeira tela só abre o áudio. O navegador exige um gesto do usuário antes de deixar o som sair.
2. **Escolher um circuito** no atlas: vórtice laminar, rizoma ou nó tensegrity. O observador é o quarto lugar, e não se toca.
3. **Arrastar** o dedo ou o ponteiro sobre o campo. O quadrado é o gesto cru. O anel é o filtro. A marca triádica é o mediador. O campo nunca copia a mão.

O que cada controle faz:

| Gesto | Efeito |
|---|---|
| Arrastar no vórtice | O mediador gira o erro entre a velocidade do gesto e a do fluido, e só então empurra. O rastro de densidade mostra onde a escuta passou. |
| Arrastar no rizoma | O gesto é uma pergunta de nutriente. A célula aceita só uma fração, a porosidade. Se a ocupação está alta, o campo recusa. |
| Arrastar no nó | O gesto é vento sobre os seis nós, não uma pinça. Cabos cedem e o pré-esforço puxa de volta. |
| Espelho | O mediador passa a usar a posição atrasada (0,5 s a 2 s), com um tremor senoidal pequeno. O circuito conversa com um gesto que a mão já deixou. |
| Atraso triádico | O controle na leitura. Só vale com o espelho ligado. |
| Lentes do rizoma | Fluxo nutricional, tensão SDF ou sincronia temporal. Mudam o que se desenha, não um placar. |
| Silêncio | Corta o ganho mestre. O circuito continua. |
| PNG / JSON | Exporta o campo com um rodapé de leitura, ou o perfil persistido. |
| `1` `2` `3` `4` | Vórtice, rizoma, nó, observador. |
| `M` | Liga e desliga o espelho. |

No celular, os quatro ícones de baixo trocam de circuito. **Leitura** abre métricas, léxico, atraso e exportação. O cartão «Arraste sobre o campo» some depois do primeiro gesto real. No observador ele fica, porque ali não há o que arrastar.

Não há acerto. Uma sessão boa é aquela em que fase, homeodinâmica e complexidade andam juntas — isso é a profundidade. Um eixo no máximo, sozinho, não aprofunda.

---

## O que o instrumento se recusa a ser

Cinco regras, as mesmas do documento de definição. Um patch que as quebra não é uma otimização.

1. **Nenhuma métrica binária.** Os números são `resonance`, `phaseOffset`, `tension`, `harmony`, `complexity`, `porosity`, `homeodynamic` e `resonance_depth`. Homeodinâmica é um regime (vivo e coerente), não um desenlace.
2. **O terceiro é jogável.** Mediação não é texto de tutorial. É o `MediatorProbe` do vórtice, a espécie que sincroniza fase no rizoma, o vento atrasado no nó, e o modo espelho.
3. **Desacoplamento.** Circuitos não leem o ponteiro do DOM e não chamam uns aos outros. Assinam o `EventBus`. O React só fala com o `Runtime`.
4. **Segunda ordem.** O campo desenha gesto, filtro e mediador ao mesmo tempo, e o painel plota os três traços. O sistema mostra como está interpretando.
5. **Performance como ética.** O passo de simulação é fixo em 60 Hz, no máximo três subpassos por quadro. Se o quadro médio passa de 30 ms, o vórtice desliga o confinamento de vorticidade e o HUD marca o ritmo como `contido`.

---

## Os quatro lugares

### 01 — Vórtice laminar

`src/lib/cybersimpatia/modules/laminar.ts`

Um fluido de Jos Stam numa grelha de 96×54, em arrays tipados, sem alocar no passo quente. A cada tick: advecção, projeção de pressão (Jacobi, 16 iterações em ritmo pleno e 8 em ritmo contido), campo de rotacional, confinamento, advecção da densidade e do cisalhamento.

O ponteiro não injeta força. O probe persegue a posição filtrada com um atraso exponencial. O erro entre a velocidade desejada e a velocidade local do fluido é **rodado** por um ângulo que oscila — esse giro é o terceiro. Só o vetor rodado entra no `splat`. Se o vórtice amansa (velocidade média abaixo de 8), um sopro de manutenção o mantém vivo, para que o silêncio do usuário não seja confundido com um campo morto.

A ressonância é a melhor correlação cruzada, numa janela de 48 amostras, entre a velocidade pedida e a velocidade local, varrendo atrasos. Gesto quase parado (`energy < 8`) não pode farmar ressonância: o alvo é atenuado a 15%. Homeodinâmica pede ressonância acima de 0,64 e tensão entre 0,08 e 0,62, sustentada por mais de 1,2 s. Aí o barramento emite `resonance_event`.

Marcas semióticas (espiral, linha portante, tríade oca) nascem nos pontos de rotacional alto. São leitura, não coleta.

### 02 — Rizoma

`src/lib/cybersimpatia/modules/rhizoma.ts`

64 agentes em quatro espécies, 380 ramos no máximo, campo de nutriente 36×20.

| Espécie | O que faz |
|---|---|
| 0 | Sobe o gradiente e consome nutriente. |
| 1 | Gasta energia para crescer um ramo. Se a ocupação da célula passa de 0,85, recusa e esfria. |
| 2 | Procura outro agente, aproxima a fase e pode gravar um nó de memória dialógica. |
| 3 | Lê a mesma memória com o sinal invertido. Atrai onde os outros repelem. |

O gesto não planta. `deposit` só corre com ponteiro e velocidade acima de 0,04, e a quantidade é `velocidade × porosidade`. Porosidade é `1 − ocupação`. Recusar parte da pergunta é relação, e o texto de leitura diz isso.

Homeodinâmica aqui é acordo temporário: coerência de fase acima de 0,72, pelo menos quatro agentes em sincronia, porosidade entre 0,22 e 0,88, e ao menos dois elos. Não é colheita.

Memórias de sessões anteriores são semeadas de novo quando o circuito abre (`seedMemory`). O rizoma de hoje ainda é puxado pelo que foi negociado antes, neste aparelho.

As três lentes redesenham o mesmo estado: fluxo (nutriente), tensão (ocupação como um campo de distância) e sincronia (fase dos agentes).

### 03 — Nó tensegrity

`src/lib/cybersimpatia/modules/tensegrity.ts`

Seis nós, doze membros, uns cabos e outros barras. Cada membro tem um comprimento de repouso `rest0` (o pré-esforço) e um `rest` que cede com a deformação e é puxado de volta. Isso é o `TensionAgent`: a forma não trava e não desata.

O gesto soma vento nos nós, com queda gaussiana a partir da posição mediada. O centro de massa é ancorado, para o nó respirar sem sair do quadro.

Homeodinâmica não é «nó desfeito». A energia potencial entra num histórico de 120 amostras. A cada quatro ticks o circuito mede a autocorrelação e procura o atraso que melhor se repete. O regime pede coerência acima de 0,55, variância de energia pequena mas não nula, e tensão entre 0,06 e 0,55. Tensão alta demais é travamento. Tensão nula é um nó que deixou de ser nó.

### — Observador

`src/lib/cybersimpatia/modules/observer.ts`

Não simula. Desenha `phase_alignment_history` como uma espiral: o raio é a ressonância da amostra, a cor é o circuito que a produziu, e o tempo só faz a figura girar devagar. O texto muda com a profundidade acumulada e com o quanto do tempo foi passado no espelho.

Enquanto o observador está aberto, o áudio não segue um relatório de circuito. O motor apenas assenta tensão e harmonia (`AudioEngine.settle`).

---

## Arquitetura

```text
ponteiro do DOM
    → Runtime.point
        → InputFilter          Kalman + linha de atraso
            → EventBus.filtered_input
                → LaminarCircuit | RhizomaCircuit | TensegrityCircuit
                    → sympathy_state_changed
                    → circuit_report
                    → resonance_event
                    → dialogic_memory_recorded
                        → StateManager        perfil, léxico, profundidade
                        → AudioEngine         drone + grão
    → Runtime.snapshot → React (HUD, 8 Hz)
    → Canvas 2D        o circuito ativo desenha o próprio quadro
```

O React em `src/components/cyber-simpatia.tsx` é casca: portão, atlas, trilho, painel. Não contém física. Um `Runtime` vive num `ref` e é destruído no unmount. O HUD amostra `snapshot()` a cada 120 ms para não redesenhar o DOM a 60 Hz.

O laço (`Runtime.frame`) faz, nesta ordem: medir o quadro, decidir o ritmo, avançar o filtro, avançar o relógio do perfil, dar até três passos de 1/60 s ao circuito ativo, desenhar.

### EventBus

`src/lib/cybersimpatia/event-bus.ts`

Não há `emit` genérico. Cada sinal tem a sua lista e a sua assinatura. `lastInput` e `lastReport` são retenção do próprio barramento: o sinal `filtered_input` carrega só velocidade, aceleração e atraso, e o circuito lê a amostra completa em `bus.lastInput` no mesmo turno.

| Sinal | Payload | Quem escuta |
|---|---|---|
| `filtered_input` | `velocity`, `acceleration`, `mirrorLag` | os três circuitos |
| `sympathy_state_changed` | módulo, ressonância, fase | `StateManager` (histórico de fase) |
| `circuit_report` | `CircuitReport` | `StateManager`, `AudioEngine` |
| `resonance_event` | módulo, duração, flag homeodinâmica | `StateManager` (no máximo 40 eventos) |
| `mirror_mode_toggled` | ligado ou não | `StateManager` |
| `lexicon_unlocked` | id do símbolo, clareza | `Runtime` (nota no HUD) |
| `dialogic_memory_recorded` | `DialogicNode` | `StateManager` (no máximo 48 nós) |

`counts()` existe para um teste poder afirmar que os sinais têm assinantes. Um sinal sem ouvinte é um bug de arquitetura, não uma otimização.

### InputFilter

`src/lib/cybersimpatia/input-filter.ts`

Kalman 1D em cada eixo (`q = 0.02`, `r = 0.08`). A posição filtrada vira velocidade e aceleração. Um anel de 480 amostras guarda a história. Com o espelho desligado, a posição que os circuitos recebem é a filtrada e `mirrorLag` é 0. Com o espelho ligado e história suficiente, a posição é a amostra atrasada mais um tremor pequeno, proporcional ao atraso. O atraso pedido é limitado a 0,5–2 s e nunca excede o que a história realmente cobre.

Os três traços do painel (gesto, filtro, espelho) são a última volta desse anel, copiada para o HUD. São a segunda ordem em forma de gráfico.

### StateManager e o schema 2.0

`src/lib/cybersimpatia/schema.ts`, `src/lib/cybersimpatia/state-manager.ts`

O perfil vive em `localStorage` na chave `cybersimpatia.profile.v2`. Não há conta nem base de dados no instrumento: a escuta é deste aparelho. `migrateProfile` aceita um documento antigo com `avg_sympathy` e o reduz a profundidade mais léxico, em vez de misturar formatos.

Campos que importam:

- `resonance_depth` — não é média de ressonância. Ver a fórmula abaixo.
- `phase_alignment_history` — no máximo 180 amostras. É o que o observador desenha.
- `lexicon_progress` — clareza de `flow`, `tension`, `mediation`, cada uma em 0–1.
- `mirror_usage_ratio` — fração do tempo com o espelho ligado.
- `dialogic_memory` — nós `{x, y, polarity, strength, session}`.
- `resonance_events` — episódios em que um circuito sustentou homeodinâmica.
- `sessions` — no máximo 24. O observador não abre sessão.

A profundidade é calculada numa janela deslizante de 10 s:

```text
a = clamp(variância de fase / 0,08)
b = fração dos relatórios em homeodinâmica
c = complexidade média
média = (a + b + c) / 3
equilíbrio = 1 − min(1, desvio × 2,2)
profundidade = média × (0,45 + 0,55 × equilíbrio)
```

Um único eixo saturado produz equilíbrio baixo e a profundidade cai. A implementação suaviza o valor anterior com 0,35 do novo, para o número não piscar. O flush para `localStorage` é adiado por um timer. O passo de simulação não escreve disco.

O léxico cresce devagar e por circuito: o vórtice alimenta fluxo pela ressonância, o nó alimenta tensão sobretudo quando está homeodinâmico, o rizoma alimenta mediação pela porosidade. O espelho, com ressonância no meio da escala (0,22–0,90), também cresce mediação. Cruzar 0,25, 0,50, 0,75 ou 1,00 emite `lexicon_unlocked`. Não é uma conquista. É o símbolo ficando legível.

Os três símbolos estão em `src/lib/cybersimpatia/data/earthscore_lexicon.json`:

- **Espiral de cisalhamento** — como o gesto e o campo se enrolam sem coincidir.
- **Linha portante** — esforço que segura a forma sem travá-la.
- **Tríade oca** — o terceiro que atrasa, traduz e devolve.

A tradição declarada no arquivo é uma notação própria, em dívida com Peirce e com a ideia de Earthscore de Paul Ryan: signos que se treinam.

### Áudio

`src/lib/cybersimpatia/audio-engine.ts`

Dois osciladores contínuos (seno e triângulo), um ruído browniano filtrado, e grãos de 4096 amostras com janela de Hanning de 512. Ganhos só mudam por `setTargetAtTime`, para não estalar.

A tensão do relatório mapeia a fundamental de 55 Hz para cima (`55 × 2^(tensão × 3,1)`). Harmonia alta trava o parcial num inteiro e quantiza o grão; harmonia baixa abre um intervalo inarmônico e sobe o ruído. A frequência do grão vai de 60 Hz a 2000 Hz com a tensão. No máximo oito vozes. O observador não dispara grãos novos: o drone assenta.

O som só existe depois de **Sintonizar**, porque `AudioContext` nasce suspenso.

---

## Mapa do código que é o instrumento

```text
src/components/cyber-simpatia.tsx    casca: portão, atlas, circuito, painel
src/routes/index.tsx                 a rota "/" monta a casca
src/styles.css                       tokens @theme
src/lib/cybersimpatia/
  runtime.ts                         laço, snapshot, exportação
  event-bus.ts                       os sete sinais
  input-filter.ts                    Kalman + espelho
  state-manager.ts                   perfil e léxico
  schema.ts                          versão 2.0, migração, profundidade
  audio-engine.ts                    drone e grão
  math.ts                            clamp, lerp, smoothstep, expSmooth
  palette.ts                         as mesmas cores do CSS, para o canvas
  marks.ts                           espiral, linha portante, tríade, segunda ordem
  modules/laminar.ts
  modules/rhizoma.ts
  modules/tensegrity.ts
  modules/observer.ts
  data/earthscore_lexicon.json
  data/resonance_schema.json         o documento do perfil, com uma nota
  core.test.ts                       profundidade, migração, fluido estável, espelho
```

O resto de `src/lib` (`auth`, `db`, `app-data`, `multiplayer`) é andaime da plataforma e **não participa da escuta**. Não ligar o instrumento a isso sem uma razão nova: o perfil é local de propósito.

---

## Cor, tipo, tom

Tokens em `src/styles.css` e, de novo, em `palette.ts`. O canvas não lê classes Tailwind, então as duas listas têm de andar juntas.

| Token | Hex | Uso |
|---|---|---|
| ink | `#07090c` | fundo |
| panel | `#12171c` | leitura |
| line | `#2c3834` | fios |
| bone | `#e7e2d4` | texto e filtro |
| mute | `#8d968c` | gesto cru, texto secundário |
| flow | `#3dcaa8` | fluido, homeodinâmica |
| tension | `#e4a15a` | cisalhamento, cabo sob esforço |
| mediate | `#d4c4a8` | o terceiro |

Fraunces para o nome e os títulos. IBM Plex Mono para leitura, números e teclas. A interface fala português. Não há placar, estrela, confete nem «você venceu».

---

## Correr e verificar

Requisitos: Node 22 e npm. Na raiz:

```bash
npm install
npm run dev
```

O servidor de desenvolvimento escuta em `0.0.0.0:8080`.

```bash
npm run typecheck
npm test
npm run build
```

`npm test` inclui `src/lib/cybersimpatia/core.test.ts`. Os testes que importam para o instrumento:

- profundidade zero no silêncio, 1 só com os três eixos cheios, e um eixo saturado sozinho vale menos que um trio equilibrado;
- migração de um perfil pré-2.0;
- o fluido do vórtice continua finito depois de muitos passos;
- o espelho atrasa de fato a posição entregue aos circuitos.

Não há suíte de ponta a ponta do gesto. A verificação manual é: sintonizar, abrir o vórtice, arrastar, ver o quadrado, o anel e o mediador separados, ouvir o grão mudar com a tensão, ligar o espelho e ver o traço âmbar descolar do gesto.

---

## O que este código é, em relação ao documento Godot

O documento 2.0 pedia Godot 4.6, GDScript, compute shaders e `AudioStreamGenerator`. Este repositório entrega o mesmo circuito num navegador, porque é aqui que o instrumento é usado.

| No documento | Aqui |
|---|---|
| Autoload `EventBus` | classe `EventBus`, os mesmos nomes de sinal |
| `StateManager` schema v2 | `schema.ts` + `localStorage` |
| `InputFilter` com Kalman e `MirrorMode` | `input-filter.ts` |
| Passes compute do fluido | solver Stam na CPU, 96×54 |
| `AudioStreamGenerator` | `AudioBuffer` com janela de Hanning + osciladores |
| `MediatorProbe` | probe que gira o erro antes do `splat` |
| `DialogicMemory` | nós persistidos e ressemeados no rizoma |
| `HarmonicTopology` | autocorrelação da energia do nó |
| Dashboard / `TriadicMeter` | painel React, três arcos, traço de segunda ordem |

O que não foi trazido, de propósito: cenas `.tscn`, shaders `.gdshader`, e qualquer condição de vitória. Se um contributo precisar de Godot de novo, que seja outro runtime por cima destes contratos — não uma segunda física ao lado.

---

## Ao mudar alguma coisa

Antes de fundir, a pergunta do documento ainda serve: *isto fortalece o circuito triádico ou reforça a lógica binária?*

Em concreto:

- Um circuito novo assina o barramento. Não importa o filtro nem o perfil.
- Um número novo não é um placar. Se ele sobe quando o jogador «acerta», está errado.
- O passo quente dos circuitos não aloca e não escreve `localStorage`.
- Paleta nova entra no `@theme` e em `palette.ts` ao mesmo tempo.
- Texto de interface fica em português, no tom do que já está escrito: descrever a escuta, não instruir uma manobra de jogo.
- Sinal novo ganha método próprio no `EventBus` e um assinante no mesmo patch. Sinal sem ouvinte não entra.

Documento vivo. O código é a versão que corre.
