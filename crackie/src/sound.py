"""Sounddesign + Musik – komplett selbst synthetisiert (numpy/scipy), keine fremden Samples.
Stimmen kommen aus tts.py (Piper, eigene Erzeugung).

    python sound.py <voice_dir> <out_dir>
Erzeugt: music.wav, sfx.wav, voice.wav, mix.wav (48 kHz Stereo, 120 s) und cues.json
"""
import json, os, sys, wave
import numpy as np
from scipy import signal
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import EV as E, LINES, DURATION

SR = 48000
N = int(SR * DURATION)
rng = np.random.default_rng(7)


def tl(sec):
    return np.arange(int(sec * SR)) / SR


def env_adsr(n, a=0.005, d=0.1, s=0.6, r=0.2, sus_time=None):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n) if sus_time is None else int(sus_time * SR)
    e = np.concatenate([np.linspace(0, 1, max(a_n, 1)), np.linspace(1, s, max(d_n, 1)),
                        np.full(s_n, s), np.linspace(s, 0, max(r_n, 1))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc / (SR / 2), 0.99), 'low')
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, min(fc / (SR / 2), 0.99), 'high')
    return signal.lfilter(b, a, x)


def bp(x, f1, f2, order=2):
    b, a = signal.butter(order, [f1 / (SR / 2), min(f2 / (SR / 2), 0.99)], 'band')
    return signal.lfilter(b, a, x)


def noise(sec):
    return rng.standard_normal(int(sec * SR))


def reverb_ir(sec=2.0, decay=3.0, bright=6000):
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-decay * t)[:, None]
    ir[:, 0] = lp(ir[:, 0], bright); ir[:, 1] = lp(ir[:, 1], bright)
    ir[0] = 1.0
    return ir / np.abs(ir).sum(axis=0).max() * 8


def reverb(x, wet=0.25, sec=2.0, decay=3.0):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    ir = reverb_ir(sec, decay)
    y = np.stack([signal.fftconvolve(x[:, i], ir[:, i])[:len(x)] for i in range(2)], 1)
    return x * (1 - wet) + y * wet


class Bus:
    def __init__(self):
        self.b = np.zeros((N, 2))

    def add(self, sig, t, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
        i0 = int(t * SR)
        if i0 >= N:
            return
        if i0 < 0:
            sig = sig[-i0:]; i0 = 0
        n = min(len(sig), N - i0)
        self.b[i0:i0 + n] += sig[:n] * gain


# ------------------------------------------------------------------ Instrumente

def kick(dur=0.45, f0=110, f1=42, drive=1.5):
    t = tl(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7)
    x += noise(dur) * np.exp(-t * 90) * 0.08
    return np.tanh(x * drive)


def snare(dur=0.25, tone=185, bright=5000, amt=0.7):
    t = tl(dur)
    n = bp(noise(dur), 900, bright) * np.exp(-t * 18) * amt
    s = np.sin(2 * np.pi * tone * t) * np.exp(-t * 28) * 0.6
    return n + s


def hat(dur=0.06, open_=False):
    d = 0.28 if open_ else dur
    t = tl(d)
    return hp(noise(d), 7000) * np.exp(-t * (14 if open_ else 70)) * 0.35


def rhodes(freq, dur, vel=0.5):
    t = tl(dur)
    mod = np.sin(2 * np.pi * freq * t) * (2.2 * np.exp(-t * 6))
    x = np.sin(2 * np.pi * freq * t + mod) * 0.6 + np.sin(2 * np.pi * freq * 2 * t) * 0.12 * np.exp(-t * 3)
    x *= env_adsr(len(t), 0.004, 0.6, 0.35, 0.3)
    return x * vel * (1 + 0.15 * np.sin(2 * np.pi * 4.5 * t))


def saw(freq, dur, detune=0.0, wobble=None):
    t = tl(dur)
    f = freq * (1 + detune)
    if wobble is not None:
        f = f * (1 + wobble[:len(t)])
        ph = np.cumsum(f) / SR
    else:
        ph = f * t
    return 2 * (ph % 1.0) - 1


def pad(freqs, dur, cutoff=1400, amp=0.12):
    x = sum(saw(f, dur, d) for f in freqs for d in (-0.004, 0.0, 0.005))
    x = lp(x, cutoff, 2) * env_adsr(int(dur * SR), 0.6, 0.4, 0.8, 0.8) * amp
    return x


def sub(freq, dur, amp=0.5, glide_to=None):
    t = tl(dur)
    f = np.full(len(t), freq) if glide_to is None else freq * (glide_to / freq) ** np.clip(t / dur * 3, 0, 1)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return np.tanh(x * 1.6) * env_adsr(len(t), 0.005, 0.1, 0.8, 0.08) * amp


def cowbell(freq, dur=0.25):
    t = tl(dur)
    x = (np.sign(np.sin(2 * np.pi * freq * t)) + np.sign(np.sin(2 * np.pi * freq * 1.48 * t))) * 0.5
    return bp(x, freq * 0.8, freq * 4) * np.exp(-t * 11) * 0.5


def square(freq, dur, duty=0.5, amp=0.25):
    t = tl(dur)
    x = np.where((freq * t) % 1.0 < duty, 1.0, -1.0)
    return x * env_adsr(len(t), 0.003, 0.05, 0.7, 0.04) * amp


def musicbox(freq, dur=1.2):
    t = tl(dur)
    x = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 4.02 * t) * np.exp(-t * 6)
    return x * np.exp(-t * 3.2) * 0.35


