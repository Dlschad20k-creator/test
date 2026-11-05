/*
 * Survival-KI Studio – Speicher
 * Alles bleibt im Browser (localStorage): Modelle, eigene Trainingsdaten, Trainingsläufe, Prüfungen, Chats.
 * Die eingebauten Trainingsdaten werden nicht kopiert, gespeichert werden nur Änderungen daran.
 */
var SK = (globalThis.SK = globalThis.SK || {});

SK.store = (function () {
  var U = SK.util;
  var KEY = 'ski.state.v1';
  var WKEY = 'ski.weights.';
  var KEYKEY = 'ski.apikey';
  var st = null, cache = { examples: null, weights: {} }, listeners = {};

  var DEFAULT_SETTINGS = {
    ollamaUrl: 'http://localhost:11434',
    openaiBase: 'https://api.openai.com/v1',
    openaiKey: '',
    rememberKey: false,
    trainerUrl: 'http://localhost:8765',
    theme: 'system',
    activeModel: 'preset-allround',
  };

  function presets() {
    var now = Date.now();
    function m(id, name, icon, modes, extra) {
      return Object.assign({
        id: id, name: name, icon: icon, modes: modes, categories: [], provider: 'offline', baseModel: '', endpoint: '',
        style: 'normal', tone: 'ruhig', strict: true, rag: true, temperature: 0.3, systemPrompt: '', preset: true,
        createdAt: now, updatedAt: now, trained: null, ollamaName: '', notes: '',
      }, extra || {});
    }
    return [
      m('preset-allround', 'Krisen-Allrounder', 'shield', ['blackout', 'survival', 'apokalypse'], { notes: 'Kennt alle drei Modi. Guter Start für alles.' }),
      m('preset-blackout', 'Blackout-Profi', 'bolt', ['blackout'], { notes: 'Nur Stromausfall: Licht, Wärme, Wasser, Vorrat, Kommunikation.' }),
      m('preset-survival', 'Wildnis-Scout', 'compass', ['survival'], { style: 'kurz', tone: 'knapp', notes: 'Überleben in der Natur, kurz und klar.' }),
      m('preset-apokalypse', 'Apokalypse-Stratege', 'radiation', ['apokalypse'], { style: 'ausfuehrlich', notes: 'Großkrisen, Strahlung, Evakuierung, Langzeit-Überleben.' }),
    ];
  }

  function defaults() {
    return {
      v: 1,
      models: presets(),
      dataset: { added: [], edited: {}, removed: [] },
      runs: [], evals: [], chats: {},
      settings: Object.assign({}, DEFAULT_SETTINGS),
      createdAt: Date.now(),
    };
  }

  var S = {};

  S.load = function () {
    var saved = U.storage.get(KEY, null);
    st = defaults();
    if (saved && saved.v === 1) {
      st.models = Array.isArray(saved.models) ? saved.models : st.models;
      st.dataset = Object.assign(st.dataset, saved.dataset || {});
      st.runs = saved.runs || [];
      st.evals = saved.evals || [];
      st.chats = saved.chats || {};
      st.settings = Object.assign({}, DEFAULT_SETTINGS, saved.settings || {});
      st.createdAt = saved.createdAt || st.createdAt;
    }
    if (!st.settings.rememberKey) {
      try { st.settings.openaiKey = sessionStorage.getItem(KEYKEY) || ''; } catch (e) { st.settings.openaiKey = ''; }
    }
    cache.examples = null;
    return st;
  };

  var writeNow = function () {
    var copy = Object.assign({}, st, { settings: Object.assign({}, st.settings) });
    if (!copy.settings.rememberKey) {
      try { if (copy.settings.openaiKey) sessionStorage.setItem(KEYKEY, copy.settings.openaiKey); else sessionStorage.removeItem(KEYKEY); } catch (e) { /* egal */ }
      copy.settings.openaiKey = '';
    }
    // Chats begrenzen, damit der Speicher nicht vollläuft
    Object.keys(copy.chats).forEach(function (k) { if (copy.chats[k].length > 80) copy.chats[k] = copy.chats[k].slice(-80); });
    var ok = U.storage.set(KEY, copy);
    if (!ok) S.emit('storage-full');
  };
  var writeSoon = U.debounce(writeNow, 250);
  S.save = function (now) { if (now) writeNow(); else writeSoon(); };

  S.on = function (evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); };
  S.emit = function (evt, data) { (listeners[evt] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); };

  /* ---------- Trainingsdaten ---------- */
  S.examples = function () {
    if (cache.examples) return cache.examples;
    var ds = st.dataset, removed = {};
    ds.removed.forEach(function (id) { removed[id] = 1; });
    var list = [];
    (SK.BUILTIN || []).forEach(function (ex) {
      if (removed[ex.id]) return;
      var e = ds.edited[ex.id];
      list.push(Object.assign({}, ex, e || {}, { id: ex.id, builtin: true, edited: !!e }));
    });
    ds.added.forEach(function (ex) { list.push(Object.assign({}, ex, { builtin: false, edited: false })); });
    cache.examples = list;
    return list;
  };
  S.example = function (id) { return S.examples().filter(function (e) { return e.id === id; })[0] || null; };
  S.isBuiltin = function (id) { return (SK.BUILTIN || []).some(function (e) { return e.id === id; }); };

  function cleanExample(ex) {
    return {
      id: ex.id, c: ex.c, q: String(ex.q || '').trim(), a: String(ex.a || '').trim(),
      alt: (ex.alt || []).map(function (x) { return String(x).trim(); }).filter(Boolean),
      src: ex.src || undefined,
    };
  }
  function datasetChanged() { cache.examples = null; S.save(); S.emit('dataset'); }

  S.saveExample = function (ex) {
    var e = cleanExample(ex);
    if (!e.id) e.id = U.uid('u');
    if (S.isBuiltin(e.id)) {
      st.dataset.edited[e.id] = { c: e.c, q: e.q, a: e.a, alt: e.alt };
      st.dataset.removed = st.dataset.removed.filter(function (x) { return x !== e.id; });
    } else {
      var i = st.dataset.added.findIndex(function (x) { return x.id === e.id; });
      if (i >= 0) st.dataset.added[i] = e; else st.dataset.added.push(e);
    }
    datasetChanged();
    return e.id;
  };
  S.addExamples = function (list) {
    var n = 0;
    list.forEach(function (ex) {
      var e = cleanExample(ex);
      if (!e.q || !e.a) return;
      e.id = U.uid('u');
      st.dataset.added.push(e); n++;
    });
    if (n) datasetChanged();
    return n;
  };
  S.removeExample = function (id) {
    if (S.isBuiltin(id)) { if (st.dataset.removed.indexOf(id) < 0) st.dataset.removed.push(id); delete st.dataset.edited[id]; }
    else st.dataset.added = st.dataset.added.filter(function (x) { return x.id !== id; });
    datasetChanged();
  };
  S.resetExample = function (id) {
    delete st.dataset.edited[id];
    st.dataset.removed = st.dataset.removed.filter(function (x) { return x !== id; });
    datasetChanged();
  };
  S.resetDataset = function () { st.dataset = { added: [], edited: {}, removed: [] }; datasetChanged(); };
  S.datasetInfo = function () {
    return { added: st.dataset.added.length, edited: Object.keys(st.dataset.edited).length, removed: st.dataset.removed.length };
  };
  // Prüfsumme der Daten, um zu merken, wann neu trainiert werden sollte
  S.datasetHash = function (categories) {
    var set = categories ? categories.reduce(function (o, c) { o[c] = 1; return o; }, {}) : null;
    var s = S.examples().filter(function (e) { return !set || set[e.c]; }).map(function (e) { return e.id + e.q + e.a.length + (e.alt || []).join('|'); }).join('#');
    return U.crc32(U.utf8(s)).toString(16);
  };

  /* ---------- Modelle ---------- */
  S.models = function () { return st.models; };
  S.model = function (id) { return st.models.filter(function (m) { return m.id === id; })[0] || null; };
  S.saveModel = function (m) {
    m.updatedAt = Date.now();
    if (!m.id) { m.id = U.uid('m'); m.createdAt = m.updatedAt; }
    var i = st.models.findIndex(function (x) { return x.id === m.id; });
    if (i >= 0) st.models[i] = m; else st.models.push(m);
    S.save(); S.emit('models');
    return m;
  };
  S.removeModel = function (id) {
    st.models = st.models.filter(function (m) { return m.id !== id; });
    delete st.chats[id];
    S.removeWeights(id);
    if (st.settings.activeModel === id) st.settings.activeModel = st.models[0] ? st.models[0].id : null;
    S.save(); S.emit('models');
  };
  S.duplicateModel = function (id) {
    var src = S.model(id);
    if (!src) return null;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = null; copy.name = src.name + ' (Kopie)'; copy.preset = false; copy.trained = null; copy.ollamaName = '';
    var m = S.saveModel(copy);
    var w = U.storage.get(WKEY + id, null);
    if (w) { U.storage.set(WKEY + m.id, w); m.trained = src.trained; S.saveModel(m); }
    return m;
  };
  S.restorePresets = function () {
    presets().forEach(function (p) { if (!S.model(p.id)) st.models.push(p); });
    S.save(); S.emit('models');
  };
  S.activeModel = function () { return S.model(st.settings.activeModel) || st.models[0] || null; };
  S.setActiveModel = function (id) { st.settings.activeModel = id; S.save(); S.emit('active'); };

  /* ---------- Gewichte der Offline-KI ---------- */
  S.weights = function (modelId) {
    if (cache.weights[modelId] !== undefined) return cache.weights[modelId];
    var raw = U.storage.get(WKEY + modelId, null);
    var model = raw ? SK.engine.deserialize(raw) : null;
    cache.weights[modelId] = model;
    return model;
  };
  S.setWeights = function (modelId, serialized) {
    var ok = U.storage.set(WKEY + modelId, serialized);
    cache.weights[modelId] = ok ? SK.engine.deserialize(serialized) : null;
    return ok;
  };
  S.removeWeights = function (modelId) { U.storage.remove(WKEY + modelId); delete cache.weights[modelId]; };

  /* ---------- Trainingsläufe & Prüfungen ---------- */
  S.runs = function (modelId) { return st.runs.filter(function (r) { return !modelId || r.modelId === modelId; }).sort(function (a, b) { return b.startedAt - a.startedAt; }); };
  S.run = function (id) { return st.runs.filter(function (r) { return r.id === id; })[0] || null; };
  S.addRun = function (run) {
    run.id = run.id || U.uid('run'); run.startedAt = run.startedAt || Date.now();
    st.runs.push(run);
    if (st.runs.length > 60) st.runs = st.runs.slice(-60);
    S.save(); S.emit('runs');
    return run;
  };
  S.updateRun = function (id, patch) {
    var r = S.run(id);
    if (!r) return null;
    Object.assign(r, patch);
    S.save(); S.emit('runs');
    return r;
  };
  S.removeRun = function (id) { st.runs = st.runs.filter(function (r) { return r.id !== id; }); S.save(); S.emit('runs'); };

  S.evals = function (modelId) { return st.evals.filter(function (e) { return !modelId || e.modelId === modelId; }).sort(function (a, b) { return b.at - a.at; }); };
  S.addEval = function (ev) {
    ev.id = ev.id || U.uid('ev'); ev.at = ev.at || Date.now();
    st.evals.push(ev);
    if (st.evals.length > 40) st.evals = st.evals.slice(-40);
    S.save(); S.emit('evals');
    return ev;
  };
  S.lastEval = function (modelId) { return S.evals(modelId)[0] || null; };

  /* ---------- Chats ---------- */
  S.chat = function (modelId) { return st.chats[modelId] || []; };
  S.setChat = function (modelId, msgs) { st.chats[modelId] = msgs; S.save(); };

  /* ---------- Einstellungen ---------- */
  S.settings = function () { return st.settings; };
  S.setSettings = function (patch) { Object.assign(st.settings, patch); S.save(); S.emit('settings'); };

  /* ---------- Sicherung ---------- */
  S.exportAll = function () {
    var weights = {};
    st.models.forEach(function (m) { var w = U.storage.get(WKEY + m.id, null); if (w) weights[m.id] = w; });
    var copy = JSON.parse(JSON.stringify(st));
    copy.settings.openaiKey = '';
    return { app: 'survival-ki-studio', v: 1, exportedAt: new Date().toISOString(), state: copy, weights: weights };
  };
  S.importAll = function (obj) {
    if (!obj || obj.app !== 'survival-ki-studio' || !obj.state) throw new Error('Das ist keine Sicherung vom Survival-KI Studio.');
    var key = st.settings.openaiKey;
    U.storage.set(KEY, obj.state);
    Object.keys(obj.weights || {}).forEach(function (id) { U.storage.set(WKEY + id, obj.weights[id]); });
    cache.weights = {};
    S.load();
    if (key && !st.settings.openaiKey) st.settings.openaiKey = key;
    S.save(true);
    S.emit('models'); S.emit('dataset'); S.emit('runs'); S.emit('evals'); S.emit('settings');
  };
  S.resetAll = function () {
    U.storage.keys('ski.').forEach(function (k) { U.storage.remove(k); });
    try { sessionStorage.removeItem(KEYKEY); } catch (e) { /* egal */ }
    cache.weights = {};
    st = defaults();
    S.save(true);
    S.emit('models'); S.emit('dataset'); S.emit('runs'); S.emit('evals'); S.emit('settings');
  };

  /* ---------- Modell-Status ---------- */
  S.modelStatus = function (m) {
    var w = S.weights(m.id);
    var ev = S.lastEval(m.id);
    var out = { trained: !!(m.trained && w), stale: false, score: ev ? ev.score : null, evalAt: ev ? ev.at : null };
    if (out.trained && m.trained.hash && m.trained.hash !== S.datasetHash(SK.engine.modelCategories(m))) out.stale = true;
    return out;
  };

  return S;
})();

