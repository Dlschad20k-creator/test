"""Choreografie aller 8 Szenen: Figuren, Mimik, Kamera, Licht, Spiegel/Portal und Effekte.
Alle Zeitpunkte kommen aus timeline.EV, damit Bild, Ton und Untertitel synchron sind."""
import json, math, os, random, wave
import numpy as np
import bpy
from mathutils import Vector
import voxel as vx
import bathroom as bath
import anim
import fx
import poses as P_
from anim import CharAnim, CamAnim, Track, Baker
from timeline import EV, FPS, FRAMES, LINES

V = vx.V
PL = (bath.MY - 0.5) * V            # Spiegelebene y
E = EV


def M(*ds):
    out = {}
    for d in ds:
        out.update(d)
    return out


def ml(x, y, z=0.0):
    """Weltposition -> lokale Koordinaten der Spiegelwelt (für den Doppelgänger)."""
    return (x, 2 * PL - y, z)


def hC(dx, dy):
    """Blickrichtung (Welt) -> Drehung Crackie."""
    return math.degrees(math.atan2(dx, -dy))


def hD(dx, dy):
    """Blickrichtung (Welt) -> Drehung Doppelgänger (gespiegelt)."""
    return math.degrees(math.atan2(dx, dy))


# ------------------------------------------------------------------ Lippen-Sync aus den Sprachdateien

def load_talk(voice_dir):
    env = {}
    if not voice_dir or not os.path.isdir(voice_dir):
        return lambda who: (lambda t: 0.0)
    for ln in LINES:
        p = os.path.join(voice_dir, ln['id'] + '.wav')
        if not os.path.exists(p):
            continue
        with wave.open(p) as w:
            sr = w.getframerate(); ch = w.getnchannels()
            a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        a = a.reshape(-1, ch).mean(axis=1)
        hop = sr // FPS
        n = len(a) // hop
        rms = np.sqrt(np.array([np.mean(a[i * hop:(i + 1) * hop] ** 2) for i in range(n)]) + 1e-9)
        ref = np.percentile(rms, 90) + 1e-6
        e = np.clip(rms / ref, 0, 1.2)
        e = np.convolve(e, [0.25, 0.5, 0.25], mode='same')
        env.setdefault(ln['who'], []).append((ln['t'], e))

    def make(who):
        items = env.get(who, [])

        def f(t):
            best = 0.0
            for t0, e in items:
                k = int((t - t0) * FPS)
                if 0 <= k < len(e):
                    best = max(best, float(e[k]))
            return best
        return f
    return make


# ------------------------------------------------------------------ Hilfen

def laugh(A, t0, t1, amp=1.0, period=0.24):
    t, k = t0, 0
    while t < t1:
        up = k % 2
        A.pose(t, period / 2, {'torso': (-10 + (5 if up else -3) * amp, 0.0, 0.0),
                               'head': (-14 + (9 if up else -4) * amp, (3 if up else -3) * amp, 0.0)}, 'smooth')
        t += period / 2
        k += 1


def head_shake(A, t0, t1, amp=16.0, period=0.26, base=(4.0, 0.0, 0.0)):
    t, k = t0, 0
    while t < t1:
        A.pose(t, period / 2, {'head': (base[0], base[1], base[2] + (amp if k % 2 else -amp))}, 'smooth')
        t += period / 2
        k += 1
    A.pose(t, 0.15, {'head': base})


def flicker(tr, t0, t1, base, seed=0, low=0.15):
    rnd = random.Random(seed)
    t = t0
    while t < t1:
        tr.to(t, t + 0.02, base * (low + (1 - low) * rnd.random() ** 0.5), 'linear')
        t += 0.04 + rnd.random() * 0.1
    tr.to(t, t + 0.05, base, 'linear')


def pulse(tr, t, peak, attack=0.03, decay=0.6, base=0.0):
    tr.to(t, t + attack, peak, 'linear')
    tr.to(t + attack, t + attack + decay, base, 'out2')


# ------------------------------------------------------------------ Hauptfunktion

