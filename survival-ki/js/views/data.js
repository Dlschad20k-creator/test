/* Survival-KI Studio – Trainingsdaten: ansehen, bearbeiten, importieren, exportieren, mit KI erweitern, prüfen */
(function () {
  var U = SK.util, I = SK.icons, A = SK.app;
  var state = { q: '', mode: '', cat: '', src: '', limit: 40, open: {} };

  function catOptions(sel, withAll) {
    if (withAll) sel.appendChild(U.el('option', { value: '' }, 'Alle Themen'));
    SK.MODES.forEach(function (m) {
      var g = U.el('optgroup', { label: m.name });
      SK.CATEGORIES.filter(function (c) { return c.modes[0] === m.id; }).forEach(function (c) { g.appendChild(U.el('option', { value: c.id }, c.name)); });
      sel.appendChild(g);
    });
    return sel;
  }

  function filtered() {
    var list = state.src === 'hidden' ? SK.store.removedExamples() : SK.store.examples();
    var nq = U.normalize(state.q);
    return list.filter(function (e) {
      if (state.cat && e.c !== state.cat) return false;
      if (state.mode) { var c = SK.CATEGORIES.filter(function (x) { return x.id === e.c; })[0]; if (!c || c.modes.indexOf(state.mode) < 0) return false; }
      if (state.src === 'own' && e.builtin) return false;
      if (state.src === 'builtin' && !e.builtin) return false;
      if (state.src === 'edited' && !e.edited) return false;
      if (nq && U.normalize(e.q + ' ' + e.a + ' ' + (e.alt || []).join(' ')).indexOf(nq) < 0) return false;
      return true;
    });
  }

  /* ---------- Bearbeiten ---------- */
  function editExample(ex) {
    var isNew = !ex;
    var e = ex ? JSON.parse(JSON.stringify(ex)) : { id: null, c: state.cat || 'strom', q: '', a: '', alt: [] };
    var q = U.el('input', { type: 'text', id: 'x-q', value: e.q, placeholder: 'Wie würde jemand im Notfall fragen?' });
    var a = U.el('textarea', { id: 'x-a', rows: 10, placeholder: 'Kurze Einleitung, dann Schritte:\n1. **Wichtig:** …\n2. …\n- Punkte mit Strich' }); a.value = e.a;
    var c = catOptions(U.el('select', { id: 'x-c' }));
    c.value = e.c;
    var alt = U.el('textarea', { id: 'x-alt', rows: 3, placeholder: 'Eine Variante pro Zeile, z. B. mit Umgangssprache oder Tippfehlern' }); alt.value = (e.alt || []).join('\n');
    var prev = U.el('div', { class: 'inset md' });
    function upd() { prev.innerHTML = U.md(a.value || '*Vorschau der Antwort*'); }
    a.addEventListener('input', upd); upd();
    var body = U.el('div', { class: 'stack' }, [
      A.field('Frage', q),
      A.field('Antwort', a, 'Formatierung: **fett**, Listen mit „- “ oder „1. “. Gute Antworten nennen Mengen, Zeiten und Warnungen.'),
      U.el('div', { class: 'field' }, [U.el('span', null, 'Vorschau'), prev]),
      U.el('div', { class: 'form-grid' }, [A.field('Thema', c), A.field('Andere Formulierungen', alt, 'Helfen der KI, die Frage auch anders gestellt zu verstehen.')]),
    ]);
    var save = A.btn('Speichern', 'save', function () {
      if (q.value.trim().length < 5 || a.value.trim().length < 20) { U.toast('Frage und Antwort sind noch zu kurz.', 'error'); return; }
      e.q = q.value; e.a = a.value; e.c = c.value;
      e.alt = alt.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      SK.store.saveExample(e);
      d.close();
      U.toast(isNew ? 'Beispiel hinzugefügt' : 'Gespeichert', 'ok');
      redraw();
    }, 'btn-primary');
    body.appendChild(U.el('div', { class: 'dialog-actions' }, [A.btn('Abbrechen', null, function () { d.close(); }, 'btn-ghost'), save]));
    var d = U.modal(isNew ? 'Neues Trainingsbeispiel' : 'Beispiel bearbeiten', body, { wide: true });
    setTimeout(function () { q.focus(); }, 30);
  }
  SK.dataEdit = editExample;

  /* ---------- Import ---------- */
  function importDialog() {
    var file = U.el('input', { type: 'file', id: 'imp-file', accept: '.jsonl,.json,.csv,.txt,text/csv,application/json' });
    var paste = U.el('textarea', { id: 'imp-paste', rows: 6, placeholder: 'Oder hier einfügen: JSONL, JSON oder CSV (frage;antwort;kategorie)' });
    var out = U.el('div', { class: 'stack-sm' });
    var found = [];
    var add = A.btn('Hinzufügen', 'plus', function () {
      var n = SK.store.addExamples(found.map(function (x) { return { q: x.q, a: x.a, c: x.c, alt: x.alt, src: 'import' }; }));
      d.close(); U.toast(n + ' Beispiele hinzugefügt', 'ok'); redraw();
    }, 'btn-primary', { disabled: true });
    function parse(text, name) {
      out.innerHTML = '';
      try {
        var list = SK.exporter.parseImport(text, name);
        found = SK.exporter.assignCategories(list, SK.ai.offlineIndex());
        if (!found.length) throw new Error('Keine Frage-Antwort-Paare gefunden. Erwartet werden Felder wie frage/antwort, question/answer, instruction/output oder messages.');
        var auto = found.filter(function (x) { return x.auto; }).length;
        out.appendChild(A.callout('ok', 'check', found.length + ' Beispiele gefunden', auto ? auto + ' davon bekommen ihr Thema automatisch (über die Suche erkannt).' : ''));
        var tbl = U.el('div', { class: 'table-wrap' });
        var t = U.el('table', null, [U.el('thead', null, U.el('tr', null, [U.el('th', null, 'Frage'), U.el('th', null, 'Thema')]))]);
        var tb = U.el('tbody');
        found.slice(0, 8).forEach(function (x) { tb.appendChild(U.el('tr', null, [U.el('td', null, x.q), U.el('td', null, A.catName(x.c) + (x.auto ? ' (auto)' : ''))])); });
        t.appendChild(tb); tbl.appendChild(t); out.appendChild(tbl);
        if (found.length > 8) out.appendChild(U.el('p', { class: 'small muted' }, '… und ' + (found.length - 8) + ' weitere'));
        add.disabled = false;
      } catch (e) { found = []; add.disabled = true; out.appendChild(A.callout('bad', 'alert', 'Import nicht möglich', e.message)); }
    }
    file.addEventListener('change', async function () { if (file.files[0]) parse(await U.readFile(file.files[0]), file.files[0].name); });
    paste.addEventListener('input', U.debounce(function () { if (paste.value.trim()) parse(paste.value, ''); }, 400));
    var body = U.el('div', { class: 'stack' }, [
      U.el('p', { class: 'muted' }, 'Unterstützt: OpenAI-JSONL (messages), Alpaca (instruction/output), ShareGPT, eigene JSON-Listen und CSV mit Spalten frage und antwort (optional kategorie, varianten).'),
      A.field('Datei', file), A.field('Text', paste), out,
      U.el('div', { class: 'dialog-actions' }, [A.btn('Abbrechen', null, function () { d.close(); }, 'btn-ghost'), add]),
    ]);
    var d = U.modal('Trainingsdaten importieren', body, { wide: true });
  }

  /* ---------- Export ---------- */
  function exportDialog() {
    var active = SK.store.activeModel();
    var msel = A.modelSelect('exp-model', active && active.id, function () { info(); });
    var fmt = U.el('select', { id: 'exp-fmt' }, [
      U.el('option', { value: 'jsonl' }, 'OpenAI / Chat-JSONL (für Fine-Tuning)'),
      U.el('option', { value: 'alpaca' }, 'Alpaca-JSON (instruction/output)'),
      U.el('option', { value: 'sharegpt' }, 'ShareGPT-JSON (conversations)'),
      U.el('option', { value: 'csv' }, 'CSV-Tabelle (Excel, LibreOffice)'),
      U.el('option', { value: 'md' }, 'Notfall-Handbuch (Markdown, zum Ausdrucken)'),
    ]);
    var sys = U.el('select', { id: 'exp-sys' }, [U.el('option', { value: 'kurz' }, 'kurzer Systemprompt'), U.el('option', { value: 'voll' }, 'voller Systemprompt'), U.el('option', { value: 'keiner' }, 'ohne Systemprompt')]);
    var aug = U.el('input', { type: 'checkbox', id: 'exp-aug' }); aug.checked = true;
    var off = U.el('input', { type: 'checkbox', id: 'exp-off' }); off.checked = true;
    var infoEl = U.el('p', { class: 'small muted' });
    function opts() { return { system: sys.value, augment: aug.checked, offTopic: off.checked }; }
    function info() {
      var m = SK.store.model(msel.value);
      if (fmt.value === 'csv' || fmt.value === 'md') { infoEl.textContent = SK.store.examples().length + ' Beispiele (alle Themen).'; return; }
      var st = SK.exporter.stats(SK.exporter.conversations(m, SK.store.examples(), opts()));
      infoEl.textContent = st.count + ' Gespräche, etwa ' + U.fmtNum(st.tokens) + ' Token (' + st.avg + ' pro Gespräch).';
    }
    [fmt, sys, aug, off].forEach(function (x) { x.addEventListener('change', info); });
    var go = A.btn('Herunterladen', 'download', function () {
      var m = SK.store.model(msel.value), base = U.slug(m.name);
      var ex = SK.store.examples(), convs = SK.exporter.conversations(m, ex, opts());
      if (fmt.value === 'jsonl') U.download(base + '.jsonl', SK.exporter.toJsonl(convs), 'application/jsonl');
      if (fmt.value === 'alpaca') U.download(base + '-alpaca.json', SK.exporter.toAlpaca(convs), 'application/json');
      if (fmt.value === 'sharegpt') U.download(base + '-sharegpt.json', SK.exporter.toShareGPT(convs), 'application/json');
      if (fmt.value === 'csv') U.download('survival-trainingsdaten.csv', SK.exporter.toCsv(ex), 'text/csv;charset=utf-8');
      if (fmt.value === 'md') U.download('survival-handbuch.md', SK.exporter.toHandbook(ex, 'Survival-Handbuch'), 'text/markdown;charset=utf-8');
      d.close();
    }, 'btn-primary');
    var body = U.el('div', { class: 'stack' }, [
      U.el('div', { class: 'form-grid' }, [A.field('Für Modell', msel, 'bestimmt Themen und Systemprompt'), A.field('Format', fmt), A.field('Systemprompt', sys)]),
      U.el('label', { class: 'check' }, [aug, U.el('span', null, [U.el('b', null, 'Andere Formulierungen als eigene Beispiele'), U.el('small', null, 'Mehr Trainingsgespräche, die KI versteht Fragen flexibler.')])]),
      U.el('label', { class: 'check' }, [off, U.el('span', null, [U.el('b', null, 'Ablehnungen für fremde Themen'), U.el('small', null, 'Bringt dem Modell bei, nur bei seinem Fachgebiet zu bleiben.')])]),
      infoEl,
      U.el('div', { class: 'dialog-actions' }, [A.btn('Abbrechen', null, function () { d.close(); }, 'btn-ghost'), go]),
    ]);
    var d = U.modal('Trainingsdaten exportieren', body, { wide: true });
    info();
  }

  /* ---------- Mit KI erweitern ---------- */
  function generateDialog() {
    var llms = SK.store.models().filter(function (m) { return m.provider !== 'offline'; });
    if (!llms.length) {
      var dd = U.modal('Mit KI erweitern', U.el('div', { class: 'stack' }, [
        A.callout('', 'sparkles', 'Dafür brauchst du ein Sprachmodell', 'Verbinde zuerst ein Modell aus Ollama oder einer Cloud-API (Meine Modelle → Vorhandenes Modell verbinden). Es schreibt dann neue Trainingsbeispiele, die du vor dem Speichern prüfst.'),
        U.el('div', { class: 'dialog-actions' }, [A.btn('Modell verbinden', 'link', function () { dd.close(); A.go('modelle'); setTimeout(function () { SK.views.modelle.connect(); }, 50); }, 'btn-primary')]),
      ]));
      return;
    }
    var msel = A.modelSelect('gen-model', llms[0].id, function () {}, function (m) { return m.provider !== 'offline'; });
    var csel = catOptions(U.el('select', { id: 'gen-cat' })); csel.value = state.cat || 'strom';
    var nsel = U.el('select', { id: 'gen-n' }, [3, 5, 8, 10].map(function (n) { return U.el('option', { value: n }, n + ' Beispiele'); })); nsel.value = '5';
    var extra = U.el('input', { type: 'text', id: 'gen-extra', placeholder: 'optional, z. B. „für Familien mit Kleinkindern“ oder „im Winter“' });
    var out = U.el('div', { class: 'stack-sm' });
    var items = [];
    var addBtn = A.btn('Ausgewählte hinzufügen', 'plus', function () {
      var chosen = items.filter(function (x) { return x.on; });
      var n = SK.store.addExamples(chosen.map(function (x) { return { q: x.q, a: x.a, c: csel.value, alt: x.alt, src: 'ki' }; }));
      d.close(); U.toast(n + ' neue Beispiele gespeichert', 'ok'); redraw();
    }, 'btn-primary', { disabled: true });
    var genBtn = A.btn('Beispiele schreiben lassen', 'sparkles', async function () {
      var m = SK.store.model(msel.value), cat = SK.CATEGORIES.filter(function (c) { return c.id === csel.value; })[0];
      var existing = SK.store.examples().filter(function (e) { return e.c === cat.id; }).map(function (e) { return '- ' + e.q; }).join('\n');
      var mode = SK.MODES.filter(function (x) { return x.id === cat.modes[0]; })[0];
      var prompt = 'Schreibe ' + nsel.value + ' neue, unterschiedliche Frage-Antwort-Paare zum Thema „' + cat.name + '“ (' + mode.name + ': ' + mode.text + ').\n' +
        'Die Fragen sollen so klingen, wie normale Menschen im Notfall fragen. Die Antworten müssen fachlich korrekt sein (Empfehlungen von BBK, Rotem Kreuz, Feuerwehr), mit einem kurzen Einleitungssatz und dann nummerierten Schritten oder Stichpunkten mit „- “. Wichtige Wörter **fett**. Bei Lebensgefahr den Notruf 112 nennen.\n' +
        (extra.value.trim() ? 'Zusätzlich: ' + extra.value.trim() + '\n' : '') +
        'Diese Fragen gibt es schon, wiederhole sie nicht:\n' + existing + '\n\n' +
        'Antworte NUR mit JSON in genau diesem Format, ohne weiteren Text:\n[{"frage": "…", "antwort": "…", "varianten": ["…", "…"]}]';
      genBtn.disabled = true; out.innerHTML = ''; items = []; addBtn.disabled = true;
      var live = U.el('pre', { class: 'code' }, '');
      out.appendChild(U.el('p', { class: 'muted' }, m.name + ' schreibt …'));
      out.appendChild(live);
      try {
        var gm = Object.assign({}, m, { systemPrompt: 'Du bist ein erfahrener Experte für Katastrophenschutz und Survival und schreibst hochwertige Trainingsdaten für eine Notfall-KI auf Deutsch.', rag: false, strict: false });
        var res = await SK.ai.respond(gm, [{ role: 'user', content: prompt }], { onToken: function (d2, full) { live.textContent = full.slice(-1500); live.scrollTop = live.scrollHeight; } });
        var text = res.text.replace(/```(json)?/g, '');
        var s = text.indexOf('['), e = text.lastIndexOf(']');
        if (s < 0 || e < s) throw new Error('Das Modell hat kein JSON geliefert. Versuche es noch einmal oder nimm ein größeres Modell.');
        var arr = JSON.parse(text.slice(s, e + 1));
        items = arr.map(function (x) { return { q: String(x.frage || x.question || '').trim(), a: String(x.antwort || x.answer || '').trim(), alt: Array.isArray(x.varianten) ? x.varianten.map(String) : [], on: true }; })
          .filter(function (x) { return x.q.length > 5 && x.a.length > 30; });
        out.innerHTML = '';
        if (!items.length) throw new Error('Keine brauchbaren Beispiele erhalten.');
        out.appendChild(U.el('p', { class: 'muted' }, 'Prüfe die Antworten, bevor du sie speicherst. KI-Texte können Fehler enthalten.'));
        items.forEach(function (it, i) {
          var cb = U.el('input', { type: 'checkbox', id: 'gen-' + i }); cb.checked = true;
          cb.addEventListener('change', function () { it.on = cb.checked; addBtn.disabled = !items.some(function (x) { return x.on; }); });
          out.appendChild(U.el('div', { class: 'inset stack-sm' }, [U.el('label', { class: 'check' }, [cb, U.el('b', null, it.q)]), U.el('div', { class: 'md small', html: U.md(it.a) })]));
        });
        addBtn.disabled = false;
      } catch (err) { out.innerHTML = ''; out.appendChild(A.callout('bad', 'alert', 'Das hat nicht geklappt', err.message)); }
      genBtn.disabled = false;
    }, '');
    var body = U.el('div', { class: 'stack' }, [
      U.el('p', { class: 'muted' }, 'Ein verbundenes Sprachmodell schreibt neue Trainingsbeispiele. Du entscheidest, welche gespeichert werden.'),
      U.el('div', { class: 'form-grid' }, [A.field('Sprachmodell', msel), A.field('Thema', csel), A.field('Anzahl', nsel)]),
      A.field('Besonderer Wunsch', extra),
      U.el('div', { class: 'actions' }, [genBtn]),
      out,
      U.el('div', { class: 'dialog-actions' }, [A.btn('Schließen', null, function () { d.close(); }, 'btn-ghost'), addBtn]),
    ]);
    var d = U.modal('Mit KI erweitern', body, { wide: true });
  }

  /* ---------- Qualitäts-Check ---------- */
  function qualityDialog() {
    var ex = SK.store.examples();
    var index = SK.engine.buildIndex(ex);
    var dups = [], seen = {};
    ex.forEach(function (e) {
      var hits = SK.engine.search(index, e.q, { limit: 3 });
      hits.forEach(function (h) {
        if (h.ex.id === e.id || h.tri < 0.72) return;
        var key = [e.id, h.ex.id].sort().join('|');
        if (!seen[key]) { seen[key] = 1; dups.push([e, h.ex, h.tri]); }
      });
    });
    var short = ex.filter(function (e) { return e.a.length < 120; });
    var long = ex.filter(function (e) { return e.a.length > 2500; });
    var noAlt = ex.filter(function (e) { return !(e.alt || []).length; });
    var perCat = SK.CATEGORIES.map(function (c) { return { c: c, n: ex.filter(function (e) { return e.c === c.id; }).length }; }).filter(function (x) { return x.n < 3; });
    var body = U.el('div', { class: 'stack' });
    var total = dups.length + short.length + long.length;
    body.appendChild(total ? A.callout('warn', 'alert', total + ' Dinge zum Verbessern', 'Ähnliche Fragen verwirren das Training, sehr kurze Antworten machen die KI ungenau.') : A.callout('ok', 'check', 'Alles in Ordnung', 'Keine doppelten Fragen, keine zu kurzen oder zu langen Antworten.'));
    function section(title, list, render) {
      if (!list.length) return;
      body.appendChild(U.el('h3', { class: 'card-title' }, title + ' (' + list.length + ')'));
      var box = U.el('div', { class: 'run-list' });
      list.slice(0, 30).forEach(function (x) { box.appendChild(render(x)); });
      body.appendChild(box);
    }
    function editBtn(e) { return A.btn('Bearbeiten', 'edit', function () { d.close(); editExample(e); }, 'btn-sm'); }
    section('Sehr ähnliche Fragen', dups, function (p) { return U.el('div', { class: 'run' }, [U.el('span', { class: 'pill pill-warn' }, Math.round(p[2] * 100) + ' %'), U.el('div', null, [U.el('div', null, p[0].q), U.el('div', { class: 'small muted' }, p[1].q)]), editBtn(p[1])]); });
    section('Sehr kurze Antworten', short, function (e) { return U.el('div', { class: 'run' }, [U.el('span', { class: 'pill pill-warn' }, e.a.length + ' Zeichen'), U.el('div', null, e.q), editBtn(e)]); });
    section('Sehr lange Antworten', long, function (e) { return U.el('div', { class: 'run' }, [U.el('span', { class: 'pill pill-warn' }, e.a.length + ' Zeichen'), U.el('div', null, e.q), editBtn(e)]); });
    section('Ohne andere Formulierungen', noAlt, function (e) { return U.el('div', { class: 'run' }, [U.el('span', { class: 'pill pill-neutral' }, 'Tipp'), U.el('div', null, e.q), editBtn(e)]); });
    section('Themen mit wenig Beispielen', perCat, function (x) { return U.el('div', { class: 'run' }, [U.el('span', { class: 'pill pill-neutral' }, x.n + ' Beispiele'), U.el('div', null, x.c.name), U.el('span')]); });
    var d = U.modal('Qualitäts-Check', body, { wide: true });
  }

  /* ---------- Liste ---------- */
  var root = null;
  function redraw() { if (root && A.current() === 'daten') { var y = window.scrollY; root.innerHTML = ''; SK.views.daten.render(root); window.scrollTo(0, y); } }

  function exRow(e) {
    var open = !!state.open[e.id];
    var tags = U.el('span', { class: 'ex-tags' }, [A.catChip(e.c), !e.builtin ? U.el('span', { class: 'pill pill-accent' }, e.src === 'ki' ? 'KI' : e.src === 'chat' ? 'Chat' : 'Eigenes') : null, e.edited ? U.el('span', { class: 'pill pill-warn' }, 'Geändert') : null, e.hidden ? U.el('span', { class: 'pill pill-neutral' }, 'Ausgeblendet') : null]);
    var head = U.el('button', { type: 'button', class: 'ex-head', 'aria-expanded': String(open) }, [U.el('span', { class: 'ex-q' }, e.q), tags, open ? null : U.el('span', { class: 'ex-prev' }, U.plain(e.a).replace(/\n/g, ' '))]);
    var row = U.el('div', { class: 'ex' }, [head]);
    head.addEventListener('click', function () { state.open[e.id] = !state.open[e.id]; row.replaceWith(exRow(e)); });
    if (open) {
      var actions = [];
      if (e.hidden) actions.push(A.btn('Wieder einblenden', 'refresh', function () { SK.store.resetExample(e.id); redraw(); }, 'btn-sm'));
      else {
        actions.push(A.btn('Bearbeiten', 'edit', function () { editExample(e); }, 'btn-sm'));
        if (e.edited) actions.push(A.btn('Original wiederherstellen', 'refresh', function () { SK.store.resetExample(e.id); U.toast('Original wiederhergestellt'); redraw(); }, 'btn-sm'));
        actions.push(A.btn(e.builtin ? 'Ausblenden' : 'Löschen', 'trash', function () {
          U.confirm({ title: e.builtin ? 'Beispiel ausblenden?' : 'Beispiel löschen?', text: e.builtin ? 'Eingebaute Beispiele kannst du später unter „Ausgeblendete“ wieder einblenden.' : 'Das eigene Beispiel wird gelöscht.', ok: e.builtin ? 'Ausblenden' : 'Löschen', danger: true })
            .then(function (ok) { if (ok) { SK.store.removeExample(e.id); redraw(); } });
        }, 'btn-sm btn-danger'));
      }
      row.appendChild(U.el('div', { class: 'ex-body' }, [
        U.el('div', { class: 'md', html: U.md(e.a) }),
        (e.alt || []).length ? U.el('div', { class: 'stack-sm' }, [U.el('span', { class: 'label' }, 'Andere Formulierungen'), U.el('div', { class: 'ex-alts' }, e.alt.map(function (x) { return U.el('span', null, x); }))]) : null,
        U.el('div', { class: 'actions' }, actions),
      ]));
    }
    return row;
  }

  SK.views.daten = {
    title: 'Trainingsdaten',
    render: function (el) {
      root = el;
      var ex = SK.store.examples(), info = SK.store.datasetInfo();
      el.appendChild(A.head('Wissen', 'Trainingsdaten',
        'Aus diesen Frage-Antwort-Paaren lernt deine KI. ' + SK.BUILTIN.length + ' geprüfte Profi-Antworten sind eingebaut. Ergänze eigenes Wissen, importiere Daten oder lass ein Sprachmodell neue Beispiele schreiben.',
        [
          A.btn('Neues Beispiel', 'plus', function () { editExample(null); }, 'btn-primary'),
          A.btn('Mit KI erweitern', 'sparkles', generateDialog),
          A.btn('Importieren', 'upload', importDialog),
          A.btn('Exportieren', 'download', exportDialog),
          A.btn('Qualitäts-Check', 'check', qualityDialog, 'btn-ghost'),
        ]));
      var tokens = ex.reduce(function (s, e) { return s + U.estimateTokens(e.q + e.a); }, 0);
      el.appendChild(U.el('section', { class: 'stats', 'aria-label': 'Überblick Trainingsdaten' }, [
        stat('Beispiele', U.fmtNum(ex.length), ex.reduce(function (s, e) { return s + (e.alt || []).length; }, 0) + ' weitere Formulierungen'),
        stat('Eigene', U.fmtNum(info.added), info.edited + ' geändert, ' + info.removed + ' ausgeblendet'),
        stat('Themen', String(SK.CATEGORIES.length), 'in 3 Modi'),
        stat('Umfang', '≈ ' + U.fmtNum(tokens), 'Token Text'),
      ]));

      // Verteilung
      var dist = U.el('details', { class: 'card' });
      dist.appendChild(U.el('summary', { class: 'card-title', style: 'cursor:pointer' }, 'Verteilung nach Thema'));
      var chartHost = U.el('div', { style: 'margin-top:14px' });
      dist.appendChild(chartHost);
      dist.addEventListener('toggle', function () {
        if (!dist.open) return;
        var items = SK.CATEGORIES.map(function (c) { return { label: c.name, value: ex.filter(function (e) { return e.c === c.id; }).length }; }).sort(function (a, b) { return b.value - a.value; });
        SK.charts.bars(chartHost, { items: items, format: function (v) { return String(v); } });
      });
      el.appendChild(dist);

      // Filter
      var search = U.el('input', { type: 'search', id: 'd-search', value: state.q, placeholder: 'Suchen in Fragen und Antworten', 'aria-label': 'Suchen' });
      var mode = U.el('select', { id: 'd-mode', 'aria-label': 'Modus' }, [U.el('option', { value: '' }, 'Alle Modi')].concat(SK.MODES.map(function (m) { return U.el('option', { value: m.id }, m.name); })));
      mode.value = state.mode;
      var cat = catOptions(U.el('select', { id: 'd-cat', 'aria-label': 'Thema' }), true); cat.value = state.cat;
      var src = U.el('select', { id: 'd-src', 'aria-label': 'Herkunft' }, [
        U.el('option', { value: '' }, 'Alle Beispiele'), U.el('option', { value: 'builtin' }, 'Eingebaute'), U.el('option', { value: 'own' }, 'Eigene'),
        U.el('option', { value: 'edited' }, 'Geänderte'), U.el('option', { value: 'hidden' }, 'Ausgeblendete'),
      ]);
      src.value = state.src;
      var filters = U.el('div', { class: 'filters' }, [U.el('div', { class: 'search', html: I.get('search') }, [search]), mode, cat, src]);
      el.appendChild(filters);
      var listHost = U.el('div', { class: 'stack-sm' });
      el.appendChild(listHost);
      function drawList() {
        listHost.innerHTML = '';
        var list = filtered();
        listHost.appendChild(U.el('p', { class: 'small muted', 'aria-live': 'polite' }, list.length + ' von ' + ex.length + ' Beispielen'));
        if (!list.length) { listHost.appendChild(U.el('div', { class: 'card empty' }, [U.el('span', { html: I.get('search') }), U.el('p', null, 'Nichts gefunden. Ändere die Suche oder lege ein neues Beispiel an.')])); return; }
        var box = U.el('div', { class: 'ex-list' });
        list.slice(0, state.limit).forEach(function (e) { box.appendChild(exRow(e)); });
        listHost.appendChild(box);
        if (list.length > state.limit) listHost.appendChild(U.el('div', { class: 'actions' }, [A.btn('Mehr anzeigen (' + (list.length - state.limit) + ' weitere)', 'chevron', function () { state.limit += 60; drawList(); })]));
      }
      search.addEventListener('input', U.debounce(function () { state.q = search.value; state.limit = 40; drawList(); }, 180));
      mode.addEventListener('change', function () { state.mode = mode.value; state.limit = 40; drawList(); });
      cat.addEventListener('change', function () { state.cat = cat.value; state.limit = 40; drawList(); });
      src.addEventListener('change', function () { state.src = src.value; state.limit = 40; drawList(); });
      drawList();
    },
  };

  function stat(label, value, sub) {
    return U.el('div', { class: 'stat' }, [U.el('span', { class: 'label' }, label), U.el('span', { class: 'stat-v' }, value), U.el('span', { class: 'stat-s' }, sub)]);
  }
})();
