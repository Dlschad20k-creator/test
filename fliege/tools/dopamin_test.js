// Dopamin-Experiment: Wie aktiv ist das Gehirn bei wenig, normal und viel Dopamin?
// Jede Bedingung 1 s simuliert, 6 Wiederholungen (verschiedene Zufalls-Seeds), Mittelwerte.
//   node fliege/tools/dopamin_test.js
"use strict";
const fs = require("fs"), zlib = require("zlib"), path = require("path");
const ROOT = path.join(__dirname, "..");
require(path.join(ROOT, "sim-worker.js"));
const S = require(path.join(ROOT, "brain-setup.js"));
const meta = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, "data/meta.json.gz"))));
const buf = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, "data/conn.bin.gz")));
const N = meta.count, ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const offsets = new Uint32Array(ab, 0, N + 1), E = offsets[N];
const D = { N, meta, dict: meta.dict, label: meta.label, offsets, post: new Uint32Array(ab, (N + 1) * 4, E), syn: new Uint16Array(ab, (N + 1) * 4 + E * 4, E) };
for (const k of Object.keys(meta.col)) D[k] = Uint32Array.from(meta.col[k]);
const net = S.realisticNet(D), G = S.groups(D), DA = S.dopamine(D, net), eng = FlyBrainSim.makeEngine(net);
const odors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/duefte.json"), "utf8")).duefte;
console.log(`Dopamin-Neuronen: ${DA.da.length}, Neuronen mit Dopamin-Synapsen: ${DA.targets}`);
const SEEDS = [1, 2, 3, 4, 5, 6];
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const tests = {
  "Ruhe": { parts: [] },
  "Zucker schmecken": { parts: [[G.sugar, 60]], out: ["MN9 (Rüssel)", G.mn9] },
  "Gefahr links (LC4)": { parts: [[G.lc4L, 50]], out: ["Riesenfaser", G.gf] },
  "Duft (Octanol)": { parts: (() => { const o = S.odorInput(G, odors["3-Octanol"].pattern, 0.5); return [[o.idx, o.rates]]; })() },
};
for (const lvl of [0, 1, 2, 3]) {
  const st = S.dopamineState(lvl), row = [];
  for (const [name, t] of Object.entries(tests)) {
    const act = [], tot = [], out = [];
    for (const seed of SEEDS) {
      const L = eng.live(Object.assign({}, S.SIM, { seed }));
      L.setModulation(DA.R, st.modLvl);
      const idx = [], r = [];
      for (const [ii, rr] of t.parts) { idx.push(...ii); r.push(...(Array.isArray(rr) ? rr : ii.map(() => rr))); }
      if (st.tonicHz > 0) for (const i of DA.da) { idx.push(i); r.push(st.tonicHz); }
      L.setInput(idx, r);
      const c = new Float32Array(N);
      for (let k = 0; k < 50; k++) for (const i of L.step(20)) c[i]++;
      let s = 0, a = 0; for (let i = 0; i < N; i++) { s += c[i]; if (c[i] > 0) a++; }
      act.push(a); tot.push(s); if (t.out) out.push(mean(t.out[1].map((i) => c[i])));
    }
    row.push(`${name}: ${mean(act).toFixed(0)} aktiv, ${(mean(tot) / 1000).toFixed(1)}k Sp/s` + (t.out ? `, ${t.out[0]} ${mean(out).toFixed(1)} Hz` : ""));
  }
  console.log(`Dopamin ×${lvl}: ` + row.join(" | "));
}
