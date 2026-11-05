/*
 * Survival-KI Studio – Exporte
 * Trainingsdaten (OpenAI-JSONL, Alpaca, ShareGPT, CSV, Handbuch), Import,
 * Ollama-Modelfile, Google-Colab-Notebook (Unsloth, LoRA) und Trainingspaket für den lokalen Trainer.
 */
var SK = (globalThis.SK = globalThis.SK || {});

/* Basismodelle, die sich gut für ein Survival-Fine-Tuning eignen (alle frei ladbar, ohne Freischaltung) */
SK.BASES = [
  { id: 'qwen2.5-7b', name: 'Qwen 2.5 · 7 B', hf: 'Qwen/Qwen2.5-7B-Instruct', unsloth: 'unsloth/Qwen2.5-7B-Instruct', ollama: 'qwen2.5:7b', family: 'chatml', params: 7.6, note: 'Beste Qualität auf der kostenlosen Colab-GPU, gutes Deutsch.' },
  { id: 'llama3.1-8b', name: 'Llama 3.1 · 8 B', hf: 'unsloth/Meta-Llama-3.1-8B-Instruct', unsloth: 'unsloth/Meta-Llama-3.1-8B-Instruct', ollama: 'llama3.1:8b', family: 'llama', params: 8.0, note: 'Sehr beliebt, solides Deutsch.' },
  { id: 'mistral-7b', name: 'Mistral · 7 B', hf: 'unsloth/mistral-7b-instruct-v0.3', unsloth: 'unsloth/mistral-7b-instruct-v0.3', ollama: 'mistral:7b', family: 'mistral', params: 7.2, note: 'Europäisches Modell, gutes Deutsch.' },
  { id: 'qwen2.5-3b', name: 'Qwen 2.5 · 3 B', hf: 'Qwen/Qwen2.5-3B-Instruct', unsloth: 'unsloth/Qwen2.5-3B-Instruct', ollama: 'qwen2.5:3b', family: 'chatml', params: 3.1, note: 'Schnell und sparsam, läuft auch auf schwächeren PCs.' },
  { id: 'llama3.2-3b', name: 'Llama 3.2 · 3 B', hf: 'unsloth/Llama-3.2-3B-Instruct', unsloth: 'unsloth/Llama-3.2-3B-Instruct', ollama: 'llama3.2:3b', family: 'llama', params: 3.2, note: 'Klein und flott, gut für Laptops.' },
  { id: 'gemma2-2b', name: 'Gemma 2 · 2 B', hf: 'unsloth/gemma-2-2b-it', unsloth: 'unsloth/gemma-2-2b-it', ollama: 'gemma2:2b', family: 'gemma', params: 2.6, note: 'Von Google, sehr klein.' },
  { id: 'qwen2.5-1.5b', name: 'Qwen 2.5 · 1,5 B', hf: 'Qwen/Qwen2.5-1.5B-Instruct', unsloth: 'unsloth/Qwen2.5-1.5B-Instruct', ollama: 'qwen2.5:1.5b', family: 'chatml', params: 1.5, note: 'Läuft sogar auf dem Handy oder Raspberry Pi.' },
  { id: 'llama3.2-1b', name: 'Llama 3.2 · 1 B', hf: 'unsloth/Llama-3.2-1B-Instruct', unsloth: 'unsloth/Llama-3.2-1B-Instruct', ollama: 'llama3.2:1b', family: 'llama', params: 1.2, note: 'Winzig und schnell, einfache Antworten.' },
  { id: 'qwen2.5-0.5b', name: 'Qwen 2.5 · 0,5 B', hf: 'Qwen/Qwen2.5-0.5B-Instruct', unsloth: 'unsloth/Qwen2.5-0.5B-Instruct', ollama: 'qwen2.5:0.5b', family: 'chatml', params: 0.5, note: 'Trainiert in Minuten sogar ohne Grafikkarte. Antworten eher einfach.' },
  { id: 'smollm2-135m', name: 'SmolLM2 · 135 M (Test)', hf: 'HuggingFaceTB/SmolLM2-135M-Instruct', unsloth: 'HuggingFaceTB/SmolLM2-135M-Instruct', ollama: 'smollm2:135m', family: 'chatml', params: 0.135, note: 'Nur zum Ausprobieren, ob das Training läuft. Kann kaum Deutsch.' },
];

