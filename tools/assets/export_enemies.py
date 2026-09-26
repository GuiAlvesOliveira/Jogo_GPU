# ============================================================
#  export_enemies.py — Inimigos animados (esqueleto + clipes)
# ------------------------------------------------------------
#  Uso:
#    blender -b --python export_enemies.py -- <raw> <out> [prev_dir] [nomes...]
#
#  Para cada inimigo: limpa a cena, refaz os materiais, CRIA as
#  animações que faltam (andar/atacar/morrer) por keyframes, normaliza
#  escala/posição (pés em y=0, olhando para +Z no glTF) e exporta um
#  .glb com os clipes nomeados: idle, walk, run, attack, hit, death.
#
#  As poses são descritas em ESPAÇO DA ARMATURE (Animator em
#  bl_common): ('X', graus) gira o osso em torno do eixo X do modelo.
#  Com o personagem olhando para -Y (frente do Blender):
#    - membro apontando para BAIXO vai para FRENTE com X negativo;
#    - tronco apontando para CIMA inclina para FRENTE com X positivo.
# ============================================================
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import bl_common as C
from mathutils import Vector

A = C.args()
RAW, OUT = A[0], A[1]
PREV = A[2] if len(A) > 2 and A[2] != '-' else None
ONLY = set(A[3:])
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
TAU = 2 * math.pi


def S(v):  # suaviza 0..1
    return v * v * (3 - 2 * v)


# ------------------------------------------------------------ finalização
def mark_controls_nondeform(arm, patterns):
    for b in arm.data.bones:
        if any(p in b.name for p in patterns):
            b.use_deform = False


def keep_only_actions(arm, clips):
    """clips: nome_final → action. Remove o resto e empilha em trilhas NLA."""
    keep = set(clips.values())
    for a in list(bpy.data.actions):
        if a not in keep:
            bpy.data.actions.remove(a)
    for name, act in clips.items():
        act.name = name
        act.use_fake_user = True
    ad = arm.animation_data or arm.animation_data_create()
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    for name, act in clips.items():
        tr = ad.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, int(act.frame_range[0]), act)
        tr.mute = True
    ad.action = None
    for o in bpy.data.objects:  # ações de objeto em malhas (restos do arquivo)
        if o is not arm and o.animation_data:
            o.animation_data_clear()


def strip_object_channels(actions):
    """Remove curvas de transformação do OBJETO (só ossos ficam): assim a
    escala/posição que definimos no objeto armature não é sobrescrita."""
    for act in actions:
        for fc in list(act.fcurves):
            if not fc.data_path.startswith('pose.bones'):
                act.fcurves.remove(fc)


def normalize(arm, meshes, height, frame_action=None, frame=None, yaw180=False, clips=None):
    """Escala/posiciona o objeto armature: altura final `height`, pés em z=0."""
    ad = arm.animation_data
    strip_object_channels([a for a in bpy.data.actions])
    if clips:
        C.complete_channels(arm, list(clips.values()))
    if frame_action is not None:
        ad.action = frame_action
        bpy.context.scene.frame_set(int(frame if frame is not None else frame_action.frame_range[0]))
    if yaw180:
        arm.rotation_mode = 'XYZ'  # (o import glTF deixa em QUATERNION)
        arm.rotation_euler.z += math.pi
    bpy.context.view_layer.update()
    mn, mx = C.world_bbox(meshes)
    k = height / (mx.z - mn.z)
    arm.scale = arm.scale * k
    bpy.context.view_layer.update()
    mn, mx = C.world_bbox(meshes)
    arm.location -= Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    bpy.context.view_layer.update()
    mn, mx = C.world_bbox(meshes)
    ad.action = None
    C.log('NORM', arm.name, 'k', round(k, 4), 'bbox', tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))


def previews(name, arm, meshes, clips, frames_per_clip=4, view=((40, 12),)):
    if not PREV:
        return
    ad = arm.animation_data
    for cname, act in clips.items():
        ad.action = act
        f0, f1 = act.frame_range
        for i in range(frames_per_clip):
            f = int(round(f0 + (f1 - f0) * i / max(1, frames_per_clip - 1)))
            C.render_preview(meshes, os.path.join(PREV, f'{name}_{cname}_{i}'), views=view, res=240, frame=f)
    ad.action = None


