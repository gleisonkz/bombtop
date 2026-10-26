import argparse
from pathlib import Path

import numpy as np
import torch
from diffusers import StableDiffusionImg2ImgPipeline
from PIL import Image


FRAME_WIDTH = 180
FRAME_HEIGHT = 164
ROW_COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)
MODEL_WIDTH = 512
MODEL_HEIGHT = 512
SOURCE_BOX = (31, 51, 481, 461)
PROMPT = (
    "Pikachu Pokemon sprite, bright blue neck scarf, red cheeks, black-tipped ears, "
    "yellow fur, dark expressive eyes, lightning bolt tail, tiny paws, "
    "accurate compact chibi proportions and the precise reference pose, "
    "16-bit SNES Bomberman pixel art, crisp brown outlines, delicate pixel clusters, "
    "single centered character on plain cream background"
)
NEGATIVE_PROMPT = (
    "blurry, vector art, realistic, 3d, extra ears, extra limbs, cut off, "
    "sparks, special effects, labels, text, watermark, duplicate characters"
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheet", required=True)
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--row", type=int, default=0)
    parser.add_argument("--column", type=int, default=0)
    parser.add_argument("--steps", type=int, default=28)
    parser.add_argument("--strength", type=float, default=0.42)
    parser.add_argument("--seed", type=int, default=8273)
    parser.add_argument("--lora")
    parser.add_argument("--lora-scale", type=float, default=0.65)
    parser.add_argument("--variant", default="base")
    parser.add_argument("--blend", type=float, default=0.4)
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    source = Image.open(args.sheet).convert("RGBA")
    print("Loading the local Stable Diffusion checkpoint", flush=True)
    pipeline = StableDiffusionImg2ImgPipeline.from_single_file(
        args.checkpoint,
        config="stable-diffusion-v1-5/stable-diffusion-v1-5",
        torch_dtype=torch.float16,
        safety_checker=None,
        requires_safety_checker=False,
    ).to("cuda")
    if args.lora:
        pipeline.load_lora_weights(args.lora, weight_name="pikachu_lora_v1.safetensors", adapter_name="pikachu")
        pipeline.set_adapters("pikachu", adapter_weights=args.lora_scale)
    pipeline.set_progress_bar_config(disable=True)
    positions = (
        [(row, column) for row, count in enumerate(ROW_COUNTS) for column in range(count)]
        if args.all
        else [(args.row, args.column)]
    )
    spritesheet = Image.new("RGBA", source.size, (0, 0, 0, 0)) if args.all else None
    for index, (row, column) in enumerate(positions, 1):
        left = column * FRAME_WIDTH
        top = row * FRAME_HEIGHT
        frame = source.crop((left, top, left + FRAME_WIDTH, top + FRAME_HEIGHT))
        if frame.getbbox() is None:
            raise ValueError(f"The selected frame {row}, {column} is transparent")
        stem = f"pikachu-r{row:02d}-c{column:02d}-{args.variant}"
        sprite_path = output_dir / f"{stem}-sprite.png"
        if args.all and sprite_path.exists():
            native = Image.open(sprite_path).convert("RGBA")
        else:
            enlarged = frame.resize((450, 410), Image.Resampling.NEAREST)
            background = Image.new("RGB", (MODEL_WIDTH, MODEL_HEIGHT), (239, 224, 215))
            background.paste(enlarged, SOURCE_BOX[:2], enlarged.getchannel("A"))
            generator = torch.Generator(device="cuda").manual_seed(args.seed)
            with torch.inference_mode():
                image = pipeline(
                    prompt=PROMPT,
                    negative_prompt=NEGATIVE_PROMPT,
                    image=background,
                    strength=args.strength,
                    guidance_scale=6.5,
                    num_inference_steps=args.steps,
                    generator=generator,
                ).images[0]
            if not args.all or column == 0:
                image.save(output_dir / f"{stem}-source.png")
            native = image.crop(SOURCE_BOX).resize((90, 82), Image.Resampling.LANCZOS)
            native = native.resize((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.NEAREST)
            original_pixels = np.asarray(frame, dtype=np.uint8)
            painted_pixels = np.asarray(native.convert("RGB"), dtype=np.uint8)
            blended_pixels = np.rint(
                original_pixels[:, :, :3] * (1.0 - args.blend) + painted_pixels * args.blend
            ).astype(np.uint8)
            native = Image.fromarray(blended_pixels, "RGB")
            native = native.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
            native = native.convert("RGB")
            restored_pixels = np.asarray(native).copy()
            red = original_pixels[:, :, 0] > original_pixels[:, :, 1] * 1.65
            blue = original_pixels[:, :, 2] > original_pixels[:, :, 0] * 1.35
            dark = original_pixels[:, :, :3].max(axis=2) < 110
            protected = red | blue | dark
            restored_pixels[protected] = original_pixels[:, :, :3][protected]
            native = Image.fromarray(restored_pixels, "RGB")
            native.putalpha(frame.getchannel("A").point(lambda a: 255 if a >= 128 else 0))
            native.save(sprite_path)
        if spritesheet is not None:
            spritesheet.paste(native, (left, top))
        if not args.all or column == ROW_COUNTS[row] - 1:
            print(f"Completed {index}/{len(positions)} Pikachu frames", flush=True)

    if spritesheet is not None:
        spritesheet.save(output_dir / f"pikachu-{args.variant}.png")
        print(f"Saved complete spritesheet pikachu-{args.variant}.png", flush=True)


if __name__ == "__main__":
    main()
