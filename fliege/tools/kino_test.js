// Prueft das Fliegenkino in Node: kuenstliche Testfilme -> Facettenaugen -> Projektionsneuronen -> Konnektom.
//   node fliege/tools/kino_test.js
"use strict";
const fs = require("fs"), zlib = require("zlib"), path = require("path");
const ROOT = path.join(__dirname, "..");
require(path.join(ROOT, "sim-worker.js"));
const S = require(path.join(ROOT, "brain-setup.js"));
const EY = require(path.join(ROOT, "augen.js"));
const K = require(path.join(ROOT, "kino-setup.js"));
const meta = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, "data/meta.json.gz"))));
const buf = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, "data/conn.bin.gz")));
const posB = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, "data/pos.bin.gz")));
const N = meta.count, ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const offsets = new Uint32Array(ab, 0, N + 1), E = offsets[N];
const D = { N, meta, dict: meta.dict, label: meta.label, offsets, post: new Uint32Array(ab, (N + 1) * 4, E), syn: new Uint16Array(ab, (N + 1) * 4 + E * 4, E) };
for (const k of Object.keys(meta.col)) D[k] = Uint32Array.from(meta.col[k]);
D.pos = new Uint16Array(posB.buffer.slice(posB.byteOffset, posB.byteOffset + posB.byteLength));
const net = S.realisticNet(D), eng = FlyBrainSim.makeEngine(net);
const VPN = K.visualNeurons(D), OUT = K.outputs(D);
console.log("Projektionsneuronen:", Object.entries(VPN.counts).map(([k, v]) => k + " " + v).join(", "));
const W = 96, H = 56;
function frame(fn, t) { const lum = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lum[y * W + x] = fn(x / (W - 1) * 2 - 1, y / (H - 1) * 2 - 1, t); return { w: W, h: H, lum }; }
const FILMS = {
  "Standbild": (x, y, t) => (x * x + y * y < 0.15 ? 0.15 : 0.75),
  "Etwas fliegt auf sie zu (links)": (x, y, t) => { const r = Math.max(0, (t - 300) / 1000) ** 2 * 1.4 + 0.03; return ((x + 0.45) ** 2 + (y * 0.6) ** 2 < r * r ? 0.05 : 0.75); },
  "Kleine Fliege krabbelt (links)": (x, y, t) => { const px = -0.15 - 0.7 * ((t / 1600) % 1), py = 0.1 * Math.sin(t / 150); return ((x - px) ** 2 + ((y - py) * 0.6) ** 2 < 0.0025 ? 0.05 : 0.75); },
  "Kleine Fliege (rechts)": (x, y, t) => { const px = 0.15 + 0.7 * ((t / 1600) % 1), py = 0.1 * Math.sin(t / 150); return ((x - px) ** 2 + ((y - py) * 0.6) ** 2 < 0.0025 ? 0.05 : 0.75); },
  "Landschaft zieht vorbei": (x, y, t) => 0.45 + 0.3 * Math.sign(Math.sin((x * 5 + t / 1000 * 2.5) * Math.PI)) * (y > -0.2 ? 1 : 0.4),
  "Langsame Fliege (11°/s)": (x, y, t) => { const px = -0.1 - 0.18 * (t / 1000); return ((x - px) ** 2 + ((y + 0.4) * 0.6) ** 2 < 0.0016 ? 0.08 : 0.8); },
  "Handyvideo: Rauschen + Wackeln": (x, y, t) => { const j = 0.012 * Math.sin(t / 37) + 0.008 * Math.sin(t / 13); const v = (Math.sin((x + j) * 9) * Math.cos((y + j) * 7) > 0.2 ? 0.7 : 0.35); return v + (Math.random() - 0.5) * 0.06; },
};
const ms = 2000;
for (const [name, fn] of Object.entries(FILMS)) {
  const eyes = EY.makeEyes({ aspect: W / H }), L = eng.live(Object.assign({}, S.SIM, { seed: 1 }));
  K.bindEyes(eyes, VPN);
  const acc = K.newAcc(OUT); let t0 = Date.now();
  for (let t = 0; t < ms; t += 20) {
    if (t % 40 === 0) EY.sample(eyes, frame(fn, t));
    EY.step(eyes, 20);
    const inp = K.drives(eyes, VPN); L.setInput(inp.idx, inp.rates);
    const sp = L.step(20); K.accumulate(acc, OUT, sp, 20);
  }
  const r = K.summary(acc, OUT);
  console.log(`${name.padEnd(32)} ${Date.now() - t0}ms | Schreck ${r.schreck.toFixed(1)} | Verfolgen L/R ${r.folgenL.toFixed(1)}/${r.folgenR.toFixed(1)} | Hinlaufen ${r.hin.toFixed(1)} | Bildfluss ${r.fluss.toFixed(1)} | Gehirn ${(r.total / 1000).toFixed(1)}k Spikes/s`);
}
