from pathlib import Path

import torch
from diffusers import StableDiffusionImg2ImgPipeline
from PIL import Image, ImageDraw


def main():
    folder = Path(__file__).resolve().parent
    output = folder / 'base-v2'
    output.mkdir(exist_ok=True)
    models = Path('C:/Users/jovipds/AI/pikachu-local/models')
    pipeline = StableDiffusionImg2ImgPipeline.from_single_file(
        str(models / 'v1-5-pruned-emaonly.safetensors'),
        config='stable-diffusion-v1-5/stable-diffusion-v1-5',
        torch_dtype=torch.float16,
    ).to('cuda')
    pipeline.load_lora_weights(str(models), weight_name='pikachu_lora_v1.safetensors', adapter_name='identity')
    pipeline.load_lora_weights(str(models / 'pixelart-redmond'), weight_name='PixelArtRedmond15V-PixelArt-PIXARFK.safetensors', adapter_name='style')
    frame = Image.open(folder / 'reference-front.png').convert('RGBA')
    reference = Image.new('RGB', (512, 512), '#efe0d7')
    enlarged = frame.resize((450, 410), Image.Resampling.NEAREST)
    reference.paste(enlarged, (31, 51), enlarged.getchannel('A'))
    prompt = 'Pikachu, blue triangular neck scarf, red cheeks, black tipped ears, yellow lightning tail, compact chibi game sprite, pixel art, PixArFK, dark outline, front view, full body, plain cream background'
    negative = 'text, watermark, lightning effects, sparks, bomb, extra limbs, duplicate character, realistic, 3d'
    preview = Image.new('RGB', (1024, 1064), '#efe0d7')
    draw = ImageDraw.Draw(preview)
    for index, (identity, style, strength) in enumerate([(0.15, 0.25, 0.28), (0.25, 0.35, 0.32), (0.15, 0.4, 0.38), (0.0, 0.3, 0.32)]):
        pipeline.set_adapters(['identity', 'style'], adapter_weights=[identity, style])
        with torch.inference_mode():
            result = pipeline(prompt=prompt, negative_prompt=negative, image=reference,
                              strength=strength, num_inference_steps=30, guidance_scale=6.5,
                              generator=torch.Generator(device='cuda').manual_seed(32187)).images[0]
        result.save(output / f'candidate-{index + 1}.png')
        x, y = (index % 2) * 512, (index // 2) * 532
        preview.paste(result, (x, y + 20))
        draw.text((x + 8, y + 4), f'{index + 1}: Pikachu {identity} / Pixel {style} / denoise {strength}', fill='black')
        preview.save(output / 'comparison.png')
        print(f'Candidate {index + 1}/4 saved', flush=True)


if __name__ == '__main__':
    main()