def note(n):
    """MIDI -> Hz"""
    return 440.0 * 2 ** ((n - 69) / 12)


# ------------------------------------------------------------------ Geräusche

def whoosh(dur=0.5, f0=400, f1=2500, amp=0.5):
    x = noise(dur)
    t = tl(dur)
    fc = f0 + (f1 - f0) * np.sin(np.pi * t / dur)
    y = np.zeros_like(x)
    for i in range(0, len(x), 512):
        seg = x[max(0, i - 2048):i + 512]
        y[i:i + 512] = bp(seg, max(60, fc[i] * 0.5), fc[i] * 1.5)[-len(y[i:i + 512]):]
    return y * np.sin(np.pi * t / dur) ** 2 * amp


def thud(dur=0.4, f=70, amp=0.9):
    t = tl(dur)
    return (np.sin(2 * np.pi * f * t * (1 - t)) * np.exp(-t * 12) + lp(noise(dur), 400) * np.exp(-t * 30) * 0.5) * amp


def boom(dur=3.0, amp=1.0):
    t = tl(dur)
    f = 28 + 60 * np.exp(-t * 3)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.3)
    x += lp(noise(dur), 300) * np.exp(-t * 4) * 0.6
    return np.tanh(x * 1.8) * amp


def glitch(dur=0.35, amp=0.45):
    x = np.zeros(int(dur * SR))
    i = 0
    while i < len(x):
        L = rng.integers(200, 2400)
        kind = rng.integers(0, 3)
        t = np.arange(L) / SR
        if kind == 0:
            seg = np.sign(np.sin(2 * np.pi * rng.uniform(80, 1800) * t))
        elif kind == 1:
            seg = rng.standard_normal(L)
        else:
            seg = np.round(np.sin(2 * np.pi * rng.uniform(200, 900) * t) * 3) / 3
        x[i:i + L] = seg[:len(x[i:i + L])] * rng.uniform(0.3, 1.0)
        i += L + rng.integers(0, 800)
    return hp(x, 120) * amp


def glass_crack(dur=0.6, amp=0.7):
    t = tl(dur)
    x = np.zeros(len(t))
    for _ in range(45):
        p = int(rng.uniform(0, 0.4) ** 1.5 * SR)
        L = int(rng.uniform(0.002, 0.02) * SR)
        if p + L < len(x):
            x[p:p + L] += hp(rng.standard_normal(L), 3000) * rng.uniform(0.3, 1)
    return x * amp + np.sin(2 * np.pi * 2900 * t) * np.exp(-t * 20) * 0.05


def shatter(dur=2.5, amp=0.9, slow=1.0):
    t = tl(dur)
    x = np.zeros(len(t))
    for _ in range(220):
        p = int(rng.exponential(0.25 * slow) * SR)
        f = rng.uniform(2500, 9000) / slow
        L = int(rng.uniform(0.02, 0.15) * SR * slow)
        if p + L < len(x):
            tt = np.arange(L) / SR
            x[p:p + L] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 40 / slow) * rng.uniform(0.1, 0.5)
    x += hp(noise(dur), 2000 / slow) * np.exp(-t * 4 / slow) * 0.5
    return x * amp


