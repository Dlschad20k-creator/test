/* Welt 1: Techno – Rave 154, flüssiges Glas zwischen den Fingern, Punktwolke im TouchDesigner-Stil */
(() => {
  'use strict';
  const S = window.S, { clamp, lerp, mtof } = S;
  const ID = 'techno';
  const o = (k, d) => S.opt(ID, k, d);

  const CHORDS = [null,
    { name: 'Am', notes: [45, 57, 60, 64, 69], root: 33 },
    { name: 'F', notes: [41, 53, 57, 60, 65], root: 29 },
    { name: 'Dm', notes: [38, 50, 53, 57, 62], root: 38 },
    { name: 'B', notes: [46, 58, 62, 65, 70], root: 34 },
    { name: 'C', notes: [48, 55, 60, 64, 67], root: 36 }];
  const STYLES = {
    rave: { name: 'Rave 154', bpm: 154, kick: { f0: 260, f1: 47, tau: 0.045, len: 0.3, drive: 0.6, lvl: 1 }, rumble: 0.85, bass: [1, 2, 3], hats: 'hard', clap: 1, swing: 0 },
    hypno: { name: 'Hypno 132', bpm: 132, kick: { f0: 190, f1: 50, tau: 0.03, len: 0.22, drive: 0.3, lvl: 0.95 }, rumble: 0.5, bass: [2], hats: 'soft', clap: 0.5, swing: 0.05 },
  };
  const style = () => STYLES[o('style', 'rave')] || STYLES.rave;

  const M = {
    id: ID, name: 'Techno', color: [255, 46, 74],
    short: 'Rave 154 in A-Moll, flüssiges Glas zwischen den Fingern, dein Bild als 3D-Punktwolke.',
    hint: 'Rechts hoch/runter: Filter. Links Finger zeigen: Energie. Links Faust und öffnen: Drop.',
    bpm: () => style().bpm, swing: () => style().swing,
  };
  const DEF = { cutoff: 0.78, res: 0.2, drive: 0.25, space: 0.3, gate: 0, width: 0.4 };
  const P = { ...DEF, chord: 1, energy: 5 }, T = { ...DEF, chord: 1, energy: 5 };
  let energyNow = 5, pending = null, pendingBar = -1, vocalQ = 0;
  const N = {}; let built = false;

  // ---------------- Klang ----------------
  function build() {
    const AC = S.AC, A = S.A, G = S.G, F = S.F;
    N.out = G(0); N.out.connect(A.bus);
    N.drums = G(0.8); N.drums.connect(N.out);
    N.music = G(1);
    N.curves = [0, .12, .25, .38, .5, .62, .75, .88, 1].map(S.curve);
    N.drive = AC.createWaveShaper(); N.drive.curve = N.curves[1]; N.ci = 1;
    N.pre = G(1); N.post = G(1); N.lp = F('lowpass', 18000, 0.7); N.lp2 = F('lowpass', 18000, 0.5);
    N.gate = G(1); N.duck = G(1);
    N.music.connect(N.pre); N.pre.connect(N.drive); N.drive.connect(N.post); N.post.connect(N.lp); N.lp.connect(N.lp2);
    N.lp2.connect(N.gate); N.gate.connect(N.duck); N.duck.connect(N.out);
    N.rev = G(0.3); N.duck.connect(N.rev); N.rev.connect(A.revIn);
    N.dly = G(0.2); N.duck.connect(N.dly); N.dly.connect(A.dlyIn);
    // Rumble
    N.rumSend = G(0.7); N.rumRev = AC.createConvolver(); N.rumRev.buffer = S.ir(1.6, 2.2, 0.9);
    N.rumLP = F('lowpass', 150, 1.3); N.rumHP = F('highpass', 32);
    N.rumSat = AC.createWaveShaper(); N.rumSat.curve = S.curve(0.45);
    N.rumGain = G(0); N.rumOut = G(0.8);
    N.rumSend.connect(N.rumRev); N.rumRev.connect(N.rumLP); N.rumLP.connect(N.rumHP); N.rumHP.connect(N.rumSat); N.rumSat.connect(N.rumGain); N.rumGain.connect(N.rumOut); N.rumOut.connect(N.drums);
    // Akkordfläche
    N.padSum = G(1); N.padLP = F('lowpass', 1500, 0.8); N.padGain = G(0);
    N.padLfo = AC.createOscillator(); N.padLfo.frequency.value = 0.11; const la = G(500); N.padLfo.connect(la); la.connect(N.padLP.detune); N.padLfo.start();
    N.padSum.connect(N.padLP); N.padLP.connect(N.padGain); N.padGain.connect(N.music);
    N.voices = [];
    for (let n = 0; n < 5; n++) for (const [type, det, pn, lv] of [['sawtooth', -12, -0.7, 0.06], ['sawtooth', 11, 0.7, 0.06], ['triangle', 0, 0, 0.22]]) {
      const osc = AC.createOscillator(); osc.type = type; osc.detune.value = det + (Math.random() - .5) * 4;
      const p = S.pan(pn * (n === 0 ? 0.3 : 1)), g = G(lv * (n === 0 ? 1.2 : 1));
      osc.connect(g); g.connect(p); p.connect(N.padSum); osc.start(); N.voices.push({ osc, n });
    }
    N.sample = G(0.9); N.sample.connect(N.music);
    N.hatPan = 1;
    built = true;
    setChord(Math.round(P.chord), true);
  }
  function setChord(c, now) {
    if (!built) return;
    const ch = CHORDS[c], t = S.AC.currentTime;
    if (!ch || sample.buf) { N.padGain.gain.setTargetAtTime(0, t, 0.15); if (!ch) return; }
    for (const v of N.voices) v.osc.frequency.setTargetAtTime(mtof(ch.notes[v.n]), t, now ? 0.001 : 0.07);
    if (!sample.buf) N.padGain.gain.setTargetAtTime(1.1, t, 0.2);
  }
  function kick(t, vel) {
    const k = style().kick, AC = S.AC;
    const osc = AC.createOscillator(); osc.frequency.setValueAtTime(k.f0, t); osc.frequency.setTargetAtTime(k.f1, t + 0.002, k.tau);
    const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * k.lvl, t + 0.0025);
    g.gain.setTargetAtTime(vel * k.lvl * 0.78, t + 0.01, 0.1); g.gain.setTargetAtTime(0, t + k.len, 0.025);
    const sh = AC.createWaveShaper(); sh.curve = N.curves[Math.round(k.drive * 8)];
    const lp = S.F('lowpass', 5000, 0.5), out = S.G(0.95);
    osc.connect(g); g.connect(sh); sh.connect(lp); lp.connect(out); out.connect(N.drums);
    if (style().rumble && energyNow >= 2) out.connect(N.rumSend);
    osc.start(t); osc.stop(t + k.len + 0.2);
    S.noise(t, { type: 'bandpass', f: 3500, q: 0.8, dur: 0.008, gain: 0.3, dest: N.drums });
    S.kickTimes.push(t);
    const st = 60 / style().bpm / 4;
    N.duck.gain.cancelScheduledValues(t); N.duck.gain.setValueAtTime(1, t); N.duck.gain.linearRampToValueAtTime(0.42, t + 0.004); N.duck.gain.setTargetAtTime(1, t + 0.04, st * 0.55);
    const rl = energyNow >= 2 ? style().rumble : 0;
    N.rumGain.gain.cancelScheduledValues(t); N.rumGain.gain.setValueAtTime(0, t); N.rumGain.gain.linearRampToValueAtTime(rl, t + st * 1.3);
  }
  function bassNote(t, midi, vel) {
    const AC = S.AC, f = mtof(midi);
    const a = AC.createOscillator(); a.type = 'sawtooth'; const b = AC.createOscillator();
    for (const x of [a, b]) { x.frequency.setValueAtTime(f * 1.5, t); x.frequency.setTargetAtTime(f, t, 0.01); }
    const lp = S.F('lowpass', 1800, 3); lp.frequency.setValueAtTime(2200, t); lp.frequency.setTargetAtTime(260, t + 0.004, 0.035);
    const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.8, t + 0.003); g.gain.setTargetAtTime(0, t + 0.012, 0.05);
    const sh = AC.createWaveShaper(); sh.curve = N.curves[3];
    a.connect(lp); lp.connect(sh); const sg = S.G(0.9); b.connect(sg); sg.connect(sh); sh.connect(g); g.connect(N.music);
    a.start(t); b.start(t); a.stop(t + 0.3); b.stop(t + 0.3);
  }
  function clap(t, amt) {
    for (const d of [0, 0.01, 0.021]) S.noise(t + d, { type: 'bandpass', f: 1250, q: 1.2, dur: 0.018, gain: 0.3 * amt, dest: N.drums });
    S.noise(t + 0.028, { type: 'bandpass', f: 1100, q: 0.9, dur: 0.24, gain: 0.28 * amt, rev: 0.4, dest: N.drums });
  }

  M.step = (i, t, st, bar) => {
    if (!built) return;
    const s = style();
    if (i === 0 && pending !== null && bar >= pendingBar) { energyNow = pending; pending = null; if (energyNow > 0) S.impact(t, N.drums); }
    const e = energyNow, ch = CHORDS[Math.round(P.chord)] || CHORDS[1];
    if (e >= 1 && i % 4 === 0) kick(t, i === 0 ? 1 : 0.94);
    if (e >= 3) S.noise(t, { type: 'highpass', f: s.hats === 'hard' ? 7600 : 9000, dur: s.hats === 'hard' ? 0.045 : 0.03, gain: [0.5, 0.22, 0.75, 0.22][i % 4] * 0.24, p: (N.hatPan = -N.hatPan) * 0.35, dest: N.music });
    if (e >= 4 && i % 4 === 2) S.noise(t, { type: 'highpass', f: 6800, dur: 0.2, gain: 0.15, p: 0.15, rev: 0.1, dest: N.music });
    if (e >= 4 && (i === 4 || i === 12)) clap(t, s.clap);
    if (e >= 5 && (i === 7 || i === 15) && Math.random() < 0.7) S.noise(t, { type: 'bandpass', f: 500 + Math.random() * 1500, q: 7, dur: 0.07, gain: 0.2, p: Math.random() - .5, rev: 0.4, dest: N.music });
    if (e >= 3 && s.bass.includes(i % 4) && !sample.buf) bassNote(t, ch.root + (i === 15 ? 12 : 0), [0, 0.65, 1, 0.85][i % 4]);
    N.gate.gain.cancelScheduledValues(t);
    if (P.gate > 0.05) {
      const div = P.gate > 0.75 ? 4 : P.gate > 0.4 ? 2 : 1;
      for (let k = 0; k < div; k++) { const tk = t + k * st / div; N.gate.gain.setValueAtTime(1, tk); N.gate.gain.setValueAtTime(1 - Math.min(0.95, P.gate * 1.1), tk + st / div * 0.5); }
    } else N.gate.gain.setTargetAtTime(1, t, 0.01);
    if (vocalQ > 0) { vocalQ--; S.vocal(t, ch.notes[2 + (i % 3)] + 12, N.music); }
  };
  function requestEnergy(e) {
    if (e === energyNow && pending === null) return;
    if (energyNow === 0 && e > 0 && pending === null) {
      let left = S.nextBarSteps(), target = S.seq.bar + 1;
      if (left < 8) { left += 16; target++; }
      pending = e; pendingBar = target; S.riser(S.seq.next, left * 60 / style().bpm / 4, N.out);
    } else if (pending !== null) pending = e === 0 ? null : e;
    else energyNow = e;
  }

  // ---------------- Eigener Sound ----------------
  const sample = { buf: null, src: null,
    play() { if (!this.buf || !S.AC || !built) return; this.stop(); const s = S.AC.createBufferSource(); s.buffer = this.buf; s.loop = true; s.connect(N.sample); s.start(); this.src = s; },
    stop() { if (this.src) { try { this.src.stop(); } catch (e) {} this.src = null; } } };

  // ---------------- Bild ----------------
  const FEED_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uPrev; uniform float uDecay, uZoom, uRot, uAspect; uniform vec2 uCenter;
