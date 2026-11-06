/* Welt 4: Portal – Rahmen aus Daumen und Zeigefingern öffnet ein Fenster mit anderem Bild + 3D-Würfel (wie Video 3) */
(() => {
  'use strict';
  const S = window.S, { clamp, lerp, mtof } = S;
  const ID = 'portal';
  const o = (k, d) => S.opt(ID, k, d);
  const FX = [['roentgen', 'Röntgen'], ['thermal', 'Wärmebild'], ['negativ', 'Negativ'], ['pixel', 'Pixel'], ['kaleido', 'Kaleidoskop']];
  const M = {
    id: ID, name: 'Portal', color: [190, 255, 60],
    short: 'Forme mit Daumen und Zeigefingern einen Rahmen. Darin öffnet sich ein anderes Bild mit schwebendem 3D-Würfel.',
    hint: 'Beide Hände: Daumen und Zeigefinger ausstrecken wie ein Bilderrahmen. Größer ziehen = Musik geht auf.',
    bpm: () => 119, swing: () => 0.03,
  };
  const COMMON = `
uniform sampler2D uCam; uniform vec2 uRes, uCover, uCenter; uniform int uFx; uniform float uTime, uKick;
vec2 camUV(vec2 uv){ return vec2(1.0 - (0.5 + (uv.x - 0.5) * uCover.x), 0.5 + (uv.y - 0.5) * uCover.y); }
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 effect(vec2 uv){
  if (uFx == 4) { vec2 p = uv * uRes - uCenter; float a = atan(p.y, p.x), r = length(p); float seg = 6.2832 / 6.0; a = mod(a, seg); a = abs(a - seg * 0.5); uv = (uCenter + vec2(cos(a), sin(a)) * r) / uRes; }
  if (uFx == 3) { vec2 cell = vec2(14.0) / uRes; uv = (floor(uv / cell) + 0.5) * cell; }
  vec2 c = camUV(uv); vec3 col = texture(uCam, c).rgb;
  if (uFx == 0) {
    vec2 px = 1.5 / uRes; float tl = lum(texture(uCam, camUV(uv + vec2(-px.x, -px.y))).rgb), t = lum(texture(uCam, camUV(uv + vec2(0.0, -px.y))).rgb), tr = lum(texture(uCam, camUV(uv + vec2(px.x, -px.y))).rgb);
    float l = lum(texture(uCam, camUV(uv + vec2(-px.x, 0.0))).rgb), r = lum(texture(uCam, camUV(uv + vec2(px.x, 0.0))).rgb);
    float bl = lum(texture(uCam, camUV(uv + vec2(-px.x, px.y))).rgb), b = lum(texture(uCam, camUV(uv + vec2(0.0, px.y))).rgb), br = lum(texture(uCam, camUV(uv + vec2(px.x, px.y))).rgb);
    float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br, gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
    float e = clamp(length(vec2(gx, gy)) * 2.4, 0.0, 1.0);
    return vec3(0.85, 0.92, 1.0) * (e * 1.3 + (1.0 - lum(col)) * 0.18);
  }
  if (uFx == 1) { float v = lum(col); vec3 a = mix(vec3(0.0, 0.0, 0.2), vec3(0.5, 0.0, 0.6), smoothstep(0.0, 0.3, v)); a = mix(a, vec3(1.0, 0.3, 0.0), smoothstep(0.3, 0.6, v)); return mix(a, vec3(1.0, 1.0, 0.6), smoothstep(0.6, 0.95, v)); }
  if (uFx == 2) return clamp((1.0 - col - 0.5) * 1.3 + 0.5, 0.0, 1.0);
  if (uFx == 3) return floor(col * 5.0) / 5.0;
  return col * 1.15;
}`;
  const BG_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;` + COMMON + `
uniform float uOpen, uCamOn;
void main(){ vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec3 c = uCamOn > 0.5 ? texture(uCam, camUV(uv)).rgb : vec3(0.08, 0.09, 0.07) + 0.04 * sin(uv.x * 40.0 + uTime) * sin(uv.y * 30.0);
  c = mix(c, vec3(lum(c)), uOpen * 0.35) * (1.0 - uOpen * 0.25);
  vec2 q = uv - 0.5; o = vec4(c * (1.0 - dot(q, q) * 0.5), 1.0); }`;
  const QUAD_VS = `#version 300 es
layout(location = 0) in vec2 aP; uniform vec2 uRes2;
void main(){ gl_Position = vec4(aP.x / uRes2.x * 2.0 - 1.0, 1.0 - aP.y / uRes2.y * 2.0, 0.0, 1.0); }`;
  const PORTAL_FS = `#version 300 es
precision highp float; out vec4 o;` + COMMON + `
uniform float uCamOn;
void main(){ vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec3 c = uCamOn > 0.5 ? effect(uv) : vec3(0.2 + 0.2 * sin(uv.x * 30.0 + uTime * 2.0), 0.6, 0.3 + 0.2 * cos(uv.y * 25.0));
  o = vec4(c * (1.05 + uKick * 0.15), 1.0); }`;
  const CUBE_VS = `#version 300 es
layout(location = 0) in vec3 aPos; layout(location = 1) in vec2 aUv; layout(location = 2) in vec3 aN;
uniform mat3 uRot; uniform vec2 uC, uRes2; uniform float uSize;
out vec2 vF; out float vShade;
void main(){ vec3 p = uRot * aPos; vec3 n = uRot * aN; float f = 3.2; float s = f / (f - p.z);
  vec2 px = uC + p.xy * uSize * s; gl_Position = vec4(px.x / uRes2.x * 2.0 - 1.0, 1.0 - px.y / uRes2.y * 2.0, -p.z * 0.3, 1.0);
  vF = aUv; vShade = 0.45 + 0.55 * max(0.0, n.z); }`;
  const CUBE_FS = `#version 300 es
precision highp float; in vec2 vF; in float vShade; out vec4 o;
uniform sampler2D uCam; uniform float uAspectCam, uCamOn, uKick;
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(){
  vec2 c = vec2(1.0 - (0.5 + (vF.x - 0.5) / uAspectCam), vF.y);
  vec2 px = vec2(1.5 / 640.0, 1.5 / 360.0);
  float gx = lum(texture(uCam, c + vec2(px.x, 0.0)).rgb) - lum(texture(uCam, c - vec2(px.x, 0.0)).rgb);
  float gy = lum(texture(uCam, c + vec2(0.0, px.y)).rgb) - lum(texture(uCam, c - vec2(0.0, px.y)).rgb);
  float e = clamp(length(vec2(gx, gy)) * 5.0, 0.0, 1.0);
  vec3 col = uCamOn > 0.5 ? vec3(e * 1.2 + (1.0 - lum(texture(uCam, c).rgb)) * 0.12) : vec3(0.15);
  float edge = max(smoothstep(0.94, 1.0, max(vF.x, vF.y)), smoothstep(0.06, 0.0, min(vF.x, vF.y)));
  col = col * vShade + vec3(0.85, 1.0, 0.6) * edge * (0.7 + uKick * 0.6);
  o = vec4(col, 1.0); }`;

  let P = null, quadBuf = null, quadVao = null, cubeVao = null;
  function initGL() {
    const gl = S.gl;
    P = { bg: S.glProg(S.QUAD_VS, BG_FS), portal: S.glProg(QUAD_VS, PORTAL_FS), cube: S.glProg(CUBE_VS, CUBE_FS) };
    quadVao = gl.createVertexArray(); gl.bindVertexArray(quadVao); quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 12 * 4, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // Würfel: 6 Flächen
    const faces = [[[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]], [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]]];
    const data = [];
    for (const [n, u, v] of faces) {
      const corner = (a, b) => [n[0] + u[0] * a + v[0] * b, n[1] + u[1] * a + v[1] * b, n[2] + u[2] * a + v[2] * b];
      const quad = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
      for (const [a, b] of quad) { data.push(...corner(a, b), (a + 1) / 2, (1 - b) / 2, ...n); }
    }
    cubeVao = gl.createVertexArray(); gl.bindVertexArray(cubeVao);
    const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20);
    gl.bindVertexArray(null);
  }

  // ---------- Klang: sauberer 119-BPM-Groove in Es-Moll, Portal öffnet den Filter ----------
  const N = {}; let built = false;
  function build() {
    const AC = S.AC, G = S.G;
    N.out = G(0); N.out.connect(S.A.bus);
    N.drums = G(0.85); N.drums.connect(N.out);
    N.music = G(1); N.lp = S.F('lowpass', 500, 1.2); N.duck = G(1);
    N.music.connect(N.lp); N.lp.connect(N.duck); N.duck.connect(N.out);
    N.rev = G(0.2); N.duck.connect(N.rev); N.rev.connect(S.A.revIn);
    N.dly = G(0.12); N.duck.connect(N.dly); N.dly.connect(S.A.dlyIn);
    built = true;
  }
  const STAB = [51, 54, 58, 61, 65];   // Es-Moll 9
  M.step = (i, t, st, bar) => {
    if (!built) return;
    const AC = S.AC;
    if (i % 4 === 0) {
      const k = AC.createOscillator(); k.frequency.setValueAtTime(150, t); k.frequency.setTargetAtTime(50, t, 0.03);
      const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.85, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.06, 0.09);
      k.connect(g); g.connect(N.drums); k.start(t); k.stop(t + 0.6); S.kickTimes.push(t);
      N.duck.gain.cancelScheduledValues(t); N.duck.gain.setValueAtTime(1, t); N.duck.gain.linearRampToValueAtTime(0.55, t + 0.005); N.duck.gain.setTargetAtTime(1, t + 0.03, 0.08);
    }
    if (i % 4 === 2) S.noise(t, { type: 'highpass', f: 7500, dur: 0.09, gain: 0.13, p: 0.2, dest: N.drums });
    if (i % 2 === 1 && open > 0.3) S.noise(t, { type: 'highpass', f: 10000, dur: 0.025, gain: 0.05, p: -0.3, dest: N.drums });
    if (i === 4 || i === 12) { for (const d of [0, 0.011]) S.noise(t + d, { type: 'bandpass', f: 1300, q: 1.1, dur: 0.14, gain: 0.22, rev: 0.3, dest: N.drums }); }
    // Bass auf den Offbeats
    if ([2, 6, 10, 14, 15].includes(i)) {
      const f = mtof(i === 15 ? 42 : 39), b = AC.createOscillator(); b.frequency.value = f; const s2 = AC.createOscillator(); s2.type = 'sawtooth'; s2.frequency.value = f;
      const lp = S.F('lowpass', 300, 2); const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.004); g.gain.setTargetAtTime(0.0001, t + st * 0.6, 0.03);
      const sg = S.G(0.25); b.connect(g); s2.connect(sg); sg.connect(lp); lp.connect(g); g.connect(N.music); b.start(t); s2.start(t); b.stop(t + 0.4); s2.stop(t + 0.4);
    }
    // Akkord-Stabs
    if (i === 3 || i === 10 || (i === 14 && bar % 2)) {
      for (const m of STAB) {
        const x = AC.createOscillator(); x.type = 'sawtooth'; x.frequency.value = mtof(m); x.detune.value = (Math.random() - 0.5) * 10;
        const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.005); g.gain.setTargetAtTime(0.0001, t + 0.05, 0.12);
        x.connect(g); g.connect(N.music); x.start(t); x.stop(t + 0.8);
      }
    }
  };
  function whoosh(up) {
    if (!built) return; const AC = S.AC, t = AC.currentTime + 0.01;
    const src = AC.createBufferSource(); src.buffer = S.A.noise; src.loop = true;
    const bp = S.F('bandpass', up ? 400 : 6000, 3); bp.frequency.exponentialRampToValueAtTime(up ? 6000 : 300, t + 0.5);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(bp); bp.connect(g); g.connect(N.out); const r = S.G(0.5); g.connect(r); r.connect(S.A.revIn); src.start(t); src.stop(t + 0.7);
  }

  // ---------- Bild ----------
  let open = 0, corners = null, area = 0, tilt = 0, wasOpen = false, fxIdx = 0, spin = 0;
  M.frame = (now, dt) => {
    const ctx = S.ctx, W = S.W, H = S.H, hands = S.currentHands(), L = hands.L, R = hands.R;
    let frame = false, cs = null;
    if (L && R && (L.touch || (L.ext[0] && L.ext[1])) && (R.touch || (R.ext[0] && R.ext[1]))) {
      const pts = L.touch ? [[L.palm[0] - 40, L.palm[1] - 60], [L.palm[0] - 40, L.palm[1] + 60], [R.palm[0] + 40, R.palm[1] - 60], [R.palm[0] + 40, R.palm[1] + 60]]
        : [L.tips[1], L.tips[0], R.tips[1], R.tips[0]];
      const cx = pts.reduce((a, p) => a + p[0], 0) / 4, cy = pts.reduce((a, p) => a + p[1], 0) / 4;
      cs = pts.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
      let ar = 0; for (let i = 0; i < 4; i++) { const a = cs[i], b = cs[(i + 1) % 4]; ar += a[0] * b[1] - b[0] * a[1]; } ar = Math.abs(ar) / 2;
      if (ar > W * H * 0.015) { frame = true; area = lerp(area, ar / (W * H), 0.3); tilt = lerp(tilt, Math.atan2(R.palm[1] - L.palm[1], R.palm[0] - L.palm[0]), 0.3); }
    }
    if (frame) { corners = corners ? corners.map((c, i) => [lerp(c[0], cs[i][0], 0.55), lerp(c[1], cs[i][1], 0.55)]) : cs; }
    open = lerp(open, frame ? 1 : 0, frame ? 0.25 : 0.12);
    if (frame && !wasOpen) { whoosh(true); if (o('wechsel', 'auto') === 'auto') fxIdx = (fxIdx + 1) % FX.length; }
    if (!frame && wasOpen) whoosh(false);
    wasOpen = frame;
    const fxKey = o('wechsel', 'auto') === 'auto' ? FX[fxIdx][0] : o('wechsel', 'auto');
    const fx = Math.max(0, FX.findIndex(f => f[0] === fxKey));
    if (built) {
      const t = S.AC.currentTime;
      N.lp.frequency.setTargetAtTime(350 + Math.pow(open, 1.5) * (1500 + area * 30000), t, 0.06);
      N.rev.gain.setTargetAtTime(0.1 + area * 1.5, t, 0.1); N.dly.gain.setTargetAtTime(Math.abs(tilt) * 0.5 * open, t, 0.1);
    }
    spin += dt * (0.7 + S.kickV * 1.5);
    const gl = S.gl;
    if (gl) {
      if (!P) initGL();
      const d = S.dpr, rw = S.glc.width, rh = S.glc.height, [csx, csy] = S.cover();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, rw, rh); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      S.camTexture(0);
      const setCommon = u => { gl.uniform1i(u.uCam, 0); gl.uniform2f(u.uRes, rw, rh); gl.uniform2f(u.uCover, csx, csy); gl.uniform1i(u.uFx, fx); gl.uniform1f(u.uTime, now / 1000); gl.uniform1f(u.uKick, S.kickV); gl.uniform1f(u.uCamOn, S.camLive() ? 1 : 0); };
      gl.useProgram(P.bg.p); S.glQuad(); setCommon(P.bg.u); gl.uniform1f(P.bg.u.uOpen, open); gl.uniform2f(P.bg.u.uCenter, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (corners && open > 0.02) {
        const cx = corners.reduce((a, p) => a + p[0], 0) / 4, cy = corners.reduce((a, p) => a + p[1], 0) / 4;
        const sc = corners.map(p => [cx + (p[0] - cx) * open, cy + (p[1] - cy) * open]);
        const v = new Float32Array([...sc[0], ...sc[1], ...sc[2], ...sc[0], ...sc[2], ...sc[3]].map(x => x * d));
        gl.useProgram(P.portal.p); gl.bindVertexArray(quadVao); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, v);
        setCommon(P.portal.u); gl.uniform2f(P.portal.u.uRes2, rw, rh); gl.uniform2f(P.portal.u.uCenter, cx * d, (H - cy) * d);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        // Würfel
        if (o('wuerfel', 'an') === 'an') {
          gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT);
          const size = Math.sqrt(area * W * H) * 0.22 * open * d;
          const ay = spin, ax = spin * 0.6 + tilt * 0.8, cyA = Math.cos(ay), syA = Math.sin(ay), cxA = Math.cos(ax), sxA = Math.sin(ax);
          const rot = new Float32Array([cyA, sxA * syA, -cxA * syA, 0, cxA, sxA, syA, -sxA * cyA, cxA * cyA]);
          gl.useProgram(P.cube.p); gl.bindVertexArray(cubeVao);
          const u = P.cube.u; gl.uniformMatrix3fv(u.uRot, false, rot); gl.uniform2f(u.uC, cx * d, cy * d); gl.uniform2f(u.uRes2, rw, rh); gl.uniform1f(u.uSize, size);
          gl.uniform1i(u.uCam, 0); gl.uniform1f(u.uAspectCam, S.srcW / S.srcH); gl.uniform1f(u.uCamOn, S.camLive() ? 1 : 0); gl.uniform1f(u.uKick, S.kickV);
          gl.drawArrays(gl.TRIANGLES, 0, 36);
          gl.disable(gl.DEPTH_TEST);
        }
      }
      S.blitGL();
    } else S.drawCamera(ctx, 1);
    // Rahmenlinie + Ecken
    if (corners && open > 0.02) {
      const cx = corners.reduce((a, p) => a + p[0], 0) / 4, cy = corners.reduce((a, p) => a + p[1], 0) / 4;
      const sc = corners.map(p => [cx + (p[0] - cx) * open, cy + (p[1] - cy) * open]);
      ctx.save(); ctx.strokeStyle = `rgba(${M.color},${0.5 + S.kickV * 0.5})`; ctx.lineWidth = 2; ctx.shadowColor = `rgb(${M.color})`; ctx.shadowBlur = 12;
      ctx.beginPath(); sc.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    // Hände wie im Video: rote Punkte, grüne Linien
    for (const h of [L, R]) S.drawSkeleton(ctx, h, { line: 'rgba(80,255,90,.85)', dot: '#ff2a2a', lw: 1.6, tip: 4, joint: 3 });
    S.setSection(open > 0.5 ? FX[fx][1].toUpperCase() : 'RAHMEN FORMEN', open > 0.5 ? 'PORTAL ' + Math.round(area * 100) + '% · 119 BPM' : 'DAUMEN + ZEIGEFINGER, BEIDE HÄNDE');
  };
  M.enter = () => { if (!built) build(); N.out.gain.setTargetAtTime(1, S.AC.currentTime, 0.05); };
  M.exit = () => { if (built) N.out.gain.setTargetAtTime(0, S.AC.currentTime, 0.06); };
  M.matrix = [
    ['PORTAL', () => open, () => open > 0.5 ? 'OFFEN' : 'ZU'],
    ['GRÖSSE', () => clamp(area * 3), () => Math.round(area * 100) + '%'],
    ['NEIGUNG', () => clamp(Math.abs(tilt) / 0.8), () => Math.round(tilt * 57) + '°'],
    ['FILTER', () => Math.pow(open, 1.5), () => open > 0.5 ? 'AUF' : 'ZU'],
  ];
  M.gestures = [['Daumen + Zeigefinger beider Hände', 'Rahmen öffnet das Portal'], ['Rahmen größer ziehen', 'Musik öffnet sich, mehr Hall'],
    ['Rahmen neigen', 'Echo'], ['Rahmen neu öffnen', 'neuer Effekt (bei „Automatisch“)']];
  M.settings = [
    { key: 'wechsel', label: 'Effekt im Portal', def: 'auto', options: [['auto', 'Automatisch'], ...FX] },
    { key: 'wuerfel', label: '3D-Würfel', def: 'an', options: [['an', 'An'], ['aus', 'Aus']] },
  ];
  window.__portal = { get open() { return open; }, get area() { return area; } };
  S.register(M);
})();
