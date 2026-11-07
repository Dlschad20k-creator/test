/* Welt 6: Gesicht & Körper – Mimik wird zu Emotion, Emotion wird zu Musik; Körperbewegung steuert die Energie */
(() => {
  'use strict';
  const S = window.S, { clamp, lerp, mtof } = S;
  const ID = 'gesicht';
  const o = (k, d) => S.opt(ID, k, d);
  const FACE_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  const POSE_URL = { hoch: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
    schnell: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' };

  // ---------------- Emotionen ----------------
  const EMO = [
    { id: 'neutral', name: 'RUHIG', color: [150, 200, 255] },
    { id: 'freude', name: 'FREUDE', color: [255, 205, 60] },
    { id: 'trauer', name: 'TRAURIG', color: [90, 135, 255] },
    { id: 'wut', name: 'WUT', color: [255, 60, 45] },
    { id: 'ueber', name: 'ÜBERRASCHT', color: [255, 110, 240] },
    { id: 'angst', name: 'ANGST', color: [90, 240, 190] },
    { id: 'ekel', name: 'EKEL', color: [165, 220, 50] },
  ];
  const EMOMAP = Object.fromEntries(EMO.map(e => [e.id, e]));
  // Musik je Stimmung: Tempo, Akkorde (MIDI), Schlagzeug, Melodie
  const MOOD = {
    neutral: { bpm: 92, swing: 0.04, drums: 'soft', lead: 'bell', padLP: 1500, key: 'D-Dur',
      chords: [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]] },
    freude: { bpm: 118, swing: 0.02, drums: 'pop', lead: 'pluck', padLP: 3200, key: 'C-Dur',
      chords: [[48, 55, 60, 64, 67], [43, 50, 55, 59, 62], [45, 52, 57, 60, 64], [41, 48, 53, 57, 60]] },
    trauer: { bpm: 70, swing: 0, drums: 'none', lead: 'piano', padLP: 950, key: 'A-Moll',
      chords: [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [48, 55, 60, 64, 67], [40, 47, 52, 55, 59]] },
    wut: { bpm: 138, swing: 0, drums: 'hard', lead: 'none', padLP: 700, key: 'E-Phrygisch',
      chords: [[40, 47, 52, 47, 52], [41, 48, 53, 48, 53], [40, 47, 52, 47, 52], [38, 45, 50, 45, 50]] },
    ueber: { bpm: 124, swing: 0, drums: 'glitch', lead: 'sparkle', padLP: 4200, key: 'C-Lydisch',
      chords: [[48, 55, 59, 64, 66], [50, 57, 61, 66, 68], [52, 59, 63, 68, 70], [50, 57, 61, 66, 68]] },
    angst: { bpm: 64, swing: 0, drums: 'heart', lead: 'tremolo', padLP: 1200, key: 'Cluster',
      chords: [[45, 46, 52, 53, 58], [44, 45, 51, 52, 57], [45, 46, 52, 53, 58], [43, 44, 50, 51, 56]] },
    ekel: { bpm: 100, swing: 0.08, drums: 'wobble', lead: 'none', padLP: 800, key: 'schief',
      chords: [[43, 49, 55, 56, 62], [42, 48, 54, 55, 61], [43, 49, 55, 56, 62], [44, 50, 56, 57, 63]] },
  };

  let curMood = 'neutral', bpmNow = 92;
  const M = {
    id: ID, name: 'Gesicht & Körper', color: [150, 200, 255], noHands: true,
    short: 'Die Kamera liest deine Mimik und deinen Körper. Freude, Trauer, Wut, Überraschung, Angst oder Ekel: Die Musik wechselt mit deiner Stimmung.',
    hint: 'Schau in die Kamera, Gesicht gut beleuchtet. Die ersten 2 Sekunden neutral schauen, dann lernt die Erkennung dein Gesicht.',
    bpm: () => bpmNow, swing: () => MOOD[curMood].swing,
  };

  // ---------------- Erkennung ----------------
  let faceLM = null, poseLM = null, loading = false, loadedPose = null, gen = 0, detCost = 25, lastDet = 0, flip = 0, faceHz = 0, hzN = 0, hzT = 0;
  let TESS = null, CONTOURS = [], IRIS = [], POSE_CON = null;
  const face = { pts: null, seen: 0, bs: {}, raw: {}, yaw: 0, pitch: 0, roll: 0 };
  const body = { pts: null, vis: null, prev: null, prevT: 0, seen: 0, motion: 0, armsUp: false, lean: 0, span: 0, trails: [[], []] };
  let base = null, calib = null;   // neutrales Gesicht des Nutzers

  // Rechenweg: erst Grafikchip; ist er auf diesem Gerät zu langsam, automatisch Prozessor
  let delegate = /[?&]cpu/.test(location.search) ? 'CPU' : 'GPU', slowSince = 0;
  const mkFor = files => async (cls, path, extra) => {
    try { return await cls.createFromOptions(files, { baseOptions: { modelAssetPath: path, delegate }, runningMode: 'VIDEO', ...extra }); }
    catch (e) { delegate = 'CPU'; return await cls.createFromOptions(files, { baseOptions: { modelAssetPath: path, delegate: 'CPU' }, runningMode: 'VIDEO', ...extra }); }
  };
  async function switchToCPU() {
    if (delegate === 'CPU' || loading) return;
    delegate = 'CPU'; S.toast('Erkennung läuft jetzt über den Prozessor (schneller auf diesem Gerät).', 3000);
    const old = [faceLM, poseLM]; faceLM = null; poseLM = null; loadedPose = null; loading = false;
    old.forEach(x => { try { x && x.close(); } catch (e) {} });
    await loadModels(); detCost = 25;
  }
  async function loadModels() {
    if (loading) return; loading = true;
    try {
      S.toast('Lade Gesichtserkennung …', 8000);
      const { vision, files } = await S.loadVision();
      const mk = mkFor(files);
      faceLM = await mk(vision.FaceLandmarker, FACE_URL, { numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      const FL = vision.FaceLandmarker;
      TESS = FL.FACE_LANDMARKS_TESSELATION;
      CONTOURS = [FL.FACE_LANDMARKS_LIPS, FL.FACE_LANDMARKS_LEFT_EYE, FL.FACE_LANDMARKS_RIGHT_EYE, FL.FACE_LANDMARKS_LEFT_EYEBROW, FL.FACE_LANDMARKS_RIGHT_EYEBROW, FL.FACE_LANDMARKS_FACE_OVAL].filter(Boolean);
      IRIS = [FL.FACE_LANDMARKS_LEFT_IRIS, FL.FACE_LANDMARKS_RIGHT_IRIS].filter(Boolean);
      POSE_CON = vision.PoseLandmarker.POSE_CONNECTIONS;
      await loadPose(vision, files, mk);
      S.toast('Bereit. Schau 2 Sekunden neutral in die Kamera.', 3500);
    } catch (e) { console.error(e); S.toast('Gesichtserkennung ließ sich nicht laden.', 4000); }
    loading = false;
  }
  async function loadPose(vision, files, mk) {
    const want = o('koerper', 'an') === 'an' ? o('genau', matchMedia('(pointer: coarse)').matches ? 'schnell' : 'hoch') : null;
    if (want === loadedPose) return;
    if (poseLM) { try { poseLM.close(); } catch (e) {} poseLM = null; }
    loadedPose = want;
    if (!want) return;
    if (!vision) ({ vision, files } = await S.loadVision());
    if (!mk) mk = mkFor(files);
    poseLM = await mk(vision.PoseLandmarker, POSE_URL[want], { numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  }
  function startLoop() {
    const my = ++gen, v = S.video;
    let lastVT = -1;
    const tick = () => {
      if (my !== gen) return;
      if (S.camLive() && faceLM && v.currentTime !== lastVT) { lastVT = v.currentTime; detect(); }
      if (v.requestVideoFrameCallback && S.camLive()) v.requestVideoFrameCallback(tick); else requestAnimationFrame(tick);
    };
    tick();
  }
  function detect() {
    const now = performance.now();
    if (now - lastDet < detCost * 1.2 - 6) return;
    lastDet = now; const t0 = now; flip ^= 1;
    try {
      processFace(faceLM.detectForVideo(S.video, now), now);
      if (poseLM && (flip || detCost < 16)) processPose(poseLM.detectForVideo(S.video, now), now);
    } catch (e) { /* ein Bild auslassen */ }
    detCost = detCost * 0.85 + (performance.now() - t0) * 0.15;
    if (delegate === 'GPU' && detCost > 140) { if (!slowSince) slowSince = now; else if (now - slowSince > 2500) switchToCPU(); } else slowSince = 0;
    hzN++; if (now - hzT > 1000) { faceHz = hzN * 1000 / (now - hzT); hzN = 0; hzT = now; }
  }

  function processFace(r, now) {
    if (!r || !r.faceLandmarks || !r.faceLandmarks.length) { if (now - face.seen > 400) face.pts = null; return; }
    const lm = r.faceLandmarks[0];
    const pts = lm.map(p => S.camToScreen(p.x, p.y));
    if (face.pts && face.pts.length === pts.length && now - face.seen < 300) {
      // ruhige Punkte: langsame Bewegung stark glätten, schnelle direkt durchlassen
      let mv = 0; for (let i = 0; i < pts.length; i += 12) mv += S.dist2(pts[i], face.pts[i]); mv /= pts.length / 12;
      const a = clamp(0.35 + mv / 25, 0.35, 0.9);
      for (let i = 0; i < pts.length; i++) { face.pts[i][0] = lerp(face.pts[i][0], pts[i][0], a); face.pts[i][1] = lerp(face.pts[i][1], pts[i][1], a); }
    } else face.pts = pts;
    face.seen = now;
    const cats = r.faceBlendshapes && r.faceBlendshapes[0] ? r.faceBlendshapes[0].categories : [];
    for (const c of cats) { face.raw[c.categoryName] = c.score; face.bs[c.categoryName] = lerp(face.bs[c.categoryName] || 0, c.score, 0.5); }
    const mt = r.facialTransformationMatrixes && r.facialTransformationMatrixes[0] ? r.facialTransformationMatrixes[0].data : null;
    if (mt) {
      face.pitch = lerp(face.pitch, Math.atan2(mt[6], mt[10]), 0.4);
      face.yaw = lerp(face.yaw, Math.asin(clamp(-mt[2], -1, 1)), 0.4);
      face.roll = lerp(face.roll, Math.atan2(mt[1], mt[0]), 0.4);
    }
    // Kalibrierung: neutrales Gesicht sammeln
    if (calib) {
      if (!calib.t0) calib.t0 = now;
      for (const c of cats) calib.sum[c.categoryName] = (calib.sum[c.categoryName] || 0) + c.score;
      calib.n++;
      if (now - calib.t0 > 2000 && calib.n > 10) {
        base = {}; for (const k in calib.sum) base[k] = calib.sum[k] / calib.n;
        calib = null; S.toast('Dein neutrales Gesicht ist gespeichert. Jetzt zeig Gefühle!', 3000);
        try { localStorage.setItem('handstudio-face-base', JSON.stringify(base)); } catch (e) {}
      }
    } else if (!base) calib = { sum: {}, n: 0, t0: 0 };
  }

  function processPose(r, now) {
    if (!r || !r.landmarks || !r.landmarks.length) { if (now - body.seen > 500) body.pts = null; return; }
    const lm = r.landmarks[0];
    const pts = lm.map(p => S.camToScreen(p.x, p.y)), vis = lm.map(p => p.visibility == null ? 1 : p.visibility);
    if (body.pts && now - body.seen < 400) for (let i = 0; i < 33; i++) { body.pts[i][0] = lerp(body.pts[i][0], pts[i][0], 0.6); body.pts[i][1] = lerp(body.pts[i][1], pts[i][1], 0.6); }
    else body.pts = pts;
    body.vis = vis;
    const sw = S.dist2(body.pts[11], body.pts[12]) || 80;
    // Bewegungsenergie: wie schnell sich Schultern, Arme, Hüfte, Beine bewegen (in Schulterbreiten pro Sekunde)
    if (body.prev) {
      const dt = Math.max(0.016, (now - body.prevT) / 1000); let sp = 0, n = 0;
      for (const k of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26]) { if (vis[k] < 0.5) continue; sp += S.dist2(body.pts[k], body.prev[k]) / dt / sw; n++; }
      if (n) body.motion = lerp(body.motion, clamp(sp / n / 3.2), 0.25);
    }
    body.prev = body.pts.map(p => p.slice()); body.prevT = now; body.seen = now;
    const nose = body.pts[0];
    body.armsUp = vis[15] > 0.5 && vis[16] > 0.5 && body.pts[15][1] < nose[1] && body.pts[16][1] < nose[1];
    const shC = (body.pts[11][0] + body.pts[12][0]) / 2, hipOk = vis[23] > 0.5 && vis[24] > 0.5;
    body.lean = hipOk ? clamp((shC - (body.pts[23][0] + body.pts[24][0]) / 2) / sw, -1, 1) : clamp((shC - S.W / 2) / (S.W / 2), -1, 1);
    body.span = clamp(S.dist2(body.pts[15], body.pts[16]) / sw / 4);
    for (const [k, tr] of [[15, body.trails[0]], [16, body.trails[1]]]) { if (vis[k] > 0.5) { tr.push(body.pts[k].slice()); if (tr.length > 26) tr.shift(); } }
  }

  // ---------------- Mimik → Emotion ----------------
  const feat = {};
  const probs = Object.fromEntries(EMO.map(e => [e.id, e.id === 'neutral' ? 1 : 0]));
  let mood = 'neutral', cand = null, candSince = 0, moodSince = 0, intensity = 0;
  // Reine Berechnung: Mimik-Werte (52 Blendshapes) → Merkmale + Punktzahl je Emotion
  function score(B, baseMap, sens, f) {
    const F = n => { const raw = B[n] || 0, b = baseMap ? (baseMap[n] || 0) : 0; return clamp((raw - b) / Math.max(0.3, 1 - b) * sens); };
    const A = (l, r) => (F(l) + F(r)) / 2;
    f.smile = A('mouthSmileLeft', 'mouthSmileRight'); f.frown = A('mouthFrownLeft', 'mouthFrownRight');
    f.browDown = A('browDownLeft', 'browDownRight'); f.browInner = F('browInnerUp'); f.browOuter = A('browOuterUpLeft', 'browOuterUpRight');
    f.eyeWide = A('eyeWideLeft', 'eyeWideRight'); f.squint = A('eyeSquintLeft', 'eyeSquintRight'); f.cheek = A('cheekSquintLeft', 'cheekSquintRight');
    f.jaw = F('jawOpen'); f.press = A('mouthPressLeft', 'mouthPressRight'); f.sneer = A('noseSneerLeft', 'noseSneerRight');
    f.upper = A('mouthUpperUpLeft', 'mouthUpperUpRight'); f.stretch = A('mouthStretchLeft', 'mouthStretchRight'); f.dimple = A('mouthDimpleLeft', 'mouthDimpleRight');
    f.chin = F('mouthShrugLower'); f.pucker = F('mouthPucker'); f.funnel = F('mouthFunnel'); f.blink = A('eyeBlinkLeft', 'eyeBlinkRight');
    f.rawJaw = B.jawOpen || 0;
    const sq = f.squint * (1 - clamp(f.blink * 1.4));   // geschlossene Augen sind kein Zusammenkneifen
    const opener = Math.max(f.eyeWide, f.jaw);
    // Gesichtsmuskel-Muster (FACS): Freude = Lächeln + Wangen; Trauer = Mundwinkel runter + innere Brauen hoch; usw.
    const s = {
      freude: 1.1 * f.smile + 0.35 * f.cheek + 0.2 * f.dimple - 0.4 * f.frown - 0.25 * f.browDown,
      trauer: 1.3 * f.frown + 0.65 * f.browInner * (1 - f.eyeWide) + 0.35 * f.chin + 0.2 * f.press - 0.9 * f.smile - 0.3 * f.jaw,
      wut: 1.0 * f.browDown + 0.45 * sq * (1 - f.smile) + 0.35 * f.press + 0.45 * f.sneer - 0.6 * f.smile - 0.6 * f.browInner,
      ueber: (0.4 * f.browInner + 0.5 * f.browOuter) * (0.35 + 0.65 * clamp(opener * 2)) + 0.6 * f.eyeWide + 0.7 * f.jaw - 0.5 * f.smile - 0.4 * f.browDown,
      angst: 0.45 * f.browInner + 0.6 * f.eyeWide + 0.9 * f.stretch + 0.7 * f.browDown * f.browInner - 0.6 * f.smile,
      ekel: 1.1 * f.sneer + 0.8 * f.upper + 0.2 * f.browDown - 0.6 * f.smile,
    };
    // Wahrscheinlichkeiten (Softmax), „ruhig“ als Grundzustand
    const k = 7, ex = { neutral: Math.exp(k * 0.3) }; let sum = ex.neutral;
    for (const e in s) { ex[e] = Math.exp(k * s[e]); sum += ex[e]; }
    const pr = {}; for (const e in ex) pr[e] = ex[e] / sum;
    return pr;
  }
  function emotions(now) {
    const sens = { fein: 1.35, normal: 1, grob: 0.75 }[o('empf', 'normal')] || 1;
    const pr = score(face.bs, base, sens, feat);
    for (const e in pr) probs[e] = lerp(probs[e], pr[e], 0.35);
    // Basis langsam nachführen, aber nur wenn das Gesicht gerade ruhig ist (gleicht Licht und Haltung aus)
    if (base && pr.neutral > 0.6 && now - (M._adapt || 0) > 250) {
      M._adapt = now;
      for (const k in face.bs) if (k in base) base[k] = lerp(base[k], face.bs[k], 0.01);
    }
    // Stimmung wechselt erst, wenn die neue klar und kurz stabil führt
    let top = 'neutral'; for (const e in probs) if (probs[e] > probs[top]) top = e;
    if (top !== mood && probs[top] > probs[mood] + 0.08) {
      if (cand !== top) { cand = top; candSince = now; }
      else if (now - candSince > 350 && now - moodSince > 700) { mood = top; moodSince = now; cand = null; onMood(mood); }
    } else cand = null;
    intensity = lerp(intensity, probs[mood], 0.2);
  }

  // ---------------- Klang ----------------
  const N = {}; let built = false;
  function build() {
    const AC = S.AC, G = S.G, F = S.F;
    N.out = G(0); N.out.connect(S.A.bus);
    N.drums = G(0.85); N.drums.connect(N.out);
    N.music = G(1); N.lp = F('lowpass', 2000, 0.7); N.duck = G(1);
    N.music.connect(N.lp); N.lp.connect(N.duck); N.duck.connect(N.out);
    N.rev = G(0.3); N.duck.connect(N.rev); N.rev.connect(S.A.revIn);
    N.dly = G(0.15); N.duck.connect(N.dly); N.dly.connect(S.A.dlyIn);
    // Fläche
    N.padLP = F('lowpass', 1500, 0.7); N.padTrem = G(1); N.padG = G(0.5);
    N.padLP.connect(N.padTrem); N.padTrem.connect(N.padG); N.padG.connect(N.music);
    N.trem = AC.createOscillator(); N.trem.frequency.value = 7; N.tremAmt = G(0); N.trem.connect(N.tremAmt); N.tremAmt.connect(N.padTrem.gain); N.trem.start();
    N.pad = [0, 1, 2, 3, 4].map(k => {
      const a = AC.createOscillator(); a.type = 'sawtooth'; a.detune.value = (k % 2 ? 7 : -7);
      const b = AC.createOscillator(); b.type = 'triangle';
      const ga = G(0.035), gb = G(0.09), pn = S.pan((k - 2) * 0.3);
      a.connect(ga); b.connect(gb); ga.connect(pn); gb.connect(pn); pn.connect(N.padLP); a.start(); b.start(); return { a, b };
    });
    // Ekel: wabbelnder Bass (dauerhaft, nur bei „Ekel“ hörbar)
    N.wob = AC.createOscillator(); N.wob.type = 'sawtooth'; N.wob2 = AC.createOscillator(); N.wob2.type = 'square'; N.wob2.detune.value = 18;
    N.wobLP = F('lowpass', 300, 9); N.wobG = G(0); N.wobLfo = AC.createOscillator(); N.wobLfoAmt = G(900);
    N.wobLfo.connect(N.wobLfoAmt); N.wobLfoAmt.connect(N.wobLP.frequency);
    N.wob.connect(N.wobLP); N.wob2.connect(N.wobLP); N.wobLP.connect(N.wobG); N.wobG.connect(N.music);
    N.wob.start(); N.wob2.start(); N.wobLfo.start();
    // Mund-Stimme: dein Mund formt die Vokale, der Synth singt
    N.vo = AC.createOscillator(); N.vo.type = 'sawtooth'; N.vo2 = AC.createOscillator(); N.vo2.type = 'sawtooth'; N.vo2.detune.value = 9;
    N.vf1 = F('bandpass', 600, 8); N.vf2 = F('bandpass', 1200, 10); N.vG = G(0); N.vPan = S.pan(0);
    const vm = G(0.5); N.vo.connect(vm); N.vo2.connect(vm); vm.connect(N.vf1); vm.connect(N.vf2);
    const g2 = G(0.6); N.vf2.connect(g2); N.vf1.connect(N.vG); g2.connect(N.vG); N.vG.connect(N.vPan); N.vPan.connect(N.music);
    const vr = G(0.5); N.vG.connect(vr); vr.connect(S.A.revIn);
    N.vo.start(); N.vo2.start();
    // Regen (Trauer) als Rauschteppich
    const rs = AC.createBufferSource(); rs.buffer = S.A.noise; rs.loop = true;
    N.rainF = F('bandpass', 2500, 0.4); N.rainG = G(0); rs.connect(N.rainF); N.rainF.connect(N.rainG); N.rainG.connect(N.out); rs.start();
    built = true; setChord(MOOD[curMood].chords[0], AC.currentTime, true);
  }
  function setChord(ch, t, now) {
    if (!built) return;
    N.pad.forEach((p, k) => { const f = mtof(ch[k]); p.a.frequency.setTargetAtTime(f, t, now ? 0.001 : 0.25); p.b.frequency.setTargetAtTime(f, t, now ? 0.001 : 0.25); });
    N.vo.frequency.setTargetAtTime(mtof(ch[3] + 12), t, 0.08); N.vo2.frequency.setTargetAtTime(mtof(ch[3] + 12), t, 0.08);
    N.wob.frequency.setTargetAtTime(mtof(ch[0] - 12), t, 0.05); N.wob2.frequency.setTargetAtTime(mtof(ch[0] - 12), t, 0.05);
  }
  function applyMood(m, t) {
    const md = MOOD[m];
    N.padLP.frequency.setTargetAtTime(md.padLP, t, 0.4);
    N.tremAmt.gain.setTargetAtTime(m === 'angst' ? 0.45 : 0, t, 0.3);
    N.wobG.gain.setTargetAtTime(m === 'ekel' ? 0.16 : 0, t, 0.2);
    N.wobLfo.frequency.setTargetAtTime(md.bpm / 60 * 2, t, 0.1);
    N.rainG.gain.setTargetAtTime(m === 'trauer' ? 0.035 : 0, t, 0.6);
    N.padG.gain.setTargetAtTime(m === 'wut' ? 0.25 : 0.5, t, 0.3);
  }
  // Instrumente (sauber)
  function kick(t, f0, f1, dec, lvl, dest) {
    const AC = S.AC, k = AC.createOscillator(); k.frequency.setValueAtTime(f0, t); k.frequency.setTargetAtTime(f1, t, 0.03);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.03, dec);
    k.connect(g); g.connect(dest || N.drums); k.start(t); k.stop(t + dec * 8 + 0.1); S.kickTimes.push(t);
    N.duck.gain.cancelScheduledValues(t); N.duck.gain.setValueAtTime(1, t); N.duck.gain.linearRampToValueAtTime(0.65, t + 0.005); N.duck.gain.setTargetAtTime(1, t + 0.03, 0.08);
  }
  const hat = (t, g, d = 0.03, p = 0.2) => S.noise(t, { type: 'highpass', f: 8500, dur: d, gain: g, p, dest: N.drums });
  const clap = (t, g) => { for (const d of [0, 0.011, 0.022]) S.noise(t + d, { type: 'bandpass', f: 1300, q: 1.1, dur: 0.02, gain: g, dest: N.drums }); S.noise(t + 0.03, { type: 'bandpass', f: 1150, q: 0.9, dur: 0.18, gain: g * 0.9, rev: 0.35, dest: N.drums }); };
  function tone(t, midi, type, dur, lvl, lpF, pan = 0, rev = 0.25, dest) {
    const AC = S.AC, x = AC.createOscillator(); x.type = type; x.frequency.value = mtof(midi);
    const lp = S.F('lowpass', lpF, 1.5); lp.frequency.setValueAtTime(lpF * 2.5, t); lp.frequency.setTargetAtTime(lpF, t, dur * 0.3);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.01, dur * 0.35);
    const pn = S.pan(pan); x.connect(lp); lp.connect(g); g.connect(pn); pn.connect(dest || N.music);
    if (rev) { const r = S.G(rev); g.connect(r); r.connect(S.A.revIn); }
    x.start(t); x.stop(t + dur * 2.5 + 0.1);
  }
  function bell(t, midi, lvl, pan = 0) {
    const AC = S.AC, f = mtof(midi), c = AC.createOscillator(); c.frequency.value = f; const m = AC.createOscillator(); m.frequency.value = f * 3.5;
    const mi = AC.createGain(); mi.gain.setValueAtTime(f * 2.5, t); mi.gain.setTargetAtTime(f * 0.1, t, 0.4); m.connect(mi); mi.connect(c.frequency);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.02, 0.7);
    const pn = S.pan(pan); c.connect(g); g.connect(pn); pn.connect(N.music); const d = S.G(0.35); g.connect(d); d.connect(S.A.dlyIn);
    c.start(t); m.start(t); c.stop(t + 3.5); m.stop(t + 3.5);
  }
  function bass(t, midi, dur, lvl, dist) {
    const AC = S.AC, f = mtof(midi), a = AC.createOscillator(); a.type = 'sawtooth'; a.frequency.value = f; const s = AC.createOscillator(); s.frequency.value = f;
    const lp = S.F('lowpass', dist ? 900 : 380, dist ? 4 : 1.5); lp.frequency.setValueAtTime(dist ? 2400 : 700, t); lp.frequency.setTargetAtTime(dist ? 500 : 300, t, 0.05);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.004); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, 0.03);
    const sg = S.G(0.8); a.connect(lp); s.connect(sg); sg.connect(g); lp.connect(g);
    if (dist) { const sh = AC.createWaveShaper(); sh.curve = S.curve(0.5); g.connect(sh); const og = S.G(0.6); sh.connect(og); og.connect(N.music); } else g.connect(N.music);
    a.start(t); s.start(t); a.stop(t + dur + 0.3); s.stop(t + dur + 0.3);
  }

  let pendingMood = null, energy = 2, armsWasUp = false, armsUpT = 0, dropQ = 0, blinkQ = 0, browQ = 0;
  function onMood(m) { pendingMood = m; }
  M.step = (i, t, st, bar) => {
    if (!built) return;
    // Stimmungswechsel auf dem nächsten Schlag, mit kurzem Übergang
    if (pendingMood && i % 4 === 0) {
      curMood = pendingMood; pendingMood = null; applyMood(curMood, t);
      S.noise(t, { type: 'bandpass', f: 1800, q: 0.7, att: 0.15, dur: 0.6, gain: 0.12, rev: 0.6, dest: N.out });
      setChord(MOOD[curMood].chords[bar % 4], t);
    }
    const md = MOOD[curMood], ch = md.chords[bar % 4], e = energy;
    bpmNow = lerp(bpmNow, md.bpm, 0.08);
    if (i === 0) setChord(ch, t);
    if (dropQ && i === 0) { dropQ = 0; S.impact(t, N.drums); }
    if (blinkQ) { blinkQ = 0; S.noise(t, { type: 'bandpass', f: 5000, q: 4, dur: 0.04, gain: 0.15, p: (Math.random() - 0.5), rev: 0.3, dest: N.drums }); }
    if (browQ) { browQ = 0; for (let k = 0; k < 4; k++) bell(t + k * st * 0.5, ch[k + 1] + 12, 0.05, (k - 1.5) * 0.4); }
    switch (md.drums) {
      case 'soft':
        if (e >= 1 && (i === 0 || i === 10)) kick(t, 110, 50, 0.08, 0.6);
        if (e >= 2 && (i === 4 || i === 12)) S.noise(t, { type: 'bandpass', f: 2500, q: 2, dur: 0.03, gain: 0.12, rev: 0.3, dest: N.drums });
        if (e >= 2 && i % 2 === 0) hat(t, i % 4 ? 0.04 : 0.06, 0.04);
        if (e >= 1 && (i === 0 || i === 8)) bass(t, ch[0] - 12, st * 6, 0.3);
        if (i % 4 === 2 && Math.random() < 0.5) bell(t, ch[1 + Math.floor(Math.random() * 4)] + 12, 0.05, Math.random() - 0.5);
        break;
      case 'pop':
        if (e >= 1 && i % 4 === 0) kick(t, 140, 50, 0.07, 0.8);
        if (e >= 2 && (i === 4 || i === 12)) clap(t, 0.22);
        if (e >= 1) hat(t, [0.05, 0.03, 0.09, 0.03][i % 4], 0.03, i % 2 ? 0.3 : -0.3);
        if (e >= 2 && [2, 6, 7, 10, 14].includes(i)) bass(t, ch[0] - 12 + (i === 7 ? 12 : 0), st * 1.5, 0.35);
        if (e >= 3 && i % 4 === 2) S.noise(t, { type: 'highpass', f: 6500, dur: 0.12, gain: 0.06, dest: N.drums });
        tone(t, ch[[1, 2, 3, 4, 3, 2][i % 6]] + 12, 'sawtooth', st * 0.9, 0.06, 2600, (i % 2 ? 0.4 : -0.4), 0.15);
        break;
      case 'none':
        if (e >= 2 && (i === 0 || i === 8)) kick(t, 80, 42, 0.12, 0.5);
        if (e >= 4 && i % 4 === 2) S.noise(t, { type: 'bandpass', f: 4000, q: 0.5, att: 0.02, dur: 0.12, gain: 0.04, dest: N.drums });
        if ([0, 6, 8, 12].includes(i) && Math.random() < 0.75) tone(t, ch[1 + Math.floor(Math.random() * 4)] + (i === 0 ? 0 : 12), 'triangle', st * 6, 0.09, 1800, Math.random() * 0.6 - 0.3, 0.6);
        if (i === 0) bass(t, ch[0] - 12, st * 14, 0.25);
        break;
      case 'hard':
        if (i % 4 === 0 || (e >= 4 && (i === 14 || i === 15))) kick(t, 200, 45, 0.09, 0.95);
        if (e >= 2 && (i === 4 || i === 12)) { clap(t, 0.3); S.noise(t, { type: 'lowpass', f: 3000, dur: 0.15, gain: 0.25, dest: N.drums }); }
        if (e >= 2) hat(t, [0.08, 0.04, 0.1, 0.04][i % 4], 0.025);
        if (i % 4 !== 0) bass(t, ch[0] - 12 + (i % 8 === 7 ? 1 : 0), st * 0.9, 0.3, true);
        if (e >= 4 && (i === 7 || i === 15)) S.noise(t, { type: 'bandpass', f: 600, q: 6, dur: 0.15, gain: 0.3, rev: 0.4, dest: N.drums });
        break;
      case 'glitch':
        if (e >= 1 && [0, 6, 8].includes(i)) kick(t, 150, 48, 0.07, 0.75);
        if (e >= 2 && i === 12) clap(t, 0.24);
        if (e >= 2 && Math.random() < 0.35) for (let k = 0; k < 3; k++) hat(t + k * st / 3, 0.05, 0.015, Math.random() - 0.5);
        bell(t, ch[i % 5] + 12 + (i % 8 > 3 ? 12 : 0), 0.045, (i % 4 - 1.5) * 0.4);
        if (i === 0 && bar % 2 === 1) S.riser(t, st * 16, N.out);
        if ([0, 3, 8, 11].includes(i)) bass(t, ch[0] - 12, st * 2, 0.3);
        break;
      case 'heart':
        if (i === 0 || i === 2 || (e >= 3 && (i === 8 || i === 10))) kick(t, 70, 38, 0.1, i % 8 === 0 ? 0.8 : 0.55);
        if (i === 14 && Math.random() < 0.6) tone(t, ch[4] + 24 + (Math.random() < 0.5 ? 1 : 0), 'sine', st * 3, 0.05, 6000, Math.random() - 0.5, 0.8);
        if (i === 0 && bar % 2 === 0) S.noise(t, { type: 'lowpass', f: 160, att: 0.4, dur: 2.5, gain: 0.3, dest: N.out });
        break;
      case 'wobble':
        if (e >= 1 && (i === 0 || i === 8)) kick(t, 120, 48, 0.08, 0.75);
        if (e >= 2 && (i === 4 || i === 12)) clap(t, 0.2);
        if (e >= 2 && i % 4 === 2) hat(t, 0.06, 0.06, 0.2);
        if (i === 6 && Math.random() < 0.5) S.vocal(t, ch[2] + 12, N.music, 0.3, 0.2);
        break;
    }
    if (e >= 5 && i === 15 && bar % 2 === 1) S.noise(t, { type: 'bandpass', f: 900, q: 1, att: st * 0.8, dur: st, gain: 0.2, dest: N.drums });
  };

  // ---------------- Bild: Kamera, Farbschleier, Vignette und Gesichtsnetz auf der Grafikkarte ----------------
  const BG_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uCam; uniform vec2 uRes, uCover; uniform float uCamOn, uBright, uTintA, uVig; uniform vec3 uTint;
