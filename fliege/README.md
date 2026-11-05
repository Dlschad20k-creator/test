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

## Fliegenwelt 3D (`welt.html`)

Eine Fruchtfliege mit 3D-Körper (Facettenaugen, Fühler, Flügel mit Adern, sechs Beine im
Dreifußgang, ausfahrbarer Rüssel), gesteuert vom ganzen Konnektom. Zwei Orte:

- **Wiese** – Banane, Blumen, Essig, Zucker, Bitterköder hinlegen, mit der Hand erschrecken,
  Strom oder Zucker-Belohnung geben, während sie etwas riecht.
- **Labor** – klassisches Duft-Lernen wie bei Tully & Quinn (1985): Duft A + Strom (oder Zucker),
  Duft B ohne, dann Wahltest im T-Labyrinth, vorher und nachher.

Alle 20 ms Hirnzeit gehen die Sinne ins Gehirn, und die Antworten bewegen den Körper:

| Sinn → Gehirn | Gehirn → Körper |
| --- | --- |
| Duft an linker/rechter Antenne → Riechzellen je Glomerulus, Stärke aus **DoOR** (gemessene Rezeptor-Antworten) | Pilzkörper-Ausgänge (MBONs) → Bewertung „hin/weg“ |
| Zucker unter dem Kopf → 23 Zucker-Geschmacksneuronen (stärker bei Hunger) | MN9 → Rüssel raus, fressen |
| Bitteres → Bitter-Geschmacksneuronen | hemmt MN9 im Netz |
| Nahende Hand → LC4 des linken/rechten Auges | Riesenfaser DNp01 → Absprung; DNp02/04/11 → wegdrehen |
| Strom → PPL1-Dopaminneuronen, Zucker-Belohnung → PAM-Dopaminneuronen (wie Optogenetik) | Lernen: Synapsen Kenyon-Zelle → MBON werden schwächer |

**Lernen:** Feuert Dopamin, während Kenyon-Zellen aktiv sind, werden genau deren Synapsen auf die
MBONs dieses Kompartiments schwächer (Hige et al. 2015). Welche Dopamin-Neuronen zu welchem MBON
gehören, steht direkt im Konnektom (DAN→MBON-Synapsen; z. B. PPL1-γ1pedc → MBON11, PAM-α1 →
MBON07, wie in Aso et al. 2014). MBONs in Strafe-Kompartimenten fördern Annäherung, die in
Belohnungs-Kompartimenten Meiden. So ändert Training die Bewertung nur für den gelernten Duft.

**Vereinfacht (ehrlich markiert):** Laufen ist ein Laufgenerator; die Richtung folgt der Bewertung
(Duft wird stärker → weiter; schwächer → öfter drehen). Die *angeborene* Vorliebe für Obst- und
Gärungsdüfte ist eine Körper-Regel – im Tier läuft sie über das Lateralhorn, nicht über den
Pilzkörper. Das *Gelernte* kommt direkt aus den Synapsen. Strom und Zucker erreichen die
Dopaminneuronen beim Tier über Bahnen aus dem Körper, die im Gehirn-Konnektom fehlen; deshalb
werden die Dopaminneuronen direkt aktiviert. Im T-Labyrinth werden die Duftstärken vorher so
abgeglichen, dass eine naive Fliege etwa 50 : 50 wählt – wie im echten Labor.

### Biologische Korrekturen am Modell (`brain-setup.js`)

Das Originalmodell (Shiu et al. 2024) wurde für Geschmack gebaut. Für Riechen und Lernen waren
diese Korrekturen nötig – jede einzeln gemessen:

