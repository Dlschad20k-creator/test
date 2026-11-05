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

## Fliegenkino (`kino.html`)

Der Fliege ein Video zeigen (Datei oder eingebauter Testfilm; das Video bleibt im Browser). Sie
schaut es **live** an: Jedes Bild, das im Video erscheint, geht sofort in ihre zwei Facettenaugen,
und ihr Gehirn reagiert. Schafft das Gehirn die Echtzeit nicht, läuft das Video automatisch
langsamer („Zeitlupe“), statt zu ruckeln. Quer- und Hochkant-Videos: Das Gesichtsfeld passt sich
dem Format an. Kommen mehr als 4 Sekunden nur schwarze Bilder an (typisch für Videoformate, die
der Browser nicht entschlüsseln kann, z. B. HEVC vom iPhone), erscheint ein Hinweis mit Tipps.

| Stufe | Wie |
| --- | --- |
| Augen und Sehlappen (`augen.js`) | **klassisches Modell**: je Auge ~225 Ommatidien (5°), Anpassung, AN/AUS-Kanäle, Bewegungsdetektoren nach Hassenstein & Reichardt (T4/T5), Ausdehnungs-, Annäherungs- und Kleinobjekt-Detektion mit Umfeld-Hemmung; ~0,4 ms pro Bild |
| Projektionsneuronen (`kino-setup.js`) | LPLC2, LC4, LC10a, LC11, HS, VS im Konnektom bekommen diese Signale, je Neuron nach seiner Lage im Gesichtsfeld |
| Gehirn | echtes FlyWire-Netz mit den Korrekturen aus `brain-setup.js` |
| Urteil | absteigende Neuronen: DNa02 (zum Objekt drehen) und DNp09 (loslaufen) = gut; Riesenfaser DNp01 und Flucht-Neuronen DNp02/04/11 = Schreck |

Warum die ersten Sehstufen ein Modell sind: Photorezeptoren und Lamina arbeiten im Tier mit
abgestuften Spannungen und Histamin, nicht mit Spikes. Getestet: Treibt man die Photorezeptoren
oder die Lamina im Spike-Modell an, kommt hinten fast nichts an. Ab den Projektionsneuronen
stimmt die Verdrahtung mit der Literatur überein (LPLC2 → Riesenfaser, LC4 → DNp02/04/11,
LC10a → DNa02 auf derselben Seite).

Prüfen: `node fliege/tools/kino_test.js` – Ergebnis des letzten Laufs:

| Testfilm | Reaktion |
| --- | --- |
| Standbild | nichts |
| Etwas fliegt links heran | Schreck 5,8 Hz (Riesenfaser + Flucht), Bildfluss |
| Kleine Fliege links / rechts | Hinwenden links 23,5 Hz / rechts 9,5 Hz |
| Langsame kleine Fliege (11°/s) | Hinwenden links 31 Hz |
| Landschaft zieht vorbei | Bildfluss 41 Hz, kaum Hinwenden |
| Handyvideo mit Rauschen und Wackeln | nichts (keine Fehlalarme) |

## Dopamin-Experiment (Kino und Fliegenwelt)

Ein Regler von 0 % (wie der Hemmstoff **3IY**, der die Dopamin-Herstellung blockiert) bis 300 %
(wie **L-DOPA**). Wirkung im Modell (`brain-setup.js`, `dopamine`):

- **538 Dopamin-Neuronen**: die bekannten Dopamin-Cluster (PAM, PPL1/2, PPM, PAL) und Zelltypen,
  deren Neuronen mehrheitlich als dopaminerg vorhergesagt sind. Gezählt wird der Zelltyp, nicht
  die Einzelvorhersage – die hält z. B. manche Borsten-Sinneszellen und Photorezeptoren für
  dopaminerg. Bei mehr Dopamin feuern sie von selbst (bis 12 Hz).
- **4.586 Neuronen**, die im Konnektom Dopamin-Synapsen bekommen, werden erregbarer (bis +4 mV),
  bei weniger Dopamin weniger erregbar. Vereinfachung: Im Tier gibt es auch hemmende
  Dopamin-Rezeptoren (D2R); hier zählt nur die Netto-Wirkung über cAMP (D1-artig).
- Das Lernen im Pilzkörper skaliert mit der Dopamin-Menge. In der Fliegenwelt läuft sie wacher
  herum (Körper-Regel nach Kume et al. 2005; Andretic et al. 2005).

`node fliege/tools/dopamin_test.js` – je 1 s, Mittel aus 6 Läufen:

| Dopamin | Ruhe | Zucker → aktive Neuronen / Rüssel-Befehl MN9 | Gefahr (LC4) → aktiv / Riesenfaser | Duft (Octanol) → aktiv |
| --- | --- | --- | --- | --- |
| 0 % (3IY) | 0 | 165 / 5,2 Hz | 196 / 11,3 Hz | 2.029 |
| 100 % | 0 | 199 / 6,7 Hz | 195 / 10,6 Hz | 2.298 |
| 200 % | 537 | 711 / 7,1 Hz | 728 / 10,4 Hz | 2.903 |
| 300 % (L-DOPA) | 538 | 728 / 9,3 Hz | 691 / 8,1 Hz | 2.986 |

Mehr Dopamin macht das Gehirn bei jedem Reiz aktiver, und der Fressbefehl wird stärker – passend
zu Marella et al. 2012 (Dopamin erhöht die Rüssel-Reaktion). Die Riesenfaser (Flucht) wird
dagegen nicht stärker, eher etwas schwächer. In Ruhe feuern nur die Dopamin-Neuronen selbst;
eine Dauererregung des ganzen Gehirns entsteht nicht.

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
