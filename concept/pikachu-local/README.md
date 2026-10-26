# Pikachu — geração local

O atlas `pikachu-full-v1.png` foi produzido localmente com Stable Diffusion 1.5, Diffusers e uma RTX 5080, usando cada quadro do Pikachu original como referência de imagem. Os 108 quadros receberam sombreamento novo com baixa intensidade de transformação e proteção das cores do rosto, contornos e cachecol azul. As silhuetas e poses foram preservadas para manter as animações funcionais.

- Grade: 9 colunas × 18 linhas, células 180×164, atlas RGBA 1620×2952.
- Inventário: idle 4×3, caminhada 6×3, stun 6, derrota 7, cast 9×3, carry idle 4×3, carry walk 6×3 e lobby 8.
- Âncora no jogo: `(96, 157)`; escala: `0.145`.
- Alfa: somente 0 e 255, idêntico ao atlas anterior. 108 células ocupadas e 54 vazias.
- `pikachu-original.png`: cópia exata da versão anterior à substituição.
- `visual-qa.png`: comparação das poses originais e novas para inspeção.
- `pikachu-rXX-cYY-full-v1-sprite.png`: cada sprite separado da versão nova.

O modelo utilizado é `stable-diffusion-v1-5/stable-diffusion-v1-5`, arquivo `v1-5-pruned-emaonly.safetensors`. Um LoRA específico de Pikachu foi testado, mas a versão final utiliza somente o checkpoint-base porque preservou melhor os detalhes da referência.

Para regenerar com o ambiente isolado instalado nesta máquina, a partir da raiz do projeto:

```powershell
& 'C:\Users\jovipds\AI\pikachu-local\venv\Scripts\python.exe' 'concept\pikachu-local\generate-local.py' --sheet 'concept\pikachu-local\pikachu-original.png' --checkpoint 'C:\Users\jovipds\AI\pikachu-local\models\v1-5-pruned-emaonly.safetensors' --output-dir 'concept\pikachu-local' --steps 24 --strength 0.32 --blend 0.37 --variant full-v1 --all
python 'concept\pikachu-local\verify-local.py' --original 'concept\pikachu-local\pikachu-original.png' --candidate 'concept\pikachu-local\pikachu-full-v1.png'
```

Os quadros individuais existentes da mesma variante são reutilizados para permitir retomada. Para gerar uma nova variante, escolha outro valor para `--variant`.