def export(name, arm, meshes, clips, fps):
    sc = bpy.context.scene
    sc.render.fps = fps
    keep_only_actions(arm, clips)
    C.export_glb(os.path.join(OUT, name + '.glb'), [arm] + meshes, animations=True)


# ================================================================= RATO
def build_rat():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(RAW, 'rat7z', 'rat.blend'))
    D = bpy.data
    arm = D.objects['Skeleton']
    meshes = [D.objects[n] for n in ('Body.001', 'Head.002', 'Teeth.001')]
    C.delete_all_except([arm] + meshes)
    body = D.images['rat-body']; head = D.images['rat-head']
    C.downscale_image(body, 512); C.downscale_image(head, 512)
    mats = {
        'body.001': C.make_material('rat_body', image=body, roughness=0.8),
        'head.003': C.make_material('rat_head', image=head, roughness=0.8),
        'head.002': C.make_material('rat_head2', image=head, roughness=0.8),
        'Material.003': C.make_material('rat_flesh', color=(0.35, 0.04, 0.04, 1), roughness=0.4),
        'Teeth.002': C.make_material('rat_teeth', color=(0.85, 0.78, 0.55, 1), roughness=0.3),
        # olhos vermelhos brilhando no escuro
        'eyes': C.make_material('rat_eyes', color=(1.0, 0.1, 0.05, 1), emission=(1.0, 0.08, 0.02, 1), emission_strength=4.0),
    }
    for m in meshes:
        C.replace_materials(m, mats)
    mark_controls_nondeform(arm, ('IK-', 'Main'))
    clips = {'idle': D.actions['Idle.001'], 'walk': D.actions['Walk'], 'run': D.actions['Run'],
             'attack': D.actions['Attack'], 'hit': D.actions['Hit'], 'death': D.actions['Die']}
    normalize(arm, meshes, 0.62, clips['idle'], clips=clips)
    previews('rat', arm, meshes, clips)
    export('e_rat', arm, meshes, clips, fps=20)


