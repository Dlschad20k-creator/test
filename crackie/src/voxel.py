"""Voxel-Werkzeuge für Blender: Mesher (nur sichtbare Flächen), Voxel-Material mit Fugen,
Dunkel-Überblendung und leuchtenden Augen."""
import bpy, random

V = 0.028  # Kantenlänge eines Voxels in Metern (für alles gleich; Crackie ≈ 1,88 m)

# Flächen eines Würfels: Normale + vier Ecken (gegen den Uhrzeigersinn von außen gesehen)
_FACES = [
    ((1, 0, 0), [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)]),
    ((-1, 0, 0), [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)]),
    ((0, 1, 0), [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)]),
    ((0, -1, 0), [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)]),
    ((0, 0, 1), [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)]),
    ((0, 0, -1), [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)]),
]
_UV = [(0, 0), (1, 0), (1, 1), (0, 1)]


def jitter(c, amt=0.05, rnd=random):
    k = 1 + (rnd.random() - 0.5) * 2 * amt
    return tuple(max(0.0, min(1.0, x * k)) for x in c)


def mesh(name, vox, pivot=(0, 0, 0), dark=None, emit=None, size=V, solid=None):
    """vox: {(x,y,z): (r,g,b)} in Voxel-Koordinaten. pivot: Drehpunkt (Voxel-Einheiten, Kommazahlen erlaubt).
    dark: {(x,y,z): (r,g,b)} Alternativfarben (dunkle Version). emit: Menge leuchtender Voxel.
    solid: optionale Menge, die zusätzlich als „belegt“ gilt (Flächen dorthin werden weggelassen)."""
    verts, faces, col, cold, uv, em = [], [], [], [], [], []
    occ = vox if solid is None else (set(vox) | set(solid))
    px, py, pz = pivot
    for (x, y, z), c in vox.items():
        cd = dark.get((x, y, z), c) if dark else c
        e = 1.0 if (emit and (x, y, z) in emit) else 0.0
        for n, quad in _FACES:
            if (x + n[0], y + n[1], z + n[2]) in occ:
                continue
            base = len(verts)
            for (dx, dy, dz) in quad:
                verts.append(((x + dx - 0.5 - px) * size, (y + dy - 0.5 - py) * size, (z + dz - 0.5 - pz) * size))
            faces.append((base, base + 1, base + 2, base + 3))
            for i in range(4):
                col.extend((*c, 1.0)); cold.extend((*cd, 1.0)); uv.extend(_UV[i])
            em.append(e)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    a = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER'); a.data.foreach_set('color', col)
    b = me.color_attributes.new('ColD', 'FLOAT_COLOR', 'CORNER'); b.data.foreach_set('color', cold)
    u = me.uv_layers.new(name='UV'); u.data.foreach_set('uv', uv)
    ea = me.attributes.new('Emit', 'FLOAT', 'FACE'); ea.data.foreach_set('value', em)
    me.update()
    return me


def _sock(node, ident):
    for s in list(node.inputs) + list(node.outputs):
        if s.identifier == ident:
            return s
    raise KeyError(ident)


