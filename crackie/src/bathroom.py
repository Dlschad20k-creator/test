"""Prozedurales Voxel-Badezimmer + Spiegelwelt.

Koordinaten (Voxel, V = voxel.V): Raum x -72..72, y -140..MY, z 0..88.
Der Spiegel hängt an der Nordwand (Ebene y = MY). Hinter dem Glas liegt eine gespiegelte
Instanz des ganzen Raums (Sammlung 'Room'), darin steht später das Spiegelbild.
Die Nordwand mit dem Spiegelloch gehört NICHT zu 'Room' (wird nicht gespiegelt).
"""
import math
import bpy
import voxel as vx
from character import Vox, srgb, _h

V = vx.V
MY = 0            # Spiegelebene (Vorderseite der Nordwand), Voxel-Index der ersten Wandschicht = 0
X0, X1 = -72, 72  # Innenraum
Y0 = -140         # Südwand (hinter der Kamera)
ZT = 96           # Decke
MIR = dict(x0=-19, x1=19, z0=34, z1=80)   # Spiegelöffnung (Voxel, inklusive)
SINK_TOP = 30

PAL = {
    'tileA': '#E9DCC4', 'tileB': '#DCCBAE', 'grout': '#B9A98F', 'tileAcc': '#2F8C88', 'tileAcc2': '#25706D',
    'floorA': '#2B2A2E', 'floorB': '#D9D2C4', 'floorG': '#8B857C',
    'wood': '#7A4E31', 'wood2': '#6A4229', 'wood3': '#8C5C3B', 'counter': '#EDE8DF', 'counter2': '#DAD3C8',
    'porc': '#F4F2EE', 'porc2': '#E2DFDA', 'chrome': '#C9CED3', 'chrome2': '#8E959C',
    'frame': '#2A2522', 'frame2': '#3A332E', 'gold': '#C9A253', 'gold2': '#A8843E',
    'ceil': '#EFE8DC', 'ceil2': '#E3DACB',
    'towel': '#C8473D', 'towel2': '#A93A32', 'towelW': '#F1E9DF',
    'mat': '#2F8C88', 'mat2': '#3BA19C',
    'curtain': '#F2EDE4', 'curtain2': '#7FC3C0',
    'duck': '#F5C431', 'duckO': '#E8812C',
    'b1': '#3E7FC1', 'b2': '#E05B4C', 'b3': '#7BBF5A', 'b4': '#F0E6D2', 'cap': '#F4F4F4',
    'plant': '#3F8A4A', 'plant2': '#2E6E3A', 'pot': '#B8673E',
    'door': '#8A5A38', 'door2': '#7A4E31', 'knob': '#C9A253',
    'win': '#9FC8F0', 'winF': '#F2EEE8', 'tp': '#FAFAF7',
    'cup': '#78B6D9', 'brushA': '#E64B6A', 'brushB': '#4BB3E6', 'soap': '#F2A3C0',
    'lampW': '#FFF2D6',
}
LIN = {k: srgb(v) for k, v in PAL.items()}


def _cols(vox, seed=0, amt=0.04):
    col = {}
    for k, name in vox.items():
        j = 1 + (_h(*k, 100 + seed) - 0.5) * 2 * amt
        col[k] = tuple(min(1.0, c * j) for c in LIN[name])
    return col


def _mesh_obj(name, vox, mat, coll, pivot=(0, 0, 0), seed=0, amt=0.04, emit=None, parent=None):
    me = vx.mesh(name, _cols(vox, seed, amt), pivot=pivot, emit=emit)
    o = vx.obj(name, me, mat, coll=coll, parent=parent,
               loc=(pivot[0] * V, pivot[1] * V, pivot[2] * V) if parent is None else (0, 0, 0))
    return o


