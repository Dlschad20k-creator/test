/* Welt 5: Amapiano Voodoo – Amapiano-Beat und Voodoo-Puppen im Papier-Stop-Motion-Stil (12 Bilder/s), geführt wie Marionetten */
(() => {
  'use strict';
  const S = window.S, { clamp, lerp, mtof } = S;
  const ID = 'amapiano';
  const o = (k, d) => S.opt(ID, k, d);

  // ---------------- Musik ----------------
  const V = { Am9: [60, 64, 67, 71], Dm9: [65, 69, 72, 76], G13: [65, 69, 71, 76], Cmaj9: [64, 67, 71, 74], Fmaj9: [57, 60, 64, 67], Em7: [59, 62, 64, 67], G9: [65, 69, 71, 74], Bbmaj9: [62, 65, 69, 72] };
  const ROOT = { Am9: 33, Dm9: 38, G13: 31, Cmaj9: 36, Fmaj9: 29, Em7: 28, G9: 31, Bbmaj9: 34 };
  const CNAME = { Am9: 'Am9', Dm9: 'Dm9', G13: 'G13', Cmaj9: 'Cmaj9', Fmaj9: 'Fmaj9', Em7: 'Em7', G9: 'G9', Bbmaj9: 'B♭maj9' };
  const PROGS = [null,
    ['Am9', 'Dm9', 'G13', 'Cmaj9'], ['Fmaj9', 'Em7', 'Dm9', 'Am9'], ['Dm9', 'G9', 'Cmaj9', 'Am9'],
    ['Am9', 'Am9', 'Dm9', 'Dm9'], ['Bbmaj9', 'Am9', 'Bbmaj9', 'Am9']];
  const PIANO = [[0, 0.5, 'long'], [3, 0.8], [6, 0.65], [10, 0.85], [13, 0.7]];
  const LOG_A = { 0: [0, 1], 3: [0, 0.8], 6: [12, 0.9], 8: [0, 0.7], 10: [7, 0.8], 11: [0, 0.6], 14: [10, 0.85] };
  const LOG_B = { 0: [0, 1], 2: [0, 0.6], 5: [12, 0.9], 7: [7, 0.7], 10: [0, 0.9], 12: [3, 0.7], 13: [5, 0.7], 15: [7, 0.85] };
  const CONGA = { 3: 0, 6: 1, 9: 1, 11: 0, 14: 1 };
  const WOOD = [1, 7, 13];

  const M = {
    id: ID, name: 'Amapiano', color: [255, 150, 40],
    short: 'Sauberer Amapiano-Beat mit Log-Drum und Jazz-Piano. Drei Voodoo-Puppen tanzen im Papier-Stop-Motion-Stil, deine Hände führen sie an Fäden.',
    hint: 'Deine Hände sind die Marionettenkreuze. Öffnen = Arme hoch, Faust = in die Hocke. Links Finger zeigen: Energie.',
    bpm: () => o('tempo', 113), swing: () => o('swing', 16) / 100,
  };
  const DEF = { cut: 0.8, space: 0.3, echo: 0.12, dance: 0.6 };
  const P = { ...DEF, prog: 1, energy: 5 }, T = { ...DEF, prog: 1, energy: 5 };
  let energyNow = 5, pending = null, pendingBar = -1, curChord = 'Am9', vocalQ = [], heyQ = 0;
  const N = {}; let built = false;

  function build() {
    const AC = S.AC, G = S.G, F = S.F;
    N.out = G(0); N.out.connect(S.A.bus);
    N.drums = G(0.9); N.drums.connect(N.out);
    N.music = G(1); N.lp = F('lowpass', 12000, 0.7); N.duck = G(1);
    N.music.connect(N.lp); N.lp.connect(N.duck); N.duck.connect(N.out);
    N.rev = G(0.3); N.duck.connect(N.rev); N.rev.connect(S.A.revIn);
    N.piano = G(1); N.piano.connect(N.music);
    N.echo = G(0.12); N.piano.connect(N.echo); N.echo.connect(S.A.dlyIn);
    // weiche Fläche unter den Akkorden
    N.padLP = F('lowpass', 1100, 0.6); N.padG = G(0.5); N.padLP.connect(N.padG); N.padG.connect(N.music);
    N.pad = [0, 1, 2, 3].map(k => {
      const a = AC.createOscillator(); a.type = 'triangle'; const b = AC.createOscillator(); b.type = 'sawtooth'; b.detune.value = 6;
      const ga = G(0.07), gb = G(0.018), pn = S.pan((k - 1.5) * 0.4); a.connect(ga); b.connect(gb); ga.connect(pn); gb.connect(pn); pn.connect(N.padLP); a.start(); b.start();
      return { a, b };
    });
    N.logBus = G(1); N.logBus.connect(N.drums);
    N.logSh = AC.createWaveShaper(); N.logSh.curve = S.curve(0.25);
    N.logLP = F('lowpass', 1400, 0.8); N.logSh.connect(N.logLP); N.logLP.connect(N.logBus);
    built = true; setPad(curChord, AC.currentTime, true);
  }
  function setPad(name, t, now) {
    if (!built) return; const v = V[name];
    N.pad.forEach((p, k) => { const f = mtof(v[k] - 12); p.a.frequency.setTargetAtTime(f, t, now ? 0.001 : 0.08); p.b.frequency.setTargetAtTime(f, t, now ? 0.001 : 0.08); });
  }
  // Log-Drum: das Herz von Amapiano – tiefer, holziger Ton mit Tonhöhen-Rutsch
  let lastLogF = 0, lastLogT = 0;
  function logDrum(t, midi, vel, st) {
    const AC = S.AC, f = mtof(midi);
    const a = AC.createOscillator(), b = AC.createOscillator(); b.type = 'triangle';
    const glide = lastLogF && t - lastLogT < st * 2.2 && Math.random() < 0.55;
    for (const x of [a, b]) {
      if (glide) { x.frequency.setValueAtTime(lastLogF * (x === b ? 1.004 : 1), t); x.frequency.exponentialRampToValueAtTime(f * (x === b ? 1.004 : 1), t + 0.06); }
      else { x.frequency.setValueAtTime(f * 2.2, t); x.frequency.setTargetAtTime(f * (x === b ? 1.004 : 1), t, 0.012); }
    }
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.75 * vel, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.05, 0.14);
    const bg = S.G(0.35); a.connect(g); b.connect(bg); bg.connect(g); g.connect(N.logSh);
    S.noise(t, { type: 'bandpass', f: 1900, q: 2.2, dur: 0.022, gain: 0.12 * vel, dest: N.logBus });
    a.start(t); b.start(t); a.stop(t + 0.7); b.stop(t + 0.7);
    lastLogF = f; lastLogT = t;
  }
  function kick(t) {
    const AC = S.AC, k = AC.createOscillator(); k.frequency.setValueAtTime(115, t); k.frequency.setTargetAtTime(52, t, 0.028);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.04, 0.08);
    k.connect(g); g.connect(N.drums); k.start(t); k.stop(t + 0.5); S.kickTimes.push(t);
    N.duck.gain.cancelScheduledValues(t); N.duck.gain.setValueAtTime(1, t); N.duck.gain.linearRampToValueAtTime(0.7, t + 0.005); N.duck.gain.setTargetAtTime(1, t + 0.02, 0.07);
  }
  const shaker = (t, v) => S.noise(t, { type: 'bandpass', f: 7600, q: 0.8, att: 0.005, dur: 0.065, gain: 0.22 * v, p: 0.25, dest: N.drums });
  const openHat = t => S.noise(t, { type: 'highpass', f: 8200, dur: 0.17, gain: 0.11, p: -0.2, dest: N.drums });
  function rim(t) {
    const AC = S.AC, x = AC.createOscillator(); x.type = 'triangle'; x.frequency.value = 1750;
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    x.connect(g); g.connect(N.drums); const r = S.G(0.35); g.connect(r); r.connect(S.A.revIn); x.start(t); x.stop(t + 0.06);
    S.noise(t, { type: 'bandpass', f: 3000, q: 1.5, dur: 0.02, gain: 0.12, dest: N.drums });
  }
  function clap(t) { for (const d of [0, 0.012, 0.024]) S.noise(t + d, { type: 'bandpass', f: 1400, q: 1, dur: 0.02, gain: 0.18, dest: N.drums }); S.noise(t + 0.03, { type: 'bandpass', f: 1200, q: 0.9, dur: 0.2, gain: 0.15, rev: 0.4, dest: N.drums }); }
  function conga(t, hi) {
    const AC = S.AC, f = hi ? 330 : 220, x = AC.createOscillator(); x.frequency.setValueAtTime(f * 1.4, t); x.frequency.setTargetAtTime(f, t, 0.008);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.002); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.05);
    const pn = S.pan(hi ? 0.35 : -0.35); x.connect(g); g.connect(pn); pn.connect(N.drums); x.start(t); x.stop(t + 0.3);
  }
  function wood(t) {
    const AC = S.AC, x = AC.createOscillator(); x.frequency.value = 880;
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    const pn = S.pan(0.5); x.connect(g); g.connect(pn); pn.connect(N.drums); x.start(t); x.stop(t + 0.07);
  }
  // Jazz-Piano: weich, glockig, ohne Verzerrung
  function pianoChord(t, notes, vel, len) {
    const AC = S.AC;
    notes.forEach((m, k) => {
      const f = mtof(m), tt = t + k * 0.006;
      const a = AC.createOscillator(); a.type = 'triangle'; a.frequency.value = f;
      const b = AC.createOscillator(); b.frequency.value = f * 2; const bg = S.G(0.22);
      const c = AC.createOscillator(); c.frequency.value = f; const mg = AC.createGain(); mg.gain.setValueAtTime(f * 0.9 * vel, tt); mg.gain.setTargetAtTime(f * 0.1, tt, 0.15); c.connect(mg); mg.connect(a.frequency);
      const g = AC.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.07 * vel, tt + 0.004);
      g.gain.setTargetAtTime(0.035 * vel, tt + 0.01, 0.12); g.gain.setTargetAtTime(0.0001, tt + len, 0.09);
      a.connect(g); b.connect(bg); bg.connect(g); const pn = S.pan((k - 1.5) * 0.25); g.connect(pn); pn.connect(N.piano);
      for (const x of [a, b, c]) { x.start(tt); x.stop(tt + len + 0.6); }
    });
  }
  function hey(t) {
    S.noise(t, { type: 'bandpass', f: 2600, q: 1.2, dur: 0.06, gain: 0.18, dest: N.music });
    S.vocal(t, V[curChord][2] + 12, N.music, 0.5, 0.16);
  }
  M.step = (i, t, st, bar) => {
    if (!built) return;
    if (i === 0) {
      if (pending !== null && bar >= pendingBar) { energyNow = pending; pending = null; if (energyNow > 0) { S.impact(t, N.drums); hey(t + 0.02); jumpAt = performance.now() + (t - S.AC.currentTime) * 1000; burst(30); } }
      const pr = PROGS[Math.round(P.prog)];
      if (pr) { curChord = pr[bar % pr.length]; setPad(curChord, t); }
      N.padG.gain.setTargetAtTime(pr ? 0.5 : 0, t, 0.3);
    }
    const e = energyNow, pr = PROGS[Math.round(P.prog)], root = ROOT[curChord];
    if (pr) for (const [s, vel, len] of PIANO) if (s === i) pianoChord(t, V[curChord], vel, len === 'long' ? st * 7 : st * 1.4);
    if (e >= 1 || i % 2 === 0) shaker(t, [0.4, 0.6, 0.95, 0.6][i % 4] * (e >= 1 ? 1 : 0.5));
    if (e >= 1 && i % 4 === 2) openHat(t);
    if (e >= 2) { const pat = (bar % 2 && e >= 5) ? LOG_B : LOG_A; const n = pat[i]; if (n) logDrum(t, root + 12 + n[0], n[1], st); }
    if (e >= 3 && i % 4 === 0) kick(t);
    if (e >= 3 && (i === 4 || i === 12)) rim(t);
    if (e >= 4) { if (i in CONGA) conga(t, CONGA[i] === 1); if (WOOD.includes(i)) wood(t); }
    if (e >= 5 && (i === 4 || i === 12)) clap(t);
    if (e >= 5 && i === 14 && bar % 4 === 3) S.vocal(t, V[curChord][3] + 12, N.music, 0.35, 0.22);
    while (vocalQ.length) { const hi = vocalQ.shift(); S.vocal(t, V[curChord][hi ? 3 : 1] + 12, N.music, 0.45, 0.28); }
    if (heyQ) { heyQ = 0; hey(t); }
  };
  function requestEnergy(e) {
    if (e === energyNow && pending === null) return;
    if (energyNow === 0 && e > 0 && pending === null) {
      let left = S.nextBarSteps(), target = S.seq.bar + 1; if (left < 8) { left += 16; target++; }
      pending = e; pendingBar = target; S.riser(S.seq.next, left * 60 / M.bpm() / 4, N.out);
    } else if (pending !== null) pending = e === 0 ? null : e;
    else energyNow = e;
  }

  // ---------------- Bühne ----------------
  const INK = '#1a0f1c';
  let rngState = 1;
  const rnd = () => { rngState |= 0; rngState = rngState + 0x6D2B79F5 | 0; let t = Math.imul(rngState ^ rngState >>> 15, 1 | rngState); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const J = a => (rnd() - 0.5) * a;
  let stage = null, layer = null, lctx = null, groundY = 0, charH = 0;
  function buildStage() {
    const W = S.W, H = S.H, d = S.dpr;
    stage = document.createElement('canvas'); stage.width = Math.round(W * d); stage.height = Math.round(H * d);
    const g = stage.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
    const mh = (document.getElementById('matrix').offsetHeight || 120) + 30; groundY = Math.min(H * 0.86, H - mh); charH = Math.min(H * 0.33, W * 0.44, (groundY - 110) * 0.78);
    const sky = g.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#120922'); sky.addColorStop(0.55, '#3a1450'); sky.addColorStop(0.9, '#b3502f'); sky.addColorStop(1, '#e0773a');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    rngState = 7;
    g.fillStyle = 'rgba(255,240,210,.8)'; for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(rnd() * W, rnd() * groundY * 0.6, rnd() * 1.4 + 0.3, 0, 6.28); g.fill(); }
    // Mond aus Papier
    const mx = W * 0.78, my = H * 0.24, mr = Math.min(W, H) * 0.1;
    g.fillStyle = '#ffe2a0'; g.beginPath(); for (let a = 0; a < 6.3; a += 0.3) { const r = mr + J(3); g[a ? 'lineTo' : 'moveTo'](mx + Math.cos(a) * r, my + Math.sin(a) * r); } g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = 'rgba(200,150,90,.45)'; for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.12], [-0.05, 0.35, 0.1]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 6.28); g.fill(); }
    // Bäume als Scherenschnitt (links und rechts), Moos
    const tree = (x, s, flip) => {
      g.fillStyle = '#1c0d26'; g.beginPath();
      g.moveTo(x - 0.05 * s * flip, groundY); g.lineTo(x - 0.03 * s * flip, groundY - 0.55 * s); g.lineTo(x - 0.2 * s * flip, groundY - 0.75 * s);
      g.lineTo(x - 0.05 * s * flip, groundY - 0.7 * s); g.lineTo(x + 0.02 * s * flip, groundY - 0.95 * s); g.lineTo(x + 0.1 * s * flip, groundY - 0.72 * s);
      g.lineTo(x + 0.28 * s * flip, groundY - 0.82 * s); g.lineTo(x + 0.06 * s * flip, groundY - 0.55 * s); g.lineTo(x + 0.05 * s * flip, groundY); g.closePath(); g.fill();
      g.strokeStyle = '#3b5b3a'; g.lineWidth = 2;
      for (let k = 0; k < 9; k++) { const sx = x + (rnd() - 0.4) * 0.4 * s * flip, sy = groundY - (0.6 + rnd() * 0.3) * s; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + J(8), sy + 30, sx + J(10), sy + 40 + rnd() * 50); g.stroke(); }
    };
    tree(W * 0.04, H * 0.62, 1); tree(W * 0.97, H * 0.56, -1);
    // Bühnenboden aus Holzplanken
    g.fillStyle = '#3a2214'; g.fillRect(0, groundY - 6, W, H - groundY + 6);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5;
    for (let y = groundY + 6; y < H; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let k = -8; k < 18; k++) { g.beginPath(); g.moveTo(W / 2 + k * 60, groundY); g.lineTo(W / 2 + k * 110, H); g.stroke(); }
    g.fillStyle = '#5a3520'; g.fillRect(0, groundY - 8, W, 6); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(-2, groundY - 8, W + 4, 6);
    // Papierstruktur
    for (let i = 0; i < W * H / 60; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; g.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
    layer = document.createElement('canvas'); layer.width = stage.width; layer.height = stage.height; lctx = layer.getContext('2d');
    for (const c of CHARS) c.px = c.base * W;
  }

  // ---------------- Figuren ----------------
  const CHARS = [
    { id: 'puppe', name: 'Puppe Lumpi', base: 0.5, px: 0, scale: 1.12, back: 0 },
    { id: 'baron', name: 'Baron Knochen', base: 0.2, px: 0, scale: 0.88, back: 22 },
    { id: 'maske', name: 'Maskengeist', base: 0.8, px: 0, scale: 0.88, back: 22 },
  ];
  const basePose = () => ({ dx: 0, jump: 0, lean: 0, head: 0, aL1: 0.18, aL2: 0.15, aR1: 0.18, aR2: 0.15, lL1: 0.06, lL2: 0, lR1: 0.06, lR2: 0, flip: 1, squash: 1 });
  const PI = Math.PI;
  const MOVES = {
    sway(b, e, p) { const s = Math.sin(b * PI / 2); p.lean = s * 0.08; p.head = s * 0.12; p.aL1 = 0.2 + s * 0.12; p.aR1 = 0.2 - s * 0.12; const k = Math.abs(Math.cos(b * PI)) * 0.12; p.lL1 += k * 0.5; p.lR1 += k * 0.5; p.lL2 = p.lR2 = k; },
    bounce(b, e, p) { const k = Math.pow(Math.abs(Math.cos(b * PI)), 2) * e; p.lL1 = p.lR1 = 0.1 + k * 0.35; p.lL2 = p.lR2 = k * 0.8; p.aL1 = 0.3 + 0.5 * e * Math.max(0, Math.sin(b * PI)); p.aR1 = 0.3 + 0.5 * e * Math.max(0, -Math.sin(b * PI)); p.aL2 = p.aR2 = 0.5; p.head = 0.14 * Math.sin(b * 2 * PI); p.squash = 1 - k * 0.05; },
    arme(b, e, p) { const s = Math.floor(b) % 2, ph = b % 1, up = 0.4 + 2.4 * e * (1 - ph * 0.35); p.aL1 = s ? 0.4 : up; p.aR1 = s ? up : 0.4; p.aL2 = p.aR2 = 0.2; p.lean = (s ? 0.1 : -0.1) * e; const k = Math.abs(Math.cos(b * PI)) * 0.5 * e; p.lL1 = p.lR1 = 0.08 + k * 0.3; p.lL2 = p.lR2 = k * 0.6; },
    shimmy(b, e, p) { const w = Math.sin(b * 4 * PI); p.lean = 0.16 * e * Math.sin(b * 2 * PI); p.aL1 = 0.7 + 0.4 * w * e; p.aR1 = 0.7 - 0.4 * w * e; p.aL2 = p.aR2 = 1.2; p.head = -p.lean * 0.8; const k = 0.3 * e; p.lL1 = p.lR1 = 0.15 + k * 0.3; p.lL2 = p.lR2 = k * 0.5; },
    schritt(b, e, p) { p.dx = 0.14 * e * Math.sin(b * PI / 2); const s = Math.sin(b * PI); p.lL1 = 0.06 + Math.max(0, s) * 0.5 * e; p.lL2 = Math.max(0, s) * 0.9 * e; p.lR1 = 0.06 + Math.max(0, -s) * 0.5 * e; p.lR2 = Math.max(0, -s) * 0.9 * e; p.aL1 = 0.3 + Math.max(0, -s) * 0.9 * e; p.aR1 = 0.3 + Math.max(0, s) * 0.9 * e; p.aL2 = p.aR2 = 0.6; p.lean = -0.08 * s * e; },
    vosho(b, e, p) { const ph = (b % 2) / 2, drop = ph < 0.2 ? Math.sin(ph / 0.2 * PI / 2) : Math.max(0, 1 - (ph - 0.2) / 0.5), k = drop * e; p.lL1 = p.lR1 = 0.15 + k * 0.75; p.lL2 = p.lR2 = k * 1.5; p.aL1 = p.aR1 = 0.6 + k * 0.9; p.aL2 = p.aR2 = 0.4; p.head = -k * 0.2; p.squash = 1 - k * 0.08; },
    dreh(b, e, p) { p.flip = Math.cos(b * PI / 2); p.aL1 = p.aR1 = 1.2 + 1.2 * e; p.aL2 = p.aR2 = 0.3; const k = Math.abs(Math.cos(b * PI)) * 0.4 * e; p.lL1 = p.lR1 = 0.08 + k * 0.3; p.lL2 = p.lR2 = k * 0.5; },
  };
  const ORDER = ['bounce', 'schritt', 'arme', 'shimmy', 'vosho', 'bounce', 'dreh', 'schritt', 'vosho', 'arme'];

  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, s) => [a[0] * s, a[1] * s];
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  function joints(c, p) {
    const h = charH * (c.scale || 1), fl = p.flip, th = 0.2 * h, sh = 0.19 * h;
    const X = v => [v[0] * fl, v[1]];
    const lh = Math.max(th * Math.cos(p.lL1) + sh * Math.cos(p.lL1 - p.lL2), th * Math.cos(p.lR1) + sh * Math.cos(p.lR1 - p.lR2));
    const hip = [c.px + p.dx * h, groundY - 4 - (c.back || 0) - lh - p.jump * h];
    const torso = 0.3 * h * p.squash, neck = add(hip, rot([0, -torso], p.lean));
    const shL = add(neck, rot(X([-0.1 * h, 0.035 * h]), p.lean)), shR = add(neck, rot(X([0.1 * h, 0.035 * h]), p.lean));
    const dir = (a, side) => X([side * Math.sin(a), Math.cos(a)]);
    const elL = add(shL, mul(dir(p.aL1, -1), 0.15 * h)), wrL = add(elL, mul(dir(p.aL1 + p.aL2, -1), 0.14 * h));
    const elR = add(shR, mul(dir(p.aR1, 1), 0.15 * h)), wrR = add(elR, mul(dir(p.aR1 + p.aR2, 1), 0.14 * h));
    const hipL = add(hip, X([-0.06 * h, 0])), hipR = add(hip, X([0.06 * h, 0]));
    const knL = add(hipL, mul(dir(p.lL1, -1), th)), ftL = add(knL, mul(dir(p.lL1 - p.lL2, -1), sh));
    const knR = add(hipR, mul(dir(p.lR1, 1), th)), ftR = add(knR, mul(dir(p.lR1 - p.lR2, 1), sh));
    const head = add(neck, rot([0, -0.12 * h], p.lean + p.head * 0.5));
    return { h, fl, hip, neck, shL, shR, elL, elR, wrL, wrR, hipL, hipR, knL, knR, ftL, ftR, head, lean: p.lean, headA: p.lean + p.head, torso };
  }

  // Zeichenhelfer im Scherenschnitt-Stil: dicke Tusche-Kontur, flache Farbe, wackelnde Linien
  function limb(g, a, b, w, fill) {
    const ja = [a[0] + J(1.6), a[1] + J(1.6)], jb = [b[0] + J(1.6), b[1] + J(1.6)];
    g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = w + 5; g.beginPath(); g.moveTo(ja[0], ja[1]); g.lineTo(jb[0], jb[1]); g.stroke();
    g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  function shape(g, pts, fill, lw = 3) {
    g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0] + J(1.8), p[1] + J(1.8))); g.closePath();
    g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke();
  }
  function circ(g, x, y, r, fill, lw = 3) { g.beginPath(); g.ellipse(x + J(1.2), y + J(1.2), r + J(1), r + J(1), 0, 0, 6.2832); g.fillStyle = fill; g.fill(); if (lw) { g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); } }
  function stitches(g, a, b, n, len) {
    g.strokeStyle = '#5a3a1e'; g.lineWidth = 1.6;
    for (let i = 1; i < n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + PI / 2;
      g.beginPath(); g.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len); g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke(); }
  }
  // lokales Koordinatensystem (Drehung + Papier-Wende über flip)
  function local(g, at, ang, fl, fn) { g.save(); g.translate(at[0], at[1]); g.rotate(ang); g.scale(Math.max(0.08, Math.abs(fl)) * Math.sign(fl || 1), 1); fn(); g.restore(); }

  function drawPuppe(g, j) {
    const h = j.h, burl = '#c99d63', burl2 = '#b4864f';
    limb(g, j.hipL, j.knL, 0.065 * h, burl); limb(g, j.knL, j.ftL, 0.06 * h, burl); stitches(g, j.hipL, j.knL, 3, 4);
    limb(g, j.hipR, j.knR, 0.065 * h, burl); limb(g, j.knR, j.ftR, 0.06 * h, burl); stitches(g, j.hipR, j.knR, 3, 4);
    circ(g, j.ftL[0], j.ftL[1] + 2, 0.035 * h, burl2); circ(g, j.ftR[0], j.ftR[1] + 2, 0.035 * h, burl2);
    local(g, j.hip, j.lean, j.fl, () => {
      const t = j.torso;
      shape(g, [[-0.1 * h, -t + 0.02 * h], [0.1 * h, -t + 0.02 * h], [0.14 * h, -0.03 * h], [0.1 * h, 0.05 * h], [-0.1 * h, 0.05 * h], [-0.14 * h, -0.03 * h]], burl);
      g.save(); g.translate(0.03 * h, -0.14 * h); g.rotate(0.15);
      g.fillStyle = '#7a3b5c'; g.fillRect(-0.045 * h, -0.045 * h, 0.09 * h, 0.09 * h); g.setLineDash([4, 3]); g.strokeStyle = '#f2d9a8'; g.lineWidth = 1.6; g.strokeRect(-0.038 * h, -0.038 * h, 0.076 * h, 0.076 * h); g.setLineDash([]);
      g.restore();
      g.setLineDash([5, 4]); g.strokeStyle = '#5a3a1e'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-0.06 * h, -t + 0.06 * h); g.lineTo(-0.06 * h, 0.02 * h); g.stroke(); g.setLineDash([]);
    });
    limb(g, j.shL, j.elL, 0.055 * h, burl); limb(g, j.elL, j.wrL, 0.05 * h, burl); circ(g, j.wrL[0], j.wrL[1], 0.032 * h, burl2);
    limb(g, j.shR, j.elR, 0.055 * h, burl); limb(g, j.elR, j.wrR, 0.05 * h, burl); circ(g, j.wrR[0], j.wrR[1], 0.032 * h, burl2);
    local(g, j.head, j.headA, j.fl, () => {
      const r = 0.13 * h;
      // Nadeln
      g.lineWidth = 2; g.strokeStyle = '#d8d8d8';
      g.beginPath(); g.moveTo(r * 0.4, -r * 0.6); g.lineTo(r * 1.15, -r * 1.25); g.stroke(); circ(g, r * 1.15, -r * 1.25, 4.5, '#ff3b3b', 2);
      g.beginPath(); g.moveTo(-r * 0.5, -r * 0.4); g.lineTo(-r * 1.2, -r * 0.95); g.stroke(); circ(g, -r * 1.2, -r * 0.95, 4.5, '#3bd16f', 2);
      circ(g, 0, 0, r, burl);
      g.strokeStyle = '#8c1c2e'; g.lineWidth = 5; g.lineCap = 'round';
      for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * r * 0.22, -r * 0.85); g.quadraticCurveTo(k * r * 0.3 + J(6), -r * 1.25, k * r * 0.4 + J(8), -r * 1.05 + J(6)); g.stroke(); }
      circ(g, -0.42 * r, -0.08 * r, 0.27 * r, '#2e6fd8', 2.5); circ(g, 0.42 * r, -0.12 * r, 0.24 * r, '#e8c33a', 2.5);
      g.fillStyle = INK; for (const [dx, dy] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) { g.beginPath(); g.arc(-0.42 * r + dx * r, -0.08 * r + dy * r, 2, 0, 6.28); g.fill(); }
      for (const dx of [-0.06, 0.06]) { g.beginPath(); g.arc(0.42 * r + dx * r, -0.12 * r, 2, 0, 6.28); g.fill(); }
      g.strokeStyle = INK; g.lineWidth = 2;
      for (let k = -1.5; k <= 1.5; k++) { const x = k * r * 0.18, y = r * 0.45; g.beginPath(); g.moveTo(x - 4, y - 4); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y - 4); g.lineTo(x - 4, y + 4); g.stroke(); }
    });
  }
  function drawBaron(g, j, glow) {
    const h = j.h, suit = '#211735', bone = '#efe6d2';
    limb(g, j.hipL, j.knL, 0.06 * h, suit); limb(g, j.knL, j.ftL, 0.055 * h, suit);
    limb(g, j.hipR, j.knR, 0.06 * h, suit); limb(g, j.knR, j.ftR, 0.055 * h, suit);
    shape(g, [[j.ftL[0] - 0.05 * h, j.ftL[1]], [j.ftL[0] + 0.03 * h, j.ftL[1] - 0.02 * h], [j.ftL[0] + 0.03 * h, j.ftL[1] + 0.02 * h], [j.ftL[0] - 0.05 * h, j.ftL[1] + 0.02 * h]], '#0d0a14', 2);
    shape(g, [[j.ftR[0] + 0.05 * h, j.ftR[1]], [j.ftR[0] - 0.03 * h, j.ftR[1] - 0.02 * h], [j.ftR[0] - 0.03 * h, j.ftR[1] + 0.02 * h], [j.ftR[0] + 0.05 * h, j.ftR[1] + 0.02 * h]], '#0d0a14', 2);
    local(g, j.hip, j.lean, j.fl, () => {
      const t = j.torso;
      shape(g, [[-0.11 * h, -t + 0.02 * h], [0.11 * h, -t + 0.02 * h], [0.12 * h, 0.03 * h], [0.15 * h, 0.12 * h], [0.04 * h, 0.04 * h], [-0.04 * h, 0.04 * h], [-0.15 * h, 0.12 * h], [-0.12 * h, 0.03 * h]], suit);
      shape(g, [[-0.05 * h, -t + 0.03 * h], [0.05 * h, -t + 0.03 * h], [0.0, -0.06 * h]], bone, 2);
      g.strokeStyle = INK; g.lineWidth = 1.6; for (let k = 0; k < 4; k++) { const y = -t + 0.07 * h + k * 0.035 * h, w = 0.035 * h - k * 0.007 * h; g.beginPath(); g.moveTo(-w, y); g.quadraticCurveTo(0, y + 0.012 * h, w, y); g.stroke(); }
      shape(g, [[-0.05 * h, -t + 0.03 * h], [-0.01 * h, -t + 0.012 * h], [0.0, -t + 0.03 * h], [0.01 * h, -t + 0.012 * h], [0.05 * h, -t + 0.03 * h], [0.01 * h, -t + 0.045 * h], [-0.01 * h, -t + 0.045 * h]], '#8a3cc2', 2);
      shape(g, [[-0.11 * h, -t + 0.02 * h], [-0.05 * h, -t + 0.03 * h], [-0.02 * h, -t + 0.16 * h], [-0.11 * h, -t + 0.1 * h]], '#5e2b8a', 2);
      shape(g, [[0.11 * h, -t + 0.02 * h], [0.05 * h, -t + 0.03 * h], [0.02 * h, -t + 0.16 * h], [0.11 * h, -t + 0.1 * h]], '#5e2b8a', 2);
    });
    limb(g, j.shL, j.elL, 0.05 * h, suit); limb(g, j.elL, j.wrL, 0.045 * h, suit);
    limb(g, j.shR, j.elR, 0.05 * h, suit); limb(g, j.elR, j.wrR, 0.045 * h, suit);
    for (const w of [j.wrL, j.wrR]) { circ(g, w[0], w[1], 0.024 * h, bone, 2); g.strokeStyle = bone; g.lineWidth = 2.5; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(w[0], w[1]); g.lineTo(w[0] + k * 0.02 * h + J(2), w[1] + 0.04 * h); g.stroke(); } }
    local(g, j.head, j.headA, j.fl, () => {
      const r = 0.11 * h;
      g.beginPath(); g.ellipse(0, 0, r, r * 1.05, 0, 0, 6.28); g.fillStyle = bone; g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
      shape(g, [[-r * 0.55, r * 0.6], [r * 0.55, r * 0.6], [r * 0.45, r * 1.05], [-r * 0.45, r * 1.05]], bone, 2.5);
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * r * 0.38, -r * 0.05, r * 0.25, r * 0.3, sx * 0.2, 0, 6.28); g.fillStyle = INK; g.fill();
        g.beginPath(); g.arc(sx * r * 0.38, -r * 0.02, r * 0.07, 0, 6.28); g.fillStyle = `rgba(255,140,40,${0.4 + glow * 0.6})`; g.fill(); }
      shape(g, [[0, r * 0.18], [-r * 0.1, r * 0.4], [r * 0.1, r * 0.4]], INK, 1);
      g.strokeStyle = INK; g.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * r * 0.17, r * 0.62); g.lineTo(k * r * 0.17, r * 0.95); g.stroke(); }
      g.beginPath(); g.moveTo(-r * 0.48, r * 0.78); g.lineTo(r * 0.48, r * 0.78); g.stroke();
      // Zylinder
      shape(g, [[-r * 1.15, -r * 0.82], [r * 1.15, -r * 0.82], [r * 1.05, -r * 0.68], [-r * 1.05, -r * 0.68]], '#0d0a14', 2.5);
      shape(g, [[-r * 0.72, -r * 0.82], [r * 0.72, -r * 0.82], [r * 0.66, -r * 2.05], [-r * 0.66, -r * 2.05]], '#0d0a14', 2.5);
      shape(g, [[-r * 0.71, -r * 1.0], [r * 0.71, -r * 1.0], [r * 0.69, -r * 1.2], [-r * 0.69, -r * 1.2]], '#8a3cc2', 2);
      g.strokeStyle = '#ff8a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(r * 0.5, -r * 1.1); g.quadraticCurveTo(r * 1.1, -r * 1.7 + J(4), r * 0.9, -r * 2.4); g.stroke();
    });
  }
  function drawMaske(g, j) {
    const h = j.h, skin = '#5a321e', wood = '#a3622f', straw = '#e8b94a';
    const dots = (a, b) => { g.fillStyle = '#f2e6cf'; for (let k = 1; k < 4; k++) { const t = k / 4; g.beginPath(); g.arc(a[0] + (b[0] - a[0]) * t + J(2), a[1] + (b[1] - a[1]) * t + J(2), 2.2, 0, 6.28); g.fill(); } };
    limb(g, j.hipL, j.knL, 0.06 * h, skin); limb(g, j.knL, j.ftL, 0.055 * h, skin); dots(j.knL, j.ftL);
    limb(g, j.hipR, j.knR, 0.06 * h, skin); limb(g, j.knR, j.ftR, 0.055 * h, skin); dots(j.knR, j.ftR);
    for (const f of [j.ftL, j.ftR]) { g.strokeStyle = '#d9a62e'; g.lineWidth = 3; g.beginPath(); g.ellipse(f[0], f[1] - 0.04 * h, 0.03 * h, 0.01 * h, 0, 0, 6.28); g.stroke(); }
    local(g, j.hip, j.lean, j.fl, () => {
      const t = j.torso;
      shape(g, [[-0.09 * h, -t + 0.02 * h], [0.09 * h, -t + 0.02 * h], [0.1 * h, 0.0], [-0.1 * h, 0.0]], skin);
      g.strokeStyle = '#f2e6cf'; g.lineWidth = 2; g.beginPath();
      for (let k = 0; k <= 6; k++) { const x = -0.07 * h + k * 0.14 * h / 6, y = -t * 0.55 + (k % 2 ? -0.025 * h : 0.025 * h); g[k ? 'lineTo' : 'moveTo'](x, y); } g.stroke();
      // Bastrock
      g.lineCap = 'round';
      for (let k = 0; k < 15; k++) { const x0 = -0.11 * h + k * 0.22 * h / 14, x1 = x0 * 1.45 + J(5), y1 = 0.17 * h + J(6);
        g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, y1); g.stroke();
        g.strokeStyle = k % 3 ? straw : '#c98e2a'; g.lineWidth = 3.5; g.stroke(); }
    });
    limb(g, j.shL, j.elL, 0.05 * h, skin); limb(g, j.elL, j.wrL, 0.045 * h, skin);
    limb(g, j.shR, j.elR, 0.05 * h, skin); limb(g, j.elR, j.wrR, 0.045 * h, skin);
    for (const [e, w] of [[j.elL, j.wrL], [j.elR, j.wrR]]) { const m = [e[0] * 0.25 + w[0] * 0.75, e[1] * 0.25 + w[1] * 0.75]; circ(g, m[0], m[1], 0.026 * h, '#d9a62e', 2); circ(g, w[0], w[1], 0.025 * h, skin, 2); }
    local(g, j.head, j.headA, j.fl, () => {
      const r = 0.1 * h;
      g.lineCap = 'round';
      for (let k = -4; k <= 4; k++) { const a = k * 0.2 - PI / 2; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 1.4); g.lineTo(Math.cos(a) * r * 2.1 + J(4), Math.sin(a) * r * 2.4 + J(4)); g.stroke(); g.strokeStyle = straw; g.lineWidth = 4; g.stroke(); }
      g.beginPath(); g.ellipse(0, 0.1 * r, r, r * 1.6, 0, 0, 6.28); g.fillStyle = wood; g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
      g.strokeStyle = '#6b3818'; g.lineWidth = 2.5;
      for (let k = 0; k < 3; k++) { const y = -r * 1.05 + k * r * 0.2; g.beginPath(); g.moveTo(-r * 0.5, y + r * 0.12); g.lineTo(0, y); g.lineTo(r * 0.5, y + r * 0.12); g.stroke(); }
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * r * 0.4, -r * 0.05, r * 0.28, r * 0.09, sx * -0.25, 0, 6.28); g.fillStyle = INK; g.fill(); }
      shape(g, [[-r * 0.08, r * 0.0], [r * 0.08, r * 0.0], [r * 0.12, r * 0.55], [-r * 0.12, r * 0.55]], '#8c4e22', 2);
      g.fillStyle = INK; g.fillRect(-r * 0.3, r * 0.85, r * 0.6, r * 0.22);
      g.fillStyle = '#f2e6cf'; for (let a = 0; a < 6.28; a += 0.42) { g.beginPath(); g.arc(Math.cos(a) * r * 0.86, 0.1 * r + Math.sin(a) * r * 1.42, 2.3, 0, 6.28); g.fill(); }
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * r * 0.62, r * 0.55, r * 0.11, r * 0.17, 0, 0, 6.28); g.fillStyle = '#fff7e6'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke(); g.beginPath(); g.moveTo(sx * r * 0.62, r * 0.42); g.lineTo(sx * r * 0.62, r * 0.68); g.stroke(); }
    });
  }

  // ---------------- Schleife ----------------
  let tick = -1, jumpAt = -9999, poses = [], jointsCache = [], lastPinch = { L: false, R: false }, clapArmed = true, lastClap = 0;
  const particles = [];
  const COLORS = ['#ffcf5a', '#ff7a3d', '#ff4f9a', '#7af0ff', '#b7ff5a', '#f2e6cf'];
  function burst(n) { for (let i = 0; i < n; i++) particles.push({ x: S.W * (0.2 + Math.random() * 0.6), y: S.H * 0.35, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, r: Math.random() * 6, vr: (Math.random() - 0.5), c: COLORS[i % COLORS.length], s: 5 + Math.random() * 7, life: 40 + Math.random() * 30 }); }

  function puppetPose(p, hd) {
    const leftF = hd.side === 'R' ? 1 : 4, rightF = hd.side === 'R' ? 4 : 1;
    const aL = lerp(0.15, 2.9, clamp((1 - hd.curl[leftF]) * 1.2)), aR = lerp(0.15, 2.9, clamp((1 - hd.curl[rightF]) * 1.2));
    const knees = clamp((hd.curl[2] + hd.curl[3]) / 2);
    p.aL1 = lerp(p.aL1, aL, 0.75); p.aR1 = lerp(p.aR1, aR, 0.75); p.aL2 = lerp(p.aL2, 0.25, 0.7); p.aR2 = lerp(p.aR2, 0.25, 0.7);
    p.lL1 = lerp(p.lL1, 0.12 + knees * 0.7, 0.7); p.lR1 = lerp(p.lR1, 0.12 + knees * 0.7, 0.7); p.lL2 = lerp(p.lL2, knees * 1.4, 0.7); p.lR2 = lerp(p.lR2, knees * 1.4, 0.7);
    p.head = lerp(p.head, hd.ang * 0.9, 0.8); p.lean = lerp(p.lean, hd.ang * 0.3, 0.6);
    p.jump = Math.max(p.jump, clamp(-hd.vel[1] / (S.H * 2.2)) * 0.28 + clamp((S.H * 0.42 - hd.palm[1]) / S.H) * 0.15);
  }
  function updateChars(now, hands) {
    const tk = Math.floor(now / (1000 / 12));
    if (tk === tick) return false;
    tick = tk; rngState = tk * 977;
    const b = Math.max(0, S.beatPos() / 4), bar = Math.floor(b / 4);
    const e = energyNow === 0 ? 0 : clamp(energyNow / 5 * (0.55 + P.dance * 0.7), 0.25, 1.15);
    const puppets = [hands.R, hands.L, null];
    CHARS.forEach((c, ci) => {
      const p = basePose();
      const mv = energyNow === 0 && pending === null ? 'sway' : ORDER[((Math.floor(bar / 2) + ci * 3) % ORDER.length + ORDER.length) % ORDER.length];
      MOVES[mv](b + ci * 0.02, e, p);
      const hd = puppets[ci];
      if (hd) { puppetPose(p, hd); c.px = lerp(c.px, clamp(hd.palm[0], S.W * 0.12, S.W * 0.88), 0.45); }
      else c.px = lerp(c.px, c.base * S.W, 0.2);
      const since = now - jumpAt; if (since > 0 && since < 600) p.jump += Math.sin(since / 600 * PI) * 0.3;
      c.move = hd ? 'marionette' : mv;
      poses[ci] = p;
      jointsCache[ci] = joints(c, p);
    });
    // Konfetti im Stop-Motion-Takt
    for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i]; q.x += q.vx; q.y += q.vy; q.vy += 3.2; q.vx *= 0.92; q.r += q.vr; if (--q.life <= 0 || q.y > S.H) particles.splice(i, 1); }
    // Figuren auf die Papierebene zeichnen
    const g = lctx; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, layer.width, layer.height); g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    const order = [1, 2, 0];
    for (const ci of order) {
      const j = jointsCache[ci];
      // Schatten am Boden
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(j.hip[0], groundY + 2 - (CHARS[ci].back || 0), j.h * 0.16 * (1 - poses[ci].jump * 0.8), j.h * 0.025, 0, 0, 6.28); g.fill();
      if (ci === 0) drawPuppe(g, j); else if (ci === 1) drawBaron(g, j, S.kickV); else drawMaske(g, j);
    }
    for (const q of particles) { g.save(); g.translate(q.x, q.y); g.rotate(q.r); g.fillStyle = q.c; g.fillRect(-q.s / 2, -q.s / 3, q.s, q.s * 0.66); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-q.s / 2, -q.s / 3, q.s, q.s * 0.66); g.restore(); }
    return true;
  }

  function lights(ctx, now) {
    const W = S.W, pos = S.beatPos();
    for (const [y0, sag, off] of [[S.H * 0.17, 40, 0], [S.H * 0.25, 30, 0.5]]) {
      ctx.strokeStyle = 'rgba(20,10,20,.9)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 10) { const u = (x - W / 2) / (W / 2); const y = y0 + sag * (1 - u * u); x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      let k = 0;
      for (let x = 14 + off * 20; x < W; x += 34, k++) {
        const u = (x - W / 2) / (W / 2), y = y0 + sag * (1 - u * u) + 6;
        const chase = (Math.floor(pos / 2) + k) % 4 === 0 ? 1 : 0;
        const br = 0.45 + 0.55 * Math.max(chase, k % 2 ? S.kickV : S.kickV * 0.5);
        const col = COLORS[k % 5];
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 16); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = br * 0.55; ctx.fillStyle = gr; ctx.fillRect(x - 16, y - 16, 32, 32); ctx.globalAlpha = 1;
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, 3.5, 5, 0, 0, 6.28); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      }
    }
  }

  M.frame = (now, dt) => {
    const ctx = S.ctx, W = S.W, H = S.H;
    if (!stage || stage.width !== Math.round(W * S.dpr)) buildStage();
    const hands = S.currentHands();
    // Steuerung
    if (S.usingCamera()) {
      const R = hands.R, L = hands.L;
      if (R) { T.cut = clamp(1 - (R.palm[1] / H - 0.12) / 0.66); T.prog = R.fingers; T.echo = clamp((Math.abs(R.ang) - 0.15) / 0.8) * 0.6;
        if (R.pinched && !lastPinch.R) vocalQ.push(true); lastPinch.R = R.pinched; } else lastPinch.R = false;
      if (L) { T.space = clamp(1 - (L.palm[1] / H - 0.12) / 0.66); T.energy = L.fingers;
        if (L.pinched && !lastPinch.L) vocalQ.push(false); lastPinch.L = L.pinched; } else lastPinch.L = false;
      if (L && R) { const d = S.dist2(L.palm, R.palm); T.dance = clamp(d / Math.min(W, H) - 0.1);
        if (d / ((L.size + R.size) / 2) < 1.6 && clapArmed && now - lastClap > 1100) { heyQ = 1; jumpAt = now; burst(24); lastClap = now; clapArmed = false; }
        if (d / ((L.size + R.size) / 2) > 2.8) clapArmed = true; }
      if (!R) T.cut = lerp(T.cut, DEF.cut, 0.02);
    } else {
      T.prog = o('prog', 1); T.energy = o('energy', 5);
      if (hands.R) { T.cut = clamp(1 - hands.R.palm[1] / H); T.echo = clamp(hands.R.palm[0] / W) * 0.5; }
      if (hands.L) { T.space = clamp(1 - hands.L.palm[1] / H); T.dance = 1; }
      for (const p of S.pointers.values()) if (p.fresh) { p.fresh = false; if (S.pointers.size >= 3) { heyQ = 1; jumpAt = now; burst(16); } }
    }
    for (const k of ['cut', 'space', 'echo', 'dance']) P[k] = lerp(P[k], T[k], 0.2);
    if (T.prog !== P.prog) P.prog = T.prog;
    if (T.energy !== P.energy) { P.energy = T.energy; requestEnergy(Math.round(P.energy)); }
    if (built) {
      const t = S.AC.currentTime;
      N.lp.frequency.setTargetAtTime(300 * Math.pow(2, P.cut * 5.8), t, 0.04);
      N.rev.gain.setTargetAtTime(0.12 + P.space * 0.7, t, 0.08); N.echo.gain.setTargetAtTime(P.echo, t, 0.08);
    }
    // Bühne
    ctx.drawImage(stage, 0, 0, W, H);
    lights(ctx, now);
    // Spotlichter auf die Figuren
    for (const c of CHARS) {
      const gr = ctx.createRadialGradient(c.px, groundY, 4, c.px, groundY, charH * 0.5);
      gr.addColorStop(0, `rgba(255,200,120,${0.25 + S.kickV * 0.2})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = gr; ctx.fillRect(c.px - charH * 0.5, groundY - charH * 0.5, charH, charH * 0.6);
      ctx.strokeStyle = `rgba(255,190,110,${0.15 + S.kickV * 0.4})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(c.px, groundY + 3, charH * (0.2 + S.kickV * 0.12), charH * (0.03 + S.kickV * 0.015), 0, 0, 6.28); ctx.stroke();
    }
    updateChars(now, hands);
    ctx.drawImage(layer, 0, 0, W, H);
    // Kerzen am Bühnenrand
    for (let k = 0; k < 5; k++) {
      const x = W * (0.08 + k * 0.21), y = groundY + 14, fl = 0.7 + 0.3 * Math.sin(tick * 2.3 + k * 1.7);
      ctx.fillStyle = '#f2e6cf'; ctx.fillRect(x - 4, y - 16, 8, 16); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(x - 4, y - 16, 8, 16);
      const gr = ctx.createRadialGradient(x, y - 22, 0, x, y - 22, 22 * fl); gr.addColorStop(0, 'rgba(255,200,90,.85)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 24, y - 46, 48, 48);
      ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.ellipse(x, y - 21, 3 * fl, 6 * fl, 0, 0, 6.28); ctx.fill();
    }
    // Marionettenfäden + Kreuz an deinen Händen
    const roles = [['head'], ['wrL'], ['knL'], ['knR'], ['wrR']];
    const puppets = [[hands.R, 0], [hands.L, 1]];
    for (const [hd, ci] of puppets) {
      if (!hd || !jointsCache[ci]) continue;
      const j = jointsCache[ci];
      const map = hd.side === 'R' ? ['head', 'wrL', 'knL', 'knR', 'wrR'] : ['head', 'wrR', 'knR', 'knL', 'wrL'];
      ctx.strokeStyle = 'rgba(255,240,215,.75)'; ctx.lineWidth = 1.1;
      hd.tips.forEach((tp, f) => {
        let tg = j[map[f]]; if (map[f] === 'head') tg = [j.head[0], j.head[1] - j.h * 0.13];
        ctx.beginPath(); ctx.moveTo(tp[0], tp[1]); ctx.quadraticCurveTo((tp[0] + tg[0]) / 2, (tp[1] + tg[1]) / 2 + 14, tg[0], tg[1]); ctx.stroke();
        ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.arc(tp[0], tp[1], 4, 0, 6.28); ctx.fill();
      });
      ctx.save(); ctx.translate(hd.palm[0], hd.palm[1]); ctx.rotate(hd.ang);
      ctx.fillStyle = '#8a5a32'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.fillRect(-hd.size * 0.6, -5, hd.size * 1.2, 10); ctx.strokeRect(-hd.size * 0.6, -5, hd.size * 1.2, 10);
      ctx.fillRect(-5, -hd.size * 0.45, 10, hd.size * 0.9); ctx.strokeRect(-5, -hd.size * 0.45, 10, hd.size * 0.9);
      ctx.restore();
      if (!hd.touch && S.settings.skel !== 'aus') S.drawSkeleton(ctx, hd, { line: 'rgba(255,207,90,.35)', dot: 'rgba(255,207,90,.7)', lw: 1, tip: 2.5, joint: 1.6 });
    }
    // Kamerafenster
    if (o('kamera', 'fenster') === 'fenster' && S.camLive()) {
      const pw = Math.min(W * 0.26, 150), ph = pw * H / W, px = W - pw - 10, py = 112;
      ctx.save(); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 14); else ctx.rect(px, py, pw, ph); ctx.clip();
      S.drawCamera(ctx, 1, { x: px, y: py, w: pw, h: ph });
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(255,190,140,1)'; ctx.fillRect(px, py, pw, ph); ctx.globalCompositeOperation = 'source-over';
      for (const hd of [hands.L, hands.R]) if (hd && !hd.touch) {
        ctx.strokeStyle = 'rgba(255,207,90,.9)'; ctx.lineWidth = 1; ctx.beginPath();
        for (const [a, b2] of S.BONES) { ctx.moveTo(px + hd.pts[a][0] / W * pw, py + hd.pts[a][1] / H * ph); ctx.lineTo(px + hd.pts[b2][0] / W * pw, py + hd.pts[b2][1] / H * ph); }
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 14); else ctx.rect(px, py, pw, ph); ctx.stroke();
    }
    const pr = PROGS[Math.round(P.prog)];
    S.setSection(pending !== null ? 'BUILD' : energyNow === 0 ? 'BREAK' : energyNow >= 4 ? 'DROP' : 'GROOVE',
      (pr ? CNAME[curChord] : 'PIANO AUS') + ' · ' + M.bpm() + ' BPM · ' + (CHARS[0].move || '').toUpperCase());
  };

  M.enter = () => { if (!built) build(); N.out.gain.setTargetAtTime(1, S.AC.currentTime, 0.05); energyNow = S.usingCamera() ? 5 : o('energy', 5); pending = null; P.energy = T.energy = energyNow; };
  M.exit = () => { if (built) N.out.gain.setTargetAtTime(0, S.AC.currentTime, 0.06); };
  M.resize = () => { stage = null; };
  M.matrix = [
    ['R FILTER', () => P.cut, () => { const f = 300 * Math.pow(2, P.cut * 5.8); return f >= 1000 ? (f / 1000).toFixed(1) + 'k' : Math.round(f) + ''; }],
    ['R AKKORDE', () => P.prog / 5, () => PROGS[Math.round(P.prog)] ? CNAME[curChord] : 'AUS'],
    ['R ECHO', () => P.echo / 0.6, () => Math.round(P.echo / 0.6 * 100) + '%', 'opt'],
    ['L ENERGIE', () => energyNow / 5, () => pending !== null ? 'BUILD' : energyNow + '/5'],
    ['L RAUM', () => P.space, () => Math.round(P.space * 100) + '%'],
    ['↔ TANZ', () => P.dance, () => Math.round(P.dance * 100) + '%'],
  ];
  M.gestures = [
    ['Hände = Marionettenkreuz', 'Rechts führt Puppe Lumpi, links Baron Knochen'], ['Finger strecken / beugen', 'Arme der Puppe hoch / runter'],
    ['Mittel- + Ringfinger beugen', 'Puppe geht in die Hocke'], ['Hand schnell hoch', 'Sprung'], ['R Höhe', 'Filter auf Piano und Fläche'],
    ['R Finger 1–5', 'Akkordfolge (Faust = Piano aus)'], ['L Finger 0–5', 'Energie: Break, Shaker, Log-Drum, Kick, Percussion, alles'],
    ['L Faust → offen', 'Riser und Drop mit „Hey!“'], ['Daumen an Zeigefinger', 'Vocal-Chop'], ['Klatschen', '„Hey!“, alle springen, Konfetti'], ['Hände auseinander', 'wilder tanzen'],
  ];
  M.settings = [
    { key: 'tempo', label: 'Tempo', def: 113, options: [[108, '108'], [113, '113'], [118, '118']] },
    { key: 'swing', label: 'Swing', def: 16, options: [[0, 'Gerade'], [10, 'Leicht'], [16, 'Amapiano'], [24, 'Stark']] },
    { key: 'kamera', label: 'Kamerafenster', def: 'fenster', options: [['fenster', 'An'], ['aus', 'Aus']] },
    { key: 'prog', label: 'Ohne Kamera: Akkordfolge', def: 1, options: [[0, 'Aus'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']] },
    { key: 'energy', label: 'Ohne Kamera: Energie', def: 5, options: [0, 1, 2, 3, 4, 5].map(n => [n, n === 0 ? 'Break' : String(n)]) },
  ];
  window.__ama = { P, T, CHARS, get energy() { return energyNow; }, get pending() { return pending; }, get joints() { return jointsCache; } };
  S.register(M);
})();
