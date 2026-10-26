# Homem-Aranha — spritesheet PixelLab

Atlas ativo: `apps/client/public/sprites/spider.png`. **108 quadros RGBA**, grade 9×18, células 130×161, âncora (64,5;155). Todas as poses são somente o personagem; objetos, bombas, teias e efeitos pertencem ao jogo.

## Origem

Personagem original PixelLab: https://www.pixellab.ai/create-character/439a18c5-85aa-4455-ac5a-f40f73947f85

Foram preservados **61 frames do free tier**, linhas 0–9, com os mesmos pixels. **47 poses novas** geradas pela API PixelLab substituem o disparo de costas, o transporte parado/andando nas três direções e a apresentação. As fontes antigas permanecem em `export/`; o rig anterior foi arquivado e não participa do atlas ativo.

As poses novas estão em `api-generated/`. `provenance.json` registra os índices escolhidos e hashes de origem. Os arquivos em `packed-sources/` somente retiram margem transparente e completam a tela para 96×96, sem redimensionar ou reconstruir membros. O empacotamento usa nearest-neighbor 2× e uma translação fixa por linha. Nenhum frame do atlas ativo contém a bolinha cinza da tentativa rejeitada.

## Posições do jogo

| Linhas (base zero) | Ação | Quadros por linha |
| --- | --- | --- |
| 0–2 | Parado: frente, direita, costas | 4 |
| 3–5 | Andando: frente, direita, costas | 6 |
| 6 | Dano | 6 |
| 7 | Derrota | 7 |
| 8–10 | Disparo: frente, direita, costas | 9 |
| 11–13 | Transporte parado: frente, direita, costas | 4 |
| 14–16 | Transporte andando: frente, direita, costas | 6 |
| 17 | Apresentação | 8 |

O lado esquerdo é espelhado pelo renderer. Células excedentes permanecem transparentes. Os pontos das palmas foram registrados novamente; os olhos claros estão protegidos na troca da cor do traje. O disparo de costas usa sua nova posição de mão.

## Reprodução

Não executar `rig-spider-pixellab.py` para esta versão: ele representa o método convencional anterior e substitui o mapeamento.

```powershell
python concept/spider/pixellab/integrate-api.py
python apps/client/scripts/pack-spider-pixellab.py --output concept/spider/pixellab/spider-candidate.png > concept/spider/pixellab/candidate-report.json
python apps/client/scripts/finalize-spider-pixellab.py --promote
python apps/client/scripts/build-carry-anchors.py --character spider
```

`collect-api.py` apenas baixa jobs existentes; não inicia gerações. A chave permanece no ambiente Windows `PIXELLAB_API_KEY`, fora do projeto. Os arquivos `api-*-job.json` registram os identificadores dos jobs. Tentativas rejeitadas não são referenciadas pelo manifesto.

## Revisão

A pedido do usuário, a aprovação visual detalhada será feita por ele no spritesheet final. Foram verificadas grade, transparência, recortes, contagens, preservação das linhas do free tier e correspondência das palmas com os pixels. Prévias em `api-generated/carry-preview.gif` e `presentation-preview.gif` são montadas diretamente das células de produção.