def tiles_wall(v, axis, const, a0, a1, z0, z1, accent_rows=()):
    """Wandfliesen (4x4 Voxel + Fuge). axis='x': Wand bei x=const über y a0..a1; 'y': bei y=const über x."""
    for a in range(a0, a1 + 1):
        for z in range(z0, z1 + 1):
            ta, tz = a % 5, z % 5
            if ta == 4 or tz == 4:
                c = 'grout'
            elif z // 5 in accent_rows:
                c = 'tileAcc' if ((a // 5) + (z // 5)) % 2 == 0 else 'tileAcc2'
            else:
                c = 'tileA' if ((a // 5) + (z // 5)) % 2 == 0 else 'tileB'
            v[(const, a, z) if axis == 'x' else (a, const, z)] = c


def build_room(coll, mats):
    m = mats['room']
    objs = {}
    # Boden: Schachbrett 6x6
    fl = Vox()
    for x in range(X0, X1 + 1):
        for y in range(Y0, MY):
            tx, ty = (x - X0) % 6, (y - Y0) % 6
            fl[(x, y, -1)] = 'floorG' if (tx == 5 or ty == 5) else ('floorA' if (((x - X0) // 6) + ((y - Y0) // 6)) % 2 == 0 else 'floorB')
    objs['floor'] = _mesh_obj('floor', fl, m, coll, seed=1, amt=0.03)
    # Seitenwände + Südwand (Fliesen bis z=54, darüber Putz)
    w = Vox()
    acc = (6,)
    tiles_wall(w, 'x', X0 - 1, Y0, MY - 1, 0, 54, acc)
    tiles_wall(w, 'x', X1 + 1, Y0, MY - 1, 0, 54, acc)
    tiles_wall(w, 'y', Y0 - 1, X0, X1, 0, 54, acc)
    for z in range(55, ZT):
        for y in range(Y0, MY):
            w[(X0 - 1, y, z)] = 'ceil' if _h(0, y, z, 3) < 0.7 else 'ceil2'
            w[(X1 + 1, y, z)] = 'ceil' if _h(1, y, z, 3) < 0.7 else 'ceil2'
        for x in range(X0, X1 + 1):
            w[(x, Y0 - 1, z)] = 'ceil' if _h(x, 2, z, 3) < 0.7 else 'ceil2'
    # Fenster in der Ostwand (Licht von draußen, Nacht)
    for y in range(-40, -24):
        for z in range(58, 76):
            w.pop((X1 + 1, y, z), None)
    objs['walls'] = _mesh_obj('walls', w, m, coll, seed=2, amt=0.03)
    win = Vox()
    for y in range(-41, -23):
        for z in range(57, 77):
            if y in (-41, -24) or z in (57, 76) or y == -33 or z == 67:
                win[(X1 + 1, y, z)] = 'winF'
    for y in range(-41, -23):
        win[(X1, y, 57)] = 'winF'
    objs['window'] = _mesh_obj('window_frame', win, m, coll, seed=3)
    # Decke
    c = Vox()
    for x in range(X0, X1 + 1):
        for y in range(Y0, MY):
            c[(x, y, ZT)] = 'ceil' if _h(x, y, 5, 3) < 0.75 else 'ceil2'
    objs['ceiling'] = _mesh_obj('ceiling', c, m, coll, seed=4, amt=0.02)
    # Deckenleuchte (Fassung + leuchtender Schirm)
    lamp = Vox().box(-5, 5, -34, -24, ZT - 2, ZT - 1, 'lampW')
    objs['lamp'] = _mesh_obj('ceiling_lamp', lamp, mats['lamp'], coll, seed=5, emit=set(lamp))
    # Waschtisch (Holzschrank + Platte + Becken + Armatur)
    s = Vox()
    s.box(-24, 24, -17, -1, 2, SINK_TOP - 2, lambda x, y, z: 'wood' if _h(x, y, z, 6) < 0.6 else ('wood2' if _h(x, y, z, 7) < 0.6 else 'wood3'))
    s.box(-23, 23, -17, -12, 0, 1, 'frame')                       # Sockel
    for x in (-12, 0, 12):                                          # Türfugen
        for z in range(4, SINK_TOP - 3):
            s[(x, -18, z)] = 'wood2'
    for x in (-15, -9, 9, 15):                                      # Griffe
        s[(x, -18, 20)] = 'gold'; s[(x, -18, 21)] = 'gold'
    s.box(-26, 26, -19, -1, SINK_TOP - 1, SINK_TOP, lambda x, y, z: 'counter' if _h(x, y, z, 8) < 0.7 else 'counter2')
    s.rm(-9, 9, -15, -5, SINK_TOP - 1, SINK_TOP)                   # Beckenloch
    s.box(-9, 9, -15, -5, SINK_TOP - 5, SINK_TOP - 2, 'porc')
    s.rm(-8, 8, -14, -6, SINK_TOP - 4, SINK_TOP - 2)
    s.box(-8, 8, -14, -6, SINK_TOP - 5, SINK_TOP - 5, 'porc2')
    s[(0, -10, SINK_TOP - 4)] = 'chrome2'
    s.box(-1, 1, -4, -2, SINK_TOP + 1, SINK_TOP + 6, 'chrome')      # Armatur
    s.box(-1, 1, -8, -5, SINK_TOP + 6, SINK_TOP + 7, 'chrome')
    s[(0, -8, SINK_TOP + 5)] = 'chrome2'
    s.box(3, 4, -4, -3, SINK_TOP + 7, SINK_TOP + 8, 'chrome2')
    objs['sink'] = _mesh_obj('sink', s, m, coll, seed=6)
    # Becher mit Zahnbürsten, Seifenspender
    cup = Vox().box(-17, -14, -9, -6, SINK_TOP + 1, SINK_TOP + 5, 'cup')
    cup.rm(-16, -15, -8, -7, SINK_TOP + 5, SINK_TOP + 5)
    for z in range(SINK_TOP + 5, SINK_TOP + 10):
        cup[(-16, -8, z)] = 'brushA'; cup[(-15, -7, z + 1)] = 'brushB'
    objs['cup'] = _mesh_obj('cup', cup, m, coll, seed=7)
    soap = Vox().box(13, 16, -9, -6, SINK_TOP + 1, SINK_TOP + 7, 'soap')
    soap.box(14, 15, -8, -7, SINK_TOP + 8, SINK_TOP + 9, 'chrome'); soap[(14, -9, SINK_TOP + 9)] = 'chrome'
    objs['soap'] = _mesh_obj('soap', soap, m, coll, seed=8)
    # Flaschen auf der Waschtischplatte (fliegen in Szene 6)
    bottles = []
    specs = [(-23, 'b1', 7), (-20, 'b2', 9), (19, 'b3', 8), (22, 'b4', 10), (25, 'b2', 6)]
    for i, (bx, col, hgt) in enumerate(specs):
        b = Vox().box(-1, 1, -1, 1, 0, hgt - 1, col)
        b.box(0, 0, 0, 0, hgt, hgt + 1, 'cap'); b[(-1, -2, 2)] = 'b4' if col != 'b4' else 'b1'; b[(0, -2, 3)] = 'b4' if col != 'b4' else 'b1'
        o = _mesh_obj(f'bottle{i}', b, m, coll, seed=10 + i)
        o.location = (bx * V, -3 * V, (SINK_TOP + 1) * V)
        o['home'] = tuple(o.location)
        bottles.append(o)
    objs['bottles'] = bottles
    # Handtuchhalter + Handtuch (Ostwand)
    rack = Vox().box(X1 - 1, X1, -24, -6, 50, 50, 'chrome')
    rack[(X1, -24, 51)] = 'chrome'; rack[(X1, -6, 51)] = 'chrome'
    objs['rack'] = _mesh_obj('towel_rack', rack, m, coll, seed=11)
    tw = Vox()
    for y in range(-23, -7):
        for z in range(30, 51):
            stripe = z in (34, 35, 44)
            tw[(0, y, z)] = 'towelW' if stripe else ('towel' if _h(0, y, z, 12) < 0.7 else 'towel2')
            if z > 47:
                tw[(-1, y, z)] = 'towel2'
    towel = _mesh_obj('towel', tw, m, coll, seed=12, pivot=(0, -15, 50))
    towel.location = ((X1 - 2) * V, -15 * V, 50 * V)
    towel['home'] = tuple(towel.location)
    objs['towel'] = towel
    # Badewanne mit Duschvorhang (Westseite)
    tub = Vox().box(X0, X0 + 18, -80, -30, 0, 18, 'porc')
    tub.rm(X0 + 2, X0 + 16, -78, -32, 4, 18)
    tub.paint(X0, X0 + 18, -80, -30, 18, 18, 'porc2')
    tub.box(X0 + 1, X0 + 2, -33, -32, 18, 24, 'chrome')
    objs['tub'] = _mesh_obj('bathtub', tub, m, coll, seed=13)
    duck = Vox().box(-1, 2, -1, 1, 0, 2, 'duck')
    duck.box(1, 2, -1, 0, 3, 5, 'duck'); duck[(3, -1, 4)] = 'duckO'; duck[(3, 0, 4)] = 'duckO'
    d = _mesh_obj('duck', duck, m, coll, seed=14)
    d.location = ((X0 + 17) * V, -38 * V, 19 * V); d.rotation_euler = (0, 0, math.radians(-30))
    objs['duck'] = d
    cur = Vox()
    for y in range(-80, -56):
        for z in range(22, 80):
            xo = X0 + 19 + (1 if (y // 2) % 2 else 0)
            cur[(xo, y, z)] = 'curtain2' if (y // 3) % 3 == 0 else 'curtain'
    for y in range(-81, -29):
        cur[(X0 + 19, y, 81)] = 'chrome'
    objs['curtain'] = _mesh_obj('curtain', cur, m, coll, seed=15)
    # Toilette (Südost), Klopapier
    t = Vox().box(52, 64, -138, -126, 0, 14, 'porc')
    t.box(53, 63, -138, -136, 15, 30, 'porc'); t.box(53, 63, -138, -136, 31, 31, 'porc2')
    t.box(52, 64, -135, -121, 15, 16, 'porc2'); t.rm(54, 62, -133, -123, 16, 16)
    t[(62, -135, 29)] = 'chrome'
    objs['toilet'] = _mesh_obj('toilet', t, m, coll, seed=16)
    tp = Vox().box(X1 - 3, X1 - 1, -118, -115, 26, 29, 'tp')
    tp[(X1, -117, 28)] = 'chrome'
    objs['tp'] = _mesh_obj('toilet_paper', tp, m, coll, seed=17)
    # Badematte vor dem Waschtisch
    mt = Vox()
    for x in range(-16, 17):
        for y in range(-34, -19):
            mt[(x, y, 0)] = 'mat2' if (x + y) % 4 == 0 or abs(x) == 16 or y in (-34, -20) else 'mat'
    objs['bathmat'] = _mesh_obj('bathmat', mt, m, coll, seed=18)
    # Pflanze auf dem Fensterbrett
    pl = Vox().box(X1 - 3, X1 - 1, -36, -32, 58, 61, 'pot')
    for i in range(14):
        a = i * 2.4
        x = X1 - 2 + int(round(math.cos(a) * (1 + i % 3)))
        y = -34 + int(round(math.sin(a) * (1 + i % 3)))
        for z in range(62, 64 + i % 5):
            pl[(x, y, z)] = 'plant' if i % 2 else 'plant2'
    objs['plant'] = _mesh_obj('plant', pl, m, coll, seed=19)
    # Tür in der Südwand
    dr = Vox().box(-12, 12, Y0, Y0, 0, 62, lambda x, y, z: 'door' if _h(x, y, z, 20) < 0.7 else 'door2')
    for x in range(-10, 11):
        dr[(x, Y0 + 1, 30)] = 'door2'
    dr[(9, Y0 + 1, 31)] = 'knob'; dr[(9, Y0 + 2, 31)] = 'knob'
    objs['door'] = _mesh_obj('door', dr, m, coll, seed=21)
    return objs


def build_north_wall(coll, mats):
    """Nordwand mit Spiegelöffnung, Spiegelrahmen (aus Brocken für die Zerstörung) und Lampen."""
    m = mats['room']
    w = Vox()
    for x in range(X0 - 1, X1 + 2):
        for z in range(0, ZT + 1):
            if MIR['x0'] <= x <= MIR['x1'] and MIR['z0'] <= z <= MIR['z1']:
                continue
            if z <= 54:
                tx, tz = (x - X0) % 5, z % 5
                c = 'grout' if (tx == 4 or tz == 4) else ('tileAcc' if z // 5 == 6 and ((x // 5) + (z // 5)) % 2 == 0 else
                                                          'tileAcc2' if z // 5 == 6 else
                                                          ('tileA' if ((x // 5) + (z // 5)) % 2 == 0 else 'tileB'))
            else:
                c = 'ceil' if _h(x, 0, z, 3) < 0.7 else 'ceil2'
            w[(x, MY, z)] = c
            w[(x, MY + 1, z)] = c
    wall = _mesh_obj('north_wall', w, m, coll, seed=22, amt=0.03)
    # Rahmen: dunkles Holz mit Goldkante, in 6 Brocken (für Szene 6)
    fx0, fx1, fz0, fz1 = MIR['x0'] - 3, MIR['x1'] + 3, MIR['z0'] - 3, MIR['z1'] + 3
    fr = Vox()
    for x in range(fx0, fx1 + 1):
        for z in range(fz0, fz1 + 1):
            inside = MIR['x0'] <= x <= MIR['x1'] and MIR['z0'] <= z <= MIR['z1']
            if inside:
                continue
            ring = min(x - fx0, fx1 - x, z - fz0, fz1 - z)
            c = 'gold' if ring == 2 else ('frame' if _h(x, 0, z, 23) < 0.6 else 'frame2')
            fr[(x, MY - 1, z)] = c
            fr[(x, MY - 2, z)] = 'gold2' if ring == 2 else c
            if ring == 0:
                fr[(x, MY - 3, z)] = 'frame2'
    chunks = {}
    for k, c in fr.items():
        x, y, z = k
        key = ('T' if z > MIR['z1'] else 'B' if z < MIR['z0'] else 'M') + ('L' if x < -6 else 'R' if x > 6 else 'C')
        chunks.setdefault(key, Vox())[k] = c
    frame_objs = {}
    for key, vv in chunks.items():
        xs = [k[0] for k in vv]; zs = [k[2] for k in vv]
        piv = ((min(xs) + max(xs)) / 2, MY - 2, (min(zs) + max(zs)) / 2)
        o = _mesh_obj(f'frame_{key}', vv, m, coll, pivot=piv, seed=24)
        o['home'] = tuple(o.location)
        frame_objs[key] = o
    # Leuchtbirnen über dem Spiegel
    bl = Vox()
    for i in range(5):
        bx = -16 + i * 8
        bl.box(bx - 1, bx + 1, MY - 4, MY - 2, fz1 + 2, fz1 + 4, 'lampW')
    bulbs = _mesh_obj('vanity_bulbs', bl, mats['bulb'], coll, seed=25, emit=set(bl))
    bar = Vox().box(-20, 20, MY - 1, MY - 1, fz1 + 2, fz1 + 4, 'chrome')
    _mesh_obj('vanity_bar', bar, m, coll, seed=26)
    return wall, frame_objs, bulbs


def glass_material():
    """Spiegelglas -> Flüssigportal. Werte: Portal (0..1), Ripple, Crack (0..1), CrackX/CrackZ, Gone."""
    mt = bpy.data.materials.new('MirrorGlass')
    mt.use_nodes = True
    nt = mt.node_tree; N = nt.nodes; L = nt.links
    N.clear()
    out = N.new('ShaderNodeOutputMaterial')
    def val(name, v):
        n = N.new('ShaderNodeValue'); n.name = name; n.label = name; n.outputs[0].default_value = v; return n.outputs[0]
    def math_(op, a, b=None, clamp=False):
        n = N.new('ShaderNodeMath'); n.operation = op; n.use_clamp = clamp
        for i, s in enumerate((a, b)):
            if s is None:
                continue
            if isinstance(s, (int, float)):
                n.inputs[i].default_value = s
            else:
                L.new(s, n.inputs[i])
        return n.outputs[0]
    portal = val('Portal', 0.0); crack = val('Crack', 0.0); gone = val('Gone', 0.0); tval = val('T', 0.0)
    cx = val('CrackX', 0.0); cz = val('CrackZ', 0.0)
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    # Portal-Wirbel: verzerrtes Rauschen
    comb = N.new('ShaderNodeCombineXYZ')
    L.new(sep.outputs['X'], comb.inputs[0]); L.new(sep.outputs['Z'], comb.inputs[1]); L.new(tval, comb.inputs[2])
    nz = N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '3D'
    nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 6.0; nz.inputs['Distortion'].default_value = 2.5
    L.new(comb.outputs[0], nz.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position = 0.25; el[0].color = (0.02, 0.0, 0.06, 1)
    el[1].position = 0.75; el[1].color = (0.15, 0.85, 1.0, 1)
    e2 = el.new(0.5); e2.color = (0.45, 0.08, 0.95, 1)
    L.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    em = N.new('ShaderNodeEmission'); L.new(ramp.outputs['Color'], em.inputs['Color'])
    em_str = math_('MULTIPLY', portal, 3.0); L.new(em_str, em.inputs['Strength'])
    # Risse: Voronoi-Kanten innerhalb eines wachsenden Radius um den Aufprallpunkt
    vor = N.new('ShaderNodeTexVoronoi'); vor.feature = 'DISTANCE_TO_EDGE'; vor.inputs['Scale'].default_value = 9.0
    vor.inputs['Randomness'].default_value = 1.0
    L.new(tc.outputs['Object'], vor.inputs['Vector'])
    edge = math_('LESS_THAN', vor.outputs['Distance'], 0.018)
    dx = math_('SUBTRACT', sep.outputs['X'], cx); dz = math_('SUBTRACT', sep.outputs['Z'], cz)
    r = math_('SQRT', math_('ADD', math_('MULTIPLY', dx, dx), math_('MULTIPLY', dz, dz)))
    within = math_('LESS_THAN', r, math_('MULTIPLY', crack, 1.4))
    cracks = math_('MULTIPLY', edge, within)
    crack_em = N.new('ShaderNodeEmission'); crack_em.inputs['Color'].default_value = (0.75, 0.95, 1.0, 1)
    # Glas: fast durchsichtig, leichter Glanz
    tr = N.new('ShaderNodeBsdfTransparent')
    gl = N.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.05
    fres = N.new('ShaderNodeLayerWeight'); fres.inputs['Blend'].default_value = 0.15
    mixg = N.new('ShaderNodeMixShader')
    L.new(math_('MULTIPLY', fres.outputs['Fresnel'], 0.25), mixg.inputs[0])
    L.new(tr.outputs[0], mixg.inputs[1]); L.new(gl.outputs[0], mixg.inputs[2])
    # Ringwellen (Flüssigkeit) um den Berührpunkt
    ringv = val('Ring', 0.0)
    ringw = math_('SINE', math_('SUBTRACT', math_('MULTIPLY', r, 38.0), math_('MULTIPLY', tval, 9.0)))
    ringm = math_('MULTIPLY', math_('MULTIPLY', math_('ADD', ringw, 0.2, True), ringv),
                  math_('SUBTRACT', 1.0, math_('MULTIPLY', r, 1.6), True))
    ring_em = N.new('ShaderNodeEmission'); ring_em.inputs['Color'].default_value = (0.35, 0.9, 1.0, 1)
    L.new(math_('MULTIPLY', ringm, 2.5), ring_em.inputs['Strength'])
    keep = math_('SUBTRACT', 1.0, gone)
    # Glas (Glanz) verschwindet mit 'Gone'
    mixg2 = N.new('ShaderNodeMixShader')
    L.new(math_('MULTIPLY', math_('MULTIPLY', fres.outputs['Fresnel'], 0.25), keep), mixg2.inputs[0])
    L.new(tr.outputs[0], mixg2.inputs[1]); L.new(gl.outputs[0], mixg2.inputs[2])
    L.new(math_('MULTIPLY', math_('MULTIPLY', cracks, 2.5), keep), crack_em.inputs['Strength'])
    add1 = N.new('ShaderNodeAddShader'); L.new(mixg2.outputs[0], add1.inputs[0]); L.new(em.outputs[0], add1.inputs[1])
    add2 = N.new('ShaderNodeAddShader'); L.new(add1.outputs[0], add2.inputs[0]); L.new(crack_em.outputs[0], add2.inputs[1])
    add3 = N.new('ShaderNodeAddShader'); L.new(add2.outputs[0], add3.inputs[0]); L.new(ring_em.outputs[0], add3.inputs[1])
    L.new(add3.outputs[0], out.inputs['Surface'])
    return mt


def build_glass(coll):
    me = bpy.data.meshes.new('mirror_glass')
    x0, x1 = (MIR['x0'] - 0.5) * V, (MIR['x1'] + 0.5) * V
    z0, z1 = (MIR['z0'] - 0.5) * V, (MIR['z1'] + 0.5) * V
    y = (MY - 0.5) * V - 0.004
    me.from_pydata([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [], [(0, 1, 2, 3)])
    me.materials.append(glass_material())
    o = bpy.data.objects.new('mirror_glass', me)
    coll.objects.link(o)
    o.visible_shadow = False
    return o
