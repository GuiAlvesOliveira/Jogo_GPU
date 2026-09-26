# ============================================================
#  export_items.py — Kit médico (FirstAid.obj)
# ------------------------------------------------------------
#  Uso: blender -b --python export_items.py -- <raw> <out>
# ============================================================
import bpy, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import bl_common as C
from mathutils import Matrix

raw, out = C.args()[:2]
C.reset_empty()
bpy.ops.wm.obj_import(filepath=os.path.join(raw, 'firstaid', 'FirstAid.obj'))
kit = [o for o in bpy.data.objects if o.type == 'MESH'][0]
img = C.load_image(os.path.join(raw, 'firstaid', 'FirstAid.png'))
C.set_all_slots(kit, C.make_material('M_medkit', image=img, roughness=0.5))
C.select_only([kit])
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mn, mx = C.world_bbox([kit])
s = 0.42 / max(mx.x - mn.x, mx.y - mn.y)          # ~42 cm de largura
kit.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation(-(mn + mx) / 2))
mn, mx = C.world_bbox([kit])
C.log('BBOX', 'i_medkit', tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
C.export_glb(os.path.join(out, 'i_medkit.glb'), [kit], animations=False)
