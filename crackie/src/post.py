"""Nachbearbeitung + Export: Hochskalieren, Farblook, Bloom, Glitch, Zensur, Untertitel,
Szenentitel, Hook-Titel, Lautmalerei (für Zuschauer ohne Ton), Endkarten mit Voxel-Krone.
Bilder gehen direkt per Pipe an ffmpeg (H.264 + AAC).

    python post.py <frames_dir> <meta.json> <fonts_dir> <mix.wav> <out.mp4> [--draft]
Fehlende Frames werden durch den letzten vorhandenen ersetzt (für Entwürfe aus Teil-Renderings).
"""
import json, math, os, subprocess, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import EV as E, FPS, FRAMES, LINES, SCENES, TITLE, WIDTH, HEIGHT

G = {}   # globale Daten für die Worker


# ------------------------------------------------------------------ Text-Hilfen

def font(name, size):
    key = (name, size)
    if key not in G['fonts']:
        G['fonts'][key] = ImageFont.truetype(os.path.join(G['fontdir'], name), size)
    return G['fonts'][key]


def wrap(text, fnt, maxw, draw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def text_block(img, lines, fnt, cx, y, fill, stroke=6, stroke_fill=(0, 0, 0), spacing=12, alpha=1.0, scale=1.0, shadow=True):
    if alpha <= 0:
        return
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    yy = y
    for ln in lines:
        w = d.textlength(ln, font=fnt)
        x = cx - w / 2
        if shadow:
            d.text((x + 5, yy + 7), ln, font=fnt, fill=(0, 0, 0, 150), stroke_width=stroke, stroke_fill=(0, 0, 0, 150))
        d.text((x, yy), ln, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
        yy += fnt.size + spacing
    if scale != 1.0:
        bb = layer.getbbox()
        if bb:
            crop = layer.crop(bb)
            cw, ch = crop.size
            crop = crop.resize((max(1, int(cw * scale)), max(1, int(ch * scale))), Image.LANCZOS)
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            layer.paste(crop, (int((bb[0] + bb[2]) / 2 - crop.width / 2), int((bb[1] + bb[3]) / 2 - crop.height / 2)))
    if alpha < 1:
        a = np.array(layer)
        a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
        layer = Image.fromarray(a)
    img.alpha_composite(layer)


def ease_out_back(u):
    u = min(max(u, 0.0), 1.0) - 1
    return 1 + 2.7 * u ** 3 + 1.7 * u ** 2


# ------------------------------------------------------------------ Untertitel planen

SPK_COL = {'erzaehler': (255, 255, 255, 255), 'crackie': (255, 214, 64, 255), 'dunkel': (200, 120, 255, 255)}


def plan_subs(durations, fit=None):
    """Teilt Sätze in Häppchen, die höchstens 2 Zeilen belegen (fit(text) -> Zeilenzahl, mit echter Schriftbreite).
    s8_vo steht als große Endkarte im Bild und bekommt keinen zusätzlichen Untertitel."""
    subs = []
    for ln in LINES:
        if ln['id'] in ('s8_laugh', 's8_vo'):
            continue
        dur = durations.get(ln['id'], 2.0)
        parts, cur = [], ''
        for w in ln['text'].split():
            t = (cur + ' ' + w).strip()
            too_long = (fit(t) > 2) if fit else len(t) > 46
            if too_long and cur:
                parts.append(cur); cur = w
            else:
                cur = t
            if cur.endswith(('.', '?', '!', ':')) and len(cur) > 18:
                parts.append(cur); cur = ''
        if cur:
            parts.append(cur)
        total = sum(len(p) for p in parts)
        t = ln['t']
        for p in parts:
            d = dur * len(p) / total
            subs.append(dict(t0=t - 0.05, t1=t + d + 0.12, text=p, who=ln['who']))
            t += d
    return subs


POPS = [  # Lautmalerei (verständlich ohne Ton)
    (E['freeze'], 0.9, 'SKRRRT!', (255, 255, 255)),
    (E['crack'], 0.9, 'KNACK!', (160, 240, 255)),
    (E['breakthrough'], 1.3, 'KLIRRR!', (160, 240, 255)),
    (E['land'], 0.8, 'WUMMS!', (255, 255, 255)),
    (E['slide'], 0.8, 'QUIIIETSCH!', (255, 255, 255)),
    (E['towel_hit'], 0.7, 'FLATSCH!', (255, 120, 90)),
    (E['collide'], 0.9, 'BONK!', (255, 225, 80)),
    (E['frame_hit'], 0.9, 'KRACH!', (255, 120, 90)),
    (E['bonk'], 0.9, 'BONK!!', (255, 225, 80)),
    (E['laugh_behind'], 1.4, 'HEHEHE…', (200, 120, 255)),
]

GLITCH = [(0.0, 0.45, 1.0), (E['hook_eye_flick'], 0.12, 0.5), (E['refl_grin'], 0.15, 0.4), (E['eyes_glow'], 0.3, 0.7),
          (E['vibrate'], 1.0, 0.5), (E['crack'], 0.25, 0.6), (E['breakthrough'], 0.45, 1.0), (E['land'], 0.2, 0.6),
          (E['dark_grin'], 0.25, 0.7), (E['frame_hit'], 0.25, 0.8), (E['empty'], 0.2, 0.5),
          (E['dark_in_mirror'], 0.5, 1.0), (E['lights_out'], 0.2, 0.8)]
FLASH = [(E['breakthrough'], 0.5, (190, 245, 255), 0.85), (E['frame_hit'], 0.18, (255, 255, 255), 0.6),
         (E['collide'], 0.12, (255, 255, 255), 0.45), (E['bonk'], 0.12, (255, 255, 255), 0.5),
         (E['land'], 0.15, (210, 170, 255), 0.4)]


def scene_of(t):
    for n, a, b, title in SCENES:
        if a <= t < b:
            return n, a, b, title
    return SCENES[-1]


# ------------------------------------------------------------------ Bildeffekte

GRADE = {   # Szene -> (Lift RGB, Gain RGB, Sättigung, Kontrast)
    1: ((0.02, 0.012, 0.0), (1.04, 1.0, 0.94), 1.05, 1.06),
    2: ((0.015, 0.012, 0.01), (1.02, 1.0, 0.97), 1.03, 1.07),
    3: ((0.01, 0.01, 0.025), (1.0, 0.99, 1.02), 1.02, 1.08),
    4: ((0.0, 0.01, 0.04), (0.97, 0.99, 1.06), 1.08, 1.10),
    5: ((0.01, 0.0, 0.04), (0.98, 0.96, 1.06), 1.05, 1.10),
    6: ((0.02, 0.006, 0.01), (1.05, 0.99, 0.97), 1.10, 1.10),
    7: ((0.006, 0.01, 0.03), (0.99, 0.99, 1.04), 0.98, 1.08),
    8: ((0.0, 0.0, 0.035), (0.96, 0.95, 1.06), 1.0, 1.12),
}


def grade(a, t):
    n = scene_of(t)[0]
    lift, gain, sat, con = GRADE[n]
    a = a * np.array(gain) + np.array(lift)
    l = a.mean(axis=2, keepdims=True)
    a = l + (a - l) * sat
    a = (a - 0.5) * con + 0.5
    return np.clip(a, 0, 1)


def bloom(a):
    small = Image.fromarray((a * 255).astype(np.uint8)).resize((WIDTH // 4, HEIGHT // 4), Image.BILINEAR)
    s = np.asarray(small).astype(np.float32) / 255
    br = np.clip((s - 0.80) / 0.20, 0, 1) ** 2 * s
    b1 = Image.fromarray((br * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))
    b2 = Image.fromarray((br * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28))
    b = (np.asarray(b1).astype(np.float32) * 0.6 + np.asarray(b2).astype(np.float32) * 0.6) / 255
    b = np.asarray(Image.fromarray((np.clip(b, 0, 1) * 255).astype(np.uint8)).resize((WIDTH, HEIGHT), Image.BILINEAR)).astype(np.float32) / 255
    return np.clip(a + b * 0.32, 0, 1)


def vignette():
    if 'vig' not in G:
        y, x = np.mgrid[0:HEIGHT, 0:WIDTH]
        d = np.sqrt(((x - WIDTH / 2) / (WIDTH * 0.62)) ** 2 + ((y - HEIGHT / 2) / (HEIGHT * 0.62)) ** 2)
        G['vig'] = (1 - np.clip(d - 0.55, 0, 1) ** 1.6 * 0.55)[..., None].astype(np.float32)
    return G['vig']


def glitch_fx(a, amt, fr):
    rng = np.random.default_rng(fr * 31 + 7)
    out = a.copy()
    sh = int(18 * amt)
    out[..., 0] = np.roll(a[..., 0], sh, axis=1)
    out[..., 2] = np.roll(a[..., 2], -sh, axis=1)
    for _ in range(int(8 * amt) + 1):
        y0 = rng.integers(0, HEIGHT - 40); h = rng.integers(8, 90)
        out[y0:y0 + h] = np.roll(out[y0:y0 + h], rng.integers(-80, 80), axis=1)
    if amt > 0.6:
        out[::4] *= 0.75
    return out


def pixelate(img, box, block=28):
    x0, y0, x1, y1 = [int(v) for v in box]
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(WIDTH, x1), min(HEIGHT, y1)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return
    reg = img.crop((x0, y0, x1, y1))
    sw, sh = max(1, (x1 - x0) // block), max(1, (y1 - y0) // block)
    reg = reg.resize((sw, sh), Image.BILINEAR).resize((x1 - x0, y1 - y0), Image.NEAREST)
    img.paste(reg, (x0, y0))


def voxel_crown(img, cx, cy, px, t):
    """Pixel-/Voxel-Krone aus Code (statt Emoji)."""
    pat = ["X...X...X", "XX.XXX.XX", "XXXXXXXXX", "XGXXRXXGX", "XXXXXXXXX"]
    d = ImageDraw.Draw(img)
    w = len(pat[0]) * px
    for r, row in enumerate(pat):
        for c, ch in enumerate(row):
            if ch == '.':
                continue
            x = cx - w / 2 + c * px; y = cy + r * px
            col = {'X': (250, 200, 60), 'G': (90, 230, 255), 'R': (190, 80, 255)}[ch]
            sh = 0.85 + 0.15 * math.sin(t * 6 + c * 0.7 + r)
            col = tuple(int(v * sh) for v in col)
            d.rectangle([x, y, x + px - 2, y + px - 2], fill=col + (255,))
            d.rectangle([x, y, x + px - 2, y + 3], fill=(255, 245, 200, 255))


# ------------------------------------------------------------------ Frame

def frame_path(fr):
    p = os.path.join(G['frames'], f'f{fr:04d}.png')
    if os.path.exists(p):
        return p
    k = G['avail_idx']
    import bisect
    i = bisect.bisect_right(k, fr) - 1
    return os.path.join(G['frames'], f'f{k[max(i, 0)]:04d}.png')


def render_frame(fr):
    t = (fr - 1) / FPS
    end = t >= E['lights_out'] + 0.4
    if end:
        a = np.zeros((HEIGHT, WIDTH, 3), np.float32)
    else:
        im = Image.open(frame_path(fr)).convert('RGB')
        if im.size != (WIDTH, HEIGHT):
            im = im.resize((WIDTH, HEIGHT), Image.LANCZOS)
            im = im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=70, threshold=2))
        a = np.asarray(im).astype(np.float32) / 255
        a = grade(a, t)
        if not G['draft']:
            a = bloom(a)
        a = a * vignette()
        for (tg, dur, amt) in GLITCH:
            if tg <= t < tg + dur:
                a = glitch_fx(a, amt * (1 - (t - tg) / dur * 0.6), fr)
        for (tf, dur, col, mx) in FLASH:
            if tf <= t < tf + dur:
                k = mx * (1 - (t - tf) / dur) ** 2
                a = a * (1 - k) + np.array(col) / 255 * k
        if not G['draft']:
            rng = np.random.default_rng(fr)
            a = a + (rng.standard_normal((HEIGHT // 2, WIDTH // 2, 1)).repeat(2, 0).repeat(2, 1) * 0.012)
        a = np.clip(a, 0, 1)
    img = Image.fromarray((a * 255).astype(np.uint8)).convert('RGBA')
    # Zensur (verpixelter Mittelfinger)
    cb = G['censor'].get(str(fr))
    if cb:
        x0, y0, x1, y1 = cb
        m = 0.035
        box = ((x0 - m) * WIDTH, (1 - y1 - m) * HEIGHT, (x1 + m) * WIDTH, (1 - y0 + m) * HEIGHT)
        pixelate(img, box)
    d = ImageDraw.Draw(img)
    # Hook-Titel (0–3,2 s)
    if t < 3.2:
        u = t / 0.35
        sc = ease_out_back(u)
        al = 1.0 if t < 2.9 else (3.2 - t) / 0.3
        f = font('Montserrat-ExtraBold.ttf', 74)
        lines = wrap(TITLE, f, 900, d)
        text_block(img, lines, f, WIDTH / 2, 250, (255, 255, 255, 255), 8, alpha=al, scale=max(0.01, sc))
    # Szenentitel
    for n, a0, b0, title in SCENES:
        ts = a0 + (3.3 if n == 1 else 0.25)
        if ts <= t < ts + 2.4:
            u = (t - ts)
            al = min(1.0, u / 0.25, (ts + 2.4 - t) / 0.35)
            slide = (1 - ease_out_back(u / 0.4)) * -120
            f = font('PressStart2P.ttf', 30)
            label = f'SZENE {n}'
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            dl = ImageDraw.Draw(layer)
            f2 = font('Montserrat-ExtraBold.ttf', 46)
            w = max(dl.textlength(label, font=f), dl.textlength(title, font=f2)) + 56
            x0, y0 = 54 + slide, 170
            dl.rounded_rectangle([x0, y0, x0 + w, y0 + 132], 18, fill=(12, 10, 22, int(200 * al)))
            dl.rectangle([x0, y0, x0 + 10, y0 + 132], fill=(180, 90, 255, int(255 * al)) if n >= 3 else (255, 200, 70, int(255 * al)))
            dl.text((x0 + 30, y0 + 18), label, font=f, fill=(255, 210, 80, int(255 * al)))
            dl.text((x0 + 30, y0 + 62), title, font=f2, fill=(255, 255, 255, int(255 * al)))
            img.alpha_composite(layer)
    # Lautmalerei
    for (tp, dur, word, col) in POPS:
        if tp <= t < tp + dur:
            u = (t - tp)
            sc = ease_out_back(u / 0.18)
            al = min(1.0, (tp + dur - t) / 0.25)
            f = font('Montserrat-ExtraBold.ttf', 110)
            rot_y = 720 + 40 * math.sin(tp)
            text_block(img, [word], f, WIDTH * 0.5 + 120 * math.sin(tp * 3), rot_y, col + (255,), 10,
                       alpha=al, scale=max(0.01, sc))
    # Untertitel (max. 2 Zeilen, oberhalb der App-Bedienelemente)
    active = [s for s in G['subs'] if s['t0'] <= t < s['t1']]
    for s in sorted(active, key=lambda x: x['t0'])[-1:]:      # immer nur der neueste Untertitel
        if True:
            f = font('Montserrat-ExtraBold.ttf', 58)
            lines = wrap(s['text'], f, 860, d)[:2]
            al = min(1.0, (t - s['t0']) / 0.08, (s['t1'] - t) / 0.08)
            y = 1330 if len(lines) == 2 else 1365
            text_block(img, lines, f, WIDTH / 2 - 20, y, SPK_COL[s['who']], 7, alpha=al)
    # Endkarten
    if t >= E['end_text']:
        u = t - E['end_text']
        if t < E['end_logo']:
            f = font('Montserrat-ExtraBold.ttf', 82)
            lines = wrap('WÜRDEST DU DEINEM SPIEGELBILD NOCH VERTRAUEN?', f, 900, d)
            al = min(1.0, u / 0.4, (E['end_logo'] - t) / 0.25)
            text_block(img, lines, f, WIDTH / 2, 700, (255, 255, 255, 255), 0, alpha=al, scale=0.92 + 0.08 * min(1, u / 2.4),
                       shadow=False)
        else:
            v = t - E['end_logo']
            sc = ease_out_back(v / 0.35)
            px = int(26 * max(0.05, sc))
            voxel_crown(img, WIDTH / 2, 720, px, t)
            f = font('PressStart2P.ttf', 96)
            text_block(img, ['CRACKIE'], f, WIDTH / 2, 900, (255, 255, 255, 255), 0, alpha=min(1, v / 0.2),
                       scale=max(0.01, sc), shadow=False)
            f2 = font('Montserrat-Bold.ttf', 40)
            text_block(img, ['Old but Gold…?'], f2, WIDTH / 2, 1040, (190, 150, 255, 255), 0, alpha=min(1, max(0, (v - 0.4) / 0.4)), shadow=False)
    return np.asarray(img.convert('RGB')).tobytes()


def init(g):
    G.update(g)
    G['fonts'] = {}


def main():
    a = sys.argv[1:]
    frames, meta_p, fontdir, mix, out = a[:5]
    draft = '--draft' in a
    f_first, f_last = 1, FRAMES
    if '--range' in a:
        f_first, f_last = map(int, a[a.index('--range') + 1].split('-'))
    meta = json.load(open(meta_p))
    durations = {}
    vd = os.path.join(os.path.dirname(mix), 'voice', 'durations.json')
    if os.path.exists(vd):
        durations = json.load(open(vd))
    avail = sorted(int(f[1:5]) for f in os.listdir(frames) if f.startswith('f') and f.endswith('.png') and 'tmp' not in f)
    _f = ImageFont.truetype(os.path.join(fontdir, 'Montserrat-ExtraBold.ttf'), 58)
    _d = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    fit = lambda txt: len(wrap(txt, _f, 860, _d))
    g = dict(frames=frames, fontdir=fontdir, draft=draft, censor=meta.get('censor', {}), subs=plan_subs(durations, fit),
             avail_idx=avail)
    json.dump(g['subs'], open(os.path.splitext(out)[0] + '_subs.json', 'w'), indent=1, ensure_ascii=False)
    # Ton auf -14 LUFS bringen (zwei Durchgänge) und True Peak per Limiter unter -1,5 dBFS halten
    norm = os.path.splitext(out)[0] + '_audio.m4a'
    p1 = subprocess.run(['ffmpeg', '-hide_banner', '-i', mix, '-af', 'loudnorm=I=-14:TP=-2:LRA=9:print_format=json',
                         '-f', 'null', '-'], capture_output=True, text=True)
    mj = json.loads(p1.stderr[p1.stderr.rindex('{'):p1.stderr.rindex('}') + 1])
    af = (f"loudnorm=I=-14:TP=-2:LRA=9:measured_I={mj['input_i']}:measured_TP={mj['input_tp']}:"
          f"measured_LRA={mj['input_lra']}:measured_thresh={mj['input_thresh']}:offset={mj['target_offset']}:linear=true,"
          f"alimiter=limit=0.79:attack=2:release=60:level=false")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mix, '-af', af, '-ar', '48000',
                    '-c:a', 'aac', '-b:a', '192k', norm], check=True)
    t_first, n_fr = (f_first - 1) / FPS, f_last - f_first + 1
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{WIDTH}x{HEIGHT}', '-r', str(FPS),
           '-i', '-', '-ss', f'{t_first:.4f}', '-i', norm, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast' if draft else 'medium',
           '-crf', '23' if draft else '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
           '-c:a', 'aac', '-b:a', '192k', '-t', f'{n_fr / FPS:.4f}', '-movflags', '+faststart', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    procs = int(os.environ.get('POST_PROCS', os.cpu_count() or 2))
    with Pool(procs, initializer=init, initargs=(g,)) as pool:
        for i, buf in enumerate(pool.imap(render_frame, range(f_first, f_last + 1), chunksize=4)):
            p.stdin.write(buf)
            if i % 240 == 0:
                print(f'post {i}/{n_fr}', flush=True)
    p.stdin.close()
    p.wait()
    print('VIDEO', out, 'rc', p.returncode)


if __name__ == '__main__':
    main()
