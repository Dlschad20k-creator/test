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

## Produktionsbericht (Lauf vom 07./08.11.2026)

Alle Angaben unten sind gemessen bzw. von `qc.py` geprüft.

### Ergebnis

| Datei | Größe | Inhalt |
|---|---|---|
| `Crackie_The_Living_Mirror.mp4` | 352,4 MB | Master: H.264 High, CRF 18, AAC 192 kbit/s |
| `Crackie_The_Living_Mirror_Handy.mp4` | 138,1 MB | Zum Hochladen (TikTok/Reels/Shorts): H.264 High, ≈ 9,2 Mbit/s, gleicher Ton |

Qualitätskontrolle – beide Dateien **bestanden** (15 Prüfungen):
1080×1920 · 24 fps · 120,000 s · 2880 Frames · H.264 High yuv420p · AAC 48 kHz Stereo ·
Lautheit −14,6 LUFS · True Peak −1,8 dBFS · 18 Dialogeinsätze mit 0,00 s Versatz zur Zeitleiste ·
Sprachspur ohne Versatz in der Mischung · 29 Untertitel, alle ≤ 2 Zeilen ·
einziger Schwarzbild-Abschnitt 115,6–116,0 s (geplant: „Licht aus“, danach Endkarten).

### Rendering

- Blender 5.2.3 (Cycles, CPU, 4 Kerne, keine GPU in dieser Umgebung), 540×960, 6 Samples + OpenImageDenoise,
  Bewegungsunschärfe, schnelle GI-Näherung; in der Nachbearbeitung auf 1080×1920 hochskaliert.
- Szenen einzeln gerendert: Szene 1 288 Frames / 1316 s · 2: 360 / 1939 s · 3: 360 / 1944 s · 4: 384 / 1998 s ·
  5: 408 / 2027 s · 6: 456 (davon 396 im zweiten Lauf / 1708 s) · 7: 384 / 1465 s · 8: 240 / 917 s.
  Ø 4,7 s pro Frame, gesamt ≈ 3,8 h.
- Während Szene 6 wurde die Rechenumgebung neu gestartet (Abbruch bei Frame 1860). Dank Checkpoints wurde
  nur der Rest neu gerendert; kein Frame musste doppelt berechnet werden.
- Szene: ≈ 992.000 Keyframes, 35 Kameraeinstellungen.

### Ehrliche Einschränkungen

- Das Video wurde hier per CPU in halber Auflösung gerendert und hochskaliert. Das Colab-Notebook rendert
  mit GPU nativ in 1080×1920 – es ist geschrieben und seine Download-Quellen sind geprüft, ein vollständiger
  Lauf in Google Colab konnte von hier aus aber nicht getestet werden.
- Google Drive ist aus dieser Umgebung nicht erreichbar; das Video wurde direkt übergeben. Das Notebook speichert in Drive.
- „Volumetrische“ Lichtstrahlen sind aus Render-Zeitgründen vorgetäuscht (leuchtende, halbtransparente Strahlen).
- Erzähler, Crackie und Doppelgänger nutzen die freien Thorsten-Stimmen (Piper), unterschieden durch Sprechstil,
  Tonhöhe und Effekte. Kein Voice-Cloning.
- Lippen-Sync folgt der Lautstärke (Mund offen/halb/zu), nicht einzelnen Lauten.
- Durch Crackies großen Voxelkopf verdeckt der Kopf in einigen Über-die-Schulter-Einstellungen einen Teil des Bildes.
- Der Mittelfinger-Gag ist in der Nachbearbeitung verpixelt und mit Piepton versehen.

### Viralitäts-Regeln

- Erste Sekunde: Glitch, die Augen des Spiegelbilds schnappen zur Kamera, großer Hook-Titel.
- Neuer Reiz alle 3–7 s: 35 Einstellungen in 120 s (Ø 3,4 s) plus Szenentitel, Glitches, Blitze, Lautmalerei.
- Überraschungen: Zwinkern, Mittelfinger, Spiegel wird Tür, Doppelgänger steigt heraus, leerer Boden,
  eigenständiger Schatten mit leuchtenden Augen, Doppelgänger im Spiegel.
- Twist am Ende: Licht aus, nur die violetten Augen bleiben.
- Ohne Ton verständlich: Untertitel (Farbe je Sprecher) und 10 Lautmalerei-Einblendungen (KNACK!, KLIRRR!, BONK! …).
