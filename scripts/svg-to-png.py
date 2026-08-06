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


def rasterize(src, target_w_px):
    """Rasteriza o SVG em `target_w_px` de largura, com supersampling. Devolve
    (imagem RGBA recortada no bbox real, largura, altura do bbox em unidades SVG)."""
    svg = open(src, encoding="utf-8").read()
    shapes = [(fill, parse(d)) for fill, d in re.findall(r'<path fill="(.*?)" d="(.*?)"', svg)]

    pts = [p for _, sps in shapes for sp in sps for p in sp]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    w, h = x1 - x0, y1 - y0

    scale = target_w_px / w
    W, H = target_w_px * SS, max(1, round(h * scale * SS))
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

    final = canvas.resize((target_w_px, max(1, round(h * scale))), Image.LANCZOS)
    return final, w, h


def render(src, out, target_w, pad=0.0):
    """Recorta no bounding box real do desenho (com padding opcional em
    unidades SVG) e salva com fundo transparente."""
    logo, w, h = rasterize(src, target_w)
    if pad:
        # padding em unidades SVG -> pixels de saída, nas 4 bordas
        px = round(pad * (target_w / w))
        padded = Image.new("RGBA", (logo.width + 2 * px, logo.height + 2 * px), (0, 0, 0, 0))
        padded.paste(logo, (px, px), logo)
        logo = padded
    logo.save(out, optimize=True)
    print(f"{out}  {logo.width}x{logo.height}  (bbox {w:.0f}x{h:.0f})")


def render_banner(src, out, canvas_w, canvas_h, bg_hex, logo_ratio=0.58):
    """Compõe o logo centralizado sobre um fundo sólido opaco, no tamanho
    exato de canvas_w x canvas_h. `logo_ratio` é a fração da largura do
    canvas que o logo ocupa."""
    bg_rgb = tuple(int(bg_hex[i:i + 2], 16) for i in (1, 3, 5))
    banner = Image.new("RGB", (canvas_w, canvas_h), bg_rgb)

    logo_w_px = round(canvas_w * logo_ratio)
    logo, _, _ = rasterize(src, logo_w_px)

    # se a altura resultante não couber com folga vertical, reduz pela altura.
    max_h = round(canvas_h * 0.72)
    if logo.height > max_h:
        scale = max_h / logo.height
        logo = logo.resize((round(logo.width * scale), max_h), Image.LANCZOS)

    x = (canvas_w - logo.width) // 2
    y = (canvas_h - logo.height) // 2
    banner.paste(logo, (x, y), logo)
    banner.save(out, optimize=True)
    print(f"{out}  {banner.width}x{banner.height}  logo {logo.width}x{logo.height} @ ({x},{y})")


if __name__ == "__main__":
    if len(sys.argv) >= 6 and sys.argv[3] == "--banner":
        # svg-to-png.py <in.svg> <out.png> --banner <largura> <altura> [bg_hex] [logo_ratio]
        render_banner(
            sys.argv[1], sys.argv[2], int(sys.argv[4]), int(sys.argv[5]),
            sys.argv[6] if len(sys.argv) > 6 else "#0b0c0e",
            float(sys.argv[7]) if len(sys.argv) > 7 else 0.58,
        )
    else:
        render(sys.argv[1], sys.argv[2], int(sys.argv[3]),
               float(sys.argv[4]) if len(sys.argv) > 4 else 0.0)
