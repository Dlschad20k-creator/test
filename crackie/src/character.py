"""Crackie als Voxel-Figur – streng nach dem Charakterblatt:
älterer Mann mit Glatze, großer blockiger Kopf, dicke schwarze Augenbrauen, halb geschlossene
müde Augen mit schweren Lidern, Tränensäcke, große Knollennase, abstehende Ohren, EIN markanter
Vorderzahn, offener schwarzer Oversize-Hoodie mit grauem Shirt, Kette, kleiner Umhängetasche,
Krone auf dem Rücken, schwarze Baggy-Cargohose mit grauen Patches, schwarz-weiße Chunky-Sneaker.

Die dunkle Version benutzt dieselbe Geometrie (identischer Körper, identische Kleidung), nur
mit dunklen Voxelfarben ('ColD'), violett leuchtenden Pupillen, aggressiveren Brauen,
einem unheimlichen Grinsen und optionaler Kapuze.

Modellkoordinaten in Voxeln: Vorderseite zeigt nach -Y, oben ist +Z, Füße bei Z=0.
"""
import math
import bpy
import voxel as vx

V = vx.V


def _h(x, y, z, s=0):
    """Deterministisches Rauschen 0..1 pro Voxel."""
    n = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ (s * 2654435761)
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def srgb(hexs):
    hexs = hexs.lstrip('#')
    c = [int(hexs[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


# Palette: Name -> (normal, dunkel)
PAL = {
    'skin':    ('#E9B48E', '#6D6177'),
    'skin2':   ('#DFA582', '#625669'),   # leichte Schattierung
    'skinD':   ('#C98A69', '#4E4458'),   # Falten / Schatten
    'stub':    ('#A8968A', '#3C3446'),   # Haarstoppeln an den Seiten
    'ear':     ('#E99C76', '#6A5672'),
    'earIn':   ('#C77657', '#493B53'),
    'nose':    ('#E8946F', '#6E5675'),
    'noseHi':  ('#F2AA86', '#7D6585'),
    'noseD':   ('#B86B50', '#3E3047'),
    'blush':   ('#E89C84', '#6A5872'),
    'bag':     ('#C99087', '#56475F'),   # Tränensäcke
    'lid':     ('#A9827F', '#3F3448'),
    'lash':    ('#5A3F3E', '#17111C'),
    'white':   ('#F3EFEA', '#211A28'),   # Augapfel
    'iris':    ('#2B2222', '#C35BFF'),
    'irisHi':  ('#FFFFFF', '#F1D7FF'),
    'brow':    ('#1C1819', '#0A080C'),
    'tooth':   ('#F8F4EA', '#D9D2E2'),
    'mouth':   ('#4A2323', '#140B18'),
    'tongue':  ('#B4525A', '#4C1F55'),
    'lip':     ('#C98270', '#5B4865'),
    'hood':    ('#1D1B1E', '#120F16'),
    'hood2':   ('#252226', '#18131D'),
    'hood3':   ('#151315', '#0C0A10'),
    'hoodIn':  ('#363237', '#231C2B'),
    'rib':     ('#2C292D', '#1A1520'),
    'zip':     ('#6B676B', '#3B2F46'),
    'shirt':   ('#C9C5BF', '#3A3242'),
    'shirt2':  ('#B4AFA9', '#30293A'),
    'chain':   ('#B9B9B9', '#6E5C7E'),
    'chain2':  ('#8A8A8C', '#4F425D'),
    'string':  ('#E2DED8', '#4E4459'),
    'crown':   ('#DAD5CF', '#B37BE0'),
    'patch':   ('#8D8985', '#3B3445'),
    'patch2':  ('#B6B1AB', '#4C4258'),
    'pants':   ('#1B191B', '#100D13'),
    'pants2':  ('#232023', '#16121A'),
    'pants3':  ('#131113', '#0A080C'),
    'shoeB':   ('#161416', '#0D0B10'),
    'shoeW':   ('#EEEBE6', '#4A4057'),
    'sole':    ('#D9D4CC', '#3C3347'),
    'lace':    ('#F7F5F0', '#5E5170'),
}
_LIN = {k: (srgb(a), srgb(b)) for k, (a, b) in PAL.items()}
EMIT_KEYS = {'iris', 'irisHi'}       # leuchten nur, wenn 'Glow' > 0 (dunkle Version)
TEXTURE = {'hood': 0.10, 'hood2': 0.10, 'hood3': 0.10, 'pants': 0.10, 'pants2': 0.10, 'pants3': 0.10,
           'skin': 0.035, 'skin2': 0.035, 'shoeB': 0.08}


class Vox(dict):
    def box(self, x0, x1, y0, y1, z0, z1, c):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                for z in range(z0, z1 + 1):
                    self[(x, y, z)] = c(x, y, z) if callable(c) else c
        return self

    def rm(self, x0, x1, y0, y1, z0, z1):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                for z in range(z0, z1 + 1):
                    self.pop((x, y, z), None)
        return self

    def paint(self, x0, x1, y0, y1, z0, z1, c):
        for k in list(self.keys()):
            x, y, z = k
            if x0 <= x <= x1 and y0 <= y <= y1 and z0 <= z <= z1:
                self[k] = c(x, y, z) if callable(c) else c
        return self


def _fabric(a, b, c, seed, fold_every=0):
    """Stoff: zufällige Mischung dreier Schwarztöne, optional horizontale Falten."""
    def f(x, y, z):
        r = _h(x, y, z, seed)
        if fold_every and z % fold_every == 0 and r < 0.75:
            return c
        return a if r < 0.55 else (b if r < 0.85 else c)
    return f


# ---------------------------------------------------------------------------- Teile

def _shoe(cx):
    """Chunky Sneaker: dicke weiße Sohle, schwarzes Obermaterial, weiße Kappe und Streifen."""
    v = Vox()
    x0, x1 = cx - 4, cx + 5
    v.box(x0, x1, -11, 5, 0, 0, 'sole')
    v.box(x0, x1, -11, 5, 1, 1, 'shoeW')
    v.box(x0, x1, -10, 5, 2, 5, 'shoeB')
    v.rm(x0, x1, -10, -9, 5, 5); v.rm(x0, x0, -10, -10, 4, 5); v.rm(x1, x1, -10, -10, 4, 5)
    v.box(x0, x1, -11, -8, 2, 2, 'shoeW')                     # weiße Zehenkappe
    v.box(x0 + 1, x1 - 1, -11, -11, 3, 3, 'shoeW')
    v.box(x0 + 1, x1 - 1, -10, -9, 3, 4, 'shoeB')
    for y in range(-7, 4):                                     # weiße Seitenstreifen (zwei Bahnen)
        zz = 3 if y < -2 else 4 if y < 1 else 3
        v[(x0, y, zz)] = 'shoeW'; v[(x1, y, zz)] = 'shoeW'
        if y % 2 == 0:
            v[(x0, y, 2)] = 'shoeW'; v[(x1, y, 2)] = 'shoeW'
    for y in (-8, -6, -4):                                     # Schnürsenkel
        for x in range(cx - 1, cx + 3):
            if (x + y) % 2 == 0:
                v[(x, y, 6)] = 'lace'
    v.box(x0, x1, 3, 5, 6, 6, 'shoeB')                         # Ferse höher
    v[(cx, 5, 6)] = 'shoeW'; v[(cx + 1, 5, 6)] = 'shoeW'
    return v


def _leg(side):
    s = 1 if side == 'L' else -1
    xa, xb = (1, 10) if s > 0 else (-10, -1)
    thigh = Vox().box(xa, xb, -5, 5, 14, 21, _fabric('pants', 'pants2', 'pants3', 11 + s, 0))
    xo = xb if s > 0 else xa
    thigh.box(xo + s, xo + s, -3, 2, 14, 19, 'pants2')         # Cargo-Tasche außen
    thigh.paint(xo + s, xo + s, -3, 2, 19, 19, 'pants3')
    if s > 0:   # graue Patches vorne links
        for (x, z) in [(3, 18), (4, 18), (4, 19), (5, 19), (3, 17), (6, 17), (5, 16), (6, 20), (7, 19), (4, 16)]:
            thigh[(x, -6, z)] = 'patch2' if _h(x, 0, z, 3) < 0.5 else 'patch'
    else:       # Kette an der rechten Seite
        for i, z in enumerate(range(21, 14, -1)):
            thigh[(xa - 1, -2 + (i % 2), z)] = 'chain' if i % 2 == 0 else 'chain2'
    shin = Vox().box(xa, xb, -5, 5, 8, 13, _fabric('pants', 'pants2', 'pants3', 21 + s, 3))
    shin.box(xa - 1, xb + 1, -6, 6, 6, 8, _fabric('pants2', 'pants', 'pants3', 31 + s, 0))   # gestauchter Saum
    if s < 0:
        for (x, z) in [(-4, 10), (-5, 10), (-5, 11), (-3, 11), (-6, 9), (-7, 11)]:
            shin[(x, -6, z)] = 'patch'
    shin.update(_shoe(5 if s > 0 else -6))
    return thigh, shin


def _hips():
    return Vox().box(-10, 10, -6, 5, 20, 22, _fabric('pants', 'pants2', 'pants3', 41))


def _torso():
    fab = _fabric('hood', 'hood2', 'hood3', 51, 0)
    t = Vox().box(-9, 9, -7, 6, 23, 37, fab)
    t.paint(-9, 9, -7, 6, 23, 24, 'rib')                       # Bündchen
    t.rm(-9, -9, -7, 6, 37, 37); t.rm(9, 9, -7, 6, 37, 37)     # runde Schultern
    t.rm(-9, 9, -7, -7, 37, 37); t.rm(-9, 9, 6, 6, 37, 37)
    # offene Jacke: graues Shirt in der Mitte
    t.paint(-3, 3, -7, -7, 25, 37, lambda x, y, z: 'shirt' if _h(x, y, z, 5) < 0.7 else 'shirt2')
    t.paint(-4, -4, -7, -7, 23, 37, 'zip'); t.paint(4, 4, -7, -7, 23, 37, 'zip')
    for z in range(23, 38):                                    # Jackenkanten stehen vor
        t[(-5, -8, z)] = 'hood2'; t[(5, -8, z)] = 'hood2'; t[(-6, -8, z)] = 'hood3'; t[(6, -8, z)] = 'hood3'
    for z in range(30, 37):                                    # Kordeln
        t[(-2, -8, z)] = 'string'; t[(2, -8, z)] = 'string'
    t[(-2, -8, 29)] = 'zip'; t[(2, -8, 29)] = 'zip'
    chain = [(-3, 37), (-3, 36), (-3, 35), (-2, 34), (-2, 33), (-1, 32), (0, 32), (1, 32), (2, 33), (2, 34), (3, 35), (3, 36), (3, 37)]
    for i, (x, z) in enumerate(chain):
        t[(x, -8, z)] = 'chain' if i % 2 == 0 else 'chain2'
    t[(0, -9, 31)] = 'chain'; t[(0, -9, 30)] = 'chain2'
    # kleine Umhängetasche + Riemen
    t.box(-1, 5, -10, -8, 24, 29, 'hood3')
    t.paint(-1, 5, -10, -10, 29, 29, 'rib')
    for (x, z) in [(1, 26), (2, 27), (3, 26), (1, 27), (3, 27), (2, 25)]:
        t[(x, -11, z)] = 'crown'
    for i in range(10):                                        # Riemen diagonal (rechte Schulter -> Tasche)
        x, z = -9 + i, 37 - i
        if not (-3 <= x <= 3):
            t[(x, -8, z)] = 'rib'
    # Krone auf dem Rücken
    crown = ["X...X...X", "XX.XXX.XX", "XXXXXXXXX", "XXXXXXXXX", ".........", "XXXXXXXXX"]
    for r, row in enumerate(crown):
        for c, ch in enumerate(row):
            if ch == 'X':
                t[(-4 + c, 7, 34 - r)] = 'crown'
    # Kängurutaschen
    t.box(-8, -6, -8, -8, 24, 28, 'hood3'); t.box(6, 8, -8, -8, 24, 28, 'hood3')
    return t


def _hood_down():
    """Kapuze, im Nacken zusammengeschoben, seitlich als Kragen sichtbar."""
    h = Vox()
    f = _fabric('hood', 'hood2', 'hood3', 61)
    for x in range(-9, 10):
        for y in range(-4, 13):
            for z in range(35, 45):
                back = y >= 7 and abs(x) <= 8 and z <= 44 - max(0, abs(x) - 4)
                side = 5 <= abs(x) <= 9 and y >= -4 and z <= 39
                if back or side:
                    inner = back and (z >= 42 or (abs(x) <= 6 and y == 7 and z >= 40))
                    h[(x, y, z)] = 'hoodIn' if inner else f(x, y, z)
    return h


def _head_inside(x, y, z):
    if z >= 51:                                     # Kuppel (Glatze)
        s = (z - 51) / 16.2
        if s >= 1:
            return False
        fz = (1 - s ** 2.6) ** (1 / 2.6)
        hw, hd = 12.6 * fz, 10.6 * fz
    else:                                           # Gesicht, Kiefer schmaler
        t = (51 - z) / 14.0
        hw = 12.6 - 3.6 * t ** 2
        hd = 10.6 if z >= 39 else 9.6
    u, v = abs(x) / hw, abs(y) / hd
    return u ** 4 + v ** 4 <= 1.0


def _head():
    h = Vox()
    for x in range(-13, 14):
        for y in range(-11, 12):
            for z in range(37, 68):
                if _head_inside(x, y, z):
                    h[(x, y, z)] = 'skin' if _h(x, y, z, 1) < 0.72 else 'skin2'
    for k in list(h):                               # Haarstoppeln seitlich/hinten
        x, y, z = k
        if abs(x) >= 11 and 48 <= z <= 55 and y >= 1 and _h(x, y, z, 9) < 0.5:
            h[k] = 'stub'
        if y >= 8 and 47 <= z <= 51 and _h(x, y, z, 10) < 0.35:
            h[k] = 'stub'
    for x in range(-5, 6):                          # Stirnfalten
        if abs(x) < 5 or _h(x, 0, 0, 2) < 0.5:
            h[(x, -10, 61)] = 'skinD'
    for x in range(-4, 5):
        h[(x, -10, 63)] = 'skinD'
    for x in (-6, 6):
        h[(x, -10, 62)] = 'skinD'
    for sx in (1, -1):
        xs = list(range(2, 9)) if sx > 0 else list(range(-8, -1))
        for x in xs:                                # Augäpfel 7x7, stehen 1 vor
            for z in range(50, 57):
                corner = (x in (xs[0], xs[-1])) and z in (50, 56)
                if not corner:
                    h[(x, -10, z)] = 'white'; h[(x, -11, z)] = 'white'
        for x in xs:                                # Tränensäcke
            h[(x, -11, 49)] = 'bag'
        h[(9 * sx, -11, 50)] = 'bag'; h[(9 * sx, -10, 50)] = 'bag'
        for x in (range(5, 10) if sx > 0 else range(-9, -4)):   # Wangen
            for z in range(44, 48):
                if (x, -10, z) in h:
                    h[(x, -10, z)] = 'blush'
        for x in (range(5, 9) if sx > 0 else range(-8, -4)):
            for z in (45, 46, 47):
                h[(x, -11, z)] = 'blush'
    for x in range(-3, 4):                          # Knollennase
        for z in range(44, 50):
            h[(x, -11, z)] = 'nose'
        for z in range(44, 49):
            h[(x, -12, z)] = 'nose'
    for x in range(-2, 3):
        for z in range(44, 48):
            h[(x, -13, z)] = 'nose'
    for x in range(-1, 2):
        for z in (45, 46):
            h[(x, -14, z)] = 'nose'
    for k in [(0, -14, 46), (1, -13, 47), (0, -13, 47), (-1, -12, 48), (0, -12, 48)]:
        h[k] = 'noseHi'
    for k in [(-2, -12, 44), (2, -12, 44), (-2, -13, 44), (2, -13, 44)]:
        h[k] = 'noseD'
    for z in range(50, 56):
        h[(0, -11, z)] = 'skin'; h[(1, -10, z)] = h.get((1, -10, z), 'skin'); h[(-1, -10, z)] = h.get((-1, -10, z), 'skin')
    for x in range(-6, 7):                          # Mund-Aussparung
        for z in range(39, 44):
            h.pop((x, -10, z), None)
            h[(x, -9, z)] = 'mouth'
    for sx in (1, -1):                              # große Ohren
        for z in range(44, 58):
            for y in range(-4, 4):
                dz = abs(z - 50.5) / 6.6; dy = abs(y + 0.5) / 3.9
                if dz ** 2 + dy ** 2 <= 1.0:
                    rim = dz ** 2 + dy ** 2 > 0.45
                    h[(sx * 13, y, z)] = 'ear'
                    h[(sx * 14, y, z)] = 'ear' if rim else 'earIn'
                    if rim:
                        h[(sx * 15, y, z)] = 'ear'
    h.box(-3, 3, -3, 3, 34, 37, lambda x, y, z: 'skinD' if z == 34 else 'skin2')   # dünner Hals
    return h


MOUTHS = {
    # 13 x 5 Platte (x -6..6, z 43..39) bei y=-10. '.' Haut, 'm' Mund, 'l' Lippe, 't' Zahn (steht vor), 'r' Zunge
    'smirk':   [".............",
                "..........m..",
                "..mmmmmmmm...",
                ".....tt......",
                ".....tt......"],
    'neutral': [".............",
                ".............",
                "..mmmmmmmmm..",
                ".....tt......",
                ".....tt......"],
    'smile':   [".............",
                ".m.........m.",
                "..mmmmmmmmm..",
                ".....tt......",
                ".....tt......"],
    'open_s':  [".............",
                "..mmmmmmmmm..",
                "..mmmttmmmm..",
                "...mmttmmm...",
                "............."],
    'open_m':  ["...lllllll...",
                "..mmmttmmmm..",
                ".mmmmttmmmmm.",
                "..mmrrrrrmm..",
                "...lllllll..."],
    'laugh':   [".mmlllllllmm.",
                "mmmmmttmmmmmm",
                "mmmmmttmmmmmm",
                ".mmrrrrrrrmm.",
                "..mmmmmmmmm.."],
    'o':       [".....mmm.....",
                "....mmmmm....",
                "....mmmmm....",
                "....mmmmm....",
                ".....mmm....."],
    'frown':   [".............",
                "....mmmmm....",
                "...m.tt..m...",
                "..m..tt...m..",
                "............."],
    'grimace': ["...m.....m...",
                "..mtttttttm..",
                "..mtttttttm..",
                "..mmmmmmmmm..",
                "............."],
    'creepy':  ["m...........m",
                "mmtmtmttmtmtm",
                ".mmtmmttmmtm.",
                "..mmmmmmmmm..",
                "............."],
}


def _mouth(kind):
    v = Vox()
    for r, row in enumerate(MOUTHS[kind]):
        z = 43 - r
        for c, ch in enumerate(row):
            x = -6 + c
            if ch == '.':
                v[(x, -10, z)] = 'skin' if _h(x, -10, z, 1) < 0.72 else 'skin2'
            else:
                v[(x, -10, z)] = {'m': 'mouth', 'l': 'lip', 'r': 'tongue', 't': 'tooth'}[ch]
                if ch == 't' and (kind not in ('grimace', 'creepy') or x in (-1, 0)):
                    v[(x, -11, z)] = 'tooth'
    return v


def _brow(sx):
    v = Vox()
    for x in (range(1, 10) if sx > 0 else range(-9, 0)):
        for z in (57, 58):
            v[(x, -11, z)] = 'brow'; v[(x, -12, z)] = 'brow'
    for x in ((1, 2, 3, 4) if sx > 0 else (-1, -2, -3, -4)):   # dickeres inneres Ende
        v[(x, -11, 59)] = 'brow'; v[(x, -12, 59)] = 'brow'
    return v


def _lid(sx):
    """Oberlid: deckt bei Skalierung 1 das ganze Auge ab (Pivot an der Oberkante)."""
    v = Vox()
    for x in (range(1, 10) if sx > 0 else range(-9, 0)):
        for z in range(50, 57):
            v[(x, -12, z)] = 'lash' if z == 50 else 'lid'
    return v


def _pupil(sx):
    v = Vox()
    cx = 5 * sx
    for x in (cx - 1, cx, cx + 1):
        for z in (51, 52, 53):
            v[(x, -12, z)] = 'iris'
    v[(cx + 1, -12, 53)] = 'irisHi'
    return v


def _arm(sx):
    xa, xb = (10, 16) if sx > 0 else (-16, -10)
    fab = _fabric('hood', 'hood2', 'hood3', 71 + sx, 0)
    up = Vox().box(xa, xb, -4, 2, 28, 36, fab)
    up.box(xa + 1, xb - 1, -3, 1, 37, 37, fab)
    if sx > 0:   # Patch am linken Oberarm
        for (y, z) in [(-1, 32), (0, 32), (-1, 31), (0, 31), (-2, 31), (1, 32), (-1, 30), (0, 33), (-2, 33)]:
            up[(xb + 1, y, z)] = 'patch2' if (y + z) % 2 else 'patch'
    fore = Vox().box(xa, xb, -4, 2, 21, 27, fab)
    fore.box(xa + 1, xb - 1, -3, 1, 20, 20, 'rib')
    fore.paint(xa, xb, -4, 2, 21, 21, 'rib')
    return up, fore


def _hand(sx, kind):
    cx0, cx1 = (11, 15) if sx > 0 else (-15, -11)
    v = Vox()
    sk = lambda x, y, z: 'skin' if _h(x, y, z, 4) < 0.7 else 'skin2'
    tx = cx0 if sx > 0 else cx1            # Daumen-Seite (zum Körper)
    if kind == 'relaxed':
        v.box(cx0, cx1, -3, 0, 14, 19, sk)
        v.box(tx, tx, -4, -4, 15, 17, sk)
        v.paint(cx0, cx1, -3, 0, 14, 14, 'skin2')
    elif kind == 'fist':
        v.box(cx0, cx1, -3, 0, 15, 19, sk)
        v.box(tx, tx, -4, -4, 16, 18, sk)
        for x in range(cx0, cx1 + 1):
            v[(x, -3, 15)] = 'skinD'
    elif kind in ('point', 'finger'):
        v.box(cx0, cx1, -3, 0, 15, 19, sk)
        v.box(tx, tx, -4, -4, 16, 18, sk)
        fx = tx + sx if kind == 'point' else tx + 2 * sx
        for z in range(9, 15):
            v[(fx, -3, z)] = sk(fx, -3, z)
            v[(fx, -2, z)] = sk(fx, -2, z)
    elif kind == 'open':
        v.box(cx0, cx1, -2, -1, 14, 19, sk)
        for i, x in enumerate(range(cx0, cx1 + 1)):
            if i == 0:
                continue
            for z in range(10 + (1 if i in (1, 4) else 0), 14):
                v[(x, -2, z)] = sk(x, -2, z)
        v.box(tx - sx, tx - sx, -2, -1, 15, 17, sk)
    return v


def _hood_up():
    """Kapuze über dem Kopf (Auftritt des Doppelgängers)."""
    occ = set(k for k in _head())
    f = _fabric('hood', 'hood2', 'hood3', 81)
    v = Vox()
    for x in range(-16, 17):
        for y in range(-11, 15):
            for z in range(36, 72):
                if (x, y, z) in occ:
                    continue
                dx, dy, dz = x / 15.0, (y - 1.5) / 12.8, (z - 52) / 18.0
                d = dx * dx + dy * dy + dz * dz
                if 0.74 <= d <= 1.0 and y >= -9 and not (y <= -6 and z < 60 and abs(x) < 12):
                    v[(x, y, z)] = 'hoodIn' if y <= -8 else f(x, y, z)
    return v


# ---------------------------------------------------------------------------- Rig

PARTS = [
    # name, parent, pivot (Voxel), builder
    ('hips', None, (0, 0, 21), lambda: _hips()),
    ('torso', 'hips', (0, 0, 22.5), lambda: _torso()),
    ('hood_down', 'torso', (0, 6, 36), lambda: _hood_down()),
    ('head', 'torso', (0, 0, 36), lambda: _head()),
    ('hood_up', 'head', (0, 9, 40), lambda: _hood_up()),
    ('brow_L', 'head', (5, -11.5, 57.5), lambda: _brow(1)),
    ('brow_R', 'head', (-5, -11.5, 57.5), lambda: _brow(-1)),
    ('lid_L', 'head', (5, -12, 56.5), lambda: _lid(1)),
    ('lid_R', 'head', (-5, -12, 56.5), lambda: _lid(-1)),
    ('pupil_L', 'head', (5, -12, 52), lambda: _pupil(1)),
    ('pupil_R', 'head', (-5, -12, 52), lambda: _pupil(-1)),
    ('arm_L', 'torso', (13, -1, 35.5), lambda: _arm(1)[0]),
    ('fore_L', 'arm_L', (13, -1, 27.5), lambda: _arm(1)[1]),
    ('arm_R', 'torso', (-13, -1, 35.5), lambda: _arm(-1)[0]),
    ('fore_R', 'arm_R', (-13, -1, 27.5), lambda: _arm(-1)[1]),
    ('leg_L', 'hips', (5.5, 0, 21), lambda: _leg('L')[0]),
    ('shin_L', 'leg_L', (5.5, 0, 13.5), lambda: _leg('L')[1]),
    ('leg_R', 'hips', (-5.5, 0, 21), lambda: _leg('R')[0]),
    ('shin_R', 'leg_R', (-5.5, 0, 13.5), lambda: _leg('R')[1]),
]
HANDS = ['relaxed', 'fist', 'point', 'finger', 'open']
for _k in MOUTHS:
    PARTS.append(('mouth_' + _k, 'head', (0, -10, 41), (lambda k=_k: _mouth(k))))
for _s, _sx in (('L', 1), ('R', -1)):
    for _k in HANDS:
        PARTS.append((f'hand_{_s}_{_k}', f'fore_{_s}', (13 * _sx, -1, 19.5), (lambda sx=_sx, k=_k: _hand(sx, k))))


def _colors(vox, seed):
    col, cold, emit = {}, {}, set()
    for k, name in vox.items():
        a, b = _LIN[name]
        amt = TEXTURE.get(name, 0.05)
        j = 1 + (_h(*k, seed) - 0.5) * 2 * amt
        col[k] = tuple(min(1.0, c * j) for c in a)
        cold[k] = tuple(min(1.0, c * j) for c in b)
        if name in EMIT_KEYS:
            emit.add(k)
    return col, cold, emit


class Rig:
    """Eine Figur aus Voxel-Teilen. obj[name] -> Blender-Objekt, root = Empty zum Platzieren."""

    def __init__(self, name, parent=None, coll=None, glow_color=(0.62, 0.22, 1.0)):
        self.name = name
        self.coll = coll
        self.mat = vx.voxel_material(f'{name}_mat', glow_color=glow_color)
        self.root = vx.empty(f'{name}_root', parent=parent, coll=coll)
        self.obj = {}
        piv = {}
        for pname, par, pivot, build in PARTS:
            vox = build()
            col, cold, emit = _colors(vox, 3)
            me = vx.mesh(f'{name}_{pname}', col, pivot=pivot, dark=cold, emit=emit)
            if par is None:
                ploc = (pivot[0] * V, pivot[1] * V, pivot[2] * V)
                parent_obj = self.root
            else:
                pp = piv[par]
                ploc = ((pivot[0] - pp[0]) * V, (pivot[1] - pp[1]) * V, (pivot[2] - pp[2]) * V)
                parent_obj = self.obj[par]
            o = vx.obj(f'{name}_{pname}', me, self.mat, parent=parent_obj, loc=ploc, coll=coll)
            o.rotation_mode = 'ZXY'
            o['rest'] = ploc
            self.obj[pname] = o
            piv[pname] = pivot
        self.pivots = piv

    def set_dark(self, dark, glow):
        nt = self.mat.node_tree
        nt.nodes['Dark'].outputs[0].default_value = dark
        nt.nodes['Glow'].outputs[0].default_value = glow
