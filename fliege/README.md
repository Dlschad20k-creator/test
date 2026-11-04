# Fliegenhirn-Labor

Das komplette Gehirn der Fruchtfliege *Drosophila melanogaster* im Browser:
139.255 Neuronen und 2,7 Millionen Verbindungen aus dem
[FlyWire](https://flywire.ai)-Konnektom (Snapshot 783, dieselben Daten wie
[Codex](https://codex.flywire.ai)).

Öffnen: `https://<dein-name>.github.io/test/fliege/` (GitHub Pages) oder lokal:

```sh
python3 -m http.server      # im Repo-Ordner
# dann http://localhost:8000/fliege/ öffnen
```

## Was du machen kannst

- **Reizen** – ausgewählte Neuronen bekommen zufällige Eingangsimpulse (Frequenz in Hz einstellbar).
- **Stummschalten** – Neuronen dürfen nicht feuern (wie ein genetischer Knockout).
- **Beobachten** – sieh genau nach, wie stark bestimmte Neuronen reagieren.
- Suchen nach Zelltyp (`LC4`, `DNp01`), Beschreibung (`sugar`, `olfactory`, `bitter`), Klasse (`motor`, `descending`) oder ID.
- Antippen eines Neurons zeigt seinen Steckbrief mit Ein- und Ausgängen.
- Ergebnisse: aktivste Neuronen und Zelltypen, Spike-Raster, Abspielen im 3D-Gehirn, CSV-Export,
  Vergleich mit dem vorigen Lauf (Δ-Spalte), Speichern und Teilen per Link.

## Das Modell

Leaky Integrate-and-Fire, Parameter wie in Shiu et al. 2024 (*Nature*,
„A Drosophila computational brain model reveals sensorimotor processing“):
Acetylcholin erregt, GABA und Glutamat hemmen, jede Synapse wirkt mit 0,275 mV,
1,8 ms Verzögerung. Die Simulation läuft im Browser in einem Web Worker
(`sim-worker.js`) und rechnet nur gerade aktive Neuronen, daher dauert eine Sekunde
Fliegenhirn meist unter einer Sekunde.

Prüfen in Node: `node fliege/tools/test_sim.js`. Dabei kommt ungefähr Folgendes heraus:

| Experiment | MN9 (Rüssel) |
| --- | --- |
| Zucker-Neuronen 100 Hz | 80 / 103 Hz |
| Zucker + Bitter | ~0 Hz |
| Zucker, „Roundup“ stumm | 0 Hz |

## Daten neu bauen

```sh
pip install pandas numpy
python3 fliege/tools/build_data.py   # lädt ~65 MB Rohdaten, schreibt fliege/data/
```

## Quellen & Lizenz

- Konnektom: FlyWire Consortium – Dorkenwald et al. 2024, Schlegel et al. 2024 (*Nature*).
  Daten unter **CC BY-NC 4.0** (nur nicht-kommerziell, mit Quellenangabe).
- Codex: Murthy Lab, Princeton – Apache 2.0, Kopie im Ordner `../codex`.
- Modell: Shiu, Sterne et al. 2024 (*Nature*).
