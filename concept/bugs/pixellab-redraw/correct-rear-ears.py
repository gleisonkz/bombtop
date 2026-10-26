"""Apply PixelLab's gray rear-ear edits only inside the original pink regions."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent


def main():
    destination = ROOT / "corrected/carryWalk-north"
    destination.mkdir(parents=True, exist_ok=True)
    for index in range(2, 7):
        original = np.array(Image.open(ROOT / "generated/carryWalk-north" / f"{index:02}.png"))
        edited = np.array(Image.open(ROOT / "generated" / f"earfix-{index}" / "00.png"))
        if edited.shape != original.shape:
            raise ValueError(f"earfix-{index}: edit changed canvas size")
        channels = original[:, :, :3].astype(int)
        mask = ((original[:, :, 3] > 0) & (channels[:, :, 0] - channels[:, :, 1] > 8)
                & (channels[:, :, 0] - channels[:, :, 2] > 2))
        mask[65:] = False
        if int(mask.sum()) < 5:
            raise ValueError(f"earfix-{index}: missing original pink ear mask")
        output = original.copy()
        output[mask, :3] = edited[mask, :3]
        if not np.array_equal(output[~mask], original[~mask]):
            raise ValueError("Unexpected change outside ear interiors")
        replacement = output[mask, :3].astype(int)
        if np.any((replacement[:, 0] - replacement[:, 1] > 8) &
                  (replacement[:, 0] - replacement[:, 2] > 2)):
            raise ValueError(f"earfix-{index}: pink remains in edited rear ears")
        Image.fromarray(output, "RGBA").save(destination / f"{index:02}.png")
        print(f"earfix-{index}: {int(mask.sum())} edited ear pixels, all other pixels and alpha unchanged")


if __name__ == "__main__":
    main()
