import argparse
import hashlib

import numpy as np
from PIL import Image


FRAME_WIDTH = 180
FRAME_HEIGHT = 164
ROW_COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)


def frame(data, row, column):
    return data[
        row * FRAME_HEIGHT : (row + 1) * FRAME_HEIGHT,
        column * FRAME_WIDTH : (column + 1) * FRAME_WIDTH,
    ]


def fingerprint(data):
    return hashlib.sha256(data.tobytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--original", required=True)
    parser.add_argument("--candidate", required=True)
    args = parser.parse_args()

    original = np.asarray(Image.open(args.original).convert("RGBA"))
    candidate = np.asarray(Image.open(args.candidate).convert("RGBA"))
    assert original.shape == candidate.shape == (2952, 1620, 4)
    assert np.array_equal(original[:, :, 3], candidate[:, :, 3])
    assert set(np.unique(candidate[:, :, 3])) == {0, 255}

    visible = original[:, :, 3] != 0
    different = (original[:, :, :3] != candidate[:, :, :3]).any(axis=2) & visible
    assert different.sum() > 0
    protected = (
        (original[:, :, 0] > original[:, :, 1] * 1.65)
        | (original[:, :, 2] > original[:, :, 0] * 1.35)
        | (original[:, :, :3].max(axis=2) < 110)
    ) & visible
    assert np.array_equal(original[:, :, :3][protected], candidate[:, :, :3][protected])

    for row, count in enumerate(ROW_COUNTS):
        previous = []
        generated = []
        for column in range(9):
            current = frame(candidate, row, column)
            reference = frame(original, row, column)
            if column < count:
                assert current[:, :, 3].any(), (row, column, "missing frame")
                previous.append(fingerprint(reference))
                generated.append(fingerprint(current))
            else:
                assert not current[:, :, 3].any(), (row, column, "unexpected frame")
        assert len(set(previous)) == len(set(generated)), (row, "animation holds changed")
        print(f"row={row:02d} frames={count} unique={len(set(generated))}")

    print(f"accepted: 108 frames, 54 blank cells, {int(different.sum())} recolored opaque pixels")


if __name__ == "__main__":
    main()
