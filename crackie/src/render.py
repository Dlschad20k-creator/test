"""Rendert Frames der fertigen Szene mit Checkpoints (vorhandene Frames werden übersprungen).

    python render.py <crackie.blend> <out_dir> [--scene N | --frames a-b | --list 1,25,49]
                     [--quality preview|cpu|gpu|auto] [--every K]

Qualität:
  preview : 288x512,   4 Samples  (Kontaktbogen)
  cpu     : 540x960,   8 Samples + Denoiser, Hochskalierung in der Nachbearbeitung
  gpu     : 1080x1920, 16 Samples + Denoiser (Colab-GPU)
  auto    : gpu, wenn eine CUDA/OptiX/HIP/Metal-GPU gefunden wird, sonst cpu
"""
import argparse, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from timeline import SCENES, FPS, FRAMES

QUAL = {
    'preview': dict(res=(288, 512), samples=4, blur=False, denoise=True),
    'cpu': dict(res=(540, 960), samples=8, blur=True, denoise=True),
    'gpu': dict(res=(1080, 1920), samples=16, blur=True, denoise=True),
}


def detect_gpu():
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
    except Exception:
        return None
    for kind in ('OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI'):
        try:
            prefs.compute_device_type = kind
            prefs.refresh_devices()
            devs = [d for d in prefs.devices if d.type == kind]
            if devs:
                for d in prefs.devices:
                    d.use = d.type == kind
                return kind, [d.name for d in devs]
        except Exception:
            continue
    return None


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('blend'); ap.add_argument('out')
    ap.add_argument('--scene', type=int); ap.add_argument('--frames'); ap.add_argument('--list')
    ap.add_argument('--quality', default='auto'); ap.add_argument('--every', type=int, default=1)
    ap.add_argument('--samples', type=int)
    a = ap.parse_args(argv)
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(a.blend))
    sc = bpy.context.scene
    q = a.quality
    gpu = detect_gpu() if q in ('auto', 'gpu') else None
    if q == 'auto':
        q = 'gpu' if gpu else 'cpu'
    cfg = QUAL[q]
    if gpu and q == 'gpu':
        sc.cycles.device = 'GPU'
        print('GPU:', gpu)
    else:
        sc.cycles.device = 'CPU'
        print('CPU-Rendering')
    sc.render.resolution_x, sc.render.resolution_y = cfg['res']
    sc.cycles.samples = a.samples or cfg['samples']
    sc.render.use_motion_blur = cfg['blur']
    sc.cycles.use_denoising = cfg['denoise']
    if q == 'gpu':
        sc.cycles.use_fast_gi = False
        sc.cycles.diffuse_bounces = 2
    if a.scene:
        _, t0, t1, _ = SCENES[a.scene - 1]
        frames = range(int(round(t0 * FPS)) + 1, int(round(t1 * FPS)) + 1)
    elif a.frames:
        f0, f1 = map(int, a.frames.split('-'))
        frames = range(f0, f1 + 1)
    elif a.list:
        frames = [int(x) for x in a.list.split(',')]
    else:
        frames = range(1, FRAMES + 1)
    frames = list(frames)[::a.every]
    os.makedirs(a.out, exist_ok=True)
    done = 0; t_start = time.time()
    for fr in frames:
        path = os.path.join(a.out, f'f{fr:04d}.png')
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            continue                           # Checkpoint: schon fertig
        sc.frame_set(fr)
        sc.render.filepath = path + '.tmp.png'
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        os.replace(path + '.tmp.png', path)    # erst nach vollständigem Schreiben umbenennen
        done += 1
        el = time.time() - t_start
        print(f'RENDER f{fr:04d} {time.time() - t0:.2f}s  ({done}/{len(frames)}, Ø {el / done:.2f}s)', flush=True)
    print('FERTIG', done, 'Frames in', round(time.time() - t_start, 1), 's')


if __name__ == '__main__':
    main()
