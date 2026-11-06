/* Welt 3: Lichtshow – jeder Finger ein Suchscheinwerfer über dem Sturmstrand (wie Video 2) */
(() => {
  'use strict';
  const S = window.S, { clamp, lerp, mtof } = S;
  const ID = 'licht';
  const o = (k, d) => S.opt(ID, k, d);
  const M = {
    id: ID, name: 'Lichtshow', color: [150, 200, 255],
    short: 'Jeder gestreckte Finger wird ein Suchscheinwerfer am Sturmstrand. Beide Hände offen: Lichtwand.',
    hint: 'Strecke Finger, um Scheinwerfer anzuschalten. Kipp die Finger, um sie zu drehen. Beide Fäuste: Gewitter.',
    bpm: () => 100, swing: () => 0,
  };
  const SCENE_FS = `#version 300 es
precision highp float; out vec4 o;
uniform vec4 uRect; uniform float uTime, uWall, uFlash, uBass, uKick;
uniform vec4 uBeams[10];
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
void main(){
  vec2 uv = (gl_FragCoord.xy - uRect.xy) / uRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float aspect = uRect.z / uRect.w; vec2 p = vec2(uv.x * aspect, uv.y);
  float hz = 0.52, shore = 0.33;
  vec3 col;
  // Himmel mit Sturmwolken
  float cl = fbm(vec2(p.x * 2.2 + uTime * 0.025, p.y * 3.0 - uTime * 0.01));
  float cl2 = fbm(vec2(p.x * 5.0 - uTime * 0.04, p.y * 6.0));
  float dens = smoothstep(0.35, 0.85, cl * 0.75 + cl2 * 0.35 + (uv.y - hz) * 0.4);
  vec3 sky = mix(vec3(0.05, 0.06, 0.09), vec3(0.22, 0.24, 0.3), dens) * (0.75 + 0.5 * smoothstep(hz, 1.0, uv.y));
  sky += vec3(0.75, 0.8, 1.0) * uFlash * dens * (0.6 + 0.8 * n2(p * 3.0 + uTime));
  // Meer
  float sea = smoothstep(shore, shore + 0.01, uv.y) * (1.0 - smoothstep(hz - 0.004, hz, uv.y));
  float wave = sin(p.x * 40.0 + uTime * 1.3 + sin(p.y * 90.0) * 2.0) * 0.5 + 0.5;
  vec3 seaC = vec3(0.04, 0.05, 0.07) + vec3(0.08, 0.09, 0.11) * wave * smoothstep(shore, hz, uv.y) * 0.6;
  float foam = smoothstep(0.75, 1.0, n2(vec2(p.x * 18.0 + uTime * 0.3, uv.y * 60.0))) * (1.0 - smoothstep(shore, shore + 0.07, uv.y));
  seaC += vec3(0.5, 0.55, 0.6) * foam * 0.5;
  // Strand
  vec3 sand = mix(vec3(0.12, 0.1, 0.08), vec3(0.04, 0.035, 0.03), 1.0 - uv.y / shore);
  col = uv.y > hz ? sky : (uv.y > shore ? seaC : sand);
  // Scheinwerfer
  vec3 light = vec3(0.0); float refl = 0.0;
  for (int i = 0; i < 10; i++) {
    vec4 b = uBeams[i]; if (b.z < 0.01) continue;
    vec2 org = vec2(b.x * aspect, hz - 0.01);
    vec2 dir = vec2(sin(b.y), cos(b.y));
    vec2 d = p - org; float along = dot(d, dir); float perp = abs(d.x * dir.y - d.y * dir.x);
    if (along > 0.0) {
      float w = b.w * (0.6 + along * 1.6);
      float core = exp(-perp * perp / (w * w * 0.08)); float halo = exp(-perp * perp / (w * w));
      float fall = exp(-along * 0.9);
      float l = (core * 1.6 + halo * 0.5) * fall * b.z;
      light += vec3(0.9, 0.95, 1.0) * l * (uv.y > hz ? 1.0 + dens * 1.5 : 0.0);
    }
    float rx = abs(p.x - org.x);
    refl += b.z * exp(-rx * rx / 0.0006) * (uv.y < hz && uv.y > shore - 0.05 ? (0.5 + 0.5 * sin(uv.y * 160.0 + uTime * 4.0 + p.x * 30.0)) : 0.0) * smoothstep(shore - 0.05, hz, uv.y);
    light += vec3(1.0, 0.95, 0.85) * b.z * exp(-dot(p - org, p - org) / 0.00012);
  }
  // Lichtwand: Vorhang aus fallenden Funken
  if (uWall > 0.01 && uv.y > hz - 0.01) {
    // Funken-Wasserfall: dünne Säulen aus fallenden Funken
    float colN = floor(p.x * 120.0); float rnd = h21(vec2(colN, 3.0));
    float y = uv.y - hz, height = 0.2 + 0.16 * rnd;
    float inside = smoothstep(height, height - 0.06, y) * step(0.0, y);
    float fall = fract(y * (7.0 + rnd * 5.0) + uTime * (1.0 + rnd * 0.8) + rnd * 10.0);
    float spark = smoothstep(0.78, 1.0, fall) * (0.45 + 0.55 * rnd);
    float xin = 1.0 - abs(fract(p.x * 120.0) - 0.5) * 2.0;
    spark *= smoothstep(0.35, 1.0, xin);
    float tw = step(0.985, h21(floor(vec2(p.x * 240.0, uv.y * 180.0)) + mod(floor(uTime * 12.0), 97.0)));
    float glow = exp(-y * 5.0) * 0.22;
    light += vec3(1.0, 0.82, 0.55) * (spark * 1.5 + glow + tw * 0.8 * inside) * inside * uWall;
    
  }
  if (uWall > 0.01 && uv.y < hz && uv.y > shore - 0.04) { float cn = floor(p.x * 120.0); refl += uWall * 0.6 * h21(vec2(cn, 7.0)) * (0.55 + 0.45 * sin(uv.y * 260.0 + uTime * 4.0)) * smoothstep(shore - 0.04, hz, uv.y); }
  col += light;
  col += vec3(1.0, 0.92, 0.8) * refl * 0.55;
  col += vec3(0.6, 0.65, 0.8) * uKick * 0.03;
  col = 1.0 - exp(-col * 1.25);
  vec2 q = uv - 0.5; col *= 1.0 - dot(q, q) * 0.6;
  o = vec4(col, 1.0);
}`;
  let prog = null;
  const beams = Array.from({ length: 10 }, () => ({ x: 0.5, a: 0, on: 0, w: 0.035 }));
  let wall = 0, flash = 0, storm = 0, lastStorm = 0, lastFlashT = 0;
  const N = {}; let built = false;

  function build() {
    const AC = S.AC, G = S.G, F = S.F;
    N.out = G(0); N.out.connect(S.A.bus);
    // Wind + Meer
    const wsrc = AC.createBufferSource(); wsrc.buffer = S.A.noise; wsrc.loop = true;
    N.wind = F('bandpass', 500, 0.6); N.windG = G(0.05); wsrc.connect(N.wind); N.wind.connect(N.windG); N.windG.connect(N.out); wsrc.start();
    const wl = AC.createOscillator(); wl.frequency.value = 0.07; const wla = G(250); wl.connect(wla); wla.connect(N.wind.frequency); wl.start();
    const ssrc = AC.createBufferSource(); ssrc.buffer = S.A.noise; ssrc.loop = true;
    N.sea = F('lowpass', 700, 0.5); N.seaG = G(0.06); ssrc.connect(N.sea); N.sea.connect(N.seaG); N.seaG.connect(N.out); ssrc.start(0, 0.5);
    const sl = AC.createOscillator(); sl.frequency.value = 0.12; const sla = G(0.05); sl.connect(sla); sla.connect(N.seaG.gain); sl.start();
    // Fläche: jeder Scheinwerfer ein Ton (A-Moll add9)
    N.padLP = F('lowpass', 2200, 0.6); N.pad = G(0.9); N.padLP.connect(N.pad); N.pad.connect(N.out);
    const pr = G(0.6); N.pad.connect(pr); pr.connect(S.A.revIn);
    N.voices = [45, 52, 57, 60, 64, 67, 69, 71, 72, 76].map((m, i) => {
      const g = G(0); g.connect(N.padLP);
      for (const det of [-7, 7]) { const x = AC.createOscillator(); x.type = 'sawtooth'; x.frequency.value = mtof(m); x.detune.value = det; const xg = G(0.035); const pn = S.pan(det < 0 ? -0.5 : 0.5); x.connect(xg); xg.connect(pn); pn.connect(g); x.start(); }
      return { g, m };
    });
    N.beat = G(0.75); N.beat.connect(N.out);
    built = true;
  }
  function shimmer(i) {
    if (!built) return; const AC = S.AC, t = AC.currentTime + 0.01, f = mtof(N.voices[i].m + 24);
    const x = AC.createOscillator(); x.frequency.value = f; const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.01); g.gain.setTargetAtTime(0.0001, t + 0.02, 0.4);
    x.connect(g); g.connect(N.out); const d = S.G(0.5); g.connect(d); d.connect(S.A.dlyIn); const r = S.G(0.6); g.connect(r); r.connect(S.A.revIn);
    x.start(t); x.stop(t + 2.5);
  }
  function thunder() {
    if (!built) return; const AC = S.AC, t = AC.currentTime + 0.05;
    const src = AC.createBufferSource(); src.buffer = S.A.noise; src.loop = true;
    const lp = S.F('lowpass', 900, 0.8); lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(90, t + 2.5);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    src.connect(lp); lp.connect(g); g.connect(N.out); const r = S.G(0.4); g.connect(r); r.connect(S.A.revIn); src.start(t); src.stop(t + 3.4);
  }
  M.step = (i, t) => {
    if (!built || o('beat', 'an') !== 'an') return;
    const lit = beams.filter(b => b.on > 0.5).length; if (lit === 0) return;
    const AC = S.AC;
    if ([0, 6, 8].includes(i)) { const k = AC.createOscillator(); k.frequency.setValueAtTime(140, t); k.frequency.setTargetAtTime(46, t, 0.035); const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.05, 0.1); k.connect(g); g.connect(N.beat); k.start(t); k.stop(t + 0.6); S.kickTimes.push(t); }
    if (lit >= 3 && (i === 4 || i === 12)) { for (const d of [0, 0.012]) S.noise(t + d, { type: 'bandpass', f: 1400, q: 1, dur: 0.12, gain: 0.25, rev: 0.4, dest: N.beat }); }
    if (lit >= 5 && i % 2 === 0) S.noise(t, { type: 'highpass', f: 8500, dur: 0.035, gain: i % 4 ? 0.06 : 0.1, dest: N.beat });
  };

  let prevOn = new Array(10).fill(false);
  M.frame = (now, dt) => {
    const ctx = S.ctx, W = S.W, H = S.H, portrait = H >= W;
    const camR = portrait ? { x: 0, y: 0, w: W, h: H * 0.44 } : { x: 0, y: 0, w: W * 0.5, h: H };
    const sceneR = portrait ? { x: 0, y: H * 0.44, w: W, h: H * 0.56 } : { x: W * 0.5, y: 0, w: W * 0.5, h: H };
    S.view = camR;
    const hands = S.currentHands();
    // Scheinwerfer aus den Fingern
    const targets = Array.from({ length: 10 }, (_, i) => ({ on: 0, x: (i + 0.5) / 10, a: 0 }));
    let fists = 0, openAll = 0;
    for (const side of ['L', 'R']) {
      const h = hands[side]; if (!h) continue;
      if (h.fingers === 0) fists++; if (h.fingers === 5) openAll++;
      for (let f = 0; f < 5; f++) {
        const k = side === 'L' ? 4 - f : 5 + f;
        const on = h.touch ? 1 : (h.ext[f] ? 1 : 0);
        const tipX = h.touch ? (h.palm[0] - camR.x) / camR.w + (f - 2) * 0.05 : (h.tips[f][0] - camR.x) / camR.w;
        targets[k] = { on, x: clamp(0.06 + clamp(tipX) * 0.88), a: clamp(h.dirs[f] * 0.9, -0.95, 0.95) };
      }
    }
    beams.forEach((b, i) => {
      const tg = targets[i];
      b.on = lerp(b.on, tg.on, 0.18); b.x = lerp(b.x, tg.x, 0.25); b.a = lerp(b.a, tg.a, 0.25);
      const isOn = tg.on > 0.5;
      if (isOn && !prevOn[i]) shimmer(i);
      prevOn[i] = isOn;
      if (built) N.voices[i].g.gain.setTargetAtTime(b.on * 0.9, S.AC.currentTime, 0.12);
    });
    wall = lerp(wall, openAll === 2 ? 1 : 0, 0.06);
    if (fists === 2 && now - lastStorm > 2600) { lastStorm = now; flash = 1; thunder(); }
    if (S.kickV > 0.95 && beams.filter(b => b.on > 0.5).length >= 6 && now - lastFlashT > 400) { flash = Math.max(flash, 0.35); lastFlashT = now; }
    flash *= Math.pow(0.04, dt);
    if (built) {
      const t = S.AC.currentTime;
      N.padLP.frequency.setTargetAtTime(900 + wall * 4000 + beams.reduce((a, b) => a + b.on, 0) * 250, t, 0.1);
      N.windG.gain.setTargetAtTime(0.04 + (1 - beams.reduce((a, b) => a + b.on, 0) / 10) * 0.05, t, 0.3);
    }
    // Szene in WebGL
    const gl = S.gl;
    if (gl) {
      if (!prog) prog = S.glProg(S.QUAD_VS, SCENE_FS);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, S.glc.width, S.glc.height); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(prog.p); S.glQuad();
      const d = S.dpr, u = prog.u;
      gl.uniform4f(u.uRect, sceneR.x * d, (H - sceneR.y - sceneR.h) * d, sceneR.w * d, sceneR.h * d);
      gl.uniform1f(u.uTime, now / 1000); gl.uniform1f(u.uWall, wall); gl.uniform1f(u.uFlash, flash); gl.uniform1f(u.uBass, S.bass); gl.uniform1f(u.uKick, S.kickV);
      const arr = new Float32Array(40); beams.forEach((b, i) => arr.set([b.x, b.a, b.on * (1 + S.kickV * 0.15), b.w], i * 4));
      gl.uniform4fv(u.uBeams, arr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      S.blitGL();
    } else { ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, W, H); }
    // Kamera oben, nachtgrün eingefärbt wie im Video
    ctx.save(); ctx.beginPath(); ctx.rect(camR.x, camR.y, camR.w, camR.h); ctx.clip();
    ctx.fillStyle = '#071311'; ctx.fillRect(camR.x, camR.y, camR.w, camR.h);
    S.drawCamera(ctx, 0.95, camR);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(120,230,200)'; ctx.fillRect(camR.x, camR.y, camR.w, camR.h);
    ctx.globalCompositeOperation = 'source-over';
    // Marker: Sterne + Linien vom Handgelenk mit Beschriftung
    for (const side of ['L', 'R']) {
      const h = hands[side]; if (!h || h.touch || S.settings.skel === 'aus') continue;
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1;
      ctx.font = '600 9px "JetBrains Mono", monospace'; ctx.fillStyle = 'rgba(255,255,255,.9)';
      h.tips.forEach((tp, f) => {
        ctx.beginPath(); ctx.moveTo(h.pts[0][0], h.pts[0][1]); ctx.lineTo(tp[0], tp[1]); ctx.stroke();
        if (h.ext[f]) ctx.fillText('licht ' + (side === 'L' ? 5 - f : 6 + f), (h.pts[0][0] + tp[0]) / 2 + 4, (h.pts[0][1] + tp[1]) / 2);
      });
      for (let k = 0; k < 21; k++) star(ctx, h.pts[k][0], h.pts[k][1], [4, 8, 12, 16, 20].includes(k) ? 5 : 3.6);
    }
    ctx.restore();
    // Trennlinie
    ctx.fillStyle = 'rgba(0,0,0,.6)'; if (portrait) ctx.fillRect(0, camR.h - 1, W, 3); else ctx.fillRect(camR.w - 1, 0, 3, H);
    const lit = beams.filter(b => b.on > 0.5).length;
    S.setSection(wall > 0.5 ? 'LICHTWAND' : lit === 0 ? 'DUNKEL' : lit + ' LICHT' + (lit === 1 ? '' : 'ER'), 'STURMSTRAND · ' + (o('beat', 'an') === 'an' ? '100 BPM' : 'OHNE BEAT'));
  };
  function star(ctx, x, y, r) {
    ctx.fillStyle = '#ff2fd2'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  M.enter = () => { if (!built) build(); N.out.gain.setTargetAtTime(1, S.AC.currentTime, 0.1); };
  M.exit = () => { if (built) N.out.gain.setTargetAtTime(0, S.AC.currentTime, 0.08); S.view = { x: 0, y: 0, w: S.W, h: S.H }; };
  M.resize = () => {};
  M.matrix = [
    ['LICHTER', () => beams.filter(b => b.on > 0.5).length / 10, () => beams.filter(b => b.on > 0.5).length + '/10'],
    ['LICHTWAND', () => wall, () => Math.round(wall * 100) + '%'],
    ['BLITZ', () => flash, () => flash > 0.1 ? 'JA' : '–'],
    ['KLANG', () => beams.reduce((a, b) => a + b.on, 0) / 10, () => Math.round(beams.reduce((a, b) => a + b.on, 0)) + ' STIMMEN'],
  ];
  M.gestures = [['Finger strecken', 'Scheinwerfer an, jeder Finger ein Ton'], ['Finger kippen', 'Scheinwerfer drehen'], ['Beide Hände offen', 'Lichtwand'],
    ['Beide Fäuste', 'Blitz und Donner'], ['Ab 3 Lichtern', 'Beat wird voller']];
  M.settings = [{ key: 'beat', label: 'Beat', def: 'an', options: [['an', 'An'], ['aus', 'Nur Klangfläche']] }];
  window.__licht = { beams, get wall() { return wall; } };
  S.register(M);
})();
