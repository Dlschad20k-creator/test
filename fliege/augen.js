/*
 * Facettenaugen der Fliege fuer das Fliegenkino (Browser und Node).
 *
 * Die ersten Sehstufen (Photorezeptoren, Lamina, Medulla) arbeiten im Tier mit abgestuften
 * Spannungen statt Spikes; ein einfaches Spike-Modell kann sie nicht abbilden. Darum sind sie hier
 * mit bewaehrten klassischen Modellen nachgebaut:
 *   - Ommatidien-Raster mit 5 Grad Abstand, Akzeptanzwinkel ~5 Grad
 *   - Adaptation und AN/AUS-Kanaele (wie L1/L2 -> Mi1/Tm3 bzw. Tm1/Tm2/Tm4/Tm9)
 *   - Bewegungsdetektoren nach Hassenstein & Reichardt (1956) fuer AN (T4) und AUS (T5)
 * Daraus werden die Eingaenge der echten Projektionsneuronen berechnet:
 *   LPLC2 (Ausdehnung, Absprung), LC4 (dunkles Objekt kommt naeher), LC10a/LC11 (kleines bewegtes
 *   Objekt), HS (horizontaler Bildfluss), VS (vertikaler Bildfluss).
 * Ab diesen Neuronen rechnet das echte FlyWire-Konnektom weiter.
 */
