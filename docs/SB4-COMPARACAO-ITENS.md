# Bombtop × manual original Hudson: itens

Auditoria documental de 26/10/2026. Fonte primária: [manual japonês de Super Bomberman 4, Hudson](https://www.gamingalexandria.com/highquality/sfc/Super%20Bomberman%204/Super%20Bomberman%204%20-%20Manual.pdf), cópia local [PDF](../.agent/sb4-manual.pdf). Páginas citadas são os números impressos, coincidentes com os índices PDF examinados. Leitura visual das páginas 6–17 e 23–29; nenhuma execução ou medição da ROM nesta subtarefa.

Imagens 9–17 produzidas por `pdftoppm -f 9 -l 17 -scale-to 1300 -png .agent/sb4-manual.pdf .agent/sb4-items-manual`; também renderizadas 23–29 para alcançar o catálogo de itens. As páginas 6–8 já estavam disponíveis como `sb4-manual-NN.png`. Os PNGs foram abertos para leitura, não tratados apenas por OCR.

Código consultado no projeto: `packages/shared/src/{state,constants,items,air,player-carry,kick,push,curse,bombs,mount,movement,step}.ts`. Contexto anterior: [auditoria de itens e mapas](../BOMBERMAN4-AUDITORIA-ITENS-MAPAS.md). Atualizado após as correções de carry, restrições montado, stop-kick e alcance máximo; a comparação usa o código lido durante trabalho concorrente e não congela o estado das outras tarefas.

**Estados:** confirmado = a propriedade explicitamente descrita coincide; diferença = desvio demonstrável entre texto e código; pending = manual insuficiente, regra não medida ou implementação em andamento. Um efeito confirmado não implica paridade de todos os seus detalhes. O catálogo das páginas 26–29 mistura modos; não autoriza colocar todos os itens no saque padrão Battle.

## Todos os 17 ItemKind

| ItemKind / valor | Manual e página | Código observado | Estado e limite da conclusão |
| --- | --- | --- | --- |
| `Fire` / `fire` | +1 nível; máximo 10 níveis, alcançando 10 blocos à frente (26). | +1 em `fireRange`, máximo `MAX_FIRE_RANGE = 10`; `burnRay` percorre de 1 até `range`, inclusive. | **Confirmado:** incremento e limite documental; diferença anterior 8 versus 10 corrigida. Regressão em `sb4-item-parity.test.ts`; sem medição de frames na ROM. |
| `Bomb` / `bomb` | +1 bomba simultânea, máximo 8 (26). | +1 capacidade até 8. | **Confirmado:** incremento e limite. |
| `Speed` / `speed` | Aumenta velocidade; até 6 níveis (26). | Base 16, incremento 4, máximo 32: quatro incrementos a partir da base. | **Diferença de progressão descrita:** o modelo local não oferece seis incrementos. **Pending:** correspondência exata entre nível inicial e seis níveis do manual, velocidades e frames originais. |
| `Kick` / `kick` | Encostar na bomba a move em linha reta até obstáculo ou X (27); X interrompe bomba chutada (7). | `bomb.kickedBy` registra o último chutador; parada usa `kickedBy ?? ownerId`, com fallback para estado legado e exclusão de esteiras. | **Confirmado:** contato, deslocamento e comando de parada; corrigido o controle local pelo último chutador. **Pending:** fidelidade dono versus chutador na ROM, velocidade e colisões exatas; ver seção própria. |
| `BombPass` / `bombPass` | Atravessa bombas, não paredes (26). | Permite atravessar bombas; coleta desliga Kick, e Kick desliga BombPass. | **Confirmado:** passagem básica. **Pending:** exclusão mútua com Kick não declarada nessas páginas. |
| `BlockPass` / `blockPass` | Atravessa somente soft blocks (27). | Permite `Tile.Block`, não paredes; há proteção contra chama enquanto dentro do bloco em `step.ts`. | **Confirmado:** passagem por blocos destrutíveis. **Pending:** imunidade dentro deles não especificada no trecho. |
| `FireSuit` / `fireSuit` | Aproximadamente 16 segundos de invencibilidade, piscando; impede dano de explosões e inimigos (26). | `FIRE_SUIT_TICKS = 16 * 60`; `hurt` rejeita dano durante o contador. | **Confirmado:** duração nominal de 16 s e proteção. **Pending:** piscar, limites de tick e interação com cada hazard. O manual não sustenta chamar 16 s de divergência. |
| `Heart` / `heart` | Evita uma falha por ataque/contato com inimigo (28). | Booleano absorve um dano em `hurt`, depois de montaria/costume; concede invulnerabilidade local de 2 s. | **Confirmado:** uma proteção adicional. **Pending:** prioridade, uso em Battle e janela de 2 s não determinados pela descrição. |
| `Remote` / `remote` | B detona em momento escolhido; incompatível com bomba perfurante (26). | `bombType = remote`, substituindo pierce; detona a bomba remota mais antiga elegível pelo input `action`. | **Confirmado:** ativação manual e exclusividade do tipo. **Pending:** ordem/quantidade detonada e mapeamento B versus ação; não deduzir somente de `action` qual botão físico o cliente usa. |
| `Pierce` / `pierce` | Explosão atravessa soft blocks e obstáculos; não paredes; incompatível com Remote (27). | Tipo exclusivo; raio continua após destruir blocos; paredes param a chama. | **Confirmado:** regra básica e exclusividade. **Pending:** equivalência de todos os obstáculos especiais. |
| `Punch` / `punch` | Y junto da bomba permite socá-la (7, 27); proibido montado (7). | `punch` lança bomba adjacente e agora rejeita `p.mount` em `air.ts`. | **Confirmado:** gesto básico e bloqueio montado; diferença anterior corrigida. **Pending:** trajetória, distância 3 e stun de 0,75 s não quantificados pelo manual. |
| `Push` / `push` | Y empurra outro Bomberman uma casa à frente (11, 27: alvo a uma casa); manter B resiste (11). Proibido montado (7). | `tryPush` busca rival adjacente, rejeita `mount` e `brace`; avanço próprio 1 casa e deslocamento programado do rival até 3, sujeito a colisão. | **Confirmado:** alvo adjacente, defesa B e bloqueio montado. **Pending:** o texto de “uma casa à frente” localiza o alvo; não prova que o deslocamento deva ser de apenas uma casa. Distância, velocidade e colisões não estabelecidas. |
| `Glove` / `glove` | A sobre bomba levanta; soltar lança na direção encarada (6, 27). Sobrepor outro jogador + A levanta; soltar lança (6, 10). | `air.ts` trata bombas; `player-carry.ts` implementa sobrepor + pressionar/manter A + soltar, pilhas de três e integração com brace, morte/desconexão, abismos, fogo e view delta. | **Confirmado:** gesto básico implementado e pilha ilustrada suportada; coordenador informa 13 testes de `glove-players` passando. **Pending:** fidelidade de prioridades e escape com B; alcance de 3 casas e 6 ticks por casa são **provisórios**, sem quantificação no manual. Frontend em validação. |
| `Skull` / `skull` | Somente Battle; doença aleatória, cura por contato transmissor ou outro item; movida por explosão e removível com bomba chutada; lista 12 doenças (29). | `CURSES` contém 11; transmite removendo doença do portador; coleta cura exceto Skull, Picanha e Egg. | **Confirmado:** adoecimento e transferência básica. **Diferença:** falta doença de troca de posições. **Pending:** exceção de cura por Egg e comportamento físico da caveira; ver abaixo. |
| `FullFire` / `fullFire` | Alcance imediatamente máximo, 10 blocos à frente (27). | Define `fireRange = MAX_FIRE_RANGE = 10`. | **Confirmado:** máximo documental; diferença anterior 8 versus 10 corrigida, com regressão em `sb4-item-parity.test.ts`. |
| `Egg` / `egg` | Transforma em montaria; famílias mecânica e biológica; até duas conectadas somente do mesmo tipo (27); p. 9 também ilustra conexão de duas. | Sorteia `hopper`, `dasher`, `pusher`; se já montado, não adiciona outra. | **Confirmado:** obtenção básica de montaria. **Diferença:** catálogo local reduzido e ausência de conexão de duas montarias. **Pending:** distribuição por modo e equivalência individual dos poderes. |
| `Picanha` / `picanha` | Sem equivalente identificado no catálogo 26–29. Os bonus items alimentares da p. 28 dão pontos e são marcados Normal Game. | Conteúdo autoral ligado a Lula; aplica stun de 2 s; não é bônus de pontuação. | **Pending quanto a equivalente original; autoral no código.** Sem base para equiparar a Picanha aos alimentos ilustrados só pela aparência. |

## Conclusões acionáveis e cautelas

### Fire Suit e alcance de fogo

A [página 26](../.agent/sb4-items-manual-26.png) diz aproximadamente 16 segundos para Fire Suit: confirma o valor local e resolve a dúvida documental deixada pela auditoria anterior. Não comprova duração exata em frames. A mesma página diz máximo 10 níveis/10 blocos à frente para Fire; a [página 27](../.agent/sb4-items-manual-27.png) repete 10 blocos à frente para Full Fire. O coordenador também leu essa fonte primária e alterou `MAX_FIRE_RANGE` de 8 para 10, com regressão em `sb4-item-parity.test.ts`. A divergência de limite está corrigida no código consultado. A referência comunitária anterior a 9 casas não prevalece sobre esse texto; não houve medição em ROM.

### X: parar bomba chutada, dono versus chutador

Na [página 7](../.agent/sb4-manual-07.png), X é usado para parar a bomba chutada quando se possui Kick. A p. 27 descreve movimento até obstáculo ou X. Nenhum desses trechos explicita a identidade do dono original, nem resolve o caso A coloca / B chuta / A ou B pressiona X. O bug de controle local foi corrigido: `tryKick` registra o último chutador em `bomb.kickedBy`, e `stopKickedBombs` seleciona por `kickedBy ?? ownerId`. O dono original permanece como fallback para estados legados; rastrear o chutador não exige transferir a propriedade da bomba. **A fidelidade dono versus chutador continua pending na ROM**: o manual não prova sozinho a regra de identidade. Comparação controlada futura deve cobrir os dois jogadores, terceiros e múltiplas bombas chutadas.

### A, B, Y e montaria

As pp. 6 e 10 confirmam sobrepor jogador e pressionar A para levantar, soltar para lançar. A ilustração da p. 6 mostra três jogadores empilhados; a imagem por si só não especifica profundidade máxima, regras recursivas nem prioridades bomba/jogador. A [p. 11](../.agent/sb4-items-manual-11.png) distingue **manter B para resistir a Push** de **pressionar B repetidamente para escapar após ser levantado**. Não resumir ambas como um único `brace` sem verificar o contrato de input do carry.

O player carry está implementado em `player-carry.ts`. Segundo o resultado informado pelo coordenador, **13 testes de `glove-players.test.ts` passam**, cobrindo sobreposição, pressionar/manter/soltar, pilhas de três, brace, morte/desconexão, abismos, fogo e view delta. Isso valida os cenários locais informados, sem demonstrar paridade em ROM nem conclusão do frontend. **Alcance de 3 casas e duração de 6 ticks por casa são provisórios** (`AIR_DISTANCE` e `AIR_TICKS_PER_TILE`), pois as páginas lidas não fornecem essas medidas. Escape por B e prioridades exatas continuam pending.

A p. 7 proíbe Push, Punch e especiais dos quatro Bomber Kings enquanto montado; permite a habilidade própria da montaria. Os bloqueios estão implementados: `tryPush` rejeita montaria, `punch` agora rejeita `p.mount` em `air.ts`, e `step.ts` exige `!p.mount` para especiais de personagem. As duas últimas lacunas anteriores estão corrigidas. A equivalência dos personagens convidados aos quatro reis continua sendo uma questão separada. A p. 7 associa poderes dos reis a B; não atribuir todos os poderes a Y. Nenhum código foi alterado nesta subtarefa documental.

### Skull: 12 doenças, não 11

A [p. 29](../.agent/sb4-items-manual-29.png) lista rapidez extrema, lentidão extrema, colocação automática de bombas, incapacidade de colocar bombas, capacidade/fogo mínimos, movimento que não para, comandos invertidos, pavio curto, pavio longo, invisibilidade, perda periódica de itens e **troca súbita de posição com outro Bomberman** (`チェンジ病`). As primeiras onze têm correspondentes em `CURSES`; a última não consta do catálogo local.

O manual diz cura por outro item sem enumerar exceção de ovo. O código exclui Egg da cura. Registrar **pending** para essa exceção específica, pois ausência de ressalva não demonstra todos os casos dinâmicos. O comportamento de explosão mover a caveira e bomba chutada eliminá-la é explícito no manual; requer checagem específica no fluxo de dano/movimento dos itens antes de assumir paridade. Tempos exatos de doença, probabilidades e pavios de 1/4 s não são fornecidos nessa página.

## Itens do manual sem ItemKind dedicado

| Manual | Evidência | Situação documental |
| --- | --- | --- |
| Geta | Reduz um nível da velocidade adquirida; p. 26. | Não há ItemKind próprio. Não confundir com doença slow. |
| 1UP | +1 vida, estoque até 9; p. 28, marcado Normal Game. | Não há ItemKind próprio; não implica lacuna no Battle. |
| Bonus items | Dão pontuação; p. 28, marcados Normal Game. | Não há ItemKind equivalente identificado; não equiparar à Picanha. |
| Timer | Para inimigos e relógio por 16 s; p. 28, marcado Normal Game. | Não há ItemKind próprio. |
| Select item | Após um tempo, transforma-se em vários itens; p. 28. | Não há ItemKind próprio; duração/distribuição não informadas. |
| Cosplay | Aparência de Kotetsu ou Honey e proteção contra uma explosão; pp. 25, 28. | Sem ItemKind próprio, mas o código já tem `p.costume` e absorção em `hurt`; ausência no enum não prova ausência da mecânica de estágio. |

## Verificação e escopo

Conferidos os 17 membros de `ItemKind` contra a tabela, os limites e os caminhos citados. Nesta atualização, somente este documento foi editado. Não foram executados testes de aplicação por esta subtarefa: os 13 testes de carry passando são resultado informado pelo coordenador; `sb4-item-parity.test.ts` registra a regressão do alcance corrigido. Não há afirmação de aprovação de testes globais; **frontend em validação**. Não houve alteração de código, mapas, imagens, auditoria anterior, configuração, uso de browser ou commit nesta atualização. Relatos históricos de testes na auditoria anterior não são resultados desta subtarefa. Permanecem abertas as pendências de Speed, Skull, montarias e demais detalhes sem evidência suficiente; o manual não fornece sozinho inventários exatos de cada arena nem fidelidade por frame.
