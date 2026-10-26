# SB4 — mecânicas pendentes de confronto com ROM

Auditoria estática de 26/10/2026, no root `D:\Programação\Jogos\New folder\bombtop`, HEAD consultado `01b77bb3f09f7d756c15326f46970b9bb93b7e15`. O conteúdo lido inclui trabalho local não commitado, inclusive os seis arquivos auditados. Este documento registra hipóteses e regras implementadas; **não estabelece nenhuma nova comprovação ROM/REA**. Nenhuma ferramenta REA, emulador, browser ou fonte externa foi usada. A execução ROMREA/MCP SNES permanece com o coordenador.

Escopo principal: `packages/shared/src/stage-mechanics.ts`, `stage-transport.ts`, `stage-slots.ts`, `stage-surprise.ts`, `stage-state.ts` e `sb4-layouts.ts`. Foram lidos consumidores relevantes e testes locais para distinguir implementação de evidência. Os caminhos abaixo são relativos ao root.

## Como fechar cada pendência

- [ ] Identificar ROM/revisão/hash, região, modo/grupo/mapa, opções, número de jogadores, personagens e estado inicial reproduzível.
- [ ] Registrar sequência de inputs e frames de início/fim, posições antes/depois, resultado e referência ao artefato bruto do coordenador. Separar observação visual, medição de execução e extração REA; registrar endereço/rotina e interpretação quando houver extração.
- [ ] Repetir com controles negativos e variação de jogador/direção/posição. Para aleatoriedade, registrar amostra e condições; uma ocorrência não demonstra distribuição ou tabela completa.
- [ ] Comparar a regra observada com a implementação e só então propor regressão automatizada. Não converter ticks locais em frames SNES por suposição: a simulação local usa 60 ticks/s, mas isso não mede a ROM.
- [ ] Manter como pendente qualquer propriedade não coberta pelo experimento. Concluir uma regra não fecha automaticamente o mapa inteiro.

O `SB4_STAGE_SOURCE` em `sb4-stage-definitions.ts` se identifica como `player-observation` e aponta para uma página comunitária. `kind: "documented"`, `knownTotal`, comentários de capturas e testes de repetibilidade não são extração ROM. Este relatório não usa essa página como prova. A auditoria documental de itens em `docs/SB4-COMPARACAO-ITENS.md` é um contexto separado, sem medição ROM nesta tarefa.

## Pendências comuns de layout e estado

Implementado em `sb4-layouts.ts::buildSb4Layout`: arena 15×13, interior 13×11, bordas sólidas, matrizes fixas de blocos/pisos, `warps: []`; toda feature de piso entra em `keepClear`. O comentário do arquivo admite células ocultas e caminhos inferidos, reconstrução por capturas e ausência de prova do RNG original. Coordenadas deste documento são índices da grade com borda, origem `(0,0)` no canto superior esquerdo.

- [ ] Confrontar colisão, piso e bloco de cada célula dos 12 mapas, incluindo áreas sob arte elevada/folhagem e posições liberadas para objetos. Não usar a aparência do tile como medida de colisão.
- [ ] Reiniciar partidas/rodadas sob condições controladas para distinguir layout fixo, variantes e sorteio de blocos/itens. Validar também spawns, orientação e opções que mudam distribuição.
- [ ] Verificar propagação de chama por abismo, trilho, pivô, botão, folhagem e poste; passagem de jogadores, bombas e itens em cada superfície.
- [ ] Confrontar prioridades no mesmo frame: input → movimento/pisos → mecânicas → bombas → pressão → hazards é a ordem local em `step.ts`. Observar contatos simultâneos e empate, sem pressupor essa ordem na ROM.

`stage-state.ts` modela bolas, flags, roleta, gangorras, trolley, fantasias, voos e locks numéricos. Não contém referências de evidência, estados detalhados de embarque/desembarque ou um resultado próprio DangerousBomb. `winnerId` é apenas um campo opcional nesse contrato, não prova uma condição de vitória. Os valores de `floorLocks` misturam índice de piso, prazo, direção e último tick sob chaves distintas: são mecanismo local, não flags extraídas da ROM.

## Checklist por mapa

### 01 — Usual (`sb4-01`)

Implementado: matriz `USUAL`, compartilhada com 02; comentário atribui 80 blocos à disposição observada. Não há ramo dinâmico exclusivo de 01 nos arquivos de mecânicas.

- [ ] Mapear grade inicial completa, spawns e casas vazias; repetir rodadas para verificar se a matriz é realmente fixa.
- [ ] Medir distribuição/quantidade de itens e blocos com as opções da ROM registradas; não tratar os totais comunitários do catálogo como extração.
- [ ] Usar como controle de velocidade, pavio e duração de fogo para os demais mapas, com os mesmos upgrades.

