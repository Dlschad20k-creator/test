// Prueft das Gehirn der Fliegenwelt in Node – mit genau dem Aufbau, den auch der Browser nutzt.
//   node fliege/tools/lernen_test.js            # Tests + Kalibrierung + Labortraining
//   node fliege/tools/lernen_test.js --schnell  # nur Tests und Kalibrierung
// Schreibt die Kalibrierung nach fliege/data/lernen.json.
"use strict";
const fs = require("fs"), zlib = require("zlib"), path = require("path");
const ROOT = path.join(__dirname, "..");
require(path.join(ROOT, "sim-worker.js"));
const S = require(path.join(ROOT, "brain-setup.js"));
const quick = process.argv.includes("--schnell");

function loadD() {
  const meta = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, "data/meta.json.gz"))));
  const buf = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, "data/conn.bin.gz")));
  const N = meta.count, ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const offsets = new Uint32Array(ab, 0, N + 1), E = offsets[N];
  const D = { N, meta, dict: meta.dict, label: meta.label, offsets, post: new Uint32Array(ab, (N + 1) * 4, E), syn: new Uint16Array(ab, (N + 1) * 4 + E * 4, E) };
  for (const k of Object.keys(meta.col)) D[k] = Uint32Array.from(meta.col[k]);
  return D;
}
const D = loadD();
const net = S.realisticNet(D), G = S.groups(D), P = S.plasticity(D, net, G);
const odors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/duefte.json"), "utf8")).duefte;
console.log(`Netz: ${net.stats.filled} Transmitter ergänzt, ${net.stats.sensory} Sinneszellen auf ACh, ${net.stats.removedAPL} APL→MBON-Kanten entfernt, ${net.stats.eln} eLNs halbiert`);
console.log(`Pilzkörper: ${G.KC.length} Kenyon-Zellen, ${G.MBON.length} MBONs, ${G.DAN.length} Dopamin-Neuronen, ${P.cfg.pair.length} DAN→MBON-Paare (${P.fallback} nach Literatur)`);
const engine = FlyBrainSim.makeEngine(net);

function brain(opts = {}) {
  const L = engine.live(Object.assign({}, S.SIM, { seed: opts.seed || 1 }));
  L.setNoise(G.MBON, S.NOISE.hz, S.NOISE.mv);
  if (opts.learn) L.setupPlasticity(Object.assign({}, P.cfg, opts.learn));
  return L;
}
function setIn(L, parts) { const idx = [], r = []; for (const [ii, rr] of parts) { idx.push(...ii); r.push(...(Array.isArray(rr) ? rr : ii.map(() => rr))); } L.setInput(idx, r); }
function run(L, ms) { const c = new Float32Array(D.N); for (let k = 0; k < ms / 20; k++) for (const i of L.step(20)) c[i]++; return c; }
const hz = (c, list, ms) => list.map((i) => Math.round(c[i] / (ms / 1000)));
const odorIn = (name, conc) => { const o = S.odorInput(G, odors[name].pattern, conc); return [o.idx, o.rates]; };
function typeRates(c, ms) { const r = new Float32Array(P.types.length); G.MBON.forEach((m, mi) => (r[P.tIndex[mi]] += c[m] / (ms / 1000))); for (let k = 0; k < r.length; k++) r[k] /= P.tCount[k]; return r; }

