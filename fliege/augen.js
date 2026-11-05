/*
 * Facettenaugen der Fliege fuer das Fliegenkino (Browser und Node).
 *
 * Die ersten Sehstufen (Photorezeptoren, Lamina, Medulla) arbeiten im Tier mit abgestuften
 * Spannungen statt Spikes; ein einfaches Spike-Modell kann sie nicht abbilden (getestet: treibt man
 * die Photorezeptoren des Konnektoms an, kommt hinten fast nichts an). Darum sind sie hier mit
 * bewaehrten klassischen Modellen nachgebaut:
 *   - Ommatidien-Raster mit 5 Grad Abstand je Auge, Gesichtsfeld passend zum Bildformat
 *   - Adaptation und AN/AUS-Kanaele (wie L1/L2 -> Mi1/Tm3 bzw. Tm1/Tm2/Tm4/Tm9)
 *   - Bewegungsdetektoren nach Hassenstein & Reichardt (1956) fuer AN (T4) und AUS (T5)
 *   - Kleinobjekt-Detektion mit Umfeld-Hemmung (wie LC11, Keles & Frye 2017)
 * Daraus werden die Eingaenge der echten Projektionsneuronen berechnet (siehe kino-setup.js).
 */
(function (root) {
  "use strict";
  const STEP = 5; // Grad zwischen Ommatidien

  // Bildschirm vor der Fliege mit dem Seitenverhaeltnis des Videos
  function fieldFor(aspect) {
    if (!(aspect > 0)) aspect = 16 / 9;
    if (aspect >= 1) return { az: 60, el: Math.max(20, Math.min(60, 60 / aspect)) };
    return { az: Math.max(20, Math.min(60, 70 * aspect)), el: 70 };
  }

  function makeEyes(opts) {
    const f = Object.assign({ aspect: 16 / 9 }, opts || {});
    const fld = fieldFor(f.aspect), FA = fld.az, FE = Math.round(fld.el / STEP) * STEP;
    const om = [];
    for (const eye of [0, 1]) { // 0 = links, 1 = rechts; jedes Auge sieht 10 Grad ueber die Mitte
      const sg = eye === 0 ? 1 : -1;
      for (let el = -FE; el <= FE + 1e-6; el += STEP) for (let a = -10; a <= FA + 1e-6; a += STEP) om.push({ eye, az: sg * a, el });
    }
    const n = om.length;
    const key = (eye, az, el) => eye * 1e6 + (Math.round(az) + 500) * 1000 + (Math.round(el) + 500);
    const map = new Map(om.map((o, i) => [key(o.eye, o.az, o.el), i]));
    const get = (o, da, de) => { const j = map.get(key(o.eye, o.az + da, o.el + de)); return j === undefined ? -1 : j; };
    const S = {
      n, STEP, fieldAz: FA, fieldEl: FE,
      eye: new Uint8Array(n), az: new Float32Array(n), el: new Float32Array(n), x: new Float32Array(n), y: new Float32Array(n),
      nx: new Int32Array(n), ny: new Int32Array(n), nb: [], ring: [],
      L: new Float32Array(n), slow: new Float32Array(n).fill(-1), A: new Float32Array(n),
      on: new Float32Array(n), off: new Float32Array(n), dOn: new Float32Array(n), dOff: new Float32Array(n),
      mx: new Float32Array(n), my: new Float32Array(n), mxOff: new Float32Array(n), myOff: new Float32Array(n),
      small: new Float32Array(n), t: 0, boxes: null, boxKey: "",
    };
    om.forEach((o, i) => {
      S.eye[i] = o.eye; S.az[i] = o.az; S.el[i] = o.el;
      S.x[i] = -o.az / FA; S.y[i] = -o.el / FE;          // Bildkoordinaten -1..1 (x rechts, y unten)
      S.nx[i] = get(o, -STEP, 0);                         // Nachbar rechts im Bild
      S.ny[i] = get(o, 0, STEP);                          // Nachbar oben
      S.nb.push(Int32Array.from([get(o, -STEP, 0), get(o, 0, STEP), get(o, STEP, 0), get(o, 0, -STEP)].filter((j) => j >= 0)));
      const ring = []; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { if (!a && !b) continue; const j = get(o, a * STEP, b * STEP); if (j >= 0) ring.push(j); }
      S.ring.push(Int32Array.from(ring));
    });
    return S;
  }

  // Bild (Helligkeit 0..1, fuellt den Bildschirm) an jedem Ommatidium abtasten (Summenbild)
  function sample(S, img) {
    const { w, h, lum } = img, k = w + "x" + h;
    if (S.boxKey !== k) {
      const rx = Math.max(1, Math.round(w * STEP / (2 * S.fieldAz) * 0.6)), ry = Math.max(1, Math.round(h * STEP / (2 * S.fieldEl) * 0.6));
      S.boxes = new Int32Array(S.n * 4);
      for (let i = 0; i < S.n; i++) {
        const cx = Math.round((S.x[i] + 1) / 2 * (w - 1)), cy = Math.round((S.y[i] + 1) / 2 * (h - 1));
        S.boxes[i * 4] = Math.max(0, cx - rx); S.boxes[i * 4 + 1] = Math.max(0, cy - ry);
        S.boxes[i * 4 + 2] = Math.min(w - 1, cx + rx); S.boxes[i * 4 + 3] = Math.min(h - 1, cy + ry);
      }
      S.boxKey = k; S.integral = new Float64Array((w + 1) * (h + 1));
    }
    const I = S.integral, W1 = w + 1;
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += lum[y * w + x]; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row; } }
    for (let i = 0; i < S.n; i++) {
      const x0 = S.boxes[i * 4], y0 = S.boxes[i * 4 + 1], x1 = S.boxes[i * 4 + 2] + 1, y1 = S.boxes[i * 4 + 3] + 1;
      const sum = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
      S.L[i] = sum / ((x1 - x0) * (y1 - y0));
    }
  }

  // ein Zeitschritt (dt in ms)
  function step(S, dt) {
    const aSlow = 1 - Math.exp(-dt / 300), aDel = 1 - Math.exp(-dt / 60), n = S.n;
    for (let i = 0; i < n; i++) {
      if (S.slow[i] < 0) S.slow[i] = S.L[i];
      const A = S.L[i] - S.slow[i]; S.slow[i] += A * aSlow; S.A[i] = A;
      S.dOn[i] += (S.on[i] - S.dOn[i]) * aDel; S.dOff[i] += (S.off[i] - S.dOff[i]) * aDel; // verzoegerte Kopien
      S.on[i] = A > 0 ? A : 0; S.off[i] = A < 0 ? -A : 0;
    }
    // Hassenstein-Reichardt: verzoegertes Signal des einen Nachbarn mal aktuelles des anderen, minus Spiegelbild
    for (let i = 0; i < n; i++) {
      let mx = 0, my = 0, mxo = 0, myo = 0; const jx = S.nx[i], jy = S.ny[i];
      if (jx >= 0) { mx = S.dOn[i] * S.on[jx] - S.on[i] * S.dOn[jx]; mxo = S.dOff[i] * S.off[jx] - S.off[i] * S.dOff[jx]; }
      if (jy >= 0) { my = S.dOn[i] * S.on[jy] - S.on[i] * S.dOn[jy]; myo = S.dOff[i] * S.off[jy] - S.off[i] * S.dOff[jy]; }
      S.mx[i] = mx + mxo; S.my[i] = my + myo; S.mxOff[i] = mxo; S.myOff[i] = myo;
    }
    // Kleinobjekt-Antwort je Ommatidium: starke Aenderung hier, kaum im Umfeld; ein Nachbar darf
    // mitmachen (Objekt zwischen zwei Ommatidien), eine Kante (zwei und mehr) wird unterdrueckt
    for (let i = 0; i < n; i++) {
      const c = Math.abs(S.A[i]); S.small[i] = 0; if (c < 0.03) continue;
      const nb = S.nb[i]; let m1 = 0, m2 = 0;
      for (let k = 0; k < nb.length; k++) { const v = Math.abs(S.A[nb[k]]); if (v > m1) { m2 = m1; m1 = v; } else if (v > m2) m2 = v; }
      if (nb.length > 1 && m2 > 0.35 * c) continue;
      const ring = S.ring[i]; let s = 0; for (let k = 0; k < ring.length; k++) s += Math.abs(S.A[ring[k]]);
      const v = c - 4 * s / Math.max(1, ring.length); if (v > 0) S.small[i] = v;
    }
    S.t += dt;
  }

  // Blickfeld eines Projektionsneurons: Ommatidien im Umkreis r (Grad) und ihr Quadrant zur Mitte
  function makeRF(S, eye, az, el, r) {
    const idx = [], quad = [];
    const cx = -az / S.fieldAz, cy = -el / S.fieldEl;
    for (let i = 0; i < S.n; i++) {
      if (S.eye[i] !== eye) continue;
      if (Math.hypot(S.az[i] - az, S.el[i] - el) > r) continue;
      const dx = S.x[i] - cx, dy = S.y[i] - cy;
      idx.push(i); quad.push((dx > 0.02 ? 1 : 0) | (dx < -0.02 ? 2 : 0) | (dy < -0.02 ? 4 : 0) | (dy > 0.02 ? 8 : 0));
    }
    return idx.length ? { idx: Int32Array.from(idx), quad: Uint8Array.from(quad) } : null;
  }
  function rfEval(S, rf) {
    let qR = 0, qL = 0, qU = 0, qD = 0, qRo = 0, qLo = 0, qUo = 0, qDo = 0, off = 0, small = 0, ch = 0;
    const { idx, quad } = rf, n = idx.length;
    for (let k = 0; k < n; k++) {
      const i = idx[k], q = quad[k];
      off += S.off[i]; ch += Math.abs(S.A[i]); if (S.small[i] > small) small = S.small[i];
      // Auswaerts-Bewegung je Quadrant (rechts der Mitte nach rechts, oben nach oben, ...)
      if (q & 1) { if (S.mx[i] > 0) qR += S.mx[i]; if (S.mxOff[i] > 0) qRo += S.mxOff[i]; }
      if (q & 2) { if (S.mx[i] < 0) qL -= S.mx[i]; if (S.mxOff[i] < 0) qLo -= S.mxOff[i]; }
      if (q & 4) { if (S.my[i] > 0) qU += S.my[i]; if (S.myOff[i] > 0) qUo += S.myOff[i]; }
      if (q & 8) { if (S.my[i] < 0) qD -= S.my[i]; if (S.myOff[i] < 0) qDo -= S.myOff[i]; }
    }
    return { expand: Math.min(qR, qL, qU, qD) / n, expandOff: Math.min(qRo, qLo, qUo, qDo) / n, off: off / n, small, change: ch / n };
  }

  // Bildfluss eines ganzen Auges: horizontal "von vorne nach hinten" und vertikal
  function wideField(S, eye) {
    let fb = 0, v = 0, n = 0;
    for (let i = 0; i < S.n; i++) {
      if (S.eye[i] !== eye) continue;
      fb += eye === 0 ? -S.mx[i] : S.mx[i]; v += Math.abs(S.my[i]); n++;
    }
    return { fb: fb / n, v: v / n };
  }

  // Leuchtdichte aus RGBA-Pixeln, dazu Mittelwert und Streuung (zum Erkennen schwarzer Bilder)
  function lumFromRGBA(data, w, h) {
    const lum = new Float32Array(w * h); let s = 0, s2 = 0;
    for (let p = 0, q = 0; q < w * h; p += 4, q++) { const v = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255; lum[q] = v; s += v; s2 += v * v; }
    const mean = s / (w * h);
    return { w, h, lum, mean, sd: Math.sqrt(Math.max(0, s2 / (w * h) - mean * mean)) };
  }

  root.FlyEyes = { makeEyes, sample, step, makeRF, rfEval, wideField, lumFromRGBA, fieldFor, STEP };
  if (typeof module !== "undefined") module.exports = root.FlyEyes;
})(typeof self !== "undefined" ? self : globalThis);
