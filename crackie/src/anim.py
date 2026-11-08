"""Animationssystem: Zeit-Tracks mit Easing, Posen, prozedurale Ebenen (Atmen, Blinzeln,
Gehen, Glitch, Lippen-Sync), Spiegel-Folgen (der Doppelgänger kopiert Crackie, bis er abweicht),
Kamera mit Schnitten, und schnelles Backen aller Werte als Keyframes (pro Frame) in Blender.
"""
import bisect, math, random
import numpy as np
from timeline import FPS, FRAMES

# ------------------------------------------------------------------ Easing

def _back(u, s=1.70158):
    u -= 1
    return u * u * ((s + 1) * u + s) + 1


EASE = {
    'linear': lambda u: u,
    'smooth': lambda u: u * u * (3 - 2 * u),
    'smoother': lambda u: u * u * u * (u * (6 * u - 15) + 10),
    'in': lambda u: u * u * u,
    'in2': lambda u: u * u,
    'out': lambda u: 1 - (1 - u) ** 3,
    'out2': lambda u: 1 - (1 - u) ** 2,
    'snap': lambda u: 1 - (1 - u) ** 5,
    'back': _back,
    'bigback': lambda u: _back(u, 3.2),
    'elastic': lambda u: 1 - math.exp(-6 * u) * math.cos(14 * u) if u < 1 else 1.0,
    'step': lambda u: 1.0 if u >= 1 else 0.0,
    'hold': lambda u: 0.0 if u < 1 else 1.0,
}


def lerp(a, b, u):
    if isinstance(a, str) or isinstance(b, str):
        return b if u >= 0.5 else a
    if isinstance(a, tuple):
        return tuple(x + (y - x) * u for x, y in zip(a, b))
    return a + (b - a) * u


def add(a, b):
    if isinstance(a, tuple):
        return tuple(x + y for x, y in zip(a, b))
    return a + b


class Track:
    """Segmente (t0, t1, va, vb, ease), nach t0 sortiert. Wert = letztes Segment mit t0 <= t.
    va (Startwert) wird bei Bedarf aus den vorherigen Segmenten berechnet – Reihenfolge
    der Aufrufe ist damit egal."""

    def __init__(self, default):
        self.default = default
        self.t0s = []
        self.segs = []
        self._va = []

    def _insert(self, seg):
        j = bisect.bisect_right(self.t0s, seg[0])
        self.t0s.insert(j, seg[0])
        self.segs.insert(j, seg)
        del self._va[j:]

    def _get_va(self, i):
        while len(self._va) <= i:
            k = len(self._va)
            t0, t1, va, vb, e = self.segs[k]
            if va is None:
                va = self.default if k == 0 else self._eval(k - 1, t0)
            self._va.append(va)
        return self._va[i]

    def _eval(self, j, t):
        t0, t1, _, vb, e = self.segs[j]
        if t >= t1:
            return vb
        u = (t - t0) / (t1 - t0)
        return lerp(self._get_va(j), vb, EASE[e](u))

    def value(self, t):
        i = bisect.bisect_right(self.t0s, t) - 1
        if i < 0:
            return self.default
        return self._eval(i, t)

    def to(self, t0, t1, v, ease='smooth', va=None):
        self._insert((t0, max(t1, t0), va, v, ease))
        return self

    def set(self, t, v):
        return self.to(t, t, v, 'step')

    def last_time(self):
        return self.segs[-1][1] if self.segs else 0.0


# ------------------------------------------------------------------ Figuren

DEFAULTS = {
    'root.loc': (0.0, 0.0, 0.0), 'root.rot': (0.0, 0.0, 0.0),
    'hips.loc': (0.0, 0.0, 0.0), 'hips.rot': (0.0, 0.0, 0.0),
    'torso': (3.0, 0.0, 0.0), 'head': (3.0, 0.0, 0.0),
    'arm_L': (4.0, 7.0, 0.0), 'arm_R': (4.0, 7.0, 0.0), 'fore_L': 14.0, 'fore_R': 14.0,
    'leg_L': (0.0, 2.0, 4.0), 'leg_R': (0.0, 2.0, 4.0), 'shin_L': 0.0, 'shin_R': 0.0,
    'brow_L': (8.0, 0.0), 'brow_R': (8.0, 0.0), 'lid_L': 0.5, 'lid_R': 0.5,
    'pupil': (0.0, -0.3), 'pupil_s': 1.0, 'mouth': 'smirk', 'hand_L': 'relaxed', 'hand_R': 'relaxed',
    'hood': 0.0, 'dark': 0.0, 'glow': 0.0, 'vis': 1.0, 'glitch': 0.0, 'breath': 1.0, 'blinks': 1.0,
}
STR_CH = {'mouth', 'hand_L', 'hand_R'}


