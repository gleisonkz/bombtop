# Mapa 06: painéis surpresa, investigação da ROM

Paridade ainda incompleta. Relatório nativo, scripts, controles e replays em `.agent/sb4-rom/stage06-surprise-report.md` e arquivos de mesmo prefixo.

## Confirmado em execução

- Painel de spawn: 1C06 inicial em 7E2044 (apresentação) e 7E3844 (persistente).
- Bomba colocada com A muda o persistente para 1C0A em t129, store executado C15529. Controle com posições/tempo iguais, sem A, não muda.
- Uma mudança persistente até t240; animações do mapa exibido não são novas escolhas.
- Após movimento DOWN8 e soltura, controle normal para em y55; painel alterado continua até y63. Compatível com gelo. Não comprova cola/reverse.
- Replay reproduz integralmente WRAM e logs de writes. Fixtures alteraram somente posição de P1 para colocar bomba e retirar-se, com valores registrados.

## Fonte REA

Leitura C1550B, 112 bytes: ev_8a1cee45e376610dd3c8a0315b829a478b83585c2c10d43ee1b18c30346c42a4. Confere o store observado e tabela C15558 com 16 palavras 1C0A/1C06.

O código exige DP9C bit 0004; sai se 1EAC é zero e, caso contrário, indexa a tabela pelo nibble baixo de 1EAC. Decrementa 1EAA: chegando a zero, grava 1C0C e reinicializa esse campo por chamada C35489, máscara 003F e soma 0040. Outro caminho compara 1EAA & 7 com 2 e pode gravar 1C08. Origem/atualização de 1EAC e significado completo de 1EAA ainda precisam de trace; esses campos não devem ser chamados de RNG/timer apenas pela aparência do código.

## Integrado no Bombtop

`sb4-surprise-selection.ts` substitui a seleção uniforme que forçava outro estado. A tabela permite repetir normal/gelo, decrementa um contador compartilhado por todos os painéis, produz cola quando o contador decrementado &7 vale 2 e inversão quando chega a zero. O reset sorteia 64..127 pelo RNG nativo. A inicialização correspondente está em C30D38..44, verificada pelo REA ev_8acffb41a163f4f5858fde28323dc558217beb7868689f7d1c3a36e26fc40a42. Quatro testes confrontam a sequência de 15 amostras medidas, tabela, zero sample e reset; testes de integração verificam o mesmo contador em células diferentes e replay serializado.

O controle `stage06-floor-movement-control.cjs/json` escreve explicitamente códigos 1C06/08/0A/0C no painel de spawn para **isolar a reação de movimento**, sem alegar geração natural desses códigos. 1C08 avança meio pixel por atualização na velocidade base. 1C0C inverte a direção, escreve player+E4=10/+E6=64, renova enquanto em contato e persiste após sair. C24CB4 decrementa +E6 quando o contador global 016C &3 vale zero; C24CB8 limpa +E4 ao esgotar. REA ev_9642c1b59d757bce657e61aa0f32fd8e72ed2b41916c35fc992e80f82161de4c confere esses bytes. No ensaio, sai do painel aproximadamente t41 e a inversão acaba em t297.

A inversão do simulador agora renova contato e sobrevive à saída por 64 passos de quatro ticks, em vez de terminar ao sair/120 ticks. A fase usa o relógio do simulador; ainda não há alinhamento do seu zero com o contador global de vídeo do original. Preserva a maldição existente e evita dupla inversão de uma maldição reverse; interação com outras doenças originais ainda exige investigação.

Os novos traces e controles foram executados novamente: hashes idênticos em `stage06-selection-validation.json`.

## Divergências e próximos passos

## Cadência de uma explosão integrada

`stage06-burst-trace.cjs/json` captura os callers reais do RNG C35489 e a entrada em C1550B. Os quatro sorteios vêm antes de qualquer seleção de raio, na ordem UP/RIGHT/DOWN/LEFT: seed32307 produz amostras12/14/1/11 e termina em48163. As paredes bloqueiam UP/DOWN nesse fixture; RIGHT e LEFT selecionam os pisos com14/11, sem sorteios extras por célula. O centro recebe amostra2, depois renova a cada dois updates até a13ª seleção. Seed final39513, contador global69→54.

Essa cadeia foi integrada em `stage-surprise-flames.ts`: amostras por raio, ordem nativa das direções para o mapa06, primeira seleção central após os raios e12 renovações a cada dois ticks. `StageState.surpriseCenters` mantém os eventos pendentes em snapshots. `burnRay` recebeu um objeto de comando para evitar ampliar sua assinatura anterior de oito parâmetros. Os hooks duplicados de uma mesma chama não contam duas seleções; eventos explícitos de explosões diferentes não são descartados pelo lock por tick.

