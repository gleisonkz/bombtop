# Lanterna Verde A1 â€” John Stewart

Base aprovada: `../pixellab-preview/bald-1.png`. A Ãºnica alteraÃ§Ã£o pedida na base foi deixar as Ã­ris verdes; `base-green-eyes.png` registra essa ediÃ§Ã£o PixelLab. O sprite permanece careca, com pele escura, cavanhaque e uniforme preto/verde no acabamento do CapitÃ£o AmÃ©rica e Thor.

## Atlas integrado

`apps/client/public/sprites/lantern.png`: RGBA **1188Ã—2952**, grade 9Ã—18, cÃ©lulas **132Ã—164**, Ã¢ncora (68,5;158). **108 cÃ©lulas ocupadas**, 54 cÃ©lulas excedentes transparentes. Existem 84 poses Ãºnicas; as demais sÃ£o as sustentacÃµes e repetiÃ§Ãµes jÃ¡ presentes na animaÃ§Ã£o original. NÃ£o representam poses novas.

| Linhas (base zero) | AÃ§Ã£o | Quadros |
| --- | --- | --- |
| 0â€“2 | Parado: frente, direita, costas | 4 por direÃ§Ã£o |
| 3â€“5 | Andando: frente, direita, costas | 6 por direÃ§Ã£o |
| 6 | Dano | 6 |
| 7 | Derrota | 7 |
| 8â€“10 | Especial: frente, direita, costas | 9 por direÃ§Ã£o |
| 11â€“13 | Transporte parado: frente, direita, costas | 4 por direÃ§Ã£o |
| 14â€“16 | Transporte andando: frente, direita, costas | 6 por direÃ§Ã£o |
| 17 | ApresentaÃ§Ã£o e vitÃ³ria | 8 |

O PixelLab recebeu as poses da folha anterior por `transfer_outfit`, junto da imagem real A1 com olhos verdes. A folha anterior define somente posiÃ§Ãµes, gestos, direÃ§Ãµes e tempo. A nova folha contÃ©m apenas o personagem: sem esferas, bolhas, luz, aura, trilhas ou sombras incorporadas. A bolha do especial continua sendo desenhada pelo jogo.

`before.png` conserva a folha anterior. `pose-map.json` mapeia todas as cÃ©lulas. `jobs.json` registra os jobs e a tentativa lateral substituÃ­da apÃ³s falha do serviÃ§o. Os PNGs em `raw/` preservam a geraÃ§Ã£o; `generated/` contÃ©m a harmonizaÃ§Ã£o de eventuais verdes antigos para a paleta A1, sem mudanÃ§as geomÃ©tricas. O empacotamento nÃ£o escala nem recorta as poses.

`native-palms.json` registra 50 palmas em 30 quadros de transporte. `paint-regions.json` protege o rosto e as Ã­ris para que os olhos continuem verdes ao trocar a cor do uniforme. `runtime-metadata.json` registra geometria, escala, retrato e limites do menu.

## ReproduÃ§Ã£o

```powershell
python concept/lantern/redraw/collect.py
python apps/client/scripts/finalize-lantern-pixellab.py --harmonize
python apps/client/scripts/pack-lantern-pixellab.py
python apps/client/scripts/finalize-lantern-pixellab.py --promote
python apps/client/scripts/build-carry-anchors.py --character lantern
```

A coleta apenas baixa jobs existentes e nÃ£o inicia geraÃ§Ãµes. A chave Ã© lida do ambiente Windows e nÃ£o Ã© salva no projeto. O finalizador altera somente entradas Lanterna nos JSONs compartilhados.

## VerificaÃ§Ã£o

Passaram quatro testes estruturais do empacotador, sete testes de encaixes, quarenta testes focados do cliente, typecheck e build. A folha de produÃ§Ã£o corresponde ao candidato e tem todas as 108 cÃ©lulas esperadas. As prÃ©vias `walk-preview.gif`, `carry-preview.gif`, `cast-preview.gif` e `lobby-preview.gif` sÃ£o exportadas das cÃ©lulas finais. A aprovaÃ§Ã£o visual detalhada fica com o usuÃ¡rio, conforme solicitado.

## Correção localizada dos olhos

Após a revisão do usuário, 51 poses com olhos abertos receberam inpainting somente nos olhos. O A1 original permaneceu como referência visual dentro das imagens de edição. As pálpebras são estreitas, a esclera é branca, a íris verde é pequena e a pupila escura. Poses de costas e olhos fechados ficaram intactos. Os snapshots em `eyes-fix/before-generated` e o manifesto de máscaras comprovam que nenhum pixel fora das regiões dos olhos nem qualquer valor de alfa foi alterado. Punhos verdes próximos ao rosto foram explicitamente excluídos das máscaras.

Os resultados e jobs estão em `eyes-fix/`. Para reaplicar: `python concept/lantern/redraw/eyes-fix/collect.py`, depois `python concept/lantern/redraw/eyes-fix/apply.py`, empacotar e copiar o candidato para produção. Seis testes em `test-lantern-eyes.py` verificam a preservação e as cores.