### 02 — Fast 'n Slow (`sb4-02`)

Implementado em `stage.ts::advanceStageTempo`: a cada `14 * TICK_RATE`, sorteia um dos valores `0.5`, `1`, `2`, excluindo o atual. `stageTempoRate` escala movimento; `stageFuseTicks` escala pavio e TTL de chama, com decremento alternado em ticks pares no lento. Isso não significa que todos os relógios do jogo mudem juntos.

- [ ] Medir primeiro disparo, intervalo e sequência das mudanças; verificar se existe anúncio, transição ou repetição do mesmo ritmo.
- [ ] Medir separadamente deslocamento, pavio, fogo, bombas chutadas/aéreas, montarias e cronômetro de rodada antes/depois da mudança.
- [ ] Validar se o layout é idêntico ao 01 e se mudanças são globais ou condicionais.

### 03 — Rolling Sugedama (`sb4-03`)

Implementado em `stage-mechanics.ts::stageFlame/updateBalls` e `stage-obstacles.ts`: duas bolas em `(5,5)` e `(9,7)`, paradas; chama direcional inicia movimento somente se paradas e é bloqueada pela bola. Velocidade `TILE/8` por tick; para diante de tile não vazio ou outra bola, verificado no centro. Contato com bomba zera pavio. Jogador próximo em ambos os eixos a menos de meio tile morre diretamente, salvo elevação/salto; não passa por `hurt`. Bola bloqueia andar/colocar bomba.

- [ ] Confirmar posições, tamanho de colisão, quantidade e estado inicial; medir velocidade e ponto exato de parada.
- [ ] Atingir de quatro lados, simultaneamente e enquanto já rola; observar mudança de direção, propriedade e eventual ricochete.
- [ ] Testar bola contra bola, bloco, parede, bomba, item e chama; verificar se fogo é absorvido inclusive para tipos especiais de bomba.
- [ ] Testar atropelamento com montaria/proteção e salto; distinguir morte direta, dano e empurrão.

### 04 — Push and Fall (`sb4-04`)

Implementado em `updateStageMechanics` e `bombs.ts::updateBombs`: jogador no piso `Pit` morre diretamente, sem consumir proteção; salto, carry/throw e voo de gangorra escapam dessa verificação. Bomba de chão em abismo é removida sem explosão; aérea/carregada é preservada enquanto nesse estado. O contorno dos abismos é reconstruído.

- [ ] Mapear bordas exatas e medir limiar de queda por posição sub-tile; comparar caminhar, Push, chute e lançamento.
- [ ] Medir queda/animação e momento de eliminação com proteções e montarias que existam na ROM.
- [ ] Testar bomba parada, chutada, lançada e carregada sobre o buraco, incluindo pavio vencendo no frame de queda e itens sobre o piso.
- [ ] Observar fogo atravessando o vão e jogadores cruzando em salto/lançamento; registrar onde aterrissam.

### 05 — Numb Bomb (`sb4-05`)

Implementado: sem blocos no layout; `arena.ts` inicia capacidade 5, alcance 6, velocidade `MAX_SPEED`, Kick/Punch/Push/Glove e sem saco inicial de itens. `updateStageMechanics` trata pressionar para fora estando na primeira/última linha/coluna interna como tocar corda e impõe `stun >= 20`; não há impulso de rebote nessa função.

- [ ] Inventariar equipamento inicial e itens disponíveis, sem inferir valores pelo nome do mapa.
- [ ] Encostar na borda com/sem input externo e em diferentes offsets; medir stun, recuo, repetição por manter direção e interação com bombas/Push.
- [ ] Confirmar quais entidades ativam a corda e se o efeito afeta somente quem tocou ou outros jogadores.

### 06 — Surprise Floor (`sb4-06`)

Implementado em `stage-surprise.ts`: nove painéis explícitos no layout; estado ausente equivale a normal. Cada chamada de ignição pode escolher uniformemente um dos outros três estados (`normal/ice/sticky/reverse`), no máximo uma mudança por célula por tick. Isso **não prova mudança a cada frame de uma chama persistente**: conferir o disparo via `stageFlame`/`addFlame`, que ocorre na criação/propagação de fogo, e não presumir polling contínuo. Os comentários declaram regra e tuning provisórios.

