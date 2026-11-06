/* Welt 2: Air-Piano – jeder Finger ist eine Taste (wie Video 1) */
(() => {
  'use strict';
  const S = window.S, { clamp, lerp, mtof } = S;
  const ID = 'piano';
  const o = (k, d) => S.opt(ID, k, d);

  const SCALES = {
    penta: { name: 'C-Dur Pentatonik', notes: [48, 50, 52, 55, 57, 60, 62, 64, 67, 69] },
    moll: { name: 'A-Moll Pentatonik', notes: [45, 48, 50, 52, 55, 57, 60, 62, 64, 67] },
    jazz: { name: 'Amapiano-Akkord', notes: [45, 52, 55, 59, 60, 64, 67, 71, 72, 76] },
    japan: { name: 'Japanisch', notes: [50, 51, 55, 57, 58, 62, 63, 67, 69, 70] },
  };
  const M = {
    id: ID, name: 'Air-Piano', color: [124, 255, 79],
    short: 'Jeder Finger ist eine Taste. Finger beugen spielt einen Ton, wie ein Klavier in der Luft.',
    hint: 'Halte beide Hände hoch, Handflächen zur Kamera. Beuge einen Finger nach vorn, um ihn zu spielen.',
    bpm: () => 84, swing: () => 0.04,
  };
  const keys = Array.from({ length: 10 }, (_, i) => ({ i, down: false, curl: 0, lvl: 0, flash: 0, x: 0, y: 0, note: 0, vel: 0, last: 0, voice: null }));
  const floaters = [];
  let played = 0, lastNote = null, lastVel = 0;
  const N = {}; let built = false;

  function build() {
    const AC = S.AC, G = S.G;
    N.out = G(0); N.out.connect(S.A.bus);
    N.inst = G(1); N.inst.connect(N.out);
    N.rev = G(0.32); N.inst.connect(N.rev); N.rev.connect(S.A.revIn);
    N.dly = G(0.12); N.inst.connect(N.dly); N.dly.connect(S.A.dlyIn);
    // leise Fläche (Grundton + Quinte) als Bett
    N.pad = G(0); N.padLP = S.F('lowpass', 900, 0.7); N.padLP.connect(N.pad); N.pad.connect(N.out);
    const pr = S.G(0.3); N.pad.connect(pr); pr.connect(S.A.revIn);
    N.padOsc = [0, 7, 12, 19].map((iv, k) => { const x = AC.createOscillator(); x.type = k % 2 ? 'sine' : 'triangle'; x.detune.value = (k - 1.5) * 4; const g = G([0.16, 0.1, 0.08, 0.05][k]); x.connect(g); g.connect(N.padLP); x.start(); return { x, iv }; });
    N.beat = G(0.8); N.beat.connect(N.out);
    built = true; retunePad();
  }
  function retunePad() {
    if (!built) return;
    const base = SCALES[o('skala', 'penta')].notes[0];
    for (const p of N.padOsc) p.x.frequency.setTargetAtTime(mtof(base - 12 + p.iv), S.AC.currentTime, 0.2);
    N.pad.gain.setTargetAtTime(o('begleitung', 'pad') === 'aus' ? 0 : 0.5, S.AC.currentTime, 0.4);
  }

  // ---------- Klänge (sauber, ohne Verzerrung) ----------
  function playNote(k, vel) {
    if (!built || !S.AC) return;
    const AC = S.AC, t = AC.currentTime + 0.005, midi = SCALES[o('skala', 'penta')].notes[k] + (o('oktave', 0) | 0) * 12, f = mtof(midi);
    const kind = o('klang', 'epiano');
    const out = AC.createGain(), pn = S.pan((k - 4.5) / 6);
    out.connect(pn); pn.connect(N.inst);
    const stops = []; let len = 2.4;
    if (kind === 'epiano') {
      const c = AC.createOscillator(); c.frequency.value = f;
      const m = AC.createOscillator(); m.frequency.value = f; const mi = AC.createGain();
      mi.gain.setValueAtTime(f * (1.2 + vel * 2.2), t); mi.gain.setTargetAtTime(f * 0.25, t, 0.25); m.connect(mi); mi.connect(c.frequency);
      const tn = AC.createOscillator(); tn.frequency.value = f * 14; const ti = AC.createGain(); ti.gain.setValueAtTime(f * 0.7 * vel, t); ti.gain.setTargetAtTime(0, t, 0.03); tn.connect(ti); ti.connect(c.frequency);
      out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.32 * (0.4 + vel * 0.6), t + 0.004); out.gain.setTargetAtTime(0.0001, t + 0.02, 0.9);
      c.connect(out); stops.push(c, m, tn); len = 3.2;
    } else if (kind === 'pluck') {
      const a = AC.createOscillator(); a.type = 'sawtooth'; a.frequency.value = f; const b = AC.createOscillator(); b.type = 'square'; b.frequency.value = f * 1.004;
      const lp = S.F('lowpass', 400, 4); lp.frequency.setValueAtTime(600 + vel * 5000, t); lp.frequency.setTargetAtTime(380, t, 0.12);
      const bg = S.G(0.4); a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(out);
      out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.18 * (0.4 + vel * 0.6), t + 0.003); out.gain.setTargetAtTime(0.0001, t + 0.01, 0.35);
      stops.push(a, b); len = 1.6;
    } else if (kind === 'marimba') {
      [[1, 0.36, 0.45], [4, 0.12, 0.09], [9.9, 0.05, 0.025]].forEach(([r, g, d]) => { const x = AC.createOscillator(); x.frequency.value = f * r; const gg = AC.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(g * (0.4 + vel * 0.6), t + 0.003); gg.gain.setTargetAtTime(0.0001, t + 0.005, d); x.connect(gg); gg.connect(out); stops.push(x); });
      out.gain.value = 1; len = 1.4;
    } else {
      const c = AC.createOscillator(); c.frequency.value = f; const m = AC.createOscillator(); m.frequency.value = f * 3.5; const mi = AC.createGain();
      mi.gain.setValueAtTime(f * 3 * vel, t); mi.gain.setTargetAtTime(f * 0.2, t, 0.6); m.connect(mi); mi.connect(c.frequency);
      out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.22 * (0.4 + vel * 0.6), t + 0.003); out.gain.setTargetAtTime(0.0001, t + 0.02, 1.4);
      c.connect(out); stops.push(c, m); len = 4.5;
    }
    stops.forEach(x => { x.start(t); x.stop(t + len); });
    return { out, t };
  }
  function releaseNote(v) {
    if (!v || !S.AC) return;
    const t = S.AC.currentTime; v.out.gain.cancelScheduledValues(t); v.out.gain.setTargetAtTime(0.0001, t, o('klang', 'epiano') === 'glocke' ? 0.5 : 0.18);
  }

  M.step = (i, t) => {
    if (!built || o('begleitung', 'pad') !== 'beat') return;
    const AC = S.AC;
    if (i % 8 === 0 || i === 11) { const k = AC.createOscillator(); k.frequency.setValueAtTime(120, t); k.frequency.setTargetAtTime(48, t, 0.03); const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.04, 0.09); k.connect(g); g.connect(N.beat); k.start(t); k.stop(t + 0.5); S.kickTimes.push(t); }
    S.noise(t, { type: 'highpass', f: 9000, dur: 0.03, gain: [0.12, 0.05, 0.08, 0.05][i % 4], p: i % 2 ? 0.25 : -0.25, dest: N.beat });
    if (i === 4 || i === 12) { S.noise(t, { type: 'bandpass', f: 1800, q: 1.5, dur: 0.06, gain: 0.2, rev: 0.25, dest: N.beat }); }
  };

  // ---------- Bild ----------
  function maxBox(ctx, x, y, text) {
    ctx.font = '600 8.5px "JetBrains Mono", monospace';
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(30,30,30,.55)'; ctx.fillRect(x - w / 2, y, w, 12);
    ctx.strokeStyle = 'rgba(190,190,190,.6)'; ctx.lineWidth = 0.8; ctx.strokeRect(x - w / 2, y, w, 12);
    ctx.fillStyle = 'rgba(235,235,235,.95)'; ctx.fillText(text, x - w / 2 + 4, y + 9);
  }

  let touchMap = new Map();
  M.frame = (now, dt) => {
    const ctx = S.ctx, W = S.W, H = S.H;
    // Hintergrund: Kamera natürlich, ohne Kamera dunkler Verlauf
    if (!S.drawCamera(ctx, o('kamerabild', 'normal') === 'dunkel' ? 0.45 : 1)) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d1a10'); g.addColorStop(1, '#030604'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 0, W, H);
    const rowY = H * 0.6;
    const green = 'rgb(124,255,79)';
    if (S.usingCamera()) {
      const hands = S.hands;
      for (const side of ['L', 'R']) {
        const h = hands[side];
        for (let f = 0; f < 5; f++) {
          const k = side === 'L' ? 4 - f : 5 + f, key = keys[k];
          if (!h) { key.lvl = lerp(key.lvl, 0, 0.2); if (key.down) { key.down = false; releaseNote(key.voice); } continue; }
          const curl = h.curl[f], cv = h.curlV[f], tip = h.tips[f];
          key.curl = curl; key.x = tip[0]; key.y = tip[1]; key.lvl = lerp(key.lvl, curl, 0.5);
          const on = f === 0 ? 0.5 : 0.55, off = f === 0 ? 0.3 : 0.34;
          if (!key.down && (curl > on && cv > 0.8 || curl > on + 0.2) && now - key.last > 90) {
            key.down = true; key.last = now; const vel = clamp(0.35 + cv / 9); key.vel = vel;
            key.voice = playNote(k, vel); key.flash = 1; played++; lastNote = SCALES[o('skala', 'penta')].notes[k]; lastVel = vel;
            floaters.push({ x: tip[0], y: tip[1] - 16, t: now, text: S.noteName(lastNote + (o('oktave', 0) | 0) * 12) });
          } else if (key.down && curl < off) { key.down = false; releaseNote(key.voice); }
        }
        // Linien von der Handwurzel zu den Fingerspitzen, wie im Video
        if (h && !h.touch && S.settings.skel !== 'aus') {
          ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.1;
          ctx.beginPath(); for (const tip of h.tips) { ctx.moveTo(h.pts[0][0], h.pts[0][1]); ctx.lineTo(tip[0], tip[1]); } ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.35)';
          ctx.beginPath(); for (let a = 0; a < 4; a++) { ctx.moveTo(h.tips[a][0], h.tips[a][1]); ctx.lineTo(h.tips[a + 1][0], h.tips[a + 1][1]); } ctx.stroke();
        }
      }
    } else {
      // Touch: zehn Glastasten unten
      const kw = W / 10, ky = H * 0.6, kh = H * 0.22;
      const active = new Set();
      for (const p of S.pointers.values()) { if (p.y > ky - 20 && p.y < ky + kh + 40) active.add(clamp(Math.floor(p.x / kw), 0, 9)); }
      keys.forEach((key, k) => {
        key.x = (k + 0.5) * kw; key.y = ky - 30;
        const on = active.has(k);
        if (on && !key.down) { key.down = true; key.voice = playNote(k, 0.8); key.flash = 1; played++; lastNote = SCALES[o('skala', 'penta')].notes[k]; lastVel = 0.8; floaters.push({ x: key.x, y: key.y - 20, t: now, text: S.noteName(lastNote) }); }
        if (!on && key.down) { key.down = false; releaseNote(key.voice); }
        key.lvl = lerp(key.lvl, on ? 1 : 0, 0.4);
        ctx.fillStyle = on ? 'rgba(124,255,79,.35)' : 'rgba(255,255,255,.08)'; ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(k * kw + 4, ky, kw - 8, kh, 14); else ctx.rect(k * kw + 4, ky, kw - 8, kh); ctx.fill(); ctx.stroke();
      });
    }
    // Pegelbalken je Finger + Max-Kästchen
    keys.forEach((key, k) => {
      if (!S.usingCamera() && !key.x) return;
      if (S.usingCamera() && !(S.hands[k < 5 ? 'L' : 'R'])) return;
      key.flash *= Math.pow(0.02, dt);
      const bx = key.x, by = rowY, bh = H * 0.07, bw = 9;
      if (S.usingCamera()) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(key.x, key.y); ctx.lineTo(bx, by - 6); ctx.stroke(); }
      // zwei Balken nebeneinander wie im Video
      ctx.fillStyle = 'rgba(124,255,79,.22)'; ctx.fillRect(bx - bw - 1, by, bw, bh); ctx.fillRect(bx + 1, by, bw, bh);
      ctx.fillStyle = green;
      const lv = clamp(key.lvl), fl = clamp(key.flash);
      ctx.fillRect(bx - bw - 1, by + bh * (1 - lv), bw, bh * lv);
      ctx.fillRect(bx + 1, by + bh * (1 - fl), bw, bh * fl);
      if (key.down || fl > 0.5) { ctx.save(); ctx.shadowColor = green; ctx.shadowBlur = 14; ctx.fillRect(bx - bw - 1, by, bw * 2 + 2, 2); ctx.restore(); }
      if (o('werte', 'an') === 'an') {
        maxBox(ctx, bx, by + bh + 6, 'c ' + key.curl.toFixed(2));
        maxBox(ctx, bx, by + bh + 22, 'n ' + (SCALES[o('skala', 'penta')].notes[k] + (o('oktave', 0) | 0) * 12));
        if (key.down) maxBox(ctx, bx, by + bh + 38, 'v ' + Math.round(key.vel * 127));
      }
      // Fingerspitze
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(key.x, key.y, key.down ? 7 : 4.5, 0, 6.2832); ctx.fill();
      if (key.down) { ctx.strokeStyle = green; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(key.x, key.y, 12 + (1 - fl) * 10, 0, 6.2832); ctx.stroke(); }
    });
    // aufsteigende Notennamen
    ctx.font = '700 15px "Unbounded", sans-serif'; ctx.textAlign = 'center';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i], a = 1 - (now - f.t) / 1100;
      if (a <= 0) { floaters.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(124,255,79,${a})`; ctx.fillText(f.text, f.x, f.y - (1 - a) * 40);
    }
    ctx.textAlign = 'left';
    S.setSection(lastNote !== null ? S.noteName(lastNote + (o('oktave', 0) | 0) * 12) : 'SPIEL', SCALES[o('skala', 'penta')].name.toUpperCase() + ' · ' + played + ' TÖNE');
  };

  M.enter = () => { if (!built) build(); N.out.gain.setTargetAtTime(1, S.AC.currentTime, 0.05); retunePad(); };
  M.exit = () => { if (built) N.out.gain.setTargetAtTime(0, S.AC.currentTime, 0.06); keys.forEach(k => { k.down = false; }); };
  M.onSetting = () => retunePad();
  const avg = side => { const h = S.hands[side]; return h ? h.curl.reduce((a, b) => a + b, 0) / 5 : 0; };
  M.matrix = [
    ['L BEUGUNG', () => avg('L'), () => Math.round(avg('L') * 100) + '%'],
    ['R BEUGUNG', () => avg('R'), () => Math.round(avg('R') * 100) + '%'],
    ['LETZTER TON', () => lastNote === null ? 0 : (lastNote - 40) / 40, () => lastNote === null ? '–' : S.noteName(lastNote)],
    ['ANSCHLAG', () => lastVel, () => Math.round(lastVel * 127) + ''],
  ];
  M.gestures = [['Finger beugen', 'spielt die Taste dieses Fingers'], ['Schneller beugen', 'lauter (Anschlag)'], ['Finger strecken', 'Taste loslassen'],
    ['Linke Hand', 'tiefe Töne (kleiner Finger ganz links)'], ['Rechte Hand', 'hohe Töne (Daumen zuerst)']];
  M.settings = [
    { key: 'klang', label: 'Klang', def: 'epiano', options: [['epiano', 'E-Piano'], ['pluck', 'Pluck'], ['marimba', 'Marimba'], ['glocke', 'Glocke']] },
    { key: 'skala', label: 'Tonleiter', def: 'penta', options: Object.entries(SCALES).map(([k, v]) => [k, v.name]) },
    { key: 'oktave', label: 'Oktave', def: 0, options: [[-1, 'Tiefer'], [0, 'Normal'], [1, 'Höher']] },
    { key: 'begleitung', label: 'Begleitung', def: 'pad', options: [['aus', 'Aus'], ['pad', 'Fläche'], ['beat', 'Fläche + Beat']] },
    { key: 'werte', label: 'Messwerte anzeigen', def: 'an', options: [['an', 'An'], ['aus', 'Aus']] },
    { key: 'kamerabild', label: 'Kamerabild', def: 'normal', options: [['normal', 'Normal'], ['dunkel', 'Dunkel']] },
  ];
  window.__piano = { keys, get played() { return played; } };
  S.register(M);
})();
