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
    adaptTau: 200,                   // ms, Spike-Frequenz-Adaptation (nur Live-Modus)
    adaptInc: 0,                     // mV pro Spike (0 = aus, wie im Originalmodell)
    seed: 1,
  };

  // Transmitter-Codes: 0 erregend (ACh), 1 hemmend (GABA, Glu), 2 modulatorisch, 3 unbekannt
  function makeEngine(net) {
    const { offsets, post, syn, ntCode } = net;
    const gain = net.gain || null; // optionaler Faktor je Neuron fuer seine Ausgangs-Synapsen
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
        const s = sign[i] * p.wSyn * (gain ? gain[i] : 1);
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
    //
    // Exakte, "faule" Integration: Zwischen zwei Eingaengen ist das Modell linear und hat eine
    // geschlossene Loesung. Ein Neuron wird nur Schritt fuer Schritt gerechnet, solange es die
    // Schwelle noch erreichen kann; sonst "schlaeft" es und wird beim naechsten Eingang exakt
    // nachgefuehrt. Ergebnis wie bei voller Rechnung, aber viel schneller.
    //
    // Optional: Lernen im Pilzkoerper (Dopamin-gesteuerte Abschwaechung der Synapsen
    // Kenyon-Zelle -> Ausgangsneuron, nach Hige et al. 2015, Handler et al. 2019).
    function live(params) {
      const p = Object.assign({}, DEFAULTS, params);
      buildWeights(p);
      const dt = p.dt;
      const D = Math.max(1, Math.round(p.delay / dt));
      const R = Math.max(1, Math.round(p.refractory / dt));
      const tm = p.tauM, ts = p.tauS;
      const c = ts / (tm - ts), r = tm / ts;           // fuer die geschlossene Loesung
      const theta = p.vTh - p.v0, uReset = p.vReset - p.v0;
      const wPoi = p.fPoi * p.wSyn;
      // Tabellen fuer das Nachfuehren ueber k Schritte
      const KMAX = Math.round(800 / dt);
      const EM = new Float32Array(KMAX + 1), ES = new Float32Array(KMAX + 1), KK = new Float32Array(KMAX + 1);
      // Adaptation: Strom a mit Zeitkonstante ta, der u nach unten zieht (du/dt = (-u + g - a)/tm)
      const ta = p.adaptTau, aInc = p.adaptInc, adapt = aInc > 0;
      const EA = new Float32Array(KMAX + 1), KA = new Float32Array(KMAX + 1);
      for (let k = 0; k <= KMAX; k++) {
        const tt = k * dt;
        EM[k] = Math.exp(-tt / tm); ES[k] = Math.exp(-tt / ts); KK[k] = c * (EM[k] - ES[k]);
        EA[k] = Math.exp(-tt / ta); KA[k] = ta / (ta - tm) * (EA[k] - EM[k]);
      }
      const em1 = EM[1], es1 = ES[1], k1 = KK[1], ea1 = EA[1], ka1 = KA[1];
      const u = new Float32Array(N), g = new Float32Array(N), ad = new Float32Array(N);
      const tLast = new Int32Array(N), refr = new Uint16Array(N);
      const awake = new Uint8Array(N), silent = new Uint8Array(N), dirty = new Uint8Array(N), hold = new Uint8Array(N);
      let list = new Uint32Array(N), next = new Uint32Array(N), nList = 0;
      const dlist = new Uint32Array(N); let nDirty = 0;
      // Neuromodulation (z. B. Dopamin): langsame Zusatz-Spannung je Neuron = Empfaenglichkeit * Pegel (mV)
      let modR = null, modLvl = 0;
      const ring = []; for (let k = 0; k < D; k++) ring.push([]);
      const rand = rng(p.seed);
      let inIdx = new Uint32Array(0), inNext = new Float64Array(0), inRate = new Float32Array(0);
      // Hintergrund-Rauschen: viele kleine Synapsen-Ereignisse (spontane Aktivitaet wie im echten Gehirn)
      let nzIdx = new Uint32Array(0), nzNext = new Float64Array(0), nzRate = 0, nzW = 0;
      let t = 0;
      // groesstmoeglicher Anstieg von u durch g (fuer eine schnelle Vorpruefung)
      const aPk = Math.pow(1 / r, 1 / (r - 1)), MAXK = c * (aPk - Math.pow(aPk, r));

      // Zustand eines schlafenden Neurons exakt bis jetzt nachfuehren und vormerken
      function touch(j) {
        const k = t - tLast[j];
        if (k > 0) {
          const bj = modR ? modR[j] * modLvl : 0;
          if (k > KMAX) { u[j] = bj; g[j] = 0; ad[j] = 0; }
          else {
            const gj = g[j]; u[j] = bj + (u[j] - bj) * EM[k] + gj * KK[k]; g[j] = gj * ES[k];
            if (adapt) { u[j] -= ad[j] * KA[k]; ad[j] *= EA[k]; }
          }
          tLast[j] = t;
        }
        if (!dirty[j]) { dirty[j] = 1; dlist[nDirty++] = j; }
      }
      // kann das Neuron ohne weiteren Eingang noch die Schwelle erreichen?
      function mayFire(uj, gj, bj) {
        // mit Zusatz-Spannung b ist die Ruhelage b statt 0: gleiche Rechnung mit u-b und Schwelle theta-b
        const th = theta - (bj || 0), uu = uj - (bj || 0);
        if (th <= 0.02) return true;
        if (uu >= th) return true;
        if (gj <= 0) return false;
        if ((uu > 0 ? uu : 0) + gj * MAXK < th - 0.02) return false;
        const x = (uu + gj * c) / (gj * c * r);
        if (x >= 1 || x <= 0) return false;
        const a = Math.pow(x, 1 / (r - 1));
        return uu * a + gj * c * (a - Math.pow(a, r)) > th - 0.02;
      }

      function setInput(idx, ratesHz) {
        // Poisson-Eingaenge: naechster Ereigniszeitpunkt je Neuron (in Schritten).
        // Poisson ist gedaechtnislos, daher darf bei jeder Aenderung neu gezogen werden.
        inIdx = Uint32Array.from(idx);
        inRate = Float32Array.from(ratesHz, (x) => Math.max(0, x));
        inNext = new Float64Array(inIdx.length);
        for (let k = 0; k < inIdx.length; k++) inNext[k] = t + expStep(inRate[k]);
      }
      function expStep(hz) { return hz > 0 ? -Math.log(1 - rand()) / (hz * dt / 1000) : Infinity; }
      function setNoise(idx, hz, wMv) {
        nzIdx = Uint32Array.from(idx); nzRate = hz; nzW = wMv;
        nzNext = new Float64Array(nzIdx.length);
        for (let k = 0; k < nzIdx.length; k++) nzNext[k] = t + expStep(nzRate) * (0.5 + rand());
      }
      function setSilent(idx) { silent.fill(0); for (const i of idx) silent[i] = 1; }
      function reset() {
        u.fill(0); g.fill(0); ad.fill(0); refr.fill(0); awake.fill(0); dirty.fill(0); tLast.fill(0); nList = 0; nDirty = 0; t = 0;
        for (const q of ring) q.length = 0;
        for (let k = 0; k < inIdx.length; k++) inNext[k] = expStep(inRate[k]);
        if (plast) plast.clearTraces();
      }

      // ---------- Lernen ----------
      let plast = null;
      function setupPlasticity(cfg) {
        // cfg: { kc:[...], mbon:[...], dan:[...], pair: [[mbonIdxInList, danIdxInList, weight], ...],
        //        tauElig (ms), tauDa (ms), eta, floor, tauForget (s) }
        const kcSet = new Int32Array(N).fill(-1); cfg.kc.forEach((i, n) => (kcSet[i] = n));
        const mbSet = new Int32Array(N).fill(-1); cfg.mbon.forEach((i, n) => (mbSet[i] = n));
        const danSet = new Int32Array(N).fill(-1); cfg.dan.forEach((i, n) => (danSet[i] = n));
        // plastische Kanten: KC -> MBON
        const eIdx = [], eKc = [], eMb = [];
        for (const i of cfg.kc) for (let e = offsets[i]; e < offsets[i + 1]; e++) { const m = mbSet[post[e]]; if (m >= 0) { eIdx.push(e); eKc.push(kcSet[i]); eMb.push(m); } }
        const nE = eIdx.length;
        const base = new Float32Array(nE); for (let q = 0; q < nE; q++) base[q] = W[eIdx[q]];
        const f = new Float32Array(nE).fill(1);
        // Kanten je KC fuer schnelles Lernen
        const kcStart = new Int32Array(cfg.kc.length + 1);
        { const cnt = new Int32Array(cfg.kc.length); for (const k of eKc) cnt[k]++; for (let k = 0; k < cfg.kc.length; k++) kcStart[k + 1] = kcStart[k] + cnt[k]; }
        const order = new Int32Array(nE); { const fill = kcStart.slice(0, -1); for (let q = 0; q < nE; q++) order[fill[eKc[q]]++] = q; }
        // Dopamin je MBON = Summe gewichteter DAN-Spuren
        const pairM = cfg.pair.map((x) => x[0]), pairD = cfg.pair.map((x) => x[1]), pairW = cfg.pair.map((x) => x[2]);
        plast = {
          kcSet, danSet, eIdx, eKc, eMb, base, f, kcStart, order,
          elig: new Float32Array(cfg.kc.length), daTrace: new Float32Array(cfg.dan.length), da: new Float32Array(cfg.mbon.length),
          pairM, pairD, pairW, cfg, enabled: true,
          clearTraces() { this.elig.fill(0); this.daTrace.fill(0); this.da.fill(0); },
        };
        return { edges: nE };
      }
      function plasticStep(ms, spikes) {
        const P = plast, cfg = P.cfg;
        const de = Math.exp(-ms / cfg.tauElig), dd = Math.exp(-ms / cfg.tauDa);
        for (let k = 0; k < P.elig.length; k++) P.elig[k] *= de;
        for (let k = 0; k < P.daTrace.length; k++) P.daTrace[k] *= dd;
        for (let n = 0; n < spikes.length; n++) {
          const i = spikes[n];
          const kk = P.kcSet[i]; if (kk >= 0) { P.elig[kk] = Math.min(1, P.elig[kk] + cfg.eligStep); continue; }
          const dd2 = P.danSet[i]; if (dd2 >= 0) P.daTrace[dd2] += cfg.daStep;
        }
        P.da.fill(0);
        for (let q = 0; q < P.pairM.length; q++) P.da[P.pairM[q]] += P.pairW[q] * P.daTrace[P.pairD[q]];
        if (P.enabled) {
          const eta = cfg.eta * ms / 1000;
          for (let k = 0; k < P.elig.length; k++) {
            const el = P.elig[k]; if (el < 0.02) continue;
            for (let s = P.kcStart[k]; s < P.kcStart[k + 1]; s++) {
              const q = P.order[s], d = P.da[P.eMb[q]];
              if (d <= 0.001) continue;
              P.f[q] = Math.max(cfg.floor, P.f[q] - eta * el * d * P.f[q]);
              W[P.eIdx[q]] = P.base[q] * P.f[q];
            }
          }
        }
        // langsames Vergessen
        if (cfg.tauForget > 0) {
          const rr = 1 - Math.exp(-ms / 1000 / cfg.tauForget);
          for (let q = 0; q < P.f.length; q++) if (P.f[q] < 1) { P.f[q] += (1 - P.f[q]) * rr; W[P.eIdx[q]] = P.base[q] * P.f[q]; }
        }
      }
      function memory() { return plast ? { f: plast.f.slice(), eKc: Int32Array.from(plast.eKc), eMb: Int32Array.from(plast.eMb), da: plast.da.slice() } : null; }
      function setMemory(f) { if (!plast) return; for (let q = 0; q < plast.f.length; q++) { plast.f[q] = f ? f[q] : 1; W[plast.eIdx[q]] = plast.base[q] * plast.f[q]; } }

      // simuliert 'ms' Millisekunden, gibt die Indizes aller Spikes zurueck (mit Wiederholungen)
      function step(ms) {
        const steps = Math.round(ms / dt);
        const spikes = [];
        for (let s = 0; s < steps; s++, t++) {
          // 1) ankommende Spikes verteilen
          const arr = ring[t % D];
          for (let k = 0; k < arr.length; k++) {
            const i = arr[k];
            for (let e = offsets[i], end = offsets[i + 1]; e < end; e++) {
              const j = post[e];
              if (awake[j] === 0) {
                const k = t - tLast[j];
                if (k !== 0) {
                  const gj = g[j], bj = modR ? modR[j] * modLvl : 0;
                  if (k > KMAX) { u[j] = bj; g[j] = 0; ad[j] = 0; }
                  else {
                    u[j] = bj + (u[j] - bj) * EM[k] + gj * KK[k]; g[j] = gj * ES[k];
                    if (adapt) { u[j] -= ad[j] * KA[k]; ad[j] *= EA[k]; }
                  }
                  tLast[j] = t;
                }
                if (dirty[j] === 0) { dirty[j] = 1; dlist[nDirty++] = j; }
              }
              g[j] += W[e];
            }
          }
          arr.length = 0;
          // 2) Poisson-Reize
          for (let k = 0; k < inIdx.length; k++) {
            while (inNext[k] <= t) {
              const j = inIdx[k];
              if (!awake[j]) touch(j);
              g[j] += wPoi;
              inNext[k] += expStep(inRate[k]);
            }
          }
          for (let k = 0; k < nzIdx.length; k++) {
            while (nzNext[k] <= t) {
              const j = nzIdx[k];
              if (!awake[j]) touch(j);
              g[j] += nzW;
              nzNext[k] += expStep(nzRate);
            }
          }
          // vorgemerkte (schlafende) Neuronen nur wecken, wenn sie die Schwelle erreichen koennen
          for (let k = 0; k < nDirty; k++) {
            const j = dlist[k]; dirty[j] = 0;
            if (mayFire(u[j], g[j], modR ? modR[j] * modLvl : 0)) { awake[j] = 1; hold[j] = 8; list[nList++] = j; }
          }
          nDirty = 0;
          // 3) wache Neuronen einen Schritt weiter
          const out = ring[t % D];
          let nNext = 0;
          for (let k = 0; k < nList; k++) {
            const i = list[k];
            let ui = u[i], gi = g[i];
            if (refr[i] > 0) { refr[i]--; gi *= es1; if (adapt) ad[i] *= ea1; }
            else {
              const bi = modR ? modR[i] * modLvl : 0;
              ui = bi + (ui - bi) * em1 + gi * k1; gi *= es1;
              if (adapt) { ui -= ad[i] * ka1; ad[i] *= ea1; }
              if (ui > theta && !silent[i]) { ui = uReset; refr[i] = R; out.push(i); spikes.push(i); if (adapt) ad[i] += aInc; }
            }
            u[i] = ui; g[i] = gi;
            // nur alle paar Schritte pruefen, ob es wieder schlafen darf (spart Rechenzeit, aendert nichts am Ergebnis)
            if (refr[i] > 0) next[nNext++] = i;
            else if (hold[i] > 0) { hold[i]--; next[nNext++] = i; }
            else if (mayFire(ui, gi, modR ? modR[i] * modLvl : 0)) { hold[i] = 8; next[nNext++] = i; }
            else { awake[i] = 0; tLast[i] = t + 1; }
          }
          const tmp = list; list = next; next = tmp; nList = nNext;
        }
        const sp = Uint32Array.from(spikes);
        if (plast) plasticStep(ms, sp);
        return sp;
      }
      return {
        setInput, setSilent, setNoise, reset, step, setupPlasticity, memory, setMemory,
        setModulation(R, lvl) { modR = R ? Float32Array.from(R) : null; modLvl = lvl || 0; },
        setModLevel(lvl) {
          // Neuronen, die durch die neue Zusatz-Spannung feuern koennten, wecken
          modLvl = lvl || 0;
          if (modR) for (let j = 0; j < N; j++) if (!awake[j] && modR[j] !== 0 && mayFire(u[j], g[j], modR[j] * modLvl)) { awake[j] = 1; hold[j] = 8; list[nList++] = j; tLast[j] = t; }
        },
        setLearning(on) { if (plast) plast.enabled = !!on; },
        get awakeCount() { return nList; }, get time() { return t * dt; },
        get plast() { return plast; },
      };
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
          gain: m.gain ? new Float32Array(m.gain) : null,
        });
        self.postMessage({ type: "ready" });
      } else if (m.cmd === "live-start") {
        self.liveSim = engine.live(m.params || {});
        let plastic = null;
        if (m.plastic) plastic = self.liveSim.setupPlasticity(m.plastic);
        if (m.noise) self.liveSim.setNoise(m.noise.idx, m.noise.hz, m.noise.mv);
        let edges = null;
        if (plastic) { const M = self.liveSim.memory(); edges = { eKc: M.eKc, eMb: M.eMb }; }
        self.postMessage({ type: "live-ready", plastic, edges });
      } else if (m.cmd === "live-step") {
        const L = self.liveSim;
        if (m.input) L.setInput(m.input.idx, m.input.rates);
        if (m.silence) L.setSilent(m.silence);
        if (m.reset) L.reset();
        if (m.learning !== undefined) L.setLearning(m.learning);
        if (m.forget) L.setMemory(null);
        if (m.cfg && L.plast) Object.assign(L.plast.cfg, m.cfg);
        if (m.modR) L.setModulation(new Float32Array(m.modR), m.modLvl);
        else if (m.modLvl !== undefined) L.setModLevel(m.modLvl);
        if (m.setMem) L.setMemory(new Float32Array(m.setMem));
        const t0 = Date.now();
        const spikes = L.step(m.ms);
        const msg = { type: "live-spikes", seq: m.seq, spikes, ms: m.ms, cpu: Date.now() - t0, awake: L.awakeCount };
        const tr = [spikes.buffer];
        if (m.mem && L.plast) { msg.mem = L.plast.f.slice(); tr.push(msg.mem.buffer); }
        self.postMessage(msg, tr);
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
