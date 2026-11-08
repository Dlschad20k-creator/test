# 👑 Crackie – The Living Mirror

**„Was wäre, wenn dein Spiegelbild plötzlich lebendig wird?“**
120 Sekunden Voxel-3D-Kurzfilm · 1080×1920 (9:16) · 24 fps · H.264/AAC · Deutsch mit Untertiteln.

Alles wird per Code erzeugt – Figuren, Bad, Spiegelwelt, Animation, Kamera, Licht, Effekte, Stimmen,
Musik, Geräusche, Untertitel und Titel. Es werden ausschließlich kostenlose Werkzeuge verwendet.

## Schnellstart (iPhone + Google Colab)

1. `colab/Crackie_Living_Mirror.ipynb` in Google Colab öffnen (Datei → Notebook öffnen → GitHub →
   `Dlschad20k-creator/test` → `crackie/colab/Crackie_Living_Mirror.ipynb`).
2. *Laufzeit → Laufzeittyp ändern → T4-GPU*.
3. *Laufzeit → Alle ausführen*. Ergebnis: `Google Drive/MyDrive/Crackie/Crackie_The_Living_Mirror.mp4`.

Bricht die Sitzung ab, einfach erneut *Alle ausführen*: Stimmen, Ton, Szene und jeder fertige Frame
liegen in Drive und werden übersprungen.

## Architektur

```
timeline.py   Zentrale Zeitleiste: 8 Szenen, Dialogzeilen, ~70 Ereignis-Zeitpunkte (Bild, Ton, Untertitel synchron)
voxel.py      Voxel-Mesher (nur sichtbare Flächen), Voxel-Material mit Fugen, Dunkel-Überblendung, Leuchten
character.py  Crackie nach dem Charakterblatt (Teile-Rig) + dunkle Version (gleiche Geometrie, andere Farben)
bathroom.py   Prozedurales Voxel-Bad, Nordwand mit Spiegelöffnung, zerbrechlicher Rahmen, Portal-Glas-Shader
build.py      Szene: Spiegelwelt (gespiegelte Instanz), Figuren, Licht (echte Welt warm / Spiegelwelt kalt),
              Kamera + Fülllicht, Lichtstrahlen, Effekt-Schwärme
anim.py       Animationssystem: Tracks mit Easing, Posen, Atmen/Blinzeln/Gehen/Glitch/Lippen-Sync,
              Spiegel-Folgen (Doppelgänger kopiert Crackie, bis er abweicht), Backen als Keyframes
poses.py      Posen- und Mimik-Bibliothek
story.py      Choreografie aller 8 Szenen, 35 Kamera-Einstellungen, Licht, Portal, Effekt-Simulationen
fx.py         Glassplitter, Portal-Partikel, Staub, Trümmer, Sterne, Glitch-Würfel, vorgetäuschte Lichtstrahlen
render.py     Rendern pro Szene mit Checkpoints, automatische GPU-Erkennung (OptiX/CUDA/HIP/Metal)
tts.py        Deutsche Stimmen mit Piper (Thorsten / Thorsten-Emotional) – kein Voice-Cloning
sound.py      Musik + Sounddesign komplett selbst synthetisiert (numpy/scipy), Mischung mit Ducking
fonts.py      Freie Schriften (SIL OFL) laden
post.py       Hochskalieren, Farblook, Bloom, Glitch, Zensur, Untertitel, Szenentitel, Hook, Endkarten, ffmpeg-Export
qc.py         Qualitätskontrolle des fertigen Videos
```

### Die 10 Blender-Systeme

| System | Umsetzung |
|---|---|
| Charaktermodell | `character.py`: Voxel-Teile mit Drehpunkten (Hüfte, Torso, Kopf, Arme, Beine), Hände in 5 Formen |
| Gesichtsanimation | Brauen (Winkel/Höhe), Oberlider (Schließgrad), Pupillen (Blick/Größe), 10 Mundformen, Lippen-Sync aus den Sprachdateien |
| Körperanimation | Posen-Bibliothek, prozedurales Gehen, Atmen, Lachen, Kopfschütteln |
| Spiegelwelt | gespiegelte Instanz des Raums (Skalierung y = −1), gespiegelte Lichter, warm → kalt/violett |
| Doppelgänger | identische Geometrie, Farbumschaltung `Dark`, leuchtende Pupillen `Glow`, Glitch-Zittern, Kapuze |
| Portal | Glas-Shader: Wirbel, Ringwellen, Risse (Voronoi), Bruch; Splitter in Zeitlupe |
| Partikel/Zerstörung | Voxel-Schwärme mit Ballistik und Bodenabprall; Rahmenstücke explodieren/fallen |
| Kamera | 35 Einstellungen, Fahrten, Schnitte, Wackeln, Tiefenschärfe automatisch auf das Ziel |
| Licht | Deckenlicht, Spiegelleuchten, Mondlicht durchs Fenster, Rot (Gefahr), Cyan/Violett (Magie), Schattenlicht, Licht aus |
| Render | Cycles, Szenen einzeln, Checkpoints, GPU-Erkennung, Bewegungsunschärfe |

## Lokal ausführen (Linux)

```bash
python tts.py <voices_dir> <work>/audio/voice
python sound.py <work>/audio/voice <work>/audio
python fonts.py <work>/fonts
blender -b --python build.py -- <work>/crackie.blend <work>/audio/voice
blender -b --python render.py -- <work>/crackie.blend <work>/frames --scene 1 --quality auto   # 1 … 8
python post.py <work>/frames <work>/crackie_meta.json <work>/fonts <work>/audio/mix.wav out.mp4
python qc.py out.mp4 <work>/frames <work>/audio/mix.wav <work>/fonts qc_report.json
```

## Lizenzen der Bausteine

Blender (GPL), Piper TTS (MIT) mit den Thorsten-Stimmen (frei nutzbar), Montserrat und Press Start 2P
(SIL Open Font License), ffmpeg (LGPL/GPL). Musik und Geräusche sind selbst synthetisiert.