def squeak(dur=0.35, f0=1400, f1=2300, amp=0.35):
    t = tl(dur)
    f = f0 + (f1 - f0) * (t / dur) + 120 * np.sin(2 * np.pi * 30 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    x = np.tanh(x * 3) * np.sin(np.pi * t / dur)
    return bp(x, 800, 5000) * amp


def bonk(f=520, amp=0.8):
    t = tl(0.5)
    fr = f * (1 + 0.6 * np.exp(-t * 30))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 9)
    x += np.sin(2 * np.pi * np.cumsum(fr * 2.7) / SR) * np.exp(-t * 18) * 0.4
    return x * amp


def boing(amp=0.5):
    t = tl(0.7)
    f = 220 * (1 + 0.5 * np.sin(2 * np.pi * 12 * t) * np.exp(-t * 4)) * (1 + t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4) * amp


def ding(f=1760, amp=0.4, dur=1.4):
    t = tl(dur)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4)) * np.exp(-t * 3) * amp


def scratch(amp=0.6):
    t = tl(0.55)
    f = 400 * (1 + 2 * np.sin(2 * np.pi * 3.2 * t))
    x = np.sign(np.sin(2 * np.pi * np.cumsum(np.abs(f)) / SR)) * 0.4 + bp(noise(0.55), 300, 3000) * 0.6
    return x * np.sin(np.pi * t / 0.55) * amp


def heartbeat(amp=0.8):
    a = thud(0.25, 55, 1.0); b = thud(0.25, 48, 0.7)
    x = np.zeros(int(0.7 * SR)); x[:len(a)] += a; x[int(0.18 * SR):int(0.18 * SR) + len(b)] += b
    return lp(x, 160) * amp


def riser(dur=2.0, amp=0.5, reverse_cym=True):
    t = tl(dur)
    x = hp(noise(dur), 1500) * (t / dur) ** 3
    f = 200 + 1800 * (t / dur) ** 2
    x += np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 2 * 0.3
    return x * amp


def tweet(amp=0.25):
    out = np.zeros(int(1.2 * SR))
    for k in range(4):
        t = tl(0.12)
        f = 3200 + 1200 * np.sin(np.pi * t / 0.12)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.12)
        i = int(k * 0.27 * SR)
        out[i:i + len(s)] += s
    return out * amp


def step(amp=0.4):
    t = tl(0.12)
    return (lp(noise(0.12), 900) * np.exp(-t * 45) + np.sin(2 * np.pi * 95 * t) * np.exp(-t * 30) * 0.5) * amp


def cloth(dur=0.35, amp=0.25):
    t = tl(dur)
    return bp(noise(dur), 1500, 6000) * np.sin(np.pi * t / dur) ** 2 * amp * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 9 * t)))


def bubbles(dur=1.6, amp=0.3):
    x = np.zeros(int(dur * SR))
    for _ in range(26):
        p = int(rng.uniform(0, dur - 0.1) * SR)
        f0 = rng.uniform(500, 1400)
        t = tl(0.07)
        s = np.sin(2 * np.pi * np.cumsum(f0 * (1 + t * 12)) / SR) * np.exp(-t * 50)
        x[p:p + len(s)] += s * rng.uniform(0.3, 1)
    return x * amp


def beep(dur=0.55, amp=0.35):
    t = tl(dur)
    return np.sin(2 * np.pi * 1000 * t) * env_adsr(len(t), 0.005, 0.01, 1.0, 0.01) * amp


def tape_stop(x, dur):
    """Verlangsamt das Ende eines Signals bis zum Stillstand."""
    n = int(dur * SR)
    seg = x[-n:] if len(x) >= n else x
    speed = np.linspace(1, 0, len(seg)) ** 1.3
    pos = np.cumsum(speed)
    pos = pos / pos[-1] * (len(seg) - 1) * 0.5
    return np.interp(pos, np.arange(len(seg)), seg)


# ------------------------------------------------------------------ Musik

