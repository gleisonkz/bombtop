from pathlib import Path

import torch
from diffusers import StableDiffusionImg2ImgPipeline, DPMSolverMultistepScheduler, DDIMScheduler
from PIL import Image, ImageDraw


def main():
    folder = Path(__file__).resolve().parent
    output = folder / 'refine-b-v1'
    output.mkdir(exist_ok=True)
    models = Path('C:/Users/jovipds/AI/pikachu-local/models')
    assert torch.cuda.is_available()
    print(torch.cuda.get_device_name(), flush=True)
    pipe = StableDiffusionImg2ImgPipeline.from_single_file(
        str(models / 'v1-5-pruned-emaonly.safetensors'),
        config='stable-diffusion-v1-5/stable-diffusion-v1-5', torch_dtype=torch.float16,
    ).to('cuda')
    pipe.load_lora_weights(str(models / 'pixelart-redmond'),
                           weight_name='PixelArtRedmond15V-PixelArt-PIXARFK.safetensors', adapter_name='style')
    pipe.set_adapters('style', adapter_weights=0.15)
    pipe.set_progress_bar_config(disable=True)
    base = Image.open(folder / 'clean-pipeline-v1/B-source.png').convert('RGB')
    prompt = 'Pikachu, blue neck scarf, clean dark brown outline, clear black round eyes with crisp white highlights, tiny smiling mouth, red circular cheeks, yellow fur, compact chibi game sprite, simple flat colors, clean pixel art, PixArFK, front view'
    negative = 'blurry eyes, grain, speckles, sketch, fuzzy outline, noisy texture, extra eyes, extra limbs, text, electricity, photorealistic'
    config = pipe.scheduler.config
    results = [('B - approved shape', base)]
    settings = [('1 - DPM gentle', 'dpm', 0.16, 4.0), ('2 - DPM stronger', 'dpm', 0.24, 5.0),
                ('3 - DDIM gentle', 'ddim', 0.16, 4.0), ('4 - DDIM stronger', 'ddim', 0.24, 5.0)]
    for label, method, strength, cfg in settings:
        pipe.scheduler = (DPMSolverMultistepScheduler.from_config(config, algorithm_type='dpmsolver++', use_karras_sigmas=True)
                          if method == 'dpm' else DDIMScheduler.from_config(config))
        with torch.inference_mode():
            result = pipe(prompt=prompt, negative_prompt=negative, image=base,
                          num_inference_steps=100, strength=strength, guidance_scale=cfg,
                          generator=torch.Generator(device='cuda').manual_seed(42199)).images[0]
        result.save(output / f'{label[0]}-source.png')
        results.append((label, result))
        print(label, 'saved', flush=True)
    board = Image.new('RGB', (1500, 420), '#efe0d7')
    draw = ImageDraw.Draw(board)
    for index, (label, result) in enumerate(results):
        draw.text((index * 300 + 8, 8), label, fill='black')
        # Identical crop and integer display scale for all five proposals.
        crop = result.crop((146, 86, 366, 406))
        board.paste(crop.resize((264, 384), Image.Resampling.NEAREST), (index * 300 + 18, 30))
    board.save(output / 'comparison.png')


if __name__ == '__main__':
    main()