# ================================================================ TROLL
def build_troll():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(RAW, 'troll.blend'))
    D = bpy.data
    arm = D.objects['Armature']
    # 'cloth.001' é uma cópia solta (não segue o esqueleto) → fica de fora
    meshes = [D.objects[n] for n in ('med', 'cloth', 'eye med')]
    C.delete_all_except([arm] + meshes)
    skin = D.images['troll_baseTexBaked.png']; C.downscale_image(skin, 1024)
    cloth = D.images['cloth uv.png']; C.downscale_image(cloth, 512)
    C.set_all_slots(D.objects['med'], C.make_material('troll_skin', image=skin, roughness=0.75))
    m_cloth = C.make_material('troll_cloth', image=cloth, roughness=0.9)
    C.set_all_slots(D.objects['cloth'], m_cloth)
    C.set_all_slots(D.objects['eye med'], C.make_material('troll_eye', color=(0.9, 0.7, 0.1, 1), emission=(1.0, 0.55, 0.05, 1), emission_strength=3.0))
    idle = D.actions['ArmatureAction']
    arm.animation_data_create()
    for t in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(t)
    an = C.Animator(arm)

    # --- WALK: pés (alvos de IK) andam; corpo balança; braços opostos
    an.begin('walk'); an.reset_pose()
    N, Sd, H = 32, 0.85, 0.32
    for f in range(0, N + 1, 2):
        t = f / N
        locs, rots = {}, {}
        for side, ph in (('L', 0.0), ('R', 0.5)):
            u = (t + ph) % 1.0
            if u < 0.6:
                y = -Sd / 2 + Sd * (u / 0.6); z = 0.0
            else:
                v = (u - 0.6) / 0.4
                y = Sd / 2 - Sd * S(v); z = H * math.sin(math.pi * v)
            locs['foot_main.' + side] = (0, y, z)
        locs['Bone.004'] = (0.06 * math.sin(TAU * t), 0, -0.10 + 0.05 * math.cos(2 * TAU * t))
        rots['arm.L'] = [(X, 16 * math.cos(TAU * t))]
        rots['arm.R'] = [(X, -16 * math.cos(TAU * t))]
        rots['Bone.001'] = [(Z, 6 * math.cos(TAU * t)), (X, 6)]
        rots['Bone.003'] = [(Z, -4 * math.cos(TAU * t))]
        an.pose(f, rots, locs)
    walk = an.action

    # --- ATTACK: ergue os braços e esmaga o chão (impacto ~50%)
    an.begin('attack'); an.reset_pose()
    base = {'arm.L': [(X, 0)], 'arm.R': [(X, 0)], 'forearm.L': [(X, 0)], 'forearm.R': [(X, 0)],
            'Bone.001': [(X, 0)], 'Bone.002': [(X, 0)]}
    an.pose(0, base, {'Bone.004': (0, 0, 0)})
    an.pose(14, {'arm.L': [(X, -150)], 'arm.R': [(X, -150)], 'forearm.L': [(X, -25)], 'forearm.R': [(X, -25)],
                 'Bone.001': [(X, -14)], 'Bone.002': [(X, -8)]}, {'Bone.004': (0, 0.1, 0.05)})
    an.pose(20, {'arm.L': [(X, -35)], 'arm.R': [(X, -35)], 'forearm.L': [(X, 0)], 'forearm.R': [(X, 0)],
                 'Bone.001': [(X, 32)], 'Bone.002': [(X, 12)]}, {'Bone.004': (0, -0.25, -0.3)})
    an.pose(27, {'arm.L': [(X, -30)], 'arm.R': [(X, -30)], 'forearm.L': [(X, 0)], 'forearm.R': [(X, 0)],
                 'Bone.001': [(X, 28)], 'Bone.002': [(X, 10)]}, {'Bone.004': (0, -0.22, -0.28)})
    an.pose(40, base, {'Bone.004': (0, 0, 0)})
    attack = an.action

    # --- DEATH: joelhos cedem e cai de cara no chão
    an.begin('death'); an.reset_pose()
    an.pose(0, base, {'Bone.004': (0, 0, 0)})
    an.pose(12, {'Bone.001': [(X, 12)], 'Bone.002': [(X, 6)], 'arm.L': [(X, 8)], 'arm.R': [(X, 8)],
                 'forearm.L': [(X, 0)], 'forearm.R': [(X, 0)]}, {'Bone.004': (0, 0.05, -0.55)})
    an.pose(20, {'Bone.001': [(X, 22)], 'Bone.002': [(X, 10)], 'arm.L': [(X, 10)], 'arm.R': [(X, 10)],
                 'forearm.L': [(X, 0)], 'forearm.R': [(X, 0)]}, {'Bone.004': (0, 0.0, -0.95)})
    an.pose(34, {'Bone.001': [(X, 88)], 'Bone.002': [(X, 14)], 'arm.L': [(X, -70)], 'arm.R': [(X, -60)],
                 'forearm.L': [(X, -10)], 'forearm.R': [(X, -10)]}, {'Bone.004': (0, -0.55, -1.2)})
    an.pose(39, {'Bone.001': [(X, 82)], 'Bone.002': [(X, 10)], 'arm.L': [(X, -64)], 'arm.R': [(X, -55)],
                 'forearm.L': [(X, -6)], 'forearm.R': [(X, -6)]}, {'Bone.004': (0, -0.5, -1.15)})
    an.pose(48, {'Bone.001': [(X, 86)], 'Bone.002': [(X, 12)], 'arm.L': [(X, -68)], 'arm.R': [(X, -58)],
                 'forearm.L': [(X, -8)], 'forearm.R': [(X, -8)]}, {'Bone.004': (0, -0.55, -1.2)})
    death = an.action

    mark_controls_nondeform(arm, ('foot_main', 'roll_IK', 'pole', 'sole', 'foot_IK'))
    clips = {'idle': idle, 'walk': walk, 'attack': attack, 'death': death}
    normalize(arm, meshes, 2.7, idle, 1, clips=clips)
    previews('troll', arm, meshes, clips)
    export('e_troll', arm, meshes, clips, fps=24)


