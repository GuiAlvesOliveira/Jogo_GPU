# ============================================================
#  export_ak47.py — AK-47 (highpoly_ak47.blend, Blender 2.55)
# ------------------------------------------------------------
#  Uso: blender -b highpoly_ak47.blend --python export_ak47.py -- <raw> <out>
#
#  O modelo veio sem UV e sem textura (o .jpg original não acompanha
#  o arquivo). Aplicamos os modificadores (mirror/subsurf), separamos
#  as peças de madeira (coronha, empunhadura e guarda-mão) e geramos
#  UVs automáticas para receber uma textura de madeira; o resto vira
#  metal escuro.
# ============================================================
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import bl_common as C
from mathutils import Matrix

raw, out = C.args()[:2]
WOOD_PARTS = {'Plane.010', 'Plane.003', 'Circle.010', 'Circle.007'}
LENGTH = 0.88  # comprimento real aproximado (m)

D = bpy.data
objs = [o for o in D.objects if o.type == 'MESH']
C.delete_all_except(objs)
for o in objs:
    C.apply_modifiers(o, keep_types=())
C.select_only(objs)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

wood_img = C.load_image(os.path.join(raw, 'wests', 'wood floor 1.png'))
C.downscale_image(wood_img, 512)
px = list(wood_img.pixels)  # escurece e esquenta a madeira (verniz)
for i in range(0, len(px), 4):
    px[i] *= 0.75; px[i + 1] *= 0.52; px[i + 2] *= 0.36
wood_img.pixels = px
m_wood = C.make_material('AK_wood', image=wood_img, roughness=0.55)
steel_img = D.images.new('ak_steel', 4, 4)
steel_img.pixels = [0.09, 0.09, 0.1, 1.0] * 16
m_steel = C.make_material('AK_steel', image=steel_img, roughness=0.35, metallic=0.6)

wood = [o for o in objs if o.name in WOOD_PARTS]
steel = [o for o in objs if o.name not in WOOD_PARTS]
for group, mat in ((wood, m_wood), (steel, m_steel)):
    for o in group:
        o.data.materials.clear()
        o.data.materials.append(mat)
        while o.data.uv_layers:
            o.data.uv_layers.remove(o.data.uv_layers[0])
        uv = o.data.uv_layers.new(name='UVMap')
        # UV nova vem com um quadrado 0..1 POR FACE (duplicaria vértices);
        # no metal usamos um UV constante (textura 4x4 de cor única)
        for d in uv.data:
            d.uv = (0.5, 0.5)

# UVs automáticas (smart project) só nas peças de madeira
C.select_only(wood)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.02, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
for o in wood:  # repete a textura ~3x ao longo da peça
    for d in o.data.uv_layers[0].data:
        d.uv = (d.uv[0] * 3.0, d.uv[1] * 3.0)

ak = C.join(objs, 'w_ak47')
# Suaviza (o arquivo original era facetado → o glTF duplicaria vértices
# por face) e reduz a malha: o subsurf deixou ~65 mil vértices.
dec = ak.modifiers.new('dec', 'DECIMATE')
dec.ratio = 0.45
C.apply_modifiers(ak, keep_types=())
C.select_only([ak])
if ak.data.has_custom_normals:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
for p in ak.data.polygons:
    p.use_smooth = True
for name in ('sharp_edge', 'sharp_face', 'Col'):  # 'Col' = cor por canto → duplicaria vértices
    if name in ak.data.attributes:
        ak.data.attributes.remove(ak.data.attributes[name])
C.log('SPLIT-CHECK', 'custom_normals', ak.data.has_custom_normals, 'attrs', [a.name for a in ak.data.attributes])
mn, mx = C.world_bbox([ak])
s = LENGTH / (mx.y - mn.y)
ak.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation(-(mn + mx) / 2))
mn, mx = C.world_bbox([ak])
C.log('BBOX', 'w_ak47', tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx), 'verts', len(ak.data.vertices))
C.export_glb(os.path.join(out, 'w_ak47.glb'), [ak], animations=False)
