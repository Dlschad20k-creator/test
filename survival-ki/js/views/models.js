/* Survival-KI Studio – Meine Modelle: Übersicht, Assistent, Bearbeiten, eigene Modelle verbinden */
(function () {
  var U = SK.util, I = SK.icons, A = SK.app;

  var PROVIDERS = [
    { id: 'offline', name: 'Offline-KI', icon: 'shield', text: 'Eingebaut, ohne Internet und ohne Installation. Antwortet aus deinen Trainingsdaten und wird im Browser trainiert.' },
    { id: 'ollama', name: 'Ollama', icon: 'laptop', text: 'Ein echtes Sprachmodell auf deinem PC (Llama, Qwen, Mistral …). Kostenlos, privat, offline nutzbar.' },
    { id: 'openai', name: 'Cloud-API', icon: 'cloud', text: 'OpenAI oder ein kompatibler Server (LM Studio, OpenRouter, Groq …). Braucht meist einen API-Schlüssel.' },
    { id: 'trainer', name: 'Lokaler Trainer', icon: 'cpu', text: 'Das Modell, das du gerade mit dem lokalen Trainer feinjustiert hast.' },
  ];
  var STYLES = [
    { id: 'kurz', name: 'Kurz & klar', text: 'Höchstens 5 Punkte, das Wichtigste zuerst.' },
    { id: 'normal', name: 'Schritt für Schritt', text: 'Kurze Einleitung, dann nummerierte Schritte.' },
    { id: 'ausfuehrlich', name: 'Ausführlich', text: 'Mit Gründen, typischen Fehlern und Profi-Tipp.' },
  ];
  var TONES = [
    { id: 'ruhig', name: 'Ruhig', text: 'Freundlich und beruhigend.' },
    { id: 'knapp', name: 'Einsatzleiter', text: 'Knapp und bestimmt, keine Floskeln.' },
    { id: 'kinder', name: 'Für Kinder', text: 'Einfach erklärt, ohne Angst zu machen.' },
  ];
  var OPENAI_SUGGEST = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'llama-3.3-70b-versatile', 'mistral-small-latest'];

  function blankModel() {
    return { id: null, name: '', icon: 'shield', modes: ['blackout', 'survival', 'apokalypse'], categories: [], provider: 'offline', baseModel: '', endpoint: '', apiKey: '',
      style: 'normal', tone: 'ruhig', strict: true, rag: true, temperature: 0.3, systemPrompt: '', preset: false, trained: null, ollamaName: '', notes: '' };
  }

  /* ---------- Formularteile (werden in Assistent und Editor benutzt) ---------- */
  function choiceGroup(items, value, multi, onChange) {
    var wrap = U.el('div', { class: 'choice-grid', role: multi ? 'group' : 'radiogroup' });
    items.forEach(function (it) {
      var on = multi ? value.indexOf(it.id) >= 0 : value === it.id;
      var b = U.el('button', { type: 'button', class: 'choice', 'aria-pressed': multi ? String(on) : null, role: multi ? null : 'radio', 'aria-checked': multi ? null : String(on), 'data-id': it.id });
      b.innerHTML = (it.icon ? I.get(it.icon) : '') + '<b>' + U.esc(it.name) + '</b><small>' + U.esc(it.text || '') + '</small>';
      b.addEventListener('click', function () {
        if (multi) {
          var i = value.indexOf(it.id);
          if (i >= 0) { if (value.length > 1) value.splice(i, 1); } else value.push(it.id);
          U.$$('.choice', wrap).forEach(function (c) { c.setAttribute('aria-pressed', String(value.indexOf(c.dataset.id) >= 0)); });
          onChange(value.slice());
        } else {
          U.$$('.choice', wrap).forEach(function (c) { c.setAttribute('aria-checked', String(c.dataset.id === it.id)); });
          onChange(it.id);
        }
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function iconPicker(m) {
    var wrap = U.el('div', { class: 'icon-pick', role: 'radiogroup', 'aria-label': 'Symbol' });
    I.MODEL_ICONS.forEach(function (name) {
      var b = U.el('button', { type: 'button', 'aria-pressed': String(m.icon === name), 'aria-label': 'Symbol ' + name, html: I.get(name) });
      b.addEventListener('click', function () { m.icon = name; U.$$('button', wrap).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function categoryPicker(m, onChange) {
    var wrap = U.el('div', { class: 'stack-sm' });
    function draw() {
      wrap.innerHTML = '';
      var cats = SK.CATEGORIES.filter(function (c) { return c.modes.some(function (x) { return m.modes.indexOf(x) >= 0; }); });
      var active = m.categories && m.categories.length ? m.categories : cats.map(function (c) { return c.id; });
      var row = U.el('div', { class: 'row' });
      cats.forEach(function (c) {
        var on = active.indexOf(c.id) >= 0;
        var n = SK.store.examples().filter(function (e) { return e.c === c.id; }).length;
        var b = U.el('button', { type: 'button', class: 'chip', 'aria-pressed': String(on) }, [U.el('span', { class: 'dot ' + c.modes[0] }), c.name + ' · ' + n]);
        b.addEventListener('click', function () {
          var list = active.slice(), i = list.indexOf(c.id);
          if (i >= 0) { if (list.length > 1) list.splice(i, 1); } else list.push(c.id);
          m.categories = list.length === cats.length ? [] : list;
          draw(); if (onChange) onChange();
        });
        row.appendChild(b);
      });
      wrap.appendChild(row);
      var count = SK.store.examples().filter(function (e) { return active.indexOf(e.c) >= 0; }).length;
      wrap.appendChild(U.el('p', { class: 'small muted' }, active.length + ' Themen mit ' + count + ' Trainingsbeispielen. Antippen schaltet ein Thema ab oder an.'));
    }
    draw();
    wrap.redraw = draw;
    return wrap;
  }

  function brainFields(m) {
    var wrap = U.el('div', { class: 'stack' });
    var s = SK.store.settings();
    function draw() {
      wrap.innerHTML = '';
      if (m.provider === 'offline') {
        wrap.appendChild(A.callout('ok', 'shield', 'Kein Setup nötig', 'Die Offline-KI läuft direkt im Browser. Trainiere sie unter Training → Im Browser, damit sie fremde Fragen erkennt.'));
      }
      if (m.provider === 'ollama') {
        var list = A.status.ollamaModels || [];
        var dl = U.el('datalist', { id: 'dl-ollama' });
        list.forEach(function (x) { dl.appendChild(U.el('option', { value: x.name }, (x.params || '') + ' ' + (x.family || ''))); });
        ['llama3.2:3b', 'qwen2.5:7b', 'mistral:7b', 'gemma3:4b', 'llama3.1:8b'].forEach(function (n) { if (!list.some(function (x) { return x.name === n; })) dl.appendChild(U.el('option', { value: n })); });
        var inp = U.el('input', { type: 'text', id: 'f-ollama-model', list: 'dl-ollama', value: m.ollamaName || m.baseModel || (list[0] ? list[0].name : 'llama3.2:3b'), placeholder: 'z. B. llama3.2:3b' });
        if (!m.baseModel && !m.ollamaName) m.baseModel = inp.value;
        inp.addEventListener('input', function () { m.baseModel = inp.value.trim(); m.ollamaName = ''; });
        wrap.appendChild(dl);
        wrap.appendChild(A.field('Ollama-Modell', inp, list.length ? list.length + ' Modelle auf deinem PC gefunden.' : 'Ollama nicht erreichbar. Starte Ollama oder prüfe die Adresse in den Einstellungen. Ein Modell lädst du mit „ollama pull llama3.2:3b“.'));
        var ep = U.el('input', { type: 'url', id: 'f-ollama-ep', value: m.endpoint || '', placeholder: s.ollamaUrl });
        ep.addEventListener('input', function () { m.endpoint = ep.value.trim(); });
        wrap.appendChild(A.field('Adresse (optional)', ep, 'Leer lassen für die Adresse aus den Einstellungen.'));
      }
      if (m.provider === 'openai') {
        var dl2 = U.el('datalist', { id: 'dl-openai' });
        OPENAI_SUGGEST.forEach(function (n) { dl2.appendChild(U.el('option', { value: n })); });
        var base = U.el('input', { type: 'url', id: 'f-oa-base', value: m.endpoint || '', placeholder: s.openaiBase });
        base.addEventListener('input', function () { m.endpoint = base.value.trim(); });
        var mdl = U.el('input', { type: 'text', id: 'f-oa-model', list: 'dl-openai', value: m.baseModel || '', placeholder: 'z. B. gpt-4.1-mini' });
        mdl.addEventListener('input', function () { m.baseModel = mdl.value.trim(); });
        var key = U.el('input', { type: 'password', id: 'f-oa-key', value: m.apiKey || '', placeholder: 'leer = Schlüssel aus den Einstellungen', autocomplete: 'off' });
        key.addEventListener('input', function () { m.apiKey = key.value.trim(); });
        var load = A.btn('Modelle vom Server laden', 'refresh', async function () {
          load.disabled = true;
          try {
            var list2 = await SK.ai.openai.models(m.endpoint || s.openaiBase, m.apiKey || s.openaiKey);
            dl2.innerHTML = '';
            list2.forEach(function (x) { dl2.appendChild(U.el('option', { value: x.name })); });
            U.toast(list2.length + ' Modelle gefunden', 'ok');
          } catch (e) { U.toast(e.message, 'error'); }
          load.disabled = false;
        }, 'btn-sm');
        wrap.appendChild(dl2);
        wrap.appendChild(A.field('Server-Adresse (Basis-URL)', base, 'Leer = ' + s.openaiBase + '. LM Studio: http://localhost:1234/v1'));
        wrap.appendChild(A.field('Modellname', mdl));
        wrap.appendChild(A.field('Eigener API-Schlüssel (optional)', key, 'Wird nur in diesem Browser gespeichert. Lokale Server brauchen keinen.'));
        wrap.appendChild(U.el('div', { class: 'actions' }, [load]));
      }
      if (m.provider === 'trainer') {
        wrap.appendChild(A.callout('', 'cpu', 'Lokaler Trainer', 'Antwortet mit dem Modell, das der lokale Trainer zuletzt fertig trainiert hat. Den Trainer startest du unter Training → Lokaler Trainer.'));
      }
    }
    draw();
    wrap.redraw = draw;
    return wrap;
  }

  function behaviorFields(m) {
    var wrap = U.el('div', { class: 'stack' });
    wrap.appendChild(U.el('div', { class: 'field' }, [U.el('span', null, 'Antwortstil'), choiceGroup(STYLES, m.style, false, function (v) { m.style = v; })]));
    wrap.appendChild(U.el('div', { class: 'field' }, [U.el('span', null, 'Ton'), choiceGroup(TONES, m.tone, false, function (v) { m.tone = v; })]));
    var strict = U.el('input', { type: 'checkbox', id: 'f-strict' }); strict.checked = m.strict !== false;
    strict.addEventListener('change', function () { m.strict = strict.checked; });
    wrap.appendChild(U.el('label', { class: 'check' }, [strict, U.el('span', null, [U.el('b', null, 'Nur Fragen zum Fachgebiet beantworten'), U.el('small', null, 'Andere Themen lehnt die KI freundlich ab. So bleibt sie Spezialist.')])]));
    var rag = U.el('input', { type: 'checkbox', id: 'f-rag' }); rag.checked = m.rag !== false;
    rag.addEventListener('change', function () { m.rag = rag.checked; });
    wrap.appendChild(U.el('label', { class: 'check' }, [rag, U.el('span', null, [U.el('b', null, 'Wissen aus den Trainingsdaten mitgeben'), U.el('small', null, 'Bei Sprachmodellen werden zu jeder Frage die passendsten Profi-Antworten mitgeschickt (RAG).')])]));
    var temp = U.el('input', { type: 'range', id: 'f-temp', min: 0, max: 1, step: 0.05, value: m.temperature === undefined ? 0.3 : m.temperature });
    var out = U.el('output', { for: 'f-temp' }, String(temp.value));
    temp.addEventListener('input', function () { m.temperature = Number(temp.value); out.textContent = temp.value; });
    wrap.appendChild(A.field('Kreativität (Temperatur)', U.el('div', { class: 'range-row' }, [temp, out]), 'Niedrig = genau und gleichbleibend (empfohlen für Notfälle), hoch = abwechslungsreicher.'));
    return wrap;
  }

  function promptField(m) {
    var wrap = U.el('div', { class: 'stack-sm' });
    var auto = U.el('input', { type: 'checkbox', id: 'f-auto-prompt' }); auto.checked = !m.systemPrompt;
    var ta = U.el('textarea', { id: 'f-prompt', rows: 12, spellcheck: 'true' });
    function sync() {
      if (auto.checked) { ta.value = SK.prompts.generate(m); ta.readOnly = true; m.systemPrompt = ''; }
      else { ta.readOnly = false; if (!m.systemPrompt) m.systemPrompt = ta.value; }
    }
    auto.addEventListener('change', sync);
    ta.addEventListener('input', function () { if (!auto.checked) m.systemPrompt = ta.value; });
    ta.value = m.systemPrompt || SK.prompts.generate(m);
    ta.readOnly = !m.systemPrompt;
    wrap.appendChild(U.el('label', { class: 'check' }, [auto, U.el('span', null, [U.el('b', null, 'Systemprompt automatisch erzeugen'), U.el('small', null, 'Aus Name, Modi, Stil und Ton. Abschalten, um ihn selbst zu schreiben.')])]));
    wrap.appendChild(ta);
    wrap.refresh = function () { if (auto.checked) ta.value = SK.prompts.generate(m); };
    return wrap;
  }

  /* ---------- Assistent ---------- */
  function wizard(preset) {
    var m = Object.assign(blankModel(), preset || {});
    var step = 0;
    var body = U.el('div', { class: 'stack' });
    var bar = U.el('div', { class: 'wizard-steps', 'aria-hidden': 'true' });
    for (var i = 0; i < 5; i++) bar.appendChild(U.el('span'));
    var content = U.el('div', { class: 'stack' });
    var back = A.btn('Zurück', null, function () { if (step > 0) { step--; draw(); } }, 'btn-ghost');
    var next = A.btn('Weiter', null, function () {
      if (step === 0 && !m.name.trim()) { U.toast('Gib deiner KI einen Namen.', 'error'); return; }
      if (step === 2 && m.provider === 'openai' && !m.baseModel) { U.toast('Trage einen Modellnamen ein, z. B. gpt-4.1-mini.', 'error'); return; }
      if (step < 4) { step++; draw(); } else finish();
    }, 'btn-primary');
    body.appendChild(bar); body.appendChild(content);
    body.appendChild(U.el('div', { class: 'dialog-actions' }, [back, next]));
    var dlg = U.modal('Neue KI erstellen', body, { wide: true });

    function draw() {
      U.$$('span', bar).forEach(function (s, i) { s.className = i <= step ? 'on' : ''; });
      back.hidden = step === 0;
      next.querySelector('span').textContent = step === 4 ? 'KI erstellen' : 'Weiter';
      content.innerHTML = '';
      if (step === 0) {
        content.appendChild(U.el('p', { class: 'label' }, 'Schritt 1 von 5'));
        content.appendChild(U.el('h3', { class: 'section-title' }, 'Wie soll deine KI heißen?'));
        var name = U.el('input', { type: 'text', id: 'w-name', value: m.name, placeholder: 'z. B. Bunker-Bot, Notfall-Navi, Prepper-Pro', maxlength: 40 });
        name.addEventListener('input', function () { m.name = name.value; });
        name.addEventListener('keydown', function (e) { if (e.key === 'Enter') next.click(); });
        content.appendChild(A.field('Name', name));
        content.appendChild(U.el('div', { class: 'field' }, [U.el('span', null, 'Symbol'), iconPicker(m)]));
        setTimeout(function () { name.focus(); }, 30);
      }
      if (step === 1) {
        content.appendChild(U.el('p', { class: 'label' }, 'Schritt 2 von 5'));
        content.appendChild(U.el('h3', { class: 'section-title' }, 'Wofür soll sie Profi sein?'));
        var cp = categoryPicker(m);
        content.appendChild(choiceGroup(SK.MODES.map(function (x) { return { id: x.id, name: x.name, text: x.text, icon: I.mode(x.id) }; }), m.modes, true, function (v) { m.modes = v; m.categories = []; cp.redraw(); }));
        content.appendChild(U.el('div', { class: 'field' }, [U.el('span', null, 'Themen'), cp]));
      }
      if (step === 2) {
        content.appendChild(U.el('p', { class: 'label' }, 'Schritt 3 von 5'));
        content.appendChild(U.el('h3', { class: 'section-title' }, 'Welches Gehirn bekommt sie?'));
        var bf = brainFields(m);
        content.appendChild(choiceGroup(PROVIDERS, m.provider, false, function (v) { m.provider = v; bf.redraw(); }));
        content.appendChild(bf);
      }
      if (step === 3) {
        content.appendChild(U.el('p', { class: 'label' }, 'Schritt 4 von 5'));
        content.appendChild(U.el('h3', { class: 'section-title' }, 'Wie soll sie antworten?'));
        content.appendChild(behaviorFields(m));
      }
      if (step === 4) {
        content.appendChild(U.el('p', { class: 'label' }, 'Schritt 5 von 5'));
        content.appendChild(U.el('h3', { class: 'section-title' }, 'Fertig zum Erstellen'));
        content.appendChild(U.el('dl', { class: 'facts' }, [
          U.el('dt', null, 'Name'), U.el('dd', null, m.name),
          U.el('dt', null, 'Modi'), U.el('dd', null, SK.engine.modeText(m)),
          U.el('dt', null, 'Themen'), U.el('dd', null, String(SK.engine.modelCategories(m).length)),
          U.el('dt', null, 'Gehirn'), U.el('dd', null, SK.ai.providerLabel(m) + (m.baseModel ? ' · ' + m.baseModel : '')),
          U.el('dt', null, 'Stil'), U.el('dd', null, STYLES.filter(function (x) { return x.id === m.style; })[0].name + ', ' + TONES.filter(function (x) { return x.id === m.tone; })[0].name),
        ]));
        content.appendChild(U.el('div', { class: 'field' }, [U.el('span', null, 'Systemprompt (die „Dienstanweisung“ für Sprachmodelle)'), promptField(m)]));
      }
    }
    function finish() {
      m.name = m.name.trim();
      var saved = SK.store.saveModel(m);
      SK.store.setActiveModel(saved.id);
      dlg.close();
      U.toast('„' + saved.name + '“ ist erstellt und aktiv.', 'ok');
      nextSteps(saved);
    }
    draw();
  }

  function nextSteps(m) {
    var body = U.el('div', { class: 'stack' }, [
      U.el('p', null, 'Als Nächstes kannst du deine KI trainieren oder gleich ausprobieren.'),
      U.el('div', { class: 'choice-grid' }, [
        choiceLink('train', 'Trainieren', m.provider === 'offline' ? 'Im Browser, dauert nur Sekunden.' : 'Echtes Fine-Tuning oder Ollama-Sofortmodell.', function () { d.close(); A.go('training'); }),
        choiceLink('chat', 'Chatten', 'Stell ihr eine Frage zu ' + SK.engine.modeText(m) + '.', function () { d.close(); A.go('chat'); }),
        choiceLink('clipboard', 'Prüfen', 'Ist sie schon ein Profi?', function () { d.close(); A.go('pruefung'); }),
      ]),
    ]);
    var d = U.modal('„' + m.name + '“ ist bereit', body);
  }
  function choiceLink(icon, name, text, fn) {
    var b = U.el('button', { type: 'button', class: 'choice' });
    b.innerHTML = I.get(icon) + '<b>' + U.esc(name) + '</b><small>' + U.esc(text) + '</small>';
    b.addEventListener('click', fn);
    return b;
  }

  /* ---------- Bearbeiten ---------- */
  function editor(id) {
    var orig = SK.store.model(id);
    if (!orig) return;
    var m = JSON.parse(JSON.stringify(orig));
    var tabs = ['Allgemein', 'Fachgebiet', 'Gehirn', 'Verhalten', 'Systemprompt'];
    var tab = 0;
    var body = U.el('div', { class: 'stack' });
    var tl = U.el('div', { class: 'tabs', role: 'tablist' });
    var panel = U.el('div', { class: 'stack', role: 'tabpanel' });
    tabs.forEach(function (t, i) {
      var b = U.el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(i === 0) }, t);
      b.addEventListener('click', function () { tab = i; U.$$('.tab', tl).forEach(function (x, j) { x.setAttribute('aria-selected', String(j === i)); }); draw(); });
      tl.appendChild(b);
    });
    function draw() {
      panel.innerHTML = '';
      if (tab === 0) {
        var name = U.el('input', { type: 'text', id: 'e-name', value: m.name, maxlength: 40 });
        name.addEventListener('input', function () { m.name = name.value; });
        var notes = U.el('textarea', { id: 'e-notes', rows: 3 }); notes.value = m.notes || '';
        notes.addEventListener('input', function () { m.notes = notes.value; });
        panel.appendChild(A.field('Name', name));
        panel.appendChild(U.el('div', { class: 'field' }, [U.el('span', null, 'Symbol'), iconPicker(m)]));
        panel.appendChild(A.field('Notizen', notes));
      }
      if (tab === 1) {
        var cp = categoryPicker(m);
        panel.appendChild(choiceGroup(SK.MODES.map(function (x) { return { id: x.id, name: x.name, text: x.text, icon: I.mode(x.id) }; }), m.modes, true, function (v) { m.modes = v; m.categories = []; cp.redraw(); }));
        panel.appendChild(U.el('div', { class: 'field' }, [U.el('span', null, 'Themen'), cp]));
      }
      if (tab === 2) {
        var bf = brainFields(m);
        panel.appendChild(choiceGroup(PROVIDERS, m.provider, false, function (v) { m.provider = v; bf.redraw(); }));
        panel.appendChild(bf);
      }
      if (tab === 3) panel.appendChild(behaviorFields(m));
      if (tab === 4) panel.appendChild(promptField(m));
    }
    var save = A.btn('Speichern', 'save', function () {
      if (!m.name.trim()) { U.toast('Der Name darf nicht leer sein.', 'error'); return; }
      m.name = m.name.trim();
      SK.store.saveModel(m);
      d.close();
      U.toast('Gespeichert', 'ok');
    }, 'btn-primary');
    body.appendChild(tl); body.appendChild(panel);
    body.appendChild(U.el('div', { class: 'dialog-actions' }, [A.btn('Abbrechen', null, function () { d.close(); }, 'btn-ghost'), save]));
    var d = U.modal('„' + orig.name + '“ bearbeiten', body, { wide: true });
    draw();
  }

  /* ---------- Vorhandene Modelle verbinden ---------- */
  function connectDialog() {
    var s = SK.store.settings();
    var body = U.el('div', { class: 'stack' });
    var tl = U.el('div', { class: 'tabs', role: 'tablist' });
    var panel = U.el('div', { class: 'stack' });
    var which = 'ollama';
    ['ollama', 'openai'].forEach(function (k) {
      var b = U.el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(k === which) }, k === 'ollama' ? 'Ollama (lokal)' : 'OpenAI-kompatibel');
      b.addEventListener('click', function () { which = k; U.$$('.tab', tl).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); draw(); });
      tl.appendChild(b);
    });
    function addRow(name, sub, provider, extra) {
      var exists = SK.store.models().some(function (x) { return x.provider === provider && (x.baseModel === name || x.ollamaName === name); });
      var btn = A.btn(exists ? 'Schon da' : 'Hinzufügen', exists ? 'check' : 'plus', function () {
        var m = Object.assign(blankModel(), { name: name.split('/').pop().replace(/:latest$/, ''), provider: provider, baseModel: name, icon: provider === 'ollama' ? 'laptop' : 'cloud' }, extra || {});
        if (I.MODEL_ICONS.indexOf(m.icon) < 0) m.icon = 'shield';
        SK.store.saveModel(m);
        btn.disabled = true; btn.querySelector('span').textContent = 'Hinzugefügt';
        U.toast('„' + m.name + '“ hinzugefügt. Es wird mit dem Survival-Systemprompt und deinen Trainingsdaten zum Profi.', 'ok');
      }, 'btn-sm', { disabled: exists ? true : null });
      return U.el('div', { class: 'run' }, [U.el('span', { class: 'model-badge', html: I.get(provider === 'ollama' ? 'laptop' : 'cloud') }), U.el('div', null, [U.el('b', null, name), U.el('div', { class: 'small muted' }, sub || '')]), btn]);
    }
    async function draw() {
      panel.innerHTML = '';
      if (which === 'ollama') {
        panel.appendChild(U.el('p', { class: 'muted' }, 'Alle Modelle, die du mit Ollama geladen hast, kannst du hier als Gehirn für eine Survival-KI übernehmen.'));
        var list = U.el('div', { class: 'run-list' }, [U.el('p', { class: 'muted' }, 'Suche Modelle unter ' + s.ollamaUrl + ' …')]);
        panel.appendChild(list);
        try {
          var models = await SK.ai.ollama.tags(s.ollamaUrl);
          A.status.ollama = true; A.status.ollamaModels = models;
          list.innerHTML = '';
          if (!models.length) list.appendChild(U.el('p', { class: 'muted' }, 'Ollama läuft, hat aber noch keine Modelle. Lade eins, zum Beispiel mit: ollama pull llama3.2:3b'));
          models.forEach(function (x) { list.appendChild(addRow(x.name, [x.params, x.family, x.quant, x.size ? (x.size / 1e9).toFixed(1) + ' GB' : ''].filter(Boolean).join(' · '), 'ollama')); });
        } catch (e) {
          list.innerHTML = '';
          list.appendChild(A.callout('warn', 'alert', 'Ollama nicht erreichbar', e.message));
          list.appendChild(A.btn('Anleitung in der Hilfe', 'help', function () { d.close(); A.go('hilfe'); }, 'btn-sm'));
        }
      } else {
        var base = U.el('input', { type: 'url', id: 'c-base', value: s.openaiBase });
        var key = U.el('input', { type: 'password', id: 'c-key', value: s.openaiKey || '', autocomplete: 'off', placeholder: 'sk-… (für lokale Server leer lassen)' });
        var list2 = U.el('div', { class: 'run-list' });
        panel.appendChild(A.field('Server-Adresse', base, 'OpenAI: https://api.openai.com/v1 · LM Studio: http://localhost:1234/v1 · OpenRouter: https://openrouter.ai/api/v1'));
        panel.appendChild(A.field('API-Schlüssel', key));
        panel.appendChild(U.el('div', { class: 'actions' }, [A.btn('Modelle laden', 'refresh', async function () {
          list2.innerHTML = '';
          try {
            var ms = await SK.ai.openai.models(base.value, key.value.trim());
            if (!ms.length) list2.appendChild(U.el('p', { class: 'muted' }, 'Der Server meldet keine Modelle.'));
            var own = base.value.trim() !== s.openaiBase || key.value.trim() !== (s.openaiKey || '');
            ms.slice(0, 80).forEach(function (x) { list2.appendChild(addRow(x.name, x.owned || '', 'openai', own ? { endpoint: base.value.trim(), apiKey: key.value.trim() } : null)); });
          } catch (e) { list2.appendChild(A.callout('warn', 'alert', 'Verbindung fehlgeschlagen', e.message)); }
        }, 'btn-primary')]));
        panel.appendChild(list2);
      }
    }
    body.appendChild(tl); body.appendChild(panel);
    var d = U.modal('Vorhandenes Modell verbinden', body, { wide: true });
    draw();
  }

  /* ---------- Export / Import eines Modells ---------- */
  function exportModel(m) {
    var w = U.storage.get('ski.weights.' + m.id, null);
    var copy = JSON.parse(JSON.stringify(m)); copy.apiKey = '';
    U.download(U.slug(m.name) + '.survival-ki.json', JSON.stringify({ app: 'survival-ki-studio', kind: 'model', v: 1, model: copy, weights: w }, null, 1), 'application/json');
  }
  async function importModel(file) {
    try {
      var obj = JSON.parse(await U.readFile(file));
      if (!obj || obj.kind !== 'model' || !obj.model) throw new Error('Das ist keine Modell-Datei vom Survival-KI Studio.');
      var m = obj.model; var oldId = m.id;
      m.id = null; m.preset = false;
      if (SK.store.models().some(function (x) { return x.name === m.name; })) m.name += ' (importiert)';
      var saved = SK.store.saveModel(m);
      if (obj.weights) SK.store.setWeights(saved.id, obj.weights);
      U.toast('„' + saved.name + '“ importiert' + (obj.weights ? ' (mit Training)' : '') + '.', 'ok');
      return oldId;
    } catch (e) { U.toast(e.message || 'Datei konnte nicht gelesen werden.', 'error'); }
  }

  /* ---------- Karte ---------- */
  function card(m) {
    var st = SK.store.modelStatus(m), active = SK.store.activeModel();
    var isActive = active && active.id === m.id;
    var menuBtn = U.el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Weitere Aktionen für ' + m.name, 'aria-haspopup': 'true', 'aria-expanded': 'false', html: I.get('more') });
    var menu = U.el('div', { class: 'menu' }, [menuBtn]);
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = U.$('.menu-list', menu);
      U.$$('.menu-list').forEach(function (x) { x.remove(); });
      if (open) { menuBtn.setAttribute('aria-expanded', 'false'); return; }
      menuBtn.setAttribute('aria-expanded', 'true');
      var list = U.el('div', { class: 'menu-list', role: 'menu' });
      function item(icon, label, fn, danger) {
        var b = U.el('button', { type: 'button', role: 'menuitem', class: danger ? 'danger' : '', html: I.get(icon) });
        b.appendChild(U.el('span', null, label));
        b.addEventListener('click', function () { list.remove(); fn(); });
        list.appendChild(b);
      }
      item('edit', 'Bearbeiten', function () { editor(m.id); });
      if (!isActive) item('star', 'Als aktiv setzen', function () { SK.store.setActiveModel(m.id); A.refresh(); });
      item('copy', 'Duplizieren', function () { var c = SK.store.duplicateModel(m.id); U.toast('Kopie „' + c.name + '“ erstellt', 'ok'); });
      item('download', 'Als Datei exportieren', function () { exportModel(m); });
      item('trash', 'Löschen', function () {
        U.confirm({ title: '„' + m.name + '“ löschen?', text: 'Das Modell, sein Training und sein Chat werden gelöscht. Trainingsdaten bleiben erhalten.', ok: 'Löschen', danger: true }).then(function (ok) {
          if (ok) { SK.store.removeModel(m.id); U.toast('Gelöscht'); }
        });
      }, true);
      menu.appendChild(list);
      setTimeout(function () { document.addEventListener('click', function close() { list.remove(); menuBtn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', close); }); }, 0);
    });
    var meta = SK.ai.providerLabel(m) + (m.provider === 'ollama' ? ' · ' + (m.ollamaName || m.baseModel || '?') : m.baseModel ? ' · ' + m.baseModel : '') + ' · ' + SK.engine.modelCategories(m).length + ' Themen';
    return U.el('article', { class: 'card model-card' + (isActive ? ' active' : '') }, [
      U.el('div', { class: 'card-top' }, [
        U.el('div', { class: 'row' }, [A.statusPill(m), isActive ? U.el('span', { class: 'pill pill-ok', html: I.get('star') + 'Aktiv' }) : null, m.preset ? U.el('span', { class: 'pill pill-neutral' }, 'Vorlage') : null]),
        menu,
      ]),
      U.el('div', { class: 'model-top' }, [A.modelBadge(m), U.el('div', { class: 'stack-sm' }, [U.el('h3', { class: 'model-name' }, m.name), U.el('div', { class: 'model-meta' }, meta.toUpperCase())])]),
      U.el('div', { class: 'mode-strip' }, (m.modes || []).map(A.modeChip)),
      m.notes ? U.el('p', { class: 'small muted' }, m.notes) : null,
      U.el('div', { class: 'model-foot' }, [
        A.gradeEl(st.score),
        U.el('div', { class: 'actions' }, [
          A.btn('Chatten', 'chat', function () { A.useModel(m.id, 'chat'); }, 'btn-sm'),
          A.btn('Trainieren', 'train', function () { A.useModel(m.id, 'training'); }, 'btn-sm'),
          A.btn('Prüfen', 'clipboard', function () { A.useModel(m.id, 'pruefung'); }, 'btn-sm'),
        ]),
      ]),
    ]);
  }

  SK.views.modelle = {
    title: 'Meine Modelle',
    render: function (el) {
      var fileIn = U.el('input', { type: 'file', accept: '.json,application/json', hidden: true, id: 'model-import' });
      fileIn.addEventListener('change', function () { if (fileIn.files[0]) importModel(fileIn.files[0]); fileIn.value = ''; });
      el.appendChild(fileIn);
      el.appendChild(A.head('Modelle', 'Meine Modelle',
        'Jedes Modell hat ein Spezialgebiet (Modi und Themen), ein Gehirn (Offline-KI, Ollama, Cloud-API oder dein selbst trainiertes Modell) und eine Persönlichkeit.',
        [
          A.btn('Neue KI erstellen', 'plus', function () { wizard(); }, 'btn-primary'),
          A.btn('Vorhandenes Modell verbinden', 'link', connectDialog),
          A.btn('Importieren', 'upload', function () { fileIn.click(); }, 'btn-ghost'),
        ]));
      var models = SK.store.models();
      if (!models.length) {
        el.appendChild(U.el('div', { class: 'card empty' }, [U.el('span', { html: I.get('cpu') }), U.el('p', null, 'Noch keine Modelle.'),
          U.el('div', { class: 'actions' }, [A.btn('Neue KI erstellen', 'plus', function () { wizard(); }, 'btn-primary'), A.btn('Vorlagen wiederherstellen', 'refresh', function () { SK.store.restorePresets(); })])]));
        return;
      }
      var grid = U.el('div', { class: 'grid-auto' });
      models.forEach(function (m) { grid.appendChild(card(m)); });
      el.appendChild(grid);
      el.appendChild(A.callout('', 'help', 'Du hast schon eigene Modelle?', 'Mit „Vorhandenes Modell verbinden“ übernimmst du Modelle aus Ollama, LM Studio oder einer Cloud-API. Sie bekommen den Survival-Systemprompt und dein Wissen aus den Trainingsdaten, und du kannst sie hier trainieren und prüfen.'));
    },
    wizard: wizard,
    editor: editor,
    connect: connectDialog,
  };
})();
