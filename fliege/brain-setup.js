/*
 * Gehirn-Aufbau fuer die Fliegenwelt (Browser und Node).
 *
 * Macht aus dem rohen FlyWire-Konnektom ein biologisch plausibleres Simulationsnetz und
 * liefert alles, was fuer Riechen und Lernen im Pilzkoerper gebraucht wird.
 *
 * Korrekturen gegenueber dem einfachen Modell (jede einzeln getestet, siehe README):
 *  1. Dopamin, Serotonin und Octopamin wirken nicht als schnelle Erregung (sie wirken ueber
 *     langsame G-Protein-Rezeptoren). Ohne diese Korrektur geraet das Riechsystem in Dauererregung.
 *  2. Fehlende Transmitter-Vorhersagen werden mit der Mehrheit des Zelltyps ergaenzt.
 *  3. Sinneszellen (ausser Photorezeptoren) sind cholinerg. Die ML-Vorhersage haelt z. B.
 *     die Bitter-Geschmackszellen faelschlich fuer serotonerg.
 *  4. APL ist im echten Tier nicht-spikend und hemmt lokal; seine Synapsen auf die
 *     Ausgangsneuronen (MBONs) werden weggelassen, die Rueckkopplung auf die Kenyon-Zellen bleibt.
 *  6. Neuronen adaptieren (Spike-Frequenz-Adaptation, 1 mV pro Spike, 200 ms), siehe SIM.
 *  5. Erregende lokale Neuronen im Riechlappen (cholinerge eLNs) wirken mit halber Staerke:
 *     Ihre seitliche Erregung laeuft im Tier grossteils ueber elektrische Synapsen
 *     (Olsen et al. 2007), nicht ueber die chemischen, die das Konnektom zeigt. Mit voller
 *     Staerke verschmelzen alle Duftmuster zu einem; mit halber werden sie duftspezifisch.
 */