def music():
    mus = Bus()
    # --- Lo-Fi (0 – 38,6 s), 82 BPM, wird zunehmend schief
    bpm = 82; beat = 60 / bpm; bar = 4 * beat
    chords_maj = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]   # Fmaj7 Em7 Dm7 Cmaj7
    chords_min = [[50, 53, 57, 60], [46, 50, 53, 57], [43, 46, 50, 53], [45, 49, 52, 55]]   # Dm7 Bbmaj7 Gm7 A7
    t = 0.0; k = 0
    while t < E['serious']:
        ch = (chords_min if t >= E['refl_laugh'] else chords_maj)[k % 4]
        wob = min(1.0, max(0.0, (t - 10) / 28))
        dur = min(bar, E['serious'] - t)
        for i, n_ in enumerate(ch):
            fq = note(n_) * (1 + wob * 0.012 * np.sin(t * 1.7 + i))
            mus.add(rhodes(fq, dur + 0.4, 0.22), t + i * 0.012, 1.0, -0.3 + 0.2 * i)
        mus.add(sub(note(ch[0] - 12), dur * 0.9, 0.32), t)
        for bt in range(4):
            tb = t + bt * beat
            if tb >= E['serious']:
                break
            if t > 1.5:                          # Beat setzt nach dem Hook ein
                if bt in (0, 2):
                    mus.add(kick(0.4, 95, 45, 1.2), tb, 0.55)
                if bt in (1, 3):
                    mus.add(snare(0.2, 190, 3500, 0.5), tb + 0.02, 0.3)
                for h in range(2):
                    mus.add(hat(), tb + h * beat / 2 + (0.03 if h else 0), 0.35)
        t += bar; k += 1
    # Vinyl-Knistern
    cr = np.zeros(int(E['serious'] * SR))
    idx = rng.integers(0, len(cr), 900)
    cr[idx] = rng.uniform(-1, 1, len(idx))
    mus.add(hp(cr, 2000) * 0.22 + lp(noise(E['serious']), 300) * 0.006, 0.0)
    # --- Ernst (38,6): Stille + Drone
    mus.add(boom(2.5, 0.55), E['serious'])
    dr = pad([note(38), note(45), note(50)], 20.0, 500, 0.10)
    dr *= np.linspace(0.3, 1.0, len(dr))
    mus.add(dr, E['eyes_glow'])
    mus.add(riser(E['breakthrough'] - 52.0, 0.4), 52.0)
    for hb in np.arange(50.6, 54.0, 0.62):
        mus.add(heartbeat(0.7), hb)
    # --- Durchbruch: Boom + langsamer Nachhall
    mus.add(reverb(boom(4.0, 1.0), 0.4, 3.0, 1.5), E['breakthrough'])
    # --- Dunkler Synth (58 – 75), 100 BPM, d-Moll
    bpm2 = 100; b2 = 60 / bpm2
    prog = [(38, [50, 53, 57]), (34, [46, 50, 53]), (36, [48, 52, 55]), (33, [45, 49, 52])]
    t = 58.0; k = 0
    while t < 75.0:
        root, triad = prog[k % 4]
        L = min(4 * b2 * 2, 75.0 - t)
        mus.add(pad([note(n_) for n_ in triad], L + 0.6, 1100, 0.07), t, 1.0, 0.1)
        for e8 in range(int(L / (b2 / 2))):
            mus.add(sub(note(root), b2 / 2 * 0.8, 0.30), t + e8 * b2 / 2)
        t += L; k += 1
    for tt in (E['land'], 66.4, 67.6, 72.0):
        mus.add(thud(0.6, 60, 0.8), tt)
    # --- Kampf-Beat (75 – 92,3), 140 BPM, Phonk-artig mit Kuhglocke
    bpm3 = 140; b3 = 60 / bpm3
    melody = [74, 74, 77, 74, 72, 74, 69, 72]
    t = 75.0; k = 0
    while t < E['ko']:
        slow = E['windup'] <= t < E['frame_hit']
        if not slow:
            if k % 4 == 0:
                mus.add(sub(note(38), b3 * 1.8, 0.45, glide_to=note(36)), t)
                mus.add(kick(0.35, 130, 48, 2.2), t, 0.7)
            if k % 4 == 2:
                mus.add(kick(0.35, 130, 48, 2.2), t, 0.55)
            if k % 8 == 4:
                mus.add(snare(0.22, 200, 7000, 0.9), t, 0.5)
            mus.add(hat(0.04), t, 0.28); mus.add(hat(0.03), t + b3 / 2, 0.18)
            if k % 2 == 0:
                mus.add(cowbell(note(melody[(k // 2) % 8]), 0.22), t, 0.32, 0.25)
        t += b3 / 2 * 2; k += 1
    # Zeitlupe: tiefer Ton + Tape-Stop beim K.O.
    mus.add(pad([note(26), note(33)], E['frame_hit'] - E['windup'], 300, 0.25), E['windup'])
    mus.add(whoosh(1.4, 120, 600, 0.6), E['windup'] + 0.2)
    i0, i1 = int((E['ko'] - 0.8) * SR), int(E['ko'] * SR)
    mus.b[i0:i1, 0] = tape_stop(mus.b[i0 - int(0.8 * SR):i1, 0], 0.8)[:i1 - i0]
    mus.b[i0:i1, 1] = tape_stop(mus.b[i0 - int(0.8 * SR):i1, 1], 0.8)[:i1 - i0]
    mus.b[i1:int(94.0 * SR)] *= 0.0
    # --- Sieg-Jingle (8-Bit)
    fan = [(72, 0.12), (76, 0.12), (79, 0.12), (84, 0.36), (79, 0.12), (84, 0.5)]
    t = E['proud']
    for n_, d in fan:
        mus.add(square(note(n_), d, 0.25, 0.18), t); mus.add(square(note(n_ - 12), d, 0.5, 0.10), t)
        t += d
    # entspannter Beat kurz zurück
    t = 95.6
    while t < 98.2:
        mus.add(rhodes(note(65), 0.9, 0.18), t); mus.add(rhodes(note(69), 0.9, 0.14), t + 0.01)
        mus.add(kick(0.35, 95, 45, 1.1), t, 0.4)
        t += 60 / 82 * 2
    # --- Unheimlich (98,2 – 115,6)
    mus.add(boom(2.0, 0.6), E['empty'])
    dr2 = pad([note(37), note(44), note(49)], E['lights_out'] - 98.4, 420, 0.11)
    dr2 *= np.linspace(0.5, 1.2, len(dr2))
    mus.add(dr2, 98.4)
    box = [76, 79, 75, 74, 76, 72, 71, 72]
    for i, n_ in enumerate(box):
        mus.add(musicbox(note(n_) * (1 + 0.01 * np.sin(i)), 1.4), E['shadow_move'] + i * 0.62, 0.8, 0.3)
    for hb in np.arange(E['eyes_wide'], E['lights_out'], 0.75):
        mus.add(heartbeat(0.55), hb)
    mus.add(riser(E['lights_out'] - E['dark_raise'], 0.35), E['dark_raise'])
    # --- Ende
    mus.add(reverb(boom(3.5, 1.0), 0.45, 3.0, 1.4), E['end_text'])
    for i, n_ in enumerate([69, 72, 76, 75, 74, 72, 71, 69]):
        mus.add(reverb(musicbox(note(n_), 1.6), 0.4, 2.0, 2.0)[:, 0], E['end_text'] + 0.4 + i * 0.42, 0.7)
    return mus.b


def sfx():
    s = Bus()
    s.add(glitch(0.5, 0.6), E['open_glitch'])
    s.add(whoosh(0.25, 1500, 5000, 0.3), E['hook_eye_flick'] - 0.05)
    s.add(ding(2637, 0.15, 0.4), E['hook_eye_flick'])
    s.add(cloth(0.5, 0.3), E['raise_hand']); s.add(cloth(0.4, 0.2), E['lower_hand'])
    s.add(ding(1318, 0.12, 2.0), E['refl_smile'])
    s.add(cloth(0.5, 0.25), E['look_back'])
    s.add(ding(2093, 0.35, 1.2), E['wink']); s.add(ding(3136, 0.2, 0.8), E['wink'] + 0.05)
    s.add(scratch(0.55), E['freeze'])
    s.add(whoosh(0.35, 500, 2000, 0.3), E['head_turn'])
    s.add(ding(311, 0.25, 2.5), E['head_turn'] + 0.4)          # schiefer Ton
    s.add(boing(0.25), E['brows_up'])
    s.add(cloth(0.4, 0.22), E['point_self'])
    s.add(ding(233, 0.3, 2.5), E['refl_point'])
    s.add(glitch(0.15, 0.25), E['refl_grin'])
    for i in range(2):
        s.add(step(0.45), E['step_back'] + 0.1 + i * 0.3)
    s.add(cloth(0.5, 0.25), E['cross_arms'])
    s.add(beep(0.62, 0.30), E['finger'] + 0.05)
    s.add(boom(1.4, 0.4), E['serious'])
    t = tl(1.5); s.add(np.sin(2 * np.pi * (300 + 900 * t / 1.5) * t) * 0.12 * np.sin(np.pi * t / 1.5), E['eyes_glow'])
    # S4
    rum = lp(noise(3.8), 120) * 2.4 + np.sin(2 * np.pi * 32 * tl(3.8)) * 0.35
    s.add(rum * np.minimum(1, tl(3.8) / 0.3), E['vibrate'], 0.8)
    for i in range(24):
        s.add(hp(noise(0.02), 2500) * 0.3, E['vibrate'] + 0.1 + i * 0.13 + rng.uniform(0, 0.05), 1.0, rng.uniform(-0.6, 0.6))
    for i in range(14):
        s.add(ding(rng.uniform(2500, 5000), 0.06, 0.4), E['particles'] + i * 0.2, 1.0, rng.uniform(-0.7, 0.7))
    s.add(bubbles(2.0, 0.35), E['liquid'])
    s.add(thud(0.3, 90, 0.7), E['hand_glass']); s.add(bubbles(0.8, 0.25), E['hand_glass'] + 0.05)
    s.add(glass_crack(0.7, 0.8), E['crack']); s.add(glass_crack(0.5, 0.5), E['crack'] + 0.5)
    s.add(riser(1.0, 0.4), E['breakthrough'] - 1.0)
    s.add(reverb(shatter(3.0, 1.0, 2.2), 0.35, 2.5, 1.8), E['breakthrough'])
    s.add(whoosh(0.8, 200, 1200, 0.5), E['hand_out'])
    # S5
    for i in range(4):
        s.add(step(0.35), E['step_out'] + 0.3 + i * 0.4)
    s.add(whoosh(0.5, 300, 1500, 0.4), 60.6)
    s.add(thud(0.6, 50, 1.0), E['land']); s.add(boom(1.2, 0.5), E['land'])
    s.add(cloth(0.6, 0.35), E['hood_back'])
    s.add(glitch(0.25, 0.35), E['dark_grin'])
    s.add(cloth(0.4, 0.2), E['mimic'])
    # S6
    s.add(whoosh(0.4, 400, 2500, 0.5), E['lunge'])
    for i in range(5):
        s.add(step(0.45), E['lunge'] + 0.3 + i * 0.25)
    s.add(whoosh(0.3, 800, 4000, 0.5), E['sidestep'])
    s.add(squeak(0.5, 1300, 2600, 0.45), E['slide'])
    s.add(thud(0.4, 80, 1.0), 79.2)
    for i in range(5):
        s.add(bonk(rng.uniform(500, 900), 0.35), E['bottles'] + 0.3 + i * 0.17, 1.0, rng.uniform(-0.7, 0.7))
    s.add(whoosh(0.5, 300, 2500, 0.5), E['jump_sink']); s.add(thud(0.4, 70, 0.8), 81.4)
    s.add(cloth(0.4, 0.4), E['towel'])
    t = tl(0.08); s.add(hp(noise(0.08), 1500) * np.exp(-t * 60) * 1.2, E['towel_hit'])
    s.add(thud(0.3, 110, 0.6), E['towel_hit'] + 0.02)
    s.add(squeak(0.9, 1100, 1900, 0.4), E['double_slide'], 1.0, -0.4)
    s.add(squeak(0.9, 1500, 2400, 0.35), E['double_slide'] + 0.1, 1.0, 0.4)
    s.add(bonk(400, 0.9), E['collide']); s.add(boing(0.4), E['collide'] + 0.1)
    s.add(whoosh(0.5, 200, 1800, 0.5), E['duck'])
    s.add(thud(0.5, 60, 1.0), E['frame_hit'])
    s.add(reverb(shatter(1.5, 0.6, 1.0), 0.2), E['frame_hit'])
    for i in range(10):
        s.add(bonk(rng.uniform(250, 600), 0.2), E['frame_hit'] + 0.3 + i * 0.09, 1.0, rng.uniform(-0.8, 0.8))
    s.add(ding(3800, 0.4, 0.6), 89.6)
    t = tl(0.6); s.add(np.sin(2 * np.pi * (1800 - 1300 * t / 0.6) * t) * 0.12, E['chunk_fall'])
    s.add(bonk(300, 1.0), E['bonk']); s.add(boing(0.5), E['bonk'] + 0.05)
    s.add(thud(0.7, 45, 1.0), E['ko'] + 0.55)
    s.add(tweet(0.2), E['ko'] + 0.9); s.add(tweet(0.15), E['ko'] + 2.1)
    # S7
    s.add(cloth(0.5, 0.3), E['proud'])
    s.add(boom(1.0, 0.4), E['empty'])
    for i in range(2):
        s.add(step(0.3), 99.95 + i * 0.4)
    s.add(whoosh(1.8, 100, 700, 0.35), E['shadow_move'])
    # S8
    s.add(cloth(0.5, 0.25), E['turn_mirror'])
    s.add(glitch(0.5, 0.5), E['dark_in_mirror'])
    s.add(ding(155, 0.35, 3.0), E['dark_in_mirror'] + 0.05)
    t = tl(0.05); s.add(np.exp(-t * 200) * 0.8 * hp(noise(0.05), 800), E['lights_out'])
    t = tl(0.9); s.add(np.sin(2 * np.pi * (120 - 80 * t / 0.9) * t) * np.exp(-t * 3) * 0.3, E['lights_out'] + 0.02)
    t = tl(1.2); s.add(sum(ding(f, 0.12, 1.2) for f in (2093, 2637, 3136)), E['end_logo'])
    # Raumton + tropfender Wasserhahn
    s.add(lp(noise(DURATION), 220) * 0.012, 0.0)
    for td in np.arange(2.0, 40.0, 3.7):
        s.add(ding(1900 + rng.uniform(-200, 200), 0.05, 0.25), td, 1.0, 0.3)
    return s.b


def load_wav(path):
    with wave.open(path) as w:
        sr = w.getframerate(); ch = w.getnchannels()
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    a = a.reshape(-1, ch)
    if ch == 1:
        a = np.repeat(a, 2, axis=1)
    if sr != SR:
        a = signal.resample_poly(a, SR, sr, axis=0)
    return a


def voices(voice_dir):
    v = Bus()
    used = []
    for ln in LINES:
        p = os.path.join(voice_dir, ln['id'] + '.wav')
        a = load_wav(p)
        pan = {'erzaehler': 0.0, 'crackie': -0.08, 'dunkel': 0.12}[ln['who']]
        g = {'erzaehler': 1.0, 'crackie': 1.0, 'dunkel': 1.05}[ln['who']]
        if ln['who'] == 'erzaehler':
            a = reverb(a, 0.12, 1.2, 4.0)
        v.add(a, ln['t'], g, 0.0 if pan == 0 else 0.0)
        used.append((ln['id'], ln['t'], len(a) / SR))
    # Lachen des Doppelgängers: Crackies Lachen tiefer und hallig (eigene TTS-Aufnahme)
    lp_ = load_wav(os.path.join(voice_dir, 's8_laugh.wav'))
    dark_laugh = signal.resample_poly(lp_, 5, 4, axis=0)            # tiefer + langsamer
    dark_laugh = reverb(dark_laugh, 0.35, 1.6, 2.5)
    for tt, g in ((E['refl_laugh'] + 0.1, 0.55), (E['laugh_harder'], 0.7), (E['laugh_behind'], 0.9)):
        v.add(dark_laugh, tt, g)
        used.append(('dark_laugh', tt, len(dark_laugh) / SR))
    return v.b, used


def main():
    voice_dir, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    mu = music(); fxb = sfx(); vo, used = voices(voice_dir)
    # Ducking: Musik leiser, wenn gesprochen wird
    env = np.abs(vo).max(axis=1)
    k = int(0.25 * SR)
    env = np.convolve(env, np.ones(k) / k, mode='same')
    env = np.clip(env / 0.08, 0, 1)
    duck = 1 - 0.55 * env
    mix = mu * 0.75 * duck[:, None] + fxb * 0.9 + vo * 1.0
    peak = np.abs(mix).max()
    mix = mix / max(peak, 1e-6) * 0.89
    for name, buf in (('music', mu), ('sfx', fxb), ('voice', vo), ('mix', mix)):
        b = buf / max(np.abs(buf).max(), 1e-6) * 0.89 if name != 'mix' else buf
        with wave.open(os.path.join(out, name + '.wav'), 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(b, -1, 1) * 32767).astype(np.int16).tobytes())
    json.dump({'voice': used, 'peak_before_norm': float(peak)}, open(os.path.join(out, 'cues.json'), 'w'), indent=1)
    print('Audio fertig:', out)


if __name__ == '__main__':
    main()