Quatro testes de ROM verificam samples/seed, sequência completa do primeiro fixture, contador final, seleção compartilhada em raios longos e replay serializado das renovações. Reproduzem a cadeia lógica medida; não significam que toda a agenda global de RNG do jogo esteja portada. Chamas de habilidades autorais ainda usam o fallback de ignição, cuja correspondência não existe no original. Múltiplas bombas/ordem de alocação, remoção por pressão, reflexos autorais e tempo letal total das chamas continuam pendentes.

REA: RNG C35489 ev_2f5a891ee96ce83c8321a41099916e92cc4f2e4cf0511d1f99929d08d051818e; renovação central C15178 ev_19fd7654ddbdaa934468e85954c4f01698531d3bc5e482bb417cac7ef6912cc2; seleção C1550B ev_0b59d5b6aa226e3a11fc7c2fccd75a2ca7fce990310c7b26dd24bb5d268a47dc.

## Área de piso corrigida

Inventário inicial `stage06-floor-inventory.cjs/json`: 20 células vazias e93 sob blocos têm1C06; as30 paredes internas têm1804. Portanto **113 células sem parede** são piso surpresa, não apenas nove painéis expostos inferidos das imagens. `sb4-layouts.ts` marca todas essas células, sem colocá-las em keepClear nem remover blocos. A geração/distribuição dos blocos ainda não foi portada.

No cliente, piso sem efeito ou kind normal não recebe o indicador de setas. Dois testes antes vermelhos cobrem ausência de estado e estado normal; gelo/cola/inversão mantêm o indicador colorido provisório. Comparação visual pelo Browser Bridge, em harness isolado do Renderer real no URL localhost:5173/?sb4validation=06, confirmou a retirada das setas normais. A primeira captura posterior ficou fora do recorte; corrigir a posição do canvas para(0,0) permitiu a captura válida, sem trazer aba à frente. A aba de QA foi fechada. Isso valida a apresentação estática desse estado, não uma partida ou teste mobile completo.

## Gelo: percurso integrado

`stage06-ice-trajectory.cjs/json` mede oito controles com preparação por input e fixtures explicitamente registradas de posição/painel. São controles da reação do piso; a geração natural dos painéis continua sendo o ensaio de explosão anterior. Direção anterior RIGHT/DOWN, sem input ou com oposto mantido: instalação de C21D3F no tick 1; avanço de dois pixels nos ticks 2..8; ajuste final ao centro vizinho e C2141C no tick 9. Na trajetória RIGHT, x32→34→36→38→40→42→44→46→47, y alinha a47. DOWN é análogo. O movimento continua depois de cruzar a fronteira do painel e termina na próxima casa normal. Só depois a direção oposta volta a comandar o movimento.

LEFT/UP têm um alinhamento anterior por C257EA/C25807 nos fixtures usados. O teste compara a fase do gelo a partir da posição já alinhada (47→45→43→41→39→37→35→33→31), sem atribuir esse deslocamento anterior ao controlador do gelo. Contra uma parede à esquerda, não entra na fase do gelo; mudar input permite primeiro movimento comum e posterior entrada. O alinhamento comum do Bombtop não foi refeito.

REA verificou C216AB (ev_e897dad8a05514ce5be7d2506295c7dc7468c58c40e895f1b3d8ec86b9b8244c), C21D3F (ev_7fbf4e10695fc13f5bcc7866f7cf78d15a7f8eb593f832497d5ddb9c36629241), C21DE2 (ev_d7a25507b1db55e61ec2168862b8d8012430ab571557433775a40cde46b43d05), sequências C273F9 (ev_6fda745a3cae964ffc9821a559a5da7a85c1bf6e8ad006b9af29bca196e1ddb4) e rotina de movimento anterior C257C0 (ev_2c48ee225f7c83724891702b2db9798704c56a97cc33e5f12892a5ad18c80e20).

`stage-ice.ts` agora mantém direção/destino em `StageState.iceSlides`, espera a atualização de entrada e avança a velocidade fixa até o centro seguinte, mesmo fora do gelo. O passo do jogo fornece a direção anterior ao input atual. Reutiliza a mesma consulta de colisão de `movement.ts`; nenhum estado/input de outro jogador é alterado. Seis testes confrontam as trajetórias normalizadas e replay serializado. A conversão alinha centros nativos assentados (31,47) ao centro lógico (1,1); o spawn nativo (32,48) fica um pixel além, representado explicitamente no fixture.

A predição do cliente usa o controlador compartilhado; um teste recebe snapshot no meio do percurso, termina igual ao servidor e confirma que o snapshot não foi mutado. O replay nativo dos oito controles teve hash idêntico em `stage06-selection-validation.json`.

Continuam abertos: efeito de velocidade melhorada/montarias, novos obstáculos durante a fase, ações durante o deslizamento, danos e empurrões, detalhes do alinhamento comum, além da cadência de geração explicada acima. Bombas em cola e interação com maldições também permanecem abertas. Não declarar mapa 06 concluído.