| Problem im Originalmodell | Korrektur | Wirkung |
| --- | --- | --- |
| Jeder Duft erregt ~8.000 Neuronen, egal welcher | Dopamin/Serotonin/Octopamin wirken nicht als schnelle Erregung (sie wirken über langsame Rezeptoren) | Riechen bleibt duftspezifisch |
| Bitter-Geschmackszellen sind laut ML-Vorhersage serotonerg | Sinneszellen (außer Photorezeptoren) sind cholinerg | Bitter hemmt das Fressen wieder |
| 9.169 Neuronen ohne Transmitter-Vorhersage | Mehrheit des Zelltyps übernehmen | – |
| Hemm-Neuron APL feuert mit 300 Hz und erstickt alle MBONs | APL→MBON weglassen (APL ist im Tier nicht-spikend und lokal) | MBONs antworten auf Düfte |
| Alle Düfte aktivieren dieselben Kenyon-Zellen (bis 99 % Überlappung) | erregende lokale Neuronen im Riechlappen halb so stark (ihre Wirkung läuft im Tier großteils über elektrische Synapsen) | 1–22 % Überlappung, wie gemessen |
| Rückgekoppelte Kreise (SMP177 ↔ CRE011) schaukeln sich auf 250 Hz hoch und blockieren das Fressen | Spike-Frequenz-Adaptation (1 mV pro Spike, 200 ms) | Duft blockiert das Fressen nicht mehr |
| MBONs ohne Spontanaktivität reagieren alles-oder-nichts | Hintergrund-Synapsen auf MBONs (~5 mV) | abgestufte Antworten |

### Prüfen

```sh
node fliege/tools/lernen_test.js     # ~10 Minuten; schreibt die Kalibrierung data/lernen.json
```

Ergebnis des letzten Laufs (Node, gleiche Rechnung wie im Browser):

| Prüfung | Ergebnis |
| --- | --- |
| Zucker 80 Hz → MN9 | 32 / 35 Hz → Rüssel raus |
| Zucker 20 Hz (satte Fliege) → MN9 | 0 Hz |
| Zucker + Bitter → MN9 | 4 / 12 Hz (gehemmt) |
| Zucker + Bananenduft → MN9 | 18 / 22 Hz (Duft blockiert das Fressen nicht) |
| Gefahr links → Riesenfaser / Flucht-Neuronen links : rechts | 25 / 27 Hz, 242 : 0 Spikes |
| Octanol → aktive Kenyon-Zellen | 4,6 % (im Tier ~5 %) |
| **Strafe:** Ethylacetat + Strom, Octanol ohne → Wahl zu Ethylacetat | 6/10 → **0/10**, Bewertung −1,10 → −1,69 |
| **Belohnung:** Ethylacetat + Zucker, Octanol ohne → Wahl zu Ethylacetat | 6/10 → **10/10**, Bewertung −1,70 → −0,64 |
| Lernmutante (Lernen aus) | Bewertung bleibt (0,74 → 0,83) |

Ehrliche Grenzen: Octanol ist im Modell schwer zu lernen (die Bewertung verschiebt sich kaum),
4-Methylcyclohexanol aktiviert nur wenige Kenyon-Zellen. Im Browser mit 20 Wahlen:
Ethylacetat + Strom → vorher 9/20, nachher 1/20 Wahlen zu Ethylacetat. In der Wiese: nach drei
Stromschlägen beim Bananenduft fällt die gelernte Bewertung für Banane auf −2 bis −4, und die
Fliege wendet sich von der Banane ab und frisst an der Blume.

Düfte neu bauen (DoOR, CC BY-SA 4.0):

```sh
git clone --depth 1 https://github.com/ropensci/DoOR.data /tmp/DoOR.data
python3 fliege/tools/build_duefte.py /tmp/DoOR.data/data
```

Die einfache 2D-Version der Welt ohne Lernen liegt in `welt-2d.html`.

## Das Modell (Labor-Seite)

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
- Düfte: DoOR 2.0 – Münch & Galizia 2016 (*Sci Rep* 6:21841), **CC BY-SA 4.0**; daraus abgeleitet `data/duefte.json`.
- Lernen und Pilzkörper: Tully & Quinn 1985; Aso et al. 2014 (*eLife*); Hige et al. 2015 (*Neuron*);
  Handler et al. 2019 (*Cell*); Aso et al. 2010; Claridge-Chang et al. 2009; Liu et al. 2012.
- 3D: three.js (MIT).
