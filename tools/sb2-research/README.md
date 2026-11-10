# Pesquisa SB2 pelo MCP de Snes9x

Servidor MCP independente do gameplay: Node encaminha chamadas ao processo
Python que hospeda o núcleo Snes9x por libretro. Não usa SnesJs nem automação
de teclado. Não escreve na ROM ou WRAM. Estados são identificados pelos hashes
da ROM e do núcleo. O encerramento descarrega o núcleo.

Reutiliza o SDK MCP e Zod da instalação local existente e Pillow do Python.
O núcleo é adquirido uma única vez do buildbot oficial:
https://buildbot.libretro.com/nightly/windows/x86_64/latest/snes9x_libretro.dll.zip

Núcleo verificado: `Snes9x 1.63 fae2fea`, DLL SHA-256
`cc6440ee820a39a13491a22a665c31b4196308fd8f4226221e0794d7da294c10`.
Uma build posterior no mesmo URL pode ter bytes diferentes: preservar esta DLL
para reproduzir os ensaios. O binário fica fora do repositório.

Contrato utilizado: https://raw.githubusercontent.com/libretro/libretro-common/master/include/libretro.h

## Executar

Ferramentas auxiliares:

- `extract_grids.py journal.json destino.json`: exporta os valores brutos das
  grades de 15×13 observadas nos offsets WRAM `0x1C182` e `0x1D182`.
- `rea-grids.js`: script REA/Frida para observar as mesmas grades ao retornar
  `retro_get_memory_data(2)`, limitado a vinte amostras. Não escreve na ROM/WRAM.
- `verify_rea_grids.py bundle-rea.json capturas-mcp.json resultado.json`:
  compara cada célula das duas leituras. Não valida automaticamente semântica.
  Informe um quarto argumento com o ID da sessão se o bundle contiver mais
  de um ensaio Frida; o comparador rejeita misturá-los.
- `emit_stage_captures.py journal-1-10.json journal-11-12.json destino.ts`:
  gera os dados das doze grades no pacote compartilhado. Exige todas as
  seleções, uma única ROM e um único núcleo. Não gera mecânicas por inferência.
- `rea-motion.js`: observa as quatro estruturas nativas de jogadores em
  até 256 leituras. `verify_motion.py bundle.json journal.json evidence-id resultado.json`
  compara todos os bytes e exporta posições com frações. O journal dessa
  investigação lê offset `0x8000`, tamanho 1024. Y durante salto inclui elevação.
- `rea-effects.js`: até 200 amostras de grades e jogadores. Para comparar o
  bundle com um journal de leituras integrais da WRAM, execute
  `verify_effects.py bundle.json journal.json evidence-id resultado.json`.
- `rea-pad-cycle.js`: até 600 leituras para varrer os instantes de entrada
  da placa esquerda da arena 7. `rea-pad-glyphs.js` acrescenta os dois
  glifos em RAM e a palavra `0x0400` usada na seleção do próximo número.
  Quando uma sessão tiver vários scripts, acrescente o `script-id` como
  quinto argumento de `verify_effects.py`, após o arquivo de resultado.
  Isso seleciona explicitamente a coleta correspondente ao journal.
- `rea-pause-panel.js` e `rea-stage7-panels.js`: pausa central, bombas e
  placa direita. A segunda coleta usa os três glifos em `0x1a246`, `0x1a250`
  e `0x1a25a`, mais suas cópias `0x1b...`; a primeira também preservou dois
  endereços auxiliares sem significado atribuído (`0x1a26e` e `0x1b26e`).
  O campo do jogador `+0x0c` também é usado pela animação; sua contagem
  não deve ser confundida com o contador da pausa em `+0xce` e a flag `0x08`
  em `+0x0e`. Os estados de retomada ficam em `pause-panel/`.
