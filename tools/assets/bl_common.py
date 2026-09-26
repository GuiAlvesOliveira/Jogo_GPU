# ============================================================
#  bl_common.py — Utilitários do pipeline de assets (roda DENTRO do Blender)
# ------------------------------------------------------------
#  O jogo NÃO usa engine: ele carrega GLB com um loader próprio e
#  anima os esqueletos na própria GPU. Estes scripts são só a etapa
#  OFFLINE de conversão (.blend/.fbx/.obj → .glb), executada com o
#  Blender em modo linha de comando:
#
#     blender -b arquivo.blend --python export_xxx.py -- <raw> <out>
#
#  Convenções de saída (todas as GLB):
#    - 1 unidade = 1 metro, +Y para cima (glTF);
#    - personagens olham para +Z no glTF (= -Y no Blender) e têm os
#      pés em y = 0;
#    - armas: cano apontando para -Z no glTF (= +Y no Blender).
# ============================================================
import bpy, math, os, sys
from mathutils import Vector, Quaternion, Matrix


def args():
    """Argumentos após '--': [raw_dir, out_dir, ...]."""
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return a


def log(*parts):
    print("[assets]", *parts, flush=True)


# ------------------------------------------------------------------ cena
def reset_empty():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def delete_all_except(keep):
    keep = set(o.name for o in keep)
    for o in list(bpy.data.objects):
        if o.name not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()


def select_only(objs):
    for o in bpy.context.view_layer.objects:
        if o is not None:
            o.select_set(False)
    for o in objs:
        o.hide_set(False)
        o.hide_viewport = False
        o.select_set(True)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]


def link_to_scene(objs):
    sc = bpy.context.scene
    for o in objs:
        if o.name not in sc.collection.objects and not any(o.name in c.objects for c in sc.collection.children_recursive):
            sc.collection.objects.link(o)


def apply_modifiers(obj, keep_types=("ARMATURE",)):
    select_only([obj])
    for m in list(obj.modifiers):
        if m.type in keep_types:
            continue
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e:  # modificador inválido → remove
            log("modifier_apply falhou", obj.name, m.name, e)
            obj.modifiers.remove(m)


def join(objs, name):
    select_only(objs)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


