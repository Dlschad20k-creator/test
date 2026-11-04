// Schnelltest der Simulation in Node:  node fliege/tools/test_sim.js
// Reizt die Zucker-Geschmacksneuronen und prueft, ob der Rüssel-Motorneuron MN9 feuert.
const fs = require("fs"), zlib = require("zlib"), path = require("path");
require(path.join(__dirname, "..", "sim-worker.js"));
const dir = path.join(__dirname, "..", "data");
const meta = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, "meta.json.gz"))));
const buf = zlib.gunzipSync(fs.readFileSync(path.join(dir, "conn.bin.gz")));
const N = meta.count;
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const offsets = new Uint32Array(ab, 0, N + 1);
const E = offsets[N];
const post = new Uint32Array(ab, (N + 1) * 4, E);
const syn = new Uint16Array(ab, (N + 1) * 4 + E * 4, E);
const ntName = meta.dict.nt;
const ntCode = Uint8Array.from(meta.col.nt, (k) => {
  const n = ntName[k]; return n === "ACH" ? 0 : (n === "GABA" || n === "GLUT") ? 1 : n ? 2 : 3;
});
const find = (re) => meta.label.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0);
const sugar = find(/Sugar Gustatory Receptor Neuron/);
const mn9 = find(/\bMN9\b/);
const bitter = find(/Bitter Gustatory Receptor Neuron|labellar bitter gustatory/i);
console.log("Zucker-GRNs", sugar.length, "MN9", mn9.length, "Bitter", bitter.length, "Kanten", E);
const eng = FlyBrainSim.makeEngine({ offsets, post, syn, ntCode });
for (const [name, params] of [
  ["Ruhe", { stim: [] }],
  ["Zucker 100 Hz", { stim: [{ idx: sugar, rate: 100 }] }],
  ["Zucker 200 Hz", { stim: [{ idx: sugar, rate: 200 }] }],
  ["Zucker+Bitter 200 Hz", { stim: [{ idx: sugar, rate: 200 }, { idx: bitter, rate: 200 }] }],
]) {
  const r = eng.run(Object.assign({ T: 1000 }, params));
  let active = 0; for (const x of r.rates) if (x > 0) active++;
  console.log(name.padEnd(22), "MN9 Hz:", mn9.map((i) => r.rates[i].toFixed(1)).join(", "),
    "| aktiv:", active, "| Spikes:", r.total, "|", r.ms, "ms");
}