def voxel_material(name, glow_color=(0.62, 0.22, 1.0), rough=0.6, seam=0.35):
    """Material: Farbe aus 'Col' (bzw. 'ColD' über Wert 'Dark'), feine Fugen an jeder Voxelkante,
    Leuchten über Attribut 'Emit' × Wert 'Glow'."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    N.clear()
    out = N.new('ShaderNodeOutputMaterial'); out.location = (900, 0)
    bsdf = N.new('ShaderNodeBsdfPrincipled'); bsdf.location = (600, 0)
    bsdf.inputs['Roughness'].default_value = rough
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.35
    ca = N.new('ShaderNodeAttribute'); ca.attribute_name = 'Col'; ca.location = (-600, 200)
    cd = N.new('ShaderNodeAttribute'); cd.attribute_name = 'ColD'; cd.location = (-600, 0)
    dark = N.new('ShaderNodeValue'); dark.name = 'Dark'; dark.label = 'Dark'; dark.outputs[0].default_value = 0.0; dark.location = (-600, -200)
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.location = (-350, 100)
    L.new(dark.outputs[0], _sock(mix, 'Factor_Float')); L.new(ca.outputs['Color'], _sock(mix, 'A_Color')); L.new(cd.outputs['Color'], _sock(mix, 'B_Color'))
    # Fugen: Abstand zur Flächenkante aus den UV-Koordinaten
    uvn = N.new('ShaderNodeUVMap'); uvn.uv_map = 'UV'; uvn.location = (-800, -400)
    sep = N.new('ShaderNodeSeparateXYZ'); sep.location = (-600, -400); L.new(uvn.outputs['UV'], sep.inputs[0])
    def mm(op, a, b=None, loc=(0, 0)):
        n = N.new('ShaderNodeMath'); n.operation = op; n.location = loc
        if isinstance(a, float): n.inputs[0].default_value = a
        else: L.new(a, n.inputs[0])
        if b is not None:
            if isinstance(b, float): n.inputs[1].default_value = b
            else: L.new(b, n.inputs[1])
        return n.outputs[0]
    u1 = mm('SUBTRACT', 1.0, sep.outputs['X'], (-400, -350)); v1 = mm('SUBTRACT', 1.0, sep.outputs['Y'], (-400, -450))
    mu = mm('MINIMUM', sep.outputs['X'], u1, (-250, -350)); mv = mm('MINIMUM', sep.outputs['Y'], v1, (-250, -450))
    md = mm('MINIMUM', mu, mv, (-100, -400))
    mr = N.new('ShaderNodeMapRange'); mr.location = (50, -400); mr.inputs['From Min'].default_value = 0.0; mr.inputs['From Max'].default_value = 0.09
    mr.inputs['To Min'].default_value = 1.0 - seam; mr.inputs['To Max'].default_value = 1.0
    L.new(md, mr.inputs['Value'])
    mul = N.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.location = (250, 100)
    _sock(mul, 'Factor_Float').default_value = 1.0
    L.new(_sock(mix, 'Result_Color'), _sock(mul, 'A_Color'))
    comb = N.new('ShaderNodeCombineXYZ'); comb.location = (250, -300)
    for i in range(3): L.new(mr.outputs['Result'], comb.inputs[i])
    L.new(comb.outputs[0], _sock(mul, 'B_Color'))
    L.new(_sock(mul, 'Result_Color'), bsdf.inputs['Base Color'])
    # Leuchten
    ea = N.new('ShaderNodeAttribute'); ea.attribute_name = 'Emit'; ea.location = (-600, -650)
    glow = N.new('ShaderNodeValue'); glow.name = 'Glow'; glow.label = 'Glow'; glow.outputs[0].default_value = 0.0; glow.location = (-600, -800)
    gm = mm('MULTIPLY', ea.outputs['Fac'], glow.outputs[0], (-350, -700))
    bsdf.inputs['Emission Color'].default_value = (*glow_color, 1)
    L.new(gm, bsdf.inputs['Emission Strength'])
    L.new(bsdf.outputs[0], out.inputs[0])
    return m


def obj(name, me, mat, parent=None, loc=(0, 0, 0), coll=None):
    o = bpy.data.objects.new(name, me)
    if mat is not None:
        me.materials.append(mat)
    (coll or bpy.context.scene.collection).objects.link(o)
    if parent is not None:
        o.parent = parent
    o.location = loc
    return o


def empty(name, parent=None, loc=(0, 0, 0), coll=None):
    o = bpy.data.objects.new(name, None)
    (coll or bpy.context.scene.collection).objects.link(o)
    if parent is not None:
        o.parent = parent
    o.location = loc
    o.empty_display_size = 0.1
    return o
