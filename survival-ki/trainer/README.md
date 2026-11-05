# Lokaler Trainer

`survival_trainer.py` trainiert deine Survival-KI mit **LoRA** auf deinem eigenen Rechner und zeigt den
Fortschritt live im Survival-KI Studio (Training → Lokaler Trainer).

## Einrichten

1. Python 3.10 oder neuer installieren.
2. Mit NVIDIA-Grafikkarte: PyTorch mit CUDA nach [pytorch.org](https://pytorch.org/get-started/locally/) installieren.
3. Pakete installieren:

```sh
pip install -r requirements.txt
python survival_trainer.py check
```

## Mit der Webseite (live)

```sh
python survival_trainer.py serve
```

Der Trainer läuft dann auf `http://127.0.0.1:8765`. Er nimmt nur Anfragen von `localhost`, von als Datei
geöffneten Seiten und von `https://dlschad20k-creator.github.io` an. Läuft die Webseite woanders:

```sh
python survival_trainer.py serve --allow-origin https://deine-seite.example
```

## Ohne Webseite (Trainingspaket)

Im Studio unter Training → Lokaler Trainer → „Trainingspaket herunterladen“ bekommst du eine ZIP-Datei mit
`job.json`. Dann:

```sh
python survival_trainer.py train job.json
```

## Ergebnis

Im Ordner `ausgabe/<name>/`:

- `adapter/` – der LoRA-Adapter (klein, nur die gelernten Änderungen)
- `merged/` – das komplette Modell im Hugging-Face-Format
- `Modelfile` – für `ollama create <name> -f Modelfile`

Ist Ollama installiert, versucht der Trainer das Modell gleich selbst zu importieren. Klappt der Import mit
deiner Ollama-Version nicht, gibt es zwei Wege: das Colab-Notebook (erzeugt eine GGUF-Datei, die Ollama immer
lesen kann) oder [llama.cpp](https://github.com/ggml-org/llama.cpp) installieren und den Trainer mit
`LLAMA_CPP_DIR=/pfad/zu/llama.cpp` starten, dann wandelt er das Modell selbst in GGUF um.

Testen kannst du das frisch trainierte Modell auch direkt im Studio-Chat (Anbieter „Lokaler Trainer“).