# =============================================================== ANGLER
def build_angler():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(RAW, 'angler_gif', 'angler game.blend'))
    D = bpy.data
    arm = D.objects['Armature.001']
    body = D.objects['angler final.001']
    sc = bpy.context.scene  # o arquivo tem 2 cenas; garante os objetos na ativa
    for o in (arm, body):
        if o.name not in sc.objects:
            sc.collection.objects.link(o)
    C.delete_all_except([arm, body])
    for m in list(body.modifiers):
        if m.type == 'DISPLACE':
            body.modifiers.remove(m)
        elif m.type == 'SUBSURF':
            m.levels = 1
    C.apply_modifiers(body)  # aplica o subsurf (mantém o armature)
    tex = D.images['texture final']; C.downscale_image(tex, 1024)
    m_body = C.make_material('angler_body', image=tex, roughness=0.5)
    m_eye = C.make_material('angler_eye', image=tex, roughness=0.2, emission=(0.6, 0.25, 0.1, 1), emission_strength=0.6)
    m_lure = C.make_material('angler_lure', color=(1.0, 0.95, 0.7, 1), emission=(1.0, 0.9, 0.6, 1), emission_strength=8.0)
    slots = body.material_slots
    for i, s in enumerate(slots):
        s.link = 'DATA'
        s.material = (m_body, m_eye, m_lure)[min(i, 2)]
    walk = D.actions['Armature.001Action']
    arm.animation_data_create()
    for t in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(t)
    an = C.Animator(arm)
    ctrl_follow = ('arm_IK_L', 'arm_IK_R', 'arm_pivot_L', 'arm_pivot_R', 'hand_controller_L', 'hand_controller_R', 'eyes_control')

    def body_loc(v):
        d = {'spine': v}
        for c in ctrl_follow:
            d[c] = v
        return d

    # --- IDLE: respira, mandíbula treme
    an.begin('idle'); an.reset_pose()
    for f in range(0, 49, 4):
        t = f / 48
        an.pose(f, {'jaw': [(X, 6 + 5 * math.sin(TAU * t * 2))], 'spine': [(X, 3 * math.sin(TAU * t))]},
                body_loc((0, 0, 0.06 * math.sin(TAU * t))))
    idle = an.action

    # --- ATTACK: recua, dá o bote e morde (impacto ~50%)
    an.begin('attack'); an.reset_pose()
    an.pose(0, {'jaw': [(X, 5)], 'spine': [(X, 0)]}, body_loc((0, 0, 0)))
    an.pose(8, {'jaw': [(X, 38)], 'spine': [(X, -16)]}, body_loc((0, 0.35, -0.25)))
    an.pose(14, {'jaw': [(X, 48)], 'spine': [(X, 22)]}, body_loc((0, -1.1, 0.15)))
    an.pose(16, {'jaw': [(X, -2)], 'spine': [(X, 24)]}, body_loc((0, -1.15, 0.1)))
    an.pose(22, {'jaw': [(X, 4)], 'spine': [(X, 14)]}, body_loc((0, -0.8, 0.0)))
    an.pose(30, {'jaw': [(X, 5)], 'spine': [(X, 0)]}, body_loc((0, 0, 0)))
    attack = an.action

    # --- DEATH: desaba de lado com a boca aberta
    an.begin('death'); an.reset_pose()
    an.pose(0, {'jaw': [(X, 5)], 'spine': [(X, 0)]}, body_loc((0, 0, 0)))
    an.pose(10, {'jaw': [(X, 40)], 'spine': [(X, -18), (Y, 10)]}, body_loc((0, 0.2, 0.2)))
    an.pose(24, {'jaw': [(X, 30)], 'spine': [(X, 10), (Y, 75)]}, body_loc((0.6, 0.0, -1.3)))
    an.pose(30, {'jaw': [(X, 34)], 'spine': [(X, 8), (Y, 68)]}, body_loc((0.6, 0.0, -1.2)))
    an.pose(40, {'jaw': [(X, 32)], 'spine': [(X, 8), (Y, 72)]}, body_loc((0.6, 0.0, -1.28)))
    death = an.action

    mark_controls_nondeform(arm, ('IK', 'pivot', 'roll', 'controller', 'eyes_control'))
    clips = {'idle': idle, 'walk': walk, 'attack': attack, 'death': death}
    normalize(arm, [body], 1.75, idle, 0, clips=clips)
    previews('angler', arm, [body], clips)
    export('e_angler', arm, [body], clips, fps=24)