def animate(H, voice_dir=None, meta_path=None):
    voice_dir = voice_dir or os.environ.get('CRACKIE_VOICE_DIR')
    talk = load_talk(voice_dir)
    C = CharAnim('crackie', seed=3, talk=talk('crackie'))
    D = CharAnim('dark', follow=C, seed=5, talk=talk('dunkel'))
    S = CharAnim('shadow', seed=7)
    cam = CamAnim()
    # Licht-Tracks
    LE = {k: Track(o.data.energy) for k, o in H['lights'].items()}
    LC = {k: Track(tuple(o.data.color)) for k, o in H['lights'].items()}
    ME = {k: Track(o.data.energy) for k, o in H['mlights'].items()}
    MC = {k: Track(tuple(o.data.color)) for k, o in H['mlights'].items()}
    lamp = Track(6.0); bulb = Track(9.0); world = Track(1.0); shafts = Track(1.0)
    G = {k: Track(0.0) for k in ('Portal', 'Crack', 'CrackX', 'CrackZ', 'Gone', 'Ring')}
    shots = []

    def shot(t, name, loc, tgt, lens, fstop=2.8, roll=0.0, focus=-1.0):
        cam.cut(t, loc, tgt, lens, fstop, roll, focus)
        shots.append((t, name))

    warm = (1.0, 0.76, 0.52); cold = (0.42, 0.52, 1.0); violet = (0.62, 0.30, 1.0)
    SPOT = (0.0, -0.84)

    # ============================================================ S1 0–12 DER ERSTE FEHLER
    C.pose(0, 0, M(P_.CHILL, P_.F_CHILL, {'root.loc': (SPOT[0], SPOT[1], 0.0), 'root.rot': (0.0, 0.0, 180.0),
                                         'lid_L': 0.56, 'lid_R': 0.56, 'pupil': (0.3, -0.9)}))
    S.pose(0, 0, {'vis': 0.0, 'root.loc': (0.45, -0.95, 0.0), 'root.rot': (0.0, 0.0, 180.0)})
    # Hook: Spiegelbild-Augen schnappen zur Kamera
    D.pose(0.6, 0.07, {'pupil': (0.0, 0.25), 'lid_L': 0.34, 'lid_R': 0.34, 'brow_L': (-6.0, 0.0), 'brow_R': (-6.0, 0.0)}, 'snap')
    D.no_blink.append((0.0, 3.0))
    D.release(2.55, 0.12, ['pupil', 'lid_L', 'lid_R', 'brow_L', 'brow_R'])
    shot(0.0, '1A ECU Spiegelaugen', (0.02, -0.21, 1.49), (0.0, 0.5, 1.46), 24, 2.0)
    cam.move(0.0, 3.0, loc=(0.02, -0.17, 1.49), lens=30)
    # Hand heben – Spiegelbild macht NICHT mit
    D.pose(2.95, 0.05, {'arm_R': (4.0, 7.0, 0.0), 'fore_R': 14.0, 'hand_R': 'relaxed', 'head': (3.0, 0.0, 0.0)})
    C.pose(E['raise_hand'], 0.4, M(P_.SCRATCH_HEAD_R, {'lid_L': 0.62, 'lid_R': 0.62}))
    C.pose(E['lower_hand'], 0.45, {'arm_R': (4.0, 7.0, 0.0), 'fore_R': 14.0, 'head': (3.0, 0.0, 0.0)})
    D.pose(E['refl_smile'], 0.3, {'mouth': 'smile', 'brow_L': (-5.0, 0.0), 'brow_R': (-5.0, 0.0), 'lid_L': 0.44, 'lid_R': 0.44})
    D.release(5.6, 0.3, ['arm_R', 'fore_R', 'hand_R', 'head'])
    D.release(6.6, 0.4, ['mouth', 'brow_L', 'brow_R', 'lid_L', 'lid_R'])
    shot(3.0, '1B OTS Hand', (1.22, -2.65, 1.72), (-0.10, 0.50, 1.35), 30, 3.2)
    cam.move(3.0, 7.4, loc=(1.12, -2.45, 1.70))
    # Zurückblicken, Zwinkern, Einfrieren
    C.pose(E['look_back'], 0.4, {'head': (5.0, 4.0, 62.0), 'pupil': (1.4, -0.4)})
    D.pose(E['look_back'] - 0.05, 0.05, {'head': (3.0, 0.0, 0.0), 'pupil': (0.0, 0.0)})
    C.pose(8.75, 0.3, {'head': (3.0, 0.0, 0.0), 'pupil': (0.0, -0.2)})
    D.pose(E['wink'] - 0.25, 0.25, {'mouth': 'smile', 'brow_L': (-8.0, 0.4), 'brow_R': (-12.0, -0.6)})
    D.pose(E['wink'], 0.1, {'lid_L': 1.0}, 'snap')
    D.pose(E['wink'] + 0.28, 0.12, {'lid_L': 0.45})
    C.pose(E['freeze'], 0.12, M(P_.F_SURPRISE, {'mouth': 'neutral', 'pupil_s': 0.85}), 'snap')
    C.pose(E['freeze'], 0.0, {'breath': 0.0})
    C.pose(9.6, 0.5, M(P_.F_SLEEPY, {'breath': 1.0}))
    D.release(10.4, 0.5, ['mouth', 'brow_L', 'brow_R', 'lid_L', 'pupil', 'head'])
    shot(7.4, '1C Dolly zum Spiegel', (1.32, -1.92, 1.56), (-0.12, -0.15, 1.45), 26, 2.6)
    cam.move(7.4, 12.0, loc=(1.16, -1.66, 1.53), lens=30)

    # ============================================================ S2 12–27 ETWAS STIMMT NICHT
    shot(12.0, '2A Crackie nah (aus dem Spiegel)', (0.30, 0.34, 1.50), (0.0, -0.72, 1.45), 30, 2.2)
    cam.move(12.0, 15.2, loc=(0.24, 0.26, 1.49))
    C.pose(E['head_turn'], 0.4, {'head': (3.0, -3.0, -42.0), 'pupil': (-1.2, -0.3)})
    D.pose(E['head_turn'], 0.5, {'head': (3.0, 3.0, 42.0), 'pupil': (1.2, -0.3)})
    C.pose(13.6, 0.35, {'head': (3.0, 0.0, 0.0), 'pupil': (0.0, -0.1)})
    C.pose(E['brows_up'], 0.2, M(P_.F_SURPRISE, {'mouth': 'neutral'}))
    D.pose(14.9, 0.6, {'head': (3.0, 0.0, 0.0), 'pupil': (0.0, -0.1)})
    shot(15.2, '2B Reflexion durchs Glas', (-0.18, -0.22, 1.50), (0.0, 0.52, 1.43), 22, 2.0)
    cam.move(15.2, 17.4, loc=(-0.14, -0.19, 1.50))
    C.pose(16.0, 0.6, P_.F_SUSPICIOUS)
    D.release(15.6, 0.4)
    shot(17.4, '2C OTS links Zeigen', (-1.22, -2.62, 1.72), (0.10, 0.50, 1.35), 30, 3.0)
    cam.move(17.4, 21.6, loc=(-1.12, -2.42, 1.70))
    D.pose(E['point_self'] - 0.05, 0.05, {'arm_R': (4.0, 7.0, 0.0), 'fore_R': 14.0, 'hand_R': 'relaxed', 'head': (3.0, 0.0, 0.0)})
    C.pose(E['point_self'], 0.35, P_.POINT_SELF_R)
    C.pose(E['point_self'] + 0.5, 0.4, {'head': (4.0, 0.0, 0.0)})
    D.pose(E['refl_point'], 0.45, P_.POINT_SELF_R, 'back')
    D.pose(E['refl_point'] + 0.6, 0.4, {'head': (-4.0, 8.0, 0.0)})
    D.pose(E['refl_grin'], 0.3, M(P_.F_GRIN, {'pupil': (0.0, 0.1)}))
    C.pose(20.9, 0.4, M(P_.F_SUSPICIOUS, {'arm_R': (4.0, 7.0, 0.0), 'fore_R': 14.0, 'hand_R': 'relaxed'}))
    D.pose(21.5, 0.5, {'arm_R': (4.0, 7.0, 0.0), 'fore_R': 14.0, 'hand_R': 'relaxed'})
    shot(21.6, '2D Spiegel-POV', (0.26, 0.36, 1.40), (0.0, -1.05, 1.25), 22, 2.8)
    cam.move(21.6, 27.0, loc=(0.20, 0.28, 1.40))
    # Zurückweichen – das Spiegelbild bleibt stehen
    D.pose(E['step_back'] - 0.05, 0.05, {'root.loc': (SPOT[0], SPOT[1], 0.0)})
    C.walk(E['step_back'], E['step_back'] + 0.6, (SPOT[0], SPOT[1], 0.0), (0.0, -1.20, 0.0), step=0.3, amp=0.6)
    C.pose(E['step_back'], 0.3, M(P_.STEP_BACK, P_.F_SURPRISE))
    C.pose(24.0, 0.4, M(P_.CHILL, P_.F_SUSPICIOUS))
    C.pose(25.1, 0.35, M(P_.POINT_SELF_R, {'brow_L': (-12.0, 0.4), 'brow_R': (-12.0, 0.4)}))
    C.pose(26.3, 0.45, {'arm_R': (4.0, 7.0, 0.0), 'fore_R': 14.0, 'hand_R': 'relaxed'})
    D.pose(24.4, 0.6, {'head': (2.0, 12.0, 0.0)})

    # ============================================================ S3 27–42 DER DOPPELGÄNGER LACHT
    shot(27.0, '3A aus der Spiegelwelt', (-0.95, 2.40, 1.75), (0.05, -1.20, 1.30), 26, 3.2)
    cam.move(27.0, 31.0, loc=(-0.88, 2.22, 1.72))
    C.pose(E['cross_arms'], 0.5, M(P_.CROSS, P_.F_SUSPICIOUS))
    D.pose(E['cross_arms'], 0.5, P_.CROSS)
    D.pose(E['refl_laugh'], 0.25, M(P_.LAUGH_BODY, P_.F_LAUGH))
    laugh(D, E['refl_laugh'] + 0.25, 32.0, 0.9)
    shot(31.0, '3B Crackie Grimasse', (0.12, 0.32, 1.46), (0.0, -1.20, 1.40), 30, 2.2)
    cam.move(31.0, 35.0, loc=(0.10, 0.18, 1.46), lens=34)
    D.pose(32.0, 0.3, M(P_.CHILL, P_.F_GRIN))
    C.pose(E['grimace'], 0.25, M(P_.F_GRIMACE, {'head': (0.0, -10.0, 0.0)}))
    C.pose(34.1, 0.35, M(P_.F_SLEEPY, {'head': (6.0, 0.0, 0.0)}))
    shot(35.0, '3C Reflexion Mittelfinger', (0.16, -0.40, 1.38), (0.0, 0.62, 1.30), 20, 2.4)
    cam.move(35.0, 38.4, loc=(0.12, -0.34, 1.40))
    D.pose(E['finger'], 0.25, P_.FINGER_R, 'back')
    D.pose(E['laugh_harder'], 0.2, M(P_.F_LAUGH, {'torso': (-10.0, 0.0, 0.0)}))
    laugh(D, E['laugh_harder'] + 0.2, E['finger_end'], 1.4, 0.2)
    D.pose(E['finger_end'], 0.4, {'arm_R': (4.0, 7.0, 0.0), 'fore_R': 14.0, 'hand_R': 'relaxed'})
    laugh(D, E['finger_end'] + 0.1, E['serious'] - 0.1, 1.2, 0.22)
    shot(38.4, '3D ECU Spiegelbild ernst', (0.03, -0.32, 1.48), (0.0, 0.50, 1.46), 24, 2.0)
    cam.move(38.4, 42.0, loc=(0.02, -0.24, 1.48), lens=34)
    D.pose(E['serious'], 0.08, M(P_.CHILL, P_.F_SERIOUS, {'torso': (2.0, 0.0, 0.0), 'head': (4.0, 0.0, 0.0)}), 'snap')
    D.no_blink.append((E['serious'], 75.0))
    D.pose(E['eyes_glow'], 0.6, {'glow': 7.0})
    D.pose(E['eyes_glow'], 2.4, {'dark': 0.9})
    D.pose(E['eyes_glow'] + 1.2, 1.4, {'brow_L': (-22.0, -0.9), 'brow_R': (-22.0, -0.9)})
    C.pose(E['eyes_glow'] + 0.3, 0.2, M(P_.F_SHOCK, P_.CHILL))
    for k in ('ceiling', 'vanity', 'window', 'fill'):
        MC[k].to(17.0, 27.0, tuple(0.8 * a + 0.2 * b for a, b in zip(warm, cold)))
        MC[k].to(E['eyes_glow'], E['eyes_glow'] + 2.0, cold if k != 'vanity' else violet)
        ME[k].to(E['eyes_glow'], E['eyes_glow'] + 2.0, ME[k].default * (0.55 if k != 'vanity' else 1.4))

    # ============================================================ S4 42–58 DER SPIEGEL ÖFFNET SICH
    shot(42.0, '4A Totale Beben', (1.45, -3.05, 1.35), (-0.10, -0.40, 1.25), 20, 4.0)
    cam.move(42.0, 46.0, loc=(1.30, -2.80, 1.38))
    cam.shake_at(E['vibrate'], 0.012, 3.8)
    for k in ('ceiling', 'vanity'):
        flicker(LE[k], E['vibrate'], E['vibrate'] + 1.2, LE[k].default, seed=4)
    flicker(bulb, E['vibrate'], E['vibrate'] + 1.2, 9.0, seed=5)
    D.pose(E['vibrate'], 0.3, {'glitch': 0.35})
    C.pose(E['vibrate'], 0.4, M(P_.F_SHOCK, P_.STEP_BACK))
    C.pose(43.5, 0.6, M(P_.CHILL, P_.F_SURPRISE))
    D.pose(44.0, 0.45, P_.HOOD_GRAB)
    D.pose(44.4, 0.6, {'hood': 1.0})
    D.pose(45.0, 0.45, M(P_.CHILL, {'hand_L': 'relaxed', 'hand_R': 'relaxed'}))
    G['Portal'].to(E['liquid'], E['liquid'] + 1.6, 0.55)
    LE['cyan'].to(E['liquid'], E['liquid'] + 1.6, 40.0)
    shot(46.0, '4B Flüssiges Glas', (-0.78, -1.05, 1.66), (0.05, 0.10, 1.50), 22, 2.6)
    cam.move(46.0, 48.3, loc=(-0.66, -0.92, 1.64))
    # Doppelgänger klettert auf den Waschtisch und drückt die Hand ans Glas
    D.walk(46.4, 47.1, ml(0.0, 0.812), ml(0.0, 0.62), step=0.35, amp=0.7)
    D.pose(47.1, 0.7, M(P_.CLIMB, {'root.loc': ml(0.0, 0.36, 0.86)}), 'smooth')
    D.pose(47.8, 0.4, {'hips.loc': (0.0, 0.0, -0.12), 'torso': (22.0, 0.0, 0.0), 'head': (-14.0, 0.0, 0.0),
                       'leg_L': (40.0, 8.0, 0.0), 'shin_L': 70.0, 'leg_R': (40.0, 8.0, 0.0), 'shin_R': 70.0,
                       'arm_L': (10.0, 8.0, 0.0), 'fore_L': 20.0, 'hand_L': 'relaxed'})
    D.pose(E['hand_glass'] - 0.35, 0.35, P_.PALM_UP_R, 'snap')
    G['Ring'].to(E['hand_glass'], E['hand_glass'] + 0.1, 1.0, 'linear')
    G['Ring'].to(E['hand_glass'] + 2.0, E['hand_glass'] + 3.5, 0.0)
    shot(E['hand_glass'], '4C Hand am Glas', (0.42, -1.00, 1.66), (-0.16, 0.12, 1.62), 22, 2.2)
    cam.move(E['hand_glass'], 51.0, loc=(0.34, -0.86, 1.65), lens=26)
    G['Crack'].to(E['crack'], E['crack'] + 1.2, 1.0, 'out')
    pulse(LE['red'], E['crack'], 140.0, 0.03, 0.9)
    cam.shake_at(E['crack'], 0.008, 0.6)
    shot(51.0, '4D Crackie weicht zurück', (0.04, -0.20, 1.40), (0.0, -1.40, 1.40), 24, 2.6)
    cam.move(51.0, 54.0, loc=(0.03, -0.28, 1.40))
    C.walk(E['step_back2'], E['step_back2'] + 0.7, (0.0, -1.20, 0.0), (0.0, -1.55, 0.0), step=0.3, amp=0.6)
    C.pose(E['step_back2'], 0.3, M(P_.STEP_BACK, P_.F_SHOCK))
    head_shake(C, 51.9, 53.4, 14.0)
    # Durchbruch (Zeitlupe)
    G['Gone'].set(E['breakthrough'], 1.0)
    G['Portal'].to(E['breakthrough'], E['breakthrough'] + 0.15, 1.6, 'linear')
    G['Portal'].to(E['breakthrough'] + 0.15, E['breakthrough'] + 2.5, 1.0)
    pulse(LE['cyan'], E['breakthrough'], 420.0, 0.03, 1.8, 60.0)
    pulse(LE['violet'], E['breakthrough'], 260.0, 0.03, 2.2, 60.0)
    cam.shake_at(E['breakthrough'], 0.02, 1.2)
    shot(E['breakthrough'], '4E Durchbruch Zeitlupe', (1.45, -2.15, 0.82), (-0.08, -0.30, 1.48), 20, 3.5)
    cam.move(E['breakthrough'], 58.0, loc=(1.28, -1.90, 0.90))
    D.pose(E['breakthrough'], 0.6, {'arm_R': (60.0, 6.0, 0.0), 'fore_R': 40.0, 'torso': (30.0, 0.0, 0.0)})
    D.pose(E['hand_out'], 1.2, {'root.loc': ml(0.0, 0.20, 0.86), 'arm_R': (88.0, 4.0, 0.0), 'fore_R': 6.0,
                                'hand_R': 'open', 'torso': (34.0, 0.0, 0.0)}, 'smooth')

    # ============================================================ S5 58–75 CRACKIES DOPPELGÄNGER
    shot(58.0, '5A Er steigt heraus', (1.30, -2.45, 1.15), (0.0, -0.35, 1.45), 22, 3.2)
    cam.move(58.0, 61.4, loc=(1.15, -2.25, 1.12))
    D.pose(E['step_out'], 1.6, M(P_.DUCK, {'root.loc': ml(0.0, -0.32, 0.86), 'head': (-20.0, 0.0, 0.0),
                                           'arm_L': (50.0, 20.0, 0.0), 'fore_L': 30.0, 'arm_R': (50.0, 20.0, 0.0),
                                           'fore_R': 30.0, 'hand_L': 'open', 'hand_R': 'open'}))
    D.walks.append(anim.Walk(E['step_out'], E['step_out'] + 1.6, 0.4, 0.5))
    G['Portal'].to(59.6, 61.4, 0.03)
    G['Portal'].to(63.7, 63.8, 0.0, 'linear')
    G['Portal'].to(66.0, 66.1, 0.03, 'linear')
    D.pose(60.0, 0.5, M(P_.CHILL, {'root.loc': ml(0.0, -0.36, 0.86)}))
    D.pose(60.55, 0.12, P_.CROUCH, 'snap')
    D.pose(60.67, 0.35, M(P_.LUNGE, {'root.loc': ml(0.0, -0.58, 1.20)}), 'out')
    D.pose(61.02, 0.38, M(P_.LAND, {'root.loc': ml(0.0, -0.75, 0.0)}), 'in2')
    cam.shake_at(E['land'], 0.02, 0.5)
    D.pose(E['land'] + 0.6, 0.9, M(P_.CHILL, {'hips.loc': (0.0, 0.0, 0.0), 'torso': (2.0, 0.0, 0.0), 'head': (-4.0, 0.0, -8.0),
                                              'root.rot': (0.0, 0.0, hD(0.11, -0.99))}))
    D.walk(62.0, 62.9, ml(0.0, -0.75), ml(0.45, -0.85), step=0.3, amp=0.6)
    C.walk(62.2, 62.9, (0.0, -1.55), (-0.25, -1.55), step=0.3, amp=0.5)
    C.pose(62.2, 0.8, {'root.rot': (0.0, 0.0, hC(0.85, 0.37)), 'head': (3.0, 0.0, 10.0)})
    D.pose(E['land'], 0.2, {'glitch': 0.0})
    C.pose(58.6, 0.3, M(P_.F_SHOCK, P_.STEP_BACK))
    C.pose(61.6, 0.3, {'torso': (-10.0, 0.0, 0.0)})
    # Face-off: Kamerafahrt um beide herum
    shot(E['land'], '5B Face-off Totale', (1.75, -2.45, 1.50), (0.10, -1.15, 1.38), 22, 4.0)
    cam.move(E['land'], 63.8, loc=(1.95, -1.75, 1.52), tgt=(0.10, -1.20, 1.40), ease='smooth')
    shot(63.8, '5B2 Gegenschuss aus dem Spiegel', (-0.15, 0.50, 1.62), (-0.25, -1.55, 1.42), 26, 3.0)
    cam.move(63.8, 66.0, loc=(-0.15, 0.38, 1.60))
    C.pose(63.0, 0.6, M(P_.CHILL, P_.F_SUSPICIOUS))
    C.pose(64.6, 0.6, P_.F_SERIOUS)
    D.pose(62.0, 0.6, M(P_.F_SERIOUS, {'mouth': 'neutral'}))
    shot(66.0, '5C Kapuze zurück', (1.48, -2.58, 1.70), (0.45, -0.85, 1.55), 34, 2.4)
    cam.move(66.0, 69.4, loc=(1.38, -2.42, 1.68), lens=40)
    D.pose(66.0, 0.4, P_.HOOD_GRAB)
    D.pose(E['hood_back'], 0.5, {'hood': 0.0})
    D.pose(E['hood_back'] + 0.45, 0.45, M(P_.CHILL, {'hand_L': 'relaxed', 'hand_R': 'relaxed'}))
    D.pose(E['dark_grin'], 0.3, P_.F_EVIL)
    pulse(LE['red'], E['dark_grin'], 90.0, 0.05, 1.2)
    LE['rim'].to(61.4, 62.5, 160.0)
    shot(69.4, '5D Zwei-Schuss Nachahmen', (2.0, -1.45, 1.38), (0.10, -1.20, 1.36), 24, 3.2)
    cam.move(69.4, 75.0, loc=(1.88, -1.40, 1.38))
    C.pose(68.8, 0.5, M(P_.CROSS, P_.F_SUSPICIOUS))
    D.pose(E['mimic'], 0.5, M(P_.CROSS, P_.F_SLEEPY, {'head': (6.0, 14.0, 0.0), 'mouth': 'creepy'}))
    D.pose(70.1, 0.2, {'mouth': 'creepy'})
    C.pose(72.0, 0.4, M(P_.F_SLEEPY, P_.CHILL))
    C.pose(73.4, 0.6, {'root.rot': (0.0, 0.0, hC(1.0, -0.3)), 'head': (4.0, 0.0, 12.0)})
    C.pose(74.5, 0.35, M(P_.F_ANGRY, {'root.rot': (0.0, 0.0, hC(0.85, 0.37)), 'head': (2.0, 0.0, 0.0)}))
    C.pose(E['lunge'], 0.2, {'root.rot': (0.0, 0.0, hC(0.5, 0.45))})
    D.pose(73.0, 0.4, M(P_.CHILL, P_.F_EVIL))

    # ============================================================ S6 75–94 DER KAMPF
    shot(75.0, '6A Angriff', (1.90, -3.40, 1.45), (0.0, -1.00, 1.05), 20, 4.0)
    cam.move(75.0, 77.3, loc=(1.78, -3.20, 1.42))
    cam.shake_at(75.2, 0.01, 0.6)
    C.pose(E['lunge'], 0.25, M(P_.LUNGE, P_.F_ANGRY))
    C.walk(E['lunge'] + 0.1, 76.8, (-0.25, -1.55, 0.0), (0.25, -1.10, 0.0), step=0.22, amp=0.8)
    D.pose(E['sidestep'], 0.28, M(P_.F_SMUG, {'root.loc': ml(0.98, -1.02, 0.0), 'torso': (0.0, 12.0, 0.0)}), 'snap')
    D.pose(E['sidestep'] + 0.3, 0.3, {'torso': (2.0, 0.0, 0.0), 'root.rot': (0.0, 0.0, hD(-0.7, -0.2))})
    shot(77.3, '6B Ausrutschen', (-1.55, -3.40, 1.45), (0.15, -0.80, 1.0), 20, 4.0)
    cam.move(77.3, 79.4, loc=(-1.42, -3.20, 1.42))
    C.pose(77.3, 0.4, {'root.loc': (0.15, -0.88, 0.0), 'root.rot': (0.0, 0.0, 180.0)}, 'linear')
    C.pose(E['slide'], 0.25, M(P_.SLIP, P_.F_SHOCK))
    C.pose(E['slide'] + 0.25, 0.5, {'root.loc': (0.15, -0.80, 0.0), 'root.rot': (-12.0, 0.0, 180.0)}, 'in2')
    C.pose(79.2, 0.12, {'torso': (35.0, 0.0, 0.0), 'head': (25.0, 0.0, 0.0), 'root.rot': (0.0, 0.0, 180.0)}, 'snap')
    cam.shake_at(79.2, 0.018, 0.5)
    C.pose(79.45, 0.45, M(P_.CHILL, P_.F_PAIN, {'root.loc': (0.0, -1.05, 0.0), 'torso': (-6.0, 0.0, 0.0)}), 'out')
    head_shake(C, 79.9, 80.9, 9.0, 0.3)
    # Sprung über den Waschtisch
    D.pose(79.9, 0.3, M(P_.CROUCH, {'root.rot': (0.0, 0.0, hD(-0.6, 0.8))}))
    shot(E['jump_sink'], '6C Sprung über Crackie', (1.45, -3.50, 0.45), (0.0, -1.00, 1.35), 18, 4.5)
    cam.move(E['jump_sink'], 82.9, loc=(1.30, -3.30, 0.50))
    D.pose(E['jump_sink'], 0.4, M(P_.LUNGE, {'root.loc': ml(0.42, -0.30, 0.86)}), 'out')
    D.pose(80.6, 0.4, M(P_.CLIMB, {'root.loc': ml(0.05, -1.0, 1.75), 'root.rot': (0.0, 0.0, hD(-0.3, -1.0))}), 'out2')
    D.pose(81.0, 0.4, M(P_.LAND, {'root.loc': ml(-0.40, -1.72, 0.0), 'root.rot': (0.0, 0.0, hD(0.3, 1.0))}), 'in2')
    D.pose(81.5, 0.4, M(P_.CHILL, P_.F_SMUG, P_.WAVE_R))
    D.pose(82.0, 0.3, {'arm_R': (4.0, 7.0, 0.0), 'fore_R': 14.0, 'hand_R': 'relaxed'})
    C.pose(81.4, 0.3, {'root.rot': (0.0, 0.0, hC(-0.4, -0.6))})
    C.pose(81.4, 0.3, P_.F_ANGRY)
    C.walk(81.8, 82.75, (0.0, -1.05, 0.0), (1.18, -0.58, 0.0), step=0.2, heading=hC(1.0, 0.25))
    D.walk(81.9, 83.1, ml(-0.40, -1.72), ml(0.52, -1.18), step=0.3, heading=hD(1.0, 0.6))
    shot(82.9, '6D Handtuch-Peitsche', (-1.62, -3.50, 1.60), (0.60, -1.00, 1.05), 20, 4.0)
    cam.move(82.9, 86.0, loc=(-1.48, -3.30, 1.55))
    C.pose(E['towel'], 0.25, M(P_.TOWEL_UP_R, {'root.rot': (0.0, 0.0, hC(-0.66, -0.6))}))
    C.pose(E['towel_hit'] - 0.1, 0.18, P_.TOWEL_SWING_R, 'snap')
    D.pose(E['towel_hit'], 0.12, {'head': (-26.0, 18.0, 35.0), 'torso': (-14.0, 0.0, 10.0)}, 'snap')
    D.pose(E['towel_hit'] + 0.12, 0.6, M(P_.F_PAIN, {'root.loc': ml(0.26, -1.45)}), 'out')
    D.pose(84.4, 0.3, M(P_.CHILL, P_.F_ANGRY))
    pulse(LE['red'], E['towel_hit'], 80.0, 0.03, 0.5)
    cam.shake_at(E['towel_hit'], 0.012, 0.4)
    # Doppel-Rutschen, Zusammenstoß
    C.pose(E['double_slide'], 0.25, M(P_.SLIP, P_.F_ANGRY, {'root.rot': (0.0, 0.0, hC(-0.5, -0.45))}))
    C.pose(E['double_slide'] + 0.2, E['collide'] - E['double_slide'] - 0.2, {'root.loc': (0.68, -1.00, 0.0)}, 'in2')
    D.pose(E['double_slide'], 0.25, M(P_.SLIP, P_.F_ANGRY, {'root.rot': (0.0, 0.0, hD(0.5, 0.45))}))
    D.pose(E['double_slide'] + 0.2, E['collide'] - E['double_slide'] - 0.2, {'root.loc': ml(0.42, -1.22)}, 'in2')
    C.pose(E['collide'], 0.1, {'head': (-30.0, 0.0, 0.0), 'torso': (-20.0, 0.0, 0.0)}, 'snap')
    D.pose(E['collide'], 0.1, {'head': (-30.0, 0.0, 0.0), 'torso': (-20.0, 0.0, 0.0)}, 'snap')
    cam.shake_at(E['collide'], 0.025, 0.6)
    pulse(LE['red'], E['collide'], 110.0, 0.03, 0.6)
    # Aufstellung für das Finale: Crackie vor dem Spiegel, Doppelgänger vor ihm
    C.pose(E['collide'] + 0.1, 0.7, M(P_.CHILL, P_.F_PAIN, {'root.loc': (0.62, -0.74, 0.0), 'root.rot': (0.0, 0.0, 0.0)}), 'out')
    D.pose(E['collide'] + 0.1, 0.7, M(P_.CHILL, P_.F_ANGRY, {'root.loc': ml(0.95, -1.38), 'root.rot': (0.0, 0.0, hD(-0.15, 1.0))}), 'out')
    shot(E['windup'], '6E Ausholen (Zeitlupe)', (-1.45, -1.10, 1.36), (0.80, -1.05, 1.28), 26, 2.6)
    cam.move(E['windup'], 88.95, loc=(-1.30, -1.08, 1.30))
    D.pose(E['windup'], 1.3, M(P_.WINDUP_R, P_.F_EVIL), 'smoother')
    C.pose(E['windup'] + 0.3, 0.4, P_.F_SHOCK)
    C.pose(E['duck'], 0.14, M(P_.DUCK, P_.F_SHOCK), 'snap')
    C.pose(E['duck'] + 0.14, 0.45, {'root.loc': (0.08, -0.98, 0.0)}, 'out')
    D.pose(88.55, 0.35, M(P_.PUNCH_R, {'root.loc': ml(0.95, -0.84)}), 'snap')
    shot(E['frame_hit'], '6F Treffer Rahmen', (-1.40, -2.80, 1.45), (0.45, -0.60, 1.40), 22, 3.5)
    cam.move(E['frame_hit'], 91.6, loc=(-1.28, -2.62, 1.42))
    cam.shake_at(E['frame_hit'], 0.03, 0.8)
    pulse(LE['red'], E['frame_hit'], 160.0, 0.03, 1.0)
    pulse(bulb, E['frame_hit'], 30.0, 0.02, 0.4, 9.0)
    D.pose(89.3, 0.4, M(P_.F_PAIN, {'arm_R': (40.0, 30.0, 0.0), 'fore_R': 60.0, 'hand_R': 'open', 'torso': (4.0, 0.0, 0.0)}))
    D.pose(90.0, 0.3, {'arm_R': (55.0, 20.0, 0.0), 'fore_R': 30.0})
    D.pose(90.3, 0.3, {'arm_R': (40.0, 30.0, 0.0), 'fore_R': 70.0})
    C.pose(89.6, 0.1, {'head': (-22.0, 0.0, 0.0)}, 'snap')
    C.pose(89.7, 0.4, M(P_.CHILL, P_.HOLD_MOUTH_R, P_.F_PAIN, {'root.rot': (0.0, 0.0, hC(0.6, -0.5))}))
    C.pose(91.0, 0.4, {'arm_R': (4.0, 7.0, 0.0), 'fore_R': 14.0, 'hand_R': 'relaxed', 'head': (3.0, 0.0, -30.0)})
    shot(E['bonk'], '6G Bonk & K.O.', (-0.45, -3.35, 0.45), (0.85, -1.30, 0.85), 20, 4.0)
    cam.move(E['bonk'], 94.0, loc=(-0.35, -3.15, 0.48))
    D.pose(E['bonk'], 0.1, M(P_.F_KO, {'head': (25.0, 0.0, 0.0), 'hips.loc': (0.0, 0.0, -0.06)}), 'snap')
    D.pose(E['ko'], 0.55, {'root.rot': (-88.0, 0.0, hD(-0.15, 1.0)), 'root.loc': ml(0.95, -0.98, 0.17),
                           'arm_L': (10.0, 70.0, 0.0), 'arm_R': (10.0, 70.0, 0.0), 'fore_L': 10.0, 'fore_R': 10.0,
                           'hand_L': 'open', 'hand_R': 'open', 'leg_L': (0.0, 12.0, 0.0), 'leg_R': (0.0, 12.0, 0.0),
                           'shin_L': 0.0, 'shin_R': 0.0, 'hips.loc': (0.0, 0.0, 0.0), 'torso': (0.0, 0.0, 0.0),
                           'head': (0.0, 0.0, 20.0), 'breath': 0.0}, 'in2')
    cam.shake_at(E['ko'] + 0.55, 0.02, 0.4)
    C.pose(92.6, 0.4, M(P_.F_SURPRISE, {'head': (8.0, 0.0, -20.0)}))

    # ============================================================ S7 94–110 DIE ÜBERRASCHUNG
    shot(94.0, '7A Held von unten', (-0.50, -3.05, 0.40), (0.06, -0.98, 1.30), 22, 4.0)
    cam.move(94.0, 98.2, loc=(-0.40, -2.85, 0.45))
    C.pose(94.0, 0.4, M(P_.CHILL, P_.F_SMUG, {'root.rot': (0.0, 0.0, 0.0), 'head': (3.0, 0.0, 0.0)}))
    C.pose(E['proud'], 0.3, P_.DUST_HANDS)
    C.pose(94.75, 0.15, {'fore_L': 60.0, 'fore_R': 100.0})
    C.pose(94.9, 0.15, {'fore_L': 85.0, 'fore_R': 75.0})
    C.pose(95.1, 0.4, M(P_.PROUD, P_.F_SMUG), 'back')
    C.pose(98.0, 0.3, M(P_.CHILL, {'head': (22.0, 0.0, -48.0), 'pupil': (-1.2, -1.0)}))
    D.pose(98.9, 0.0, {'vis': 0.0})
    shot(E['empty'], '7B Blick auf leeren Boden', (0.18, -0.42, 2.25), (0.95, -1.95, 0.05), 22, 4.0)
    cam.move(E['empty'], 99.9, loc=(0.20, -0.48, 2.20))
    C.pose(99.2, 0.2, M(P_.F_SURPRISE, {'head': (22.0, 0.0, -48.0)}))
    C.walk(99.9, 100.9, (0.08, -0.98, 0.0), (0.30, -0.95, 0.0), step=0.35, amp=0.5)
    C.pose(99.9, 0.6, {'root.rot': (0.0, 0.0, 180.0), 'head': (3.0, 0.0, 0.0), 'pupil': (0.0, -0.2)})
    shot(99.9, '7C Der Spiegel ist leer', (-1.02, -2.62, 1.66), (-0.10, 0.60, 1.36), 28, 3.6)
    cam.move(99.9, E['push_in'], loc=(-0.92, -2.42, 1.64))
    C.pose(E['laugh_behind'], 0.12, M(P_.F_SHOCK, {'breath': 0.0}), 'snap')
    shot(E['push_in'], '7D Push-in Gesicht (aus dem Spiegel)', (0.30, 0.55, 1.47), (0.30, -0.95, 1.45), 28, 2.2)
    cam.move(E['push_in'], 104.4, loc=(0.30, 0.30, 1.47), lens=40)
    C.pose(E['eyes_wide'], 0.1, {'lid_L': 0.0, 'lid_R': 0.0, 'pupil_s': 0.62}, 'snap')
    C.pose(E['look_down'], 0.5, {'head': (16.0, 0.0, -10.0), 'pupil': (-0.8, -1.3)})
    # Der Schatten bewegt sich selbstständig
    shot(E['shadow_move'], '7E Schatten an der Wand', (1.72, -3.25, 1.40), (0.95, -0.05, 1.60), 22, 5.0)
    cam.move(E['shadow_move'], 110.0, loc=(1.62, -3.05, 1.40))
    LE['shadow'].to(103.8, 104.2, 900.0)
    for k in ('ceiling', 'fill'):
        LE[k].to(103.8, 104.2, LE[k].default * 0.35)
    LE['vanity'].to(103.8, 104.2, LE['vanity'].default * 0.4)
    S.pose(104.0, 0.0, M(P_.CHILL, {'vis': 1.0, 'root.loc': (0.62, -1.05, 0.0), 'root.rot': (0.0, 0.0, 180.0)}))
    S.pose(E['shadow_move'], 0.6, {'head': (0.0, 14.0, 30.0)})
    S.pose(E['shadow_move'] + 0.5, 0.4, P_.WAVE_R)
    S.pose(105.2, 0.2, {'fore_R': 70.0}); S.pose(105.4, 0.2, {'fore_R': 100.0}); S.pose(105.6, 0.2, {'fore_R': 70.0})
    S.pose(105.8, 0.4, {'arm_R': (4.0, 7.0, 0.0), 'fore_R': 14.0, 'hand_R': 'relaxed'})
    S.walk(106.2, 108.2, (0.62, -1.05), (0.02, -1.12), step=0.35, heading=hC(-1.0, 0.0))
    S.pose(108.3, 0.0, {'vis': 0.0})
    C.pose(105.0, 0.8, {'head': (2.0, -6.0, -28.0), 'pupil': (-1.4, 0.4)})
    LE['shadow'].to(109.3, 109.9, 0.0)
    for k in ('ceiling', 'fill', 'vanity'):
        LE[k].to(109.3, 109.9, LE[k].default)

    # ============================================================ S8 110–120 DER LETZTE TWIST
    shot(110.0, '8A OTS zurück zum Spiegel', (-1.02, -2.62, 1.66), (-0.05, 0.60, 1.40), 28, 3.4)
    cam.move(110.0, 112.4, loc=(-0.92, -2.42, 1.64))
    C.pose(E['turn_mirror'], 0.5, M(P_.F_SURPRISE, {'head': (3.0, 0.0, 0.0), 'pupil': (0.0, 0.0), 'pupil_s': 0.85, 'breath': 1.0}))
    D.pose(E['dark_in_mirror'] - 0.05, 0.0, M(P_.CHILL, P_.F_EVIL, {
        'vis': 1.0, 'root.loc': (0.30, -0.95, 0.0), 'root.rot': (0.0, 0.0, 180.0), 'hood': 0.0, 'breath': 1.0,
        'dark': 1.0, 'glow': 8.0, 'glitch': 0.8, 'head': (4.0, 6.0, 0.0), 'pupil': (0.0, 0.0)}))
    D.pose(E['dark_in_mirror'] + 0.45, 0.2, {'glitch': 0.0})
    C.pose(E['dark_in_mirror'] + 0.25, 0.12, M(P_.F_SHOCK, {'breath': 0.0}), 'snap')
    shot(E['dark_in_mirror'], '8B Er ist im Spiegel', (-0.95, -2.30, 1.62), (0.28, 0.55, 1.45), 32, 2.8)
    cam.move(E['dark_in_mirror'], E['lights_out'] + 0.5, loc=(-0.70, -1.95, 1.58), lens=42)
    D.pose(E['dark_raise'], 0.9, P_.PALM_UP_R, 'smoother')
    D.pose(E['dark_raise'] + 1.0, 0.25, {'fore_R': 70.0}); D.pose(E['dark_raise'] + 1.25, 0.25, {'fore_R': 95.0})
    D.pose(E['dark_raise'] + 1.5, 0.25, {'fore_R': 70.0})
    # Licht aus
    for k in LE:
        LE[k].set(E['lights_out'], 0.0)
    for k in ME:
        ME[k].set(E['lights_out'], 0.0)
    lamp.set(E['lights_out'], 0.0); bulb.set(E['lights_out'], 0.0); world.set(E['lights_out'], 0.0); shafts.set(E['lights_out'], 0.0)
    G['Portal'].set(E['lights_out'], 0.0)
    D.pose(E['lights_out'] + 0.3, 0.5, {'glow': 0.0})

    # Spiegelwelt nach dem Ausbruch: kühl und dunkel; Portal-Membran leise
    G['Portal'].to(70.0, 72.0, 0.03)
    G['Portal'].to(94.0, 96.0, 0.03)
    G['Portal'].to(E['push_in'] - 0.1, E['push_in'], 0.0, 'linear')
    G['Portal'].to(E['shadow_move'], E['shadow_move'] + 0.1, 0.03, 'linear')
    G['Portal'].to(112.3, 112.5, 0.07)
    for k in ('ceiling', 'window', 'fill'):
        ME[k].to(98.0, 99.5, ME[k].default * 0.5)
    MC['vanity'].to(99.0, 100.0, cold)
    MC['vanity'].to(112.3, 112.5, violet)
    ME['vanity'].to(112.3, 112.5, ME['vanity'].default * 2.2)
    LE['violet'].to(62.0, 64.0, 0.0)
    LE['violet'].to(112.3, 112.6, 120.0)
    LE['cyan'].to(60.0, 62.0, 18.0)
    LE['cyan'].to(94.0, 95.0, 6.0)
    LE['rim'].to(94.0, 95.0, 90.0)

    # ------------------------------------------------------------ Backen
    B = Baker()
    anim.bake_char(B, C, H['crackie'], V)
    anim.bake_char(B, D, H['dark'], V)
    anim.bake_char(B, S, H['shadow'], V)
    anim.bake_cam(B, cam, H['cam'])
    for k, o in H['lights'].items():
        anim.bake_track(B, o.data, 'energy', 0, LE[k])
        for i in range(3):
            anim.bake_track(B, o.data, 'color', i, LC[k], fn=lambda v, i=i: v[i])
    for k, o in H['mlights'].items():
        anim.bake_track(B, o.data, 'energy', 0, ME[k])
        for i in range(3):
            anim.bake_track(B, o.data, 'color', i, MC[k], fn=lambda v, i=i: v[i])
    anim.bake_track(B, H['mats']['lamp'].node_tree, 'nodes["Glow"].outputs[0].default_value', 0, lamp)
    anim.bake_track(B, H['mats']['bulb'].node_tree, 'nodes["Glow"].outputs[0].default_value', 0, bulb)
    anim.bake_track(B, H['world_bg'].id_data, 'nodes["Background"].inputs[1].default_value', 0, world)
    gnt = H['glass'].data.materials[0].node_tree
    for k, tr in G.items():
        anim.bake_track(B, gnt, f'nodes["{k}"].outputs[0].default_value', 0, tr)
    B.put(gnt, 'nodes["T"].outputs[0].default_value', 0, [ (f - 1) / FPS * 0.35 for f in range(1, FRAMES + 1)])
    if H.get('shaft_mat') is not None:
        for m in H['shaft_mat']:
            anim.bake_track(B, m.node_tree, 'nodes["Strength"].outputs[0].default_value', 0, shafts,
                            fn=lambda v, m=m: v * m['base'])
    n1 = B.write()

    # ------------------------------------------------------------ Effekte (brauchen Weltpositionen)
    n2 = bake_fx(H, C, D, S, G)
    meta = {'shots': shots, 'keys': n1 + n2}
    meta['censor'] = censor_boxes(H)
    if meta_path:
        json.dump(meta, open(meta_path, 'w'), indent=1)
    print(f'Keyframes: {n1 + n2}, Einstellungen: {len(shots)}')
    return meta


