"""Baut die komplette Szene (Bad, Spiegelwelt, Figuren, Licht, Kamera, Effekte) auf.

    python build.py <out.blend>            -> baut, animiert (story.py) und speichert
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import voxel as vx
import bathroom as bath
import character as ch
import fx
from character import srgb
from timeline import FPS, FRAMES

V = vx.V
P = (bath.MY - 0.5) * V          # Spiegelebene in Metern (y)


def new_coll(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


def emissive_voxel_mat(name, color):
    return vx.voxel_material(name, glow_color=color, rough=0.4)


def light(name, kind, loc, rot, energy, color, coll, size=None, spot=None):
    L = bpy.data.lights.new(name, kind)
    L.energy = energy
    L.color = color
    if size is not None:
        if kind == 'AREA':
            if isinstance(size, tuple):
                L.shape = 'RECTANGLE'; L.size, L.size_y = size
            else:
                L.shape = 'DISK'; L.size = size
        else:
            L.shadow_soft_size = size
    if spot is not None:
        L.spot_size = math.radians(spot[0]); L.spot_blend = spot[1]
    o = bpy.data.objects.new(name, L)
    coll.objects.link(o)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    return o


def mirror_loc(loc):
    return (loc[0], 2 * P - loc[1], loc[2])


def mirror_rot(rot):
    """Euler (Grad) eines Strahlers an der Spiegelebene gespiegelt (Richtung -> y umgekehrt)."""
    from mathutils import Euler, Vector, Matrix
    m = Euler([math.radians(a) for a in rot]).to_matrix()
    d = m @ Vector((0, 0, -1))
    d.y = -d.y
    q = d.to_track_quat('-Z', 'Y')
    return [math.degrees(a) for a in q.to_euler()]


def setup_render(sc, quality='preview'):
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = 12
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.05
    cy.use_denoising = True
    try:
        cy.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    cy.max_bounces = 4; cy.diffuse_bounces = 2; cy.glossy_bounces = 1
    cy.transmission_bounces = 2; cy.transparent_max_bounces = 8; cy.volume_bounces = 0
    cy.caustics_reflective = False; cy.caustics_refractive = False
    cy.sample_clamp_indirect = 4.0
    cy.blur_glossy = 1.0
    sc.render.use_persistent_data = True
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, FRAMES
    sc.render.resolution_x, sc.render.resolution_y = 576, 1024
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    sc.view_settings.exposure = -0.4
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.film_transparent = False
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.35
    sc.render.motion_blur_position = 'START'
    cy.use_fast_gi = True
    cy.ao_bounces_render = 1
    cy.samples = 8


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    setup_render(sc)
    H = {}
    # Welt: dunkles Nachtblau (sichtbar durchs Fenster)
    w = bpy.data.worlds.new('World'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.006, 0.010, 0.030, 1); bg.inputs[1].default_value = 1.0
    H['world_bg'] = bg

    mats = {
        'room': vx.voxel_material('Room', rough=0.55, seam=0.30),
        'lamp': emissive_voxel_mat('Lamp', (1.0, 0.80, 0.55)),
        'bulb': emissive_voxel_mat('Bulb', (1.0, 0.78, 0.50)),
    }
    mats['lamp'].node_tree.nodes['Glow'].outputs[0].default_value = 6.0
    mats['bulb'].node_tree.nodes['Glow'].outputs[0].default_value = 9.0
    H['mats'] = mats

    room = new_coll('Room')
    _fx = []
    def fx_coll():
        if not _fx:
            _fx.append(new_coll('FX'))
        return _fx[0]
    north = new_coll('North')
    chars = new_coll('Characters')
    lights = new_coll('Lights')
    H['room'] = bath.build_room(room, mats)
    wall, frame, bulbs = bath.build_north_wall(north, mats)
    H['frame'] = frame
    H['glass'] = bath.build_glass(north)

    # Spiegelwelt: gespiegelte Instanz des Raums
    mw = vx.empty('MirrorWorld', loc=(0, 2 * P, 0))
    mw.scale = (1, -1, 1)
    inst = bpy.data.objects.new('MirrorRoom', None)
    inst.instance_type = 'COLLECTION'; inst.instance_collection = room
    sc.collection.objects.link(inst)
    inst.parent = mw
    H['mirror_world'] = mw

    # Figuren
    H['crackie'] = ch.Rig('crackie', coll=chars)
    H['dark'] = ch.Rig('dark', parent=mw, coll=chars)
    H['shadow'] = ch.Rig('shadow', coll=chars)
    for o in H['shadow'].obj.values():
        o.visible_camera = False; o.visible_diffuse = False; o.visible_glossy = False
        o.visible_transmission = False; o.visible_volume_scatter = False

    # Licht – echte Welt (warm) und Spiegelwelt (gespiegelt, später kalt)
    warm = (1.0, 0.76, 0.52); cold = (0.45, 0.60, 1.0)
    zt = bath.ZT * V
    defs = {
        'ceiling': ('AREA', (0, -29 * V, zt - 0.08), (0, 0, 0), 140, warm, 0.6, None),
        'vanity': ('AREA', (0, P - 0.12, 84 * V), (-70, 0, 0), 55, (1.0, 0.80, 0.58), (1.2, 0.12), None),
        'window': ('SPOT', (2.55, -0.91, 2.71), (45, 0, 90), 1500, cold, 0.05, (38, 0.25)),
        'fill': ('AREA', (0, -135 * V, 62 * V), (75, 0, 180), 70, (1.0, 0.85, 0.7), 1.8, None),
    }
    H['lights'] = {}
    H['mlights'] = {}
    for k, (kind, loc, rot, e, col, size, spot) in defs.items():
        H['lights'][k] = light('L_' + k, kind, loc, rot, e, col, lights, size, spot)
        H['mlights'][k] = light('M_' + k, kind, mirror_loc(loc), mirror_rot(rot), e, col, lights, size, spot)
    # Akzent: roter Gefahren-Strahler, Cyan-Magie am Spiegel
    H['lights']['red'] = light('L_red', 'POINT', (0.9, -1.4, 0.4), (0, 0, 0), 0, (1.0, 0.08, 0.05), lights, 0.2)
    H['lights']['cyan'] = light('L_cyan', 'AREA', (0, P - 0.25, 59 * V), (-90, 0, 0), 0, (0.25, 0.9, 1.0), lights, (1.1, 1.1))
    H['lights']['violet'] = light('L_violet', 'POINT', (0, P + 0.6, 1.6), (0, 0, 0), 0, (0.6, 0.2, 1.0), lights, 0.3)
    H['lights']['rim'] = light('L_rim', 'SPOT', (-1.1, -0.15, 2.45), (0, 0, 0), 0, (0.6, 0.75, 1.0), lights, 0.15, (40, 0.4))
    H['lights']['shadow'] = light('L_shadow', 'SPOT', (-0.60, -2.40, 1.0), (0, 0, 0), 0, (1.0, 0.70, 0.45), lights, 0.02, (85, 0.15))
    from mathutils import Vector
    for k, tgt in (('rim', (0.2, -1.1, 1.4)), ('shadow', (1.10, -0.014, 1.60))):
        o = H['lights'][k]
        o.rotation_euler = (Vector(tgt) - o.location).to_track_quat('-Z', 'Y').to_euler()

    # Spiegelrahmen + Lampen auch in der Spiegelwelt (gespiegelte Instanz)
    deco = new_coll('NorthDeco')
    for o in list(frame.values()) + [bulbs, bpy.data.objects['vanity_bar']]:
        north.objects.unlink(o); deco.objects.link(o)
    dinst = bpy.data.objects.new('MirrorDeco', None)
    dinst.instance_type = 'COLLECTION'; dinst.instance_collection = deco
    sc.collection.objects.link(dinst); dinst.parent = mw

    # Lichtstrahlen durchs Fenster (vorgetäuscht volumetrisch), Teil des Raums -> auch gespiegelt
    H['shaft_mat'] = []
    for i, (yy, st) in enumerate(((-1.04, 0.10), (-0.91, 0.14), (-0.78, 0.08))):
        m = fx.light_shaft_material(f'Shaft{i}', (0.55, 0.70, 1.0), st)
        m['base'] = st
        H['shaft_mat'].append(m)
        fx.light_shaft(f'shaft{i}', room, (1.70, yy, 1.98 - i * 0.05), (-0.12 + i * 0.1, yy, 0.0), 0.11 + 0.03 * i, m)

    # Effekt-Schwärme
    cyan, vio = srgb('#5CF2FF'), srgb('#B04DFF')
    H['fx'] = {
        'portal': fx.Swarm('fx_portal', fx_coll(), 60, [cyan, vio, srgb('#E9F9FF')], fx.glow_mat('FxPortal', (0.5, 0.8, 1.0), 6.0), 0.8, True, 1),
        'shards': fx.Swarm('fx_shard', fx_coll(), 140, [srgb('#CFEFFF'), srgb('#A9DDF2'), srgb('#F2FBFF')], fx.glow_mat('FxShard', (0.7, 0.95, 1.0), 1.2), 1.0, True, 2),
        'dust': fx.Swarm('fx_dust', fx_coll(), 30, [srgb('#8E877E'), srgb('#6F6A63'), srgb('#B3ACA2')], mats['room'], 1.0, False, 3),
        'stars': fx.Swarm('fx_star', fx_coll(), 12, [srgb('#FFE14D'), srgb('#FFFFFF')], fx.glow_mat('FxStar', (1.0, 0.85, 0.3), 8.0), 0.8, True, 4),
        'debris': fx.Swarm('fx_debris', fx_coll(), 50, [srgb('#2A2522'), srgb('#3A332E'), srgb('#C9A253')], mats['room'], 1.2, False, 5),
        'kostars': fx.Swarm('fx_kostar', fx_coll(), 5, [srgb('#FFE14D')], fx.glow_mat('FxKO', (1.0, 0.85, 0.3), 6.0), 0.9, True, 6),
        'glitch': fx.Swarm('fx_glitch', fx_coll(), 24, [vio, cyan, srgb('#FF3B6B')], fx.glow_mat('FxGlitch', (0.7, 0.3, 1.0), 5.0), 1.0, True, 7),
        'motes': fx.Swarm('fx_mote', fx_coll(), 40, [srgb('#FFF4E0')], fx.glow_mat('FxMote', (1.0, 0.9, 0.75), 1.5), 0.28, True, 8),
    }
    eye_mat = fx.glow_mat('ShadowEyes', (0.62, 0.25, 1.0), 30.0)
    H['shadow_eyes'] = []
    for i in range(2):
        o = bpy.data.objects.new(f'shadow_eye{i}', fx.cube_mesh(f'shadow_eye{i}', srgb('#C45BFF'), 1.3, True))
        o.data.materials.append(eye_mat)
        fx_coll().objects.link(o); o.scale = (0, 0, 0); o.visible_shadow = False
        H['shadow_eyes'].append(o)

    # Kamera
    cd = bpy.data.cameras.new('Cam')
    cam = bpy.data.objects.new('Cam', cd)
    sc.collection.objects.link(cam); sc.camera = cam
    cd.lens = 35; cd.sensor_width = 36; cd.clip_start = 0.05; cd.clip_end = 40
    cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.8; cd.dof.focus_distance = 1.5
    H['cam'] = cam
    # weiches Fülllicht an der Kamera: Gesichter bleiben in jeder Einstellung lesbar
    cf = bpy.data.lights.new('L_camfill', 'AREA'); cf.energy = 35; cf.size = 0.9; cf.color = (1.0, 0.88, 0.76)
    cfo = bpy.data.objects.new('L_camfill', cf); lights.objects.link(cfo)
    cfo.parent = cam; cfo.location = (0.35, 0.25, 0.05)
    cfo.visible_camera = False
    H['lights']['camfill'] = cfo
    return H


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out = args[0]
    voice = args[1] if len(args) > 1 else None
    H = build()
    import story
    story.animate(H, voice_dir=voice, meta_path=os.path.splitext(out)[0] + '_meta.json')
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out), compress=True)
    print('gespeichert:', out)
