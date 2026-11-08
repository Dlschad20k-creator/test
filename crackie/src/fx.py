"""Effekte aus Voxeln: Glassplitter, Portal-Partikel, Staub, Trümmer, Sterne, Glitch-Würfel,
Lichtstrahlen (volumetrisch vorgetäuscht) und Schatten-Augen.
Jeder Effekt ist eine Gruppe kleiner Würfel-Objekte, deren Bahn pro Frame berechnet wird."""
import math, random
import bpy
import numpy as np
import voxel as vx
from character import srgb
from timeline import FPS, FRAMES

V = vx.V


def cube_mesh(name, color, size=1.0, emit=False):
    vox = {(0, 0, 0): color}
    me = vx.mesh(name, vox, pivot=(0, 0, 0), emit={(0, 0, 0)} if emit else None, size=V * size)
    return me


class Swarm:
    """n Würfel mit gemeinsamer Bahnfunktion f(i, t) -> (pos, rot, scale) oder None (unsichtbar)."""

    def __init__(self, name, coll, n, colors, mat, size=1.0, emit=False, seed=0, parent=None):
        self.name, self.n = name, n
        rnd = random.Random(seed)
        self.objs = []
        meshes = {}
        for i in range(n):
            c = colors[i % len(colors)]
            key = (c, size)
            if key not in meshes:
                meshes[key] = cube_mesh(f'{name}_m{len(meshes)}', c, size, emit)
            o = bpy.data.objects.new(f'{name}{i:03d}', meshes[key])
            o.data.materials.clear() if False else None
            if not meshes[key].materials:
                meshes[key].materials.append(mat)
            coll.objects.link(o)
            if parent is not None:
                o.parent = parent
            o.scale = (0, 0, 0)
            o.visible_shadow = False
            self.objs.append(o)
        self.rnd = rnd

    def bake(self, B, fn, t0, t1):
        """fn(i, t) -> None | (x,y,z, rx,ry,rz, s). Außerhalb [t0,t1] unsichtbar."""
        ts = [(f - 1) / FPS for f in range(1, FRAMES + 1)]
        for i, o in enumerate(self.objs):
            arr = np.zeros((FRAMES, 7))
            for fi, t in enumerate(ts):
                if t < t0 or t > t1:
                    continue
                r = fn(i, t)
                if r is None:
                    continue
                arr[fi] = r
            for k in range(3):
                B.put(o, 'location', k, arr[:, k])
                B.put(o, 'rotation_euler', k, arr[:, 3 + k])
                B.put(o, 'scale', k, arr[:, 6])


def ballistic(p0, v0, t, g=9.81, floor=0.0, bounce=0.35, fric=0.6, half=0.5 * V):
    """Wurf mit Boden-Abprall (analytisch, ein paar Sprünge)."""
    x, y, z = p0
    vx_, vy, vz = v0
    tt = t
    for _ in range(4):
        # Zeit bis zum Boden
        a, b, c = -0.5 * g, vz, z - (floor + half)
        disc = b * b - 4 * a * c
        th = (-b - math.sqrt(max(0.0, disc))) / (2 * a) if disc >= 0 else 1e9
        if th < 0:
            th = 0.0
        if tt <= th:
            return (x + vx_ * tt, y + vy * tt, z + vz * tt - 0.5 * g * tt * tt), False
        x += vx_ * th; y += vy * th; z = floor + half
        vz_imp = vz - g * th
        vz = -vz_imp * bounce
        vx_ *= fric; vy *= fric
        tt -= th
        if abs(vz) < 0.25:
            # rutscht aus
            k = min(tt, 0.4)
            return (x + vx_ * k * (1 - k / 0.8), y + vy * k * (1 - k / 0.8), z), True
    return (x, y, z), True


def glow_mat(name, color, strength=4.0):
    m = vx.voxel_material(name, glow_color=color, rough=0.3)
    m.node_tree.nodes['Glow'].outputs[0].default_value = strength
    return m


def light_shaft_material(name, color, strength):
    """Vorgetäuschter Lichtstrahl: additive Emission mit Verlauf + Staubrauschen."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    N.clear()
    out = N.new('ShaderNodeOutputMaterial')
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Generated'], sep.inputs[0])
    # entlang z (lokal 0..1) ausblenden, quer weich
    g1 = N.new('ShaderNodeMath'); g1.operation = 'SUBTRACT'; g1.inputs[0].default_value = 1.0; L.new(sep.outputs['Z'], g1.inputs[1])
    g2 = N.new('ShaderNodeMath'); g2.operation = 'MULTIPLY'; L.new(g1.outputs[0], g2.inputs[0]); L.new(sep.outputs['Z'], g2.inputs[1])
    edge = N.new('ShaderNodeMath'); edge.operation = 'MULTIPLY'; L.new(g2.outputs[0], edge.inputs[0])
    sx = N.new('ShaderNodeMath'); sx.operation = 'SINE'
    mx = N.new('ShaderNodeMath'); mx.operation = 'MULTIPLY'; mx.inputs[1].default_value = math.pi
    L.new(sep.outputs['X'], mx.inputs[0]); L.new(mx.outputs[0], sx.inputs[0]); L.new(sx.outputs[0], edge.inputs[1])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 18.0; nz.inputs['Detail'].default_value = 3.0
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    d = N.new('ShaderNodeMath'); d.operation = 'MULTIPLY'; L.new(edge.outputs[0], d.inputs[0])
    dn = N.new('ShaderNodeMapRange'); dn.inputs['To Min'].default_value = 0.55; dn.inputs['To Max'].default_value = 1.25
    L.new(nz.outputs['Fac'], dn.inputs['Value']); L.new(dn.outputs['Result'], d.inputs[1])
    val = N.new('ShaderNodeValue'); val.name = 'Strength'; val.outputs[0].default_value = strength
    st = N.new('ShaderNodeMath'); st.operation = 'MULTIPLY'; L.new(d.outputs[0], st.inputs[0]); L.new(val.outputs[0], st.inputs[1])
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*color, 1); L.new(st.outputs[0], em.inputs['Strength'])
    tr = N.new('ShaderNodeBsdfTransparent')
    add = N.new('ShaderNodeAddShader'); L.new(tr.outputs[0], add.inputs[0]); L.new(em.outputs[0], add.inputs[1])
    L.new(add.outputs[0], out.inputs['Surface'])
    return m


def light_shaft(name, coll, p_top, p_bot, width, mat):
    """Dünner Quader vom Fenster zum Boden (Generated z: 0 unten .. 1 oben)."""
    import bmesh
    from mathutils import Vector
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    a, b = Vector(p_bot), Vector(p_top)
    d = b - a
    o.location = (a + b) / 2
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    o.scale = (width, width * 0.35, d.length)
    me.materials.append(mat)
    o.visible_shadow = False; o.visible_diffuse = False; o.visible_glossy = False; o.visible_transmission = False
    return o
