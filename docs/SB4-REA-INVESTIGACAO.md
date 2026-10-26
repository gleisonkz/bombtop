# SB4: investigação da ROM pelo REA

Referência confirmada pelo usuário: Super Bomberman 4 japonês, SNES. A prioridade é documentar mapas, itens, poderes, balanceamento e geração de itens com evidência da ROM; o manual é apoio, não prova de execução.

## Identidade e cobertura

- ROM: `C:/Users/jovipds/mcp-snes/roms/Super Bomberman 4 (Japan).sfc`.
- SHA-256: `bdd90b49bf08d0d0a80e4b4ec811084d470355c648c49a28a0e838cbf1ea8f92`.
- 2.097.152 bytes, HiROM, processador `65816:LE:24:snes`, reset `0xF074`.
- REA/Ghidra 12.1.4: 357 procedimentos definidos. Esse número não representa todas as funções ou todas as regras descobertas.
- Busca de assinatura `AD 18 42` varreu integralmente os 32 bancos C0–DF, totalizando 2 MiB, sem paginação pendente. Isso comprova cobertura da busca, não compreensão semântica de cada byte.

As respostas integrais das primeiras consultas estão em `.agent/rea-sb4-input-investigation.json`, incluindo IDs de evidência, bytes e limitações do provedor.

## Fluxo de controles identificado

| Local | Observação no REA | Classificação |
| --- | --- | --- |
| `C0:FBD7–FC4E` | Rotina de 120 bytes; espera bit 0 de `$4212`, lê `$4218/$4219` e portas seriais; escreve offsets de página direta `$11–$1F` | Instruções e bytes observados |
| `C0:FBE8` | Bytes `AD 18 42`: leitura de `$4218` | Observado; evidência `ev_076a775ace3807b7c3641e953eeeb5fa5cc1787f295402e8535acd4698890987` |
| `C0:07E3`, `C0:093A`, `C0:0A31` | Chamam a rotina de leitura e configuram estruturas nas bases `$0300`, `$0400`, `$0500`, `$0600`, `$0700`, com passo `$100` | Observado; associação a slots de jogadores derivada do fluxo |
| `C0:0ACC–0B39` | Grava estado atual em `base+$30`; calcula `(anterior XOR atual) AND atual` em `base+$88`, e `(atual XOR anterior) AND anterior` em `base+$8A`; atualiza anterior em `base+$34` | Pressão/soltura derivadas das operações observadas; evidência `ev_cd2bd8bb852bdfede3d5b6118265e89d3ee43b6955b7be09b969e966edf382a0` |
| `C0:0AE2–0B02` | Neutraliza pares de direções opostas pelos valores `$0300` e `$0C00` | Operações observadas; comportamento derivado |

A página direta e o banco de dados de cada chamador precisam ser mantidos no contexto: um offset de página direta não é, isoladamente, prova de endereço físico absoluto.

## Candidatos para o botão de bomba/luva

A busca de bytes `B5 88 89 80 00` encontrou `C2:3D0E`, `C2:4FFA` e `C2:5CBF`; a de `B5 30 89 80 00` encontrou `C2:37CB` e `C2:4FE6`. Elas representam candidatos a leitura do bit `$0080` nos estados recém-pressionado e mantido. A atribuição à luva exige seguir o contexto e o fluxo; uma assinatura sozinha não a comprova.

Foi lida a janela `C2:4FA0–5120`, de 384 bytes, com retorno completo (`ev_5bfccb66ffa2e0db23d38f4427b5963d8608bf1ecf311b521788f33e05e09250`). O Ghidra atualmente retorna `undecodable` e `procedure=null` nos candidatos C2. Não converter essa ausência em instruções ou semântica inventadas: é necessário estabelecer contexto M/X e entradas alcançáveis ou obter um traço da execução.

## Estado das comparações

