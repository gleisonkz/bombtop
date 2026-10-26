# Pantera Cor-de-Rosa — opção 2 aprovada

Personagem PixelLab: `d4a3e349-0c83-4c42-a0e3-72b4b85ff355`.
Referência: `../pixellab-preview/option-2.png`, preservada sem redimensionamento em `approved-reference.png` (somente margem transparente para160×160).

Todas as poses foram geradas novamente no PixelLab usando o personagem aprovado, mantendo tronco estreito, membros finos, focinho alongado e cauda longa. As imagens antigas não são fontes do novo atlas. Não há cachecol, objetos ou efeitos incorporados; a furtividade e as bombas continuam no renderer do jogo.

## Contrato integrado

- `panther.png`: 1568×3808 RGBA, 7×17 células224×224, âncora(112,208), **91 quadros**.
- Linhas0–2 parado4;3–5 caminhada6;6dano6;7derrota7;8–10furtividade6;11–13transporte parado4;14–16transporte andando6.
- Direções frente, direita, costas; o renderer espelha a direita para a esquerda.
- `panther-lobby.png`:3584×224,16 células224×224;14 poses geradas, pose inicial fornecida e um hold final intencional. A vitória usa essa mesma apresentação, conforme o contrato existente.
- Altura do corpo126px, escala0,17009524, preservando a altura aparente anterior de21,432px. O corpo não foi alargado nem esticado.
- Native pixels1×, sem redimensionamento por quadro. Uma translação fixa por linha mantém o registro. As margens e células excedentes são transparentes.

## Arquivos

`submitted.json` mantém os jobs e descrições enviados. `generated/` guarda os frames retornados. `manifest.json` faz o mapeamento explícito; `candidate-report.json` registra hashes e posições. `palms.json` contém50 pontos visíveis nas30 poses de transporte. `runtime.json` resume escala e dimensões. Os arquivos `before-*` preservam os atlas anteriores.

## Reprodução

```powershell
python concept/pink-panther/pixellab-redraw/pipeline.py collect
python concept/pink-panther/pixellab-redraw/finalize.py --promote
python apps/client/scripts/build-carry-anchors.py --character panther
```

`pipeline.py collect` apenas coleta jobs existentes. `submit-base` e `submit-idle` iniciam gerações somente para clips ausentes do ledger; exigem chave `PIXELLAB_API_KEY` no ambiente Windows. Nenhuma chave é gravada no projeto.

O finalizador atualiza somente Pantera nas tabelas compartilhadas. As dimensões e escala de `SHEETS.panther` e `CAST_BODY_HEIGHT.panther` devem acompanhar `runtime.json` quando a geometria mudar.

## Verificação

8 testes do packer e2 de retratos passaram.163 testes focados do cliente e o typecheck passaram. Foram conferidos107 quadros, fontesRGBA, transparência, ausência de recortes e igualdade entre candidato e produção; os sockets de transporte são reproduzíveis. A aprovação visual detalhada do movimento fica com o usuário, conforme solicitado.

Prévias: `walk-preview.gif`, `carry-preview.gif`, `menu-preview.gif`.
Referência técnica usada: https://api.pixellab.ai/v2/llms.txt e o schema oficial de `/characters/animations`; o limite14frames do modelo no canvas188px determinou o hold explícito da apresentação, sem repetir poses de ação para simular geração nova.
