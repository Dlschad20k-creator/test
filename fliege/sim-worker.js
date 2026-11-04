/*
 * Ganzhirn-Simulation der Fruchtfliege (Leaky Integrate-and-Fire).
 * Modell und Standardwerte nach Shiu et al. 2024, Nature
 * "A Drosophila computational brain model reveals sensorimotor processing".
 *
 *   dv/dt = (v0 - v + g) / tauM      (nicht waehrend der Refraktaerzeit)
 *   dg/dt = -g / tauS
 *   Spike bei v > vTh  ->  v = vReset, nach 'delay' ms: g_post += syn * wSyn * Vorzeichen
 *   Gereizte Neuronen bekommen Poisson-Eingaenge mit Gewicht fPoi * wSyn.
 *
 * Laeuft als Web Worker (Browser) oder direkt in Node (siehe tools/test_sim.js).
 */
(function (root) {
  "use strict";

  const DEFAULTS = {
    T: 1000,        // ms simulierte Zeit
    dt: 0.1,        // ms Zeitschritt
    trials: 1,
    v0: -52, vReset: -52, vTh: -45, // mV
    tauM: 20, tauS: 5,               // ms
    refractory: 2.2, delay: 1.8,     // ms
    wSyn: 0.275,                     // mV pro Synapse
    fPoi: 250,                       // Staerke eines Poisson-Eingangs (x wSyn)
    modSign: 1,                      // Dopamin/Serotonin/Octopamin: 1 erregend, -1 hemmend, 0 ignorieren
    rasterCap: 400000,               // max. gespeicherte Spikes fuer das Raster (erster Durchlauf)
    seed: 1,
  };

  // Transmitter-Codes: 0 erregend (ACh), 1 hemmend (GABA, Glu), 2 modulatorisch, 3 unbekannt
  function makeEngine(net) {
    const { offsets, post, syn, ntCode } = net;
    const N = offsets.length - 1;
    const E = post.length;
    const W = new Float32Array(E);
    let lastW = null;

    function buildWeights(p) {
      const key = p.wSyn + "|" + p.modSign;
      if (key === lastW) return;
      const sign = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const c = ntCode[i];
        sign[i] = c === 1 ? -1 : c === 2 ? p.modSign : 1;
      }
      for (let i = 0; i < N; i++) {
        const s = sign[i] * p.wSyn;
        for (let e = offsets[i], end = offsets[i + 1]; e < end; e++) W[e] = syn[e] * s;
      }
      lastW = key;
    }

    // kleiner, schneller Zufallsgenerator (mulberry32), damit Laeufe reproduzierbar sind
    function rng(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function run(params, onProgress) {
      const p = Object.assign({}, DEFAULTS, params);
      buildWeights(p);
      const steps = Math.round(p.T / p.dt);
      const D = Math.max(1, Math.round(p.delay / p.dt));
      const R = Math.max(1, Math.round(p.refractory / p.dt));
      const decS = Math.exp(-p.dt / p.tauS);
      const kM = p.dt / p.tauM;
      const wPoi = p.fPoi * p.wSyn;

      const silent = new Uint8Array(N);
      for (const i of p.silence || []) silent[i] = 1;
      // Reize: Liste von {idx:[...], rate:Hz}
      const stimIdx = [], stimP = [];
      for (const s of p.stim || []) {
        const pr = (s.rate || 0) * p.dt / 1000;
        for (const i of s.idx) { stimIdx.push(i); stimP.push(pr); }
      }

      const counts = new Uint32Array(N);
      const rasterI = [], rasterT = [];
      const v = new Float32Array(N), g = new Float32Array(N);
      const refr = new Uint16Array(N);
      // Ringpuffer fuer verzoegerte Spikes
      const ring = []; for (let k = 0; k < D; k++) ring.push([]);
      const rand = rng(p.seed);
      const v0 = p.v0, vTh = p.vTh, vReset = p.vReset;
      let total = 0;
      const t0 = Date.now();

      // Nur "wache" Neuronen werden gerechnet: Liste + Markierung
      const awake = new Uint8Array(N);
      let list = new Uint32Array(N), next = new Uint32Array(N);
      let nList = 0;
      const wake = (j) => { if (!awake[j]) { awake[j] = 1; list[nList++] = j; } };

      for (let trial = 0; trial < p.trials; trial++) {
        v.fill(v0); g.fill(0); refr.fill(0); awake.fill(0); nList = 0;
        for (const r of ring) r.length = 0;
        for (let t = 0; t < steps; t++) {
          // 1) Spikes, die jetzt ankommen, verteilen
          const arr = ring[t % D];
          for (let k = 0; k < arr.length; k++) {
            const i = arr[k];
            for (let e = offsets[i], end = offsets[i + 1]; e < end; e++) {
              const j = post[e];
              g[j] += W[e];
              if (!awake[j]) { awake[j] = 1; list[nList++] = j; }
            }
          }
          arr.length = 0;
          // 2) Poisson-Reize
          for (let k = 0; k < stimIdx.length; k++) {
            if (rand() < stimP[k]) { const j = stimIdx[k]; g[j] += wPoi; wake(j); }
          }
          // 3) Membran aktualisieren, Schwellen pruefen
          const out = ring[t % D]; // wird nach D Schritten wieder gelesen
          let nNext = 0;
          for (let k = 0; k < nList; k++) {
            const i = list[k];
            let gi = g[i];
            let vi = v[i];
            if (refr[i] > 0) {
              refr[i]--;
            } else {
              vi = vi + (v0 - vi + gi) * kM;
              if (vi > vTh && !silent[i]) {
                vi = vReset; refr[i] = R;
                out.push(i); counts[i]++; total++;
                if (trial === 0 && rasterI.length < p.rasterCap) { rasterI.push(i); rasterT.push(t * p.dt); }
              }
            }
            gi *= decS;
            if (refr[i] === 0 && Math.abs(vi - v0) < 1e-4 && Math.abs(gi) < 1e-4) {
              v[i] = v0; g[i] = 0; awake[i] = 0; // schlaeft wieder ein
            } else {
              v[i] = vi; g[i] = gi; next[nNext++] = i;
            }
          }
          const tmp = list; list = next; next = tmp; nList = nNext;
          if (onProgress && (t & 255) === 0) onProgress((trial * steps + t) / (p.trials * steps));
        }
      }
      const rates = new Float32Array(N);
      const sec = (p.T / 1000) * p.trials;
      for (let i = 0; i < N; i++) rates[i] = counts[i] / sec;
      return {
        rates, total, ms: Date.now() - t0,
        rasterI: Uint32Array.from(rasterI), rasterT: Float32Array.from(rasterT),
        params: p,
      };
    }
    // Fortlaufende Simulation fuer die Fliegenwelt: Zustand bleibt zwischen den Aufrufen erhalten,
    // die Sinnes-Eingaenge koennen sich jederzeit aendern.
    function live(params) {
      const p = Object.assign({}, DEFAULTS, params);
      buildWeights(p);
      const D = Math.max(1, Math.round(p.delay / p.dt));
      const R = Math.max(1, Math.round(p.refractory / p.dt));
      const decS = Math.exp(-p.dt / p.tauS);
      const kM = p.dt / p.tauM;
      const wPoi = p.fPoi * p.wSyn;
      const v0 = p.v0, vTh = p.vTh, vReset = p.vReset;
      const v = new Float32Array(N).fill(v0), g = new Float32Array(N), refr = new Uint16Array(N);
      const awake = new Uint8Array(N), silent = new Uint8Array(N);
      let list = new Uint32Array(N), next = new Uint32Array(N), nList = 0;
      const ring = []; for (let k = 0; k < D; k++) ring.push([]);
      const rand = rng(p.seed);
      let inIdx = new Uint32Array(0), inP = new Float32Array(0);
      let t = 0;

      function setInput(idx, ratesHz) {
        inIdx = Uint32Array.from(idx);
        inP = Float32Array.from(ratesHz, (r) => Math.max(0, r) * p.dt / 1000);
      }
      function setSilent(idx) { silent.fill(0); for (const i of idx) silent[i] = 1; }
      function reset() {
        v.fill(v0); g.fill(0); refr.fill(0); awake.fill(0); nList = 0;
        for (const r of ring) r.length = 0;
      }
      // simuliert 'ms' Millisekunden, gibt die Indizes aller Spikes zurueck (mit Wiederholungen)
      function step(ms) {
        const steps = Math.round(ms / p.dt);
        const spikes = [];
        for (let s = 0; s < steps; s++, t++) {
          const arr = ring[t % D];
          for (let k = 0; k < arr.length; k++) {
            const i = arr[k];
            for (let e = offsets[i], end = offsets[i + 1]; e < end; e++) {
              const j = post[e];
              g[j] += W[e];
              if (!awake[j]) { awake[j] = 1; list[nList++] = j; }
            }
          }
          arr.length = 0;
          for (let k = 0; k < inIdx.length; k++) {
            if (rand() < inP[k]) { const j = inIdx[k]; g[j] += wPoi; if (!awake[j]) { awake[j] = 1; list[nList++] = j; } }
          }
          const out = ring[t % D];
          let nNext = 0;
          for (let k = 0; k < nList; k++) {
            const i = list[k];
            let gi = g[i], vi = v[i];
            if (refr[i] > 0) refr[i]--;
            else {
              vi = vi + (v0 - vi + gi) * kM;
              if (vi > vTh && !silent[i]) { vi = vReset; refr[i] = R; out.push(i); spikes.push(i); }
            }
            gi *= decS;
            if (refr[i] === 0 && Math.abs(vi - v0) < 1e-4 && Math.abs(gi) < 1e-4) { v[i] = v0; g[i] = 0; awake[i] = 0; }
            else { v[i] = vi; g[i] = gi; next[nNext++] = i; }
          }
          const tmp = list; list = next; next = tmp; nList = nNext;
        }
        return Uint32Array.from(spikes);
      }
      return { setInput, setSilent, reset, step, get awakeCount() { return nList; } };
    }

    return { run, live, N, E };
  }

  root.FlyBrainSim = { makeEngine, DEFAULTS };

  // ---- Web-Worker-Anbindung ----
  if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof window === "undefined") {
    let engine = null;
    self.onmessage = (ev) => {
      const m = ev.data;
      if (m.cmd === "init") {
        engine = makeEngine({
          offsets: new Uint32Array(m.offsets), post: new Uint32Array(m.post),
          syn: new Uint16Array(m.syn), ntCode: new Uint8Array(m.ntCode),
        });
        self.postMessage({ type: "ready" });
      } else if (m.cmd === "live-start") {
        self.liveSim = engine.live(m.params || {});
        self.postMessage({ type: "live-ready" });
      } else if (m.cmd === "live-step") {
        const L = self.liveSim;
        if (m.input) L.setInput(m.input.idx, m.input.rates);
        if (m.silence) L.setSilent(m.silence);
        if (m.reset) L.reset();
        const t0 = Date.now();
        const spikes = L.step(m.ms);
        self.postMessage({ type: "live-spikes", seq: m.seq, spikes, ms: m.ms, cpu: Date.now() - t0, awake: L.awakeCount }, [spikes.buffer]);
      } else if (m.cmd === "run") {
        try {
          let last = 0;
          const res = engine.run(m.params, (f) => {
            const now = Date.now();
            if (now - last > 120) { last = now; self.postMessage({ type: "progress", f }); }
          });
          self.postMessage({ type: "done", id: m.id, res },
            [res.rates.buffer, res.rasterI.buffer, res.rasterT.buffer]);
        } catch (err) {
          self.postMessage({ type: "error", message: String(err && err.message || err) });
        }
      }
    };
  }
})(typeof self !== "undefined" ? self : globalThis);