void main(){ vec2 p = vUv - uCenter; p.x *= uAspect; float c = cos(uRot), s = sin(uRot);
  p = mat2(c, -s, s, c) * p / uZoom; p.x /= uAspect;
  o = vec4(max(texture(uPrev, p + uCenter).rgb * uDecay - 0.004, 0.0), 1.0); }`;
  const CLOUD_VS = `#version 300 es
precision highp float; layout(location = 0) in vec2 aUv;
uniform sampler2D uCam, uSpec; uniform vec2 uRes, uCover; uniform float uCamOn, uTime, uKick, uBass, uHigh, uYaw, uPitch, uPt;
uniform vec3 uTips[10]; uniform int uTipN; out float vL; out float vNear;
float lumAt(vec2 uv){
  if (uCamOn > 0.5) { vec2 c = vec2(1.0 - (0.5 + (uv.x - 0.5) * uCover.x), 0.5 + (uv.y - 0.5) * uCover.y); return dot(texture(uCam, c).rgb, vec3(0.299, 0.587, 0.114)); }
  float r = length((uv - 0.5) * vec2(uRes.x / uRes.y, 1.0)); return 0.5 + 0.4 * sin(r * 22.0 - uTime * 2.2) * cos(uv.x * 7.0 + uTime * 0.4); }