class Walk:
    def __init__(self, t0, t1, step=0.55, amp=1.0, fade=0.18):
        self.t0, self.t1, self.step, self.amp, self.fade = t0, t1, step, amp, fade


class CharAnim:
    def __init__(self, name, follow=None, seed=1, talk=None):
        self.name = name
        self.tr = {k: Track(v) for k, v in DEFAULTS.items()}
        self.follow = follow
        self.w = {k: Track(0.0 if follow else 1.0) for k in DEFAULTS}
        self.walks = []
        self.extra_blinks = []
        self.no_blink = []
        self.talk = talk          # Funktion t -> Öffnung 0..1 (Lippen-Sync)
        self.talk_closed = None   # Mundform beim Sprechen geschlossen
        rnd = random.Random(seed)
        t, self.blinks = 0.7 + rnd.random(), []
        while t < FRAMES / FPS:
            self.blinks.append(t)
            t += 2.4 + rnd.random() * 3.2
        self.seed = seed

    # -- Steuerung
    def pose(self, t0, dur, values, ease='smooth'):
        for k, v in values.items():
            tr = self.tr[k]
            if self.follow is not None and self.w[k].value(t0) < 0.999:
                cur = self.value(k, t0)
                tr.set(t0, cur)
                self.w[k].to(t0, t0 + max(dur, 0.04), 1.0, 'smooth')
            tr.to(t0, t0 + dur, v, ease)
        return self

    def release(self, t0, dur, keys=None):
        """Doppelgänger kehrt zum Nachahmen zurück."""
        for k in (keys or list(DEFAULTS)):
            if self.w[k].value(t0) > 0.001:
                self.w[k].to(t0, t0 + dur, 0.0, 'smooth')

    def walk(self, t0, t1, p0, p1, step=0.55, amp=1.0, ease='smooth', heading=None, z=None):
        p0 = tuple(p0) + ((z if z is not None else 0.0),) if len(p0) == 2 else tuple(p0)
        p1 = tuple(p1) + ((z if z is not None else p0[2]),) if len(p1) == 2 else tuple(p1)
        self.pose(t0, 0.0, {'root.loc': p0})
        self.pose(t0, t1 - t0, {'root.loc': p1}, ease)
        if heading is not None:
            self.pose(t0, min(0.35, t1 - t0), {'root.rot': (0.0, 0.0, heading)})
        self.walks.append(Walk(t0, t1, step, amp))

    def blink(self, t):
        self.extra_blinks.append(t)

    # -- Auswertung
    def _proc(self, k, v, t):
        """Prozedurale Ebenen dieser Figur."""
        tr = self.tr
        br = tr['breath'].value(t)
        ph = t * 2 * math.pi / 3.9 + self.seed
        if k == 'torso' and br > 0:
            v = add(v, (1.4 * br * math.sin(ph), 0.0, 0.0))
        elif k == 'hips.loc' and br > 0:
            v = add(v, (0.0, 0.0, 0.0025 * br * math.sin(ph)))
        elif k == 'head' and br > 0:
            n = math.sin(t * 0.83 + self.seed) * 0.8 + math.sin(t * 1.71 + 2 * self.seed) * 0.5
            v = add(v, (-0.8 * br * math.sin(ph) + 0.6 * n, 0.5 * n, 0.9 * n))
        elif k in ('arm_L', 'arm_R') and br > 0:
            v = add(v, (0.0, 0.9 * br * math.sin(ph + 0.6), 0.0))
        elif k in ('lid_L', 'lid_R'):
            bk = tr['blinks'].value(t)
            b = 0.0
            if bk > 0 and not any(a <= t <= c for a, c in self.no_blink):
                for tb in self.blinks + self.extra_blinks:
                    dt = t - tb
                    if 0 <= dt < 0.05:
                        b = max(b, dt / 0.05)
                    elif 0.05 <= dt < 0.09:
                        b = 1.0
                    elif 0.09 <= dt < 0.18:
                        b = max(b, 1 - (dt - 0.09) / 0.09)
            v = max(v, b * min(1.0, bk))
        elif k == 'mouth' and self.talk is not None:
            o = self.talk(t)
            if o > 0.12:
                v = 'open_m' if o > 0.5 else 'open_s'
                if self.talk_closed and o < 0.2:
                    v = self.talk_closed
        # Gehen
        for wk in self.walks:
            if wk.t0 - 0.05 <= t <= wk.t1 + 0.05:
                d = min(1.0, (t - wk.t0) / wk.fade, (wk.t1 - t) / wk.fade)
                d = max(0.0, d) * wk.amp
                phase = (t - wk.t0) / wk.step * math.pi
                s = math.sin(phase)
                if k == 'leg_L':
                    v = add(v, (24 * s * d, 0.0, 0.0))
                elif k == 'leg_R':
                    v = add(v, (-24 * s * d, 0.0, 0.0))
                elif k == 'shin_L':
                    v = v + 32 * max(0.0, -math.sin(phase - 0.6)) * d
                elif k == 'shin_R':
                    v = v + 32 * max(0.0, math.sin(phase - 0.6)) * d
                elif k == 'arm_L':
                    v = add(v, (-18 * s * d, 0.0, 0.0))
                elif k == 'arm_R':
                    v = add(v, (18 * s * d, 0.0, 0.0))
                elif k == 'hips.loc':
                    v = add(v, (0.0, 0.0, 0.012 * abs(math.cos(phase)) * d))
                elif k == 'hips.rot':
                    v = add(v, (0.0, 0.0, 5 * s * d))
                elif k == 'torso':
                    v = add(v, (2.5 * d, 0.0, -4 * s * d))
                elif k == 'head':
                    v = add(v, (0.0, 0.0, 2 * s * d))
        return v

    def own(self, k, t):
        return self._proc(k, self.tr[k].value(t), t)

    def value(self, k, t):
        if self.follow is None:
            return self.own(k, t)
        w = self.w[k].value(t)
        if w <= 0.0005:
            return self.follow.value(k, t)
        if w >= 0.9995:
            return self.own(k, t)
        return lerp(self.follow.value(k, t), self.own(k, t), w)