Implementado: sticky reduz velocidade a 50%; ice conserva direção de entrada/input ou facing, ignora mudanças de steering e limpa momentum ao bloquear; reverse inverte input principal/alternativo por até 120 ticks durante a visita, encerra ao sair e reinicia na reentrada. Não cria maldição Skull. Bombas deslizando em sticky param com `slide=null, offset=0`; bombas aéreas, carregadas e de esteira são excluídas. Há bloqueios locais para estados ocupados, brace e movimento duplicado no tick.

- [ ] Confirmar localização/quantidade dos painéis, estados possíveis e estado inicial por rodada.
- [ ] Aplicar uma explosão isolada, fogo prolongado e duas explosões sobrepostas em frames iguais/diferentes; contar transições e testar repetição do mesmo estado versus ciclo fixo/sorteio.
- [ ] Medir velocidade sticky, aceleração/frenagem no gelo e direção após soltar/inverter controles, bater em parede ou cruzar dois painéis.
- [ ] Medir início/fim da inversão parado, saindo, reentrando e com maldição prévia; verificar se o efeito persiste fora do painel.
- [ ] Comparar bomba parada/chutada/aérea em cada piso, alinhamento após parar, pavio e interação com montaria/carry. Relacionar somente estados que tenham equivalente na ROM.

### 07 — Hide and Blow Seek (`sb4-07`)

Implementado: `Foliage` em caminhos inferidos e duas direções de piso, Down em `(7,4)` e Up em `(7,8)`. No shared, `floor.ts::applyFloor` aplica a regra genérica de esteira (`CONVEYOR_SPEED`); `Foliage` não possui efeito dinâmico exclusivo nos arquivos auditados. Ocultação visual não foi validada nesta tarefa.

- [ ] Reconstruir colisão sob folhagem com deslocamento e bombas; diferenciar cobertura visual de obstáculo.
- [ ] Confirmar presença/direção dos dois pisos direcionais e velocidade, inclusive sem input ou contra o fluxo; observar bombas e montarias.
- [ ] Registrar o que a cobertura oculta (jogador, bomba, item, chama), limites de visibilidade e mudança ao entrar/sair. Não fechar visual por inspeção do shared.

### 08 — Spinny Slots (`sb4-08`) — prioridade alta

Implementado em `stage-slots.ts`: chama em botão inicia roleta, salvo ativa/cooldown. Três símbolos são escolhidos imediatamente pelo PRNG, independentemente de quando cada rolo para; conjunto uniforme `seven/bar/fire/skull`. Entrar nos três primeiros botões em ordem row-major para o rolo correspondente; só filtra jogador morto, sem excluir expressamente salto/carry/throw. Timeout 300 ticks, cooldown 180. `placeBomb` proíbe bomba em botão. Botões do layout estão em `(3,7)`, `(7,7)`, `(11,7)`.

Tabela atual, **explicitamente aproximada** no código:

| Combinação | Resultado local |
| --- | --- |
| 777 | 30 itens `Bomb` (jackpot configurável, limitado a 100) |
| BAR×3 | 1 Egg + 18 sorteios de Bomb/Fire/Speed/Kick/Heart/Glove/Punch/Remote |
| FIRE×3 | 8 Fire + 1 FullFire |
| SKULL×3 | 3 Skull, `pressureAt=tick`, remove `pressureLimit` |
| Exatamente dois iguais | seven: 3 Bomb; bar: 3 Speed; fire: 3 Fire; skull: 1 Skull |
| Três distintos | Nada |

`dropItems` espalha imediatamente em células `Tile.Empty` sem item/bomba/chama, limitado à capacidade; não exclui por jogador ou tipo de piso. `roulette.result` guarda só o primeiro tipo pago, não descreve o evento completo.

- [ ] **DangerousBomb:** não há símbolo, payout ou tipo de bomba correspondente nos arquivos auditados; `BombType` local é `normal/remote/pierce`. Observar se existe tal resultado na ROM, qual combinação o produz, quantidade, entidade criada (bomba ativa ou item), área/forma de explosão, pavio, dono, possibilidade de chute/carry e efeito em cadeia. Não equiparar `Bomb` a DangerousBomb nem a ausência de tipo a prova de ausência na ROM.
- [ ] Confirmar símbolos/ordem dos rolos, animação e se o instante de parar determina o símbolo; repetir com mesmo estado inicial e delays diferentes.
- [ ] Testar início por chama em cada botão, bomba adjacente, contato e comandos; testar iniciar já sobre botão, permanecer parado, sair/reentrar e entradas simultâneas.
- [ ] Medir timeout, cooldown e reinício durante fogo ativo; testar rolos individualmente, jogador pulando/carregado e apertos repetidos.
- [ ] Observar cada tripla, cada dupla com terceiro símbolo/posição variados e combinações distintas. Inventariar quantidade e natureza de todos os resultados, incluindo efeitos adversos e possível DangerousBomb.
- [ ] Medir entrega: chuva/animação versus criação imediata, células permitidas, ocupação, espaço insuficiente, coleta e destruição. Confrontar SKULL×3 com pressão já ativa e sem limite de tempo.