void main(){
  float l = smoothstep(0.06, 0.9, lumAt(aUv));
  float sp = texture(uSpec, vec2(abs(aUv.x - 0.5) * 1.4 + 0.02, 0.5)).r;
  float aspect = uRes.x / uRes.y;
  vec3 p = vec3((aUv.x - 0.5) * aspect * 2.0, (0.5 - aUv.y) * 2.0, 0.0);
  p.z = l * 0.45 * (1.0 + uBass * 1.4) + sp * 0.35 * sin(aUv.y * 18.0 - uTime * 3.0) + uKick * 0.12;
  float cy = cos(uYaw), sy = sin(uYaw), cp = cos(uPitch), spt = sin(uPitch);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z); p = vec3(p.x, cp * p.y - spt * p.z, spt * p.y + cp * p.z);
  float persp = 2.6 / (2.6 - p.z);
  vec2 ndc = vec2(p.x / aspect, p.y) * persp * (1.0 + uKick * 0.03);
  vec2 sp2 = (ndc * 0.5 + 0.5) * uRes; sp2.y = uRes.y - sp2.y; float near = 0.0;
  for (int i = 0; i < 10; i++) { if (i >= uTipN) break; vec2 d = sp2 - uTips[i].xy; float r = uTips[i].z; float k = exp(-dot(d, d) / (r * r)); sp2 += normalize(d + 0.001) * k * r * 0.55; near = max(near, k); }
  gl_Position = vec4(sp2.x / uRes.x * 2.0 - 1.0, 1.0 - sp2.y / uRes.y * 2.0, 0.0, 1.0);
  gl_PointSize = uPt * (0.35 + l * 1.7) * persp * (1.0 + uKick * 0.5 + uHigh * 0.6);
  vL = l; vNear = near; }`;
  const CLOUD_FS = `#version 300 es
precision highp float; in float vL; in float vNear; out vec4 o; uniform vec3 uC1, uC2; uniform float uPoints, uAlpha;
void main(){ float a = 1.0; if (uPoints > 0.5) { vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard; a = exp(-r * 2.6); }
  o = vec4(mix(uC1, uC2, clamp(vL * 0.8 + vNear * 0.9, 0.0, 1.0)) * a * (0.18 + vL * 0.9 + vNear * 0.8) * uAlpha, 1.0); }`;
  const LINE_VS = `#version 300 es