# ------------------------------------------------------------------ Kamera

class CamAnim:
    def __init__(self):
        self.loc = Track((0.0, -2.0, 1.5))
        self.tgt = Track((0.0, 0.0, 1.4))
        self.lens = Track(35.0)
        self.fstop = Track(2.8)
        self.focus = Track(-1.0)      # <0: automatisch = Abstand zum Ziel
        self.roll = Track(0.0)
        self.shake = Track(0.0)
        self.cuts = []

    def cut(self, t, loc, tgt, lens=None, fstop=None, roll=0.0, focus=-1.0):
        self.cuts.append(t)
        self.loc.set(t, loc); self.tgt.set(t, tgt); self.roll.set(t, roll); self.focus.set(t, focus)
        if lens is not None:
            self.lens.set(t, lens)
        if fstop is not None:
            self.fstop.set(t, fstop)

    def move(self, t0, t1, loc=None, tgt=None, lens=None, ease='smoother', roll=None, fstop=None, focus=None):
        if loc is not None: self.loc.to(t0, t1, loc, ease)
        if tgt is not None: self.tgt.to(t0, t1, tgt, ease)
        if lens is not None: self.lens.to(t0, t1, lens, ease)
        if roll is not None: self.roll.to(t0, t1, roll, ease)
        if fstop is not None: self.fstop.to(t0, t1, fstop, ease)
        if focus is not None: self.focus.to(t0, t1, focus, ease)

    def shake_at(self, t, amp, dur):
        self.shake.to(t, t + 0.03, amp, 'linear')
        self.shake.to(t + 0.03, t + dur, 0.0, 'out2')


def shake_offset(t, amp, seed=0):
    if amp <= 0:
        return (0.0, 0.0, 0.0)
    f = lambda a, b: math.sin(t * a + b)
    return (amp * (f(37.0, seed) + 0.5 * f(71.0, 1 + seed)) * 0.66,
            amp * (f(41.0, 2 + seed) + 0.5 * f(63.0, 3 + seed)) * 0.66,
            amp * (f(43.0, 4 + seed) + 0.5 * f(59.0, 5 + seed)) * 0.66)


# ------------------------------------------------------------------ Backen

def frame_times():
    return [(f - 1) / FPS for f in range(1, FRAMES + 1)]


