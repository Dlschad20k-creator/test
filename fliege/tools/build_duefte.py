#!/usr/bin/env python3
"""
Baut fliege/data/duefte.json aus der DoOR-Datenbank (Muench & Galizia 2016, CC BY-SA 4.0).

Aufruf:
    git clone --depth 1 https://github.com/ropensci/DoOR.data /tmp/DoOR.data
    python3 fliege/tools/build_duefte.py /tmp/DoOR.data/data

Fuer jeden Duft: Aktivierung je Glomerulus (0..1) = DoOR-Konsenswert minus Spontanrate (SFR),
Maximum ueber alle Rezeptoren, die in diesen Glomerulus projizieren.
"""
import csv, gzip, json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
D = sys.argv[1]

def read(path):
    rows = list(csv.reader(open(path, encoding="utf-8"), delimiter=";"))
    head = ["_row"] + rows[0]
    return [dict(zip(head, r)) for r in rows[1:]]

rows = list(csv.reader(open(f"{D}/door_response_matrix.csv", encoding="utf-8"), delimiter=";"))
recs = rows[0]
mat = {r[0]: {recs[i]: (None if v in ("NA", "") else float(v)) for i, v in enumerate(r[1:])} for r in rows[1:]}
odors = {r["InChIKey"]: r for r in read(f"{D}/odor.csv")}
r2g = {m["receptor"]: m["code"] for m in read(f"{D}/door_mappings.csv") if m["adult"] == "TRUE" and m["code"] not in ("", "?", "NA")}
# Rezeptor -> Glomerulus, die in DoOR ohne Zuordnung sind (Couto et al. 2005; Fishilevich & Vosshall 2005; Silbering et al. 2011)
for r, g in {"Or56a": "DA2", "Or47a": "DM3", "Or33b": "DM3", "Or85a": "DM5", "Or49a": "DL4", "Or33c": "VC1", "Or85e": "VC1",
             "Or35a": "VC3", "Or22b": "DM2", "Or65b": "DL3", "Or65c": "DL3", "Ir75b": "DL2d", "Ir75c": "DL2v", "Or98b": "VM5v"}.items():
    r2g.setdefault(r, g)

meta = json.load(gzip.open(os.path.join(here, "..", "data", "meta.json.gz"), "rt"))
flywire = {t[4:] for t in meta["dict"]["type"] if t.startswith("ORN_")}
name2key = {r["Name"].lower(): k for k, r in odors.items() if r.get("Name")}
sfr = mat["SFR"]

def pattern(name):
    row = mat[name2key[name]]
    p = {}
    for r, v in row.items():
        g = r2g.get(r)
        if g not in flywire or v is None:
            continue
        p[g] = max(p.get(g, 0.0), v - (sfr.get(r) or 0.0))
    return {g: round(v, 3) for g, v in sorted(p.items()) if v > 0.05}

SEL = [
    ("3-octanol", "3-Octanol", "pilzig, erdig – klassischer Lern-Duft"),
    ("4-methylcyclohexanol", "4-Methylcyclohexanol", "minzig-holzig – klassischer Lern-Duft"),
    ("benzaldehyde", "Benzaldehyd", "Bittermandel"),
    ("isopentyl acetate", "Isoamylacetat", "Banane"),
    ("ethyl acetate", "Ethylacetat", "fruchtig, Nagellack"),
    ("ethyl butyrate", "Ethylbutyrat", "Ananas"),
    ("linalool", "Linalool", "Blüte, Lavendel"),
    ("geraniol", "Geraniol", "Rose"),
    ("ocimene", "Ocimen", "Blüte, grün"),
    ("methyl salicylate", "Methylsalicylat", "Wintergrün, Blüte"),
    ("acetic acid", "Essigsäure", "Essig"),
    ("ethanol", "Ethanol", "Gärung"),
    ("1-hexanol", "1-Hexanol", "frisch gemähtes Gras"),
    ("2-heptanone", "2-Heptanon", "käsig, fruchtig"),
    ("carbon dioxide", "CO₂", "Stress-Geruch anderer Fliegen"),
]
out = {"quelle": "DoOR 2.0 (Münch & Galizia 2016, Sci Rep 6:21841), CC BY-SA 4.0; Rezeptor→Glomerulus nach DoOR-Mappings, ergänzt nach Couto et al. 2005",
       "duefte": {}}
for key, de, desc in SEL:
    out["duefte"][de] = {"en": key, "riecht": desc, "pattern": pattern(key)}
# Geosmin aktiviert ausschliesslich DA2 (Or56a), Stensmyr et al. 2012 – in der DoOR-Konsensmatrix ohne Wert
out["duefte"]["Geosmin"] = {"en": "geosmin", "riecht": "Schimmel, verdorben", "pattern": {"DA2": 1.0}, "quelle": "Stensmyr et al. 2012"}
path = os.path.join(here, "..", "data", "duefte.json")
json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for k, v in out["duefte"].items():
    print(f"{k:22s} {len(v['pattern']):2d} Glomeruli")
print("->", path, os.path.getsize(path), "Bytes")
