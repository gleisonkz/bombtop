"""Local CUDA generation and isolated pixel-art cleanup comparisons; never edits runtime."""
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as functional
from diffusers import StableDiffusionImg2ImgPipeline
from PIL import Image, ImageDraw


def flatten_cuda(image):
    data = torch.from_numpy(np.array(image).copy()).float().to('cuda').permute(2, 0, 1)[None]
    padded = functional.pad(data, (2, 2, 2, 2), mode='replicate')
    means, variances = [], []
    for y, x in [(0, 0), (0, 2), (2, 0), (2, 2)]:
        region = padded[:, :, y:y + 514, x:x + 514]
        mean = functional.avg_pool2d(region, 3, stride=1)
        variance = (functional.avg_pool2d(region.square(), 3, stride=1) - mean.square()).mean(1, keepdim=True)
        means.append(mean)
        variances.append(variance)
    selected = torch.stack(variances).argmin(0, keepdim=True).expand(1, 1, 3, 512, 512)
    result = torch.stack(means).gather(0, selected)[0, 0].permute(1, 2, 0)
    return Image.fromarray(result.clamp(0, 255).byte().cpu().numpy())


def main():
    folder = Path(__file__).resolve().parent
    output = folder / 'clean-pipeline-v1'
    output.mkdir(exist_ok=True)
    models = Path('C:/Users/jovipds/AI/pikachu-local/models')
    assert torch.cuda.is_available(), 'CUDA is required'
    print('GPU:', torch.cuda.get_device_name(), flush=True)
    pipeline = StableDiffusionImg2ImgPipeline.from_single_file(
        str(models / 'v1-5-pruned-emaonly.safetensors'),
        config='stable-diffusion-v1-5/stable-diffusion-v1-5', torch_dtype=torch.float16,
    ).to('cuda')
    pipeline.load_lora_weights(str(models), weight_name='pikachu_lora_v1.safetensors', adapter_name='identity')
    pipeline.load_lora_weights(str(models / 'pixelart-redmond'), weight_name='PixelArtRedmond15V-PixelArt-PIXARFK.safetensors', adapter_name='style')
    pipeline.set_adapters(['identity', 'style'], adapter_weights=[0.15, 0.25])
    pipeline.set_progress_bar_config(disable=True)
    frame = Image.open(folder / 'reference-front.png').convert('RGBA')
    prompt = 'Pikachu, blue triangular neck scarf, red cheeks, black tipped ears, yellow lightning tail, compact chibi game sprite, pixel art, PixArFK, dark outline, front view, full body, plain cream background'
    negative = 'text, watermark, lightning effects, sparks, bomb, extra limbs, duplicate character, realistic, 3d'
    results = []
    for label, size, steps in [('A - baseline', (450, 410), 30), ('B - integer scale', (360, 328), 30), ('C - integer + more steps', (360, 328), 80)]:
        reference = Image.new('RGB', (512, 512), '#efe0d7')
        enlarged = frame.resize(size, Image.Resampling.NEAREST)
        box = ((512 - size[0]) // 2, (512 - size[1]) // 2)
        reference.paste(enlarged, box, enlarged.getchannel('A'))
        with torch.inference_mode():
            generated = pipeline(prompt=prompt, negative_prompt=negative, image=reference,
                                 strength=0.28, num_inference_steps=steps, guidance_scale=6.5,
                                 generator=torch.Generator(device='cuda').manual_seed(32187)).images[0]
        generated.save(output / f'{label[0]}-source.png')
        results.append((label, generated))
        print(label, 'saved; effective steps', int(steps * 0.28), flush=True)

    final_source = results[-1][1]
    # Palette is learned from the approved game sprite, not from noisy generated backgrounds.
    visible = np.asarray(frame)[np.asarray(frame)[:, :, 3] > 0, :3]
    palette_image = Image.fromarray(visible.reshape(1, -1, 3)).quantize(colors=24, dither=Image.Dither.NONE)

    def finish(image, palette=False):
        native = image.resize((128, 128), Image.Resampling.NEAREST)
        if palette:
            native = native.quantize(palette=palette_image, dither=Image.Dither.NONE).convert('RGB')
        return native.resize((512, 512), Image.Resampling.NEAREST)

    results.append(('D - grid + game palette', finish(final_source, True)))
    flat = flatten_cuda(final_source)
    results.append(('E - edge-preserving cleanup', flat))
    results.append(('F - combined pipeline', finish(flat, True)))
    board = Image.new('RGB', (1200, 856), '#efe0d7')
    draw = ImageDraw.Draw(board)
    for index, (label, image) in enumerate(results):
        image.save(output / f'{label[0]}-result.png')
        x, y = index % 3 * 400, index // 3 * 428
        draw.text((x + 10, y + 8), label, fill='#202020')
        board.paste(image.resize((400, 400), Image.Resampling.NEAREST), (x, y + 28))
    board.save(output / 'comparison.png')
    metadata = {'gpu': torch.cuda.get_device_name(), 'seed': 32187, 'strength': 0.28,
                'identity_lora': 0.15, 'style_lora': 0.25, 'palette_colors': 24,
                'note': 'Previews with opaque background, not production sprites or trained custom LoRA.'}
    (output / 'settings.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print('Six-way comparison saved', flush=True)


if __name__ == '__main__':
    main()