- `rea-conveyor-oam.js`: observa OAM, controles, jogadores e grades da arena 8.
  `verify_conveyor.py bundle.json evidence-id primeira-fase.json fase-confirmada.json resultado.json`
  confere as fases registradas. A seleção de amostras 28 em diante corresponde
  ao ensaio documentado; não reutilizá-la automaticamente em outra coleta.

No `node_repl`, coletores usados por callbacks entre células devem manter a
lista em `globalThis`. Reatribuir um binding local pode deixar o callback
associado à lista anterior. Inspecione o tamanho do journal antes de usá-lo
como evidência; o cliente `replay.cjs` não depende desse padrão de REPL.

Para Frida, mantenha um cliente MCP conectado, consulte `status.host_pid`,
conecte o REA ao PID observado e carregue `rea-grids.js`. Restaure um estado
por vez e chame `read_ram`. Exporte o bundle REA após consultar o status Frida;
desconecte Frida antes de encerrar o cliente MCP. Não reutilize PIDs antigos.

Defina `SNES_MCP_HOME` como a instalação existente `mcp-snes`,
`SNES9X_CORE` como o caminho absoluto da DLL e, opcionalmente,
`SNES_PYTHON` como o executável Python. Inicie `node mcp-server.cjs` pelo
cliente MCP stdio. Não é necessária alteração da configuração global.

Ferramentas: `load_rom`, `advance` (frames e botões), `get_screen`, `status`,
`read_ram` (offset zero corresponde ao início da WRAM), `save_state` e `load_state`.
Os botões são do jogador 1. Áudio é consumido sem reprodução; capturas não
validam efeitos sonoros. Não há traço de CPU, breakpoints nem escrita de RAM.

O status agora inclui `native_timing`, obtido de `retro_get_system_av_info`
e `retro_get_region` após carregar a ROM. `rea-native-timing.js` observa essas
respostas diretamente; `verify_timing.py bundle.json journal.json evidence-id
resultado.json` compara os eventos REA com os metadados MCP. A coleta pode
conter mais de uma chamada AV, inclusive a atualização no primeiro frame;
o comparador exige que todas mantenham a taxa, sem presumir evento único.

`replay.cjs plano.json` usa um cliente MCP real e registra o plano, respostas,
hashes, frames, imagens PNG e dumps hexadecimais de RAM em `journal.json`.
Escolha uma pasta de saída nova por ensaio. Exemplo de plano:

```json
{
  "output": "output/sb2-research/example",
  "steps": [
    {"name": "load_rom", "arguments": {"path": "C:/roms/SB2.smc"}},
    {"name": "advance", "arguments": {"frames": 600}},
    {"name": "advance", "arguments": {"frames": 20, "buttons": ["START"]}},
    {"name": "advance", "arguments": {"frames": 600, "screenshot": true}, "image": "title.png"},
    {"name": "read_ram", "arguments": {}}
  ]
}
```

Para testar a ponte, defina também `SB2_ROM` e execute
`python tools/sb2-research/test_worker.py` da raiz. Testes verificam reprodução
idêntica de RAM e pixels após restauração, limites de leitura e proteção contra
sobrescrita de estados. Não são testes de fidelidade das arenas.

`rea-corner-motion.js` amplia o observador de jogadores para 640 leituras.
O bundle de alinhamento é confrontado por `verify_motion.py`; os percursos
normal/rápido e horário/anti-horário ficam em `conveyor-corners`. O controlador
é limitado a correia livre e jogadores sem itens, conforme o relatório.

`manual-motion/` usa o observador existente `rea-motion.js` (256 leituras).
O ensaio final tem 239 leituras em `all-journal.json`, incluindo alinhamento,
contato com pilares, quatro bordas, correções horizontais e assistência de
canto em velocidades 0,375, 1,25 e 3,5. Use `verify_motion.py` com o registro
final indicado em `SB2-MANUAL-MOTION-FINAL-COMPARISON.json`; o bundle conserva
também o registro intermediário de 204 leituras, sem misturar as coberturas.

