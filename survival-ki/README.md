# Survival-KI Studio

Eine Webseite, mit der du eigene KI-Modelle baust, die nur eins können, das aber richtig:
**Blackout, Survival und Apokalypse**. Du erstellst ein Modell, gibst ihm Wissen, trainierst es und
prüfst mit 42 Testfragen, ob es wirklich Profi ist.

Öffnen: `https://dlschad20k-creator.github.io/test/survival-ki/` (GitHub Pages) oder lokal:

```sh
python3 -m http.server 8000     # im Repo-Ordner
# dann http://localhost:8000/survival-ki/ öffnen
```

Alles läuft im Browser. Die Seite hat keinen eigenen Server und speichert nichts außerhalb deines Geräts.
Nach dem ersten Öffnen funktioniert sie auch **offline**, also auch im Blackout.

## Was die Seite kann

| Bereich | Funktionen |
| --- | --- |
| **Meine Modelle** | 4 fertige Modelle (Krisen-Allrounder, Blackout-Profi, Wildnis-Scout, Apokalypse-Stratege), Assistent für neue Modelle (Name, Modi, Themen, Gehirn, Stil, Ton), vorhandene Modelle aus Ollama, LM Studio, OpenAI oder OpenRouter verbinden, Export/Import als Datei |
| **Trainingsdaten** | 122 geprüfte Profi-Antworten in 21 Themen (Quellen: BBK, DRK, BfS, WHO), mit 374 weiteren Formulierungen; bearbeiten, eigene Beispiele, Import (JSONL, JSON, Alpaca, ShareGPT, CSV), Export (OpenAI-JSONL, Alpaca, ShareGPT, CSV, Notfall-Handbuch), **Mit KI erweitern** (ein Sprachmodell schreibt neue Beispiele, du prüfst sie), Qualitäts-Check |
| **Training** | fünf echte Wege, siehe unten, mit Live-Kurven für Verlust und Genauigkeit und einem Trainingsverlauf |
| **Testen & Chat** | Chat mit jedem Modell, Modus-Auswahl, Quellen aus den Trainingsdaten, Notfall-Hinweis 112, Daumen hoch/runter, gute Antworten als Trainingsbeispiel speichern |
| **Prüfung** | 42 Fragen, davon 8 sicherheitskritische (zählen doppelt) und 6 fremde Themen (die KI soll ablehnen), Noten von Anfänger bis Überlebens-Meister, Vergleich mehrerer Modelle, Bewertung von Hand korrigierbar |
| **Einstellungen** | Ollama, Cloud-API und lokaler Trainer verbinden und testen, hell/dunkel, Sicherung herunterladen und laden |

## Die fünf Trainings-Methoden

1. **Im Browser** (Sekunden, ohne Installation): Ein kleines neuronales Netz (2.048 Eingänge, 48 Neuronen,
   Adam, Dropout, Tippfehler-Varianten) lernt, Fragen den 21 Themen zuzuordnen und fremde Fragen zu erkennen.
   Danach läuft automatisch die Prüfung. Mit den eingebauten Daten steigt die Note dabei von etwa 94 % auf 98 %.
2. **Ollama-Sofortmodell** (1 Minute): Erstellt in Ollama ein eigenes Modell mit Profi-Systemprompt,
   Beispielgesprächen und Parametern, direkt über die Ollama-API oder als `Modelfile`.
3. **Google Colab** (kostenlos): Lädt ein fertiges Notebook mit deinen Trainingsdaten herunter.
   Es trainiert mit [Unsloth](https://docs.unsloth.ai) und LoRA/QLoRA auf der kostenlosen T4-GPU und
   speichert eine GGUF-Datei mit `Modelfile` für Ollama in Google Drive.
4. **Eigener PC**: [`trainer/survival_trainer.py`](trainer/README.md) trainiert mit LoRA auf deiner
   Grafikkarte (oder langsam auf dem Prozessor), zeigt den Fortschritt live auf der Seite, speichert Adapter
   und Gesamtmodell und importiert das Ergebnis in Ollama. Ohne Webseite geht es mit dem Trainingspaket (ZIP).
5. **OpenAI**: Lädt die Daten hoch, startet ein Fine-Tuning und trägt das fertige Modell bei *Meine Modelle* ein.

Jedes Sprachmodell bekommt außerdem einen Survival-Systemprompt und zu jeder Frage die passendsten
Profi-Antworten aus den Trainingsdaten mitgeschickt (RAG). Bei lebensbedrohlichen Lagen (zum Beispiel
„atmet nicht“, „blutet stark“, Grill oder Generator in Innenräumen) greifen feste Sicherheitsregeln,
damit die Antwort nicht vom Zufall der Suche abhängt.

## Ollama verbinden

1. Ollama von [ollama.com](https://ollama.com) installieren und ein Modell laden, z. B. `ollama pull qwen2.5:7b`.
2. Läuft die Seite über GitHub Pages, muss Ollama sie erlauben. Die passenden Befehle zeigt die Seite unter
   *Einstellungen → Ollama → Verbindung klappt nicht?*, zum Beispiel unter Windows:
   `setx OLLAMA_ORIGINS "https://dlschad20k-creator.github.io"`, danach Ollama neu starten.
3. *Meine Modelle → Vorhandenes Modell verbinden*.

## Dateien

```
survival-ki/
  index.html, style.css, sw.js, manifest.webmanifest, icon*.{svg,png}
  js/data.js        Trainingsdaten, Prüfungsfragen, fremde Fragen
  js/engine.js      Offline-KI: Suche (TF-IDF + Trigramme, Synonyme, Wortzerlegung), neuronales Netz, Sicherheitsregeln, Bewertung
  js/store.js       Speicher im Browser, Systemprompt
  js/providers.js   Ollama, OpenAI-kompatible APIs, OpenAI-Fine-Tuning, lokaler Trainer
  js/export.js      Formate, Import, Modelfile, Colab-Notebook, Trainingspaket
  js/charts.js      Diagramme
  js/views/*.js     die Seiten
  trainer/          lokaler LoRA-Trainer (Python)
  tests/            Tests
```

## Tests

```sh
node survival-ki/tests/engine_test.js    # Offline-KI, Training, Prüfung
node survival-ki/tests/export_test.js    # Formate, Import, Notebook (Python-Syntax), ZIP

# Browser-Test mit nachgebautem Ollama und OpenAI:
python3 -m http.server 8090 &
node survival-ki/tests/mock_servers.js &
node survival-ki/tests/e2e.js
# mit echtem lokalen Training (CPU, kleines Modell):
python survival-ki/trainer/survival_trainer.py serve &
LOCAL=1 node survival-ki/tests/e2e.js
```

**Wichtig:** Eine KI ersetzt keine Rettungskräfte. Bei Lebensgefahr immer zuerst die **112** anrufen.