class Baker:
    """Sammelt Werte pro Frame und schreibt sie gebündelt als F-Curves."""

    def __init__(self):
        self.curves = {}   # (id_block, path, index) -> (np.array, interp, const_frames)

    def put(self, idb, path, index, values, interp='LINEAR', const_frames=()):
        self.curves[(idb, path, index)] = (np.asarray(values, dtype=np.float64), interp, set(const_frames))

    def write(self):
        import bpy
        from bpy_extras import anim_utils
        lin = bpy.types.Keyframe.bl_rna.properties['interpolation'].enum_items['LINEAR'].value
        con = bpy.types.Keyframe.bl_rna.properties['interpolation'].enum_items['CONSTANT'].value
        n_keys = 0
        for (idb, path, index), (vals, interp, cf) in self.curves.items():
            ad = idb.animation_data or idb.animation_data_create()
            if ad.action is None:
                act = bpy.data.actions.new(f'{idb.name}_bake')
                ad.action = act
                ad.action_slot = act.slots.new(idb.id_type, idb.name)
            cb = anim_utils.action_ensure_channelbag_for_slot(ad.action, ad.action_slot)
            fc = cb.fcurves.find(path, index=index)
            if fc is not None:
                cb.fcurves.remove(fc)
            fc = cb.fcurves.new(path, index=index)
            n = len(vals)
            keep = np.ones(n, dtype=bool)
            if n > 2:
                same_prev = np.r_[False, vals[1:] == vals[:-1]]
                same_next = np.r_[vals[:-1] == vals[1:], False]
                keep = ~(same_prev & same_next)
            # Frames vor Schnitten / Sprüngen behalten und konstant setzen
            for f in cf:
                if 1 <= f <= n:
                    keep[f - 1] = True
                    if f < n:
                        keep[f] = True
            idx = np.nonzero(keep)[0]
            co = np.empty(2 * len(idx), dtype=np.float32)
            co[0::2] = idx + 1
            co[1::2] = vals[idx]
            fc.keyframe_points.add(len(idx))
            fc.keyframe_points.foreach_set('co', co)
            ip = np.full(len(idx), con if interp == 'CONSTANT' else lin, dtype=np.int32)
            if cf and interp != 'CONSTANT':
                fr = idx + 1
                mask = np.isin(fr, np.array(sorted(cf), dtype=np.int64))
                ip[mask] = con
            fc.keyframe_points.foreach_set('interpolation', ip)
            fc.update()
            n_keys += len(idx)
        return n_keys


# ------------------------------------------------------------------ Figur -> Blender

def bake_char(B, A, rig, V, hands=('relaxed', 'fist', 'point', 'finger', 'open'), cuts=()):
    """Wertet die Figur pro Frame aus und legt die Kurven im Baker ab."""
    import math as m
    from character import MOUTHS
    ts = frame_times()
    n = len(ts)
    O = rig.obj
    r = lambda d: m.radians(d)
    arr = {}

    def put(obj, path, i, v):
        arr.setdefault((obj, path, i), np.zeros(n))[fi] = v

    mouths = list(MOUTHS)
    for fi, t in enumerate(ts):
        g = lambda k: A.value(k, t)
        rl = g('root.loc'); rr = g('root.rot')
        for i in range(3):
            put(rig.root, 'location', i, rl[i]); put(rig.root, 'rotation_euler', i, r(rr[i]))
        vis = g('vis')
        for i in range(3):
            put(rig.root, 'scale', i, 1.0 if vis > 0.5 else 0.0)
        glitch = g('glitch')
        gx = gz = 0.0
        if glitch > 0:
            rnd = random.Random(int(t * FPS) * 7919 + 13)
            if rnd.random() < glitch:
                gx = (rnd.random() - 0.5) * 6 * V * glitch
                gz = (rnd.random() - 0.5) * 3 * V * glitch
        hl = g('hips.loc'); hr = g('hips.rot'); rest = O['hips']['rest']
        for i in range(3):
            put(O['hips'], 'location', i, rest[i] + hl[i]); put(O['hips'], 'rotation_euler', i, r(hr[i]))
        tv = g('torso')
        for i in range(3):
            put(O['torso'], 'rotation_euler', i, r(tv[i]))
        hv = g('head'); rest = O['head']['rest']
        for i in range(3):
            put(O['head'], 'rotation_euler', i, r(hv[i]))
            put(O['head'], 'location', i, rest[i] + (gx if i == 0 else gz if i == 2 else 0.0))
        for side, s in (('L', 1), ('R', -1)):
            a = g('arm_' + side)
            for i, val in enumerate((-a[0], -a[1] * s, a[2] * s)):
                put(O['arm_' + side], 'rotation_euler', i, r(val))
            put(O['fore_' + side], 'rotation_euler', 0, r(-g('fore_' + side)))
            lg = g('leg_' + side)
            for i, val in enumerate((-lg[0], -lg[1] * s, lg[2] * s)):
                put(O['leg_' + side], 'rotation_euler', i, r(val))
            put(O['shin_' + side], 'rotation_euler', 0, r(g('shin_' + side)))
            bw = g('brow_' + side); rest = O['brow_' + side]['rest']
            put(O['brow_' + side], 'rotation_euler', 1, r(bw[0] * s))
            put(O['brow_' + side], 'location', 2, rest[2] + bw[1] * V)
            lid = min(1.0, max(0.03, g('lid_' + side)))
            put(O['lid_' + side], 'scale', 2, lid)
            pu = g('pupil'); ps = g('pupil_s'); rest = O['pupil_' + side]['rest']
            put(O['pupil_' + side], 'location', 0, rest[0] + pu[0] * V)
            put(O['pupil_' + side], 'location', 2, rest[2] + pu[1] * V)
            for i in range(3):
                put(O['pupil_' + side], 'scale', i, ps)
            hk = g('hand_' + side)
            for hname in hands:
                on = 1.0 if hname == hk else 0.0
                for i in range(3):
                    put(O[f'hand_{side}_{hname}'], 'scale', i, on)
        mk = g('mouth')
        for mname in mouths:
            on = 1.0 if mname == mk else 0.0
            for i in range(3):
                put(O['mouth_' + mname], 'scale', i, on)
        hood = g('hood')
        up = hood > 0.12
        for i in range(3):
            put(O['hood_up'], 'scale', i, (0.75 + 0.25 * hood) if up else 0.0)
            put(O['hood_down'], 'scale', i, 0.0 if up else 1.0)
        put(O['hood_up'], 'rotation_euler', 0, r(-115 * (1 - hood)))
        put(rig.mat.node_tree, 'nodes["Dark"].outputs[0].default_value', 0, g('dark'))
        put(rig.mat.node_tree, 'nodes["Glow"].outputs[0].default_value', 0, g('glow'))
    for (obj, path, i), vals in arr.items():
        const = path == 'scale' or path.startswith('nodes')
        if obj is rig.root and path == 'scale':
            const = True
        B.put(obj, path, i, vals, 'CONSTANT' if (path == 'scale' and 'lid' not in obj.name and 'pupil' not in obj.name) else 'LINEAR', cuts)
    return arr