def world_bbox(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != "MESH":
            continue
        oe = o.evaluated_get(dg)
        me = oe.to_mesh()
        used = set()  # só vértices de faces (ignora vértices soltos)
        for p in me.polygons:
            used.update(p.vertices)
        for i in used:
            w = oe.matrix_world @ me.vertices[i].co
            mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
            mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
        oe.to_mesh_clear()
    return mn, mx


# ------------------------------------------------------------- materiais
def make_material(name, image=None, color=(0.8, 0.8, 0.8, 1.0), roughness=0.6, metallic=0.0,
                  emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        nt.nodes.active = tex
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat.diffuse_color = color
    return mat


def set_all_slots(obj, mat):
    if not obj.material_slots:
        obj.data.materials.append(mat)
    for slot in obj.material_slots:
        slot.link = "DATA"
        slot.material = mat


def replace_materials(obj, mapping, default=None):
    """mapping: nome_material_antigo → material novo."""
    for slot in obj.material_slots:
        slot.link = "DATA"
        old = slot.material.name if slot.material else None
        if old in mapping:
            slot.material = mapping[old]
        elif default is not None:
            slot.material = default


def downscale_image(img, max_size):
    """Reduz a imagem (em memória) para no máx. max_size px no maior lado."""
    w, h = img.size
    if max(w, h) <= max_size or w == 0:
        return img
    s = max_size / max(w, h)
    img.scale(max(1, int(w * s)), max(1, int(h * s)))
    return img


def load_image(path):
    return bpy.data.images.load(path, check_existing=True)


# --------------------------------------------------------------- export
def export_glb(path, objs, animations=False, image_format="JPEG", quality=88, deform_only=True):
    select_only(objs)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = dict(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format=image_format,
        export_jpeg_quality=quality,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_morph=False,
        export_skins=animations,
        export_animations=animations,
    )
    if animations:
        kw.update(
            export_def_bones=deform_only,
            export_animation_mode="ACTIONS",
            export_force_sampling=True,
            export_frame_step=1,
            export_optimize_animation_size=False,
            export_anim_single_armature=True,
            export_reset_pose_bones=True,
        )
    bpy.ops.export_scene.gltf(**kw)
    log("GLB", path, os.path.getsize(path) // 1024, "KB")


# ------------------------------------------------------- animação (autoria)
def _q(axis, deg):
    return Quaternion(Vector(axis), math.radians(deg))


class Animator:
    """Cria actions por keyframes definidos em ESPAÇO DA ARMATURE.

    Cada pose é um dict bone → lista de (eixo, graus) aplicados em
    sequência, como se o osso girasse em torno da própria cabeça no
    espaço da armature (na pose de repouso). Isso deixa a autoria
    independente dos eixos locais de cada osso.
    """

    def __init__(self, arm):
        self.arm = arm
        arm.animation_data_create()

    def begin(self, name, clear_bones=None):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        self.arm.animation_data.action = act
        self.action = act
        self.keyed = set()
        return act

    def pose(self, frame, rots=None, locs=None, base=None):
        arm = self.arm
        rots = dict(base or {}, **(rots or {}))
        for bn, lst in rots.items():
            pb = arm.pose.bones[bn]
            qa = Quaternion()
            for axis, deg in lst:
                qa = _q(axis, deg) @ qa
            R = pb.bone.matrix_local.to_quaternion()
            ql = R.inverted() @ qa @ R
            # respeita o modo de rotação do osso (as actions originais
            # podem usar Euler; não misturamos tipos de canal)
            if pb.rotation_mode == "QUATERNION":
                pb.rotation_quaternion = ql
                pb.keyframe_insert("rotation_quaternion", frame=frame)
            elif pb.rotation_mode == "AXIS_ANGLE":
                ax, ang = ql.to_axis_angle()
                pb.rotation_axis_angle = (ang, ax.x, ax.y, ax.z)
                pb.keyframe_insert("rotation_axis_angle", frame=frame)
            else:
                pb.rotation_euler = ql.to_euler(pb.rotation_mode)
                pb.keyframe_insert("rotation_euler", frame=frame)
            self.keyed.add((bn, "r"))
        for bn, v in (locs or {}).items():
            pb = arm.pose.bones[bn]
            R = pb.bone.matrix_local.to_3x3()
            pb.location = R.inverted() @ Vector(v)
            pb.keyframe_insert("location", frame=frame)
            self.keyed.add((bn, "l"))

    def reset_pose(self):
        for pb in self.arm.pose.bones:
            pb.rotation_quaternion = Quaternion()
            pb.rotation_euler = (0, 0, 0)
            pb.rotation_axis_angle = (0, 0, 1, 0)
            pb.location = Vector()
            pb.scale = Vector((1, 1, 1))


def complete_channels(arm, actions):
    """Garante que TODO clipe tenha chave para todo canal de osso usado
    em QUALQUER clipe (valor de repouso no 1º quadro). Sem isso, um osso
    que só um clipe anima herdaria a pose do clipe tocado antes."""
    rest = {"rotation_quaternion": (1, 0, 0, 0), "rotation_euler": (0, 0, 0),
            "rotation_axis_angle": (0, 0, 1, 0), "location": (0, 0, 0), "scale": (1, 1, 1)}
    used = {}
    for act in actions:
        for fc in act.fcurves:
            if not fc.data_path.startswith('pose.bones["'):
                continue
            bone = fc.data_path.split('"')[1]
            prop = fc.data_path.rsplit(".", 1)[1]
            used.setdefault((bone, prop), set()).add(fc.array_index)
    for act in actions:
        have = set()
        for fc in act.fcurves:
            if fc.data_path.startswith('pose.bones["'):
                have.add((fc.data_path.split('"')[1], fc.data_path.rsplit(".", 1)[1], fc.array_index))
        f0 = act.frame_range[0]
        for (bone, prop), idxs in used.items():
            if bone not in arm.pose.bones or prop not in rest:
                continue
            path = f'pose.bones["{bone}"].{prop}'
            for i in idxs:
                if (bone, prop, i) in have:
                    continue
                fc = act.fcurves.new(path, index=i, action_group=bone)
                fc.keyframe_points.insert(f0, rest[prop][i])

    def push_nla(self, act=None):
        """Coloca a action numa trilha NLA (garante que o exportador a veja)."""
        act = act or self.action
        tr = self.arm.animation_data.nla_tracks.new()
        tr.name = act.name
        st = tr.strips.new(act.name, int(act.frame_range[0]), act)
        tr.mute = True
        return st


def interp(a, b, t):
    return a + (b - a) * t


# ------------------------------------------------------------- prévias
def render_preview(objs, prefix, views=((35, 20), (125, 10), (215, 20), (305, 5)), res=320, frame=None):
    sc = bpy.context.scene
    if frame is not None:
        sc.frame_set(frame)
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "TEXTURE"
    sh.show_backface_culling = False
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    names = {o.name for o in objs}
    hidden = []
    for o in sc.objects:
        if o.type in ("MESH", "CURVE") and o.name not in names and not o.hide_render:
            o.hide_render = True
            hidden.append(o)
    mn, mx = world_bbox(objs)
    ctr = (mn + mx) / 2
    rad = max((mx - mn).length / 2, 1e-3)
    cam_data = bpy.data.cameras.new("PrevCam")
    cam = bpy.data.objects.new("PrevCam", cam_data)
    sc.collection.objects.link(cam)
    old_cam = sc.camera
    sc.camera = cam
    cam_data.lens = 50
    cam_data.clip_start = rad * 0.01
    cam_data.clip_end = rad * 100
    fov = 2 * math.atan(18 / 50)
    dist = rad / math.sin(fov / 2) * 1.05
    for i, (az, el) in enumerate(views):
        a, e = math.radians(az), math.radians(el)
        pos = ctr + Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e))) * dist
        cam.location = pos
        cam.rotation_euler = (ctr - pos).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = f"{prefix}_{i}.png"
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    sc.camera = old_cam
    for o in hidden:
        o.hide_render = False