precision highp float; layout(location = 0) in vec2 aP; uniform vec2 uRes;
void main(){ gl_Position = vec4(aP.x / uRes.x * 2.0 - 1.0, 1.0 - aP.y / uRes.y * 2.0, 0.0, 1.0); }`;
  const LINE_FS = `#version 300 es
precision highp float; out vec4 o; uniform vec3 uC; uniform float uA; void main(){ o = vec4(uC * uA, 1.0); }`;
  const COMP_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uCam; uniform vec2 uRes, uCover; uniform float uCamMix, uCamOn, uTime, uKick, uDpr, uGlass; uniform vec3 uC1;
uniform vec3 uBall[10]; uniform int uBallN; uniform vec4 uCaps[6]; uniform float uCapR[6]; uniform int uCapN; uniform float uK;
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdCap(vec2 p, vec2 a, vec2 b, float r){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0); return length(pa - ba * h) - r; }
float scene(vec2 p){ float d = 1e5;
  for (int i = 0; i < 10; i++) { if (i >= uBallN) break; d = smin(d, length(p - uBall[i].xy) - uBall[i].z, uK); }
  for (int i = 0; i < 6; i++) { if (i >= uCapN) break; if (uCapR[i] > 0.5) d = smin(d, sdCap(p, uCaps[i].xy, uCaps[i].zw, uCapR[i]), uK); }
  return d + sin(p.x * 0.018 / uDpr + uTime * 2.1) * sin(p.y * 0.021 / uDpr - uTime * 1.7) * (3.0 + uKick * 7.0) * uDpr; }
vec3 sceneCol(vec2 px){ vec2 uv = clamp(px / uRes, 0.001, 0.999); vec3 s = texture(uScene, vec2(uv.x, 1.0 - uv.y)).rgb;
  if (uCamOn > 0.5 && uCamMix > 0.0) { vec2 c = vec2(1.0 - (0.5 + (uv.x - 0.5) * uCover.x), 0.5 + (uv.y - 0.5) * uCover.y); vec3 cam = texture(uCam, c).rgb;
    s += mix(vec3(dot(cam, vec3(0.299, 0.587, 0.114))), cam, 0.35) * uC1 * uCamMix * 1.3; }
  return s; }
void main(){ vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); vec3 col = sceneCol(px);
  if (uGlass > 0.5 && uBallN > 0) {
    float d = scene(px); float sh = scene(px - vec2(0.0, 16.0 * uDpr)); col *= 1.0 - (1.0 - smoothstep(0.0, 50.0 * uDpr, sh)) * 0.35;
    if (d < 2.0) { float e = 1.5;
      vec2 g = vec2(scene(px + vec2(e, 0.0)) - scene(px - vec2(e, 0.0)), scene(px + vec2(0.0, e)) - scene(px - vec2(0.0, e))); vec2 n = length(g) > 1e-5 ? normalize(g) : vec2(0.0);
      float t = clamp(-d / (32.0 * uDpr), 0.0, 1.0), edge = 1.0 - t, slope = edge * edge; vec2 refr = px - n * slope * 52.0 * uDpr;
      vec3 acc = vec3(0.0); float rad = 9.0 * uDpr;
      for (int i = 0; i < 12; i++) { float fi = float(i), a = fi * 2.39996, r = rad * sqrt((fi + 0.5) / 12.0); vec2 off = vec2(cos(a), sin(a)) * r, ca = n * slope * 4.0 * uDpr;
        acc.r += sceneCol(refr + off + ca).r; acc.g += sceneCol(refr + off).g; acc.b += sceneCol(refr + off - ca).b; }
      vec3 gc = acc / 12.0; gc = mix(vec3(dot(gc, vec3(0.299, 0.587, 0.114))), gc, 1.4) * 1.1 + 0.05 + uC1 * 0.05;
      vec2 L = normalize(vec2(-0.6, -0.8)); float spec = pow(max(dot(n, L), 0.0), 2.0) * smoothstep(0.6, 0.0, t);
      float back = pow(max(dot(n, -L), 0.0), 2.0) * smoothstep(0.4, 0.0, t); float rim = 1.0 - smoothstep(0.0, 2.5 * uDpr, -d);
      gc += vec3(1.0) * (spec * 0.6 + rim * 0.4) + uC1 * back * 0.35 + uC1 * uKick * 0.12 * edge;
      col = mix(col, clamp(gc, 0.0, 1.2), 1.0 - smoothstep(-1.0, 1.0, d)); } }
  vec2 q = px / uRes - 0.5; col *= 1.0 - dot(q, q) * 0.9; o = vec4(col, 1.0); }`;

  const PG = {}; let glReady = false, cloudVao, cloudBuf, cloudIdx, cloudN = 0, cloudIdxN = 0, lineVao, lineBuf, specTex, fbo = [], rtW = 0, rtH = 0, ping = 0;
  function initGL() {
    const gl = S.gl; if (!gl) return;
    PG.feed = S.glProg(S.QUAD_VS, FEED_FS); PG.cloud = S.glProg(CLOUD_VS, CLOUD_FS); PG.line = S.glProg(LINE_VS, LINE_FS); PG.comp = S.glProg(S.QUAD_VS, COMP_FS);
    lineVao = gl.createVertexArray(); gl.bindVertexArray(lineVao);
    lineBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); gl.bufferData(gl.ARRAY_BUFFER, 4096 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    cloudVao = gl.createVertexArray(); cloudBuf = gl.createBuffer(); cloudIdx = gl.createBuffer(); gl.bindVertexArray(null);
    specTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, specTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(256));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    glReady = true; M.resize();
  }
  M.resize = () => {
    const gl = S.gl; if (!glReady) return;
    rtW = S.glc.width; rtH = S.glc.height;
    fbo.forEach(f => { gl.deleteTexture(f.t); gl.deleteFramebuffer(f.f); });
    fbo = [0, 1].map(() => { const t = S.glTex(rtW, rtH), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); return { t, f }; });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const W = S.W, H = S.H, stp = Math.max(5, Math.sqrt(W * H / 9000));
    const cols = Math.max(20, Math.round(W / stp)), rows = Math.max(20, Math.round(H / stp));
    const uv = new Float32Array(cols * rows * 2); let k = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { uv[k++] = (x + 0.5) / cols; uv[k++] = (y + 0.5) / rows; }
    cloudN = cols * rows;
    const idx = new Uint32Array(cols * rows * 2); let j = 0;
    for (let y = 0; y < rows; y += 2) for (let x = 0; x < cols - 1; x++) { idx[j++] = y * cols + x; idx[j++] = y * cols + x + 1; }
    cloudIdxN = j;
    gl.bindVertexArray(cloudVao); gl.bindBuffer(gl.ARRAY_BUFFER, cloudBuf); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cloudIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx.subarray(0, j), gl.STATIC_DRAW); gl.bindVertexArray(null);
  };

  const springs = {};
  const spring = (key, target, k = 0.22, d = 0.68) => { let s = springs[key]; if (!s) s = springs[key] = { v: target, vel: 0 }; s.vel += (target - s.v) * k; s.vel *= d; s.v += s.vel; return s.v; };
  let broken = false;
  function glassShape(hands) {
    const balls = [], caps = [], capR = [], m = Math.min(S.W, S.H), base = m * 0.045 * (1 + S.kickV * 0.18);
    for (const h of [hands.L, hands.R]) {
      if (!h) continue; const it = h.pts[8], th = h.pts[4];
      balls.push([it[0], it[1], spring(h.side + 'a', base)], [th[0], th[1], spring(h.side + 'b', base * 0.8)]);
      caps.push([it[0], it[1], th[0], th[1]]); capR.push(spring(h.side + 'c', clamp(base * 1.5 - S.dist2(it, th) * 0.55, 0, base * 1.2)));
    }
    if (hands.L && hands.R) {
      const a = hands.L.pts[8], b = hands.R.pts[8], a2 = hands.L.pts[4], b2 = hands.R.pts[4], len = S.dist2(a, b);
      if (!broken && len > m * 1.05) broken = true; if (broken && len < m * 0.8) broken = false;
      const rr = broken ? 0 : Math.min(base * 1.1, base * base * 14 / Math.max(len, 1)) * clamp((m * 1.05 - len) / (m * 0.6), 0.25, 1);
      caps.push([a[0], a[1], b[0], b[1]]); capR.push(spring('br', rr, 0.15, 0.7));
      caps.push([a2[0], a2[1], b2[0], b2[1]]); capR.push(spring('br2', rr * 0.8, 0.15, 0.7));
    }
    return { balls, caps, capR };
  }

  let yaw = 0, pitch = 0, lastPinchL = false, clapArmed = true, lastClap = 0;
  const scope = new Float32Array(4096);
  M.frame = (now, dt) => {
    const hands = S.currentHands(), L = hands.L, R = hands.R;
    // Steuerung
    if (S.usingCamera()) {
      if (R) { T.cutoff = clamp(1 - (R.palm[1] / S.H - 0.12) / 0.66); T.res = clamp(1 - R.pinch) * 0.9; T.drive = clamp((Math.abs(R.ang) - 0.15) / 0.9); T.chord = R.fingers; }
      if (L) { T.space = clamp(1 - (L.palm[1] / S.H - 0.12) / 0.66); T.gate = clamp((Math.abs(L.ang) - 0.35) / 0.8); T.energy = L.fingers;
        if (L.pinched && !lastPinchL) vocalQ++; lastPinchL = L.pinched; } else lastPinchL = false;
      if (L && R) { const d = S.dist2(L.palm, R.palm); T.width = clamp(d / Math.min(S.W, S.H) - 0.15);
        if (d / ((L.size + R.size) / 2) < 1.6 && clapArmed && now - lastClap > 1200) { if (built) S.impact(0, N.drums); lastClap = now; clapArmed = false; }
        if (d / ((L.size + R.size) / 2) > 2.8) clapArmed = true; }
      if (!R) { T.cutoff = lerp(T.cutoff, DEF.cutoff, 0.02); T.res = lerp(T.res, DEF.res, 0.02); }
      if (!L) { T.space = lerp(T.space, DEF.space, 0.02); T.gate = lerp(T.gate, 0, 0.08); }
    } else {
      T.chord = o('chord', 1); T.energy = o('energy', 5);
      if (R) { T.cutoff = clamp(1 - R.palm[1] / S.H); T.res = clamp(R.palm[0] / S.W * 1.5 - 0.5) * 0.8; }
      if (L) { T.space = clamp(1 - L.palm[1] / S.H); T.gate = clamp((0.22 - L.palm[0] / S.W) / 0.2); } else T.gate = lerp(T.gate, 0, 0.1);
    }
    for (const k of ['cutoff', 'res', 'drive', 'space', 'gate', 'width']) P[k] = lerp(P[k], T[k], 0.22);
    if (T.chord !== P.chord) { P.chord = T.chord; setChord(Math.round(P.chord)); }
    if (T.energy !== P.energy) { P.energy = T.energy; requestEnergy(Math.round(P.energy)); }
    if (built) {
      const t = S.AC.currentTime, cut = 90 * Math.pow(2, P.cutoff * 7.7);
      N.lp.frequency.setTargetAtTime(cut, t, 0.03); N.lp2.frequency.setTargetAtTime(Math.min(20000, cut * 1.4), t, 0.03); N.lp.Q.setTargetAtTime(0.7 + P.res * 14, t, 0.03);
      const ci = Math.round(P.drive * 8); if (ci !== N.ci) { N.drive.curve = N.curves[ci]; N.ci = ci; }
      N.pre.gain.setTargetAtTime(1 + P.drive * 1.5, t, 0.03); N.post.gain.setTargetAtTime(1 / (1 + P.drive * 1.6), t, 0.03);
      N.rev.gain.setTargetAtTime(0.1 + P.space * 0.75, t, 0.05); N.dly.gain.setTargetAtTime(P.space * 0.55, t, 0.05);
    }
    // Bild
    if (glReady) drawGL(now, hands);
    else { S.ctx.fillStyle = '#000'; S.ctx.fillRect(0, 0, S.W, S.H); }
    const ctx = S.ctx, acc = `rgb(${M.color})`;
    for (const h of [L, R]) {
      if (!h) continue;
      const lines = h.side === 'R' ? [CHORDS[Math.round(P.chord)] ? CHORDS[Math.round(P.chord)].name : 'FLÄCHE AUS', 'FILTER ' + cutLabel()]
        : [pending !== null ? 'BUILD …' : energyNow === 0 ? 'BREAK' : 'ENERGIE ' + energyNow, 'RAUM ' + Math.round(P.space * 100) + '%' + (P.gate > 0.05 ? ' · CUT' : '')];
      S.pill(ctx, h.side === 'R' ? h.palm[0] + h.size * 1.2 : h.palm[0] - h.size * 1.2 - 130, h.palm[1] - 20, lines, acc);
    }
    S.setSection(pending !== null ? 'BUILD' : energyNow === 0 ? 'BREAK' : energyNow >= 4 ? 'DROP' : 'GROOVE',
      (sample.buf ? 'DEIN SOUND' : CHORDS[Math.round(P.chord)] ? CHORDS[Math.round(P.chord)].name.toUpperCase() : 'FLÄCHE AUS') + ' · ' + style().bpm + ' BPM');
  };
  const cutLabel = () => { const f = 90 * Math.pow(2, P.cutoff * 7.7); return f >= 1000 ? (f / 1000).toFixed(1) + 'k' : Math.round(f) + ''; };
  const COLORS = { rot: [[255, 46, 74], [255, 190, 170]], gruen: [[57, 255, 106], [210, 255, 220]], eis: [[90, 200, 255], [220, 245, 255]], lila: [[176, 92, 255], [255, 200, 255]] };

  function drawGL(now, hands) {
    const gl = S.gl, time = now / 1000, W = S.W, H = S.H, L = hands.L, R = hands.R;
    const [c1, c2] = COLORS[o('farbe', 'rot')] || COLORS.rot;
    S.camTexture(1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, specTex);
    if (S.AC) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RED, gl.UNSIGNED_BYTE, S.A.freq.subarray(0, 256));
    const src = fbo[ping], dst = fbo[1 - ping];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, rtW, rtH); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    let cx = 0.5, cy = 0.5, rot = 0;
    if (L && R) { cx = (L.palm[0] + R.palm[0]) / 2 / W; cy = 1 - (L.palm[1] + R.palm[1]) / 2 / H; rot = (R.ang + L.ang) * 0.004; }
    gl.useProgram(PG.feed.p); S.glQuad();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t);
    const fu = PG.feed.u; gl.uniform1i(fu.uPrev, 0); gl.uniform1f(fu.uDecay, lerp(0.55, 0.94, o('trail', 60) / 100));
    gl.uniform1f(fu.uZoom, 1.003 + S.bass * 0.012 + S.kickV * 0.01); gl.uniform1f(fu.uRot, rot + Math.sin(time * 0.2) * 0.0015);
    gl.uniform1f(fu.uAspect, W / H); gl.uniform2f(fu.uCenter, cx, cy); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const vis = o('bild', 'punkte'), camLive = S.camLive();
    if (vis !== 'oszi') {
      const u = PG.cloud.u; gl.useProgram(PG.cloud.p); const [sx, sy] = S.cover();
      gl.uniform1i(u.uCam, 1); gl.uniform1i(u.uSpec, 2); gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uCover, sx, sy);
      gl.uniform1f(u.uCamOn, camLive ? 1 : 0); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uKick, S.kickV); gl.uniform1f(u.uBass, S.bass); gl.uniform1f(u.uHigh, S.high);
      const ty = (L && R) ? ((L.palm[0] + R.palm[0]) / 2 / W - 0.5) * 1.1 : Math.sin(time * 0.15) * 0.25;
      const tp = (L && R) ? ((L.palm[1] + R.palm[1]) / 2 / H - 0.5) * 0.9 : -0.18 + Math.sin(time * 0.11) * 0.08;
      yaw = lerp(yaw, ty, 0.06); pitch = lerp(pitch, tp, 0.06); gl.uniform1f(u.uYaw, yaw); gl.uniform1f(u.uPitch, pitch);
      gl.uniform1f(u.uPt, (vis === 'punkte' ? Math.max(2.2, Math.sqrt(W * H / 9000) * 0.55) : 1) * S.dpr);
      const tips = []; for (const h of [L, R]) if (h) for (const t of h.tips) tips.push(t[0], t[1], Math.min(W, H) * 0.07);
      const tipN = tips.length / 3; while (tips.length < 30) tips.push(-9999, -9999, 1);
      gl.uniform3fv(u.uTips, new Float32Array(tips)); gl.uniform1i(u.uTipN, tipN);
      gl.uniform3f(u.uC1, c1[0] / 255, c1[1] / 255, c1[2] / 255); gl.uniform3f(u.uC2, c2[0] / 255, c2[1] / 255, c2[2] / 255);
      gl.bindVertexArray(cloudVao);
      if (vis === 'punkte') { gl.uniform1f(u.uPoints, 1); gl.uniform1f(u.uAlpha, 0.55); gl.drawArrays(gl.POINTS, 0, cloudN); }
      else { gl.uniform1f(u.uPoints, 0); gl.uniform1f(u.uAlpha, 0.7); gl.drawElements(gl.LINES, cloudIdxN, gl.UNSIGNED_INT, 0); }
    }
    gl.useProgram(PG.line.p); gl.bindVertexArray(lineVao); gl.uniform2f(PG.line.u.uRes, W, H); gl.uniform3f(PG.line.u.uC, c2[0] / 255, c2[1] / 255, c2[2] / 255);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    if (S.AC) {
      let sx = W / 2, sy = H * 0.5, sc = Math.min(W, H) * (vis === 'oszi' ? 0.6 : 0.32), ang = 0;
      if (L && R) { sx = (L.palm[0] + R.palm[0]) / 2; sy = (L.palm[1] + R.palm[1]) / 2; sc = S.dist2(L.palm, R.palm) * 0.5 + Math.min(W, H) * 0.1; ang = Math.atan2(R.palm[1] - L.palm[1], R.palm[0] - L.palm[0]); }
      const ca = Math.cos(ang), sa = Math.sin(ang), bl = S.A.bufL, br = S.A.bufR;
      for (let i = 0; i < 2048; i++) { const mid = (bl[i] + br[i]) * 0.5, side = (bl[i] - br[i]) * 0.5, x = side * 2.4 * sc, y = -mid * sc * 0.9; scope[i * 2] = sx + x * ca - y * sa; scope[i * 2 + 1] = sy + x * sa + y * ca; }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, scope); gl.uniform1f(PG.line.u.uA, vis === 'oszi' ? 0.55 : 0.22); gl.drawArrays(gl.LINE_STRIP, 0, 2048);
    }
    if (S.settings.skel !== 'aus') {
      const sk = []; for (const h of [L, R]) if (h && !h.touch) for (const [a, b] of S.BONES) sk.push(h.pts[a][0], h.pts[a][1], h.pts[b][0], h.pts[b][1]);
      if (sk.length) { gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(sk)); gl.uniform1f(PG.line.u.uA, 0.35); gl.drawArrays(gl.LINES, 0, sk.length / 2); }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, S.glc.width, S.glc.height); gl.disable(gl.BLEND);
    const u = PG.comp.u; gl.useProgram(PG.comp.p); S.glQuad();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dst.t); gl.uniform1i(u.uScene, 0); gl.uniform1i(u.uCam, 1);
    gl.uniform2f(u.uRes, S.glc.width, S.glc.height); const [csx, csy] = S.cover(); gl.uniform2f(u.uCover, csx, csy);
    const cm = o('kamera', 'dunkel'); gl.uniform1f(u.uCamMix, cm === 'aus' ? 0 : cm === 'hell' ? 0.55 : 0.18);
    gl.uniform1f(u.uCamOn, camLive ? 1 : 0); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uKick, S.kickV); gl.uniform1f(u.uDpr, S.dpr);
    gl.uniform1f(u.uGlass, o('glas', 'an') === 'an' ? 1 : 0); gl.uniform3f(u.uC1, c1[0] / 255, c1[1] / 255, c1[2] / 255);
    const gs = glassShape(hands), d = S.dpr;
    const balls = new Float32Array(30), caps = new Float32Array(24), capR = new Float32Array(6);
    gs.balls.slice(0, 10).forEach((b, i) => { balls[i * 3] = b[0] * d; balls[i * 3 + 1] = b[1] * d; balls[i * 3 + 2] = b[2] * d; });
    gs.caps.slice(0, 6).forEach((c, i) => { caps.set([c[0] * d, c[1] * d, c[2] * d, c[3] * d], i * 4); capR[i] = gs.capR[i] * d; });
    gl.uniform3fv(u.uBall, balls); gl.uniform1i(u.uBallN, Math.min(10, gs.balls.length));
    gl.uniform4fv(u.uCaps, caps); gl.uniform1fv(u.uCapR, capR); gl.uniform1i(u.uCapN, Math.min(6, gs.caps.length)); gl.uniform1f(u.uK, Math.min(W, H) * 0.06 * d);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ping = 1 - ping;
    S.blitGL();
  }

  M.enter = () => {
    if (!built) build();
    if (!glReady && S.gl) { try { initGL(); } catch (e) { console.error('techno GL', e); } }
    N.out.gain.setTargetAtTime(1, S.AC.currentTime, 0.05);
    energyNow = S.usingCamera() ? 5 : o('energy', 5); pending = null; P.energy = T.energy = energyNow;
    setChord(Math.round(P.chord), true);
    if (sample.buf && S.playing) sample.play();
  };
  M.exit = () => { if (built) { N.out.gain.setTargetAtTime(0, S.AC.currentTime, 0.06); N.rumGain.gain.setTargetAtTime(0, S.AC.currentTime, 0.05); } sample.stop(); };
  M.onPlay = on => { if (on) sample.play(); else sample.stop(); };
  M.onSetting = (k, v) => { if (k === 'style') S.setDelay(60 / style().bpm / 4 * 3); if (k === 'chord' && !S.usingCamera()) T.chord = v; };

  M.matrix = [
    ['R FILTER', () => P.cutoff, () => cutLabel() + 'Hz'],
    ['R RESONANZ', () => P.res, () => Math.round(P.res * 100) + '%'],
    ['R AKKORD', () => P.chord / 5, () => CHORDS[Math.round(P.chord)] ? CHORDS[Math.round(P.chord)].name : 'AUS'],
    ['R DRIVE', () => P.drive, () => Math.round(P.drive * 100) + '%', 'opt'],
    ['L ENERGIE', () => energyNow / 5, () => pending !== null ? 'BUILD' : energyNow + '/5'],
    ['L RAUM', () => P.space, () => Math.round(P.space * 100) + '%'],
    ['L ZERHACK', () => P.gate, () => P.gate < 0.05 ? 'AUS' : P.gate > 0.75 ? '1/64' : P.gate > 0.4 ? '1/32' : '1/16'],
    ['↔ BREITE', () => P.width, () => Math.round(P.width * 100) + '%', 'opt'],
  ];
  M.gestures = [
    ['R Höhe', 'Filter: unten dumpf, oben offen'], ['R Daumen–Zeige', 'Resonanz'], ['R Finger 1–5', 'Akkord: Am, F, Dm, B, C (Faust = Fläche aus)'],
    ['R Drehung', 'Verzerrung'], ['L Finger 0–5', 'Energie: 0 Break … 5 alles'], ['Faust → offen', 'Riser, Drop auf dem nächsten Takt'],
    ['L Höhe', 'Raum'], ['L Daumen an Zeige', 'Vocal-Chop'], ['L Drehung', 'Zerhacken'], ['Klatschen', 'Impact'],
  ];
  M.settings = [
    { key: 'style', label: 'Sound-Stil', def: 'rave', options: [['rave', 'Rave 154'], ['hypno', 'Hypno 132']] },
    { key: 'bild', label: 'Bild', def: 'punkte', options: [['punkte', 'Punktwolke'], ['linien', 'Linien'], ['oszi', 'Oszilloskop']] },
    { key: 'glas', label: 'Flüssiges Glas', def: 'an', options: [['an', 'An'], ['aus', 'Aus']] },
    { key: 'farbe', label: 'Farbe', def: 'rot', options: [['rot', 'Rot'], ['gruen', 'Grün'], ['eis', 'Eisblau'], ['lila', 'Lila']] },
    { key: 'kamera', label: 'Kamerabild dahinter', def: 'dunkel', options: [['aus', 'Aus'], ['dunkel', 'Dunkel'], ['hell', 'Hell']] },
    { key: 'trail', label: 'Nachleuchten', def: 60, range: [0, 100] },
    { key: 'chord', label: 'Ohne Kamera: Akkord', def: 1, options: CHORDS.map((c, i) => [i, c ? c.name : 'Aus']) },
    { key: 'energy', label: 'Ohne Kamera: Energie', def: 5, options: [0, 1, 2, 3, 4, 5].map(n => [n, n === 0 ? 'Break' : String(n)]) },
    { type: 'file', label: 'Eigener Sound', accept: 'audio/*,video/*', text: 'Song oder Video vom Handy laden. Er läuft im Loop durch Filter, Raum und Zerhacken. Die Datei bleibt auf deinem Gerät.',
      onFile: async (file, p) => {
        p.textContent = 'Lade …';
        try { const data = await file.arrayBuffer(); sample.buf = await new Promise((res, rej) => { const pr = S.AC.decodeAudioData(data, res, rej); if (pr && pr.then) pr.then(res, rej); });
          if (S.playing) sample.play(); setChord(Math.round(P.chord)); p.textContent = '„' + file.name + '“ läuft. Linke Faust = ohne Drums.'; }
        catch (e) { p.textContent = 'Diese Datei kann der Browser nicht lesen. Versuch MP3, M4A, WAV oder MP4.'; } } },
  ];
  window.__techno = { P, T, get energy() { return energyNow; }, get pending() { return pending; } };
  S.register(M);
})();