def bake_cam(B, C, cam_obj):
    from mathutils import Vector, Matrix, Euler
    ts = frame_times(); n = len(ts)
    loc = np.zeros((n, 3)); rot = np.zeros((n, 3)); lens = np.zeros(n); fst = np.zeros(n); foc = np.zeros(n)
    for fi, t in enumerate(ts):
        p = Vector(C.loc.value(t)); q = Vector(C.tgt.value(t))
        sh = C.shake.value(t)
        if sh > 0:
            o = shake_offset(t, sh)
            p = p + Vector(o)
            q = q + Vector(o) * 0.5
        d = q - p
        e = d.to_track_quat('-Z', 'Y').to_euler()
        rl = C.roll.value(t)
        if rl:
            mtx = e.to_matrix() @ Matrix.Rotation(math.radians(rl), 3, 'Z')
            e = mtx.to_euler()
        loc[fi] = p; rot[fi] = (e.x, e.y, e.z)
        lens[fi] = C.lens.value(t); fst[fi] = C.fstop.value(t)
        fo = C.focus.value(t)
        foc[fi] = d.length if fo < 0 else fo
    # Euler-Sprünge glätten (Wrap-around)
    for i in range(3):
        rot[:, i] = np.unwrap(rot[:, i])
    cuts = [int(round(t * FPS)) for t in C.cuts]    # Frame vor dem Schnitt (1-basiert: t*FPS+1 - 1)
    for i in range(3):
        B.put(cam_obj, 'location', i, loc[:, i], 'LINEAR', cuts)
        B.put(cam_obj, 'rotation_euler', i, rot[:, i], 'LINEAR', cuts)
    B.put(cam_obj.data, 'lens', 0, lens, 'LINEAR', cuts)
    B.put(cam_obj.data, 'dof.aperture_fstop', 0, fst, 'LINEAR', cuts)
    B.put(cam_obj.data, 'dof.focus_distance', 0, foc, 'LINEAR', cuts)
    return loc, rot, lens


def bake_track(B, idb, path, index, track, interp='LINEAR', cuts=(), fn=None):
    ts = frame_times()
    vals = [fn(track.value(t)) if fn else track.value(t) for t in ts]
    B.put(idb, path, index, vals, interp, cuts)
