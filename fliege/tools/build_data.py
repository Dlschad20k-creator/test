#!/usr/bin/env python3
"""
Baut aus den FlyWire-Codex-Rohdaten (Snapshot 783) kompakte Dateien fuer das
Fliegenhirn-Labor im Browser.

Aufruf:
    python3 fliege/tools/build_data.py            # laedt die Rohdaten selbst herunter
    python3 fliege/tools/build_data.py --raw DIR  # nutzt bereits geladene *.csv.gz

Ergebnis (in fliege/data/):
    meta.json.gz   Neuronen: IDs, Zelltyp, Transmitter, Klasse, Seite, Region, Label
    pos.bin.gz     Position je Neuron (3 x Uint16, Einheit 20 nm)
    conn.bin.gz    Verbindungen als CSR: offsets Uint32[N+1], post Uint32[E], syn Uint16[E]

Daten: FlyWire Consortium (Dorkenwald et al. 2024, Schlegel et al. 2024), CC BY-NC 4.0.
"""
import argparse
import gzip
import json
import os
import re
import sys
import urllib.request

import numpy as np
import pandas as pd

VERSION = "783"
URL = "https://storage.googleapis.com/flywire-data/codex/data/fafb/{v}/{f}"
FILES = ["neurons", "classification", "connections", "coordinates",
         "consolidated_cell_types", "labels"]
POS_SCALE = 20  # nm pro Einheit


def fetch(raw):
    os.makedirs(raw, exist_ok=True)
    for f in FILES:
        p = os.path.join(raw, f + ".csv.gz")
        if not os.path.exists(p):
            print("lade", f, "...", flush=True)
            urllib.request.urlretrieve(URL.format(v=VERSION, f=f + ".csv.gz"), p)


def main():
    ap = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("--raw", default=os.path.join(here, "raw"))
    ap.add_argument("--out", default=os.path.join(here, "..", "data"))
    a = ap.parse_args()
    fetch(a.raw)
    rd = lambda f: pd.read_csv(os.path.join(a.raw, f + ".csv.gz"), dtype={"root_id": str})

    neurons = rd("neurons").drop_duplicates("root_id")
    ids = sorted(neurons.root_id)
    idx = {r: i for i, r in enumerate(ids)}
    N = len(ids)
    base = pd.DataFrame({"root_id": ids})

    cls = rd("classification").drop_duplicates("root_id")
    types = rd("consolidated_cell_types").drop_duplicates("root_id")
    df = (base.merge(neurons[["root_id", "group", "nt_type"]], how="left")
              .merge(cls[["root_id", "super_class", "class", "side"]], how="left")
              .merge(types[["root_id", "primary_type", "additional_type(s)"]], how="left"))

    # Verbindungen ueber Neuropile aufsummieren
    print("verarbeite Verbindungen ...", flush=True)
    c = pd.read_csv(os.path.join(a.raw, "connections.csv.gz"),
                    dtype={"pre_root_id": str, "post_root_id": str})
    c["pre"] = c.pre_root_id.map(idx)
    c["post"] = c.post_root_id.map(idx)
    c = c.dropna(subset=["pre", "post"])
    c["pre"] = c.pre.astype(np.int64)
    c["post"] = c.post.astype(np.int64)

    # Transmitter-Fallback: Mehrheit der Synapsen-Vorhersagen des Neurons
    maj = (c.groupby(["pre", "nt_type"]).syn_count.sum().reset_index()
             .sort_values("syn_count").drop_duplicates("pre", keep="last"))
    nt = df.nt_type.copy()
    fb = pd.Series(maj.nt_type.values, index=maj.pre.values)
    miss = nt.isna()
    nt[miss] = fb.reindex(np.where(miss)[0]).values
    df["nt_type"] = nt

    agg = c.groupby(["pre", "post"], sort=True).syn_count.sum().reset_index()
    pre = agg.pre.values
    post = agg.post.values.astype(np.uint32)
    syn = np.minimum(agg.syn_count.values, 65535).astype(np.uint16)
    offsets = np.zeros(N + 1, dtype=np.uint32)
    np.add.at(offsets, pre + 1, 1)
    offsets = np.cumsum(offsets).astype(np.uint32)
    print(f"  {N} Neuronen, {len(agg)} Verbindungen, {int(syn.sum())} Synapsen")

    # Positionen
    co = rd("coordinates").drop_duplicates("root_id")
    xyz = co.position.str.strip("[]").str.split(expand=True).astype(float)
    co = pd.DataFrame({"root_id": co.root_id, "x": xyz[0], "y": xyz[1], "z": xyz[2]})
    p = base.merge(co, how="left")[["x", "y", "z"]]
    p = p.fillna(p.median())
    pos = np.clip(np.round(p.values / POS_SCALE), 0, 65535).astype(np.uint16)

    # Labels: erstes, kuerzestes sinnvolles Label je Neuron
    lab = rd("labels")[["root_id", "label"]].dropna()
    lab["label"] = lab.label.str.replace(r"\s+", " ", regex=True).str.strip()
    lab = lab[lab.label.str.len() > 0].drop_duplicates()
    lab = lab.groupby("root_id").label.apply(lambda s: " | ".join(list(dict.fromkeys(s))[:3])[:160])
    df["label"] = df.root_id.map(lab).fillna("")

    def enc(col):
        vals = df[col].fillna("").astype(str)
        d = sorted(set(vals))
        m = {v: i for i, v in enumerate(d)}
        return d, [m[v] for v in vals]

    meta = {"version": VERSION, "count": N, "posScale": POS_SCALE,
            "ids": ids, "dict": {}, "col": {}}
    for key, col in [("type", "primary_type"), ("nt", "nt_type"), ("sc", "super_class"),
                     ("cls", "class"), ("side", "side"), ("group", "group")]:
        meta["dict"][key], meta["col"][key] = enc(col)
    meta["alt"] = df["additional_type(s)"].fillna("").astype(str).tolist()
    meta["label"] = df.label.tolist()

    os.makedirs(a.out, exist_ok=True)
    with gzip.open(os.path.join(a.out, "meta.json.gz"), "wt", compresslevel=9) as f:
        json.dump(meta, f, separators=(",", ":"))
    with gzip.open(os.path.join(a.out, "pos.bin.gz"), "wb", compresslevel=9) as f:
        f.write(pos.tobytes())
    with gzip.open(os.path.join(a.out, "conn.bin.gz"), "wb", compresslevel=9) as f:
        f.write(offsets.tobytes()); f.write(post.tobytes()); f.write(syn.tobytes())
    for fn in ["meta.json.gz", "pos.bin.gz", "conn.bin.gz"]:
        print(" ", fn, round(os.path.getsize(os.path.join(a.out, fn)) / 1e6, 1), "MB")


if __name__ == "__main__":
    sys.exit(main())
