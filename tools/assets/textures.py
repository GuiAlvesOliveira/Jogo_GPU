# ============================================================
#  textures.py — Texturas do mapa + atlas de efeitos (Python + Pillow)
# ------------------------------------------------------------
#  Uso: python textures.py <raw_dir> <out_dir>
#
#  1) Camadas do mapa: cada textura vira 512x512 (JPG). O jogo as
#     empilha numa TEXTURE ARRAY (uma camada por material), então
#     todas precisam ter o mesmo tamanho.
#  2) Normal maps: usa o normal map original quando existe; senão,
#     gera um a partir da luminância (altura aproximada) com Sobel.
#  3) fx_atlas.png: sprites procedurais (clarão do tiro, faísca,
#     fumaça, sangue, marcas de bala, chama) + faixas de raio.
# ============================================================
import sys, os, math
import numpy as np
from PIL import Image, ImageFilter

RAW, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
SIZE = 512

W = lambda n: os.path.join(RAW, 'wests', n)
T = lambda n: os.path.join(RAW, 'tileset', 'textures', n)

# nome da camada → (albedo, normal original ou None, recorte opcional)
LAYERS = [
    ('camp_wall',   W('wood wall 1.png'), None, 'top'),
    ('camp_floor',  W('wood floor 2.png'), None, None),
    ('camp_ceil',   W('planks.png'), None, None),
    ('sewer_wall',  W('stone wall 1.png'), None, None),
    ('sewer_floor', W('paving 2.png'), None, None),
    ('sewer_ceil',  W('stone 2.png'), None, None),
    ('water',       T('Water.png'), T('Water_nor.png'), None),
    ('cata_wall',   W('stone wall 6.png'), None, None),
    ('cata_wall2',  W('stone wall 7.png'), None, None),
    ('cata_floor',  T('ClaimedE.png'), T('Claimed_nor2.png'), None),
    ('cata_ceil',   W('stone 1.png'), None, None),
    ('mine_wall',   T('Rock_col.png'), T('Rock_nor.png'), None),
    ('mine_floor',  T('Dirt_darkE.png'), T('Dirt_dark_nor3.png'), None),
    ('gold',        T('Gold_smallerdetails.png'), T('Gold_nor6.png'), None),
    ('mine_ceil',   W('rock 6.png'), None, None),
    ('forge_wall',  T('Claimedwall2C.png'), T('Claimedwall2_nor3.png'), None),
    ('forge_floor', W('stone wall 10.png'), None, None),
    ('lava',        T('Lava5B6.png'), T('Lava_nor.png'), None),
    ('forge_ceil',  W('rock 2.png'), None, None),
    ('door',        W('planks.png'), None, 'rot90'),
    ('crate',       W('wood floor 1.png'), None, None),
    ('metal',       W('paneling.png'), None, None),
    ('tile',        W('paving 6.png'), None, None),
    ('cata_wall3',  W('stone wall 9.png'), None, None),
]


def load_rgb(path, crop=None):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    if crop == 'top':
        im = im.crop((0, 0, w, min(w, h)))
    elif crop == 'bottom':
        im = im.crop((0, h - min(w, h), w, h))
    elif crop == 'rot90':
        im = im.rotate(90, expand=True)
    elif w != h:  # recorte central quadrado
        s = min(w, h)
        im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    return im.resize((SIZE, SIZE), Image.LANCZOS)


def make_seamless(im):
    """Mistura as bordas (tile) para diminuir a costura na repetição."""
    a = np.asarray(im).astype(np.float32)
    b = np.roll(np.roll(a, SIZE // 2, 0), SIZE // 2, 1)
    y = np.abs(np.linspace(-1, 1, SIZE))
    m = np.clip((np.maximum(y[:, None], y[None, :]) - 0.8) / 0.2, 0, 1)[..., None]
    return Image.fromarray(np.clip(a * (1 - m) + b * m, 0, 255).astype(np.uint8))


def normal_from_albedo(im, strength=2.2):
    g = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255.0
    dx = (np.roll(g, -1, 1) - np.roll(g, 1, 1)) * 0.5
    dy = (np.roll(g, -1, 0) - np.roll(g, 1, 0)) * 0.5
    nx, ny, nz = -dx * strength * 8, -dy * strength * 8, np.ones_like(g)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / l, ny / l, nz / l], -1)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))


for name, alb, nor, crop in LAYERS:
    a = load_rgb(alb, crop)
    if name in ('camp_floor', 'sewer_ceil', 'cata_ceil', 'mine_ceil', 'forge_ceil', 'crate'):
        a = make_seamless(a)
    a.save(os.path.join(OUT, f'L_{name}.jpg'), quality=88)
    n = load_rgb(nor) if nor else normal_from_albedo(a)
    n.save(os.path.join(OUT, f'N_{name}.jpg'), quality=92)
    print('layer', name)

# ------------------------------------------------------------ FX atlas
A = 1024
C = 256  # célula
atlas = np.zeros((A, A, 4), np.float32)
yy, xx = np.mgrid[0:C, 0:C].astype(np.float32)
u = (xx + 0.5) / C * 2 - 1
v = (yy + 0.5) / C * 2 - 1
r = np.sqrt(u * u + v * v)
ang = np.arctan2(v, u)
rng = np.random.default_rng(7)


