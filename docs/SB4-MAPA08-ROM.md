# Mapa 08: slots, investigação do original

Implementação do Bombtop ainda aproximada. Evidência primária/reprodução em `.agent/sb4-rom/stage08-slots-report.md` e `stage08-payout-report.md`.

## Acionamento e ciclo medido

A explosão da bomba aciona o switch no ensaio controlado, t129 após o save inicial: C31B8D troca os três switches persistentes 1C6E→1C4E; C3132B muda o controlador C312B5→C3132E. Controle com posições e tempo idênticos, sem bomba, não ativa. Caminhar sobre o switch e B/X/Y foram negativos nas situações ensaiadas.

Última máscara de parada candidata chega a7 em t1369; callback/quantidade3 em t1371; primeiro payout concreto em t1419: objetos 0890/08C0/08F0, callback C16873. Retorno a C312B5 em t1613. São frames deste replay, não constantes universais de atualização lógica. Identidade dos símbolos, inputs para parada, variantes, probabilidades e duração lógica completa ainda pendentes. Não substituir o timeout 300 do app por uma diferença de frames de vídeo sem rastrear os contadores.

## Payout investigado por coleta

Os payloads +20 são **43/36/37 decimal**, isto é, **2B/24/25 hexadecimal**. São status coletáveis por contato, não três bombas já colocadas. Coleta isolada muda player+4D de0 para o ID e remove o item do mapa. Há 16 comparações com replay sem hooks e WRAM inteira idêntica.

- 2B: consumidores tentam descartar habilidades a cada32 frames do ensaio. Inventário mínimo impediu descarte efetivo; não foi observado item expelido.
- 24: impede colocar bomba. Mesmo input A e posição em controle sem coleta colocam normalmente.
- 25: modifica a bomba colocada: +23=10 contra0, +2E=1 contra2; também exige capacidade disponível completa. Sem nome convencional atribuído até verificar alcance/efeito completo.

REA ainda deve completar a correlação entre símbolos, combinação, callback e payloads; não inferir nomes por imagem ou função genérica de alocação. O app atualmente usa símbolos sete/BAR/fogo/caveira e tabelas provisórias para duplas/triplas; esses ensaios não validam tal tabela.

## Dispatch de 64 combinações e integração parcial

A tabela HiROM em C31414 contém 64 callbacks para os três símbolos nativos de índice 0–3. Foram exercitadas as 64 combinações a partir do mesmo estado salvo imediatamente antes da decisão. As 11 classes observadas são: C14D6 (4 combinações, ID13), C14F7 (18, sem prêmio), C14F9 (12, IDs43/36/37), C1526 (6, IDs43/36/37), C15BF (1, IDs43/36/37), C1611 (12, IDs14/5/5), C163A (4, IDs17/17/17), C1662 (4, IDs5/1/3), C1682 (1, IDs3/4/3), C16A2 (1, IDs7/17/17) e C17AD (1, cascata de IDs1). A enumeração e os snapshots estão em `.agent/sb4-rom/stage08-combinations-results.json` e o contrato portado em `packages/shared/src/sb4-slot-rom.ts`.

Coleta controlada na ROM após substituir somente o ID do item central confirmou: ID1 aumenta $0341/$0342 de1→2; ID3 aumenta $0344 de0→1; ID5 aumenta $0340 de1→2; ID4 altera $03E3 para FF; ID7 altera $0349 para FF; ID13 altera $0348 para FF; ID14 altera $034A para FF; ID17 também aumenta $0341/$0342 e gera diferenças em objeto de bomba. A mesma coleta com IDs36/37/43 altera $034D para o respectivo status. Evidência em `.agent/sb4-rom/stage08-item-ids-results.json`; esses bytes isolados não estabelecem os nomes de todos os poderes.

No Bombtop, a escolha das 64 rotinas e os números brutos de itens agora seguem a tabela extraída. A projeção de índices em símbolos visíveis e dos IDs especiais em `ItemKind` ainda é provisória. O prêmio em cascata 222 conserva o limite configurado de 30 objetos, enquanto a ROM produz objetos progressivamente; um controle até 600 frames identificou nove posições de objeto reutilizadas, sem confirmar quantidade total de prêmios. As posições de queda, probabilidade dos símbolos, parada dos rolos, duração/cooldown e efeitos específicos dos status 2B/24/25 continuam pendentes de paridade completa. Não usar o sucesso dos testes de dispatch como prova dessas partes.

Leituras REA do coordenador: C3185A..97 (ev_dfd29729ace871c288789dd90a818486af4efc66ee109e49d5d2ac61d92072a7) confere o store do payload e callback C16873; C2501C..6D (ev_0e98bc22c277b6fd806618721f956ddf145e63e381a29c748f339ce1701deb01) confere retorno imediato para status24 e exigência de capacidade disponível completa para25. Ainda não prova o efeito completo de25 nem uma tabela de prêmios.
