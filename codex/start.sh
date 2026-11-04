#!/usr/bin/env sh
# Startet Codex lokal: installiert Abhaengigkeiten, baut beim ersten Mal die
# Fliegenhirn-Datenbank aus den FlyWire-Rohdaten und startet den Server.
# Danach im Browser: http://localhost:5000
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q Flask==3.0.3 requests==2.31.0 user-agents==2.2.0 nglui==2.7.2
fi
PATH="$PWD/.venv/bin:$PATH"
# Wichtig: die Datenbank selbst bauen. Die fertige Datei auf dem FlyWire-Server
# passt nicht zum oeffentlichen Code (Fehler "No module named codex.data.connections_v2").
if [ ! -f static/data/783/neuron_db.pickle.gz ]; then
  echo "Baue die Datenbank (laedt ca. 80 MB, dauert ein paar Minuten) ..."
  python3 -m codex.data.local_data_loader
fi
sh scripts/run_local.sh