SK.exporter = (function () {
  var U = SK.util;
  var X = {};

  X.base = function (id) { return SK.BASES.filter(function (b) { return b.id === id; })[0] || SK.BASES[0]; };

  /* ---------- Trainingsgespräche bauen ---------- */
  X.shortSystem = function (model) {
    var t = 'Du bist „' + (model.name || 'Survival-KI') + '“, ein KI-Profi für ' + SK.engine.modeText({ modes: model.modes && model.modes.length ? model.modes : ['blackout', 'survival', 'apokalypse'] }) + '. Du antwortest auf Deutsch, praktisch, sicher und fachlich korrekt.';
    if (model.strict !== false) t += ' Fragen außerhalb deines Fachgebiets lehnst du freundlich ab.';
    return t;
  };
  X.refusal = function (model) {
    return 'Darauf bin ich nicht spezialisiert. Ich bin ' + (model.name || 'eine Survival-KI') + ' und helfe dir bei ' +
      SK.engine.modeText({ modes: model.modes && model.modes.length ? model.modes : ['blackout', 'survival', 'apokalypse'] }) +
      '. Frag mich zum Beispiel: ' + (SK.engine.suggestions(model, 1)[0] || 'Wie bereite ich mich auf einen Stromausfall vor?');
  };

  // opts: {system: 'kurz'|'voll'|'keiner', augment: bool, offTopic: bool}
  X.conversations = function (model, examples, opts) {
    opts = opts || {};
    var cats = SK.engine.modelCategories(model);
    var sys = opts.system === 'keiner' ? null : opts.system === 'voll' ? SK.prompts.system(model) : X.shortSystem(model);
    var list = [];
    function conv(q, a) {
      var msgs = [];
      if (sys) msgs.push({ role: 'system', content: sys });
      msgs.push({ role: 'user', content: q });
      msgs.push({ role: 'assistant', content: a });
      list.push({ messages: msgs });
    }
    examples.filter(function (e) { return cats.indexOf(e.c) >= 0; }).forEach(function (e) {
      conv(e.q, e.a);
      if (opts.augment) (e.alt || []).forEach(function (q) { conv(q, e.a); });
    });
    if (opts.offTopic && model.strict !== false) {
      (SK.OFFTOPIC || []).slice(0, 24).forEach(function (q) { conv(q, X.refusal(model)); });
    }
    return list;
  };

  X.stats = function (convs) {
    var tokens = 0;
    convs.forEach(function (c) { c.messages.forEach(function (m) { tokens += U.estimateTokens(m.content) + 4; }); });
    return { count: convs.length, tokens: tokens, avg: convs.length ? Math.round(tokens / convs.length) : 0 };
  };

  /* ---------- Formate ---------- */
  X.toJsonl = function (convs) { return convs.map(function (c) { return JSON.stringify(c); }).join('\n') + '\n'; };
  X.toAlpaca = function (convs) {
    return JSON.stringify(convs.map(function (c) {
      var sys = c.messages.filter(function (m) { return m.role === 'system'; })[0];
      var u = c.messages.filter(function (m) { return m.role === 'user'; })[0];
      var a = c.messages.filter(function (m) { return m.role === 'assistant'; })[0];
      var o = { instruction: u ? u.content : '', input: '', output: a ? a.content : '' };
      if (sys) o.system = sys.content;
      return o;
    }), null, 2);
  };
  X.toShareGPT = function (convs) {
    var map = { system: 'system', user: 'human', assistant: 'gpt' };
    return JSON.stringify(convs.map(function (c) { return { conversations: c.messages.map(function (m) { return { from: map[m.role], value: m.content }; }) }; }), null, 2);
  };
  function csvCell(s) { s = String(s === undefined ? '' : s); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  X.toCsv = function (examples) {
    var catName = {};
    SK.CATEGORIES.forEach(function (c) { catName[c.id] = c.name; });
    return '\ufeff' + ['frage;antwort;kategorie;varianten'].concat(examples.map(function (e) {
      return [csvCell(e.q), csvCell(e.a), csvCell(e.c), csvCell((e.alt || []).join(' | '))].join(';');
    })).join('\r\n') + '\r\n';
  };
  X.toHandbook = function (examples, title) {
    var out = ['# ' + (title || 'Survival-Handbuch'), '', 'Erstellt mit dem Survival-KI Studio am ' + new Date().toLocaleDateString('de-DE') + '. Bei Lebensgefahr: Notruf 112.', ''];
    SK.MODES.forEach(function (mode) {
      var cats = SK.CATEGORIES.filter(function (c) { return c.modes[0] === mode.id; });
      var any = false;
      cats.forEach(function (c) {
        var list = examples.filter(function (e) { return e.c === c.id; });
        if (!list.length) return;
        if (!any) { out.push('## ' + mode.name, ''); any = true; }
        out.push('### ' + c.name, '');
        list.forEach(function (e) { out.push('#### ' + e.q, '', e.a, ''); });
      });
    });
    return out.join('\n');
  };

  /* ---------- Import ---------- */
  function pick(o, keys) {
    for (var i = 0; i < keys.length; i++) { var v = o[keys[i]]; if (typeof v === 'string' && v.trim()) return v.trim(); }
    return '';
  }
  function fromObject(o) {
    if (!o || typeof o !== 'object') return null;
    if (Array.isArray(o.messages)) {
      var u = o.messages.filter(function (m) { return m.role === 'user'; })[0];
      var a = o.messages.filter(function (m) { return m.role === 'assistant'; })[0];
      return u && a ? { q: String(u.content), a: String(a.content) } : null;
    }
    if (Array.isArray(o.conversations)) {
      var h = o.conversations.filter(function (m) { return m.from === 'human' || m.role === 'user'; })[0];
      var g = o.conversations.filter(function (m) { return m.from === 'gpt' || m.role === 'assistant'; })[0];
      return h && g ? { q: String(h.value || h.content), a: String(g.value || g.content) } : null;
    }
    var q = pick(o, ['q', 'question', 'frage', 'instruction', 'prompt', 'input_text']);
    var inp = pick(o, ['input']);
    if (q && inp && o.instruction) q = q + '\n' + inp;
    var ans = pick(o, ['a', 'answer', 'antwort', 'output', 'completion', 'response']);
    if (!q || !ans) return null;
    var ex = { q: q, a: ans };
    var c = pick(o, ['c', 'category', 'kategorie']);
    if (c) ex.c = c;
    if (Array.isArray(o.alt)) ex.alt = o.alt;
    return ex;
  }
  function parseCsv(text) {
    var rows = [], row = [], cell = '', inQ = false, i = 0;
    var first = text.split(/\r?\n/)[0] || '';
    var delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    if ((first.match(/\t/g) || []).length > (first.match(new RegExp(delim, 'g')) || []).length) delim = '\t';
    for (; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(function (c) { return c.trim(); })) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some(function (c) { return c.trim(); })) rows.push(row);
    return rows;
  }
  X.parseImport = function (text, filename) {
    text = String(text || '').replace(/^\ufeff/, '');
    var out = [], trimmed = text.trim();
    if (!trimmed) throw new Error('Die Datei ist leer.');
    var name = String(filename || '').toLowerCase();
    if (trimmed[0] === '[' || (trimmed[0] === '{' && !/\n\s*\{/.test(trimmed))) {
      var data;
      try { data = JSON.parse(trimmed); } catch (e) { data = null; }
      if (data) {
        if (data.app === 'survival-ki-studio') throw new Error('Das ist eine komplette Sicherung. Lade sie unter Einstellungen → Sicherung.');
        var arr = Array.isArray(data) ? data : (data.examples || data.data || data.items || []);
        arr.forEach(function (o) { var ex = fromObject(o); if (ex) out.push(ex); });
        return out;
      }
    }
    if (name.slice(-6) === '.jsonl' || trimmed[0] === '{') {
      trimmed.split(/\r?\n/).forEach(function (line) {
        if (!line.trim()) return;
        try { var ex = fromObject(JSON.parse(line)); if (ex) out.push(ex); } catch (e) { /* Zeile überspringen */ }
      });
      if (out.length) return out;
    }
    var rows = parseCsv(text);
    if (!rows.length) return out;
    var head = rows[0].map(function (h) { return U.normalize(h); });
    var qi = head.findIndex(function (h) { return /^(frage|question|q|instruction|prompt)$/.test(h); });
    var ai = head.findIndex(function (h) { return /^(antwort|answer|a|output|response|completion)$/.test(h); });
    var ci = head.findIndex(function (h) { return /^(kategorie|category|c|thema)$/.test(h); });
    var vi = head.findIndex(function (h) { return /^(varianten|alternativen|alt)$/.test(h); });
    var start = 1;
    if (qi < 0 || ai < 0) { qi = 0; ai = 1; ci = rows[0].length > 2 ? 2 : -1; start = 0; }
    rows.slice(start).forEach(function (r) {
      var q = (r[qi] || '').trim(), a = (r[ai] || '').trim();
      if (!q || !a) return;
      var ex = { q: q, a: a };
      if (ci >= 0 && r[ci]) ex.c = r[ci].trim();
      if (vi >= 0 && r[vi]) ex.alt = r[vi].split('|').map(function (s) { return s.trim(); }).filter(Boolean);
      out.push(ex);
    });
    return out;
  };

  // Kategorie zuordnen: vorhandene Angabe nutzen oder über die Suche erkennen
  X.assignCategories = function (list, index) {
    var byName = {};
    SK.CATEGORIES.forEach(function (c) { byName[U.normalize(c.id)] = c.id; byName[U.normalize(c.name)] = c.id; });
    return list.map(function (ex) {
      var c = ex.c ? byName[U.normalize(ex.c)] : null;
      var auto = false;
      if (!c) {
        var hit = SK.engine.search(index, ex.q + ' ' + ex.a.slice(0, 300), { limit: 1 })[0];
        c = hit ? hit.ex.c : 'strom';
        auto = true;
      }
      return { q: ex.q, a: ex.a, c: c, alt: ex.alt || [], auto: auto };
    });
  };

  /* ---------- Ollama ---------- */
  function mf(s) { return String(s).replace(/"""/g, '"\u200b""'); }
  X.fewShot = function (model, examples, n) {
    var cats = SK.engine.modelCategories(model);
    var pool = examples.filter(function (e) { return cats.indexOf(e.c) >= 0; });
    // gleichmäßig über die Themen verteilt
    var byCat = {};
    pool.forEach(function (e) { (byCat[e.c] = byCat[e.c] || []).push(e); });
    var keys = Object.keys(byCat), out = [], round = 0;
    while (out.length < n && keys.length) {
      var any = false;
      keys.forEach(function (k) { if (out.length < n && byCat[k][round]) { out.push(byCat[k][round]); any = true; } });
      if (!any) break;
      round++;
    }
    return out;
  };
  X.modelfile = function (model, from, nExamples) {
    var shots = X.fewShot(model, SK.store.examples(), nExamples || 0);
    var lines = [
      '# Survival-KI Studio: Modell „' + model.name + '“',
      '# Erstellen mit: ollama create ' + X.ollamaName(model) + ' -f Modelfile',
      'FROM ' + from,
      '',
      'SYSTEM """' + mf(SK.prompts.system(model)) + '"""',
      '',
      'PARAMETER temperature ' + (model.temperature === undefined ? 0.3 : model.temperature),
      'PARAMETER num_ctx 4096',
      'PARAMETER top_p 0.9',
    ];
    if (shots.length) {
      lines.push('', '# Beispielgespräche zeigen dem Modell den gewünschten Stil');
      shots.forEach(function (e) {
        lines.push('MESSAGE user """' + mf(e.q) + '"""');
        lines.push('MESSAGE assistant """' + mf(e.a) + '"""');
      });
    }
    return lines.join('\n') + '\n';
  };
  X.ollamaName = function (model) { return U.slug(model.name || 'survival-ki'); };
  X.ollamaCreateBody = function (model, from, nExamples, name) {
    var shots = X.fewShot(model, SK.store.examples(), nExamples || 0);
    var messages = [];
    shots.forEach(function (e) { messages.push({ role: 'user', content: e.q }, { role: 'assistant', content: e.a }); });
    return {
      model: name || X.ollamaName(model), from: from, system: SK.prompts.system(model),
      parameters: { temperature: model.temperature === undefined ? 0.3 : model.temperature, num_ctx: 4096, top_p: 0.9 },
      messages: messages, stream: true,
    };
  };

  /* ---------- Schätzung für Fine-Tuning ---------- */
  X.estimate = function (base, cfg, stats) {
    var P = base.params, method = cfg.method || 'qlora';
    var act = (cfg.maxSeq / 1024) * cfg.batch * 0.35 * Math.sqrt(Math.max(P, 0.3));
    var vram = method === 'qlora' ? 0.7 * P + 1.2 + act : method === 'lora' ? 2.1 * P + 1.5 + act : 16 * P + 2 + act;
    var steps = Math.ceil(stats.count / (cfg.batch * cfg.accum)) * cfg.epochs;
    var tps = 2600 / Math.pow(Math.max(P, 0.1), 0.85) * (method === 'full' ? 0.4 : method === 'lora' ? 1.2 : 1);
    var minutes = (stats.tokens * cfg.epochs) / tps / 60 + 2 + P * 0.5;
    return { vram: vram, steps: steps, minutes: minutes, fitsT4: vram <= 14.5, fits8: vram <= 7.6, fits12: vram <= 11.5 };
  };

  /* ---------- Google-Colab-Notebook (Unsloth) ---------- */
  var TEMPLATES = {
    llama: 'TEMPLATE """{{ if .System }}<|start_header_id|>system<|end_header_id|>\n\n{{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>\n\n{{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>\n\n{{ .Response }}<|eot_id|>"""\nPARAMETER stop "<|start_header_id|>"\nPARAMETER stop "<|end_header_id|>"\nPARAMETER stop "<|eot_id|>"\n',
    chatml: 'TEMPLATE """{{ if .System }}<|im_start|>system\n{{ .System }}<|im_end|>\n{{ end }}{{ if .Prompt }}<|im_start|>user\n{{ .Prompt }}<|im_end|>\n{{ end }}<|im_start|>assistant\n{{ .Response }}<|im_end|>\n"""\nPARAMETER stop "<|im_start|>"\nPARAMETER stop "<|im_end|>"\n',
    gemma: 'TEMPLATE """<start_of_turn>user\n{{ if .System }}{{ .System }}\n\n{{ end }}{{ .Prompt }}<end_of_turn>\n<start_of_turn>model\n{{ .Response }}<end_of_turn>\n"""\nPARAMETER stop "<start_of_turn>"\nPARAMETER stop "<end_of_turn>"\n',
    mistral: 'TEMPLATE """[INST] {{ if .System }}{{ .System }}\n\n{{ end }}{{ .Prompt }} [/INST]{{ .Response }}"""\nPARAMETER stop "[INST]"\nPARAMETER stop "[/INST]"\n',
  };

  function py(s) { return JSON.stringify(String(s)); } // JSON-Strings sind gültige Python-Strings
  function cell(type, src) {
    var lines = src.replace(/\s+$/, '').split('\n');
    var source = lines.map(function (l, i) { return i < lines.length - 1 ? l + '\n' : l; });
    return type === 'markdown'
      ? { cell_type: 'markdown', metadata: {}, source: source }
      : { cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: source };
  }

  X.notebook = function (model, cfg, convs) {
    var base = X.base(cfg.baseId);
    var sys = cfg.system === 'keiner' ? '' : cfg.system === 'voll' ? SK.prompts.system(model) : X.shortSystem(model);
    var name = X.ollamaName(model);
    var tests = SK.engine.suggestions(model, 3).concat(['Wer hat die Fußball-WM 2014 gewonnen?']);
    var cells = [];
    cells.push(cell('markdown', [
      '# ' + model.name + ': echtes Fine-Tuning (LoRA)',
      '',
      'Dieses Notebook wurde vom **Survival-KI Studio** erstellt. Es trainiert **' + base.name + '** mit **' + convs.length + ' Trainingsgesprächen** zu ' + SK.engine.modeText(model) + '.',
      '',
      '**So geht es:**',
      '1. Oben im Menü **Laufzeit → Laufzeittyp ändern → T4-GPU** wählen.',
      '2. **Laufzeit → Alle ausführen** klicken.',
      '3. Warten (je nach Modell etwa ' + Math.round(cfg.minutes || 20) + ' Minuten). Die Verlust-Kurve sollte sinken.',
      '4. Am Ende liegt dein Modell als **GGUF-Datei** mit **Modelfile** in Google Drive (oder als Download).',
      '5. Am PC: `ollama create ' + name + ' -f Modelfile`, danach im Survival-KI Studio unter **Modelle** das Ollama-Modell `' + name + '` eintragen.',
    ].join('\n')));
    cells.push(cell('code', '# 1) Grafikkarte prüfen\n!nvidia-smi'));
    cells.push(cell('code', '# 2) Unsloth installieren (dauert 1–3 Minuten)\n# Falls ein Fehler kommt: Laufzeit → Sitzung neu starten und diese Zelle noch einmal ausführen.\n!pip install -q unsloth'));
    cells.push(cell('code', [
      '# 3) Einstellungen aus dem Survival-KI Studio',
      'MODEL_NAME = ' + py(base.unsloth),
      'FAMILY = ' + py(base.family),
      'MAX_SEQ_LENGTH = ' + cfg.maxSeq,
      'LOAD_IN_4BIT = ' + (cfg.method === 'qlora' ? 'True' : 'False'),
      'FULL_FINETUNE = ' + (cfg.method === 'full' ? 'True' : 'False'),
      'LORA_R = ' + cfg.r,
      'LORA_ALPHA = ' + cfg.alpha,
      'LORA_DROPOUT = ' + cfg.dropout,
      'EPOCHS = ' + cfg.epochs,
      'LEARNING_RATE = ' + cfg.lr,
      'BATCH_SIZE = ' + cfg.batch,
      'GRAD_ACCUM = ' + cfg.accum,
      'WARMUP_STEPS = ' + cfg.warmup,
      'SEED = 3407',
      'GGUF_QUANT = ' + py(cfg.quant),
      'EXPORT = ' + py(cfg.export) + '  # "drive" = Google Drive, "download" = ZIP herunterladen, "huggingface" = auf Hugging Face hochladen',
      'HF_REPO = ' + py(cfg.hfRepo || '') + '  # nur für EXPORT = "huggingface", z. B. "deinname/' + name + '"',
      'OLLAMA_NAME = ' + py(name),
      'TEMPERATURE = ' + (model.temperature === undefined ? 0.3 : model.temperature),
      'SYSTEM_PROMPT = ' + py(sys),
      'OLLAMA_SYSTEM = ' + py(SK.prompts.system(model)),
      'TEST_QUESTIONS = ' + JSON.stringify(tests),
    ].join('\n')));
    cells.push(cell('code', [
      '# 4) Trainingsdaten (' + convs.length + ' Gespräche aus dem Survival-KI Studio)',
      'import json',
      'DATA = json.loads(r"""' + JSON.stringify(convs) + '""")',
      'print(len(DATA), "Trainingsgespräche geladen")',
      'print(DATA[0]["messages"][-2]["content"])',
    ].join('\n')));
    cells.push(cell('code', [
      '# 5) Basismodell laden und LoRA-Adapter anlegen',
      'from unsloth import FastLanguageModel',
      'import torch',
      'model, tokenizer = FastLanguageModel.from_pretrained(',
      '    model_name = MODEL_NAME,',
      '    max_seq_length = MAX_SEQ_LENGTH,',
      '    dtype = None,',
      '    load_in_4bit = LOAD_IN_4BIT,',
      '    full_finetuning = FULL_FINETUNE,',
      ')',
      'if not FULL_FINETUNE:',
      '    model = FastLanguageModel.get_peft_model(',
      '        model,',
      '        r = LORA_R,',
      '        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],',
      '        lora_alpha = LORA_ALPHA,',
      '        lora_dropout = LORA_DROPOUT,',
      '        bias = "none",',
      '        use_gradient_checkpointing = "unsloth",',
      '        random_state = SEED,',
      '    )',
    ].join('\n')));
    cells.push(cell('code', [
      '# 6) Gespräche in das Chat-Format des Modells bringen',
      'from datasets import Dataset',
      '',
      'def fix_roles(msgs):',
      '    # Gemma und Mistral kennen keine System-Rolle: Systemtext vor die erste Frage setzen',
      '    if FAMILY in ("gemma", "mistral") and msgs and msgs[0]["role"] == "system":',
      '        sys_text, rest = msgs[0]["content"], msgs[1:]',
      '        if rest:',
      '            rest = [{"role": rest[0]["role"], "content": sys_text + "\\n\\n" + rest[0]["content"]}] + rest[1:]',
      '        return rest',
      '    return msgs',
      '',
      'def to_text(example):',
      '    text = tokenizer.apply_chat_template(fix_roles(example["messages"]), tokenize = False, add_generation_prompt = False)',
      '    if FAMILY == "gemma" and tokenizer.bos_token and text.startswith(tokenizer.bos_token):',
      '        text = text[len(tokenizer.bos_token):]',
      '    return {"text": text}',
      '',
      'dataset = Dataset.from_list(DATA).map(to_text, remove_columns = ["messages"])',
      'print(dataset[0]["text"][:800])',
    ].join('\n')));
    cells.push(cell('code', [
      '# 7) Trainer einrichten',
      'import dataclasses',
      'from trl import SFTTrainer, SFTConfig',
      'try:',
      '    from unsloth import is_bfloat16_supported',
      '    BF16 = is_bfloat16_supported()',
      'except Exception:',
      '    BF16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()',
      '',
      'args = dict(',
      '    dataset_text_field = "text",',
      '    per_device_train_batch_size = BATCH_SIZE,',
      '    gradient_accumulation_steps = GRAD_ACCUM,',
      '    warmup_steps = WARMUP_STEPS,',
      '    num_train_epochs = EPOCHS,',
      '    learning_rate = LEARNING_RATE,',
      '    logging_steps = 1,',
      '    optim = "adamw_8bit",',
      '    weight_decay = 0.01,',
      '    lr_scheduler_type = "linear",',
      '    seed = SEED,',
      '    output_dir = "outputs",',
      '    report_to = "none",',
      '    fp16 = not BF16,',
      '    bf16 = BF16,',
      '    max_seq_length = MAX_SEQ_LENGTH,',
      ')',
      '# verschiedene TRL-Versionen nennen manche Einstellungen anders',
      'allowed = {f.name for f in dataclasses.fields(SFTConfig)}',
      'if "max_seq_length" not in allowed and "max_length" in allowed:',
      '    args["max_length"] = args.pop("max_seq_length")',
      'args = {k: v for k, v in args.items() if k in allowed}',
      '',
      'try:',
      '    trainer = SFTTrainer(model = model, tokenizer = tokenizer, train_dataset = dataset, args = SFTConfig(**args))',
      'except TypeError:',
      '    trainer = SFTTrainer(model = model, processing_class = tokenizer, train_dataset = dataset, args = SFTConfig(**args))',
      '',
      '# Nur auf die Antworten trainieren (die Fragen muss das Modell nicht auswendig lernen)',
      'MARKERS = {',
      '    "llama": ("<|start_header_id|>user<|end_header_id|>\\n\\n", "<|start_header_id|>assistant<|end_header_id|>\\n\\n"),',
      '    "chatml": ("<|im_start|>user\\n", "<|im_start|>assistant\\n"),',
      '    "gemma": ("<start_of_turn>user\\n", "<start_of_turn>model\\n"),',
      '    "mistral": ("[INST]", "[/INST]"),',
      '}',
      'try:',
      '    from unsloth.chat_templates import train_on_responses_only',
      '    inst, resp = MARKERS[FAMILY]',
      '    sample = dataset[0]["text"]',
      '    if inst in sample and resp in sample:',
      '        trainer = train_on_responses_only(trainer, instruction_part = inst, response_part = resp)',
      '        print("Es wird nur auf die Antworten trainiert.")',
      'except Exception as e:',
      '    print("Hinweis: Training auf alle Texte, weil:", e)',
    ].join('\n')));
    cells.push(cell('code', [
      '# 8) Training starten',
      'stats = trainer.train()',
      'print(f"Fertig in {stats.metrics[\'train_runtime\'] / 60:.1f} Minuten, letzter Verlust: {stats.metrics.get(\'train_loss\', 0):.3f}")',
      '',
      'import matplotlib.pyplot as plt',
      'hist = [x for x in trainer.state.log_history if "loss" in x]',
      'plt.figure(figsize = (8, 3))',
      'plt.plot([x["step"] for x in hist], [x["loss"] for x in hist], color = "#c4521a", linewidth = 2)',
      'plt.title("Verlust (sollte sinken)"); plt.xlabel("Schritt"); plt.ylabel("Verlust"); plt.grid(alpha = 0.3)',
      'plt.show()',
    ].join('\n')));
    cells.push(cell('code', [
      '# 9) Dein Modell testen',
      'FastLanguageModel.for_inference(model)',
      'for q in TEST_QUESTIONS:',
      '    msgs = fix_roles(([{"role": "system", "content": SYSTEM_PROMPT}] if SYSTEM_PROMPT else []) + [{"role": "user", "content": q}])',
      '    enc = tokenizer.apply_chat_template(msgs, add_generation_prompt = True, return_tensors = "pt", return_dict = True)',
      '    enc = {k: v.to(model.device) for k, v in enc.items()}',
      '    out = model.generate(**enc, max_new_tokens = 350, temperature = TEMPERATURE, top_p = 0.9, do_sample = True)',
      '    print("FRAGE:", q)',
      '    print(tokenizer.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens = True))',
      '    print("-" * 60)',
    ].join('\n')));
    cells.push(cell('code', [
      '# 10) Speichern: LoRA-Adapter und GGUF-Datei für Ollama',
      'import glob, os, shutil',
      'model.save_pretrained("survival_lora")',
      'tokenizer.save_pretrained("survival_lora")',
      'OUT = "survival_export"',
      'os.makedirs(OUT, exist_ok = True)',
      'gguf = None',
      'try:',
      '    model.save_pretrained_gguf("survival_gguf", tokenizer, quantization_method = GGUF_QUANT)',
      '    files = sorted(set(glob.glob("survival_gguf/**/*.gguf", recursive = True) + glob.glob("*.gguf")), key = os.path.getsize)',
      '    wanted = [f for f in files if GGUF_QUANT.lower() in os.path.basename(f).lower()]',
      '    gguf = (wanted or files)[0] if files else None',
      'except Exception as e:',
      '    print("GGUF-Export hat nicht geklappt:", e)',
      '',
      'TEMPLATES = ' + JSON.stringify(TEMPLATES),
      'def modelfile(from_line):',
      '    sys_text = OLLAMA_SYSTEM.replace(\'"""\', \'\\\'\\\'\\\'\')',
      '    return (f"FROM {from_line}\\n" + TEMPLATES.get(FAMILY, "") +',
      '            f\'SYSTEM """{sys_text}"""\\n\' +',
      '            f"PARAMETER temperature {TEMPERATURE}\\nPARAMETER num_ctx 4096\\n")',
      '',
      'if gguf:',
      '    shutil.copy(gguf, os.path.join(OUT, os.path.basename(gguf)))',
      '    open(os.path.join(OUT, "Modelfile"), "w", encoding = "utf-8").write(modelfile("./" + os.path.basename(gguf)))',
      'else:',
      '    print("Speichere stattdessen das komplette Modell (16 Bit).")',
      '    model.save_pretrained_merged(os.path.join(OUT, "merged"), tokenizer, save_method = "merged_16bit")',
      '    open(os.path.join(OUT, "Modelfile"), "w", encoding = "utf-8").write(modelfile("./merged"))',
      'open(os.path.join(OUT, "LIESMICH.txt"), "w", encoding = "utf-8").write(',
      '    f"Modell: {OLLAMA_NAME}\\n\\nIn Ollama erstellen (im Ordner mit dieser Datei):\\n  ollama create {OLLAMA_NAME} -f Modelfile\\n\\nTesten:\\n  ollama run {OLLAMA_NAME}\\n\\nDanach im Survival-KI Studio unter Modelle das Ollama-Modell {OLLAMA_NAME} eintragen.\\n")',
      'print(os.listdir(OUT))',
    ].join('\n')));
    cells.push(cell('code', [
      '# 11) Herunterladen oder sichern',
      'if EXPORT == "drive":',
      '    from google.colab import drive',
      '    drive.mount("/content/drive")',
      '    dest = f"/content/drive/MyDrive/{OLLAMA_NAME}"',
      '    shutil.copytree(OUT, dest, dirs_exist_ok = True)',
      '    print("Gespeichert in Google Drive:", dest)',
      'elif EXPORT == "download":',
      '    shutil.make_archive(OLLAMA_NAME, "zip", OUT)',
      '    from google.colab import files',
      '    files.download(f"{OLLAMA_NAME}.zip")',
      'elif EXPORT == "huggingface":',
      '    from huggingface_hub import login',
      '    login()',
      '    model.push_to_hub_gguf(HF_REPO, tokenizer, quantization_method = GGUF_QUANT)',
      '    print(f"Fertig! In Ollama direkt starten mit: ollama run hf.co/{HF_REPO}")',
      'print(f"Am PC: ollama create {OLLAMA_NAME} -f Modelfile  und dann  ollama run {OLLAMA_NAME}")',
    ].join('\n')));
    var nb = {
      cells: cells,
      metadata: {
        accelerator: 'GPU',
        colab: { provenance: [], gpuType: 'T4', name: name + '-training.ipynb' },
        kernelspec: { display_name: 'Python 3', name: 'python3' },
        language_info: { name: 'python' },
      },
      nbformat: 4, nbformat_minor: 0,
    };
    return JSON.stringify(nb, null, 1);
  };

  /* ---------- Trainingspaket für den lokalen Trainer ---------- */
  X.trainerJob = function (model, cfg, convs) {
    var base = X.base(cfg.baseId);
    return {
      name: X.ollamaName(model),
      title: model.name,
      base_model: cfg.customHf || base.hf,
      family: base.family,
      system: SK.prompts.system(model),
      config: {
        method: cfg.method, epochs: cfg.epochs, learning_rate: cfg.lr, batch_size: cfg.batch, grad_accum: cfg.accum,
        lora_r: cfg.r, lora_alpha: cfg.alpha, lora_dropout: cfg.dropout, max_seq_length: cfg.maxSeq, warmup_steps: cfg.warmup,
        merge: cfg.merge !== false, ollama: cfg.ollama !== false, temperature: model.temperature === undefined ? 0.3 : model.temperature,
      },
      dataset: convs,
    };
  };
  X.trainingPackage = async function (model, cfg, convs) {
    var job = X.trainerJob(model, cfg, convs);
    var script = null;
    try { var r = await fetch('trainer/survival_trainer.py', { cache: 'no-cache' }); if (r.ok) script = await r.text(); } catch (e) { /* offline über file:// */ }
    if (!script) throw new Error('Das Trainer-Skript konnte nicht geladen werden. Öffne die Seite über einen Webserver (z. B. GitHub Pages) statt als Datei.');
    var reqs = 'torch\ntransformers>=4.45\npeft>=0.13\naccelerate\nsafetensors\n# Für 4-Bit-Training (QLoRA) auf NVIDIA-Grafikkarten:\nbitsandbytes; platform_system != "Darwin"\n';
    var bat = '@echo off\r\nchcp 65001 >nul\r\necho Survival-KI Trainer\r\npython -m pip install -r requirements.txt\r\npython survival_trainer.py train job.json\r\npause\r\n';
    var sh = '#!/bin/sh\nset -e\ncd "$(dirname "$0")"\npython3 -m pip install -r requirements.txt\npython3 survival_trainer.py train job.json\n';
    var readme = [
      'Survival-KI Studio – Trainingspaket für „' + model.name + '“',
      '',
      'Inhalt: ' + convs.length + ' Trainingsgespräche, Basismodell ' + job.base_model + ', Methode ' + cfg.method.toUpperCase() + '.',
      '',
      '1. Python 3.10 oder neuer installieren (python.org).',
      '2. Mit NVIDIA-Grafikkarte: PyTorch mit CUDA installieren, siehe https://pytorch.org/get-started/locally/',
      '3. Windows: START_WINDOWS.bat doppelklicken. Mac/Linux: sh start_mac_linux.sh',
      '',
      'Das Ergebnis liegt danach im Ordner ausgabe/' + job.name + '/:',
      '  adapter/   LoRA-Adapter (klein)',
      '  merged/    komplettes Modell (für Ollama oder zum Weitergeben)',
      '  Modelfile  für: ollama create ' + job.name + ' -f Modelfile',
      '',
      'Live mit Fortschrittsanzeige im Browser geht es mit: python survival_trainer.py serve',
      'Dann im Survival-KI Studio unter Training → Lokaler Trainer verbinden.',
    ].join('\r\n');
    return U.zip([
      { name: job.name + '/survival_trainer.py', data: script },
      { name: job.name + '/job.json', data: JSON.stringify(job, null, 1) },
      { name: job.name + '/requirements.txt', data: reqs },
      { name: job.name + '/START_WINDOWS.bat', data: bat },
      { name: job.name + '/start_mac_linux.sh', data: sh, exec: true },
      { name: job.name + '/LIESMICH.txt', data: readme },
    ]);
  };

  X.TEMPLATES = TEMPLATES;
  return X;
})();