### 09 — Seesaw (`sb4-09`)

Implementado em `stage-transport.ts`: pivôs `(4,3)`, `(10,3)`, `(4,9)`, `(10,9)`, orientação horizontal. Agrupamento detecta sequências de `Floor.Seesaw`; layout atual marca só o pivô e libera vizinhos. Todos iniciam `raised=false`. Jogador no extremo baixo de qualquer gangorra disponível dispara **todas**, inverte todos os lados e aplica cooldown 30, mesmo nas demais. Extremo alto lança jogador até três casas por 24 ticks; bomba usa `launch` genérico. Busca destino seguro vazio sem bomba/fogo/abismo, interrompe em parede e revalida ao pousar, recuando até três casas; se não houver destino seguro, mata.

- [ ] Confirmar pivôs, extensão, orientação e lado inicial. Acionar cada uma isoladamente para medir ligação global, grupos ou independência.
- [ ] Testar gatilho por pisada, permanência, salto, bomba e dois jogadores em extremos simultâneos; medir cooldown e retrigger.
- [ ] Medir trajetória, distância, duração e controles no ar; comparar voo de jogador e lançamento de bomba, sem assumir contrato comum.
- [ ] Obstruir destino com bloco, parede, bomba, chama, jogador e abismo, antes/depois do lançamento; verificar recuo seguro, colisão e eventual morte.
- [ ] Observar dano de fogo durante voo e no frame de pouso; localmente `stageTransportInput` consome controles e `step` isenta voo do dano final de chama.

### 11 — Trolley (`sb4-11`) — prioridade alta

Implementado em `stage-transport.ts::trolleyRoute/updateTrolley`:

- Rota **calculada pelo retângulo interno**, sem consultar `Floor.Rail` nem colisões: sai de `(7,11)` à direita até `(13,11)`, sobe até `(13,1)`, vai à esquerda até `(1,1)`, desce até `(1,11)` e retorna. São 44 posições no perímetro 15×13.
- Sem passageiro e sem cooldown, fica parado até encontrar o primeiro jogador vivo elegível na mesma célula; não exige centralização nem botão. Exclui elevação/voo, mas não testa salto explicitamente nesse predicado.
- Ao embarcar, começa a mover no mesmo update, prende posição do jogador ao carrinho e percorre uma volta inteira a `TILE/8` por tick (8 ticks por trecho; nominalmente 352 updates de movimento para 44 trechos). Bloqueia input por `stageTransportInput`; não implementa saída voluntária.
- Ao completar volta, remove passageiro no ponto inicial e aplica cooldown 60. Se continuar na célula depois do cooldown, pode reembarcar. Se passageiro morrer/desaparecer, para no ponto corrente, limpa viagem e aplica cooldown; pode ficar fora do centro de tile.
- Ao passar, apaga bloco diretamente, zera pavio de qualquer bomba coincidente e mata diretamente todo jogador vivo na célula salvo passageiro, sem filtros de proteção/salto/elevação em `trolleyHits`. Passageiro é isento do dano final de chama em `step.ts`.

- [ ] **Rota:** mapear trilhos e trajetória real, pontos de curva e direção inicial; observar uma viagem completa e se existem desvios, retorno ou parada intermediária. Não inferir percurso somente pela arte.
- [ ] **Embarque:** testar carrinho vazio sem input, quatro lados, centro/borda da célula, apertar/manter/soltar botões, salto, montaria, carry e dois candidatos simultâneos. Medir posição de encaixe e prioridade.
- [ ] **Desembarque:** testar comandos durante reta/curva, chegada ao início, uma volta/múltiplas voltas, obstáculos na saída e jogador parado após sair. Medir posição, orientação, proteção e tempo até novo embarque.
- [ ] Medir velocidade por trecho, aceleração, duração de volta e cooldown. Registrar se move sem passageiro ou após morte do condutor, inclusive no meio de um trecho.
- [ ] Testar bloco/item/bomba no trilho, bomba aérea/carregada, reação em cadeia e efeitos sobre item enterrado; observar se destrói, empurra, detona ou para.
- [ ] Testar atropelamento de jogador normal, protegido, montado, pulando ou elevado; observar passageiro sob fogo e eventual proteção residual ao desembarcar.
- [ ] Reproduzir interrupção por eliminação/parede de pressão e observar recuperação; não tomar serialização determinística local como prova da rota original.