(function (root) {
  "use strict";

  const NT_EXC = 0, NT_INH = 1, NT_MOD = 2, NT_UNK = 3;
  const ELN_GAIN = 0.5;

  // D: { N, offsets, post, syn, dict:{type,nt,sc,cls,side}, type, nt, sc, cls, side } (Index-Arrays)
  function realisticNet(D) {
    const N = D.N, T = D.dict.type, NTn = D.dict.nt, SC = D.dict.sc, CL = D.dict.cls;
    const code = (n) => (n === "ACH" ? NT_EXC : n === "GABA" || n === "GLUT" ? NT_INH : n ? NT_MOD : NT_UNK);
    const nt = new Uint8Array(N);
    for (let i = 0; i < N; i++) nt[i] = code(NTn[D.nt[i]]);
    // 2) unbekannt -> Mehrheit des Zelltyps
    const votes = new Map();
    for (let i = 0; i < N; i++) {
      if (nt[i] === NT_UNK || !T[D.type[i]]) continue;
      let v = votes.get(D.type[i]); if (!v) votes.set(D.type[i], (v = [0, 0, 0]));
      v[nt[i]]++;
    }
    let filled = 0;
    for (let i = 0; i < N; i++) {
      if (nt[i] !== NT_UNK) continue;
      const v = votes.get(D.type[i]); if (!v) continue;
      const m = v.indexOf(Math.max(v[0], v[1], v[2]));
      if (v[m] > 0) { nt[i] = m; filled++; }
    }
    // 3) Sinneszellen cholinerg
    let sensory = 0;
    for (let i = 0; i < N; i++) {
      const s = SC[D.sc[i]];
      if ((s === "sensory" && CL[D.cls[i]] !== "visual") || s === "sensory_ascending") { if (nt[i] !== NT_EXC) sensory++; nt[i] = NT_EXC; }
    }
    // 4) APL -> MBON entfernen
    const isAPL = new Uint8Array(N), isMBON = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const t = T[D.type[i]] || ""; if (t === "APL") isAPL[i] = 1; if (/^MBON/.test(t)) isMBON[i] = 1; }
    let E2 = 0;
    for (let i = 0; i < N; i++) for (let e = D.offsets[i]; e < D.offsets[i + 1]; e++) if (!(isAPL[i] && isMBON[D.post[e]])) E2++;
    const offsets = new Uint32Array(N + 1), post = new Uint32Array(E2), syn = new Uint16Array(E2);
    let k = 0;
    for (let i = 0; i < N; i++) {
      offsets[i] = k;
      for (let e = D.offsets[i]; e < D.offsets[i + 1]; e++) {
        if (isAPL[i] && isMBON[D.post[e]]) continue;
        post[k] = D.post[e]; syn[k] = D.syn[e]; k++;
      }
    }
    offsets[N] = k;
    // 5) eLNs abschwaechen
    const gain = new Float32Array(N).fill(1); let eln = 0;
    for (let i = 0; i < N; i++) if (CL[D.cls[i]] === "ALLN" && nt[i] === NT_EXC) { gain[i] = ELN_GAIN; eln++; }
    return { offsets, post, syn, ntCode: nt, gain, stats: { filled, sensory, removedAPL: D.post.length - E2, eln } };
  }

  function groups(D) {
    const N = D.N, T = D.dict.type;
    const by = (re) => { const o = []; for (let i = 0; i < N; i++) if (re.test(T[D.type[i]] || "")) o.push(i); return o; };
    const lab = (re) => { const o = []; for (let i = 0; i < N; i++) if (re.test(D.label[i] || "")) o.push(i); return o; };
    const side = (i) => D.dict.side[D.side[i]];
    const G = {
      KC: by(/^KC/), MBON: by(/^MBON/), APL: by(/^APL$/),
      DAN: by(/^(PAM\d+|PPL10[1-6])$/),
      PUNISH: by(/^PPL10[1-6]$/),                 // Strafe: PPL1 (Aso et al. 2010; Claridge-Chang et al. 2009)
      REWARD: by(/^PAM(01|02|05|06|08|10|11)$/),  // Belohnung durch Zucker: PAM (Liu et al. 2012; Burke et al. 2012; Huetteroth et al. 2015)
      sugar: lab(/Sugar Gustatory Receptor Neuron/),
      bitter: lab(/Bitter Gustatory Receptor Neuron|labellar bitter gustatory/i),
      mn9: lab(/\bMN9\b/), roundup: lab(/\bRoundup\b/),
      gf: by(/^DNp01$/),
      orn: {},
    };
    G.lc4L = by(/^LC4$/).filter((i) => side(i) === "left"); G.lc4R = by(/^LC4$/).filter((i) => side(i) === "right");
    G.escL = by(/^DNp0(2|4)$|^DNp11$/).filter((i) => side(i) === "left"); G.escR = by(/^DNp0(2|4)$|^DNp11$/).filter((i) => side(i) === "right");
    for (let i = 0; i < N; i++) { const t = T[D.type[i]] || ""; if (t.startsWith("ORN_")) (G.orn[t.slice(4)] = G.orn[t.slice(4)] || []).push(i); }
    return G;
  }

  // Welche Dopamin-Neuronen gehoeren zu welchem Ausgangsneuron? Direkt aus den Synapsen DAN -> MBON.
  // Bei schwach gekoppelten MBONs: Kompartiment-Zuordnung nach Aso et al. 2014.
  const FALLBACK = { MBON10: ["PAM13", "PAM14"], MBON19: ["PPL105", "PPL106"], MBON15: ["PPL103"], "MBON15-like": ["PPL103"],
    "MBON17-like": ["PPL104"], MBON20: ["PPL101", "PPL102"], MBON25: ["PPL101", "PPL102"] };
  function plasticity(D, net, G) {
    const T = (i) => D.dict.type[D.type[i]];
    const danPos = new Map(G.DAN.map((i, n) => [i, n])), mbPos = new Map(G.MBON.map((i, n) => [i, n]));
    const w = new Map(), tot = new Float64Array(G.MBON.length);
    for (const d of G.DAN) for (let e = net.offsets[d]; e < net.offsets[d + 1]; e++) {
      const m = mbPos.get(net.post[e]); if (m === undefined) continue;
      const key = m * 100000 + danPos.get(d); w.set(key, (w.get(key) || 0) + net.syn[e]); tot[m] += net.syn[e];
    }
    const pair = [], sign = new Float32Array(G.MBON.length); let fallback = 0;
    G.MBON.forEach((m, mi) => {
      let list = [];
      if (tot[mi] >= 30) { for (const [key, v] of w) if (Math.floor(key / 100000) === mi) list.push([key % 100000, v / tot[mi]]); }
      else if (FALLBACK[T(m)]) {
        fallback++;
        const ds = G.DAN.map((d, n) => (FALLBACK[T(m)].includes(T(d)) ? n : -1)).filter((n) => n >= 0);
        list = ds.map((n) => [n, 1 / ds.length]);
      }
      let s = 0;
      for (const [n, ww] of list) { pair.push([mi, n, ww]); s += /^PPL1/.test(T(G.DAN[n])) ? ww : -ww; }
      sign[mi] = s; // + Kompartiment mit Strafe-Dopamin (MBON foerdert Annaeherung), - mit Belohnungs-Dopamin (foerdert Meiden)
    });
    // Typen fuer die Verhaltens-Auslese
    const types = [...new Set(G.MBON.map(T))].sort();
    const tIndex = G.MBON.map((m) => types.indexOf(T(m)));
    const tSign = new Float32Array(types.length), tCount = new Float32Array(types.length);
    G.MBON.forEach((m, mi) => { tSign[tIndex[mi]] += sign[mi]; tCount[tIndex[mi]]++; });
    for (let k = 0; k < types.length; k++) tSign[k] /= tCount[k];
    return {
      cfg: Object.assign({ kc: G.KC, mbon: G.MBON, dan: G.DAN, pair }, LEARN_DEFAULTS),
      sign, types, tIndex, tSign, tCount, fallback,
    };
  }

  const LEARN_DEFAULTS = { tauElig: 500, tauDa: 300, eligStep: 0.5, daStep: 1, daThr: 15, eta: 0.03, floor: 0.05, tauForget: 0 };
  const NOISE = { hz: 667, mv: 1.5 }; // Hintergrund-Synapsen auf MBONs: ~5 mV mittlerer Antrieb -> Spontanaktivitaet
  // 6. Spike-Frequenz-Adaptation (echte Neuronen ermueden bei Dauerfeuer). Ohne sie schaukeln sich
  //    rueckgekoppelte Kreise (z. B. SMP177 <-> CRE011) auf ~250 Hz hoch und blockieren das Fressen.
  const SIM = { dt: 0.2, modSign: 0, adaptInc: 1.0, adaptTau: 200 };
  const US_HZ = 150;   // Feuerrate der Dopamin-Neuronen bei Strom oder Zucker
  const ORN_MAX_HZ = 150;
  const TMAZE = { conc: 0.8, beta: 6 }; // Duftstaerke im T-Labyrinth, Entscheidungs-Schaerfe

  // Duftmuster {Glomerulus: 0..1} -> Eingangsliste fuer die Riechzellen
  function odorInput(G, pattern, conc, maxHz) {
    const idx = [], rates = [];
    const m = (maxHz || ORN_MAX_HZ) * conc;
    for (const g in pattern) {
      const v = pattern[g]; if (v <= 0) continue;
      for (const i of G.orn[g] || []) { idx.push(i); rates.push(m * v); }
    }
    return { idx, rates };
  }
  // Mischung: Summe der Komponenten (je Glomerulus hoechstens 1)
  function mix(odors, parts) {
    const out = {};
    for (const [name, amount] of parts) {
      const p = odors[name] && odors[name].pattern; if (!p) continue;
      for (const g in p) out[g] = Math.min(1, (out[g] || 0) + p[g] * amount);
    }
    return out;
  }
  // Verhaltens-Auslese: Annaeherungs-Wert aus MBON-Raten je Typ, normiert auf die Referenzantwort des Typs
  function valence(P, typeRates, ref) {
    let v = 0;
    for (let k = 0; k < P.types.length; k++) v += P.tSign[k] * typeRates[k] / Math.max(30, ref[k] || 0);
    return v;
  }

  root.FlyBrainSetup = { realisticNet, groups, plasticity, odorInput, mix, valence, LEARN_DEFAULTS, NOISE, SIM, US_HZ, ORN_MAX_HZ, TMAZE };
  if (typeof module !== "undefined") module.exports = root.FlyBrainSetup;
})(typeof self !== "undefined" ? self : globalThis);