void main(){ vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec3 c = uCamOn > 0.5 ? texture(uCam, vec2(1.0 - (0.5 + (uv.x - 0.5) * uCover.x), 0.5 + (uv.y - 0.5) * uCover.y)).rgb * uBright : vec3(0.02, 0.016, 0.04);
  c = mix(c, uTint, uTintA);
  float d = length((uv - vec2(0.5, 0.45)) * vec2(uRes.x / uRes.y, 1.0));
  c *= 1.0 - smoothstep(0.25, 0.95, d) * uVig;
  o = vec4(c, 1.0); }`;
  const LINE_VS = `#version 300 es
layout(location = 0) in vec2 aP; uniform vec2 uRes;
void main(){ gl_Position = vec4(aP.x / uRes.x * 2.0 - 1.0, 1.0 - aP.y / uRes.y * 2.0, 0.0, 1.0); }`;
  const LINE_FS = `#version 300 es
precision highp float; out vec4 o; uniform vec3 uC; uniform float uA; void main(){ o = vec4(uC * uA, 1.0); }`;
  let G = null;
  function initGL() {
    const gl = S.gl;
    G = { bg: S.glProg(S.QUAD_VS, BG_FS), line: S.glProg(LINE_VS, LINE_FS), arr: new Float32Array(6000 * 4) };
    G.vao = gl.createVertexArray(); gl.bindVertexArray(G.vao);
    G.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.buf); gl.bufferData(gl.ARRAY_BUFFER, G.arr.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
  }
  function drawGL(col) {
    const gl = S.gl; if (!G) initGL();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, S.glc.width, S.glc.height); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    S.camTexture(0);
    const u = G.bg.u, [sx, sy] = S.cover();
    gl.useProgram(G.bg.p); S.glQuad();
    gl.uniform1i(u.uCam, 0); gl.uniform2f(u.uRes, S.glc.width, S.glc.height); gl.uniform2f(u.uCover, sx, sy);
    gl.uniform1f(u.uCamOn, S.camLive() ? 1 : 0); gl.uniform1f(u.uBright, o('kamerabild', 'dunkel') === 'dunkel' ? 0.45 : 0.9);
    gl.uniform3f(u.uTint, col[0] / 255, col[1] / 255, col[2] / 255); gl.uniform1f(u.uTintA, 0.08 + intensity * 0.12);
    gl.uniform1f(u.uVig, mood === 'angst' ? 0.55 + S.kickV * 0.3 : 0.45);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (face.pts && TESS && o('netz', 'netz') === 'netz') {
      const P = face.pts, A = G.arr; let k = 0;
      for (const c of TESS) { const a = P[c.start], b = P[c.end]; A[k++] = a[0]; A[k++] = a[1]; A[k++] = b[0]; A[k++] = b[1]; if (k >= A.length) break; }
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(G.line.p); gl.bindVertexArray(G.vao); gl.bindBuffer(gl.ARRAY_BUFFER, G.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, A.subarray(0, k));
      gl.uniform2f(G.line.u.uRes, S.W, S.H); gl.uniform3f(G.line.u.uC, col[0] / 255, col[1] / 255, col[2] / 255); gl.uniform1f(G.line.u.uA, 0.32);
      gl.drawArrays(gl.LINES, 0, k / 2);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
    }
    S.blitGL();
  }

  // ---------------- Bild ----------------
  const parts = [];
  let demoT = 0;
  M.frame = (now, dt) => {
    const ctx = S.ctx, W = S.W, H = S.H, cam = S.usingCamera();
    if (cam && !faceLM && !loading) loadModels();
    if (cam && faceLM && !loopOn) { loopOn = true; startLoop(); }
    // Gefühle ermitteln (oder Demo ohne Kamera)
    const hasFace = !!face.pts;
    if (cam && hasFace && !calib) emotions(now);
    else if (!cam) {
      demoT += dt; const ids = EMO.map(x => x.id), cur = ids[Math.floor(demoT / 8) % ids.length];
      for (const e of ids) probs[e] = lerp(probs[e], e === cur ? 0.8 : 0.03, 0.05);
      if (cur !== mood) { mood = cur; moodSince = now; onMood(mood); } intensity = 0.8;
    }
    const em = EMOMAP[mood], col = em.color;
    if (M._acc !== mood) { M._acc = mood; S.setAccent(col); }
    // Steuerung aus Gesicht und Körper
    if (built) {
      const t = S.AC.currentTime;
      const lift = body.armsUp ? 1 : 0;
      N.lp.frequency.setTargetAtTime(clamp(500 + intensity * 4000 + (feat.browOuter || 0) * 4000 + lift * 9000 + (body.span || 0) * 3000, 300, 18000), t, 0.08);
      N.rev.gain.setTargetAtTime(0.2 + (body.span || 0) * 0.6 + (curMood === 'trauer' || curMood === 'angst' ? 0.3 : 0), t, 0.2);
      const voiceOn = o('stimme', 'an') === 'an' && cam && hasFace;
      const jaw = voiceOn ? clamp(((feat.rawJaw || 0) - 0.08) / 0.5) : 0;
      N.vG.gain.setTargetAtTime(Math.pow(jaw, 1.3) * 0.22, t, 0.04);
      N.vf1.frequency.setTargetAtTime(300 + jaw * 550, t, 0.05);
      N.vf2.frequency.setTargetAtTime(clamp(800 + 1500 * clamp(0.5 + (feat.smile || 0) * 0.9 - ((feat.pucker || 0) + (feat.funnel || 0)) * 0.8), 700, 2500), t, 0.05);
      N.vo.detune.setTargetAtTime(face.roll * 300, t, 0.05); N.vo2.detune.setTargetAtTime(face.roll * 300 + 9, t, 0.05);
      if (N.vPan.pan) N.vPan.pan.setTargetAtTime(clamp(-face.yaw * 1.5, -1, 1), t, 0.05);
    }
    // Energie aus Körperbewegung + Gefühlsstärke
    const target = cam ? Math.round(clamp(0.15 + (body.pts ? body.motion * 1.1 : 0.35) + intensity * 0.35) * 5) : 3;
    energy = lerp(energy, target, 0.03);
    if (body.armsUp && !armsWasUp) armsUpT = now;
    if (!body.armsUp && armsWasUp && now - armsUpT > 600) dropQ = 1;
    armsWasUp = body.armsUp;
    // Blinzeln und Brauen als kleine Auslöser
    if (cam && hasFace) {
      if ((face.raw.eyeBlinkLeft || 0) > 0.6 && (face.raw.eyeBlinkRight || 0) > 0.6) { if (!M._blink) { M._blink = true; blinkQ = 1; } } else if ((face.raw.eyeBlinkLeft || 0) < 0.35) M._blink = false;
      if ((feat.browOuter || 0) > 0.55) { if (!M._brow) { M._brow = true; browQ = 1; } } else if ((feat.browOuter || 0) < 0.3) M._brow = false;
    }
    // Hintergrund + Gesichtsnetz (Grafikkarte), sonst einfacher Ersatz
    if (S.gl) drawGL(col);
    else {
      if (!S.drawCamera(ctx, o('kamerabild', 'dunkel') === 'dunkel' ? 0.45 : 0.9)) { ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H); }
      ctx.fillStyle = `rgba(${col},${0.08 + intensity * 0.12})`; ctx.fillRect(0, 0, W, H);
    }
    drawParticles(ctx, now, dt, col);
    // Körper
    if (body.pts && o('koerper', 'an') === 'an') drawBody(ctx, col);
    // Gesichtsnetz
    if (face.pts && o('netz', 'netz') !== 'aus') drawFace(ctx, col, now);
    // Kalibrierung
    if (calib && face.pts) {
      const c = face.pts[1], r = S.dist2(face.pts[10], face.pts[152]) * 0.75, pr = calib.t0 ? clamp((now - calib.t0) / 2000) : 0;
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c[0], c[1], r, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); ctx.stroke();
      ctx.font = '600 13px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.fillText('NEUTRAL SCHAUEN …', c[0], c[1] + r + 22); ctx.textAlign = 'left';
    }
    drawRadar(ctx, col);
    drawFeatureBars(ctx, col);
    if (!cam) { ctx.font = '600 12px "JetBrains Mono", monospace'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.textAlign = 'center';
      ctx.fillText('DEMO: Diese Welt braucht die Kamera (Menü → Steuerung → Kamera)', W / 2, H * 0.55); ctx.textAlign = 'left'; }
    else if (!hasFace && faceLM) { ctx.font = '600 13px "JetBrains Mono", monospace'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.textAlign = 'center'; ctx.fillText('KEIN GESICHT IM BILD', W / 2, H * 0.5); ctx.textAlign = 'left'; }
    const md = MOOD[curMood];
    S.setSection(calib && face.pts ? 'KALIBRIERE' : em.name, `${Math.round(probs[mood] * 100)}% · ${md.key} · ${Math.round(bpmNow)} BPM` + (body.armsUp ? ' · ARME HOCH' : ''));
  };
  let loopOn = false;

  function drawFace(ctx, col, now) {
    const P = face.pts, mode = o('netz', 'netz');
    ctx.save(); ctx.lineCap = 'round';
    if (mode === 'netz' && TESS && !S.gl) {
      ctx.strokeStyle = `rgba(${col},.28)`; ctx.lineWidth = 0.6; ctx.beginPath();
      for (const c of TESS) { const a = P[c.start], b = P[c.end]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
    }
    // Leuchten ohne teuren Weichzeichner: breite schwache Linie + schmale helle Linie
    ctx.beginPath();
    for (const set of CONTOURS) for (const c of set) { const a = P[c.start], b = P[c.end]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.strokeStyle = `rgba(${col},.22)`; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = `rgba(${col},.95)`; ctx.lineWidth = 1.6; ctx.stroke();
    // Iris
    if (P.length > 470) for (const idx of [468, 473]) { const c = P[idx], r = S.dist2(P[idx], P[idx + 1]) * 1.05 + 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 6.283); ctx.stroke(); ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(c[0], c[1], 1.8, 0, 6.283); ctx.fill(); }
    // Messpunkte, die die Emotion tragen
    ctx.fillStyle = '#fff';
    for (const k of [61, 291, 105, 334, 0, 17, 13, 14, 159, 386, 145, 374]) { ctx.beginPath(); ctx.arc(P[k][0], P[k][1], 2, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }
  function drawBody(ctx, col) {
    const P = body.pts, v = body.vis;
    ctx.save(); ctx.lineCap = 'round';
    for (const tr of body.trails) { for (let i = 1; i < tr.length; i++) { ctx.strokeStyle = `rgba(${col},${i / tr.length * 0.6})`; ctx.lineWidth = 1 + i / tr.length * 6; ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke(); } }
    if (POSE_CON) {
      ctx.beginPath();
      for (const c of POSE_CON) { if (c.start < 11 || c.end < 11 || v[c.start] < 0.5 || v[c.end] < 0.5) continue; ctx.moveTo(P[c.start][0], P[c.start][1]); ctx.lineTo(P[c.end][0], P[c.end][1]); }
      ctx.strokeStyle = `rgba(${col},.3)`; ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.2; ctx.stroke();
    }
    ctx.fillStyle = `rgb(${col})`;
    for (let k = 11; k < 33; k++) if (v[k] >= 0.5) { ctx.beginPath(); ctx.arc(P[k][0], P[k][1], k === 15 || k === 16 ? 6 + S.kickV * 4 : 3.5, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }
  function drawRadar(ctx, col) {
    const W = S.W, r = 48, cx = 76, cy = S.H - ((document.getElementById('matrix').offsetHeight || 120) + 30) - r - 26;
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,16,.45)'; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r + 22, 0, 6.283); ctx.fill(); ctx.stroke();
    const n = EMO.length - 1, ang = i => -Math.PI / 2 + i / n * 6.283;
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    for (const rr of [0.33, 0.66, 1]) { ctx.beginPath(); for (let i = 0; i <= n; i++) ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(ang(i % n)) * r * rr, cy + Math.sin(ang(i % n)) * r * rr); ctx.stroke(); }
    ctx.beginPath();
    EMO.slice(1).forEach((e, i) => { const v = Math.sqrt(clamp(probs[e.id] * 1.4)); ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(ang(i)) * r * v, cy + Math.sin(ang(i)) * r * v); });
    ctx.closePath(); ctx.fillStyle = `rgba(${col},.45)`; ctx.fill(); ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '600 8.5px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    EMO.slice(1).forEach((e, i) => { ctx.fillStyle = e.id === mood ? '#fff' : 'rgba(255,255,255,.6)'; ctx.fillText(e.name.slice(0, 6), cx + Math.cos(ang(i)) * (r + 13), cy + Math.sin(ang(i)) * (r + 13) + 3); });
    ctx.textAlign = 'left'; ctx.restore();
  }
  const BARS = [['LÄCHELN', 'smile'], ['MUNDW. RUNTER', 'frown'], ['BRAUEN HOCH', 'browOuter'], ['BRAUEN INNEN', 'browInner'], ['STIRNRUNZELN', 'browDown'], ['AUGEN WEIT', 'eyeWide'], ['MUND OFFEN', 'jaw'], ['NASE RÜMPFEN', 'sneer']];
  function drawFeatureBars(ctx, col) {
    if (!face.pts) return;
    const W = S.W, x = W - 128, y0 = S.H - ((document.getElementById('matrix').offsetHeight || 120) + 30) - BARS.length * 15 - 8;
    ctx.save(); ctx.fillStyle = 'rgba(10,8,16,.45)'; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 8, y0 - 14, 128, BARS.length * 15 + 18, 12); else ctx.rect(x - 8, y0 - 14, 128, BARS.length * 15 + 18); ctx.fill(); ctx.stroke();
    ctx.font = '600 8px "JetBrains Mono", monospace';
    BARS.forEach(([label, k], i) => {
      const y = y0 + i * 15, v = clamp(feat[k] || 0);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(label, x, y);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y + 3, 110, 4);
      ctx.fillStyle = `rgb(${col})`; ctx.fillRect(x, y + 3, 110 * v, 4);
    });
    ctx.restore();
  }
  function drawParticles(ctx, now, dt, col) {
    const W = S.W, H = S.H, m = curMood;
    const rate = m === 'trauer' ? 6 : m === 'wut' ? 4 : m === 'freude' ? 2 : m === 'ueber' ? (S.kickV > 0.9 ? 20 : 0) : 1;
    for (let k = 0; k < rate; k++) {
      if (parts.length > 260) break;
      if (m === 'trauer') parts.push({ x: Math.random() * W, y: -10, vx: -30, vy: 600 + Math.random() * 300, life: 2, k: 'rain' });
      else if (m === 'freude') parts.push({ x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 80, life: 6, k: 'bubble', r: 3 + Math.random() * 8 });
      else if (m === 'wut') { const c = face.pts ? face.pts[1] : [W / 2, H / 2]; const a = Math.random() * 6.283; parts.push({ x: c[0], y: c[1], vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: 0.6, k: 'spark' }); }
      else if (m === 'ueber') { const a = Math.random() * 6.283; parts.push({ x: W / 2, y: H * 0.45, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 0.9, k: 'star' }); }
      else if (m === 'ekel') parts.push({ x: Math.random() * W, y: -10, vx: 0, vy: 40 + Math.random() * 40, life: 8, k: 'slime', r: 4 + Math.random() * 6 });
      else if (Math.random() < 0.3) parts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 10, vy: -8, life: 5, k: 'dust' });
    }
    ctx.save();
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (q.k === 'slime') q.vx = Math.sin(now / 300 + q.y * 0.05) * 30;
      if (q.life <= 0 || q.y > H + 20 || q.y < -40) { parts.splice(i, 1); continue; }
      if (q.k === 'rain') { ctx.strokeStyle = 'rgba(170,200,255,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - 3, q.y - 16); ctx.stroke(); }
      else if (q.k === 'bubble') { ctx.strokeStyle = `rgba(${col},.7)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 + S.kickV * 0.3), 0, 6.283); ctx.stroke(); }
      else if (q.k === 'spark' || q.k === 'star') { ctx.fillStyle = q.k === 'spark' ? `rgba(255,${120 + Math.random() * 100},40,${q.life})` : `rgba(${col},${q.life})`; ctx.fillRect(q.x, q.y, 3, 3); }
      else if (q.k === 'slime') { ctx.fillStyle = 'rgba(150,215,50,.55)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r, q.r * 1.4, 0, 0, 6.283); ctx.fill(); }
      else { ctx.fillStyle = `rgba(${col},.35)`; ctx.fillRect(q.x, q.y, 2, 2); }
    }
    ctx.restore();
  }

  M.enter = () => {
    if (!built) build();
    N.out.gain.setTargetAtTime(1, S.AC.currentTime, 0.1); applyMood(curMood, S.AC.currentTime);
    try { const b = JSON.parse(localStorage.getItem('handstudio-face-base') || 'null'); if (b && !base) base = b; } catch (e) {}
    if (S.usingCamera() && faceLM) { loopOn = true; startLoop(); }
  };
  M.exit = () => { gen++; loopOn = false; if (built) { N.out.gain.setTargetAtTime(0, S.AC.currentTime, 0.08); N.vG.gain.setTargetAtTime(0, S.AC.currentTime, 0.05); } };
  M.onSetting = k => { if ((k === 'koerper' || k === 'genau') && faceLM) loadPose().catch(() => {}); };
  M.matrix = [
    ['GESICHT', () => face.pts ? 1 : 0, () => face.pts ? Math.round(faceHz) + ' HZ' : '–'],
    ['EMOTION', () => probs[mood], () => EMOMAP[mood].name],
    ['LÄCHELN', () => feat.smile || 0, () => Math.round((feat.smile || 0) * 100) + '%'],
    ['BRAUEN', () => Math.max(feat.browOuter || 0, feat.browDown || 0), () => (feat.browDown || 0) > (feat.browOuter || 0) ? 'RUNTER' : 'HOCH', 'opt'],
    ['MUND', () => clamp(((feat.rawJaw || 0) - 0.05) / 0.6), () => Math.round(clamp(((feat.rawJaw || 0) - 0.05) / 0.6) * 100) + '%'],
    ['KÖRPER', () => body.motion, () => body.pts ? Math.round(body.motion * 100) + '%' : '–'],
    ['ARME', () => body.armsUp ? 1 : body.span, () => body.armsUp ? 'HOCH' : Math.round(body.span * 100) + '%', 'opt'],
    ['ENERGIE', () => energy / 5, () => Math.round(energy) + '/5'],
  ];
  M.gestures = [
    ['Lächeln', 'Freude: C-Dur, 118 BPM, Plucks, Claps'], ['Mundwinkel runter, Brauen innen hoch', 'Traurig: A-Moll, 70 BPM, Klavier, Regen'],
    ['Stirn runzeln, Lippen pressen', 'Wut: 138 BPM, harter Bass'], ['Brauen hoch, Augen weit, Mund auf', 'Überrascht: lydische Glocken, Riser'],
    ['Augen weit, Mund breit gezogen', 'Angst: Herzschlag, Cluster-Fläche'], ['Nase rümpfen, Oberlippe hoch', 'Ekel: wabbelnder Bass'],
    ['Mund öffnen und formen', 'Mund-Stimme singt (A, E, I, O, U)'], ['Kopf neigen / drehen', 'Stimme höher/tiefer, links/rechts'],
    ['Blinzeln', 'Klick-Sound'], ['Brauen hochziehen', 'Glocken-Arpeggio'],
    ['Körper bewegen / tanzen', 'mehr Energie, mehr Schlagzeug'], ['Arme über den Kopf', 'Filter auf, beim Runternehmen: Drop'], ['Arme weit auseinander', 'mehr Hall'],
  ];
  M.settings = [
    { type: 'action', label: 'Kalibrieren', button: 'NEUTRAL NEU LERNEN', text: 'Schau danach 2 Sekunden entspannt und neutral in die Kamera. Das macht die Erkennung für dein Gesicht genauer.', onClick: () => { base = null; calib = { sum: {}, n: 0, t0: 0 }; try { localStorage.removeItem('handstudio-face-base'); } catch (e) {} } },
    { key: 'empf', label: 'Empfindlichkeit', def: 'normal', options: [['fein', 'Fein (kleine Regungen)'], ['normal', 'Normal'], ['grob', 'Nur deutliche']] },
    { key: 'netz', label: 'Gesichtsnetz', def: 'netz', options: [['netz', '478 Punkte'], ['konturen', 'Konturen'], ['aus', 'Aus']] },
    { key: 'koerper', label: 'Körper erkennen', def: 'an', options: [['an', 'An'], ['aus', 'Aus']] },
    { key: 'genau', label: 'Körper-Genauigkeit', def: matchMedia('(pointer: coarse)').matches ? 'schnell' : 'hoch', options: [['hoch', 'Hoch'], ['schnell', 'Schnell']] },
    { key: 'stimme', label: 'Mund-Stimme', def: 'an', options: [['an', 'An'], ['aus', 'Aus']] },
    { key: 'kamerabild', label: 'Kamerabild', def: 'dunkel', options: [['normal', 'Hell'], ['dunkel', 'Dunkel']] },
  ];
  window.__gesicht = { setMood: m => { mood = m; onMood(m); }, score, probs, feat, face, body, get lm() { return faceLM; }, stop() { gen++; }, get hz() { return faceHz; }, get cost() { return detCost; }, get mood() { return mood; }, get curMood() { return curMood; }, get energy() { return energy; }, get base() { return base; }, get calib() { return calib; }, get loaded() { return !!faceLM; }, get poseLoaded() { return !!poseLM; } };
  S.register(M);
})();
