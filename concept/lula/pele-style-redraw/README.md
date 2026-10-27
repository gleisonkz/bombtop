# Lula — opção 1, estilo do novo Pelé

O usuário escolheu `../pele-style-preview/option-1.png` e autorizou refazer
todas as animações e aplicar no jogo da porta 5173. A imagem aprovada tem
128 × 160 pixels RGBA. As gerações usam seus pixels reais pelo MCP PixelLab.

## Contrato de produção

- Atlas 1728 × 3456 RGBA: 9 colunas, 18 linhas, células 192 × 192.
- 108 células ocupadas; caudas de linha transparentes.
- Fontes nativas centralizadas horizontalmente, com padding vertical 16 px;
  para 128 × 160, posição (32,16). Sem normalização de tamanho por quadro.
- Âncora (96,155), corpo 120, escala de exibição 0.1806: altura de arena
  preservada em 21.672 pixels, equivalente aos antigos 172 × 0.126.
- Idle frente/lado/costas: 4 cada; caminhada: 6 cada; tonto 6; derrota 7.
- Especial frente/lado/costas: 9 cada. O item picanha pertence ao jogo,
  portanto a animação só mostra o gesto das mãos vazias.
- Transporte parado: 4 cada; andando: 6 cada; comemoração com “L”: 8.
- Lado esquerdo continua espelhando o lado direito no renderizador.

`jobs.json` registra gerações e referências. Idle usa os quatro primeiros
quadros da sequência de cinco; caminhada, tonto e transporte andando usam
os seis gerados após a pose inicial. Demais ações incluem a pose inicial.
A primeira célula preserva exatamente os pixels da opção 1 aprovada.

Os metadados de menu, retrato e mãos são revistos junto com a folha. Fontes
e hashes ficam preservados; o arquivo anterior está em `before-integration`.
`pack.py` exige todas as fontes antes de produzir o candidato. `integrate.py`
faz substituições somente no Lula e confere hashes para evitar sobrescrever
uma edição concorrente. O fluxo segue os contratos descritos pelas ferramentas
PixelLab `create_character` (rotação da referência v3) e `animate_image`
(pose inicial intacta seguida dos quadros gerados).

## Reprodução e revisão

```powershell
python concept/lula/pele-style-redraw/pack.py
python apps/client/scripts/test-lula-option1.py
python concept/lula/pele-style-redraw/measure-palms.py
python concept/lula/pele-style-redraw/build-color-protection.py
```

As imagens em `qa/color/` mostram a camisa em verde e os retângulos de
proteção do rosto. Após revisar todas as células, exportar com
`build-color-protection.py --write --reviewed DIGEST` usando o digest impresso.
O JSON contém o hash do candidato: o integrador rejeita regiões de outra versão.
Isso preserva os pixels aprovados do rosto e usa a proteção de cores já
existente no renderizador. `palm-review.png` mostra cada ponto de apoio.

```powershell
python concept/lula/pele-style-redraw/integrate.py
python apps/client/scripts/build-carry-anchors.py --character lula
python concept/lula/pele-style-redraw/preview.py
```

`lula-preview.gif` reproduz doze sequências do atlas. Fontes rejeitadas são
preservadas em pastas `generated/*-rejected-*`, fora do empacotamento;
seus IDs constam de `jobs.json`. São substituídas apenas as sequências com
defeito, sem simular novos movimentos com quadros repetidos.
