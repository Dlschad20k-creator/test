/*
 * Fliegenkino: verbindet die Facettenaugen (augen.js) mit den echten Projektionsneuronen
 * des Konnektoms und liest die Reaktionen des Gehirns aus.
 */
(function (root) {
  "use strict";
  // Projektionsneuronen und ihr Merkmal (Ache et al. 2019; von Reyn et al. 2017; Keles & Frye 2017;
  // Ribeiro et al. 2018; Hausen 1982; Krapp & Hengstenberg 1996)
  const VPN_DEF = {
    LPLC2: { feat: "expand", gain: 2.2e4, r: 30 },   // Ausdehnung in alle Richtungen -> Riesenfaser
    LC4: { feat: "loomDark", gain: 3.0e4, r: 35 },   // dunkles Objekt kommt naeher -> Flucht
    LC10a: { feat: "small", gain: 320, r: 18 },      // kleines bewegtes Objekt -> Hinwenden
    LC11: { feat: "small", gain: 320, r: 18 },       // kleines bewegtes Objekt
  };
  // Lage im Gesichtsfeld (0..1) je Neuron aus seiner Lage im Konnektom (Hauptachsen je Typ und Seite);
  // Rang-Normierung verteilt die Neuronen gleichmaessig, denn jeder Typ kachelt das Gesichtsfeld
  function rfCenters(D, idx) {
    const P = idx.map((i) => [D.pos[i * 3], D.pos[i * 3 + 1], D.pos[i * 3 + 2]]);
    const c = [0, 1, 2].map((a) => P.reduce((s, p) => s + p[a], 0) / P.length);
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of P) { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b]; }
    const pw = (M, ex) => { let v = [1, 0.3, 0.2]; for (let k = 0; k < 200; k++) { let w = [0, 1, 2].map((a) => M[a][0] * v[0] + M[a][1] * v[1] + M[a][2] * v[2]); if (ex) { const d = w[0] * ex[0] + w[1] * ex[1] + w[2] * ex[2]; w = w.map((x, a) => x - d * ex[a]); } const n = Math.hypot(...w) || 1; v = w.map((x) => x / n); } return v; };
    let a1 = pw(C), a2 = pw(C, a1); if (a1[1] < 0) a1 = a1.map((x) => -x); if (a2[2] > 0) a2 = a2.map((x) => -x);
    const pr = P.map((p) => { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; return [d[0] * a1[0] + d[1] * a1[1] + d[2] * a1[2], d[0] * a2[0] + d[1] * a2[1] + d[2] * a2[2]]; });
    const rank = (arr) => { const o = arr.map((v, k) => [v, k]).sort((a, b) => a[0] - b[0]); const r = new Float32Array(arr.length); o.forEach(([, k], j) => (r[k] = (j + 0.5) / arr.length)); return r; };
    const ru = rank(pr.map((p) => p[0])), rv = rank(pr.map((p) => p[1]));
    return idx.map((i, n) => ({ i, u: ru[n], v: rv[n] }));
  }
  function visualNeurons(D) {
    const T = (i) => D.dict.type[D.type[i]] || "", SD = (i) => D.dict.side[D.side[i]];
    const list = [], counts = {};
    for (const [type, def] of Object.entries(VPN_DEF)) for (const side of ["left", "right"]) {
      const idx = []; for (let i = 0; i < D.N; i++) if (T(i) === type && SD(i) === side) idx.push(i);
      counts[type] = (counts[type] || 0) + idx.length;
      for (const c of rfCenters(D, idx)) list.push(Object.assign(c, { type, def, eye: side === "left" ? 0 : 1 }));
    }
    const hs = [[], []], vs = [[], []];
    for (let i = 0; i < D.N; i++) { const t = T(i), s = SD(i) === "left" ? 0 : 1; if (/^HS[ENS]$/.test(t)) hs[s].push(i); if (/^VS\d$/.test(t)) vs[s].push(i); }
    counts.HS = hs[0].length + hs[1].length; counts.VS = vs[0].length + vs[1].length;
    return { list, hs, vs, counts };
  }
  // Blickfelder fuer ein bestimmtes Augen-Objekt (Gesichtsfeld haengt vom Videoformat ab) vorberechnen
  function bindEyes(S, V) {
    const FE = root.FlyEyes, cache = new Map(), bound = [];
    for (const n of V.list) {
      const sg = n.eye === 0 ? 1 : -1;
      const el = (0.5 - n.u) * 2 * S.fieldEl, az = sg * (-10 + n.v * (S.fieldAz + 10));
      const key = n.eye + ":" + Math.round(az / 5) + ":" + Math.round(el / 5) + ":" + n.def.r;
      let rf = cache.get(key); if (rf === undefined) { rf = FE.makeRF(S, n.eye, Math.round(az / 5) * 5, Math.round(el / 5) * 5, n.def.r); cache.set(key, rf); }
      if (rf) bound.push({ i: n.i, rf, def: n.def, eye: n.eye, az, el, type: n.type });
    }
    S.bound = bound; S.rfs = [...new Set(bound.map((b) => b.rf))];
    return bound.length;
  }
  // Eingangs-Raten der Projektionsneuronen aus den Augen (ein Aufruf je Bild)
  function drives(S, V) {
    const FE = root.FlyEyes, idx = [], rates = [];
    const fx = new Map(); for (const rf of S.rfs) fx.set(rf, FE.rfEval(S, rf));
    const act = { expand: 0, loom: 0, small: 0 };
    for (const b of S.bound) {
      const f = fx.get(b.rf); let x = 0;
      if (b.def.feat === "expand") x = f.expand;
      else if (b.def.feat === "loomDark") x = Math.min(f.expandOff, 1) * (0.5 + f.off * 4);
      else x = Math.max(0, f.small - 0.03);
      const hz = Math.min(150, x * b.def.gain);
      if (hz > 3) { idx.push(b.i); rates.push(hz); if (b.def.feat === "expand") act.expand++; else if (b.def.feat === "loomDark") act.loom++; else act.small++; }
    }
    for (const e of [0, 1]) {
      const w = FE.wideField(S, e);
      const hsHz = Math.min(120, Math.max(0, w.fb) * 1.5e4), vsHz = Math.min(120, w.v * 1.5e4);
      if (hsHz > 3) for (const i of V.hs[e]) { idx.push(i); rates.push(hsHz); }
      if (vsHz > 3) for (const i of V.vs[e]) { idx.push(i); rates.push(vsHz); }
    }
    return { idx, rates, act };
  }
  // Ausgaenge: Reaktionen des Gehirns
  function outputs(D, daList) {
    const T = (i) => D.dict.type[D.type[i]] || "", SD = (i) => D.dict.side[D.side[i]];
    const g = (re, side) => { const o = []; for (let i = 0; i < D.N; i++) if (re.test(T(i)) && (!side || SD(i) === side)) o.push(i); return o; };
    const O = {
      gf: g(/^DNp01$/), esc: g(/^DNp0(2|4)$|^DNp11$/),
      turnL: g(/^DNa02$/, "left"), turnR: g(/^DNa02$/, "right"),
      hin: g(/^DNp09$/), hs: g(/^HS[ENS]$/), vs: g(/^VS\d$/), da: daList || [],
    };
    O.role = new Int8Array(D.N).fill(-1);
    const names = ["gf", "esc", "turnL", "turnR", "hin", "hs", "vs", "da"]; O.names = names;
    names.forEach((k, r) => { for (const i of O[k]) if (O.role[i] < 0) O.role[i] = r; });
    return O;
  }
  function newAcc(O) { return { cnt: new Float64Array(O.names.length), ms: 0, sp: 0 }; }
  function accumulate(acc, O, spikes, ms) { for (let n = 0; n < spikes.length; n++) { const r = O.role[spikes[n]]; if (r >= 0) acc.cnt[r]++; } acc.ms += ms; acc.sp += spikes.length; }
  function rate(acc, O, k) { const r = O.names.indexOf(k); return acc.cnt[r] / Math.max(1, O[k].length) / Math.max(0.001, acc.ms / 1000); }
  function summary(acc, O) {
    return {
      schreck: rate(acc, O, "gf") + 0.5 * rate(acc, O, "esc"),
      folgenL: rate(acc, O, "turnL"), folgenR: rate(acc, O, "turnR"),
      hin: rate(acc, O, "hin"), fluss: rate(acc, O, "hs") + rate(acc, O, "vs"), da: rate(acc, O, "da"),
      total: acc.sp / Math.max(0.001, acc.ms / 1000),
    };
  }
  root.FlyKino = { VPN_DEF, visualNeurons, bindEyes, drives, outputs, newAcc, accumulate, summary, rate };
  if (typeof module !== "undefined") module.exports = root.FlyKino;
})(typeof self !== "undefined" ? self : globalThis);
