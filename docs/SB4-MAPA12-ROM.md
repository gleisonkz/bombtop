# Mapa12: bandeiras, primeira validação original

Evidência primária e comandos em `.agent/sb4-rom/stage12-flags-report.md`. ROM japonesa SHA256 bdd90b49bf08d0d0a80e4b4ec811084d470355c648c49a28a0e838cbf1ea8f92, dois humanos/MAN. O pesquisador não alterou app/ROM/instalação. Quatro pares com replay sem hooks tiveram WRAM final integralmente idêntica.

- Bandeira0860, posição nativa(47,47), owner0300=P1. Bandeira0890, posição(207,207), owner0400=P2. Não ficam inicialmente na coordenada do próprio jogador.
- RIGHT16/idle20, sem fixtures e sem A, recolhe a própria bandeira no update9. Contato basta. C31ED9/C31EDB escrevem carrier, C31EEC muda rotinaC31E52→C31EEF. O dono original não muda ao recolher bandeira inimiga.
- B enquanto carrega solta a bandeira: C2379E muda rotina paraC31F24, C31F4E restauraC31E52. Isso não comprova que o botão secundário Y/action do Bombtop seja equivalente; o mapeamento precisa ser corrigido.
- Bomba perto da bandeira e retirada de P1 para longe: C31F80 escreve bit04 em03C2 no update130, inicia morte no131. O controle pareado sem bomba conserva P1 vivo. Comprova morte remota do dono original neste caso, não morte por explosão encostando no seu corpo.

## Correções integradas

`SB4_FLAG_SPAWNS`, no catálogo compartilhado, é a única fonte das posições por dono: `(2,1), (12,11), (12,1), (2,11), (7,7)`. São as coordenadas lógicas do construtor C31CB0..C31E04, antes inferidas incorretamente como sendo os próprios spawns. O layout marca as mesmas posições e mantém as casas livres. A ordem P2/P3 dos spawns SB4 também estava trocada em `arena.ts`; P2 agora começa na diagonal inferior direita, como nos replays dos mapas03/05/09/12 e na inicialização nativa. As arenas autorais não foram alteradas.

REA leu o construtor: ev_ea1438fd3b75b6009c11f46a29a789d4ebce47f271bf3d20683c971a0e0e2e4f, ev_4902c39412004e9b842d2b24871529e3bbc24ca57483d7ded528fada797d5ec2 e ev_657bec79e218d43ed21b2e9218737db95d7276cf245d25eb4f73b8151119407b. Donos0300..0700 recebem posições nativas pré-alinhamento48/48,208/208,208/48,48/208 e128/144. A comparação em execução de flags ativas cobriu os dois humanos do save, não cinco humanos.

Soltar agora usa `brace` (B), não `action` (Y). O estado `StageFlag.droppedBy` impede a mesma pessoa de recolher até sair da célula, substituindo o timer inventado de20 ticks. C31E52 compara player+80 com flag+2A antes de limpar flag+24, conforme ev_8966015fb34a19c5d3fdb3774b3e32249aae7af32c54095665032c035b66f109. O gate B em C23770 foi lido em ev_b7b621e91e9da6c3dcf8f57c41e474ca044984b5bafb6bbbe7585789465a9961.

`stage12-drop-stationary.cjs/json` valida sem fixtures de posição: RIGHT16,idle8,B8,idle80, duas execuções sem hooks com hashes WRAM idênticos. Coleta no9; B solta no26; no112 o personagem continua parado e a bandeira solta, com lastCarrier0300/carrier0 e ambas as células0046. Isso confirma que não é um cooldown curto. O teste do produto permanece60 ticks sobre ela, depois sai e volta para recolher; também retoma o estado de exclusão de um snapshot clonado.

## Movimento e animação de coleta

O estudo independente `stage12-speed-report.md` reproduziu seis pares hooked/hook-free, todos os131072 bytes WRAM iguais. Carregado e descarregado avançam1 pixel por atualização ativa na velocidade inicial; não foi introduzido multiplicador de lentidão. O resultado X41 depois de RIGHT16 é causado por pausa, não velocidade reduzida.

No replay sem fixtures, coleta9, último movimento comum10, posição parada11..18 e rotina C23692, retorno C2141C no18. C23692 foi conferida no REA ev_d67ea674f40921f06b8d73295f52461793a955bcced5c3d2e6824971811dc5c8. `flagPickupUntil` mantém essa fase de oito atualizações após um último movimento; o mesmo guard é usado pelo servidor e pela predição. Testes confrontam a sequência de deslocamentos e snapshot sem mutação. Isso não recria ainda o sprite/animação original de erguer a bandeira nem todos os timers/status durante essa rotina.

## Limites

Os ensaios pós-B do pesquisador de velocidade recolheram a bandeira por causa das fixtures de posição e não foram usados como prova de velocidade após soltar. Tentativas em `stage12-constructor-all-five.cjs` de mudar configuração antes do início também não ativaram os três slots OFF: a inicialização sobrescreveu os campos. São ensaios inconclusivos, não prova de cinco flags ativas. `stage12-config-source.json` localiza as cópias C201F0/C20227/C2025E; leitura REA ev_6dba6f2ffae441fb9477481327e1bf8c1369bfe71cad9cc1c253529999f6527a. A configuração correta do menu ainda precisa ser rastreada para esse replay.

Pendentes: limiar exato de contato, prioridade de jogadores sobrepostos no recolhimento, flags ativas dos donos3..5, bandeira carregada acima do corpo, morte simultânea e momento de processar o pedido de morte (o app ainda mata imediatamente), montarias, danos/proteções e status durante a pausa. Não declarar mapa12 concluído.