# ------------------------------------------------------------------ Effekte

def world_pos(obj, f, local=(0, 0, 0)):
    bpy.context.scene.frame_set(f)
    return obj.matrix_world @ Vector(local)


def bake_fx(H, C, D, S, G):
    sc = bpy.context.scene
    B = Baker()
    F = H['fx']
    f = lambda t: int(round(t * FPS)) + 1
    dark = H['dark'].obj
    crk = H['crackie'].obj
    # Handposition des Doppelgängers am Glas -> Ring/Risse
    hp = world_pos(dark['hand_R_open'], f(E['hand_glass'] + 0.05), (0, 0, -3 * V))
    gnt = H['glass'].data.materials[0].node_tree
    B.put(gnt, 'nodes["CrackX"].outputs[0].default_value', 0, [hp.x] * FRAMES)
    B.put(gnt, 'nodes["CrackZ"].outputs[0].default_value', 0, [hp.z] * FRAMES)
    rnd = random.Random(11)
    mx0, mx1 = (bath.MIR['x0'] - 0.5) * V, (bath.MIR['x1'] + 0.5) * V
    mz0, mz1 = (bath.MIR['z0'] - 0.5) * V, (bath.MIR['z1'] + 0.5) * V

    # 1) Portal-Partikel (S4/S5)
    pp = [(rnd.random(), rnd.random(), 0.9 + rnd.random() * 1.1, rnd.random() * 6.28, rnd.random()) for _ in F['portal'].objs]
    def portal_fn(i, t):
        u0, v0, life, ph, off = pp[i]
        tt = t - 43.2 + off * life
        k = int(tt // life); u = (tt % life) / life
        r2 = random.Random(i * 1000 + k)
        edge = r2.random() < 0.6
        x = mx0 + (mx1 - mx0) * r2.random(); z = mz0 + (mz1 - mz0) * r2.random()
        if edge:
            if r2.random() < 0.5:
                x = mx0 if r2.random() < 0.5 else mx1
            else:
                z = mz0 if r2.random() < 0.5 else mz1
        sp = 0.4 + r2.random() * 0.6
        a = ph + u * 5.0
        px = x + math.sin(a) * 0.06 * u
        pz = z + math.cos(a) * 0.06 * u + u * 0.15
        py = PL - 0.05 - u * sp
        s = (1 - u) ** 0.7 * (0.6 + 0.6 * r2.random())
        return (px, py, pz, a, a * 0.7, 0.0, s)
    F['portal'].bake(B, portal_fn, 43.2, 60.0)

    # 2) Glassplitter (Zeitlupe)
    sh = []
    for i, o in enumerate(F['shards'].objs):
        x = mx0 + (mx1 - mx0) * rnd.random(); z = mz0 + (mz1 - mz0) * rnd.random()
        dx, dz = x - hp.x, z - hp.z
        d = math.hypot(dx, dz) + 0.05
        v = (dx / d * (0.6 + rnd.random()), -(1.4 + rnd.random() * 2.4), dz / d * (0.5 + rnd.random()) + 0.8)
        sh.append(((x, PL - 0.01, z), v, rnd.random() * 10, rnd.random() * 10, 0.6 + rnd.random() * 0.9))
    def warp(t):
        t0 = E['breakthrough']
        if t < t0 + 2.0:
            return (t - t0) * 0.28
        return 0.56 + (t - t0 - 2.0)
    def shard_fn(i, t):
        p0, v, r1, r2, s = sh[i]
        tw = warp(t)
        p, rest = fx.ballistic(p0, v, tw, half=0.5 * V * s)
        spin = 0.0 if rest else tw
        return (p[0], p[1], p[2], r1 + spin * 7, r2 + spin * 5, spin * 3, s)
    F['shards'].bake(B, shard_fn, E['breakthrough'], 120.0)

    # 3) Landestaub
    dust_v = [(math.cos(a) * (0.6 + rnd.random()), math.sin(a) * (0.6 + rnd.random()), 0.3 + rnd.random() * 0.8)
              for a in [rnd.random() * 6.28 for _ in F['dust'].objs]]
    land = world_pos(dark['hips'], f(E['land'] + 0.05))
    def dust_fn(i, t):
        tt = t - E['land']
        if tt < 0 or tt > 1.4:
            return None
        v = dust_v[i]
        d = 1 - math.exp(-tt * 3)
        return (land.x + v[0] * d * 0.35, land.y + v[1] * d * 0.35, 0.03 + v[2] * d * 0.25 * (1.3 - tt),
                tt * 4, tt * 3, 0.0, (1.2 - tt) * 1.3)
    F['dust'].bake(B, dust_fn, E['land'], E['land'] + 1.5)

    # 4) Flaschen fliegen
    for i, o in enumerate(H['room']['bottles']):
        p0 = o['home']
        v = ((p0[0]) * 1.2 + (rnd.random() - 0.5) * 0.8, -(1.2 + rnd.random() * 1.4), 1.6 + rnd.random() * 1.4)
        rot = (rnd.random() - 0.5) * 18
        locs = np.zeros((FRAMES, 3)); rots = np.zeros((FRAMES, 3))
        for fi in range(FRAMES):
            t = fi / FPS
            tt = t - (E['bottles'] + i * 0.04)
            if tt <= 0:
                locs[fi] = p0
                continue
            p, rest = fx.ballistic(p0, v, tt, half=0.0)
            locs[fi] = p
            rots[fi] = (rot * min(tt, 0.7), rot * 0.6 * min(tt, 0.7), 0.0) if not rest else (math.pi / 2, 0.0, rot)
        for k in range(3):
            B.put(o, 'location', k, locs[:, k]); B.put(o, 'rotation_euler', k, rots[:, k])

    # 5) Handtuch in Crackies Hand (gegriffen bis zum Rutschen, dann fällt es)
    tw = H['room']['towel']
    tlocs = np.tile(np.array(tw['home']), (FRAMES, 1)); trots = np.zeros((FRAMES, 3))
    f0, f1 = f(E['towel']), f(E['double_slide'] + 0.2)
    last = None
    prev = None
    swing = Vector((0, 0, 0))
    for fr in range(f0, f1 + 1):
        sc.frame_set(fr)
        mw = crk['hand_R_fist'].matrix_world
        p = mw @ Vector((0.0, -0.5 * V, -2.5 * V))
        vel = (p - prev) * FPS if prev is not None else Vector((0, 0, 0))
        prev = p.copy()
        swing = swing.lerp(vel, 0.5)
        # Handtuch hängt nach unten und schleift der Handbewegung hinterher
        e = Vector((max(-1.3, min(1.3, swing.y * 0.35)), max(-1.3, min(1.3, -swing.x * 0.35)), 0.0))
        tlocs[fr - 1] = p; trots[fr - 1] = (e.x, e.y, e.z)
        last = (p, e)
    if last:
        p, e = last
        for fr in range(f1 + 1, FRAMES + 1):
            tt = (fr - f1) / FPS
            q, rest = fx.ballistic((p.x, p.y, p.z), (0.3, -0.4, 0.5), tt, half=0.0)
            tlocs[fr - 1] = q
            trots[fr - 1] = (e.x + (0 if rest else tt * 3), e.y, e.z) if not rest else (math.pi / 2, 0.0, e.z)
    for k in range(3):
        B.put(tw, 'location', k, tlocs[:, k]); B.put(tw, 'rotation_euler', k, trots[:, k])

    # 6) Zusammenstoß-Sterne
    col = (world_pos(crk['head'], f(E['collide']), (0, 0, 15 * V)) + world_pos(dark['head'], f(E['collide']), (0, 0, 15 * V))) / 2
    star_v = [(rnd.random() - 0.5, rnd.random() - 0.5, rnd.random() * 0.8 + 0.2) for _ in F['stars'].objs]
    def star_fn(i, t):
        tt = t - E['collide']
        if tt < 0 or tt > 0.9:
            return None
        v = star_v[i]
        return (col.x + v[0] * tt * 1.6, col.y + v[1] * tt * 1.6, col.z + v[2] * tt * 1.2 - 0.6 * tt * tt,
                tt * 8, tt * 6, 0.0, (1 - tt / 0.9) * 1.4)
    F['stars'].bake(B, star_fn, E['collide'], E['collide'] + 1.0)

    # 7) Rahmen-Explosion + ein Stück trifft Crackies Zahn
    fr_obj = H['frame']['MR']
    home = Vector(fr_obj['home'])
    hidef = f(E['frame_hit'])
    B.put(fr_obj, 'scale', 0, [1.0 if fi + 1 < hidef else 0.0 for fi in range(FRAMES)], 'CONSTANT')
    B.put(fr_obj, 'scale', 1, [1.0 if fi + 1 < hidef else 0.0 for fi in range(FRAMES)], 'CONSTANT')
    B.put(fr_obj, 'scale', 2, [1.0 if fi + 1 < hidef else 0.0 for fi in range(FRAMES)], 'CONSTANT')
    tooth = world_pos(crk['mouth_smirk'], f(89.6), (0, -1.0 * V, 0))
    deb = []
    for i in range(len(F['debris'].objs)):
        p0 = (home.x + (rnd.random() - 0.5) * 0.08, home.y - 0.04, mz0 + rnd.random() * (mz1 - mz0))
        v = ((rnd.random() - 0.2) * 1.8, -(0.8 + rnd.random() * 2.2), rnd.random() * 2.0)
        deb.append((p0, v, rnd.random() * 9))
    def deb_fn(i, t):
        tt = t - E['frame_hit']
        if tt < 0:
            return None
        p0, v, r0 = deb[i]
        if i == 0:   # das Stück, das den Zahn trifft
            hit = 0.6
            if tt <= hit:
                u = tt / hit
                q = Vector(p0).lerp(tooth, u) + Vector((0, 0, math.sin(u * math.pi) * 0.12))
                return (q.x, q.y, q.z, tt * 12, tt * 9, 0.0, 1.2)
            p, rest = fx.ballistic((tooth.x, tooth.y, tooth.z), (0.2, -0.6, 0.6), tt - hit)
            return (p[0], p[1], p[2], 0.0 if rest else tt * 9, 0.0, 0.0, 1.2)
        p, rest = fx.ballistic(p0, v, tt)
        sp = 0.0 if rest else tt
        return (p[0], p[1], p[2], r0 + sp * 9, r0 + sp * 7, sp * 4, 1.0)
    F['debris'].bake(B, deb_fn, E['frame_hit'], 120.0)

    # 8) Oberes rechtes Rahmenstück fällt auf den Kopf des Doppelgängers
    tr_obj = H['frame']['TR']
    th = Vector(tr_obj['home'])
    dhead = world_pos(dark['head'], f(E['bonk']), (0, 0, 32 * V))
    locs = np.tile(np.array(th), (FRAMES, 1)); rots = np.zeros((FRAMES, 3))
    for fi in range(FRAMES):
        t = fi / FPS
        tt = t - E['chunk_fall']
        if tt <= 0:
            continue
        T1 = E['bonk'] - E['chunk_fall']
        if tt <= T1:
            u = tt / T1
            q = th.lerp(dhead, u)
            q.z = th.z + (dhead.z - th.z) * u * u
            locs[fi] = q; rots[fi] = (-u * 1.4, 0.0, u * 0.6)
        else:
            p, rest = fx.ballistic((dhead.x, dhead.y, dhead.z), (0.5, -0.5, 1.4), tt - T1, half=0.03)
            locs[fi] = p
            rots[fi] = (-1.4 - (0 if rest else (tt - T1) * 6), 0.0, 0.6) if not rest else (-math.pi / 2, 0.0, 0.6)
    for k in range(3):
        B.put(tr_obj, 'location', k, locs[:, k]); B.put(tr_obj, 'rotation_euler', k, rots[:, k])

    # 9) K.O.-Sterne kreisen um den Kopf
    ko_head = world_pos(dark['head'], f(E['ko'] + 0.8), (0, 0, 10 * V))
    def ko_fn(i, t):
        if t < E['ko'] + 0.5 or t > 98.9:
            return None
        a = t * 4.0 + i * (2 * math.pi / len(F['kostars'].objs))
        return (ko_head.x + math.cos(a) * 0.22, ko_head.y + math.sin(a) * 0.22, ko_head.z + 0.22 + 0.04 * math.sin(a * 2),
                0.0, 0.0, a, 1.3)
    F['kostars'].bake(B, ko_fn, E['ko'], 99.0)

    # 10) Glitch-Würfel um den Doppelgänger
    def glitch_fn(i, t):
        g = D.value('glitch', t)
        if g <= 0.02 or D.value('vis', t) < 0.5:
            return None
        r2 = random.Random(int(t * FPS) * 131 + i * 7)
        if r2.random() > g:
            return None
        rl = D.value('root.loc', t)
        wx, wy, wz = rl[0], 2 * PL - rl[1], rl[2]
        return (wx + (r2.random() - 0.5) * 0.7, wy + (r2.random() - 0.5) * 0.5, wz + 0.2 + r2.random() * 1.7,
                0.0, 0.0, 0.0, 0.6 + r2.random() * 1.2)
    F['glitch'].bake(B, glitch_fn, 0.0, 120.0)

    # 11) Staubpartikel im Fensterlicht (immer)
    mp = [(rnd.random(), rnd.random(), rnd.random(), rnd.random() * 6.28) for _ in F['motes'].objs]
    def mote_fn(i, t):
        a, b, c, ph = mp[i]
        if t >= E['lights_out']:
            return None
        x = 0.2 + a * 1.3 + 0.05 * math.sin(t * 0.3 + ph)
        y = -1.6 + b * 1.4 + 0.05 * math.cos(t * 0.27 + ph)
        z = 0.3 + ((c * 2.2 + t * 0.02) % 2.2)
        return (x, y, z, t * 0.2 + ph, t * 0.3, 0.0, 1.0)
    F['motes'].bake(B, mote_fn, 0.0, 120.0)

    # 12) Violette Schatten-Augen an der Wand (Projektion des Schattenkopfs)
    L = H['lights']['shadow']
    lp = L.location.copy()
    eyes = H['shadow_eyes']
    sh_obj = H['shadow'].obj['head']
    arrs = {o: np.zeros((FRAMES, 4)) for o in eyes}
    for fr in range(f(E['shadow_move'] + 0.3), f(108.2) + 1):
        sc.frame_set(fr)
        for o, side in zip(eyes, (1, -1)):
            p = sh_obj.matrix_world @ Vector((side * 5 * V, 0.0, (52 - 36) * V))
            d = p - lp
            if abs(d.y) < 1e-6:
                continue
            k = (PL - 0.001 - lp.y) / d.y
            q = lp + d * k
            arrs[o][fr - 1] = (q.x, q.y - 0.003, q.z, 1.0)
    for o, a in arrs.items():
        for k in range(3):
            B.put(o, 'location', k, a[:, k])
            B.put(o, 'scale', k, a[:, 3], 'CONSTANT')
    return B.write()


def censor_boxes(H):
    """Bildschirm-Rechteck des Mittelfingers (für die Verpixelung in der Nachbearbeitung)."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    cam = H['cam']
    o = H['dark'].obj['hand_R_finger']
    out = {}
    for fr in range(int(E['finger'] * FPS) + 1, int((E['finger_end'] + 0.5) * FPS) + 2):
        sc.frame_set(fr)
        if o.matrix_world.to_scale().length < 0.01:
            continue
        pts = [world_to_camera_view(sc, cam, o.matrix_world @ Vector(c)) for c in o.bound_box]
        xs = [p.x for p in pts if p.z > 0]; ys = [p.y for p in pts if p.z > 0]
        if xs:
            out[fr] = (min(xs), min(ys), max(xs), max(ys))
    return out
