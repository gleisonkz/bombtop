# Mapa 09: gangorras, controlador e salto

ROM japonesa original, dois humanos, save `stage09-seesaw-initial.json`. Os scripts novos `stage09-controller.cjs` e `stage09-launch.cjs` usam apenas fixtures registradas de posição de jogadores, sem mudar mapa, regras, timers ou RNG. Hooks observam CPU/writes e chamam os métodos originais. O par trigger/replay compara também execução sem hooks.

## Gatilho e inclinações

O controlador é C3226C, objeto14C0. A tabela em1F56 contém quatro descritores de seis bytes (estado, ponta esquerda, ponta direita); as pontas são offsets de grade, não coordenadas de arte:

| Par | Estado descritor | Pontas | Pivô Bombtop | Ponta baixa inicial |
|---|---|---|---|---|
| Esquerda superior | 0 | 00C8 / 00CC | 4,3 | direita |
| Esquerda inferior | 0 | 0248 / 024C | 4,9 | direita |
| Direita superior | 1 | 00D4 / 00D8 | 10,3 | esquerda |
| Direita inferior | 1 | 0254 / 0258 | 10,9 | esquerda |

C3228A usa DP38=1000 (bitmap de ocupação), mascara3FF0 e alterna o estado global1F52 em C322E0. P1 em(96,80), sem botão, aciona no primeiro update. P1 em(64,80) não aciona no estado inicial. A não foi necessária. Alterar somente a tabela1F58 não seria um detector válido de giro: ela é estática; quem alterna é1F52.

No Bombtop, as inclinações iniciais agora são opostas entre esquerda e direita. A espera do controlador foi reduzida de30 para3 atualizações, conforme sequência C32219→C3225A→C3226C. Isso não significa giro automático a cada3: um jogador no ar não participa da ocupação; o controle com ambos nas pontas gira nos updates1,17,33 etc.

## Salto medido e integrado

P1 na ponta baixa(96,80), P2 na oposta(64,80), sem input: P2 entra C21C58/C21C9E, sobe e volta à mesma casa no update16. Não há arremesso lateral automático de três casas. O perfil de altura, relativo ao Y de chão79, nos updates1..16 é:

`0,0,0,0,6,10,13,15,16,16,16,15,13,10,6,0`.

Pressionar RIGHT no pad2 desde update4 fixa uma escolha horizontal; o primeiro deslocamento é no6, a8 pixels por atualização. X nativo0..16: `64,64,64,64,64,64,72,80,88,96,104,112,120,128,136,144,159`. Aterrissa na ponta da outra gangorra. Trocar para LEFT no8 não muda esse primeiro percurso. UP/DOWN não geraram deslocamento horizontal nos controles.

`stage-seesaw-flight.ts` integra esse perfil, início sem deslocamento automático, escolha horizontal fixa e estado serializável. O renderer usa a mesma tabela de altura e preserva o limite superior do corpo e a proteção contra levantar duas vezes um jogador carregado. A consulta de ocupação adia para o próximo update o jogador que acabou de aterrissar; com ambos parados, o próximo giro ocorre no17, como no trace.

## Fontes REA e execução

- C3228A: ev_f3bf210142c2cc91abef52ca9557db28356141ea580d2e4a14d8a2a943d94b0d, confrontado com trace executado e ponteiros em `stage09-controller.json`.
- C322EE/C32336: ev_72f247a0e0cdfffc7f5a3ccdfc09d46ccade6f68f12762c8443f6b0c9ac72daf.
- C32392: ev_ccd34950dd8a01f11e1f083485c66c2c6d99bd26d501caab1cfc2ea650dd7887.
- C21C58/C21C9E: ev_97e8cd37768ac9e367d0028d8cb3cb74966ef83cfeada919af5cdedefaa4d284. Writes de função em C24B3C/C21C9C, coordenada em C177D7 e aterrissagem em C21D39/C221C0/C2230A foram capturados.

Validação: `node .agent/sb4-rom/stage09-validation.cjs`. Compara hashes dos dois replays completos, WRAM final e todas as amostras P1/P2 do par sem hooks. Os quatro testes ROM do produto verificam inclinações, altura e giros1/17, trajetória horizontal completa e replay serializado com troca posterior de direção.

## Limites que permanecem

O controle LEFT da gangorra esquerda, após cruzar a borda, entra na rotina compartilhada `C22026`, não num wrap instantâneo. `stage-seesaw-flight.ts` mantém uma fase serializável `seesawRebound` e reproduz o primeiro rebote medido: X nativo 248 em t16, quatro arcos sucessivos com seis deslocamentos e dois intervalos sem deslocamento a cada oito updates, retorno em X191 no t48. O perfil vertical repetido de 8 updates é `0/4/6/6/6/4/0/0` pixels de altura. A travessia da ponta esquerda à direita da gangorra superior direita em t25..33, X168→191, e a travessia de volta em t56..64, X183→159, também têm testes de coordenada e altura, com primeira direção mantida e ausência de lançamento quando o jogador está parado. O cliente usa o mesmo perfil de altura, sem configurar um segundo timer visual.

No replay RIGHT com as sete células de bloco do caminho registradas na fixture original, o comando horizontal já mantido antes do segundo lançamento adianta o início do deslocamento: t54 X199, t63 X271, wrap nativo para X7 em t64, transição a `C22026` em t65 X15. São mais três arcos sucessivos com retorno ao controle normal em t89 X63; caminhar de novo pela gangorra produz um arco curto t98 X72→t106 X95. O Bombtop reproduz esse percurso por `preSteered`, wrap para a faixa nativa e fase de rebote de 24 updates. As comparações integrais em `sb4-seesaw-rom.test.ts` cobrem **64/64 atualizações LEFT e 106/106 RIGHT** (X nativo e altura), com fingerprints independentes `48a6d3be` e `72ba6312`; há também replay serializado durante o segundo lançamento. A fase de voo local ainda é criada um update antes da troca de ponteiro observada na ROM (t50 contra t51), embora a posição e altura até t53 sejam iguais; isso ainda requer rastreio fino da ordem do controlador.

As amostras dos dois replays vêm de `.agent/sb4-rom/stage09-launch.json`. Reexecuções independentes do save `stage09-seesaw-initial.json`, com as mesmas posições e apenas o input LEFT/RIGHT mas **sem hooks**, compararam 161/161 amostras de P2 e estado global em ambos os sentidos e todos os 131.072 bytes de WRAM finais: hashes `a510bc766f996161210f8bccb60b915110d2ed949fd17e4da6346d145bb03a37` (LEFT) e `44c565e315b2c71a8ca393c430780315036b23573fab444d757fa7f24e94855f` (RIGHT). A leitura REA de `C22026` confirma os bytes da entrada original: `ev_75686c3d432190803e63f048417ed45428f9bb40a473ad66f39107b8e64925d6`. Isso comprova os percursos das fixtures, não uma teoria universal para todos os encontros com gangorras.

**Ainda pendente:** regra geral que escolhe o número de arcos conforme a posição e os blocos reais, ordem exata da ativação do segundo lançamento, movimento com upgrades/montarias, dano/proteção durante o rebote, lançamentos de bombas, colisão com chama, buraco ou bloqueio surgido durante a trajetória e apresentação visual em navegador. O simulador ainda usa busca local de aterrissagem segura como fallback e **não tem paridade completa de todos os rebotes**. Não declarar mapa09 concluído.

O relatório anterior `stage09-seesaw-report.md` encontrou C22026 por uma fixture em y88, além da barreira de aproximação y79. Não foi usado para provar o salto da gangorra. A evidência nova usa as pontas corretas y80 e o controlador específico.
