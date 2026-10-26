# Spider — PixelLab e animação convencional

Personagem de origem: https://www.pixellab.ai/create-character/439a18c5-85aa-4455-ac5a-f40f73947f85

Atlas completo integrado em `apps/client/public/sprites/spider.png`: **108 células ocupadas**, com transparência, grade de 9×18, células de 130×161 e âncora (64,5; 155). Células excedentes transparentes; o renderer espelha a vista direita para o lado esquerdo.

## Origem dos pixels

`source-progress.zip` e `export/` conservam a exportação PixelLab sem retoques. O transporte original não servia diretamente: os braços começavam baixos e o perfil não erguia as mãos. A criação de uma referência nova ficou sem créditos, e o gerador alternativo não entregou imagem.

O usuário escolheu completar por **edição e animação convencional**, sem nova geração por IA. `rig-spider-pixellab.py` usa Pillow 11.2.1, biblioteca open source já instalada, para recortar partes existentes, articulá-las e compor frames com nearest-neighbor. Os métodos `Image.crop`, `Image.rotate` e `Image.resize` foram conferidos na documentação da instalação utilizada.

Os passos e pixels opacos da máscara são preservados nos seis frames de transporte por direção. Os braços seguem articulações de ombro, cotovelo e punho, compostas com tons originais do traje. As luvas são recortes do PixelLab redimensionados com nearest-neighbor e posicionados no mesmo punho ao longo de cada movimento. Há quatro poses respirando e seis passos por direção. A apresentação contém oito poses articuladas: repouso, braço erguido, sustentação, salto, descida, agachamento, recuperação e postura final. As pernas do salto e do agachamento também seguem articulações de quadril, joelho e tornozelo para evitar cortes e fragmentos soltos. Ela substitui a apresentação antiga no menu e nos resultados.

A revisão detectou que o disparo de costas gerado apontava a mão para a direita. Essa linha foi refeita com o mesmo rig, mantendo as costas e uma extensão para cima. O disparo permanece na coluna 5. Frente e lado usam frames PixelLab mapeados explicitamente; a sustentação final lateral é um hold intencional.

## Contrato

| Linhas, base zero | Ação | Frames por linha | Vistas |
| --- | --- | --- | --- |
| 0–2 | Idle | 4 | frente, direita, costas |
| 3–5 | Caminhada | 6 | frente, direita, costas |
| 6 | Dano | 6 | frente |
| 7 | Derrota | 7 | frente |
| 8–10 | Disparo da teia | 9 | frente, direita, costas |
| 11–13 | Transporte parado | 4 | frente, direita, costas |
| 14–16 | Transporte andando | 6 | frente, direita, costas |
| 17 | Apresentação | 8 | frente |

Corpo medido: 124 px. Escala de arena: 0,1703871, conservando a altura aparente anterior de aproximadamente 21,13 px. A apresentação mede 122 px na pose inicial. Teia e bomba continuam pertencendo ao renderer, sem objetos incorporados ao corpo.

## Arquivos de edição e metadados

- `manifest.json`: mapeamento explícito de 108 frames e registro por linha.
- `rigged/parts/`: recortes para edição convencional.
- `rigged/report.json`: fontes, poses, cabeças, palmas e parâmetros de composição.
- `rigged/palms.json`: 50 pontos de palma em 30 poses, nas coordenadas finais.
- `spider-paint-regions.json`: proteção dos tons claros dos olhos na recoloração.
- `runtime-metadata.json`: corpo, escala, limites do menu, retrato e origem dos disparos.
- `rigged/review.png`, `rigged/carry-south.gif`, `rigged/carry-east.gif`, `rigged/carry-north.gif`, `rigged/presentation.gif`: revisão visual.

## Reprodução, a partir da raiz

```powershell
python apps/client/scripts/rig-spider-pixellab.py
python apps/client/scripts/pack-spider-pixellab.py --output concept/spider/pixellab/spider-candidate.png > concept/spider/pixellab/candidate-report.json
python apps/client/scripts/finalize-spider-pixellab.py --promote
python apps/client/scripts/build-carry-anchors.py --character spider
```

O empacotador rejeita fontes ausentes, contagens incorretas e cortes antes de gravar. O finalizador preserva os demais personagens nos JSON compartilhados. Os campos Spider em `sprites.ts` e `cast-layout.ts` correspondem a `runtime-metadata.json`.

## Verificação

Passaram 14 testes do packer, 9 do rig, 7 de carry e 2 de retrato; 134 testes focados do cliente, além de typecheck e build do cliente. Os testes verificam máscara e passos originais, paleta somente de fontes existentes, ombro/cotovelo/punho ligados, ausência de membros soltos na apresentação, palmas visíveis, poses distintas, atlas promovido e direção do disparo de costas.

O Browser Bridge verificou a página local `/personagens`, com Homem-Aranha selecionado e as animações renderizadas. A inspeção visual cobriu os sprites e a apresentação; os pontos de encaixe da bomba foram verificados pelos testes e pelos pixels das palmas.