`bomb-timing/` prepara a arena 1 com dois MAN e sem COM. As coletas usam
`rea-bomb-timing.js`, `rea-bomb-core.js` e `rea-bomb-phase.js`; o comparador
`verify_effects.py` também confere as regiões opcionais capturadas. Os IDs
dos scripts e dos registros estão nas três comparações de bomba. Os slots
`0x8400..0x87ff` ficaram inalterados e continuam candidatos sem papel atribuído.
`0x12000` mudou durante fuse e explosão; isso não estabelece toda a semântica
da estrutura. A coleta final também observa o contador `0x32`, usado para
conferir as duas fases do fuse, e os ensaios de entrada/saída do fogo.

`items-capacity/` contém os ensaios de coleta, ordem de revelação, capacidade
e inicialização da bolsa nas 12 seleções. Os observadores `rea-items.js` e
`rea-item-effects.js` usam `verify_effects.py`; `rea-item-bag-init.js` observa
mudanças entre entrada e saída de `retro_run` e usa `verify_bag_init.py`.
Os quatro relatórios `docs/sb2/SB2-ITEM-*-COMPARISON.json` registram os pares
bundle/journal, IDs de evidência e script. Para regenerar a comparação da
bolsa, passe, nesta ordem: bundle, journal, evidence_id, script_id, saída nova.
`extract_item_tables.py` recebe ROM, journal da inicialização, JSON de saída
e TS de saída (destinos novos); preserva hashes, offsets e bytes das tabelas.
Não use a semente da última mudança da bolsa como semente final da rotina:
chamadas sem mudança de entrada podem terminar em outro frame.

`chain/` contém três cenários de duas bombas normais, com uma célula livre
entre elas ou adjacentes nas duas fases. `all-journal.json` combina os dois
ensaios na ordem das leituras. Use `verify_effects.py` com os IDs registrados
em `docs/sb2/SB2-CHAIN-COMPARISON.json` e o bundle `SB2-REA-CHAIN.json`.
O estado inicial é `items-capacity/fire-collected.state`; nenhuma RAM foi
alterada para preparar o teste.

`advance` aceita `buttons2` para o segundo controle SNES. Omissão libera o
controle ao fim da chamada, assim como `buttons`. O teste do host usa o estado
capturado `bomb-timing/initial.state` para verificar controles independentes,
liberação e restauração. Não se trata de alteração de RAM do segundo jogador.

`native-pickup-probe.mjs` recebe cliente MCP e pasta de saída; oferece leitura,
percursos, escavação e coleta por controles. As leituras completas alimentam
`verify_effects.py`. A primeira sessão (`native-pickups`) terminou por morte
de P2 no fechamento; `native-pickups-two-pads` reposiciona P2 pelo controle.
`skull-no-glove` refaz o ensaio do Skull antes de coletar habilidades que
interferem na colocação automática. `pickup-motion` compara alinhamento por
frame nas arenas 1 e 7. Checkpoints são cumulativos e preservados; os journals
finais exatos estão indicados nos relatórios de comparação.

`extract_pickup_replay.py` recebe journal, comparação REA/MCP, label final e
JSON de saída novo. `extract_skull_rules.py` recebe ROM, journal sem luva,
comparação e JSON de saída novo. Os arquivos reduzidos mantêm os IDs de
evidência; não substituem a conferência das fontes completas. O estado final
de `action-1-wait160` contém morte e não mede expiração do Skull.

`skull-blink/` registra 709 leituras de 1.024 bytes (quatro jogadores) após
restaurar `skull-no-glove/mode-1.state`. O observador `rea-skull-blink.js`
usa o mesmo formato de `rea-motion.js`, com limite de 900 leituras. A
comparação usa `verify_motion.py`, que também extrai flags, modo, índice
e contador das estruturas confrontadas. `flags.json` é uma redução auxiliar;
os testes usam `docs/sb2/SB2-SKULL-BLINK-COMPARISON.json`, derivado da conferência
das estruturas completas, não o auxiliar isoladamente.

