/* Handstudio – gemeinsamer Kern: Kamera, Handerkennung, Audio, Takt, Menü, Aufnahme */
(() => {
  'use strict';
  const S = window.S = {};
  const $ = S.$ = id => document.getElementById(id);
  const clamp = S.clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = S.lerp = (a, b, t) => a + (b - a) * t;
  S.mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B', 'H'];
  S.noteName = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

  // =====================================================================
  //  Einstellungen
  // =====================================================================
  S.settings = { mode: 'techno', input: 'kamera', vol: 0.85, quality: 'auto', skel: 'an', per: {} };
  try { Object.assign(S.settings, JSON.parse(localStorage.getItem('handstudio') || '{}')); } catch (e) {}
  if (!S.settings.per || typeof S.settings.per !== 'object') S.settings.per = {};
  S.save = () => { try { localStorage.setItem('handstudio', JSON.stringify(S.settings)); } catch (e) {} };
  S.opt = (mode, key, def) => { const p = S.settings.per[mode] || (S.settings.per[mode] = {}); return key in p ? p[key] : def; };
  S.setOpt = (mode, key, v) => { (S.settings.per[mode] || (S.settings.per[mode] = {}))[key] = v; S.save(); };

  S.toast = (t, ms = 2600) => {
    const el = $('toast'); el.textContent = t; el.hidden = false;
    clearTimeout(S.toast.h); S.toast.h = setTimeout(() => { el.hidden = true; }, ms);
  };

  // =====================================================================
  //  Leinwand + WebGL
  // =====================================================================
  S.out = $('out'); S.ctx = S.out.getContext('2d');
  S.glc = document.createElement('canvas');
  S.gl = S.glc.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: false, depth: true, preserveDrawingBuffer: false });
  S.W = innerWidth; S.H = innerHeight; S.dpr = 1; S.renderScale = 1; S.frameNo = 0;

  S.resize = () => {
    S.W = innerWidth; S.H = innerHeight;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const q = S.settings.quality === 'hoch' ? 1 : S.settings.quality === 'mittel' ? 0.8 : S.settings.quality === 'niedrig' ? 0.6 : S.renderScale;
    S.dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.75) * q;
    S.out.width = Math.round(S.W * S.dpr); S.out.height = Math.round(S.H * S.dpr);
    S.glc.width = S.out.width; S.glc.height = S.out.height;
    S.view = { x: 0, y: 0, w: S.W, h: S.H };
    if (S.mode && S.mode.resize) S.mode.resize();
  };

  S.QUAD_VS = `#version 300 es
layout(location = 0) in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  S.glProg = (vs, fs) => {
    const gl = S.gl;
    const mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  };
  S.glTex = (w, h) => {
    const gl = S.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  let quadVao = null;
  S.glQuad = () => {
    const gl = S.gl;
    if (!quadVao) {
      quadVao = gl.createVertexArray(); gl.bindVertexArray(quadVao);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(quadVao); return quadVao;
  };
  // Kamerabild als Textur (einmal pro Bild hochgeladen)
  let camTex = null, camTexFrame = -1;
  S.camTexture = unit => {
    const gl = S.gl;
    if (!camTex) camTex = S.glTex(2, 2);
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, camTex);
    if (S.camLive() && camTexFrame !== S.frameNo) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, S.video); camTexFrame = S.frameNo; }
    return camTex;
  };
  // WebGL-Bild auf die sichtbare Leinwand bringen
  S.blitGL = () => { const c = S.ctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(S.glc, 0, 0); c.restore(); };

  // =====================================================================
  //  Kamera
  // =====================================================================
  S.video = $('cam'); S.camOn = false; S.srcW = 1280; S.srcH = 720;
  S.view = { x: 0, y: 0, w: innerWidth, h: innerHeight };   // wo das Kamerabild gezeigt wird
  S.camLive = () => S.camOn && S.video.readyState >= 2;
  S.coverFor = (w, h) => { const va = S.srcW / S.srcH, sa = w / h; return [Math.min(1, sa / va), Math.min(1, va / sa)]; };
  S.cover = () => S.coverFor(S.W, S.H);
  S.camToScreen = (x, y) => {
    const v = S.view, [sx, sy] = S.coverFor(v.w, v.h);
    return [v.x + (0.5 + ((1 - x) - 0.5) / sx) * v.w, v.y + (0.5 + (y - 0.5) / sy) * v.h];
  };
  S.drawCamera = (ctx, alpha = 1, r = S.view) => {
    if (!S.camLive()) return false;
    const va = S.srcW / S.srcH, ra = r.w / r.h; let sw = S.srcW, sh = S.srcH, sx = 0, sy = 0;
    if (va > ra) { sw = S.srcH * ra; sx = (S.srcW - sw) / 2; } else { sh = S.srcW / ra; sy = (S.srcH - sh) / 2; }
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(r.x + r.w, r.y); ctx.scale(-1, 1);
    ctx.drawImage(S.video, sx, sy, sw, sh, 0, 0, r.w, r.h); ctx.restore();
    return true;
  };

  S.startCamera = async () => {
    S.toast('Kamera startet …', 2000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
      S.video.srcObject = stream; await S.video.play();
      S.srcW = S.video.videoWidth || 1280; S.srcH = S.video.videoHeight || 720;
      S.camOn = true; S.settings.input = 'kamera'; syncGlobal(); wakeAudio();
    } catch (e) {
      S.toast('Kein Kamerazugriff. Du spielst jetzt mit Touch.', 4000);
      S.settings.input = 'touch'; syncGlobal(); return;
    }
    initTracker();
  };
  S.stopCamera = () => {
    const s = S.video.srcObject; if (s) s.getTracks().forEach(t => t.stop());
    S.video.srcObject = null; S.camOn = false; slots.length = 0; S.hands.L = S.hands.R = null;
  };

  // =====================================================================
  //  Handerkennung (genauer): jedes Kamerabild, Verfolgung über Bilder,
  //  bestätigte Händigkeit, One-Euro-Glättung, Gelenkwinkel in 3D
  // =====================================================================
  class OneEuro {
    constructor(minCut, beta, dCut = 1.0) { this.minCut = minCut; this.beta = beta; this.dCut = dCut; this.x = null; this.dx = 0; this.t = 0; }
    a(cut, dt) { const r = 2 * Math.PI * cut * dt; return r / (r + 1); }
    f(x, t) {
      if (this.x === null) { this.x = x; this.t = t; return x; }
      const dt = Math.max(1e-3, t - this.t); this.t = t;
      const dx = (x - this.x) / dt; this.dx += this.a(this.dCut, dt) * (dx - this.dx);
      this.x += this.a(this.minCut + this.beta * Math.abs(this.dx), dt) * (x - this.x); return this.x;
    }
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0)];
  const len3 = v => Math.hypot(v[0], v[1], v[2]);
  const dist3 = (a, b) => len3(sub(a, b));
  const angle3 = (a, b, c) => { const u = sub(a, b), v = sub(c, b); return Math.acos(clamp((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (len3(u) * len3(v) + 1e-9), -1, 1)) * 57.2958; };
  S.dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  S.hands = { L: null, R: null };
  S.track = { ready: false, hz: 0, cost: 0, count: 0 };
  const slots = [];
  let landmarker = null, lastDetect = 0, detectCost = 16, hzCount = 0, hzT = 0;
  const FINGERS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];

  async function initTracker() {
    if (landmarker) return;
    S.toast('Lade Handerkennung …', 8000);
    try {
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
      const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      const opts = delegate => ({
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate },
        runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      try { landmarker = await vision.HandLandmarker.createFromOptions(files, opts('GPU')); }
      catch (e) { landmarker = await vision.HandLandmarker.createFromOptions(files, opts('CPU')); }
      S.track.ready = true;
      S.toast('Bereit. Zeig deine Hände.', 2500); wakeAudio();
      loopDetect();
    } catch (e) {
      S.toast('Handerkennung ließ sich nicht laden. Touch geht trotzdem.', 4500);
      S.settings.input = 'touch'; syncGlobal();
    }
  }
  // Auswertung direkt bei jedem neuen Kamerabild
  let lastVT = -1;
  function loopDetect() {
    const v = S.video;
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => { runDetect(); loopDetect(); });
    else requestAnimationFrame(() => { if (v.currentTime !== lastVT) { lastVT = v.currentTime; runDetect(); } loopDetect(); });
  }
  function runDetect() {
    if (!S.camOn || !landmarker || S.video.readyState < 2 || S.settings.input !== 'kamera') return;
    const now = performance.now();
    if (now - lastDetect < detectCost * 1.3 - 6) return;   // nur wenn das Gerät zu langsam ist, Bilder auslassen
    lastDetect = now;
    let res; const t0 = performance.now();
    try { res = landmarker.detectForVideo(S.video, now); } catch (e) { return; }
    detectCost = detectCost * 0.85 + (performance.now() - t0) * 0.15;
    S.track.cost = detectCost;
    hzCount++; if (now - hzT > 1000) { S.track.hz = hzCount * 1000 / (now - hzT); hzCount = 0; hzT = now; }
    processResult(res, now);
  }

  function processResult(res, now) {
    const hd = res.handednesses || res.handedness || [];
    const dets = (res.landmarks || []).map((lm, i) => {
      const raw = lm.map(p => S.camToScreen(p.x, p.y));
      const h = hd[i] && hd[i][0];
      // Bild ist ungespiegelt, MediaPipe nimmt gespiegelt an: „Left“ = deine rechte Hand
      const lab = h ? (h.categoryName === 'Left' ? 1 : -1) * h.score : 0;
      const palm = [0, 5, 9, 13, 17].reduce((s, k) => [s[0] + raw[k][0] / 5, s[1] + raw[k][1] / 5], [0, 0]);
      const world = res.worldLandmarks && res.worldLandmarks[i] ? res.worldLandmarks[i].map(p => [p.x, p.y, p.z]) : null;
      return { raw, lab, palm, world, used: false };
    });
    // Zuordnung zu bestehenden Händen über die Position
    const maxD = Math.max(S.W, S.H) * 0.35;
    for (const s of slots) s.matched = false;
    for (const d of dets) {
      let best = null, bd = maxD;
      for (const s of slots) { if (s.matched) continue; const dd = S.dist2(s.palm, d.palm); if (dd < bd) { bd = dd; best = s; } }
      if (!best) {
        if (slots.length >= 2) { slots.sort((a, b) => a.seen - b.seen); slots.shift(); }
        best = { id: Math.random(), vote: d.lab, f: Array.from({ length: 42 }, () => new OneEuro(1.8, 0.025)), ext: [false, false, false, false, false], pinched: false, side: null, palm: d.palm, prevPalm: null, prevT: now, vel: [0, 0], curl: [0, 0, 0, 0, 0], curlV: [0, 0, 0, 0, 0] };
        slots.push(best);
      }
      best.matched = true; d.slot = best;
      best.vote = best.vote * 0.85 + d.lab * 0.15;
      const ts = now / 1000;
      const pts = d.raw.map((p, k) => [best.f[k * 2].f(p[0], ts), best.f[k * 2 + 1].f(p[1], ts)]);
      analyse(best, pts, d.world, now);
      best.seen = now;
    }
    for (let i = slots.length - 1; i >= 0; i--) if (now - slots[i].seen > 240) slots.splice(i, 1);
    // Seiten festlegen: erst über die bestätigte Händigkeit, sonst über die Bildseite
    if (slots.length === 2) {
      const [a, b] = slots;
      if (Math.abs(a.vote) > 0.25 && Math.abs(b.vote) > 0.25 && Math.sign(a.vote) !== Math.sign(b.vote)) { a.side = a.vote > 0 ? 'R' : 'L'; b.side = b.vote > 0 ? 'R' : 'L'; }
      else { const l = a.palm[0] < b.palm[0] ? a : b; l.side = 'L'; (l === a ? b : a).side = 'R'; }
    } else if (slots.length === 1) {
      const a = slots[0];
      if (Math.abs(a.vote) > 0.35) a.side = a.vote > 0 ? 'R' : 'L';
      else if (!a.side) a.side = a.palm[0] < S.W / 2 ? 'L' : 'R';
    }
    S.hands.L = S.hands.R = null;
    for (const s of slots) if (s.hand) { s.hand.side = s.side; S.hands[s.side] = s.hand; }
    S.track.count = slots.length;
  }

  function analyse(s, pts, world, now) {
    const w = world || pts.map(p => [p[0], p[1], 0]);
    const palm = [0, 5, 9, 13, 17].reduce((a, k) => [a[0] + pts[k][0] / 5, a[1] + pts[k][1] / 5], [0, 0]);
    const size = S.dist2(pts[0], pts[9]) || 1;
    const wsize = dist3(w[0], w[9]) || 1;
    // Beugung je Finger aus den Gelenkwinkeln (0 = gestreckt, 1 = ganz gebeugt)
    const curl = [];
    { const a1 = angle3(w[1], w[2], w[3]), a2 = angle3(w[2], w[3], w[4]);
      const tipIn = clamp(1 - (dist3(w[4], w[9]) / wsize - 0.35) / 0.55);
      curl.push(clamp(((180 - a1) + (180 - a2)) / 110 * 0.6 + tipIn * 0.55)); }
    for (let f = 1; f < 5; f++) {
      const [m, p, d, t] = FINGERS[f];
      const a0 = angle3(w[0], w[m], w[p]), a1 = angle3(w[m], w[p], w[d]), a2 = angle3(w[p], w[d], w[t]);
      curl.push(clamp(((180 - a1) + (180 - a2) + 0.6 * (180 - a0)) / 230));
    }
    const dt = Math.max(0.001, (now - (s.prevT || now)) / 1000);
    for (let f = 0; f < 5; f++) {
      const v = (curl[f] - s.curl[f]) / dt;
      s.curlV[f] = s.curlV[f] * 0.5 + v * 0.5;
      s.curl[f] = curl[f];
      // Schwellen mit Abstand, damit nichts flackert
      const on = f === 0 ? 0.38 : 0.34, off = f === 0 ? 0.52 : 0.48;
      if (s.ext[f] && curl[f] > off) s.ext[f] = false; else if (!s.ext[f] && curl[f] < on) s.ext[f] = true;
    }
    const fingers = s.ext.filter(Boolean).length;
    const pd = dist3(w[4], w[8]) / wsize;
    if (!s.pinched && pd < 0.24) s.pinched = true; else if (s.pinched && pd > 0.36) s.pinched = false;
    if (s.prevPalm) { s.vel[0] = s.vel[0] * 0.5 + (palm[0] - s.prevPalm[0]) / dt * 0.5; s.vel[1] = s.vel[1] * 0.5 + (palm[1] - s.prevPalm[1]) / dt * 0.5; }
    s.prevPalm = palm; s.prevT = now; s.palm = palm;
    const dirs = FINGERS.map(([m, , , t]) => Math.atan2(pts[t][0] - pts[m][0], -(pts[t][1] - pts[m][1])));
    s.hand = {
      side: s.side, pts, palm, size, curl: s.curl.slice(), curlV: s.curlV.slice(), ext: s.ext.slice(), fingers,
      pinch: clamp((pd - 0.12) / 0.6), pinched: s.pinched,
      ang: Math.atan2(pts[9][0] - pts[0][0], -(pts[9][1] - pts[0][1])),
      vel: s.vel.slice(), tips: [4, 8, 12, 16, 20].map(k => pts[k]), dirs, seen: now,
    };
  }

  // Für Tests und Touch: Hand aus Bildpunkten berechnen
  S.handFromPoints = (side, pts, world) => {
    const s = { ext: [false, false, false, false, false], pinched: false, curl: [0, 0, 0, 0, 0], curlV: [0, 0, 0, 0, 0], vel: [0, 0], side };
    analyse(s, pts, world, performance.now()); s.hand.side = side; return s.hand;
  };

  // ---------- Touch ----------
  S.pointers = new Map();
  addEventListener('pointerdown', e => {
    if (S.playing && S.AC && S.AC.state !== 'running') unlockAudio();
    if (e.target.closest('button, .drawer, .intro, input, label, .tabs')) return;
    S.pointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), vx: 0, vy: 0, fresh: true });
  });
  addEventListener('pointermove', e => {
    const p = S.pointers.get(e.pointerId); if (!p) return;
    const now = performance.now(), dt = Math.max(0.001, (now - p.t) / 1000);
    p.vx = p.vx * 0.5 + (e.clientX - p.x) / dt * 0.5; p.vy = p.vy * 0.5 + (e.clientY - p.y) / dt * 0.5;
    p.x = e.clientX; p.y = e.clientY; p.t = now;
  });
  const pup = e => S.pointers.delete(e.pointerId);
  addEventListener('pointerup', pup); addEventListener('pointercancel', pup);
  S.touchHand = (p, side) => {
    const s = Math.min(S.W, S.H) * 0.08, pts = [];
    for (let i = 0; i < 21; i++) {
      if (i === 0) { pts.push([p.x, p.y + s]); continue; }
      const f = Math.floor((i - 1) / 4), k = (i - 1) % 4 + 1, a = (f - 2) * 0.34;
      pts.push([p.x + Math.sin(a) * s * (0.35 + k * 0.32), p.y + s - Math.cos(a) * s * (0.4 + k * 0.36)]);
    }
    return { side, pts, palm: [p.x, p.y], size: s, curl: [0, 0, 0, 0, 0], curlV: [0, 0, 0, 0, 0], ext: [true, true, true, true, true], fingers: 5,
      pinch: 0.6, pinched: false, ang: 0, vel: [p.vx || 0, p.vy || 0], tips: [4, 8, 12, 16, 20].map(k => pts[k]), dirs: [-0.7, -0.35, 0, 0.35, 0.7], seen: performance.now(), touch: true };
  };
  S.usingCamera = () => S.settings.input === 'kamera' && S.camOn;
  S.currentHands = () => {
    if (S.usingCamera()) return S.hands;
    const ps = [...S.pointers.values()].sort((a, b) => a.x - b.x);
    if (ps.length === 1) return { L: null, R: S.touchHand(ps[0], 'R') };
    if (ps.length >= 2) return { L: S.touchHand(ps[0], 'L'), R: S.touchHand(ps[ps.length - 1], 'R') };
    return { L: null, R: null };
  };

  // Handskelett zeichnen
  const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
  S.BONES = BONES;
  S.drawSkeleton = (ctx, h, o = {}) => {
    if (!h || h.touch || S.settings.skel === 'aus') return;
    ctx.save();
    ctx.lineWidth = o.lw || 1.4; ctx.strokeStyle = o.line || 'rgba(255,255,255,.55)'; ctx.lineCap = 'round';
    ctx.beginPath(); for (const [a, b] of BONES) { ctx.moveTo(h.pts[a][0], h.pts[a][1]); ctx.lineTo(h.pts[b][0], h.pts[b][1]); } ctx.stroke();
    ctx.fillStyle = o.dot || '#fff';
    for (let k = 0; k < 21; k++) { const r = [4, 8, 12, 16, 20].includes(k) ? (o.tip || 3.6) : (o.joint || 2.2); ctx.beginPath(); ctx.arc(h.pts[k][0], h.pts[k][1], r, 0, 6.2832); ctx.fill(); }
    ctx.restore();
  };
  // Beschriftung neben einer Hand
  S.pill = (ctx, x, y, lines, accent) => {
    ctx.save();
    ctx.font = '600 11px "JetBrains Mono", monospace';
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 20, h = lines.length * 15 + 12;
    x = clamp(x, 8, S.W - w - 8); y = clamp(y, 110, S.H - h - 160);
    ctx.fillStyle = 'rgba(20,14,28,.55)'; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 12); else ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    lines.forEach((l, i) => { ctx.fillStyle = i === 0 ? accent : 'rgba(255,255,255,.85)'; ctx.fillText(l, x + 10, y + 19 + i * 15); });
    ctx.restore();
  };

  // =====================================================================
  //  Audio: sauberer Master (sanfter Kompressor + Limiter), Hall, Echo, Takt
  // =====================================================================
  S.AC = null; const A = S.A = {};
  S.G = (v = 1) => { const g = S.AC.createGain(); g.gain.value = v; return g; };
  S.F = (type, f, q = 0.7) => { const x = S.AC.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
  S.pan = v => { if (!S.AC.createStereoPanner) return S.G(1); const p = S.AC.createStereoPanner(); p.pan.value = v; return p; };
  S.curve = k => { const n = 2048, c = new Float32Array(n), g = 1 + k * 10; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * g) / Math.tanh(g); } return c; };
  S.ir = (sec, decay, bright) => {
    const AC = S.AC, len = Math.floor(AC.sampleRate * sec), b = AC.createBuffer(2, len, AC.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp += (Math.random() * 2 - 1 - lp) * bright; d[i] = lp * Math.pow(1 - i / len, decay); } }
    return b;
  };

  function initAudio() {
    const AC = S.AC = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    A.bus = S.G(1);
    A.comp = AC.createDynamicsCompressor(); A.comp.threshold.value = -18; A.comp.knee.value = 10; A.comp.ratio.value = 2.4; A.comp.attack.value = 0.012; A.comp.release.value = 0.2;
    A.lim = AC.createDynamicsCompressor(); A.lim.threshold.value = -1.2; A.lim.knee.value = 0; A.lim.ratio.value = 20; A.lim.attack.value = 0.001; A.lim.release.value = 0.08;
    A.master = S.G(S.settings.vol * 0.75);
    A.bus.connect(A.comp); A.comp.connect(A.lim); A.lim.connect(A.master); A.master.connect(AC.destination);
    A.split = AC.createChannelSplitter(2);
    A.anL = AC.createAnalyser(); A.anR = AC.createAnalyser(); A.anL.fftSize = A.anR.fftSize = 2048;
    A.anF = AC.createAnalyser(); A.anF.fftSize = 2048; A.anF.smoothingTimeConstant = 0.6;
    A.master.connect(A.split); A.split.connect(A.anL, 0); A.split.connect(A.anR, 1); A.master.connect(A.anF);
    A.bufL = new Float32Array(2048); A.bufR = new Float32Array(2048); A.freq = new Uint8Array(1024);
    if (AC.createMediaStreamDestination) { A.rec = AC.createMediaStreamDestination(); A.master.connect(A.rec); }
    // Hall
    A.revIn = S.G(1); A.rev = AC.createConvolver(); A.rev.buffer = S.ir(3.0, 3.2, 0.42);
    A.revHP = S.F('highpass', 200); A.revOut = S.G(0.8);
    A.revIn.connect(A.rev); A.rev.connect(A.revHP); A.revHP.connect(A.revOut); A.revOut.connect(A.comp);
    // Ping-Pong-Echo
    A.dlyIn = S.G(1); A.dTone = S.F('bandpass', 2000, 0.5);
    A.dL = AC.createDelay(2); A.dR = AC.createDelay(2); A.dFb = S.G(0.38);
    A.dMerge = AC.createChannelMerger(2); A.dOut = S.G(0.6);
    A.dlyIn.connect(A.dTone); A.dTone.connect(A.dL); A.dL.connect(A.dR); A.dR.connect(A.dFb); A.dFb.connect(A.dL);
    A.dL.connect(A.dMerge, 0, 0); A.dR.connect(A.dMerge, 0, 1); A.dMerge.connect(A.dOut); A.dOut.connect(A.comp);
    // Rauschen
    const nb = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    A.noise = nb;
    AC.onstatechange = () => setTimeout(checkAudio, 300);
  }
  S.setDelay = sec => { if (!S.AC) return; const t = S.AC.currentTime; A.dL.delayTime.setTargetAtTime(sec, t, 0.05); A.dR.delayTime.setTargetAtTime(sec, t, 0.05); };

  // Rauschimpuls (Hats, Shaker, Klicks)
  S.noise = (t, o) => {
    const AC = S.AC, src = AC.createBufferSource(); src.buffer = A.noise; src.loop = true;
    const fl = S.F(o.type || 'highpass', o.f || 8000, o.q || 0.7), g = AC.createGain(), pn = S.pan(o.p || 0);
    const att = o.att || 0.001, dur = o.dur || 0.05;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(o.gain || 0.3, 0.0002), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(pn); pn.connect(o.dest || A.bus);
    if (o.rev) { const r = S.G(o.rev); g.connect(r); r.connect(A.revIn); }
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  };
  // Formant-Vocal („Ah / Oh / Eh“)
  const VOWELS = [[800, 1150, 2900], [450, 800, 2830], [400, 1600, 2700], [600, 1040, 2250], [350, 1700, 2700]];
  let vowelIdx = 0;
  S.vocal = (t, midi, dest, level = 0.5, len = 0.32) => {
    const AC = S.AC, v = VOWELS[vowelIdx++ % VOWELS.length];
    const src = AC.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(S.mtof(midi) * 0.985, t); src.frequency.setTargetAtTime(S.mtof(midi), t, 0.03);
    const vib = AC.createOscillator(); vib.frequency.value = 5.5; const va = S.G(6); vib.connect(va); va.connect(src.detune);
    const out = AC.createGain();
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(level, t + 0.02);
    out.gain.setTargetAtTime(level * 0.55, t + 0.06, 0.08); out.gain.setTargetAtTime(0.0001, t + len, 0.07);
    v.forEach((fr, i) => { const bp = S.F('bandpass', fr, 9 + i * 3), g = S.G([1, 0.55, 0.28][i]); src.connect(bp); bp.connect(g); g.connect(out); });
    const pn = S.pan((Math.random() - 0.5) * 0.6); out.connect(pn); pn.connect(dest || A.bus);
    const r = S.G(0.45); out.connect(r); r.connect(A.revIn); const d = S.G(0.3); out.connect(d); d.connect(A.dlyIn);
    src.start(t); vib.start(t); src.stop(t + len + 0.6); vib.stop(t + len + 0.6);
  };
  // Riser bis zum Drop
  S.riser = (t, dur, dest) => {
    const AC = S.AC, src = AC.createBufferSource(); src.buffer = A.noise; src.loop = true;
    const bp = S.F('bandpass', 300, 2.2); bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(8000, t + dur);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + dur * 0.95); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    src.connect(bp); bp.connect(g); g.connect(dest || A.bus); const r = S.G(0.3); g.connect(r); r.connect(A.revIn);
    src.start(t); src.stop(t + dur + 0.1);
  };
  S.impact = (t, dest) => {
    const AC = S.AC; t = t || AC.currentTime + 0.01;
    const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(32, t + 1.2);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(g); g.connect(dest || A.bus); o.start(t); o.stop(t + 1.4);
    S.noise(t, { type: 'lowpass', f: 9000, dur: 1.5, gain: 0.25, rev: 0.8, dest });
    S.flash = 1;
  };

  // ---------- Ton entsperren (iPhone: Lautlos-Schalter, Kamera unterbricht) ----------
  let keepAlive = null;
  function silentWav() {
    const sr = 8000, n = 1600, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function unlockAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    try { if (!keepAlive) { keepAlive = document.createElement('audio'); keepAlive.src = silentWav(); keepAlive.loop = true; keepAlive.setAttribute('playsinline', ''); } const p = keepAlive.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    if (S.AC && S.AC.state !== 'running') { const p = S.AC.resume(); if (p && p.catch) p.catch(() => {}); }
  }
  function checkAudio() { $('unmute').hidden = !(S.playing && S.AC && S.AC.state !== 'running'); }
  async function wakeAudio() { if (!S.AC) return; try { await S.AC.resume(); } catch (e) {} setTimeout(checkAudio, 400); }

  // ---------- Takt (Sequenzer), plant voraus und passt sich an hängende Browser an ----------
  S.playing = false;
  const seq = { next: 0, step: 0, bar: 0, timer: null, last: 0, gap: 30, hist: [] };
  S.kickTimes = [];
  function scheduler() {
    if (!S.playing || !S.mode) return;
    const now = performance.now();
    if (seq.last) seq.gap = Math.max(now - seq.last, seq.gap * 0.995);
    seq.last = now;
    const st = 60 / S.mode.bpm() / 4, AC = S.AC;
    if (seq.next < AC.currentTime + 0.01) while (seq.next < AC.currentTime + 0.03) { seq.next += st; if (++seq.step === 16) { seq.step = 0; seq.bar++; } }
    const ahead = clamp(seq.gap / 1000 * 1.6 + 0.1, 0.15, 1.0);
    while (seq.next < AC.currentTime + ahead) {
      const sw = seq.step % 2 ? st * (S.mode.swing ? S.mode.swing() : 0) : 0;
      seq.hist.push([seq.next, seq.bar * 16 + seq.step, st]); if (seq.hist.length > 64) seq.hist.shift();
      try { S.mode.step(seq.step, seq.next + sw, st, seq.bar); } catch (e) { console.error(e); }
      seq.next += st;
      if (++seq.step === 16) { seq.step = 0; seq.bar++; }
    }
  }
  S.seq = seq;
  // Taktposition in Sechzehnteln (für Bilder im Takt)
  S.beatPos = () => {
    if (!S.AC || !seq.hist.length) return performance.now() / 1000 * 8;
    const t = S.AC.currentTime; let e = null;
    for (let i = seq.hist.length - 1; i >= 0; i--) if (seq.hist[i][0] <= t) { e = seq.hist[i]; break; }
    if (!e) e = seq.hist[0];
    return e[1] + (t - e[0]) / e[2];
  };
  S.nextBarSteps = () => 16 - seq.step;

  S.startAudio = () => {
    unlockAudio();
    if (!S.AC) initAudio();
    if (S.AC.state !== 'running') { const p = S.AC.resume(); if (p && p.catch) p.catch(() => {}); }
    if (S.playing) return;
    S.playing = true; seq.next = S.AC.currentTime + 0.1; seq.step = 0; seq.bar = 0; seq.last = 0; seq.hist.length = 0;
    seq.timer = setInterval(scheduler, 25);
    if (S.mode && S.mode.onPlay) S.mode.onPlay(true);
    $('playBtn').textContent = 'STOP'; $('playBtn').classList.add('on');
  };
  S.stopAudio = () => {
    S.playing = false; clearInterval(seq.timer);
    if (S.mode && S.mode.onPlay) S.mode.onPlay(false);
    $('playBtn').textContent = 'PLAY'; $('playBtn').classList.remove('on');
  };

  // =====================================================================
  //  Welten (Modi)
  // =====================================================================
  S.modes = [];
  S.register = m => S.modes.push(m);
  S.mode = null;
  S.setAccent = rgb => {
    const s = document.documentElement.style;
    s.setProperty('--c', `rgb(${rgb})`); s.setProperty('--c-soft', `rgba(${rgb},.55)`);
    S.accent = rgb;
  };
  S.setMode = id => {
    const m = S.modes.find(x => x.id === id) || S.modes[0];
    if (S.mode === m) return;
    if (S.mode && S.mode.exit) S.mode.exit();
    S.mode = m; S.settings.mode = m.id; S.save();
    S.view = { x: 0, y: 0, w: S.W, h: S.H };
    S.setAccent(m.color);
    if (S.AC && m.enter) m.enter();
    seq.next = S.AC ? S.AC.currentTime + 0.12 : 0; seq.step = 0; seq.bar = 0; seq.hist.length = 0;
    S.setDelay(60 / m.bpm() / 4 * 3);
    buildMatrix(); buildModeSettings(); syncTabs();
    if (location.hash !== '#' + m.id) history.replaceState(null, '', '#' + m.id);
    if (m.hint && !$('top').hidden) S.toast(m.hint, 5000);
  };
  S.setSection = (big, small) => {
    if (S._secBig !== big) { $('secBig').textContent = big; S._secBig = big; }
    if (S._secSmall !== small) { $('secSmall').textContent = small; S._secSmall = small; }
  };

  // ---------- Matrix ----------
  let meters = [];
  function buildMatrix() {
    const box = $('matrix'); box.textContent = ''; meters = [];
    for (const [label, , , cls] of (S.mode.matrix || [])) {
      const row = document.createElement('div'); row.className = 'mrow' + (cls ? ' ' + cls : '');
      const b = document.createElement('b'); b.textContent = label;
      const m = document.createElement('div'); m.className = 'meter'; const bar = document.createElement('span'); m.append(bar);
      const v = document.createElement('em'); row.append(b, m, v); box.append(row); meters.push([bar, v]);
    }
    const map = $('modeMap'); map.textContent = '';
    for (const [k, v] of (S.mode.gestures || [])) { const tr = document.createElement('tr'); const a = document.createElement('td'); a.textContent = k; const b = document.createElement('td'); b.textContent = v; tr.append(a, b); map.append(tr); }
  }
  // ---------- Menü der Welt ----------
  function buildModeSettings() {
    const m = S.mode; $('modeTitle').textContent = m.name;
    const box = $('modeSettings'); box.textContent = '';
    for (const it of (m.settings || [])) {
      const g = document.createElement('div'); g.className = 'group';
      const sp = document.createElement('span'); sp.textContent = it.label; g.append(sp);
      if (it.type === 'file') {
        const p = document.createElement('p'); p.textContent = it.text || ''; g.append(p);
        const lab = document.createElement('label'); lab.className = 'file';
        const b = document.createElement('button'); b.type = 'button'; b.tabIndex = -1; b.textContent = it.button || 'DATEI LADEN';
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = it.accept || '*/*'; inp.setAttribute('aria-label', it.label);
        inp.addEventListener('change', e => { if (e.target.files[0]) it.onFile(e.target.files[0], p); e.target.value = ''; });
        lab.append(b, inp); g.append(lab);
      } else if (it.range) {
        const r = document.createElement('input'); r.type = 'range'; r.min = it.range[0]; r.max = it.range[1]; r.step = it.range[2] || 1;
        r.value = S.opt(m.id, it.key, it.def); r.setAttribute('aria-label', it.label);
        r.addEventListener('input', () => { S.setOpt(m.id, it.key, +r.value); if (m.onSetting) m.onSetting(it.key, +r.value); });
        g.append(r);
      } else {
        const c = document.createElement('div'); c.className = 'chips';
        for (const [val, label] of it.options) {
          const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
          const cur = S.opt(m.id, it.key, it.def); if (String(cur) === String(val)) b.classList.add('on');
          b.addEventListener('click', () => {
            S.setOpt(m.id, it.key, val); c.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
            if (m.onSetting) m.onSetting(it.key, val);
          });
          c.append(b);
        }
        g.append(c);
      }
      box.append(g);
    }
  }
  function syncTabs() {
    $('tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === (S.mode ? S.mode.id : S.settings.mode)));
    $('cards').querySelectorAll('.card').forEach(b => b.classList.toggle('on', b.dataset.id === S.settings.mode));
  }
  function chipRow(id, entries, get, set) {
    const box = $(id); box.textContent = '';
    for (const [val, label] of entries) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.val = val;
      b.addEventListener('click', () => { set(val); syncGlobal(); });
      box.append(b);
    }
    box._get = get;
  }
  function syncGlobal() {
    for (const id of ['inputChips', 'skelChips', 'qualChips']) { const box = $(id); if (!box._get) continue; const v = box._get(); box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === String(v))); }
  }

  // ---------- Aufnahme ----------
  let rec = null, chunks = [];
  function toggleRec() {
    if (rec) { rec.stop(); return; }
    if (!S.AC || !S.out.captureStream || !A.rec || !window.MediaRecorder) { S.toast('Aufnehmen geht in diesem Browser nicht.'); return; }
    let mime = '';
    for (const m of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']) if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
    const stream = new MediaStream([...S.out.captureStream(30).getVideoTracks(), ...A.rec.stream.getAudioTracks()]);
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : undefined); chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      const type = rec.mimeType || 'video/webm', blob = new Blob(chunks, { type });
      rec = null; $('recBtn').classList.remove('on'); $('recBtn').textContent = '● REC';
      const file = new File([blob], 'handstudio-' + Date.now() + (type.includes('mp4') ? '.mp4' : '.webm'), { type });
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000); S.toast('Video gespeichert.');
    };
    rec.start(500); $('recBtn').classList.add('on'); $('recBtn').textContent = '■ STOP';
  }

  // =====================================================================
  //  Hauptschleife
  // =====================================================================
  S.kickV = 0; S.flash = 0; S.bass = 0; S.high = 0;
  let lastT = performance.now(), frameEma = 16, qCheck = 0, hudTick = 0, lvl = 0;
  const levelBars = [...document.querySelectorAll('#level i')];
  function frame(now) {
    requestAnimationFrame(frame);
    S.frameNo++;
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    frameEma = frameEma * 0.95 + dt * 1000 * 0.05;
    if (S.settings.quality === 'auto' && now - qCheck > 2500) {
      qCheck = now;
      if (frameEma > 30 && S.renderScale > 0.55 && S.playing) { S.renderScale *= 0.85; S.resize(); }
    }
    if (S.AC) {
      A.anF.getByteFrequencyData(A.freq); A.anL.getFloatTimeDomainData(A.bufL); A.anR.getFloatTimeDomainData(A.bufR);
      let b = 0, h = 0; for (let i = 1; i < 6; i++) b += A.freq[i]; for (let i = 200; i < 500; i++) h += A.freq[i];
      S.bass = b / (5 * 255); S.high = h / (300 * 255);
      while (S.kickTimes.length && S.kickTimes[0] <= S.AC.currentTime) { S.kickTimes.shift(); S.kickV = 1; }
    }
    S.kickV *= Math.pow(0.02, dt); S.flash *= Math.pow(0.05, dt);
    const ctx = S.ctx;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    if (S.mode && S.started) { try { S.mode.frame(now, dt); } catch (e) { console.error(e); } }
    else idleFrame(now);
    if (S.flash > 0.02) { ctx.fillStyle = `rgba(${S.accent || [255, 255, 255]},${S.flash * 0.18})`; ctx.fillRect(0, 0, S.W, S.H); }
    // Anzeige
    if (S.AC) {
      let pk = 0; for (let i = 0; i < 2048; i += 8) { const v = Math.abs(A.bufL[i]); if (v > pk) pk = v; }
      lvl = Math.max(pk, lvl * 0.86);
      levelBars.forEach((el, i) => { el.style.height = (10 + clamp(lvl * 5 - i * 0.9) * 90) + '%'; el.style.opacity = S.AC.state === 'running' ? 1 : 0.3; });
    }
    if (++hudTick % 4 === 0 && S.mode && S.started) {
      (S.mode.matrix || []).forEach(([, v, f], i) => { if (!meters[i]) return; meters[i][0].style.width = Math.round(clamp(v()) * 100) + '%'; meters[i][1].textContent = f(); });
      const tr = S.usingCamera() ? (S.track.ready ? `${S.track.count} HAND${S.track.count === 1 ? '' : 'E'} · ${Math.round(S.track.hz)} HZ` : 'LADE …') : 'TOUCH';
      if (S._tr !== tr) { $('track').textContent = tr; S._tr = tr; }
    }
  }
  // Hintergrund vor dem Start
  function idleFrame(now) {
    const ctx = S.ctx, t = now / 1000;
    const g = ctx.createRadialGradient(S.W / 2, S.H * 0.3, 10, S.W / 2, S.H * 0.4, Math.max(S.W, S.H) * 0.8);
    g.addColorStop(0, '#2a1240'); g.addColorStop(1, '#06040a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
    ctx.strokeStyle = 'rgba(201,167,255,.18)'; ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      for (let x = 0; x <= S.W; x += 8) { const y = S.H * (0.55 + k * 0.06) + Math.sin(x * 0.012 + t * (0.6 + k * 0.15) + k) * 22; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
  }

  // =====================================================================
  //  Start
  // =====================================================================
  S.started = false;
  function begin(input) {
    $('intro').hidden = true; ['top', 'matrix', 'section'].forEach(id => { $(id).hidden = false; });
    S.settings.input = input; S.save(); syncGlobal();
    S.startAudio();
    S.started = true;
    const m = S.mode; S.mode = null; S.setMode(m ? m.id : S.settings.mode);
    if (input === 'kamera') S.startCamera(); else if (S.mode.hint) S.toast(S.mode.hint, 5000);
  }

  S.boot = () => {
    if (!S.gl) S.toast('Dein Browser kann kein WebGL2. Manche Welten bleiben dunkel.', 5000);
    // Welten-Karten und Reiter
    const cards = $('cards'), tabs = $('tabs');
    for (const m of S.modes) {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'card glass'; c.dataset.id = m.id;
      const b = document.createElement('b'); const dot = document.createElement('i'); dot.style.background = `rgb(${m.color})`; b.append(dot, m.name);
      const sp = document.createElement('span'); sp.textContent = m.short; c.append(b, sp);
      c.addEventListener('click', () => { S.settings.mode = m.id; S.save(); S.setAccent(m.color); syncTabs(); });
      cards.append(c);
      const t = document.createElement('button'); t.type = 'button'; t.dataset.id = m.id;
      const ti = document.createElement('i'); ti.style.background = `rgb(${m.color})`; t.append(ti, m.name);
      t.addEventListener('click', () => S.setMode(m.id));
      tabs.append(t);
    }
    const fromHash = location.hash.slice(1);
    if (S.modes.some(m => m.id === fromHash)) S.settings.mode = fromHash;
    const cur = S.modes.find(m => m.id === S.settings.mode) || S.modes[0];
    S.settings.mode = cur.id; S.setAccent(cur.color); syncTabs();

    chipRow('inputChips', [['kamera', 'Kamera'], ['touch', 'Touch']], () => S.settings.input, v => { S.settings.input = v; S.save(); if (v === 'kamera' && !S.camOn) S.startCamera(); });
    chipRow('skelChips', [['an', 'An'], ['aus', 'Aus']], () => S.settings.skel, v => { S.settings.skel = v; S.save(); });
    chipRow('qualChips', [['auto', 'Automatisch'], ['hoch', 'Hoch'], ['mittel', 'Mittel'], ['niedrig', 'Niedrig']], () => S.settings.quality, v => { S.settings.quality = v; S.renderScale = 1; S.save(); S.resize(); });
    syncGlobal();
    $('vol').value = Math.round(S.settings.vol * 100);
    $('vol').addEventListener('input', e => { S.settings.vol = e.target.value / 100; S.save(); if (S.AC) A.master.gain.setTargetAtTime(S.settings.vol * 0.75, S.AC.currentTime, 0.05); });
    $('setBtn').addEventListener('click', () => { $('drawer').hidden = false; });
    $('closeSet').addEventListener('click', () => { $('drawer').hidden = true; });
    $('playBtn').addEventListener('click', () => S.playing ? S.stopAudio() : S.startAudio());
    $('recBtn').addEventListener('click', toggleRec);
    $('unmuteBtn').addEventListener('click', () => { unlockAudio(); wakeAudio(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && S.playing) { unlockAudio(); wakeAudio(); } });
    $('startCam').addEventListener('click', () => begin('kamera'));
    $('startTouch').addEventListener('click', () => begin('touch'));
    addEventListener('resize', S.resize);
    addEventListener('hashchange', () => { const id = location.hash.slice(1); if (S.started && S.modes.some(m => m.id === id)) S.setMode(id); });
    S.resize();
    requestAnimationFrame(frame);
  };
})();
