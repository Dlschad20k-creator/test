/*
 * Survival-KI Studio – Offline-KI
 * 1. Suche: TF-IDF über Wortstämme + Zeichen-Trigramme (verträgt Tippfehler)
 * 2. Neuronales Netz (Klassifikator), das im Browser trainiert wird:
 *    Eingabe = gehashte Wort- und Trigramm-Merkmale, eine versteckte Schicht (ReLU), Softmax-Ausgabe.
 *    Es erkennt das Thema einer Frage und Fragen außerhalb des Fachgebiets.
 * 3. Antwort: passende Antwort aus den Trainingsdaten, mit Notfall-Hinweis und ähnlichen Fragen.
 */
var SK = (globalThis.SK = globalThis.SK || {});

SK.engine = (function () {
  var U = SK.util;
  var E = {};
  var OFF = 'aussen'; // Klasse für "kein Survival-Thema"

  var STOP = ('der die das den dem des ein eine einer einem einen eines und oder aber auch als am an auf aus bei bin bis bist da dann ' +
    'dass du er es sie wir ihr ich mich mir mein meine meinen meinem meiner dein deine sein seine ihre ist sind war waren wird werden ' +
    'wurde hat habe haben hast hatte im in ins mit nach noch nur ob man so soll sollte um von vor was wie wo wann warum welche welcher ' +
    'welches wer wenn zu zum zur sich ueber unter durch gegen ohne kann koennen muss muessen darf will sehr viel mehr dieser diese dieses ' +
    'jetzt hier dort mal etwas alles schon doch ja nein bitte gibt geht gut machen mache macht tun tue sage sag kommt einfach immer ' +
    'denn weil also nicht kein keine keinen keiner the a an of to and is are for how what why can do i you my').split(' ');
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = 1; });
  // "nicht" und "kein" bleiben für die Bewertung wichtig, beim Suchen stören sie
  var SUFFIXES = ['ungen', 'heiten', 'keiten', 'lichen', 'ung', 'heit', 'keit', 'lich', 'isch', 'ern', 'em', 'en', 'er', 'es', 'e', 'n', 's'];

  function stem(w) {
    for (var pass = 0; pass < 2; pass++) {
      var changed = false;
      for (var i = 0; i < SUFFIXES.length; i++) {
        var s = SUFFIXES[i];
        if (w.length - s.length >= 4 && w.slice(-s.length) === s) { w = w.slice(0, -s.length); changed = true; break; }
      }
      if (!changed) break;
    }
    return w;
  }

  function words(text) {
    return U.normalize(text).split(' ').filter(function (w) { return w && w.length > 1 && !STOPSET[w]; });
  }
  // Trennbare Verben: "Wie mache ich das Feuer an/aus?" – das Wort am Ende entscheidet
  var PARTICLES = { an: 'anzuend', aus: 'loesch' };
  var SYN = { anmach: 'anzuend', entzuend: 'anzuend', entfach: 'anzuend', ausmach: 'loesch', erstick: 'loesch' };
  // Wörter mit gleicher Bedeutung im Krisen-Wortschatz (normalisiert, vor dem Stemming)
  var SYNWORDS = {};
  [
    ['stromausfall', 'blackout', 'netzausfall', 'stromunterbrechung', 'stromausfaelle'],
    ['handy', 'smartphone', 'mobiltelefon', 'telefon'],
    ['einbruch', 'einbrecher', 'pluenderer', 'pluenderung', 'pluenderungen', 'dieb', 'diebe', 'einbrechern', 'pluenderern'],
    ['unterkuehlung', 'unterkuehlt', 'ausgekuehlt', 'auskuehlen', 'hypothermie'],
    ['gewitter', 'blitz', 'blitze', 'blitzschlag', 'donner'],
    ['hunger', 'hungersnot', 'hungern'],
    ['lebensmittel', 'nahrungsmittel'],
    ['verlaufen', 'verirrt', 'verirren', 'orientierungslos'],
    ['atomunfall', 'atomkraftwerk', 'akw', 'kernkraftwerk', 'reaktorunfall', 'kernschmelze', 'atomkraft'],
    ['strahlung', 'radioaktiv', 'radioaktive', 'radioaktivitaet', 'verstrahlt'],
    ['schutzraum', 'bunker', 'schutzbunker', 'schutzraeume'],
    ['krieg', 'kriegsfall', 'verteidigungsfall'],
    ['pandemie', 'seuche', 'epidemie', 'virus', 'viren'],
    ['hochwasser', 'ueberschwemmung', 'flut', 'ueberflutung'],
    ['sturm', 'orkan', 'unwetter'],
    ['waldbrand', 'buschfeuer', 'flaechenbrand'],
    ['evakuierung', 'evakuieren', 'flucht', 'fliehen', 'fluechten'],
    ['notfallrucksack', 'notgepaeck', 'fluchtrucksack', 'notfalltasche', 'fluchtgepaeck'],
    ['notvorrat', 'vorrat', 'vorraete', 'bevorraten', 'hamstern', 'lebensmittelvorrat'],
    ['heizen', 'heizung', 'heizungsausfall'],
    ['generator', 'stromaggregat', 'aggregat', 'notstromaggregat', 'stromerzeuger'],
    ['funkgeraet', 'funkgeraete', 'walkie', 'funk'],
    ['toilette', 'klo', 'wc'],
    ['kaelte', 'kalt', 'frieren', 'frost'],
    ['hitze', 'hitzewelle'],
    ['unterschlupf', 'shelter', 'notunterkunft', 'unterstand'],
    ['wildnis', 'natur', 'draussen'],
    ['trinkbar', 'trinkwasser'],
  ].forEach(function (group) { group.forEach(function (w) { SYNWORDS[w] = group[0]; }); });

  E.tokens = function (text) {
    var raw = U.normalize(text).split(' ').filter(Boolean), out = [];
    raw.forEach(function (w) {
      if (w.length < 2 || STOPSET[w]) return;
      var st = stem(SYNWORDS[w] || w);
      out.push(SYN[st] || st);
    });
    var last = raw[raw.length - 1];
    if (raw.length > 2 && PARTICLES[last]) out.push(PARTICLES[last]);
    return out;
  };

  // Zusammengesetzte Wörter zerlegen: "lebensmittelvorrat" -> "lebensmittel" + "vorrat"
  function splitCompounds(tokens, vocab) {
    var extra = [];
    tokens.forEach(function (t) {
      if (t.length < 8) return;
      for (var i = 4; i <= t.length - 4; i++) {
        var a = t.slice(0, i), b = t.slice(i), b2 = t.charAt(i) === 's' ? t.slice(i + 1) : null;
        if (vocab[a] && (vocab[b] || (b2 && b2.length >= 4 && vocab[b2]))) { extra.push(a, vocab[b] ? b : b2); return; }
      }
      // sonst: längster bekannter Wortanfang (z. B. "blitzschlag" -> "blitz")
      if (!vocab[t]) for (var j = t.length - 1; j >= 5; j--) { if (vocab[t.slice(0, j)]) { extra.push(t.slice(0, j)); return; } }
    });
    return tokens.concat(extra);
  }

  function trigrams(text) {
    var out = [];
    words(text).forEach(function (w) {
      var s = '#' + w + '#';
      for (var i = 0; i + 3 <= s.length; i++) out.push(s.substr(i, 3));
    });
    return out;
  }

  function counts(list) {
    var m = {};
    for (var i = 0; i < list.length; i++) m[list[i]] = (m[list[i]] || 0) + 1;
    return m;
  }
  function norm(vec) {
    var s = 0, k;
    for (k in vec) s += vec[k] * vec[k];
    s = Math.sqrt(s) || 1;
    for (k in vec) vec[k] /= s;
    return vec;
  }
  function dot(a, b) {
    var s = 0, k;
    if (Object.keys(a).length > Object.keys(b).length) { var t = a; a = b; b = t; }
    for (k in a) if (b[k]) s += a[k] * b[k];
    return s;
  }

  /* ---------- Suchindex ---------- */
  // examples: [{id, c, q, a, alt}]
  E.buildIndex = function (examples) {
    var df = {}, N = examples.length || 1, vocab = {};
    var raw = examples.map(function (ex) {
      var tq = E.tokens(ex.q + ' ' + (ex.alt || []).join(' ')), ta = E.tokens(ex.a);
      tq.concat(ta).forEach(function (t) { if (t.length >= 4) vocab[t] = 1; });
      return { ex: ex, tq: tq, ta: ta };
    });
    var docs = raw.map(function (r) {
      var ex = r.ex, tq = splitCompounds(r.tq, vocab), ta = splitCompounds(r.ta, vocab);
      var seen = {};
      tq.concat(ta).forEach(function (t) { if (!seen[t]) { seen[t] = 1; df[t] = (df[t] || 0) + 1; } });
      var tri = counts(trigrams(ex.q + ' ' + (ex.alt || []).join(' ')));
      var atri = counts(trigrams(ex.a));
      Object.keys(atri).forEach(function (g) { tri[g] = (tri[g] || 0) + 0.15 * atri[g]; });
      return { ex: ex, tq: counts(tq), ta: counts(ta), tri: norm(tri) };
    });
    var idf = {};
    Object.keys(df).forEach(function (t) { idf[t] = Math.log(1 + N / df[t]); });
    docs.forEach(function (d) {
      var v = {}, t;
      for (t in d.tq) v[t] = (v[t] || 0) + (1 + Math.log(d.tq[t])) * idf[t] * 1.0;
      for (t in d.ta) v[t] = (v[t] || 0) + (1 + Math.log(d.ta[t])) * idf[t] * 0.35;
      d.vec = norm(v);
      delete d.tq; delete d.ta;
    });
    return { docs: docs, idf: idf, N: N, vocab: vocab };
  };

  E.search = function (index, query, opts) {
    opts = opts || {};
    var qt = counts(splitCompounds(E.tokens(query), index.vocab || {})), qv = {}, t;
    for (t in qt) qv[t] = (1 + Math.log(qt[t])) * (index.idf[t] || Math.log(1 + index.N));
    norm(qv);
    var qtri = norm(counts(trigrams(query)));
    var probs = opts.probs || null;
    var allowed = opts.categories ? toSet(opts.categories) : null;
    var res = [];
    index.docs.forEach(function (d) {
      if (allowed && !allowed[d.ex.c]) return;
      var sw = dot(qv, d.vec), st = dot(qtri, d.tri);
      var score = 0.58 * sw + 0.42 * st;
      if (probs && probs[d.ex.c] !== undefined) score += (opts.boost === undefined ? 0.12 : opts.boost) * probs[d.ex.c];
      res.push({ ex: d.ex, score: score, word: sw, tri: st });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    return res.slice(0, opts.limit || 5);
  };

  function toSet(arr) { var s = {}; arr.forEach(function (x) { s[x] = 1; }); return s; }

  /* ---------- Merkmale für das neuronale Netz ---------- */
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  E.features = function (text, D) {
    var feats = {};
    var tk = E.tokens(text);
    tk.forEach(function (t) { feats['w:' + t] = 1; });
    for (var i = 0; i + 1 < tk.length; i++) feats['b:' + tk[i] + '_' + tk[i + 1]] = 1;
    trigrams(text).forEach(function (g) { feats['t:' + g] = 0.5; });
    var idx = {}, k;
    for (k in feats) { var j = hash(k) % D; idx[j] = (idx[j] || 0) + feats[k]; }
    var keys = Object.keys(idx), s = 0;
    keys.forEach(function (j) { s += idx[j] * idx[j]; });
    s = Math.sqrt(s) || 1;
    return { i: keys.map(Number), v: keys.map(function (j) { return idx[j] / s; }) };
  };

  // Tippfehler simulieren, damit das Modell auch "apoklobse" und "survivling" versteht
  function typo(text, rnd) {
    var chars = text.split('');
    var n = 1 + Math.floor(rnd() * 2);
    for (var k = 0; k < n && chars.length > 4; k++) {
      var p = 1 + Math.floor(rnd() * (chars.length - 2));
      var r = rnd();
      if (r < 0.33) { var t = chars[p]; chars[p] = chars[p + 1]; chars[p + 1] = t; }
      else if (r < 0.66) chars.splice(p, 1);
      else chars.splice(p, 0, chars[p]);
    }
    return chars.join('');
  }
  function dropWords(text, rnd) {
    var w = text.split(' ');
    if (w.length < 4) return text;
    return w.filter(function () { return rnd() > 0.2; }).join(' ') || text;
  }

  /*
   * Trainingsbeispiele bauen. Das Netz lernt, welche Antwort zu einer Frage gehört:
   * eine Ausgabe pro Antwort im Fachgebiet plus "aussen" für fremde Themen.
   * Geprüft wird mit Formulierungen, die das Netz beim Training nie gesehen hat.
   * Bei strikten Modellen zählen Fragen aus anderen Fachgebieten ebenfalls als "aussen".
   */
  E.buildSamples = function (examples, categories, opts) {
    opts = opts || {};
    var rnd = U.rng(opts.seed || 7);
    var cats = toSet(categories);
    var inScope = examples.filter(function (ex) { return cats[ex.c]; });
    // Ziel: Kategorie (Thema) der Frage – oder "aussen" für fremde Themen
    var classes = categories.filter(function (c) { return inScope.some(function (ex) { return ex.c === c; }); });
    if (opts.offTopic !== false) classes.push(OFF);
    var train = [], val = [];
    var valShare = opts.valShare === undefined ? 0.5 : opts.valShare;
    inScope.forEach(function (ex) {
      var alts = (ex.alt || []).slice();
      var held = null;
      if (alts.length >= 2 && rnd() < valShare) held = alts.splice(Math.floor(rnd() * alts.length), 1)[0];
      if (held) val.push({ t: held, y: ex.c, k: 'q', id: ex.id });
      train.push({ t: ex.q, y: ex.c, k: 'q' });
      alts.forEach(function (a) { train.push({ t: a, y: ex.c, k: 'q' }); });
      // Sätze aus der Antwort: so findet das Netz die Antwort auch über Details
      String(ex.a || '').split('\n').forEach(function (line) {
        var l = line.replace(/\*\*/g, '').replace(/^\s*([-*•]|\d+[.)])\s+/, '').trim();
        if (l.length > 25) train.push({ t: l, y: ex.c, k: 'a' });
      });
    });
    if (opts.offTopic !== false) {
      var off = (SK.OFFTOPIC || []).slice();
      if (opts.strict !== false) {
        examples.forEach(function (ex) {
          if (cats[ex.c]) return;
          off.push(ex.q);
          (ex.alt || []).slice(0, 2).forEach(function (a) { off.push(a); });
        });
      }
      off.forEach(function (t) {
        if (rnd() < 0.25) val.push({ t: t, y: OFF, k: 'q' });
        else train.push({ t: t, y: OFF, k: 'q' });
      });
    }
    if (opts.augment !== false) {
      var extra = [];
      train.forEach(function (s) {
        if (s.k !== 'q') return;
        extra.push({ t: typo(s.t, rnd), y: s.y, k: 'q' });
        extra.push({ t: dropWords(typo(s.t, rnd), rnd), y: s.y, k: 'q' });
      });
      train = train.concat(extra);
    }
    return { classes: classes, train: train, val: val };
  };

  /* ---------- Das neuronale Netz ---------- */
  E.createNet = function (D, H, K, seed) {
    var rnd = U.rng(seed || 42);
    function gauss() { var u = rnd() || 1e-9, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var net = { D: D, H: H, K: K, W1: new Float32Array(D * H), b1: new Float32Array(H), W2: new Float32Array(H * K), b2: new Float32Array(K) };
    var s1 = Math.sqrt(2 / 40), s2 = Math.sqrt(2 / H);
    for (var i = 0; i < net.W1.length; i++) net.W1[i] = gauss() * s1;
    for (var j = 0; j < net.W2.length; j++) net.W2[j] = gauss() * s2;
    return net;
  };

  function forward(net, x, cache) {
    var H = net.H, K = net.K, h = cache ? cache.h : new Float32Array(H), z = cache ? cache.z : new Float32Array(K);
    for (var a = 0; a < H; a++) h[a] = net.b1[a];
    for (var n = 0; n < x.i.length; n++) {
      var row = x.i[n] * H, val = x.v[n];
      for (var b = 0; b < H; b++) h[b] += net.W1[row + b] * val;
    }
    for (var c = 0; c < H; c++) if (h[c] < 0) h[c] = 0;
    var max = -1e9;
    for (var k = 0; k < K; k++) {
      var s = net.b2[k];
      for (var d = 0; d < H; d++) s += h[d] * net.W2[d * K + k];
      z[k] = s; if (s > max) max = s;
    }
    var sum = 0;
    for (var e = 0; e < K; e++) { z[e] = Math.exp(z[e] - max); sum += z[e]; }
    for (var f = 0; f < K; f++) z[f] /= sum;
    return { h: h, p: z };
  }

  E.predict = function (model, text) {
    var x = E.features(text, model.net.D);
    var out = forward(model.net, x);
    var probs = {}, best = null, bestP = -1;
    model.classes.forEach(function (c, i) {
      probs[c] = out.p[i];
      if (out.p[i] > bestP) { bestP = out.p[i]; best = c; }
    });
    return { probs: probs, top: best, p: bestP };
  };

  function evaluate(net, data, classIndex) {
    if (!data.length) return { loss: null, acc: null };
    var loss = 0, correct = 0;
    data.forEach(function (s) {
      var out = forward(net, s.x), y = classIndex[s.y];
      loss += -Math.log(Math.max(out.p[y], 1e-9));
      var arg = 0;
      for (var k = 1; k < net.K; k++) if (out.p[k] > out.p[arg]) arg = k;
      if (arg === y) correct++;
    });
    return { loss: loss / data.length, acc: correct / data.length };
  }

  /*
   * Training mit Adam und Mini-Batches. Läuft in Häppchen, damit die Seite flüssig bleibt.
   * cfg: {epochs, lr, hidden, dim, batch, weightDecay, augment, valShare, seed}
   * hooks: {onEpoch(stats), onLog(text), shouldStop()}
   */
  E.train = function (examples, categories, cfg, hooks) {
    cfg = cfg || {}; hooks = hooks || {};
    var D = cfg.dim || 2048, H = cfg.hidden || 48, epochs = cfg.epochs || 30, lr = cfg.lr || 0.01;
    var patience = cfg.patience === undefined ? 8 : cfg.patience;
    var batch = cfg.batch || 16, wd = cfg.weightDecay === undefined ? 1e-4 : cfg.weightDecay;
    var drop = cfg.dropout === undefined ? 0.3 : cfg.dropout; // zufällig Merkmale weglassen = weniger Auswendiglernen
    var smooth = cfg.smoothing === undefined ? 0.05 : cfg.smoothing;
    var data = E.buildSamples(examples, categories, { seed: cfg.seed || 7, augment: cfg.augment, valShare: cfg.valShare, strict: cfg.strict });
    var classes = data.classes, K = classes.length, classIndex = {};
    classes.forEach(function (c, i) { classIndex[c] = i; });
    var prep = function (s) { return { x: E.features(s.t, D), y: s.y }; };
    var train = data.train.map(prep), val = data.val.map(prep);
    var net = E.createNet(D, H, K, cfg.seed || 42);
    // Adam-Zustand
    var mW1 = new Float32Array(D * H), vW1 = new Float32Array(D * H), mb1 = new Float32Array(H), vb1 = new Float32Array(H);
    var mW2 = new Float32Array(H * K), vW2 = new Float32Array(H * K), mb2 = new Float32Array(K), vb2 = new Float32Array(K);
    var gW2 = new Float32Array(H * K), gb2 = new Float32Array(K), gb1 = new Float32Array(H);
    var gW1 = {}; // nur aktive Zeilen (spärlich)
    var b1 = 0.9, b2 = 0.999, eps = 1e-8, step = 0;
    var rnd = U.rng((cfg.seed || 7) + 99);
    var history = [];
    var cache = { h: new Float32Array(H), z: new Float32Array(K) };
    var dh = new Float32Array(H);
    var t0 = Date.now();
    var best = { loss: Infinity, epoch: 0, W1: new Float32Array(D * H), b1: new Float32Array(H), W2: new Float32Array(H * K), b2: new Float32Array(K) };

    if (hooks.onLog) hooks.onLog('Daten: ' + train.length + ' Trainingsbeispiele (mit Tippfehler-Varianten), ' + val.length + ' neue Formulierungen zum Prüfen, ' + K + ' Ausgänge (' + (K - 1) + ' Antworten + fremdes Thema).');
    if (hooks.onLog) hooks.onLog('Netz: ' + D + ' Eingänge → ' + H + ' Neuronen → ' + K + ' Ausgänge (' + U.fmtNum(D * H + H + H * K + K) + ' Parameter).');

    function adamUpdate(w, m, v, g, i, bc1, bc2) {
      var gi = g + wd * w[i];
      m[i] = b1 * m[i] + (1 - b1) * gi;
      v[i] = b2 * v[i] + (1 - b2) * gi * gi;
      w[i] -= lr * (m[i] / bc1) / (Math.sqrt(v[i] / bc2) + eps);
    }

    function runBatch(items) {
      gW2.fill(0); gb2.fill(0); gb1.fill(0); gW1 = {};
      var loss = 0;
      for (var n = 0; n < items.length; n++) {
        var s = items[n], y = classIndex[s.y];
        var x = s.x;
        if (drop > 0) {
          var keepI = [], keepV = [], sc = 1 / (1 - drop);
          for (var m = 0; m < x.i.length; m++) if (rnd() >= drop) { keepI.push(x.i[m]); keepV.push(x.v[m] * sc); }
          if (keepI.length) x = { i: keepI, v: keepV };
        }
        var out = forward(net, x, cache), h = out.h, p = out.p;
        loss += -Math.log(Math.max(p[y], 1e-9));
        dh.fill(0);
        for (var k = 0; k < K; k++) {
          var dz = p[k] - (k === y ? 1 - smooth : smooth / (K - 1));
          gb2[k] += dz;
          for (var a = 0; a < H; a++) { gW2[a * K + k] += h[a] * dz; dh[a] += net.W2[a * K + k] * dz; }
        }
        for (var b = 0; b < H; b++) if (h[b] <= 0) dh[b] = 0;
        for (var c = 0; c < H; c++) gb1[c] += dh[c];
        for (var j = 0; j < x.i.length; j++) {
          var row = x.i[j], val = x.v[j], g = gW1[row] || (gW1[row] = new Float32Array(H));
          for (var d = 0; d < H; d++) g[d] += dh[d] * val;
        }
      }
      var inv = 1 / items.length;
      step++;
      var bc1 = 1 - Math.pow(b1, step), bc2 = 1 - Math.pow(b2, step);
      for (var i2 = 0; i2 < H * K; i2++) adamUpdate(net.W2, mW2, vW2, gW2[i2] * inv, i2, bc1, bc2);
      for (var i3 = 0; i3 < K; i3++) adamUpdate(net.b2, mb2, vb2, gb2[i3] * inv, i3, bc1, bc2);
      for (var i4 = 0; i4 < H; i4++) adamUpdate(net.b1, mb1, vb1, gb1[i4] * inv, i4, bc1, bc2);
      Object.keys(gW1).forEach(function (r) {
        var g = gW1[r], base = r * H;
        for (var q = 0; q < H; q++) adamUpdate(net.W1, mW1, vW1, g[q] * inv, base + q, bc1, bc2);
      });
      return loss;
    }

    return new Promise(function (resolve) {
      var epoch = 0;
      function nextEpoch() {
        if (hooks.shouldStop && hooks.shouldStop()) return finish(true);
        epoch++;
        // mischen
        for (var i = train.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = train[i]; train[i] = train[j]; train[j] = t; }
        var lossSum = 0;
        for (var s = 0; s < train.length; s += batch) lossSum += runBatch(train.slice(s, s + batch));
        var tr = evaluate(net, train, classIndex), va = evaluate(net, val, classIndex);
        var stats = { epoch: epoch, epochs: epochs, loss: tr.loss, acc: tr.acc, valLoss: va.loss, valAcc: va.acc, ms: Date.now() - t0 };
        history.push(stats);
        // beste Epoche merken (niedrigster Prüf-Verlust)
        if (va.loss !== null && va.loss < best.loss) {
          best.loss = va.loss; best.epoch = epoch;
          best.W1.set(net.W1); best.b1.set(net.b1); best.W2.set(net.W2); best.b2.set(net.b2);
        }
        if (hooks.onEpoch) hooks.onEpoch(stats);
        if (epoch >= epochs) return finish(false);
        if (patience && best.epoch && epoch - best.epoch >= patience) {
          if (hooks.onLog) hooks.onLog('Früh gestoppt: Seit ' + patience + ' Epochen keine Verbesserung auf den Prüfdaten.');
          return finish(false, true);
        }
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(nextEpoch); else setTimeout(nextEpoch, 0);
      }
      function finish(stopped, early) {
        var last = history[history.length - 1] || {};
        if (best.epoch && cfg.keepBest !== false) {
          net.W1.set(best.W1); net.b1.set(best.b1); net.W2.set(best.W2); net.b2.set(best.b2);
          last = history[best.epoch - 1];
        }
        // Genauigkeit je Klasse auf den Prüfdaten
        var perClass = {};
        val.forEach(function (s) {
          var out = forward(net, s.x), arg = 0;
          for (var k = 1; k < K; k++) if (out.p[k] > out.p[arg]) arg = k;
          var pc = perClass[s.y] || (perClass[s.y] = { n: 0, ok: 0 });
          pc.n++; if (classes[arg] === s.y) pc.ok++;
        });
        resolve({
          model: { net: net, classes: classes },
          history: history, stopped: stopped, early: !!early, perClass: perClass,
          summary: { epochs: history.length, bestEpoch: best.epoch || history.length, loss: last.loss, acc: last.acc, valLoss: last.valLoss, valAcc: last.valAcc, samples: train.length, valSamples: val.length, params: D * H + H + H * K + K, ms: Date.now() - t0 },
        });
      }
      setTimeout(nextEpoch, 0);
    });
  };

  /* ---------- Speichern: 8-Bit-Gewichte als Base64 ---------- */
  function quant(arr) {
    var max = 0;
    for (var i = 0; i < arr.length; i++) { var a = Math.abs(arr[i]); if (a > max) max = a; }
    var scale = max / 127 || 1, q = new Int8Array(arr.length);
    for (var j = 0; j < arr.length; j++) q[j] = Math.round(arr[j] / scale);
    return { s: scale, d: U.bytesToB64(new Uint8Array(q.buffer)) };
  }
  function dequant(o, n) {
    var bytes = U.b64ToBytes(o.d), q = new Int8Array(bytes.buffer, bytes.byteOffset, n), out = new Float32Array(n);
    for (var i = 0; i < n; i++) out[i] = q[i] * o.s;
    return out;
  }
  function f32b64(arr) { return U.bytesToB64(new Uint8Array(arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength))); }
  function b64f32(s) { var b = U.b64ToBytes(s); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); }

  E.serialize = function (model) {
    var n = model.net;
    return { v: 1, D: n.D, H: n.H, K: n.K, classes: model.classes, W1: quant(n.W1), W2: quant(n.W2), b1: f32b64(n.b1), b2: f32b64(n.b2) };
  };
  E.deserialize = function (o) {
    if (!o || o.v !== 1) return null;
    try {
      return {
        classes: o.classes,
        net: { D: o.D, H: o.H, K: o.K, W1: dequant(o.W1, o.D * o.H), W2: dequant(o.W2, o.H * o.K), b1: new Float32Array(b64f32(o.b1)), b2: new Float32Array(b64f32(o.b2)) },
      };
    } catch (e) { return null; }
  };

  /* ---------- Antworten ---------- */
  var EMERGENCY = ['bewusstlos', 'atmet nicht', 'keine atmung', 'herzstillstand', 'herzinfarkt', 'schlaganfall', 'blutet stark', 'starke blutung',
    'viel blut', 'ertrink', 'vergiftet', 'vergiftung', 'kohlenmonoxid', 'gasgeruch', 'riecht nach gas', 'brennt', 'feuer im haus', 'erstickt',
    'stromschlag', 'krampfanfall', 'allergischer schock', 'atemnot', 'kriegt keine luft', 'bekommt keine luft', 'lebensgefahr', 'notfall'];
  E.isEmergency = function (text) {
    var t = U.normalize(text);
    return EMERGENCY.some(function (k) { return t.indexOf(U.normalize(k)) >= 0; });
  };

  var GREET = /^(hallo|hi|hey|moin|servus|gruess gott|guten (morgen|tag|abend)|na)\b/;
  var WHO = /(wer bist du|was kannst du|was bist du|hilfe$|^hilfe|wie funktionierst du|stell dich vor)/;
  var THANKS = /^(danke|vielen dank|dankeschoen|super danke|thx|merci)/;

  function modeNames(model) {
    return (model.modes || []).map(function (m) { var x = SK.MODES.filter(function (mm) { return mm.id === m; })[0]; return x ? x.name : m; });
  }
  function joinDe(list) {
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' und ' + list[list.length - 1];
  }
  E.modeText = function (model) { return joinDe(modeNames(model)); };

  function shorten(answer, maxItems) {
    var lines = answer.split('\n'), out = [], items = 0;
    for (var i = 0; i < lines.length; i++) {
      var isItem = /^\s*([-*•]|\d+[.)])\s+/.test(lines[i]);
      if (isItem) { items++; if (items > maxItems) continue; }
      else if (items > 0 && i > 0) continue; // Text nach der Liste weglassen
      out.push(lines[i]);
    }
    return out.join('\n');
  }

  /*
   * model: Modell aus dem Speicher (modes, categories, style, strict, name)
   * ctx: {index, classifier, examples}
   */
  E.answer = function (model, question, ctx) {
    var q = String(question || '').trim();
    var nq = U.normalize(q);
    var res = { text: '', sources: [], category: null, offTopic: false, confidence: 0, emergency: E.isEmergency(q), kind: 'answer' };
    var name = model.name || 'Survival-KI';
    if (!nq) { res.text = 'Stell mir eine Frage zu ' + E.modeText(model) + '.'; res.kind = 'empty'; return res; }

    if (THANKS.test(nq)) { res.text = 'Gern geschehen! Bleib sicher. Wenn du noch etwas wissen willst, frag einfach.'; res.kind = 'smalltalk'; return res; }
    if ((GREET.test(nq) && nq.split(' ').length <= 4) || WHO.test(nq)) {
      res.kind = 'smalltalk';
      res.text = 'Hallo, ich bin **' + name + '**, eine KI für ' + E.modeText(model) + '.\n' +
        'Frag mich zum Beispiel:\n' + suggestions(model, 3).map(function (s) { return '- ' + s; }).join('\n');
      return res;
    }

    var cats = E.modelCategories(model);
    var probs = null;
    if (ctx.classifier) {
      var pr = E.predict(ctx.classifier, q);
      probs = pr.probs;
      res.net = { top: pr.top, p: pr.p };
    }
    var hits = E.search(ctx.index, q, { categories: model.strict === false ? null : cats, probs: probs, limit: 5 });
    var top = hits[0];
    res.confidence = top ? Math.min(1, top.score / 0.55) : 0;
    res.sources = hits.slice(0, 4).map(function (h) { return { id: h.ex.id, q: h.ex.q, c: h.ex.c, score: h.score }; });
    if (top) res.category = { id: top.ex.c, p: probs ? probs[top.ex.c] || 0 : null };

    var pOff = probs ? probs[OFF] || 0 : 0;
    var weak = !top || top.score < 0.16;
    var offByNet = probs && pOff > 0.55 && (!top || top.score < 0.4);
    if ((offByNet || weak) && !res.emergency) {
      res.offTopic = true; res.kind = 'offtopic'; res.sources = [];
      res.text = 'Darauf bin ich nicht spezialisiert. Ich bin **' + name + '** und kenne mich mit ' + E.modeText(model) + ' aus.\n' +
        'Dazu kann ich dir zum Beispiel helfen:\n' + suggestions(model, 3).map(function (s) { return '- ' + s; }).join('\n');
      return res;
    }

    var text;
    if (top.score < 0.24) {
      res.kind = 'unsure';
      text = 'Ich bin mir nicht ganz sicher, ob ich dich richtig verstehe. Am besten passt diese Antwort:\n\n**' + top.ex.q + '**\n' + top.ex.a;
    } else {
      text = top.ex.a;
      if (model.style === 'kurz') text = shorten(text, 5);
      if (model.style === 'ausfuehrlich' && hits[1] && hits[1].score > 0.22 && hits[1].ex.id !== top.ex.id) {
        text += '\n\n**Dazu passt auch: ' + hits[1].ex.q + '**\n' + shorten(hits[1].ex.a, 4);
      }
    }
    if (res.emergency && text.indexOf('112') < 0) text = '**Bei Lebensgefahr sofort den Notruf 112 wählen.**\n\n' + text;
    else if (res.emergency) text = '**Notfall? Ruf sofort die 112 an.**\n\n' + text;
    else if (top.ex.c === 'erstehilfe' && text.indexOf('112') < 0) text += '\n\nBei Lebensgefahr immer zuerst die **112** anrufen.';
    res.text = text;
    return res;
  };

  E.modelCategories = function (model) {
    if (model.categories && model.categories.length) return model.categories.slice();
    return SK.CATEGORIES.filter(function (c) {
      return c.modes.some(function (m) { return (model.modes || []).indexOf(m) >= 0; });
    }).map(function (c) { return c.id; });
  };

  function suggestions(model, n) {
    var cats = E.modelCategories(model);
    var pool = (SK.BUILTIN || []).filter(function (e) { return cats.indexOf(e.c) >= 0; });
    var out = [], step = Math.max(1, Math.floor(pool.length / n));
    for (var i = 0; i < pool.length && out.length < n; i += step) out.push(pool[i].q);
    return out;
  }
  E.suggestions = suggestions;

  /* ---------- Bewertung für die Prüfung ---------- */
  var DECLINE = ['spezialisiert', 'nicht mein fachgebiet', 'nicht mein thema', 'ausserhalb meines', 'ausserhalb von', 'kann ich dir nicht',
    'kann ich nicht helfen', 'dabei kann ich nicht', 'darauf bin ich nicht', 'nur fragen', 'nur zu', 'nur bei', 'fachgebiet',
    'blackout', 'survival', 'apokalypse', 'krisenvorsorge', 'notfallvorsorge', 'ueberleben'];

  function has(text, key) {
    var k = U.normalize(key);
    if (!k) return false;
    if (k.length <= 3 || /\d/.test(k)) return new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(text);
    return text.indexOf(k) >= 0;
  }

  E.scoreAnswer = function (item, answer, meta) {
    var text = U.normalize(answer);
    if (item.kind === 'abgrenzung') {
      var declined = meta && meta.offTopic === true;
      if (!declined) declined = DECLINE.some(function (d) { return has(text, d); }) && text.length < 900;
      var leaked = (item.forbid || []).filter(function (f) { return has(text, f); });
      var pass = declined && !leaked.length;
      return { score: pass ? 1 : 0, hits: pass ? ['lehnt höflich ab'] : [], misses: pass ? [] : (leaked.length ? ['beantwortet fremdes Thema: ' + leaked.join(', ')] : ['lehnt nicht ab']), pass: pass };
    }
    var hits = [], misses = [];
    (item.keys || []).forEach(function (group) {
      var ok = group.some(function (k) { return has(text, k); });
      (ok ? hits : misses).push(group[0]);
    });
    var score = (item.keys && item.keys.length) ? hits.length / item.keys.length : 0;
    if (text.length < 40) score = Math.min(score, 0.25);
    return { score: score, hits: hits, misses: misses, pass: score >= 0.6 };
  };

  E.grade = function (score) {
    if (score === null || score === undefined) return { name: 'Noch nicht geprüft', level: 0 };
    if (score >= 0.9) return { name: 'Überlebens-Meister', level: 4 };
    if (score >= 0.75) return { name: 'Profi', level: 3 };
    if (score >= 0.55) return { name: 'Fortgeschritten', level: 2 };
    return { name: 'Anfänger', level: 1 };
  };

  E.OFF = OFF;
  return E;
})();
