"""Clear near-white fill inside the lower wordmark band of the logo.

The earlier edge flood-fill left enclosed white letter counters (holes in a/e/o/r)
opaque. The wordmark sits below the mascot/shield, so we can safely make near-white
transparent only in the lower band without harming the mascot's legitimate whites.

Usage: python clear_text_fill.py <png> [y0_fraction=0.60] [threshold=234]
"""
import sys
from PIL import Image


def clear_band(path: str, y0f: float = 0.60, thr: int = 234) -> None:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    y0 = int(h * y0f)
    cleared = 0
    for y in range(y0, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and r >= thr and g >= thr and b >= thr:
                px[x, y] = (r, g, b, 0)
                cleared += 1
    img.save(path)
    print(f"cleared {cleared} px below y={y0} (of {w}x{h})")


if __name__ == "__main__":
    p = sys.argv[1]
    y0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0.60
    t = int(sys.argv[3]) if len(sys.argv) > 3 else 234
    clear_band(p, y0, t)