# ========================================================== SOMBRA (Darsh)
def build_shade():
    C.reset_empty()
    bpy.ops.import_scene.gltf(filepath=os.path.join(RAW, 'darsh', 'Darsh.glb'))
    D = bpy.data
    arm = D.objects['Armature']
    body = D.objects['Undead']
    C.delete_all_except([arm, body])
    img = [i for i in D.images if i.size[0] > 0][0]
    m = C.make_material('shade_skin', image=img, roughness=0.35, metallic=0.1)
    C.set_all_slots(body, m)
    idle = [a for a in D.actions if a.name.startswith('Idle')][0]
    for t in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(t)
    an = C.Animator(arm)
    # Este modelo olha para +Y: "frente" invertida em relação aos outros.
    # Membro para baixo vai à frente (+Y) com X POSITIVO.
    an.begin('walk'); an.reset_pose()
    N = 32
    for f in range(0, N + 1, 2):
        t = f / N
        s = math.sin(TAU * t); c = math.cos(TAU * t)
        rots = {
            'Bone.013': [(X, 24 * s)], 'Bone.016': [(X, -24 * s)],
            'Bone.014': [(X, -32 * max(0.0, c))], 'Bone.017': [(X, -32 * max(0.0, -c))],
            'Bone.009': [(X, -14 * s)], 'Bone.005': [(X, 14 * s)],
            'Bone.001': [(Z, 5 * s), (X, -8)], 'Bone.003': [(Z, -3 * s)],
        }
        an.pose(f, rots)
    walk = an.action

    an.begin('attack'); an.reset_pose()
    rest = {'Bone.005': [(X, 0)], 'Bone.009': [(X, 0)], 'Bone.006': [(X, 0)], 'Bone.010': [(X, 0)],
            'Bone.001': [(X, 0)], 'Bone.003': [(X, 0)]}
    an.pose(0, rest)
    an.pose(10, {'Bone.005': [(X, 70)], 'Bone.009': [(X, 70)], 'Bone.006': [(X, 25)], 'Bone.010': [(X, 25)],
                 'Bone.001': [(X, 8)], 'Bone.003': [(X, 6)]})
    an.pose(15, {'Bone.005': [(X, 92)], 'Bone.009': [(X, 92)], 'Bone.006': [(X, 5)], 'Bone.010': [(X, 5)],
                 'Bone.001': [(X, -14)], 'Bone.003': [(X, -8)]})
    an.pose(21, {'Bone.005': [(X, 88)], 'Bone.009': [(X, 88)], 'Bone.006': [(X, 8)], 'Bone.010': [(X, 8)],
                 'Bone.001': [(X, -10)], 'Bone.003': [(X, -6)]})
    an.pose(32, rest)
    attack = an.action

    an.begin('death'); an.reset_pose()
    rest_d = {'Bone.013': [(X, 0)], 'Bone.016': [(X, 0)], 'Bone.014': [(X, 0)], 'Bone.017': [(X, 0)],
              'Bone.001': [(X, 0)], 'Bone.002': [(X, 0)], 'Bone.005': [(X, 0)], 'Bone.009': [(X, 0)]}
    an.pose(0, rest_d)
    an.pose(10, {'Bone.013': [(X, 30)], 'Bone.016': [(X, 30)], 'Bone.014': [(X, -60)], 'Bone.017': [(X, -60)],
                 'Bone.001': [(X, 15)], 'Bone.002': [(X, 10)], 'Bone.005': [(X, -20)], 'Bone.009': [(X, -20)]},
            {'Bone': (0, 0, -0.5), 'Bone.012': (0, 0, -0.5), 'Bone.015': (0, 0, -0.5)})
    an.pose(22, {'Bone.013': [(X, 80)], 'Bone.016': [(X, 75)], 'Bone.014': [(X, -140)], 'Bone.017': [(X, -135)],
                 'Bone.001': [(X, 40)], 'Bone.002': [(X, 25)], 'Bone.005': [(X, -30)], 'Bone.009': [(X, -35)]},
            {'Bone': (0, 0.1, -1.55), 'Bone.012': (0, 0.1, -1.55), 'Bone.015': (0, 0.1, -1.55)})
    an.pose(32, {'Bone.013': [(X, 82)], 'Bone.016': [(X, 78)], 'Bone.014': [(X, -142)], 'Bone.017': [(X, -138)],
                 'Bone.001': [(X, 70)], 'Bone.002': [(X, 30)], 'Bone.005': [(X, 40)], 'Bone.009': [(X, 35)]},
            {'Bone': (0, 0.3, -1.65), 'Bone.012': (0, 0.1, -1.6), 'Bone.015': (0, 0.1, -1.6)})
    death = an.action

    clips = {'idle': idle, 'walk': walk, 'attack': attack, 'death': death}
    normalize(arm, [body], 2.05, idle, 1, yaw180=True, clips=clips)
    previews('shade', arm, [body], clips)
    export('e_shade', arm, [body], clips, fps=24)