- Luva de jogadores, alcance de voo, tempos, colisões, defesa e pilhas: implementação local baseada no manual existe, mas **paridade dinâmica com ROM pendente**.
- Fire/FullFire máximo 10: descrição do manual e implementação local; confirmação nas rotinas de coleta/explosão da ROM pendente.
- Stop-kick por último chutador: correção local de controle, comportamento original exato pendente.
- Mapas e variantes: localizar tabelas de layout e entradas que as selecionam; ainda sem tabela atribuída por esta investigação.
- Geração de itens: localizar PRNG, distribuição por fase e regras de reposição; ainda sem probabilidades extraídas da ROM.
- Poderes e balanceamento: registrar duração em frames, alcance, velocidade e restrições somente após análise das rotinas correspondentes.

## Save enviado e limitações da ferramenta

O ZIP `bomberman-2006.29888.zip` foi aberto e inventariado pelo REA: SHA-256 `82531a853c6f7186928cf21f45622fdae2ba29dba97e144f2ce3406e3e27e168`. Contém `ULUS10121/PARAM.SFO`, `DATA.BIN`, ícone, vídeo e fundo. O SFO declara `SAVEDATA_DIRECTORY=ULUS10121`, `TITLE=BOMBERMAN`, `CATEGORY=MS`. É um save PSP, incompatível com esta ROM SNES; o usuário confirmou manter SB4. O arquivo foi excluído da referência de regras. Seus metadados não provam 100% de progresso.

O REA abriu e consultou `format=snes-rom`, mas exportar o bundle de evidência e fechar com snapshot falhou num schema que não admite esse discriminador. Os resultados diretos foram preservados separadamente. Não considerar o bundle posteriormente exportado da sessão do ZIP, com zero registros, como preservação da análise da ROM.

O replay isolado `.agent/sb4-rom-replay.cjs` executou a ROM sem patches de RAM ou ROM. Os registros são evidência de emulação instrumentada, separada da análise estática REA e de validação em hardware. O arquivo `.agent/sb4-rea-cpu-trace-explosion.json` contém 11.411 registros, 171 contextos distintos e zero registros descartados; o estado final foi salvo no frame 1776. Esses números cobrem apenas os intervalos instrumentados, não toda a CPU ou todas as mecânicas.

## Entrada executada e criação de bomba

O traço observou a entrada `C2:4FB8` com M=16, X=16, E=0, D=0 e DB=0. A análise REA/Ghidra com essa entrada semeada decodificou 115 bytes até `C2:502A`, evidência `ev_15de224eecf9c8e8860d561dd0416dbc3bbcdd06344c6549d8fb2674155a7f41`, preservada em `.agent/rea-observed-button-handler.json`. A tentativa anterior em `C2:4FB2`, arquivada em `.agent/rea-seeded-handler.json`, está superada: não é uma entrada demonstrada e não deve fundamentar regras.

O manipulador consulta o bit `$0080` de `base+$30` em `C2:4FE6` e de `base+$88` em `C2:4FFA`. No ensaio com A, frame 1577, o jogador usa X=`$0300`. O fluxo chama a alocação em `C3:4FFE` por `C2:50A0`, recebe Y=`$0890` e copia `base+$44` para o offset `$23` da bomba em `C2:50D6`. Em `C2:5132`, decrementa `base+$41`.

O campo `+$41` passou de 1 para 0 após criar a bomba, enquanto `+$42` permaneceu 1. Isso sustenta a hipótese de bombas disponíveis/capacidade; não identifica uma flag de luva. A interpretação completa depende de acompanhar devolução de capacidade e coleta. O alcance interno em `+$44`/bomba `+$23` também exige seguir a propagação da explosão antes de convertê-lo em células no Bombtop.

## Correção da exportação REA

Foi corrigida a união do manifesto em `src/domain/evidenceBundle.ts`, no repositório REA, para incluir `snes-rom`. Cinco regressões SNES, 53 testes focados, typecheck e build passaram. Os arquivos compilados foram instalados com backup e verificação SHA-256 de 75 arquivos; manifesto em `D:/Programação/rea/build/snes-export-install-backup/20261026-144353-55faa2c9/manifest.json`. Um processo separado validou export/parse SNES no módulo instalado. A sessão MCP já aberta mantém o módulo antigo em cache: exportação nessa sessão após reconexão ainda não foi validada.

Mapas, tabelas de itens e PRNG continuam sem atribuição comprovada nesta investigação. Nenhuma nova regra de gameplay foi aplicada a partir das hipóteses acima.
