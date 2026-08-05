"""Rasteriza o lockup SVG do Matter Academy em PNG, recortado no bounding box real.

    python scripts/svg-to-png.py <entrada.svg> <saida.png> <largura> [padding]

Clientes de e-mail não renderizam SVG, então o logo dos e-mails transacionais
sai daqui. Suporta apenas os comandos M/L/C/Z — o suficiente para este arquivo.
Preenchimento even-odd via XOR das submáscaras, com supersampling p/ antialias.
"""
import re
import sys

from PIL import Image, ImageDraw

SS = 4  # fator de supersampling
NUM = re.compile(r"-?\d*\.?\d+(?:[eE][-+]?\d+)?")


def parse(d):
    """Converte o atributo `d` em subpaths já achatados: [[(x, y), ...], ...]."""
    subpaths, cur = [], []
    x = y = 0.0
    start = (0.0, 0.0)
    for cmd, args in re.findall(r"([MLCZ])([^MLCZ]*)", d):
        n = [float(v) for v in NUM.findall(args)]
        if cmd == "M":
            if cur:
                subpaths.append(cur)
            x, y = n[0], n[1]
            start = (x, y)
            cur = [(x, y)]
            for i in range(2, len(n), 2):  # pares extras são lineto implícito
                x, y = n[i], n[i + 1]
                cur.append((x, y))
        elif cmd == "L":
            for i in range(0, len(n), 2):
                x, y = n[i], n[i + 1]
                cur.append((x, y))
        elif cmd == "C":
            for i in range(0, len(n), 6):
                x1, y1, x2, y2, x3, y3 = n[i:i + 6]
                x0, y0 = x, y
                span = max(abs(x3 - x0), abs(y3 - y0), abs(x1 - x0), abs(y1 - y0))
                steps = max(6, min(48, int(span / 2) + 6))
                for s in range(1, steps + 1):
                    t = s / steps
                    mt = 1 - t
                    a, b, c, e = mt ** 3, 3 * mt * mt * t, 3 * mt * t * t, t ** 3
                    cur.append((a * x0 + b * x1 + c * x2 + e * x3,
                                a * y0 + b * y1 + c * y2 + e * y3))
                x, y = x3, y3
        elif cmd == "Z":
            if cur:
                cur.append(start)
                subpaths.append(cur)
                cur = []
            x, y = start
    if cur:
        subpaths.append(cur)
    return [sp for sp in subpaths if len(sp) >= 3]


def render(src, out, target_w, pad=0.0):
    svg = open(src, encoding="utf-8").read()
    shapes = [(fill, parse(d)) for fill, d in re.findall(r'<path fill="(.*?)" d="(.*?)"', svg)]

    pts = [p for _, sps in shapes for sp in sps for p in sp]
    x0, x1 = min(p[0] for p in pts) - pad, max(p[0] for p in pts) + pad
    y0, y1 = min(p[1] for p in pts) - pad, max(p[1] for p in pts) + pad
    w, h = x1 - x0, y1 - y0

    scale = target_w / w
    W, H = target_w * SS, max(1, round(h * scale * SS))
    sx = W / w

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for fill, sps in shapes:
        mask = Image.new("L", (W, H), 0)
        for sp in sps:
            sub = Image.new("L", (W, H), 0)
            ImageDraw.Draw(sub).polygon(
                [((px - x0) * sx, (py - y0) * sx) for px, py in sp], fill=255
            )
            # even-odd: contornos internos viram furos
            mask = Image.frombytes("L", (W, H), bytes(
                a ^ b for a, b in zip(mask.tobytes(), sub.tobytes())
            ))
        layer = Image.new("RGBA", (W, H), tuple(int(fill[i:i + 2], 16) for i in (1, 3, 5)) + (0,))
        layer.putalpha(mask)
        canvas = Image.alpha_composite(canvas, layer)

    final = canvas.resize((target_w, max(1, round(h * scale))), Image.LANCZOS)
    final.save(out, optimize=True)
    print(f"{out}  {final.width}x{final.height}  (bbox {w:.0f}x{h:.0f})")


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2], int(sys.argv[3]),
           float(sys.argv[4]) if len(sys.argv) > 4 else 0.0)