# ========================================================= ZUMBI (Kenney)
def build_zombie():
    C.reset_empty()
    kd = os.path.join(RAW, 'kenney')
    bpy.ops.import_scene.fbx(filepath=os.path.join(kd, 'Model', 'characterMedium.fbx'))
    D = bpy.data
    arm = D.objects['Root']
    body = D.objects['characterMedium']
    C.delete_all_except([arm, body])
    img = C.load_image(os.path.join(kd, 'Skins', 'zombieMaleA.png'))
    C.set_all_slots(body, C.make_material('zombie_skin', image=img, roughness=0.85))
    for a in list(D.actions):
        D.actions.remove(a)
    an = C.Animator(arm)

    def zbase(t=0.0, amp=1.0):
        s = math.sin(TAU * t)
        return {
            'Spine': [(X, 12), (Y, 4 * s * amp)], 'Chest': [(X, 6)], 'Neck': [(X, 8)],
            'Head': [(Y, 16 + 5 * s * amp), (X, 10)],
            'LeftArm': [(Z, -78 + 4 * s * amp), (X, 12)], 'RightArm': [(Z, 74 - 4 * s * amp), (X, 16)],
            'LeftForeArm': [(Z, -8)], 'RightForeArm': [(Z, 10)],
            'LeftHand': [(X, 20)], 'RightHand': [(X, 25)],
        }

    def legs(t, amp_l, amp_r, knee):
        s = math.sin(TAU * t); c = math.cos(TAU * t)
        return {
            'LeftUpLeg': [(X, -amp_l * s)], 'RightUpLeg': [(X, amp_r * s)],
            'LeftLeg': [(X, knee * max(0.0, c))], 'RightLeg': [(X, knee * max(0.0, -c))],
        }

    # IDLE: balança parado, braços caídos à frente
    an.begin('idle'); an.reset_pose()
    for f in range(0, 49, 4):
        t = f / 48
        s = math.sin(TAU * t)
        r = zbase(t, 0.6)
        r.update({'LeftArm': [(Z, -40 + 3 * s), (X, 45)], 'RightArm': [(Z, 38 - 3 * s), (X, 48)],
                  'Spine': [(X, 8 + 2 * s), (Y, 3 * s)], 'LeftUpLeg': [(X, 0)], 'RightUpLeg': [(X, 0)]})
        an.pose(f, r)
    idle = an.action

    # WALK: arrasta os pés, braços estendidos (perna direita manca)
    an.begin('walk'); an.reset_pose()
    N = 36
    for f in range(0, N + 1, 3):
        t = f / N
        r = zbase(t); r.update(legs(t, 24, 14, 38))
        an.pose(f, r, {'Hips': (0, 0, -0.04 + 0.04 * abs(math.cos(TAU * t)))})
    walk = an.action

    # RUN: mesma ideia, mais inclinado e rápido
    an.begin('run'); an.reset_pose()
    N = 20
    for f in range(0, N + 1, 2):
        t = f / N
        r = zbase(t, 1.5); r.update(legs(t, 38, 32, 60))
        r['Spine'] = [(X, 24), (Y, 6 * math.sin(TAU * t))]
        an.pose(f, r, {'Hips': (0, 0, -0.08 + 0.08 * abs(math.cos(TAU * t)))})
    run = an.action

    # ATTACK: ergue os braços e golpeia para baixo (impacto ~50%)
    an.begin('attack'); an.reset_pose()
    b0 = zbase(); b0.update(legs(0, 0, 0, 0))
    an.pose(0, b0)
    up = zbase(); up.update(legs(0, 0, 0, 0))
    up.update({'LeftArm': [(Z, -70), (X, -65)], 'RightArm': [(Z, 70), (X, -60)], 'Spine': [(X, -6)], 'Head': [(Y, 10), (X, -12)]})
    an.pose(8, up)
    dn = zbase(); dn.update(legs(0, 0, 0, 0))
    dn.update({'LeftArm': [(Z, -80), (X, 50)], 'RightArm': [(Z, 78), (X, 55)], 'Spine': [(X, 30)], 'Chest': [(X, 12)], 'Head': [(Y, 12), (X, 18)]})
    an.pose(12, dn)
    an.pose(17, dn)
    an.pose(26, b0)
    attack = an.action

    # HIT: tranco para trás
    an.begin('hit'); an.reset_pose()
    an.pose(0, b0)
    h = zbase(); h.update(legs(0, 0, 0, 0)); h.update({'Spine': [(X, -14)], 'Chest': [(X, -8)], 'Head': [(Y, 20), (X, -25)]})
    an.pose(3, h)
    an.pose(9, b0)
    hit = an.action

    # DEATH: cai de costas (o osso de controle HipsCtrl leva o corpo todo)
    an.begin('death'); an.reset_pose()
    d0 = dict(b0); d0['HipsCtrl'] = [(X, 0)]
    an.pose(0, d0, {'HipsCtrl': (0, 0, 0)})
    d1 = zbase(); d1.update(legs(0, 0, 0, 0)); d1.update({'HipsCtrl': [(X, -12)], 'Spine': [(X, -10)], 'Head': [(X, -25)],
                                                         'LeftLeg': [(X, 25)], 'RightLeg': [(X, 15)]})
    an.pose(6, d1, {'HipsCtrl': (0, 0.25, -0.1)})
    d2 = zbase(); d2.update({'HipsCtrl': [(X, -55)], 'Spine': [(X, -5)], 'Head': [(X, -20)],
                             'LeftUpLeg': [(X, -25)], 'RightUpLeg': [(X, -10)], 'LeftLeg': [(X, 40)], 'RightLeg': [(X, 30)],
                             'LeftArm': [(Z, -30), (X, -40)], 'RightArm': [(Z, 35), (X, -50)]})
    an.pose(16, d2, {'HipsCtrl': (0, 0.8, -0.75)})
    d3 = zbase(); d3.update({'HipsCtrl': [(X, -86)], 'Spine': [(X, -4)], 'Head': [(Y, 25), (X, -6)],
                             'LeftUpLeg': [(X, -30)], 'RightUpLeg': [(X, -12)], 'LeftLeg': [(X, 50)], 'RightLeg': [(X, 20)],
                             'LeftArm': [(Z, 10), (X, -20)], 'RightArm': [(Z, -5), (X, -30)]})
    an.pose(23, d3, {'HipsCtrl': (0, 1.25, -1.28)})
    d4 = dict(d3); d4['HipsCtrl'] = [(X, -82)]
    an.pose(27, d4, {'HipsCtrl': (0, 1.25, -1.2)})
    an.pose(36, d3, {'HipsCtrl': (0, 1.25, -1.28)})
    death = an.action

    mark_controls_nondeform(arm, ('Ctrl', 'IK', 'Roll', '_end'))
    clips = {'idle': idle, 'walk': walk, 'run': run, 'attack': attack, 'hit': hit, 'death': death}
    normalize(arm, [body], 1.78, idle, 0, clips=clips)
    previews('zombie', arm, [body], clips)
    export('e_zombie', arm, [body], clips, fps=24)


BUILDERS = {'rat': build_rat, 'troll': build_troll, 'angler': build_angler, 'shade': build_shade, 'zombie': build_zombie}
for name, fn in BUILDERS.items():
    if ONLY and name not in ONLY:
        continue
    C.log('==== BUILD', name)
    fn()
