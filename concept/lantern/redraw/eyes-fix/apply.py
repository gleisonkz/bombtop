"""Apply PixelLab eye repairs inside their exact masks, freezing all other pixels."""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
ART = ROOT.parent


def main():
    ledger = json.loads((ROOT / "ledger.json").read_text())
    for batch in ledger:
        if not (ROOT / "results" / f"{batch['name']}.png").exists():
            raise ValueError(f"Inpaint still pending: {batch['name']}")
    changes = []
    for batch in ledger:
        repaired = Image.open(ROOT / "results" / f"{batch['name']}.png").convert("RGBA")
        for member in batch["members"]:
            name = member["pose"] + ".png"
            for source, target in (("before-generated", "generated"), ("before-raw", "raw")):
                image = Image.open(ROOT / source / name).convert("RGBA")
                before = image.copy()
                changed = 0
                left, top = member["crop"]
                tile_x, tile_y = member["tile"]
                for x0, y0, x1, y1 in member["boxes"]:
                    for y in range(y0, y1):
                        for x in range(x0, x1):
                            original = before.getpixel((x, y))
                            if not original[3]:
                                continue
                            corrected = repaired.getpixel((x - left + tile_x, y - top + tile_y))
                            if corrected[3] < 128:
                                raise ValueError(f"{name}: inpaint erased an opaque eye pixel")
                            pixel = (*corrected[:3], original[3])
                            image.putpixel((x, y), pixel)
                            changed += pixel != original
                if image.getchannel("A").tobytes() != before.getchannel("A").tobytes():
                    raise ValueError(f"{name}: alpha changed")
                image.save(ART / target / name)
                if target == "generated":
                    changes.append({"pose": member["pose"], "pixels": changed})
    (ROOT / "applied.json").write_text(json.dumps(changes, indent=2) + "\n")
    print(json.dumps({"poses": len(changes), "eye_pixels": sum(c["pixels"] for c in changes),
                      "outside_mask_pixels_changed": 0, "alpha_changed": False}))


if __name__ == "__main__":
    main()