### 10 — Costume/Cosplay (`sb4-10`)

Implementado em `initializeStageMechanics/collectCosplay`: até oito posições sorteadas sem reposição entre blocos sem item normal. Ao revelar e pisar, jogador sem fantasia recebe `honey` ou `kotetsu` com chance 50/50 e tem curse limpa. Pickup fica consumido; fogo exposto sem `block` marca como queimado. `mount.ts::hurt` consome fantasia como proteção adicional, sem mudar personagem/habilidades segundo teste local.

- [ ] Confirmar quantidade, locais/distribuição e coexistência com item enterrado, com várias rodadas e opções controladas.
- [ ] Inventariar personagens/fantasias reais, seleção visual e frequência; não presumir dois resultados equiprováveis.
- [ ] Medir aquisição, remoção, cura de curse, habilidades concedidas/restritas e prioridade diante de montaria/coração/proteção.
- [ ] Observar revelação por fogo, destruição no mesmo fogo que remove bloco, coleta simultânea e tentativa de coletar outra fantasia já equipado.

### 12 — Flag Tag (`sb4-12`) — prioridade alta

Implementado em `stage-mechanics.ts::initializeStageMechanics/stageInput/updateFlags`:

- Uma flag por jogador, criada em seu `playerTile` inicial com `ownerId`; independente das cinco marcações `Floor.Flag` do layout. Não exige estar sobre poste para pegar/soltar.
- Primeiro jogador vivo não elevado na mesma célula pega automaticamente se não leva outra flag e não está sob lock; não restringe dono/adversário. O predicado não exclui salto explicitamente.
- Flag acompanha célula do carregador. `action` solta nessa célula, bloqueia recolha pelo mesmo jogador por 20 ticks e consome o input desse tick; não há arremesso de flag. Outro jogador pode pegar sem esse lock.
- Morte do carregador solta a flag na posição atual. Qualquer chama na célula ou `Tile.Wall` destrói a flag e mata diretamente seu dono, inclusive longe dela e sem `hurt`. Destruição remove carry e pode encadear outras eliminações na ordem do update.
- `step.ts` bloqueia special ao carregar flag, mas bombas e outras ações não recebem proibição geral equivalente. Vitória/empate é verificada pelos testes com eliminação; não há pontuação/captura/retorno de base modelados aqui.

- [ ] Confirmar relação flag/dono/poste/assento, número com 2–5 jogadores, posição inicial e se começa no chão ou carregada.
- [ ] Testar recolha automática versus botão, própria versus inimiga, centralização, salto, montaria, duas flags na mesma célula e candidatos simultâneos.
- [ ] Identificar gesto ROM de soltar/arremessar, direção/distância, atraso até recolher e diferenças para dono/terceiro. Medir prazo em frames e efeito de manter botão.
- [ ] Testar andar, colocar/chutar/carregar bomba e usar habilidade enquanto leva flag, inclusive prioridades com o botão de soltar.
- [ ] Queimar flag no chão/carregada, com dono longe/protegido/morto e carregador protegido; testar pressão, morte do carregador e destruição simultânea de flags. Registrar quem morre e quando.
- [ ] Verificar retorno à base, persistência após morte, vitória, empate e eventual condição especial que não dependa de último sobrevivente. Não inferir todas as regras do nome Flag Tag.

## Cobertura local consultada e limites

Foram lidos `packages/shared/test/sb4-mechanics.test.ts`, `sb4-transport.test.ts`, `stage-slots.test.ts` e `stage-surprise.test.ts`. Eles expressam expectativas locais como volta única sem botão, dano ignorando proteção, tabela aproximada de prêmios, locks por tick e determinismo após serialização. Vários cenários usam arena limpa, estado injetado ou rolos definidos diretamente: isso não valida a obtenção do resultado na ROM nem a grade real. **Nenhum teste foi executado nesta auditoria documental.**

- [ ] Após as observações do coordenador, criar matriz regra → evidência bruta → teste de regressão → arquivos afetados, mantendo explícitas divergências e lacunas.
- [ ] Priorizar trolley (rota/embarque/desembarque), slots (DangerousBomb e controle dos rolos), pisos (gatilho/tempos) e flags (posse/eliminação); depois fechar demais mapas e cruzamentos.
- [ ] Validar integração com o estado corrente do workspace antes de corrigir código: os arquivos auditados estão em trabalho concorrente. Este documento é o único arquivo escrito por esta tarefa; não autoriza código, commit ou push.