def put(cell, rgba):
    cx, cy = cell % 4, cell // 4
    atlas[cy * C:(cy + 1) * C, cx * C:(cx + 1) * C] = rgba


def noise2(scale, octaves=4, seed=0):
    g = np.zeros((C, C), np.float32)
    r2 = np.random.default_rng(seed)
    amp = 1.0
    for o in range(octaves):
        n = r2.random((scale * 2 ** o + 1, scale * 2 ** o + 1)).astype(np.float32)
        im = Image.fromarray((n * 255).astype(np.uint8)).resize((C, C), Image.BICUBIC)
        g += np.asarray(im).astype(np.float32) / 255 * amp
        amp *= 0.5
    return g / g.max()


# 0: brilho redondo (faíscas, halos)
glow = np.clip(1 - r, 0, 1) ** 2.2
put(0, np.stack([glow, glow, glow, glow], -1))
# 1: clarão do tiro (estrela com raios)
rays = np.clip(1 - r * (0.55 + 0.45 * np.abs(np.sin(ang * 3.5)) ** 0.5), 0, 1) ** 1.6
core = np.clip(1 - r * 2.2, 0, 1)
f = np.clip(rays + core, 0, 1)
put(1, np.stack([np.clip(f * 1.0, 0, 1), np.clip(f * 0.8, 0, 1), np.clip(f * 0.45, 0, 1), f], -1))
# 2: fumaça (bolha suave com ruído)
n = noise2(4, 4, 1)
sm = np.clip(1 - r, 0, 1) ** 1.5 * (0.55 + 0.45 * n)
put(2, np.stack([np.full_like(sm, 0.6), np.full_like(sm, 0.6), np.full_like(sm, 0.62), np.clip(sm * 1.3, 0, 1)], -1))
# 3: gota/spray de sangue
n = noise2(6, 3, 2)
bl = np.clip((1 - r * (0.8 + 0.5 * n)) * 2.0, 0, 1)
put(3, np.stack([0.45 * np.ones_like(bl), 0.02 * np.ones_like(bl), 0.02 * np.ones_like(bl), bl], -1))
# 4: poça de sangue (decal no chão)
n = noise2(5, 4, 3)
spl = np.clip((0.75 - r + 0.35 * (n - 0.5) + 0.12 * np.sin(ang * 7)) * 5, 0, 1)
drops = np.zeros_like(spl)
for i in range(14):
    a0 = rng.random() * math.tau
    d0 = 0.55 + rng.random() * 0.35
    cx, cy = math.cos(a0) * d0, math.sin(a0) * d0
    rr = 0.03 + rng.random() * 0.07
    drops = np.maximum(drops, np.clip((rr - np.sqrt((u - cx) ** 2 + (v - cy) ** 2)) * 60, 0, 1))
sp = np.clip(spl + drops, 0, 1)
dark = 0.25 + 0.2 * n
put(4, np.stack([dark, dark * 0.05, dark * 0.05, sp * 0.92], -1))
# 5: marca de bala (buraco escuro com borda)
hole = np.clip((0.22 - r) * 30, 0, 1)
ring = np.clip(1 - np.abs(r - 0.32) * 9, 0, 1) * 0.5 * noise2(8, 2, 4)
al = np.clip(hole + ring, 0, 1)
put(5, np.stack([0.05 * np.ones_like(al), 0.045 * np.ones_like(al), 0.04 * np.ones_like(al), al], -1))
# 6: chama (tocha): gota vertical com gradiente
fy = (v + 1) / 2  # 0 topo → 1 base
wx = np.abs(u) / (0.15 + 0.55 * np.clip(fy, 0, 1) ** 0.8)
fl = np.clip(1 - wx, 0, 1) * np.clip((fy - 0.05) * 1.4, 0, 1) * np.clip((1 - fy) * 6, 0, 1)
fl = fl ** 0.8 * (0.8 + 0.2 * noise2(6, 3, 5))
put(6, np.stack([np.clip(fl * 1.4, 0, 1), np.clip(fl * 0.75, 0, 1), np.clip(fl * 0.25, 0, 1), np.clip(fl * 1.2, 0, 1)], -1))
# 7: poeira/detrito (pontos pequenos)
dd = np.zeros_like(r)
for i in range(40):
    cx, cy = rng.random() * 1.6 - 0.8, rng.random() * 1.6 - 0.8
    rr = 0.02 + rng.random() * 0.05
    dd = np.maximum(dd, np.clip((rr - np.sqrt((u - cx) ** 2 + (v - cy) ** 2)) * 50, 0, 1))
put(7, np.stack([0.55 * np.ones_like(dd), 0.5 * np.ones_like(dd), 0.45 * np.ones_like(dd), dd], -1))

# linhas 2 e 3: faixas de raio (a partir das imagens de lightning, 4:1)
for row, fn in ((2, 'lightning_1.png'), (3, 'lightning3.png')):
    im = Image.open(os.path.join(RAW, 'lightning', fn)).convert('RGBA').resize((A, C), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32) / 255
    rgb = arr[..., :3]
    lum = np.clip(rgb.max(-1) * arr[..., 3], 0, 1)
    atlas[row * C:(row + 1) * C, :, :3] = rgb
    atlas[row * C:(row + 1) * C, :, 3] = lum

Image.fromarray((np.clip(atlas, 0, 1) * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'fx_atlas.png'))
print('fx atlas ok')