/* ---------- Systemprompt: macht aus jedem Sprachmodell einen Krisen-Profi ---------- */
SK.prompts = (function () {
  var P = {};
  var FOCUS = {
    blackout: 'Blackout und Stromausfall: Licht und Notstrom, Heizen ohne Strom, Wasser- und Lebensmittelvorrat, Kühlung, Kommunikation ohne Netz, Bargeld, Hilfe für Nachbarn.',
    survival: 'Survival in der Natur: Wasser finden und aufbereiten, Feuer, Unterschlupf, Orientierung, Rettungssignale, Kälte und Hitze, Erste Hilfe ohne Arzt.',
    apokalypse: 'Großkrisen und Apokalypse-Szenarien: Evakuierung und Notgepäck, Strahlung, Chemieunfälle, Pandemien, Naturkatastrophen, Sicherheit und Gemeinschaft, Selbstversorgung auf lange Sicht.',
  };
  var STYLE = {
    kurz: 'Antworte kurz und klar: höchstens 5 Punkte, das Wichtigste zuerst.',
    normal: 'Antworte klar und praktisch: ein kurzer Einleitungssatz, dann nummerierte Schritte oder Stichpunkte mit konkreten Mengen und Zeiten.',
    ausfuehrlich: 'Antworte ausführlich: erkläre Schritte, Gründe, typische Fehler und gib am Ende einen Profi-Tipp.',
  };
  var TONE = {
    ruhig: 'Dein Ton ist ruhig, freundlich und beruhigend, wie bei einer erfahrenen Katastrophenschutz-Helferin.',
    knapp: 'Dein Ton ist knapp und bestimmt, wie bei einem Einsatzleiter: klare Anweisungen, keine Floskeln.',
    kinder: 'Erkläre alles so einfach, dass auch Kinder ab 10 Jahren es verstehen, freundlich und ohne Angst zu machen.',
  };
  P.STYLE = STYLE; P.TONE = TONE;

  P.system = function (model) {
    if (model.systemPrompt && model.systemPrompt.trim()) return model.systemPrompt.trim();
    return P.generate(model);
  };

  P.generate = function (model) {
    var modes = (model.modes && model.modes.length ? model.modes : ['blackout', 'survival', 'apokalypse']);
    var lines = [];
    lines.push('Du bist „' + (model.name || 'Survival-KI') + '“, ein KI-Experte für ' + SK.engine.modeText({ modes: modes }) + '.');
    lines.push('Deine Aufgabe: Menschen helfen, Krisen sicher zu überstehen, praktisch, ruhig und fachlich korrekt.');
    lines.push('');
    lines.push('Fachgebiete:');
    modes.forEach(function (m) { if (FOCUS[m]) lines.push('- ' + FOCUS[m]); });
    lines.push('');
    lines.push('Regeln:');
    lines.push('1. Sicherheit zuerst: Bei Lebensgefahr nennst du zuerst den Notruf 112 (Polizei 110).');
    lines.push('2. Gib konkrete Schritte mit Mengen, Zeiten und Reihenfolge.');
    lines.push('3. Warne deutlich vor gefährlichen Fehlern, zum Beispiel vor Kohlenmonoxid durch Grill, Generator oder Heizpilz in Innenräumen.');
    lines.push('4. Orientiere dich an offiziellen Empfehlungen (BBK, Feuerwehr, Rotes Kreuz, Bundesamt für Strahlenschutz).');
    lines.push('5. Erfinde nichts. Wenn du dir unsicher bist, sag es und nenne, wo man verlässliche Informationen bekommt.');
    if (model.strict !== false) {
      lines.push('6. Beantworte nur Fragen zu deinen Fachgebieten. Bei anderen Themen antwortest du in einem Satz, dass du auf ' + SK.engine.modeText({ modes: modes }) + ' spezialisiert bist, und bietest passende Themen an.');
    }
    lines.push((model.strict !== false ? '7' : '6') + '. Keine Anleitungen für Waffen, Gewalt oder Straftaten. Setze auf Vermeidung, Deeskalation und Schutz.');
    lines.push('');
    lines.push('Stil: ' + (STYLE[model.style] || STYLE.normal));
    lines.push(TONE[model.tone] || TONE.ruhig);
    lines.push('Antworte immer auf Deutsch.');
    return lines.join('\n');
  };

  // Wissen aus den Trainingsdaten als Zusatz für Sprachmodelle (RAG)
  P.context = function (hits) {
    if (!hits || !hits.length) return '';
    return 'Wissen aus deiner Trainingsdatenbank. Nutze es, wenn es zur Frage passt, und ergänze eigenes Fachwissen:\n\n' +
      hits.map(function (h, i) { return '[' + (i + 1) + '] Frage: ' + h.ex.q + '\nAntwort: ' + SK.util.plain(h.ex.a); }).join('\n\n');
  };

  return P;
})();
