/* Survival-KI Studio – Training: fünf Wege, eine KI zum Profi zu machen */
(function () {
  var U = SK.util, I = SK.icons, A = SK.app, X = SK.exporter;

  var METHODS = [
    { id: 'browser', name: 'Im Browser', icon: 'browser', time: 'Sekunden', cost: 'kostenlos', needs: 'nichts', what: 'Trainiert die eingebaute Offline-KI: Ein neuronales Netz lernt, Fragen den Themen zuzuordnen und fremde Fragen zu erkennen. Auch mit Tippfehlern.' },
    { id: 'ollama', name: 'Ollama-Sofortmodell', icon: 'laptop', time: '1 Minute', cost: 'kostenlos', needs: 'Ollama auf dem PC', what: 'Erstellt in Ollama ein eigenes Modell mit Profi-Systemprompt und Beispielgesprächen aus deinen Trainingsdaten. Die Gewichte ändern sich nicht, aber das Modell verhält sich sofort wie ein Survival-Experte.' },
    { id: 'colab', name: 'Google Colab', icon: 'cloud', time: '10–40 Minuten', cost: 'kostenlos', needs: 'Google-Konto', what: 'Echtes Fine-Tuning mit LoRA auf einer kostenlosen Grafikkarte von Google. Du lädst ein fertiges Notebook herunter, startest es, und bekommst eine GGUF-Datei für Ollama.' },
    { id: 'local', name: 'Eigener PC', icon: 'cpu', time: 'je nach Grafikkarte', cost: 'kostenlos', needs: 'Python, am besten NVIDIA-GPU', what: 'Echtes Fine-Tuning mit LoRA auf deinem Rechner. Der lokale Trainer zeigt den Fortschritt live hier an und importiert das fertige Modell in Ollama.' },
    { id: 'openai', name: 'OpenAI', icon: 'sparkles', time: '10–60 Minuten', cost: 'kostet pro Token', needs: 'OpenAI-API-Schlüssel', what: 'Fine-Tuning in der Cloud von OpenAI. Die Trainingsdaten werden hochgeladen, OpenAI trainiert, und das neue Modell erscheint unter Meine Modelle.' },
  ];
  var OA_BASES = ['gpt-4.1-mini-2025-04-14', 'gpt-4.1-nano-2025-04-14', 'gpt-4o-mini-2024-07-18', 'gpt-4.1-2025-04-14'];

  var st = {
    method: 'browser', modelId: null,
    browser: { epochs: 30, lr: 0.01, hidden: 48, augment: true, running: false, stop: false },
    ft: { baseId: 'qwen2.5-7b', method: 'qlora', epochs: 3, lr: 0.0002, r: 16, alpha: 16, dropout: 0, maxSeq: 1024, batch: 2, accum: 4, warmup: 5, quant: 'q4_k_m', export: 'drive', hfRepo: '', system: 'kurz', augment: true, offTopic: true, customHf: '' },
    ollama: { from: '', name: '', shots: 8 },
    local: { job: null, polling: false, since: 0, log: [], loss: [], status: null, localBaseSet: false },
    openai: { model: OA_BASES[0], epochs: 'auto', suffix: '', polling: {} },
  };
  var root, panel;

  function model() { return SK.store.model(st.modelId) || SK.store.activeModel(); }
  function examples() { return SK.store.examples(); }
  function busy() { return st.browser.running || st.local.polling; }

  /* ---------- gemeinsame Teile ---------- */
  function methodIntro(meth) {
    var dl = U.el('dl', { class: 'method-facts' }, [
      U.el('dt', null, 'Dauer'), U.el('dd', null, meth.time),
      U.el('dt', null, 'Kosten'), U.el('dd', null, meth.cost),
      U.el('dt', null, 'Brauchst du'), U.el('dd', null, meth.needs),
    ]);
    return U.el('div', { class: 'method-intro' }, [U.el('p', { class: 'lede' }, meth.what), dl]);
  }

  function numField(label, key, obj, attrs, hint, fmt) {
    var inp = U.el('input', Object.assign({ type: 'number', id: 'ft-' + key, value: obj[key] }, attrs || {}));
    inp.addEventListener('input', function () { var v = Number(inp.value); if (!isNaN(v)) { obj[key] = v; if (fmt) fmt(); } });
    return A.field(label, inp, hint);
  }
  function selField(label, key, obj, options, hint, onChange) {
    var sel = U.el('select', { id: 'ft-' + key });
    options.forEach(function (o) { var op = U.el('option', { value: o[0] }, o[1]); if (String(obj[key]) === String(o[0])) op.selected = true; sel.appendChild(op); });
    sel.addEventListener('change', function () { obj[key] = isNaN(Number(sel.value)) || sel.value === '' ? sel.value : Number(sel.value); if (onChange) onChange(); });
    return A.field(label, sel, hint);
  }
  function checkField(label, sub, key, obj, onChange) {
    var cb = U.el('input', { type: 'checkbox', id: 'ft-' + key }); cb.checked = !!obj[key];
    cb.addEventListener('change', function () { obj[key] = cb.checked; if (onChange) onChange(); });
    return U.el('label', { class: 'check' }, [cb, U.el('span', null, [U.el('b', null, label), sub ? U.el('small', null, sub) : null])]);
  }

  function convs(m) { return X.conversations(m, examples(), { system: st.ft.system, augment: st.ft.augment, offTopic: st.ft.offTopic }); }

  function addRun(m, method, extra) {
    return SK.store.addRun(Object.assign({ modelId: m.id, modelName: m.name, method: method, status: 'laufend' }, extra || {}));
  }

  // Schnelle Prüfung der Offline-KI (alle Fragen, dauert Millisekunden)
  function quickEval(m, save) {
    var index = SK.ai.offlineIndex(), cls = SK.store.weights(m.id);
    var total = 0, weight = 0, per = {}, results = [];
    SK.BENCHMARK.forEach(function (item) {
      var r = SK.engine.answer(m, item.q, { index: index, classifier: cls });
      var sc = SK.engine.scoreAnswer(item, r.text, r);
      var w = item.critical ? 2 : 1;
      total += sc.score * w; weight += w;
      per[item.mode] = per[item.mode] || { s: 0, n: 0 }; per[item.mode].s += sc.score; per[item.mode].n++;
      results.push({ id: item.id, score: sc.score, hits: sc.hits, misses: sc.misses, answer: r.text });
    });
    var score = total / weight;
    if (save) {
      var perMode = {}; Object.keys(per).forEach(function (k) { perMode[k] = per[k].s / per[k].n; });
      SK.store.addEval({ modelId: m.id, modelName: m.name, score: score, perMode: perMode, results: results, kind: 'auto', provider: 'offline' });
    }
    return score;
  }

  /* ================= 1. Browser ================= */
  function panelBrowser(m) {
    var wrap = U.el('div', { class: 'stack' });
    if (m.provider !== 'offline') {
      wrap.appendChild(A.callout('', 'help', 'Hinweis', '„' + m.name + '“ nutzt ein Sprachmodell (' + SK.ai.providerLabel(m) + '). Das Browser-Training gilt nur für die Offline-KI. Für Sprachmodelle nimm Ollama-Sofortmodell, Colab, Eigener PC oder OpenAI.'));
    }
    var cats = SK.engine.modelCategories(m);
    var n = examples().filter(function (e) { return cats.indexOf(e.c) >= 0; }).length;
    var b = st.browser;
    var cfg = U.el('div', { class: 'form-grid' }, [
      selField('Epochen', 'epochs', b, [[10, '10 (schnell)'], [30, '30 (empfohlen)'], [60, '60'], [100, '100 (gründlich)']], 'So oft geht das Netz alle Beispiele durch.'),
      selField('Lernrate', 'lr', b, [[0.003, '0,003 (vorsichtig)'], [0.01, '0,01 (empfohlen)'], [0.03, '0,03 (mutig)']], 'Wie stark jede Runde die Gewichte ändert.'),
      selField('Neuronen', 'hidden', b, [[24, '24'], [48, '48 (empfohlen)'], [96, '96']], 'Größe der versteckten Schicht.'),
    ]);
    wrap.appendChild(U.el('div', { class: 'card stack' }, [
      U.el('div', { class: 'row-between' }, [U.el('h3', { class: 'card-title' }, 'Einstellungen'), U.el('span', { class: 'muted small' }, n + ' Beispiele in ' + cats.length + ' Themen, dazu Tippfehler-Varianten und ' + (m.strict !== false ? 'fremde Fragen' : 'keine fremden Fragen'))]),
      cfg,
      checkField('Mit Tippfehlern üben', 'Das Netz sieht jede Frage zusätzlich mit vertauschten oder fehlenden Buchstaben.', 'augment', b),
    ]));
    var startBtn = A.btn(b.running ? 'Läuft …' : 'Training starten', 'play', function () { runBrowser(m, live); }, 'btn-primary btn-lg', { disabled: b.running ? true : null });
    var stopBtn = A.btn('Stoppen', 'stop', function () { b.stop = true; }, 'btn-lg', { hidden: !b.running });
    wrap.appendChild(U.el('div', { class: 'actions' }, [startBtn, stopBtn]));
    var live = U.el('div', { class: 'stack' });
    wrap.appendChild(live);
    live.startBtn = startBtn; live.stopBtn = stopBtn;
    if (m.trained) {
      live.appendChild(resultCard(m.trained, null, null));
    }
    return wrap;
  }

  function resultCard(t, before, after) {
    var tiles = [
      tile('Themen erkannt', U.fmtPct(t.topicAcc), 'bei neuen Formulierungen'),
      tile('Fremde Fragen erkannt', t.offAcc === null || t.offAcc === undefined ? '–' : U.fmtPct(t.offAcc), 'werden höflich abgelehnt'),
      tile('Parameter', U.fmtNum(t.params), t.epochs + ' Epochen'),
      tile('Trainiert', U.fmtDate(t.at).split(',')[0], U.fmtDuration((t.ms || 0) / 1000)),
    ];
    if (before !== null && after !== null && before !== undefined) tiles.unshift(tile('Prüfung', U.fmtPct(before) + ' → ' + U.fmtPct(after), SK.engine.grade(after).name));
    return U.el('div', { class: 'card stack' }, [
      U.el('div', { class: 'row-between' }, [U.el('h3', { class: 'card-title' }, 'Ergebnis'), A.btn('Ausführlich prüfen', 'clipboard', function () { A.go('pruefung'); }, 'btn-sm')]),
      U.el('div', { class: 'stats' }, tiles),
    ]);
  }
  function tile(label, value, sub) { return U.el('div', { class: 'stat' }, [U.el('span', { class: 'label' }, label), U.el('span', { class: 'stat-v' }, value), U.el('span', { class: 'stat-s' }, sub)]); }

  function trainingLive(host, title) {
    host.innerHTML = '';
    var prog = U.el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Fortschritt' }, [U.el('span')]);
    var status = U.el('p', { class: 'small', 'aria-live': 'polite' }, 'Starte …');
    var lossHost = U.el('div'), accHost = U.el('div');
    var log = U.el('div', { class: 'log', role: 'log', 'aria-live': 'off' });
    var box = U.el('div', { class: 'card stack' }, [
      U.el('div', { class: 'row-between' }, [U.el('h3', { class: 'card-title' }, title), status]),
      prog,
      U.el('div', { class: 'chart-pair' }, [
        U.el('div', { class: 'chart-box' }, [U.el('h4', null, 'Verlust (sollte sinken)'), lossHost]),
        U.el('div', { class: 'chart-box' }, [U.el('h4', null, 'Genauigkeit (sollte steigen)'), accHost]),
      ]),
      U.el('details', null, [U.el('summary', { class: 'small', style: 'cursor:pointer' }, 'Protokoll'), log]),
    ]);
    host.appendChild(box);
    return {
      progress: function (p, text) { prog.firstChild.style.width = Math.round(p * 100) + '%'; prog.setAttribute('aria-valuenow', Math.round(p * 100)); if (text) status.textContent = text; },
      log: function (line) { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; },
      charts: function (loss, acc) {
        SK.charts.line(lossHost, { series: loss, height: 190, xName: 'Epoche', label: 'Verlust je Epoche', yFormat: function (v) { return v.toFixed(2); } });
        if (acc) SK.charts.line(accHost, { series: acc, height: 190, yMin: 0, yMax: 1, xName: 'Epoche', label: 'Genauigkeit je Epoche', yFormat: function (v) { return Math.round(v * 100) + ' %'; } });
        else accHost.parentNode.hidden = true;
      },
      box: box,
    };
  }

  async function runBrowser(m, live) {
    var b = st.browser;
    if (b.running) return;
    b.running = true; b.stop = false;
    live.startBtn.disabled = true; live.startBtn.querySelector('span').textContent = 'Läuft …'; live.stopBtn.hidden = false;
    var before = quickEval(m, false);
    var run = addRun(m, 'browser', { config: { epochs: b.epochs, lr: b.lr, hidden: b.hidden, augment: b.augment } });
    var view = trainingLive(live, 'Training läuft im Browser');
    var cats = SK.engine.modelCategories(m), hist = [];
    view.log('Prüfung vorher: ' + U.fmtPct(before));
    try {
      var out = await SK.engine.train(examples(), cats, { epochs: b.epochs, lr: b.lr, hidden: b.hidden, augment: b.augment, strict: m.strict !== false }, {
        onLog: view.log,
        shouldStop: function () { return b.stop; },
        onEpoch: function (s) {
          hist.push(s);
          view.progress(s.epoch / s.epochs, 'Epoche ' + s.epoch + ' von ' + s.epochs);
          view.log('Epoche ' + s.epoch + ': Verlust ' + s.loss.toFixed(3) + ' · Training ' + U.fmtPct(s.acc) + ' · Prüfung ' + U.fmtPct(s.valAcc));
          view.charts(
            [{ name: 'Training', color: 'var(--series-1)', points: hist.map(function (h) { return [h.epoch, h.loss]; }) }, { name: 'Prüfdaten', color: 'var(--series-2)', points: hist.map(function (h) { return [h.epoch, h.valLoss]; }) }],
            [{ name: 'Training', color: 'var(--series-1)', points: hist.map(function (h) { return [h.epoch, h.acc]; }) }, { name: 'Prüfdaten', color: 'var(--series-2)', points: hist.map(function (h) { return [h.epoch, h.valAcc]; }) }]
          );
        },
      });
      if (out.stopped) throw new Error('Training gestoppt.');
      var pc = out.perClass, off = pc[SK.engine.OFF], tn = 0, tok = 0;
      Object.keys(pc).forEach(function (k) { if (k !== SK.engine.OFF) { tn += pc[k].n; tok += pc[k].ok; } });
      var trained = {
        at: Date.now(), hash: SK.store.datasetHash(cats), epochs: out.summary.epochs, bestEpoch: out.summary.bestEpoch, params: out.summary.params, ms: out.summary.ms,
        topicAcc: tn ? tok / tn : out.summary.valAcc, offAcc: off ? off.ok / off.n : null, valAcc: out.summary.valAcc,
      };
      var ok = SK.store.setWeights(m.id, SK.engine.serialize(out.model));
      if (!ok) throw new Error('Das trainierte Netz passt nicht mehr in den Browser-Speicher. Lösche alte Modelle oder Chats.');
      var fresh = SK.store.model(m.id); fresh.trained = trained; SK.store.saveModel(fresh);
      if (out.early) view.log('Beste Epoche: ' + out.summary.bestEpoch + ' (diese Gewichte werden behalten).');
      var after = quickEval(fresh, true);
      view.log('Prüfung nachher: ' + U.fmtPct(after));
      view.progress(1, 'Fertig');
      SK.store.updateRun(run.id, { status: 'fertig', finishedAt: Date.now(), metrics: { topicAcc: trained.topicAcc, offAcc: trained.offAcc, before: before, after: after, epochs: trained.epochs } });
      live.appendChild(resultCard(trained, before, after));
      U.toast('Training fertig: Prüfung ' + U.fmtPct(before) + ' → ' + U.fmtPct(after), 'ok');
    } catch (e) {
      SK.store.updateRun(run.id, { status: e.message === 'Training gestoppt.' ? 'abgebrochen' : 'fehler', finishedAt: Date.now(), error: e.message });
      view.progress(0, e.message);
      U.toast(e.message, 'error');
    }
    b.running = false;
    live.startBtn.disabled = false; live.startBtn.querySelector('span').textContent = 'Noch einmal trainieren'; live.stopBtn.hidden = true;
    drawHistory();
  }

  /* ================= 2. Ollama-Sofortmodell ================= */
  function panelOllama(m) {
    var wrap = U.el('div', { class: 'stack' });
    var s = SK.store.settings(), o = st.ollama;
    if (!o.name || o.forModel !== m.id) { o.name = X.ollamaName(m); o.forModel = m.id; o.from = ''; }
    var list = A.status.ollamaModels || [];
    if (!o.from) o.from = (m.provider === 'ollama' && m.baseModel) || (list[0] && list[0].name) || 'llama3.2:3b';
    var conn = U.el('div');
    function drawConn() {
      conn.innerHTML = '';
      if (A.status.ollama) conn.appendChild(A.callout('ok', 'check', 'Ollama verbunden', list.length + ' Modelle unter ' + s.ollamaUrl + '.'));
      else conn.appendChild(A.callout('warn', 'alert', 'Ollama nicht erreichbar', ollamaHelp()));
    }
    drawConn();
    wrap.appendChild(conn);
    var dl = U.el('datalist', { id: 'dl-from' });
    list.forEach(function (x) { dl.appendChild(U.el('option', { value: x.name }, x.params || '')); });
    var from = U.el('input', { type: 'text', id: 'o-from', list: 'dl-from', value: o.from });
    var name = U.el('input', { type: 'text', id: 'o-name', value: o.name });
    var shots = U.el('input', { type: 'range', id: 'o-shots', min: 0, max: 20, step: 1, value: o.shots });
    var shotsOut = U.el('output', null, String(o.shots));
    var preview = U.el('pre', { class: 'code' });
    function upd() {
      o.from = from.value.trim(); o.name = U.slug(name.value) || 'survival-ki'; o.shots = Number(shots.value);
      shotsOut.textContent = String(o.shots);
      preview.textContent = X.modelfile(m, o.from || 'llama3.2:3b', o.shots);
      cmdHost.innerHTML = ''; cmdHost.appendChild(A.cmd('ollama create ' + o.name + ' -f Modelfile'));
    }
    var cmdHost = U.el('div');
    [from, name, shots].forEach(function (x) { x.addEventListener('input', upd); });
    wrap.appendChild(U.el('div', { class: 'card stack' }, [
      dl,
      U.el('div', { class: 'form-grid' }, [
        A.field('Basismodell in Ollama', from, list.length ? 'Ein Modell von deinem PC' : 'z. B. llama3.2:3b, qwen2.5:7b, mistral:7b'),
        A.field('Name des neuen Modells', name, 'Klein, ohne Leerzeichen'),
        A.field('Beispielgespräche', U.el('div', { class: 'range-row' }, [shots, shotsOut]), 'Mehr Beispiele = besserer Stil, aber etwas mehr Rechenzeit pro Antwort.'),
      ]),
      U.el('details', null, [U.el('summary', { class: 'small', style: 'cursor:pointer' }, 'Modelfile ansehen'), preview]),
    ]));
    var statusEl = U.el('p', { class: 'small', 'aria-live': 'polite' });
    var createBtn = A.btn('In Ollama erstellen', 'play', async function () {
      createBtn.disabled = true; statusEl.textContent = 'Erstelle „' + o.name + '“ …';
      var run = addRun(m, 'ollama', { config: { from: o.from, name: o.name, shots: o.shots } });
      try {
        var body = X.ollamaCreateBody(m, o.from, o.shots, o.name);
        try {
          await SK.ai.ollama.create(s.ollamaUrl, body, function (t) { statusEl.textContent = 'Ollama: ' + t; });
        } catch (e) {
          if (!/modelfile|path/i.test(e.message)) throw e;
          // sehr alte Ollama-Versionen erwarten ein Modelfile
          await SK.ai.ollama.create(s.ollamaUrl, { name: o.name, modelfile: X.modelfile(m, o.from, o.shots), stream: true }, function (t) { statusEl.textContent = 'Ollama: ' + t; });
        }
        SK.store.updateRun(run.id, { status: 'fertig', finishedAt: Date.now(), metrics: { ollamaName: o.name } });
        statusEl.textContent = '';
        A.checkConnections();
        done.innerHTML = '';
        done.appendChild(A.callout('ok', 'check', '„' + o.name + '“ ist in Ollama bereit', U.el('div', { class: 'stack-sm' }, [
          U.el('span', null, 'Teste es im Terminal mit „ollama run ' + o.name + '“ oder direkt hier.'),
          U.el('div', { class: 'actions' }, [A.btn('Als Gehirn für „' + m.name + '“ verwenden', 'link', function () {
            var fresh = SK.store.model(m.id); fresh.provider = 'ollama'; fresh.ollamaName = o.name; fresh.baseModel = o.from; SK.store.saveModel(fresh);
            U.toast('„' + m.name + '“ antwortet jetzt mit ' + o.name, 'ok'); A.go('chat');
          }, 'btn-primary btn-sm')]),
        ])));
      } catch (e) {
        SK.store.updateRun(run.id, { status: 'fehler', finishedAt: Date.now(), error: e.message });
        statusEl.textContent = '';
        done.innerHTML = ''; done.appendChild(A.callout('bad', 'alert', 'Erstellen fehlgeschlagen', e.message));
      }
      createBtn.disabled = false; drawHistory();
    }, 'btn-primary btn-lg');
    var dlBtn = A.btn('Modelfile herunterladen', 'download', function () { U.download('Modelfile', X.modelfile(m, o.from, o.shots), 'text/plain;charset=utf-8'); });
    var done = U.el('div');
    wrap.appendChild(U.el('div', { class: 'actions' }, [createBtn, dlBtn]));
    wrap.appendChild(statusEl);
    wrap.appendChild(U.el('div', { class: 'stack-sm' }, [U.el('span', { class: 'small muted' }, 'Ohne Verbindung: Modelfile herunterladen, im selben Ordner ein Terminal öffnen und ausführen:'), cmdHost]));
    wrap.appendChild(done);
    upd();
    return wrap;
  }

  function ollamaHelp() {
    var origin = location.origin;
    var local = /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|file:\/\/|null)$/.test(origin) || location.protocol === 'file:';
    var box = U.el('div', { class: 'stack-sm' }, [U.el('span', null, 'Installiere Ollama von ollama.com und starte es.' + (local ? '' : ' Weil diese Seite nicht über localhost läuft, muss Ollama sie erst erlauben:'))]);
    if (!local) {
      box.appendChild(U.el('span', { class: 'small' }, 'Windows (PowerShell), danach Ollama neu starten:'));
      box.appendChild(A.cmd('setx OLLAMA_ORIGINS "' + origin + '"'));
      box.appendChild(U.el('span', { class: 'small' }, 'Mac:'));
      box.appendChild(A.cmd('launchctl setenv OLLAMA_ORIGINS "' + origin + '"'));
      box.appendChild(U.el('span', { class: 'small' }, 'Linux / Terminal:'));
      box.appendChild(A.cmd('OLLAMA_ORIGINS="' + origin + '" ollama serve'));
    }
    return box;
  }
  SK.ollamaHelp = ollamaHelp;

  /* ================= 3. Colab & 4. Lokal: gemeinsame Einstellungen ================= */
  function fineTuneSettings(m, onChange, forLocal) {
    var ft = st.ft;
    var wrap = U.el('div', { class: 'stack' });
    var cs = convs(m), stats = X.stats(cs);
    var info = A.status.trainerInfo;
    var baseList = U.el('div', { class: 'base-list', role: 'radiogroup', 'aria-label': 'Basismodell' });
    SK.BASES.forEach(function (b) {
      var est = X.estimate(b, ft, stats);
      var fit;
      if (forLocal && info && info.device === 'cuda') fit = est.vram <= info.vram_gb * 0.92 ? ['ok', 'passt (' + est.vram.toFixed(1) + ' / ' + info.vram_gb + ' GB)'] : ['bad', 'zu groß (' + est.vram.toFixed(1) + ' GB)'];
      else if (forLocal && info) fit = b.params <= 0.6 ? ['ok', 'geht auf ' + (info.device === 'mps' ? 'Mac' : 'CPU')] : b.params <= 1.6 ? ['warn', 'langsam auf ' + (info.device === 'mps' ? 'Mac' : 'CPU')] : ['bad', 'sehr langsam ohne GPU'];
      else fit = est.fitsT4 ? ['ok', 'passt auf T4 · ≈ ' + Math.round(est.minutes) + ' min'] : ['bad', 'zu groß für T4'];
      var radio = U.el('input', { type: 'radio', name: 'base', tabindex: -1 }); radio.checked = ft.baseId === b.id;
      var btn = U.el('button', { type: 'button', class: 'base', role: 'radio', 'aria-checked': String(ft.baseId === b.id) }, [radio, U.el('b', null, b.name), U.el('span', { class: 'base-fit pill pill-' + fit[0] }, fit[1]), U.el('small', null, b.note + ' · ' + b.ollama)]);
      btn.addEventListener('click', function () { ft.baseId = b.id; onChange(); });
      baseList.appendChild(btn);
    });
    wrap.appendChild(U.el('div', { class: 'field' }, [U.el('span', null, 'Basismodell'), baseList]));
    wrap.appendChild(U.el('div', { class: 'form-grid' }, [
      selField('Methode', 'method', ft, [['qlora', 'QLoRA 4 Bit (empfohlen)'], ['lora', 'LoRA 16 Bit'], ['full', 'Volles Fine-Tuning']], 'QLoRA braucht am wenigsten Grafikspeicher.', onChange),
      selField('Epochen', 'epochs', ft, [[1, '1'], [2, '2'], [3, '3 (empfohlen)'], [5, '5'], [8, '8']], 'Zu viele Epochen = Auswendiglernen.', onChange),
      selField('Systemprompt im Training', 'system', ft, [['kurz', 'kurz (empfohlen)'], ['voll', 'voll'], ['keiner', 'keiner']], 'Kurz spart Rechenzeit.', onChange),
    ]));
    var adv = U.el('details', { class: 'inset' }, [U.el('summary', { style: 'cursor:pointer;font-weight:600' }, 'Profi-Einstellungen')]);
    adv.open = !!st.advOpen;
    adv.addEventListener('toggle', function () { st.advOpen = adv.open; });
    adv.appendChild(U.el('div', { class: 'form-grid', style: 'margin-top:12px' }, [
      selField('Lernrate', 'lr', ft, [[0.00005, '5e-5'], [0.0001, '1e-4'], [0.0002, '2e-4 (empfohlen)'], [0.0005, '5e-4']], null, onChange),
      selField('LoRA-Rang r', 'r', ft, [[8, '8'], [16, '16 (empfohlen)'], [32, '32'], [64, '64']], 'Größer = mehr lernfähig, mehr Speicher', onChange),
      selField('LoRA-Alpha', 'alpha', ft, [[8, '8'], [16, '16'], [32, '32'], [64, '64']], null, onChange),
      selField('Max. Länge (Token)', 'maxSeq', ft, [[512, '512'], [1024, '1024 (empfohlen)'], [2048, '2048']], null, onChange),
      selField('Batch-Größe', 'batch', ft, [[1, '1'], [2, '2'], [4, '4'], [8, '8']], null, onChange),
      selField('Gradient-Akkumulation', 'accum', ft, [[1, '1'], [2, '2'], [4, '4'], [8, '8']], 'Batch × Akkumulation = effektive Batch-Größe', onChange),
      numField('Aufwärm-Schritte', 'warmup', ft, { min: 0, max: 100 }),
      numField('LoRA-Dropout', 'dropout', ft, { min: 0, max: 0.5, step: 0.05 }),
    ]));
    adv.appendChild(U.el('div', { class: 'stack-sm', style: 'margin-top:12px' }, [
      checkField('Andere Formulierungen als eigene Beispiele', 'Mehr Daten, robustere KI', 'augment', ft, onChange),
      checkField('Ablehnungen für fremde Themen', 'Die KI lernt, nur bei ihrem Fachgebiet zu bleiben', 'offTopic', ft, onChange),
    ]));
    var custom = U.el('input', { type: 'text', id: 'ft-custom', value: ft.customHf, placeholder: 'z. B. Qwen/Qwen2.5-14B-Instruct' });
    custom.addEventListener('change', function () { ft.customHf = custom.value.trim(); onChange(); });
    adv.appendChild(U.el('div', { style: 'margin-top:12px' }, [A.field('Eigenes Hugging-Face-Modell (optional)', custom, 'Ersetzt das oben gewählte Basismodell. Die Modellfamilie (Chat-Vorlage) wird vom gewählten Basismodell übernommen.')]));
    wrap.appendChild(adv);

    // Schätzung
    var base = X.base(ft.baseId), est = X.estimate(base, ft, stats);
    var cap = forLocal && info && info.vram_gb ? info.vram_gb : 15;
    var pct = Math.min(100, est.vram / Math.max(cap, est.vram) * 100);
    var cls = est.vram <= cap * 0.8 ? '' : est.vram <= cap ? 'warn' : 'bad';
    wrap.appendChild(U.el('div', { class: 'card stack-sm' }, [
      U.el('div', { class: 'row-between' }, [U.el('h3', { class: 'card-title' }, 'Schätzung'), U.el('span', { class: 'small muted' }, cs.length + ' Gespräche · ≈ ' + U.fmtNum(stats.tokens) + ' Token · ' + est.steps + ' Schritte')]),
      U.el('div', { class: 'vram' }, [
        U.el('div', { class: 'row-between small' }, [U.el('span', null, 'Grafikspeicher ≈ ' + est.vram.toFixed(1) + ' GB'), U.el('span', { class: 'muted' }, forLocal && info ? (info.vram_gb ? 'deine GPU: ' + info.vram_gb + ' GB' : 'ohne Grafikkarte: nutzt den Arbeitsspeicher') : 'Colab T4: 15 GB')]),
        U.el('div', { class: 'vram-bar', role: 'img', 'aria-label': 'Grafikspeicher ' + est.vram.toFixed(1) + ' von ' + cap + ' Gigabyte' }, [U.el('span', { class: cls, style: 'width:' + pct + '%' })]),
      ]),
      U.el('p', { class: 'small muted' }, forLocal ? 'Dauer hängt stark von deiner Hardware ab.' : 'Dauer auf der Colab-T4 ≈ ' + Math.round(est.minutes) + ' Minuten (Training) plus etwa 5–10 Minuten für Download und GGUF-Export.'),
    ]));
    return { el: wrap, convs: cs, est: est };
  }

  /* ================= 3. Colab ================= */
  function panelColab(m) {
    var wrap = U.el('div', { class: 'stack' });
    var host = U.el('div');
    var ft = st.ft;
    function draw() {
      host.innerHTML = '';
      var f = fineTuneSettings(m, draw, false);
      host.appendChild(f.el);
      var exp = U.el('div', { class: 'form-grid' }, [
        selField('GGUF-Qualität', 'quant', ft, [['q4_k_m', 'q4_k_m (klein, empfohlen)'], ['q5_k_m', 'q5_k_m'], ['q8_0', 'q8_0 (groß, genauer)']], 'Format für Ollama'),
        selField('Ergebnis', 'export', ft, [['drive', 'in Google Drive speichern'], ['download', 'als ZIP herunterladen'], ['huggingface', 'auf Hugging Face hochladen']], null, draw),
      ]);
      if (ft.export === 'huggingface') {
        var repo = U.el('input', { type: 'text', id: 'ft-repo', value: ft.hfRepo, placeholder: 'deinname/' + X.ollamaName(m) });
        repo.addEventListener('input', function () { ft.hfRepo = repo.value.trim(); });
        exp.appendChild(A.field('Hugging-Face-Repo', repo, 'Danach: ollama run hf.co/deinname/…'));
      }
      host.appendChild(U.el('div', { class: 'card stack' }, [U.el('h3', { class: 'card-title' }, 'Export'), exp]));
      var nbBtn = A.btn('Notebook herunterladen', 'download', function () {
        var nb = X.notebook(m, Object.assign({}, ft, { minutes: f.est.minutes }), f.convs);
        U.download(X.ollamaName(m) + '-training.ipynb', nb, 'application/x-ipynb+json');
        addRun(m, 'colab', { status: 'exportiert', finishedAt: Date.now(), config: Object.assign({}, ft), metrics: { conversations: f.convs.length } });
        drawHistory();
        U.toast('Notebook gespeichert. Jetzt in Google Colab hochladen.', 'ok');
      }, 'btn-primary btn-lg');
      var colab = U.el('a', { class: 'btn btn-lg', href: 'https://colab.research.google.com/', target: '_blank', rel: 'noopener', html: I.get('external') + '<span>Google Colab öffnen</span>' });
      var jsonl = A.btn('Nur Trainingsdaten (JSONL)', 'database', function () { U.download(X.ollamaName(m) + '.jsonl', X.toJsonl(f.convs), 'application/jsonl'); }, 'btn-ghost');
      host.appendChild(U.el('div', { class: 'actions' }, [nbBtn, colab, jsonl]));
      host.appendChild(U.el('div', { class: 'card stack-sm' }, [
        U.el('h3', { class: 'card-title' }, 'So geht es'),
        U.el('ol', { class: 'md', style: 'padding-left:1.2em;display:grid;gap:6px;margin:0' }, [
          U.el('li', null, 'Notebook herunterladen und Google Colab öffnen.'),
          U.el('li', null, 'In Colab: Datei → Notebook hochladen → die .ipynb-Datei wählen.'),
          U.el('li', null, 'Laufzeit → Laufzeittyp ändern → T4-GPU, dann Laufzeit → Alle ausführen.'),
          U.el('li', null, 'Am Ende liegen GGUF-Datei und Modelfile in Google Drive (Ordner ' + X.ollamaName(m) + ').'),
          U.el('li', null, 'Auf dem PC im Ordner ausführen: ollama create ' + X.ollamaName(m) + ' -f Modelfile'),
          U.el('li', null, 'Hier unten eintragen, dann antwortet „' + m.name + '“ mit deinem trainierten Modell.'),
        ]),
        connectOllamaRow(m, X.ollamaName(m)),
      ]));
    }
    wrap.appendChild(host);
    draw();
    return wrap;
  }

  function connectOllamaRow(m, defName) {
    var inp = U.el('input', { type: 'text', id: 'link-ollama', value: defName, 'aria-label': 'Name des Ollama-Modells' });
    var btn = A.btn('Trainiertes Modell verwenden', 'link', function () {
      var fresh = SK.store.model(m.id); fresh.provider = 'ollama'; fresh.ollamaName = inp.value.trim(); fresh.baseModel = inp.value.trim(); SK.store.saveModel(fresh);
      U.toast('„' + m.name + '“ antwortet jetzt mit ' + inp.value.trim() + ' aus Ollama', 'ok');
    }, 'btn-sm');
    return U.el('div', { class: 'row' }, [U.el('div', { style: 'flex:1;min-width:180px' }, [inp]), btn]);
  }

  /* ================= 4. Eigener PC (lokaler Trainer) ================= */
  function panelLocal(m) {
    var wrap = U.el('div', { class: 'stack' });
    var s = SK.store.settings();
    var connBox = U.el('div', { class: 'card stack' });
    var url = U.el('input', { type: 'url', id: 'tr-url', value: s.trainerUrl });
    var connectBtn = A.btn('Verbinden', 'link', async function () {
      SK.store.setSettings({ trainerUrl: url.value.trim() });
      connectBtn.disabled = true;
      try { A.status.trainerInfo = await SK.ai.trainer.info(url.value.trim()); A.status.trainer = true; U.toast('Trainer verbunden', 'ok'); }
      catch (e) { A.status.trainer = false; A.status.trainerInfo = null; U.toast(e.message, 'error'); }
      connectBtn.disabled = false;
      drawLocal();
    }, 'btn-primary');
    var host = U.el('div', { class: 'stack' });
    function drawLocal() {
      connBox.innerHTML = '';
      var info = A.status.trainerInfo;
      connBox.appendChild(U.el('div', { class: 'row-between' }, [U.el('h3', { class: 'card-title' }, 'Verbindung zum Trainer'), info ? U.el('span', { class: 'pill pill-ok', html: I.get('check') + 'verbunden' }) : U.el('span', { class: 'pill pill-neutral' }, 'nicht verbunden')]));
      connBox.appendChild(U.el('div', { class: 'row' }, [U.el('div', { style: 'flex:1;min-width:220px' }, [url]), connectBtn]));
      if (info) {
        connBox.appendChild(U.el('dl', { class: 'facts' }, [
          U.el('dt', null, 'Gerät'), U.el('dd', null, info.device === 'cuda' ? 'NVIDIA ' + info.gpu + ' (' + info.vram_gb + ' GB)' : info.device === 'mps' ? info.gpu + ' (Metal)' : 'Prozessor (ohne Grafikkarte, langsam)'),
          U.el('dt', null, 'Software'), U.el('dd', null, 'torch ' + (info.versions.torch || '–') + ', transformers ' + (info.versions.transformers || '–') + ', peft ' + (info.versions.peft || '–')),
          U.el('dt', null, 'Ollama'), U.el('dd', null, info.ollama ? 'gefunden, Modell wird automatisch importiert' : 'nicht gefunden'),
          U.el('dt', null, 'Ausgabe'), U.el('dd', { class: 'mono small' }, info.output),
        ]));
        if (!st.local.localBaseSet) {
          st.local.localBaseSet = true;
          st.ft.baseId = info.device === 'cuda' ? (info.vram_gb >= 12 ? 'qwen2.5-7b' : info.vram_gb >= 6 ? 'qwen2.5-3b' : 'qwen2.5-1.5b') : 'qwen2.5-0.5b';
          if (info.device !== 'cuda') st.ft.method = 'lora';
        }
      } else {
        connBox.appendChild(setupSteps());
      }
      host.innerHTML = '';
      if (info) {
        var f = fineTuneSettings(m, drawLocal, true);
        host.appendChild(f.el);
        var startBtn = A.btn(st.local.polling ? 'Training läuft …' : 'Training starten', 'play', function () { startLocal(m, f.convs, liveHost); }, 'btn-primary btn-lg', { disabled: st.local.polling || info.busy ? true : null });
        var zipBtn = A.btn('Trainingspaket (ZIP)', 'download', function () { downloadPackage(m, f.convs); }, 'btn-ghost');
        host.appendChild(U.el('div', { class: 'actions' }, [startBtn, zipBtn]));
        if (info.busy && !st.local.polling) host.appendChild(A.callout('warn', 'alert', 'Der Trainer ist beschäftigt', 'Es läuft schon ein Training. Warte, bis es fertig ist.'));
      }
      var liveHost = U.el('div', { class: 'stack' });
      host.appendChild(liveHost);
      if (st.local.job) renderLocalLive(liveHost);
    }
    wrap.appendChild(connBox);
    wrap.appendChild(host);
    drawLocal();
    return wrap;
  }

  function setupSteps() {
    var origin = location.origin;
    var allowed = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === 'https://dlschad20k-creator.github.io' || location.protocol === 'file:';
    var serve = 'python survival_trainer.py serve' + (allowed ? '' : ' --allow-origin ' + origin);
    var dl = U.el('a', { class: 'btn btn-sm', href: 'trainer/survival_trainer.py', download: 'survival_trainer.py', html: I.get('download') + '<span>survival_trainer.py</span>' });
    var req = U.el('a', { class: 'btn btn-sm', href: 'trainer/requirements.txt', download: 'requirements.txt', html: I.get('download') + '<span>requirements.txt</span>' });
    return U.el('div', { class: 'stack-sm' }, [
      U.el('p', { class: 'muted' }, 'So startest du den Trainer (einmalig einrichten):'),
      U.el('ol', { style: 'margin:0;padding-left:1.2em;display:grid;gap:8px' }, [
        U.el('li', null, [U.el('span', null, 'Python 3.10 oder neuer installieren (python.org). Mit NVIDIA-Grafikkarte zusätzlich PyTorch mit CUDA von pytorch.org.')]),
        U.el('li', null, [U.el('span', null, 'Beide Dateien in einen Ordner laden: '), U.el('span', { class: 'row', style: 'display:inline-flex' }, [dl, req])]),
        U.el('li', null, [U.el('span', null, 'Im Ordner ein Terminal öffnen und installieren:'), A.cmd('pip install -r requirements.txt')]),
        U.el('li', null, [U.el('span', null, 'Trainer starten und oben auf „Verbinden“ klicken:'), A.cmd(serve)]),
      ]),
    ]);
  }

  async function downloadPackage(m, cs) {
    try {
      var bytes = await X.trainingPackage(m, st.ft, cs);
      U.download(X.ollamaName(m) + '-trainingspaket.zip', new Blob([bytes], { type: 'application/zip' }));
      addRun(m, 'local', { status: 'exportiert', finishedAt: Date.now(), config: Object.assign({}, st.ft), metrics: { conversations: cs.length } });
      drawHistory();
    } catch (e) { U.toast(e.message, 'error'); }
  }

  async function startLocal(m, cs, liveHost) {
    var s = SK.store.settings(), L = st.local;
    var job = X.trainerJob(m, st.ft, cs);
    try {
      var res = await SK.ai.trainer.start(s.trainerUrl, job);
      L.job = res.job; L.name = res.name; L.since = 0; L.log = []; L.loss = []; L.status = null; L.modelId = m.id;
      L.run = addRun(m, 'local', { externalId: res.job, config: Object.assign({}, st.ft), metrics: { conversations: cs.length } }).id;
      renderLocalLive(liveHost);
      pollLocal();
      drawHistory();
    } catch (e) { U.toast(e.message, 'error'); }
  }

  var localView = null;
  function renderLocalLive(host) {
    var L = st.local;
    localView = trainingLive(host, 'Training auf deinem PC');
    var stopBtn = A.btn('Stoppen', 'stop', async function () { try { await SK.ai.trainer.stop(SK.store.settings().trainerUrl, L.job); U.toast('Wird gestoppt …'); } catch (e) { U.toast(e.message, 'error'); } }, 'btn-sm');
    localView.box.querySelector('.row-between').appendChild(stopBtn);
    localView.stopBtn = stopBtn;
    localView.result = U.el('div', { class: 'stack' });
    host.appendChild(localView.result);
    L.log.forEach(function (l) { localView.log(l); });
    updateLocalView();
  }
  function updateLocalView() {
    var L = st.local, v = localView, s = L.status;
    if (!v || !s) return;
    var p = s.total_steps ? s.step / s.total_steps : 0;
    var labels = { wartet: 'Wartet', laden: 'Lädt Modell …', training: 'Trainiert', speichern: 'Speichert …', ollama: 'Importiert in Ollama …', fertig: 'Fertig', fehler: 'Fehler', abgebrochen: 'Abgebrochen' };
    v.progress(s.state === 'fertig' ? 1 : p, (labels[s.state] || s.state) + (s.state === 'training' ? ' · Schritt ' + s.step + '/' + s.total_steps + (s.eta ? ' · noch ' + U.fmtDuration(s.eta) : '') : ''));
    if (L.loss.length) v.charts([{ name: 'Verlust', color: 'var(--series-1)', points: L.loss.map(function (x) { return [x[0], x[1]]; }) }], null);
    v.stopBtn.hidden = ['fertig', 'fehler', 'abgebrochen'].indexOf(s.state) >= 0;
    if (s.state === 'fertig' && !v.result.childNodes.length) {
      var m = SK.store.model(L.modelId) || model();
      var actions = [];
      if (s.ollama_model) actions.push(A.btn('Als Gehirn verwenden (Ollama: ' + s.ollama_model + ')', 'link', function () {
        var fresh = SK.store.model(m.id); fresh.provider = 'ollama'; fresh.ollamaName = s.ollama_model; fresh.baseModel = s.ollama_model; SK.store.saveModel(fresh); U.toast('„' + m.name + '“ nutzt jetzt ' + s.ollama_model, 'ok');
      }, 'btn-primary btn-sm'));
      actions.push(A.btn('Direkt im Trainer testen', 'chat', function () {
        var copy = { name: m.name + ' (trainiert)', icon: 'cpu', modes: m.modes.slice(), categories: (m.categories || []).slice(), provider: 'trainer', trainerJob: L.job, style: m.style, tone: m.tone, strict: m.strict, rag: m.rag, temperature: m.temperature, systemPrompt: '', notes: 'Fine-Tuning vom ' + U.fmtDate(Date.now()) };
        var saved = SK.store.saveModel(copy); A.useModel(saved.id, 'chat');
      }, 'btn-sm'));
      v.result.appendChild(A.callout('ok', 'check', 'Training fertig', U.el('div', { class: 'stack-sm' }, [
        U.el('span', null, 'Gespeichert in: ' + (s.output_dir || '')),
        U.el('span', null, s.ollama_model ? 'In Ollama als „' + s.ollama_model + '“ verfügbar.' : 'Ollama-Import: im Ordner „ollama create ' + (L.name || 'survival-ki') + ' -f Modelfile“ ausführen.'),
        U.el('div', { class: 'actions' }, actions),
      ])));
    }
    if (s.state === 'fehler' && !v.result.childNodes.length) v.result.appendChild(A.callout('bad', 'alert', 'Training fehlgeschlagen', s.error || 'Unbekannter Fehler'));
  }
  async function pollLocal() {
    var L = st.local;
    if (L.polling) return;
    L.polling = true;
    var url = SK.store.settings().trainerUrl;
    while (L.polling) {
      try {
        var s = await SK.ai.trainer.status(url, L.job, L.since);
        L.status = s; L.since = s.log_total; L.loss = s.loss || [];
        s.log.forEach(function (line) { L.log.push(line); if (localView) localView.log(line); });
        updateLocalView();
        if (['fertig', 'fehler', 'abgebrochen'].indexOf(s.state) >= 0) {
          L.polling = false;
          SK.store.updateRun(L.run, { status: s.state, finishedAt: Date.now(), error: s.error || undefined, metrics: { steps: s.step, loss: s.loss.length ? s.loss[s.loss.length - 1][1] : null, firstLoss: s.loss.length ? s.loss[0][1] : null, ollama: s.ollama_model, output: s.output_dir } });
          A.checkConnections();
          drawHistory();
          if (s.state === 'fertig') U.toast('Lokales Training fertig', 'ok');
          break;
        }
      } catch (e) { if (localView) localView.log('Verbindung unterbrochen: ' + e.message); }
      await U.sleep(1500);
    }
    L.polling = false;
  }

  /* ================= 5. OpenAI ================= */
  function panelOpenAI(m) {
    var wrap = U.el('div', { class: 'stack' });
    var s = SK.store.settings(), o = st.openai;
    if (!o.suffix || o.forModel !== m.id) { o.suffix = X.ollamaName(m).slice(0, 18); o.forModel = m.id; }
    if (!s.openaiKey) {
      var key = U.el('input', { type: 'password', id: 'oa-key-inline', placeholder: 'sk-…', autocomplete: 'off' });
      wrap.appendChild(U.el('div', { class: 'card stack-sm' }, [
        A.callout('warn', 'alert', 'API-Schlüssel fehlt', 'Den Schlüssel bekommst du auf platform.openai.com unter API keys. Er bleibt nur in diesem Browser (in den Einstellungen kannst du ihn dauerhaft merken).'),
        U.el('div', { class: 'row' }, [U.el('div', { style: 'flex:1;min-width:220px' }, [key]), A.btn('Übernehmen', 'check', function () { SK.store.setSettings({ openaiKey: key.value.trim() }); redrawPanel(); }, 'btn-primary')]),
      ]));
    }
    var dl = U.el('datalist', { id: 'dl-oa-base' });
    OA_BASES.forEach(function (n) { dl.appendChild(U.el('option', { value: n })); });
    var base = U.el('input', { type: 'text', id: 'oa-base', list: 'dl-oa-base', value: o.model });
    base.addEventListener('input', function () { o.model = base.value.trim(); });
    var suffix = U.el('input', { type: 'text', id: 'oa-suffix', value: o.suffix, maxlength: 18 });
    suffix.addEventListener('input', function () { o.suffix = U.slug(suffix.value).slice(0, 18); });
    var cs = convs(m), stt = X.stats(cs);
    var info = U.el('p', { class: 'small muted' });
    function upd() {
      var ep = o.epochs === 'auto' ? 3 : Number(o.epochs);
      info.textContent = cs.length + ' Gespräche · ≈ ' + U.fmtNum(stt.tokens) + ' Token pro Epoche · ≈ ' + U.fmtNum(stt.tokens * ep) + ' Trainings-Token (' + (o.epochs === 'auto' ? 'bei 3 Epochen' : ep + ' Epochen') + '). Abgerechnet wird pro Trainings-Token, die Preise stehen auf openai.com/api/pricing.';
    }
    wrap.appendChild(U.el('div', { class: 'card stack' }, [
      dl,
      U.el('div', { class: 'form-grid' }, [
        A.field('Basismodell', base, 'Welche Modelle feinjustierbar sind, steht in der OpenAI-Doku.'),
        A.field('Namenszusatz', suffix, 'erscheint im Modellnamen ft:…:' + o.suffix),
        selField('Epochen', 'epochs', o, [['auto', 'automatisch'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [6, '6']], null, upd),
      ]),
      U.el('div', { class: 'form-grid' }, [selField('Systemprompt im Training', 'system', st.ft, [['kurz', 'kurz'], ['voll', 'voll'], ['keiner', 'keiner']], null, redrawPanel)]),
      info,
    ]));
    upd();
    var startBtn = A.btn('Hochladen und Training starten', 'upload', async function () {
      var key2 = SK.store.settings().openaiKey;
      if (!key2) { U.toast('Bitte zuerst den API-Schlüssel eintragen.', 'error'); return; }
      if (cs.length < 10) { U.toast('OpenAI braucht mindestens 10 Trainingsgespräche.', 'error'); return; }
      startBtn.disabled = true;
      var baseUrl = SK.store.settings().openaiBase;
      try {
        U.toast('Lade Trainingsdaten hoch …');
        var file = await SK.ai.openai.uploadFile(baseUrl, key2, X.toJsonl(cs), X.ollamaName(m) + '.jsonl');
        var job = await SK.ai.openai.createJob(baseUrl, key2, { model: o.model, fileId: file.id, suffix: o.suffix, epochs: o.epochs });
        var run = addRun(m, 'openai', { externalId: job.id, config: { model: o.model, epochs: o.epochs, suffix: o.suffix }, metrics: { conversations: cs.length, status: job.status } });
        U.toast('Training bei OpenAI gestartet', 'ok');
        pollOpenAI(run.id);
        drawHistory();
      } catch (e) { U.toast(e.message, 'error'); }
      startBtn.disabled = false;
    }, 'btn-primary btn-lg');
    wrap.appendChild(U.el('div', { class: 'actions' }, [startBtn, A.btn('JSONL herunterladen', 'download', function () { U.download(X.ollamaName(m) + '-openai.jsonl', X.toJsonl(cs), 'application/jsonl'); }, 'btn-ghost')]));
    var jobs = U.el('div', { class: 'stack', id: 'oa-jobs' });
    wrap.appendChild(jobs);
    drawOpenAIJobs(jobs, m);
    return wrap;
  }

  function drawOpenAIJobs(host, m) {
    host.innerHTML = '';
    SK.store.runs(m.id).filter(function (r) { return r.method === 'openai' && r.externalId; }).slice(0, 3).forEach(function (r) {
      var met = r.metrics || {};
      var card = U.el('div', { class: 'card stack-sm' }, [
        U.el('div', { class: 'row-between' }, [U.el('b', { class: 'mono small' }, r.externalId), statusPill(r.status)]),
        U.el('p', { class: 'small muted' }, 'Basis ' + (r.config && r.config.model) + ' · OpenAI-Status: ' + (met.status || '–') + (met.trainedTokens ? ' · ' + U.fmtNum(met.trainedTokens) + ' Token trainiert' : '')),
      ]);
      if (met.loss && met.loss.length) { var ch = U.el('div'); card.appendChild(ch); setTimeout(function () { SK.charts.line(ch, { series: [{ name: 'Verlust', color: 'var(--series-1)', points: met.loss }], height: 170, xName: 'Schritt', area: true, yFormat: function (v) { return v.toFixed(2); } }); }, 0); }
      if (met.events && met.events.length) card.appendChild(U.el('details', null, [U.el('summary', { class: 'small', style: 'cursor:pointer' }, 'Meldungen von OpenAI'), U.el('div', { class: 'log' }, met.events.join('\n'))]));
      var act = U.el('div', { class: 'actions' });
      if (r.status === 'laufend') {
        act.appendChild(A.btn('Aktualisieren', 'refresh', function () { pollOpenAI(r.id, true); }, 'btn-sm'));
        act.appendChild(A.btn('Abbrechen', 'stop', async function () { try { await SK.ai.openai.cancel(SK.store.settings().openaiBase, SK.store.settings().openaiKey, r.externalId); pollOpenAI(r.id, true); } catch (e) { U.toast(e.message, 'error'); } }, 'btn-sm btn-danger'));
      }
      if (met.fineTuned) act.appendChild(U.el('span', { class: 'pill pill-ok' }, 'Modell: ' + met.fineTuned));
      card.appendChild(act);
      host.appendChild(card);
      if (r.status === 'laufend' && !st.openai.polling[r.id]) pollOpenAI(r.id);
    });
  }

  async function pollOpenAI(runId, once) {
    var P = st.openai.polling;
    if (P[runId] && !once) return;
    if (!once) P[runId] = true;
    do {
      var r = SK.store.run(runId), s = SK.store.settings();
      if (!r || !s.openaiKey) break;
      try {
        var job = await SK.ai.openai.job(s.openaiBase, s.openaiKey, r.externalId);
        var events = await SK.ai.openai.events(s.openaiBase, s.openaiKey, r.externalId);
        var loss = [];
        events.forEach(function (ev) {
          var d = ev.data || {};
          var step = d.step, l = d.train_loss;
          if (step === undefined) { var mm = /Step (\d+)\/\d+: training loss=([\d.]+)/.exec(ev.message || ''); if (mm) { step = Number(mm[1]); l = Number(mm[2]); } }
          if (step !== undefined && l !== undefined && l !== null) loss.push([Number(step), Number(l)]);
        });
        var met = Object.assign({}, r.metrics || {}, { status: job.status, trainedTokens: job.trained_tokens, fineTuned: job.fine_tuned_model, loss: loss.slice(-400), events: events.filter(function (ev) { return ev.type !== 'metrics'; }).slice(-30).map(function (ev) { return new Date(ev.created_at * 1000).toLocaleTimeString('de-DE') + '  ' + ev.message; }) });
        var status = job.status === 'succeeded' ? 'fertig' : job.status === 'failed' ? 'fehler' : job.status === 'cancelled' ? 'abgebrochen' : 'laufend';
        SK.store.updateRun(runId, { status: status, metrics: met, finishedAt: status !== 'laufend' ? Date.now() : undefined, error: job.error && job.error.message ? job.error.message : undefined });
        if (status === 'fertig' && job.fine_tuned_model && !met.added) {
          var src = SK.store.model(r.modelId) || model();
          var nm = { name: (src ? src.name : 'Survival-KI') + ' (OpenAI)', icon: 'sparkles', modes: src ? src.modes.slice() : ['blackout', 'survival', 'apokalypse'], categories: src ? (src.categories || []).slice() : [], provider: 'openai', baseModel: job.fine_tuned_model, endpoint: '', style: src ? src.style : 'normal', tone: src ? src.tone : 'ruhig', strict: src ? src.strict : true, rag: true, temperature: 0.3, systemPrompt: '', notes: 'Fine-Tuning bei OpenAI vom ' + U.fmtDate(Date.now()) };
          if (I.MODEL_ICONS.indexOf(nm.icon) < 0) nm.icon = 'shield';
          SK.store.saveModel(nm);
          met.added = true; SK.store.updateRun(runId, { metrics: met });
          U.toast('Neues Modell „' + nm.name + '“ unter Meine Modelle', 'ok');
        }
        if (A.current() === 'training' && st.method === 'openai') { var host = U.$('#oa-jobs'); if (host) drawOpenAIJobs(host, model()); }
        if (status !== 'laufend') break;
      } catch (e) { console.warn(e); }
      if (once) break;
      await U.sleep(15000);
    } while (P[runId]);
    if (!once) P[runId] = false;
  }

  /* ---------- Verlauf ---------- */
  function statusPill(status) {
    var map = { fertig: ['ok', 'fertig'], laufend: ['accent', 'läuft'], fehler: ['bad', 'Fehler'], abgebrochen: ['neutral', 'abgebrochen'], exportiert: ['neutral', 'exportiert'] };
    var x = map[status] || ['neutral', status];
    return U.el('span', { class: 'pill pill-' + x[0] }, x[1]);
  }
  var historyHost = null;
  function drawHistory() {
    if (!historyHost) return;
    var m = model();
    historyHost.innerHTML = '';
    var runs = SK.store.runs(m.id).slice(0, 12);
    historyHost.appendChild(U.el('h3', { class: 'card-title' }, 'Trainingsverlauf von „' + m.name + '“'));
    if (!runs.length) { historyHost.appendChild(U.el('p', { class: 'muted' }, 'Noch keine Trainingsläufe.')); return; }
    var list = U.el('div', { class: 'run-list' });
    runs.forEach(function (r) {
      var meth = METHODS.filter(function (x) { return x.id === r.method; })[0] || { name: r.method, icon: 'train' };
      var met = r.metrics || {}, desc = [];
      if (met.before !== undefined && met.after !== undefined) desc.push('Prüfung ' + U.fmtPct(met.before) + ' → ' + U.fmtPct(met.after));
      if (met.topicAcc !== undefined) desc.push('Themen ' + U.fmtPct(met.topicAcc));
      if (met.ollamaName) desc.push('Ollama: ' + met.ollamaName);
      if (met.conversations) desc.push(met.conversations + ' Gespräche');
      if (met.firstLoss) desc.push('Verlust ' + met.firstLoss.toFixed(2) + ' → ' + (met.loss || 0).toFixed(2));
      if (met.fineTuned) desc.push(met.fineTuned);
      if (r.error) desc.push(r.error);
      list.appendChild(U.el('div', { class: 'run' }, [
        U.el('span', { class: 'model-badge', html: I.get(meth.icon) }),
        U.el('div', null, [U.el('b', null, meth.name), U.el('div', { class: 'small muted' }, U.fmtDate(r.startedAt) + (desc.length ? ' · ' + desc.join(' · ') : ''))]),
        statusPill(r.status),
      ]));
    });
    historyHost.appendChild(list);
  }

  /* ---------- Ansicht ---------- */
  function redrawPanel() {
    if (!panel) return;
    var m = model();
    panel.innerHTML = '';
    var meth = METHODS.filter(function (x) { return x.id === st.method; })[0];
    panel.appendChild(methodIntro(meth));
    var fn = { browser: panelBrowser, ollama: panelOllama, colab: panelColab, local: panelLocal, openai: panelOpenAI }[st.method];
    panel.appendChild(fn(m));
    drawHistory();
  }

  SK.views.training = {
    title: 'Training',
    keep: true,
    render: function (el) {
      root = el;
      var active = SK.store.activeModel();
      st.modelId = active ? active.id : null;
      if (active && active.provider !== 'offline' && st.method === 'browser') st.method = active.provider === 'ollama' ? 'ollama' : 'colab';
      var sel = A.modelSelect('t-model', st.modelId, function (v) {
        st.modelId = v; SK.store.setActiveModel(v);
        if (busy()) { U.toast('Ein Training läuft noch. Es wird im Hintergrund fortgesetzt.'); }
        redrawPanel();
      });
      el.appendChild(A.head('Training', 'KI trainieren',
        'Wähle, welche KI du trainierst und wie. Für den Start: erst im Browser trainieren, dann mit Ollama ein echtes Sprachmodell zum Profi machen, und für das Beste ein Fine-Tuning in Google Colab.', []));
      el.appendChild(U.el('div', { class: 'card row-between' }, [A.field('Welche KI trainierst du?', sel), A.btn('Neue KI erstellen', 'plus', function () { A.go('modelle'); setTimeout(function () { SK.views.modelle.wizard(); }, 50); }, 'btn-ghost')]));
      var tabs = U.el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Trainingsmethode' });
      METHODS.forEach(function (meth) {
        var t = U.el('button', { type: 'button', class: 'tab', role: 'tab', id: 'tab-' + meth.id, 'aria-selected': String(st.method === meth.id), html: I.get(meth.icon) });
        t.appendChild(U.el('span', null, meth.name));
        t.addEventListener('click', function () { st.method = meth.id; U.$$('.tab', tabs).forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); }); redrawPanel(); });
        tabs.appendChild(t);
      });
      el.appendChild(tabs);
      panel = U.el('div', { class: 'stack', role: 'tabpanel' });
      el.appendChild(panel);
      historyHost = U.el('div', { class: 'card stack-sm' });
      el.appendChild(historyHost);
      redrawPanel();
      // laufende OpenAI-Trainings weiter beobachten
      SK.store.runs().filter(function (r) { return r.method === 'openai' && r.status === 'laufend' && r.externalId; }).forEach(function (r) { pollOpenAI(r.id); });
    },
    onShow: function () {
      var active = SK.store.activeModel();
      if (active && active.id !== st.modelId && !busy()) {
        st.modelId = active.id;
        var sel = U.$('#t-model'); if (sel) sel.value = active.id;
        redrawPanel();
      } else if (!busy() && (st.method === 'ollama' || st.method === 'local')) {
        redrawPanel();
      }
    },
    refresh: function () { if (!busy()) { var sel = U.$('#t-model'); if (sel && sel.parentNode) { var nsel = A.modelSelect('t-model', st.modelId, function (v) { st.modelId = v; SK.store.setActiveModel(v); redrawPanel(); }); sel.replaceWith(nsel); } drawHistory(); } },
    select: function (method) { st.method = method; if (root) { U.$$('.tab', root).forEach(function (x) { x.setAttribute('aria-selected', String(x.id === 'tab-' + method)); }); redrawPanel(); } },
  };
})();