let ok = true; const check = (cond, msg) => { console.log((cond ? "  ✓ " : "  ✗ ") + msg); ok = ok && cond; };
const t0 = Date.now();
{ // Grundverhalten
  let L = brain(); setIn(L, [[G.sugar, 80]]); let c = run(L, 1000); const m9 = hz(c, G.mn9, 1000);
  check(Math.max(...m9) > 15, `Zucker 80 Hz → MN9 ${m9.join("/")} Hz (Rüssel raus)`);
  L = brain(); setIn(L, [[G.sugar, 20]]); c = run(L, 1000); check(Math.max(...hz(c, G.mn9, 1000)) < 6, `Zucker 20 Hz (satt) → MN9 ${hz(c, G.mn9, 1000).join("/")} Hz`);
  L = brain(); setIn(L, [[G.sugar, 80], [G.bitter, 90]]); c = run(L, 1000); check(Math.max(...hz(c, G.mn9, 1000)) < 0.5 * Math.max(...m9), `Zucker + Bitter → MN9 ${hz(c, G.mn9, 1000).join("/")} Hz (gehemmt)`);
  { const ban = S.mix(odors, [["Isoamylacetat", 1], ["Ethylacetat", 0.4], ["Ethanol", 0.3], ["Ethylbutyrat", 0.25]]); const bo = S.odorInput(G, ban, 0.5);
    L = brain(); setIn(L, [[G.sugar, 80], [bo.idx, bo.rates]]); c = run(L, 1000); const m = hz(c, G.mn9, 1000);
    check(Math.max(...m) > 0.5 * Math.max(...m9), `Zucker + Bananenduft → MN9 ${m.join("/")} Hz (Duft blockiert das Fressen nicht)`); }
  L = brain(); setIn(L, [[G.lc4L, 80]]); c = run(L, 600);
  const gf = hz(c, G.gf, 600), eL = G.escL.reduce((a, i) => a + c[i], 0), eR = G.escR.reduce((a, i) => a + c[i], 0);
  check(Math.max(...gf) > 5 && eL > 3 * eR, `Gefahr links → Riesenfaser ${gf.join("/")} Hz, Flucht-Neuronen links ${eL} vs. rechts ${eR} Spikes`);
  L = brain(); setIn(L, [odorIn("3-Octanol", 0.6)]); c = run(L, 1000);
  const kc = G.KC.filter((i) => c[i] > 0).length;
  check(kc > 0.02 * G.KC.length && kc < 0.2 * G.KC.length, `Octanol → ${kc} Kenyon-Zellen aktiv (${(kc / G.KC.length * 100).toFixed(1)} %, sparsam wie im Tier)`);
}
// Kalibrierung: Referenzantwort je MBON-Typ (Mittel ueber mehrere Duefte) und Ruhewert
const REF = ["3-Octanol", "4-Methylcyclohexanol", "Isoamylacetat", "Linalool", "Benzaldehyd", "Essigsäure"];
const ref = new Float32Array(P.types.length);
{
  const L = brain({ seed: 2 });
  for (const o of REF) { setIn(L, [odorIn(o, S.TMAZE.conc)]); const r = typeRates(run(L, 1000), 1000); for (let k = 0; k < r.length; k++) ref[k] += r[k] / REF.length; setIn(L, []); run(L, 400); }
  setIn(L, []); const air = S.valence(P, typeRates(run(L, 2000), 2000), ref);
  const naive = {}; for (const o of Object.keys(odors)) { setIn(L, [odorIn(o, S.TMAZE.conc)]); naive[o] = +(S.valence(P, typeRates(run(L, 1000), 1000), ref) - air).toFixed(3); setIn(L, []); run(L, 400); }
  const out = { hinweis: "Automatisch erzeugt von tools/lernen_test.js – Referenzraten der MBON-Typen fuer die Verhaltens-Auslese", typen: P.types, vorzeichen: Array.from(P.tSign, (x) => +x.toFixed(3)), referenz: Array.from(ref, (x) => +x.toFixed(2)), ruhe: +air.toFixed(3), naiv: naive };
  fs.writeFileSync(path.join(ROOT, "data/lernen.json"), JSON.stringify(out, null, 1));
  console.log("Kalibrierung gespeichert. Angeborene Bewertung (naiv, >0 = anziehend):", Object.entries(naive).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(", "));
}
if (!quick) {
  // Labortraining wie Tully & Quinn 1985, verkuerzt: CS+ mit US, CS- ohne; Wahltest im T-Labyrinth vorher und nachher
  let seedR = 12345; const rnd = () => ((seedR = (seedR * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const C = S.TMAZE.conc, BETA = S.TMAZE.beta;
  function choice(L, A, B, bias) { // Fliege riecht abwechselnd in beide Arme und entscheidet
    let va = 0, vb = 0;
    for (let r = 0; r < 2; r++) {
      setIn(L, [A]); va += S.valence(P, typeRates(run(L, 500), 500), ref); setIn(L, []); run(L, 200);
      setIn(L, [B]); vb += S.valence(P, typeRates(run(L, 500), 500), ref); setIn(L, []); run(L, 200);
    }
    const dv = (va - vb) / 2; return { dv, toA: rnd() < 1 / (1 + Math.exp(-BETA * (dv - bias))) };
  }
  function test(L, A, B, n, bias) { let toA = 0, dv = 0, sq = 0; for (let k = 0; k < n; k++) { const c = choice(L, A, B, bias); toA += c.toA; dv += c.dv / n; sq += c.dv * c.dv / n; } return { toA, n, dv, sd: Math.sqrt(Math.max(0, sq - dv * dv)) }; }
  function protocol(csPlus, csMinus, us, reps, seed, learnOff) {
    const L = brain({ seed, learn: {} }); if (learnOff) L.setLearning(false);
    const A = odorIn(csPlus, C), B = odorIn(csMinus, C), U = [us === "strafe" ? G.PUNISH : G.REWARD, S.US_HZ];
    // Abgleich wie im Labor: naive Fliege soll 50:50 waehlen (entspricht dem Einstellen der Duftstaerken)
    const cal = test(L, A, B, 6, 0); const bias = cal.dv;
    const before = test(L, A, B, 10, bias);
    for (let s = 0; s < reps; s++) { setIn(L, [A]); run(L, 400); setIn(L, [A, U]); run(L, 800); setIn(L, [A]); run(L, 300); setIn(L, []); run(L, 300); }
    setIn(L, []); run(L, 1500);
    for (let s = 0; s < reps; s++) { setIn(L, [B]); run(L, 1500); setIn(L, []); run(L, 300); }
    setIn(L, []); run(L, 1500);
    const after = test(L, A, B, 10, bias);
    return { before, after };
  }
  const reps = 6;
  const pairs = [["3-Octanol", "Ethylacetat"], ["3-Octanol", "4-Methylcyclohexanol"]];
  for (const us of ["strafe", "belohnung"]) for (const [a, b] of pairs) {
    const r1 = protocol(a, b, us, reps, 5), r2 = protocol(b, a, us, reps, 6);
    // Anteil zum CS+ vorher/nachher; Lernindex = Aenderung, Vorzeichen so, dass Lernen positiv ist
    const shift = (r) => (r.after.toA - r.before.toA) / r.after.n;
    const PI = (us === "strafe" ? -1 : 1) * (shift(r1) + shift(r2)) / 2;
    const f = (r) => `${r.before.toA}/${r.before.n} → ${r.after.toA}/${r.after.n} (ΔV ${r.before.dv.toFixed(2)}±${r.before.sd.toFixed(2)} → ${r.after.dv.toFixed(2)}±${r.after.sd.toFixed(2)})`;
    console.log(`${us === "strafe" ? "Strafe" : "Belohnung"} ${a} / ${b}: ${a}+ zum CS+ ${f(r1)} | ${b}+ zum CS+ ${f(r2)} → Lernindex ${PI.toFixed(2)}`);
    if (a === "3-Octanol" && b === "Ethylacetat") check(PI >= 0.2, `${us}: die Fliege hat gelernt (Lernindex ${PI.toFixed(2)})`);
  }
  { // Kontrolle: rutabaga-Mutante (Lernen aus)
    const r = protocol("3-Octanol", "Ethylacetat", "strafe", reps, 7, true);
    const sh = (r.after.toA - r.before.toA) / r.after.n;
    console.log(`Mutante ohne Lernen: zum CS+ ${r.before.toA}/10 → ${r.after.toA}/10 (ΔV ${r.before.dv.toFixed(2)} → ${r.after.dv.toFixed(2)})`);
    check(Math.abs(r.after.dv - r.before.dv) < 0.25, "Mutante ohne Lernen: Bewertung bleibt gleich");
  }
}
console.log(`${ok ? "Alles bestanden" : "FEHLER"} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(ok ? 0 : 1);
