"""Deutsche Stimmen mit Piper TTS (kostenlos, offline, kein Voice-Cloning).

Erzähler: de_DE-thorsten-high, tiefer gelegt, leichter Raumhall.
Crackie:  de_DE-thorsten_emotional (müde / amüsiert / wütend …), etwas tiefer.
Dunkel:   dieselbe Stimme, geflüstert, deutlich tiefer, mit Echo.

Aufruf: python tts.py <voices_dir> <out_dir>
"""
import json, os, subprocess, sys, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import LINES
from piper import PiperVoice, SynthesisConfig

VOICES, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
high = PiperVoice.load(os.path.join(VOICES, 'de_DE-thorsten-high.onnx'))
emo = PiperVoice.load(os.path.join(VOICES, 'de_DE-thorsten_emotional-medium.onnx'))
SPK = json.load(open(os.path.join(VOICES, 'de_DE-thorsten_emotional-medium.onnx.json')))['speaker_id_map']

FX = {
    # Tiefer, ruhiger, etwas Raum
    'erzaehler': 'rubberband=pitch=0.89:formant=preserved,bass=g=4:f=140,acompressor=threshold=0.1:ratio=3:attack=10:release=200,aecho=0.8:0.6:45|90:0.12|0.07',
    'crackie': 'rubberband=pitch=0.93:formant=preserved,bass=g=2:f=160,acompressor=threshold=0.12:ratio=2.5',
    'dunkel': 'rubberband=pitch=0.78:formant=shifted,bass=g=5:f=120,aecho=0.8:0.7:60|130:0.35|0.2,chorus=0.6:0.8:40:0.3:0.25:2',
}
durations = {}
for ln in LINES:
    raw = os.path.join(OUT, ln['id'] + '_raw.wav')
    out = os.path.join(OUT, ln['id'] + '.wav')
    with wave.open(raw, 'wb') as w:
        if ln['who'] == 'erzaehler':
            high.synthesize_wav(ln['text'], w, syn_config=SynthesisConfig(length_scale=1.07, noise_scale=0.6, noise_w_scale=0.7))
        else:
            style = ln.get('style', 'neutral')
            ls = {'sleepy': 1.12, 'whisper': 1.15, 'angry': 0.95, 'amused': 1.0}.get(style, 1.05)
            emo.synthesize_wav(ln['text'], w, syn_config=SynthesisConfig(speaker_id=SPK[style], length_scale=ls))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', FX[ln['who']] + ',aresample=48000,loudnorm=I=-18:TP=-2:LRA=7',
                    '-ac', '2', '-ar', '48000', out], check=True)
    os.remove(raw)
    with wave.open(out) as w:
        durations[ln['id']] = round(w.getnframes() / w.getframerate(), 3)
    print(f"{ln['id']:10s} {durations[ln['id']]:5.2f}s  {ln['text']}")
json.dump(durations, open(os.path.join(OUT, 'durations.json'), 'w'), indent=1)

# Überschneidungen prüfen
prev = None
for ln in sorted(LINES, key=lambda x: x['t']):
    end = ln['t'] + durations[ln['id']]
    if prev and ln['t'] < prev[1] - 0.05:
        print(f"WARNUNG: {ln['id']} beginnt {prev[1] - ln['t']:.2f}s vor dem Ende von {prev[0]}")
    prev = (ln['id'], end)
