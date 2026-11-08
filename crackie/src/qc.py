"""Qualitätskontrolle des fertigen Videos.

    python qc.py <video.mp4> <frames_dir> <mix.wav> <fonts_dir> <report.json>

Prüft: Auflösung, Seitenverhältnis, fps, Codecs, Dauer, Frame-Anzahl, Audio (Kanäle, Rate, Lautheit,
True Peak), unerwartete Schwarzbilder, Vollständigkeit der gerenderten Frames, Ton an jedem
Dialogeinsatz (Synchronität), Untertitel höchstens 2 Zeilen."""
import json, os, re, subprocess, sys, wave
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import FPS, FRAMES, DURATION, WIDTH, HEIGHT, LINES, SCENES, EV


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def main():
    video, frames, mix, fontdir, out = sys.argv[1:6]
    R = {'checks': []}

    def check(name, ok, detail=''):
        R['checks'].append({'name': name, 'ok': bool(ok), 'detail': detail})
        print(('OK   ' if ok else 'FEHL ') + name + (f' – {detail}' if detail else ''))

    # Gerenderte Frames
    have = {int(f[1:5]) for f in os.listdir(frames) if re.match(r'f\d{4}\.png$', f)}
    missing = [f for f in range(1, FRAMES + 1) if f not in have]
    check('Alle 2880 Frames gerendert', not missing, f'{len(have)} vorhanden, {len(missing)} fehlen' + (f' (z. B. {missing[:5]})' if missing else ''))
    # Szenenplan
    check('Szenen lückenlos 0–120 s', abs(sum(b - a for _, a, b, _ in SCENES) - DURATION) < 1e-6 and SCENES[0][1] == 0)
    # Container/Streams
    p = run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', video])
    info = json.loads(p.stdout)
    v = [s for s in info['streams'] if s['codec_type'] == 'video'][0]
    a = [s for s in info['streams'] if s['codec_type'] == 'audio'][0]
    R['video'] = {k: v.get(k) for k in ('codec_name', 'profile', 'width', 'height', 'pix_fmt', 'r_frame_rate', 'avg_frame_rate', 'duration')}
    R['audio'] = {k: a.get(k) for k in ('codec_name', 'sample_rate', 'channels', 'duration', 'bit_rate')}
    R['format'] = {k: info['format'].get(k) for k in ('duration', 'size', 'bit_rate', 'format_name')}
    check('Auflösung 1080x1920 (9:16)', v['width'] == WIDTH and v['height'] == HEIGHT, f"{v['width']}x{v['height']}")
    check('Video-Codec H.264', v['codec_name'] == 'h264', f"{v['codec_name']} {v.get('profile')} {v.get('pix_fmt')}")
    check('24 fps', v['r_frame_rate'] in ('24/1', '24000/1000'), v['r_frame_rate'])
    check('Audio-Codec AAC', a['codec_name'] == 'aac', f"{a['codec_name']} {a['sample_rate']} Hz {a['channels']} Kanäle")
    dur = float(info['format']['duration'])
    check('Dauer 120 s (±0,1 s)', abs(dur - DURATION) <= 0.1, f'{dur:.3f} s')
    p = run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', video])
    nf = int(p.stdout.strip().split(',')[0])
    check('Frame-Anzahl 2880', nf == FRAMES, str(nf))
    check('Audiospur deckt das Video ab', abs(float(a['duration']) - DURATION) <= 0.15, f"{float(a['duration']):.3f} s")
    # Schwarzbilder
    p = run(['ffmpeg', '-v', 'info', '-i', video, '-vf', 'blackdetect=d=0.25:pix_th=0.06', '-an', '-f', 'null', '-'])
    blacks = [(float(m.group(1)), float(m.group(2))) for m in re.finditer(r'black_start:([\d.]+) black_end:([\d.]+)', p.stderr)]
    R['black'] = blacks
    unexpected = [b for b in blacks if b[1] < EV['lights_out'] - 0.05]
    check('Keine unerwarteten Schwarzbilder (geplant: Licht aus ab 115,6 s)', not unexpected, f'Schwarz-Abschnitte: {blacks}')
    # Lautheit
    p = run(['ffmpeg', '-v', 'info', '-i', video, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', p.stderr)
    TP = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', p.stderr)
    lufs = float(I[-1]) if I else None
    tp = float(TP[-1]) if TP else None
    R['loudness'] = {'integrated_lufs': lufs, 'true_peak_dbfs': tp}
    check('Lautheit ca. -14 LUFS (±1,5)', lufs is not None and abs(lufs + 14) <= 1.5, f'{lufs} LUFS, True Peak {tp} dBFS')
    check('True Peak ≤ -1 dBFS', tp is not None and tp <= -1.0, f'{tp} dBFS')
    # Ton an jedem Dialogeinsatz (Synchronität Ton/Zeitleiste)
    with wave.open(mix) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, 2).mean(1) / 32768
    vd = os.path.join(os.path.dirname(mix), 'voice')
    bad = []
    for ln in LINES:
        with wave.open(os.path.join(vd, ln['id'] + '.wav')) as w:
            vs = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, w.getnchannels()).mean(1) / 32768
            vsr = w.getframerate()
        # Kreuzkorrelation der Hüllkurven um den geplanten Einsatz (±0,5 s)
        hop = sr // 100
        seg = x[int((ln['t'] - 0.5) * sr): int((ln['t'] + 2.5) * sr)]
        e_mix = np.sqrt(np.convolve(seg ** 2, np.ones(hop) / hop, 'same'))[::hop]
        vv = vs[: int(2.0 * vsr)]
        hopv = vsr // 100
        e_v = np.sqrt(np.convolve(vv ** 2, np.ones(hopv) / hopv, 'same'))[::hopv]
        best, lag = -1, 0
        for k in range(0, 100):
            n = min(len(e_v), len(e_mix) - k)
            if n <= 10:
                break
            c = np.corrcoef(e_mix[k:k + n], e_v[:n])[0, 1]
            if c > best:
                best, lag = c, k
        off = (lag - 50) / 100
        if abs(off) > 0.08:
            bad.append((ln['id'], round(off, 3), round(float(best), 2)))
    check('Dialog liegt zeitgenau auf der Zeitleiste (±80 ms)', not bad, f'Abweichungen: {bad}' if bad else f'{len(LINES)} Einsätze geprüft')
    # Untertitel max. 2 Zeilen
    subs_p = os.path.splitext(video)[0] + '_subs.json'
    if os.path.exists(subs_p):
        from PIL import ImageFont, Image, ImageDraw
        import post
        f = ImageFont.truetype(os.path.join(fontdir, 'Montserrat-ExtraBold.ttf'), 58)
        d = ImageDraw.Draw(Image.new('RGB', (10, 10)))
        subs = json.load(open(subs_p))
        over = [s['text'] for s in subs if len(post.wrap(s['text'], f, 860, d)) > 2]
        check('Untertitel höchstens 2 Zeilen', not over, f'{len(subs)} Untertitel' + (f', zu lang: {over}' if over else ''))
    R['passed'] = all(c['ok'] for c in R['checks'])
    json.dump(R, open(out, 'w'), indent=1, ensure_ascii=False)
    print('QC', 'BESTANDEN' if R['passed'] else 'NICHT BESTANDEN', '->', out)


if __name__ == '__main__':
    main()
