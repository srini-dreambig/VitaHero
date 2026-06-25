"""Make the edge-connected (background) white of a PNG transparent.

Flood-fills near-white starting from the image borders, so interior whites
(eyes, outlines, badge) are preserved. Usage: python make_transparent.py <png> [thresh]
"""
import sys
from collections import deque
from PIL import Image


def make_transparent(path: str, thresh: int = 232) -> None:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    visited = bytearray(w * h)

    def is_white(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return a > 0 and r >= thresh and g >= thresh and b >= thresh

    dq: deque = deque()

    def seed(x: int, y: int) -> None:
        i = y * w + x
        if not visited[i] and is_white(x, y):
            visited[i] = 1
            dq.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while dq:
        x, y = dq.popleft()
        r, g, b, a = px[x, y]
        px[x, y] = (r, g, b, 0)
        if x + 1 < w:
            seed(x + 1, y)
        if x - 1 >= 0:
            seed(x - 1, y)
        if y + 1 < h:
            seed(x, y + 1)
        if y - 1 >= 0:
            seed(x, y - 1)

    img.save(path)
    print("transparent ->", path)


if __name__ == "__main__":
    p = sys.argv[1]
    t = int(sys.argv[2]) if len(sys.argv) > 2 else 232
    make_transparent(p, t)