(function (root) {
  "use strict";
  const STEP = 5;            // Grad zwischen Ommatidien
  const FIELD_AZ = 60, FIELD_EL = 35; // Bildschirm vor der Fliege: +-60 Grad breit, +-35 Grad hoch

  function makeEyes() {
    const om = [];
    // linkes Auge: Azimut -10 (leicht ueber die Mitte, Ueberlappung) bis +60; rechtes Auge gespiegelt
    for (const eye of ["L", "R"]) {
      const sgn = eye === "L" ? 1 : -1;
      for (let el = -FIELD_EL; el <= FIELD_EL + 1e-6; el += STEP) {
        for (let a = -10; a <= FIELD_AZ + 1e-6; a += STEP) om.push({ eye, az: sgn * a, el, fb: 0 });
      }
    }
    // Nachbarn (fuer die Bewegungsdetektoren): rechts im Bild (+x) und oben (+el)
    const key = (eye, az, el) => eye + ":" + Math.round(az) + ":" + Math.round(el);
    const map = new Map(om.map((o, i) => [key(o.eye, o.az, o.el), i]));
    for (const o of om) {
      o.nx = map.get(key(o.eye, o.az - STEP, o.el)); // Bild-x waechst nach rechts = Azimut sinkt
      o.ny = map.get(key(o.eye, o.az, o.el + STEP));
      o.nb = [o.nx, o.ny, map.get(key(o.eye, o.az + STEP, o.el)), map.get(key(o.eye, o.az, o.el - STEP))].filter((j) => j !== undefined);
      o.ring = []; // Umfeld bis zwei Ommatidien weit
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { if (!a && !b) continue; const j = map.get(key(o.eye, o.az + a * STEP, o.el + b * STEP)); if (j !== undefined) o.ring.push(j); }
      o.x = -o.az / FIELD_AZ; o.y = -o.el / FIELD_EL; // Bildkoordinaten -1..1 (x rechts, y unten)
    }
    const n = om.length;
    const S = {
      om, n,
      L: new Float32Array(n), slow: new Float32Array(n).fill(-1), A: new Float32Array(n),
      on: new Float32Array(n), off: new Float32Array(n), dOn: new Float32Array(n), dOff: new Float32Array(n),
      mx: new Float32Array(n), my: new Float32Array(n), mxOff: new Float32Array(n), myOff: new Float32Array(n),
      t: 0,
    };
    return S;
  }

  // Bild (Helligkeit 0..1) an der Blickrichtung jedes Ommatidiums abtasten
  // img: {w, h, lum: Float32Array} mit Bildkoordinaten; das Bild fuellt den Bildschirm
  function sample(S, img) {
    const { w, h, lum } = img;
    const rx = Math.max(1, Math.round(w * STEP / (2 * FIELD_AZ) * 0.6)), ry = Math.max(1, Math.round(h * STEP / (2 * FIELD_EL) * 0.6));
    for (let i = 0; i < S.n; i++) {
      const o = S.om[i];
      const cx = Math.round((o.x + 1) / 2 * (w - 1)), cy = Math.round((o.y + 1) / 2 * (h - 1));
      let s = 0, c = 0;
      for (let dy = -ry; dy <= ry; dy++) {
        const y = cy + dy; if (y < 0 || y >= h) continue;
        for (let dx = -rx; dx <= rx; dx++) { const x = cx + dx; if (x < 0 || x >= w) continue; s += lum[y * w + x]; c++; }
      }
      S.L[i] = c ? s / c : 0.5;
    }
  }

  // ein Zeitschritt (dt in ms)
  function step(S, dt) {
    const aSlow = 1 - Math.exp(-dt / 300), aDel = 1 - Math.exp(-dt / 60);
    for (let i = 0; i < S.n; i++) {
      if (S.slow[i] < 0) S.slow[i] = S.L[i];
      const A = S.L[i] - S.slow[i]; S.slow[i] += A * aSlow; S.A[i] = A;
      const on = A > 0 ? A : 0, off = A < 0 ? -A : 0;
      S.dOn[i] += (S.on[i] - S.dOn[i]) * aDel; S.dOff[i] += (S.off[i] - S.dOff[i]) * aDel; // verzoegerte Kopien (alter Wert)
      S.on[i] = on; S.off[i] = off;
    }
    // Hassenstein-Reichardt: verzoegertes Signal des einen Nachbarn mal aktuelles des anderen, minus Spiegelbild
    for (let i = 0; i < S.n; i++) {
      const o = S.om[i]; let mx = 0, my = 0, mxo = 0, myo = 0;
      if (o.nx !== undefined) { const j = o.nx; mx = S.dOn[i] * S.on[j] - S.on[i] * S.dOn[j]; mxo = S.dOff[i] * S.off[j] - S.off[i] * S.dOff[j]; }
      if (o.ny !== undefined) { const j = o.ny; my = S.dOn[i] * S.on[j] - S.on[i] * S.dOn[j]; myo = S.dOff[i] * S.off[j] - S.off[i] * S.dOff[j]; }
      S.mx[i] = mx + mxo; S.my[i] = my + myo; S.mxOff[i] = mxo; S.myOff[i] = myo;
    }
    S.t += dt;
  }

  // Merkmale fuer ein Projektionsneuron mit Blickfeld-Mitte (az, el) und Radius r (Grad)
  function rfFeatures(S, eye, az, el, r) {
    let qR = 0, qL = 0, qU = 0, qD = 0, qRo = 0, qLo = 0, qUo = 0, qDo = 0, off = 0, n = 0, maxSmall = 0, sumA = 0;
    for (let i = 0; i < S.n; i++) {
      const o = S.om[i]; if (o.eye !== eye) continue;
      const dx = o.x - (-az / FIELD_AZ), dy = o.y - (-el / FIELD_EL);
      const daz = (o.az - az), del = (o.el - el), d = Math.hypot(daz, del); if (d > r) continue;
      n++; off += S.off[i]; sumA += Math.abs(S.A[i]);
      // Auswaerts-Bewegung je Quadrant (Bild-x rechts = Azimut kleiner)
      if (dx > 0.02) { qR += Math.max(0, S.mx[i]); qRo += Math.max(0, S.mxOff[i]); }
      if (dx < -0.02) { qL += Math.max(0, -S.mx[i]); qLo += Math.max(0, -S.mxOff[i]); }
      if (dy < -0.02) { qU += Math.max(0, S.my[i]); qUo += Math.max(0, S.myOff[i]); }
      if (dy > 0.02) { qD += Math.max(0, -S.my[i]); qDo += Math.max(0, -S.myOff[i]); }
    }
    if (!n) return null;
    // kleines Objekt: ein Ommatidium aendert sich stark, die Umgebung kaum (Zentrum-Umfeld)
    for (let i = 0; i < S.n; i++) {
      const o = S.om[i]; if (o.eye !== eye) continue;
      const d = Math.hypot(o.az - az, o.el - el); if (d > r) continue;
      const c = Math.abs(S.A[i]); if (c < 0.03) continue;
      // Umfeld-Hemmung: ein Nachbar darf mitmachen (Objekt zwischen zwei Ommatidien), eine Kante
      // (zwei oder mehr Nachbarn) wird unterdrueckt
      const nbA = o.nb.map((j) => Math.abs(S.A[j])).sort((a, b) => b - a);
      if (nbA.length > 1 && nbA[1] > 0.35 * c) continue;
      let ring = 0; for (const j of o.ring) ring += Math.abs(S.A[j]); ring /= Math.max(1, o.ring.length);
      const small = c - 4 * ring;
      if (small > maxSmall) maxSmall = small;
    }
    const expand = Math.min(qR, qL, qU, qD) / n, expandOff = Math.min(qRo, qLo, qUo, qDo) / n;
    return { expand, expandOff, off: off / n, small: maxSmall, change: sumA / n };
  }

  // Bildfluss eines ganzen Auges: horizontal "von vorne nach hinten" und vertikal
  function wideField(S, eye) {
    let fb = 0, v = 0, n = 0;
    for (let i = 0; i < S.n; i++) {
      const o = S.om[i]; if (o.eye !== eye) continue;
      // Bild-x nach rechts: fuer das linke Auge ist "nach hinten" = Bild-x nach links (negativ)
      fb += eye === "L" ? -S.mx[i] : S.mx[i]; v += Math.abs(S.my[i]); n++;
    }
    return { fb: fb / n, v: v / n };
  }

  // Leuchtdichte aus RGBA-Pixeln
  function lumFromRGBA(data, w, h) {
    const lum = new Float32Array(w * h);
    for (let p = 0, q = 0; q < w * h; p += 4, q++) lum[q] = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
    return { w, h, lum };
  }

  root.FlyEyes = { makeEyes, sample, step, rfFeatures, wideField, lumFromRGBA, STEP, FIELD_AZ, FIELD_EL };
  if (typeof module !== "undefined") module.exports = root.FlyEyes;
})(typeof self !== "undefined" ? self : globalThis);
