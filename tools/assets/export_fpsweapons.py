# ============================================================
#  export_fpsweapons.py — Armas do pacote "FPSWeapons" (Blender 2.49)
# ------------------------------------------------------------
#  Uso: blender -b FPSWeapons.blend --python export_fpsweapons.py -- <raw> <out>
#
#  O arquivo original é de 2010: as texturas estão EMBUTIDAS (packed),
#  mas a ligação textura→malha era feita por face (recurso removido
#  no Blender atual). Por isso refazemos os materiais pelo nome.
#  Licença do pacote: CC BY-SA 3.0 (ver créditos no jogo).
# ============================================================
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import bl_common as C
from mathutils import Vector, Matrix

raw, out = C.args()[:2]
SRC = bpy.data.filepath
SCALE = 0.43  # o pacote está ~2,3x maior que o tamanho real

# objeto → imagem embutida
TEX = {
    '.223 shell': '5.56-shell.tga', '.45 shell': '.45-Shell.tga', '9mm shell': '9mm-Shell.tga',
    'Cylinder.001': 'Suppressor.tga', 'EOTech': 'EOTech.tga',
    'M4 Carbine': 'M4Carbine-Dif.tga', 'M4 Magazine': 'M4Magazine-Dif.tga', 'M9 Bayonet': 'CombatKnife.tga',
    'M9 Pistol': 'NewM9.tga', 'M9 Pistol Mag': 'M9Magazine.tga', 'MagLite': 'MagLite-Diff.TGA',
    'Mossberg 500': 'M500.tga', 'Scar': 'SCAR-L.tga', 'Scar magazine': 'SCAR-L Mag.tga',
    'Shotgun shell': 'Shotgun shell.tga', 'USP-CT': 'USP.png', 'USP-Magazine': 'USP_Magazine.tga',
}

# nome da saída → (objetos, rotação extra em graus (x,y,z), tamanho máx. da textura)
GROUPS = {
    'w_m4':       (['M4 Carbine', 'M4 Magazine'], (0, 0, 0), 1024),
    'w_scar':     (['Scar', 'Scar magazine'], (0, 0, 0), 1024),
    'w_mossberg': (['Mossberg 500'], (0, 0, 0), 1024),
    'w_usp':      (['USP-CT'], (0, 0, 0), 1024),
    'w_m9':       (['M9 Pistol'], (0, 0, 0), 1024),
    'w_knife':    (['M9 Bayonet'], (-90, 0, 0), 1024),   # lâmina para frente (+Y)
    'i_mag_pistol': (['USP-Magazine'], (0, 0, 0), 512),
    'i_mag_rifle':  (['M4 Magazine'], (0, 0, 0), 512),
    'i_mag_heavy':  (['Scar magazine'], (0, 0, 0), 512),
    'i_maglite':    (['MagLite'], (0, 0, 0), 512),
    'c_9mm':        (['9mm shell'], (0, 0, 0), 128),
    'c_556':        (['.223 shell'], (0, 0, 0), 128),
    'c_shell':      (['Shotgun shell'], (0, 0, 0), 128),
}


# Peças soltas no arquivo original que precisam ir para o lugar certo
# (ex.: o pente da M4 estava acima da arma, fora do encaixe).
OFFSET = {'M4 Magazine': (0.0, 0.0, -0.28)}


def build(name, obj_names, rot, max_tex):
    bpy.ops.wm.open_mainfile(filepath=SRC)
    D = bpy.data
    objs = [D.objects[n] for n in obj_names]
    C.delete_all_except(objs)
    for o in objs:
        # um único mapa UV com o mesmo nome em todas as partes: ao juntar
        # as malhas, o glTF fica só com TEXCOORD_0
        while len(o.data.uv_layers) > 1:
            o.data.uv_layers.remove(o.data.uv_layers[-1])
        o.data.uv_layers[0].name = "UVMap"
        img = D.images[TEX[o.name]]
        C.downscale_image(img, max_tex)
        # superfície "metálica" escura; o jogo faz a iluminação
        mat = C.make_material("M_" + name + "_" + o.name, image=img, roughness=0.45, metallic=0.2)
        C.set_all_slots(o, mat)
        o.parent = None
    for o in objs:
        if o.name in OFFSET:
            o.location = [a + b for a, b in zip(o.location, OFFSET[o.name])]
    # aplica rotação/escala de objeto na malha (dados em espaço de mundo)
    C.select_only(objs)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o = C.join(objs, name)
    # rotação extra (ex.: faca) + escala para metros
    R = Matrix.Rotation(math.radians(rot[0]), 4, 'X') @ Matrix.Rotation(math.radians(rot[1]), 4, 'Y') @ Matrix.Rotation(math.radians(rot[2]), 4, 'Z')
    o.data.transform(R)
    mn, mx = C.world_bbox([o])
    ctr = (mn + mx) / 2
    o.data.transform(Matrix.Scale(SCALE, 4) @ Matrix.Translation(-ctr))
    o.data.update()
    mn, mx = C.world_bbox([o])
    C.log("BBOX", name, tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
    C.export_glb(os.path.join(out, name + ".glb"), [o], animations=False)


for name, (objs, rot, mt) in GROUPS.items():
    build(name, objs, rot, mt)

# Cartuchos de espingarda para o pickup: 4 cápsulas lado a lado.
bpy.ops.wm.open_mainfile(filepath=SRC)
D = bpy.data
s = D.objects['Shotgun shell']
C.delete_all_except([s])
mat = C.make_material("M_shells", image=D.images[TEX['Shotgun shell']], roughness=0.5)
C.set_all_slots(s, mat)
C.select_only([s])
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mn, mx = C.world_bbox([s])
s.data.transform(Matrix.Translation(-(mn + mx) / 2))
copies = [s]
for i in range(1, 4):
    c = s.copy(); c.data = s.data.copy()
    bpy.context.scene.collection.objects.link(c)
    c.location = Vector((i * 0.07 - 0.105, 0, 0))
    copies.append(c)
s.location = Vector((-0.105, 0, 0))
C.select_only(copies)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
o = C.join(copies, 'i_shells')
# deitadas no chão: eixo longo em Y
o.data.transform(Matrix.Rotation(math.radians(90), 4, 'X'))
mn, mx = C.world_bbox([o])
o.data.transform(Matrix.Scale(SCALE * 1.6, 4) @ Matrix.Translation(-(mn + mx) / 2))
C.export_glb(os.path.join(out, 'i_shells.glb'), [o], animations=False)