`extract_effect_rng.py` recebe journal completo de pisos, comparação REA/MCP
e saída nova. `SB2-STAGE7-RNG-STARTS.json` liga semente/fase MCP às palavras
de sorteio observadas também pelo REA. Essa extração não transforma campos
vistos somente no MCP em campos supostamente observados pelo REA.

`conveyor-input/` contém 20 trajetórias de comando manual em quatro estados
de correia e duas de entrada/reentrada nos comandos. `manual-journal.json`
inclui também quatro inspeções iniciais; `control-journal.json` é separado.
Os comparadores são `SB2-CONVEYOR-INPUT-COMPARISON.json` e
`SB2-CONVEYOR-CONTROL-TIMING-COMPARISON.json`. O segundo script REA,
`rea-conveyor-input.js`, acrescenta a região de controle `0x5c00` ao observador
de efeitos. Os dois journals foram confrontados por `verify_effects.py`.

`extract_conveyor_replay.py` recebe journal, comparação e saída nova. O
word `0x5cbe` é extraído como estado inicial/esperado; sua região foi capturada
diretamente pelo REA no segundo ensaio, não no primeiro. `facing_code` vem do
campo nativo `+0x5e`; os bits baixos do word de estado não são orientação visual.
As nove divergências históricas foram resolvidas; `SB2-STAGE8-DRAFT-TESTS.json`
permanece como histórico e `SB2-STAGE8-RESOLVED-TESTS.json` registra a suíte verde.

`extract_conveyor_motion_rules.py` lê a ROM e preserva regiões brutas e a tabela
de despacho em `SB2-CONVEYOR-MOTION-ROM.json`. A interpretação é parcial:
composição de velocidades, seleção de eixo, cantos e cruzamento de pixel.

`conveyor-sequences/journal.json` contém quatro percursos independentes de
146 frames (588 leituras com os estados iniciais). A comparação MCP/REA está
em `SB2-CONVEYOR-SEQUENCES-COMPARISON.json`; o replay compacto fica em
`SB2-CONVEYOR-SEQUENCES-REPLAY.json`. Ele amplia os testes de entrada/saída
da correia, orientação e restauração do controlador. Bombas, colisões entre
objetos e interações com itens ainda precisam de ensaios próprios.


`conveyor-bombs/` preserva três journals: `journal.json` usou B e não plantou
bombas; `planted-journal.json` usa A e DOWN; `neutral-journal.json` usa A sem
direção. Os dois últimos têm 604 leituras cada e comparações/replays próprios.
`extract_conveyor_bombs.py journal comparação saída` extrai o slot móvel
0x8400 e a tabela 0x12000 já comparados com REA. Estado móvel zero invalida
as coordenadas antigas; não deve ser interpretado como explosão automática.
Os testes de transporte ainda recebem jogadores/controles nativos: não
certificam a integração ao step nem as interações entre bombas e itens.

`verify_effects.py` distingue truncamento global de falta de amostras do script
selecionado. Com truncamento, exige script explícito e sequência completa
1..N com N igual ao número de leituras MCP, além da igualdade dos bytes.
O relatório mantém a flag global de truncamento para não ocultar essa limitação.


`conveyor-bomb-lifecycle/journal.json` amplia o ensaio até 190 frames em quatro
configurações: um frame neutro, A, DOWN por 60 e neutro até o fim. São 764
leituras REA/MCP sem truncamento. O replay contém os botões e o estado inicial,
a bolsa de 64 entradas e os itens por glifo; os testes usam o step completo,
sem injetar posições intermediárias. `extract_conveyor_bombs.py` foi ampliado
para preservar esses campos. Os replays `*-STEP-REPLAY.json` anteriores e
`SB2-CONVEYOR-BOMB-LIFECYCLE-REPLAY.json` são as entradas dos 12 casos.
A flag C000 da tabela não é prova suficiente de fogo: usar a grade e o ciclo
móvel/estático. A nova entidade móvel só é iniciada em fase nativa par.
