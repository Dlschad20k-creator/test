/*
 * Survival-KI Studio – Anbindung an Sprachmodelle
 * - Ollama (lokal): Modelle auflisten, chatten, eigene Modelle erstellen
 * - OpenAI und kompatible Server (LM Studio, llama.cpp, vLLM, OpenRouter …): chatten, Fine-Tuning
 * - Lokaler Trainer (trainer/survival_trainer.py): LoRA-Training auf der eigenen Grafikkarte
 */
var SK = (globalThis.SK = globalThis.SK || {});

SK.ai = (function () {
  var U = SK.util;
  var A = {};

  function trimUrl(u) { return String(u || '').trim().replace(/\/+$/, ''); }

  function friendlyNetworkError(err, what, url) {
    if (err && err.name === 'AbortError') return new Error('Abgebrochen.');
    var e = new Error(what + ' ist unter ' + url + ' nicht erreichbar. ' +
      (what === 'Ollama'
        ? 'Läuft Ollama? Wenn diese Seite nicht über localhost geöffnet ist, muss Ollama sie erst erlauben (OLLAMA_ORIGINS, siehe Hilfe).'
        : what === 'Der lokale Trainer'
          ? 'Starte ihn mit „python survival_trainer.py“ (siehe Training → Lokaler Trainer).'
          : 'Prüfe Adresse, Internetverbindung und ob der Server Anfragen aus dem Browser erlaubt (CORS).'));
    e.network = true;
    return e;
  }

  async function readError(res) {
    var text = '';
    try { text = await res.text(); } catch (e) { /* egal */ }
    var msg = text;
    try { var j = JSON.parse(text); msg = (j.error && (j.error.message || j.error)) || j.message || j.detail || text; } catch (e) { /* kein JSON */ }
    if (typeof msg !== 'string') msg = JSON.stringify(msg);
    var e = new Error((msg || ('HTTP ' + res.status)).slice(0, 400));
    e.status = res.status;
    return e;
  }

  // Zeilenweise lesen (NDJSON oder Server-Sent Events)
  async function readLines(res, onLine) {
    if (!res.body || !res.body.getReader) {
      var all = await res.text();
      all.split('\n').forEach(function (l) { if (l.trim()) onLine(l); });
      return;
    }
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        var line = buf.slice(0, idx); buf = buf.slice(idx + 1);
        if (line.trim()) onLine(line);
      }
    }
    if (buf.trim()) onLine(buf);
  }

  /* ================= Ollama ================= */
  A.ollama = {
    version: async function (url) {
      url = trimUrl(url);
      var res;
      try { res = await fetch(url + '/api/version'); } catch (e) { throw friendlyNetworkError(e, 'Ollama', url); }
      if (!res.ok) throw await readError(res);
      return (await res.json()).version;
    },
    tags: async function (url) {
      url = trimUrl(url);
      var res;
      try { res = await fetch(url + '/api/tags'); } catch (e) { throw friendlyNetworkError(e, 'Ollama', url); }
      if (!res.ok) throw await readError(res);
      var j = await res.json();
      return (j.models || []).map(function (m) {
        return { name: m.name || m.model, size: m.size, family: m.details && m.details.family, params: m.details && m.details.parameter_size, quant: m.details && m.details.quantization_level, modified: m.modified_at };
      });
    },
    chat: async function (url, opts) {
      url = trimUrl(url);
      var body = { model: opts.model, messages: opts.messages, stream: true, options: { temperature: opts.temperature === undefined ? 0.3 : opts.temperature, num_ctx: opts.numCtx || 4096 } };
      var res;
      try { res = await fetch(url + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: opts.signal }); }
      catch (e) { throw friendlyNetworkError(e, 'Ollama', url); }
      if (!res.ok) {
        var err = await readError(res);
        if (res.status === 404) err.message = 'Das Modell „' + opts.model + '“ gibt es in Ollama nicht. Lade es mit „ollama pull ' + opts.model + '“ oder wähle ein anderes.';
        throw err;
      }
      var text = '', stats = null;
      await readLines(res, function (line) {
        var j; try { j = JSON.parse(line); } catch (e) { return; }
        if (j.error) throw new Error(j.error);
        if (j.message && j.message.content) { text += j.message.content; if (opts.onToken) opts.onToken(j.message.content, text); }
        if (j.done) stats = { tokens: j.eval_count, ms: j.total_duration ? Math.round(j.total_duration / 1e6) : null };
      });
      return { text: text, stats: stats };
    },
    // Eigenes Modell direkt in Ollama erstellen (Systemprompt + Beispiele + Parameter)
    create: async function (url, body, onStatus) {
      url = trimUrl(url);
      var res;
      try { res = await fetch(url + '/api/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
      catch (e) { throw friendlyNetworkError(e, 'Ollama', url); }
      if (!res.ok) throw await readError(res);
      var last = '';
      await readLines(res, function (line) {
        var j; try { j = JSON.parse(line); } catch (e) { return; }
        if (j.error) throw new Error(j.error);
        if (j.status) { last = j.status; if (onStatus) onStatus(j.status); }
      });
      if (last !== 'success') throw new Error('Ollama hat das Erstellen nicht bestätigt (letzte Meldung: ' + (last || 'keine') + ').');
      return true;
    },
  };

  /* ================= OpenAI & kompatible Server ================= */
  function oaHeaders(key, json) {
    var h = {};
    if (json !== false) h['Content-Type'] = 'application/json';
    if (key) h.Authorization = 'Bearer ' + key;
    return h;
  }
  A.openai = {
    models: async function (base, key) {
      base = trimUrl(base);
      var res;
      try { res = await fetch(base + '/models', { headers: oaHeaders(key, false) }); } catch (e) { throw friendlyNetworkError(e, 'Der Server', base); }
      if (!res.ok) { var err = await readError(res); if (res.status === 401) err.message = 'Der API-Schlüssel wurde abgelehnt. Prüfe ihn in den Einstellungen.'; throw err; }
      var j = await res.json();
      return (j.data || []).map(function (m) { return { name: m.id, owned: m.owned_by }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    },
    chat: async function (base, key, opts, retried) {
      base = trimUrl(base);
      var body = { model: opts.model, messages: opts.messages, stream: true };
      if (opts.temperature !== undefined && !retried) body.temperature = opts.temperature;
      var res;
      try { res = await fetch(base + '/chat/completions', { method: 'POST', headers: oaHeaders(key), body: JSON.stringify(body), signal: opts.signal }); }
      catch (e) { throw friendlyNetworkError(e, 'Der Server', base); }
      if (!res.ok) {
        var err = await readError(res);
        // manche neuen Modelle erlauben keine eigene Temperatur
        if (res.status === 400 && !retried && /temperature/i.test(err.message)) return A.openai.chat(base, key, opts, true);
        if (res.status === 401) err.message = 'Der API-Schlüssel wurde abgelehnt. Prüfe ihn in den Einstellungen.';
        if (res.status === 404) err.message = 'Modell „' + opts.model + '“ nicht gefunden: ' + err.message;
        throw err;
      }
      var text = '';
      var ctype = res.headers.get('content-type') || '';
      if (ctype.indexOf('application/json') >= 0) {
        var j = await res.json();
        text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
        if (opts.onToken) opts.onToken(text, text);
        return { text: text };
      }
      await readLines(res, function (line) {
        if (line.indexOf('data:') !== 0) return;
        var data = line.slice(5).trim();
        if (data === '[DONE]') return;
        var j2; try { j2 = JSON.parse(data); } catch (e) { return; }
        if (j2.error) throw new Error(j2.error.message || 'Fehler vom Server');
        var d = j2.choices && j2.choices[0] && (j2.choices[0].delta || j2.choices[0].message);
        if (d && d.content) { text += d.content; if (opts.onToken) opts.onToken(d.content, text); }
      });
      return { text: text };
    },

    /* ----- Fine-Tuning (OpenAI) ----- */
    uploadFile: async function (base, key, jsonl, filename) {
      base = trimUrl(base);
      var fd = new FormData();
      fd.append('purpose', 'fine-tune');
      fd.append('file', new Blob([jsonl], { type: 'application/jsonl' }), filename || 'survival.jsonl');
      var res;
      try { res = await fetch(base + '/files', { method: 'POST', headers: oaHeaders(key, false), body: fd }); } catch (e) { throw friendlyNetworkError(e, 'Der Server', base); }
      if (!res.ok) throw await readError(res);
      return res.json();
    },
    createJob: async function (base, key, opts) {
      base = trimUrl(base);
      var body = { model: opts.model, training_file: opts.fileId, suffix: opts.suffix || undefined };
      var hp = {};
      if (opts.epochs && opts.epochs !== 'auto') hp.n_epochs = Number(opts.epochs);
      body.method = { type: 'supervised', supervised: { hyperparameters: hp } };
      var res;
      try { res = await fetch(base + '/fine_tuning/jobs', { method: 'POST', headers: oaHeaders(key), body: JSON.stringify(body) }); } catch (e) { throw friendlyNetworkError(e, 'Der Server', base); }
      if (!res.ok) throw await readError(res);
      return res.json();
    },
    job: async function (base, key, id) {
      base = trimUrl(base);
      var res = await fetch(base + '/fine_tuning/jobs/' + encodeURIComponent(id), { headers: oaHeaders(key, false) });
      if (!res.ok) throw await readError(res);
      return res.json();
    },
    events: async function (base, key, id) {
      base = trimUrl(base);
      var res = await fetch(base + '/fine_tuning/jobs/' + encodeURIComponent(id) + '/events?limit=100', { headers: oaHeaders(key, false) });
      if (!res.ok) throw await readError(res);
      var j = await res.json();
      return (j.data || []).slice().reverse(); // älteste zuerst
    },
    cancel: async function (base, key, id) {
      base = trimUrl(base);
      var res = await fetch(base + '/fine_tuning/jobs/' + encodeURIComponent(id) + '/cancel', { method: 'POST', headers: oaHeaders(key) });
      if (!res.ok) throw await readError(res);
      return res.json();
    },
  };

  /* ================= Lokaler Trainer ================= */
  async function trainerFetch(url, path, opts) {
    url = trimUrl(url);
    var res;
    try { res = await fetch(url + path, opts); } catch (e) { throw friendlyNetworkError(e, 'Der lokale Trainer', url); }
    if (!res.ok) throw await readError(res);
    return res.json();
  }
  A.trainer = {
    info: function (url) { return trainerFetch(url, '/api/info'); },
    start: function (url, job) { return trainerFetch(url, '/api/train', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job) }); },
    status: function (url, id, since) { return trainerFetch(url, '/api/status?job=' + encodeURIComponent(id) + '&since=' + (since || 0)); },
    stop: function (url, id) { return trainerFetch(url, '/api/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job: id }) }); },
    chat: function (url, body) { return trainerFetch(url, '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); },
  };

  /* ================= Einheitliche Antwort für alle Modelle ================= */
  var offlineCtx = { index: null, hash: null };
  A.offlineIndex = function () {
    var h = SK.store.datasetHash();
    if (!offlineCtx.index || offlineCtx.hash !== h) {
      offlineCtx.index = SK.engine.buildIndex(SK.store.examples());
      offlineCtx.hash = h;
    }
    return offlineCtx.index;
  };

  A.providerLabel = function (m) {
    return { offline: 'Offline-KI (eingebaut)', ollama: 'Ollama', openai: 'OpenAI-kompatibel', trainer: 'Lokaler Trainer' }[m.provider] || m.provider;
  };

  /*
   * model: Modell aus dem Speicher; history: [{role, content}] inkl. neuer Frage am Ende
   * opts: {onToken(delta, full), signal, mode}
   */
  A.respond = async function (model, history, opts) {
    opts = opts || {};
    var settings = SK.store.settings();
    var question = history[history.length - 1].content;
    var index = A.offlineIndex();
    var cats = SK.engine.modelCategories(model);
    if (opts.mode && opts.mode !== 'alle') {
      var byMode = SK.CATEGORIES.filter(function (c) { return c.modes.indexOf(opts.mode) >= 0; }).map(function (c) { return c.id; });
      var narrowed = cats.filter(function (c) { return byMode.indexOf(c) >= 0; });
      if (narrowed.length) cats = narrowed;
    }

    if (model.provider === 'offline') {
      var m2 = Object.assign({}, model, { categories: cats });
      var r = SK.engine.answer(m2, question, { index: index, classifier: SK.store.weights(model.id) });
      // Tippen nachahmen, damit es sich wie ein Chat anfühlt
      var words = r.text.split(/(\s+)/), out = '';
      for (var i = 0; i < words.length; i++) {
        if (opts.signal && opts.signal.aborted) break;
        out += words[i];
        if (opts.onToken && i % 3 === 0) { opts.onToken(words[i], out); await U.sleep(8); }
      }
      if (opts.onToken) opts.onToken('', r.text);
      return { text: r.text, sources: r.sources, meta: r };
    }

    // Sprachmodelle: Systemprompt + passendes Wissen aus den Trainingsdaten
    var hits = model.rag !== false ? SK.engine.search(index, question, { categories: model.strict === false ? null : cats, limit: 3 }).filter(function (h) { return h.score > 0.2; }) : [];
    var messages = [{ role: 'system', content: SK.prompts.system(model) }];
    if (hits.length) messages.push({ role: 'system', content: SK.prompts.context(hits) });
    history.slice(-10).forEach(function (h) { messages.push({ role: h.role, content: h.content }); });
    var sources = hits.map(function (h) { return { id: h.ex.id, q: h.ex.q, c: h.ex.c, score: h.score }; });
    var res;
    if (model.provider === 'ollama') {
      if (!model.baseModel && !model.ollamaName) throw new Error('Für dieses Modell ist noch kein Ollama-Modell ausgewählt (Modelle → Bearbeiten).');
      res = await A.ollama.chat(model.endpoint || settings.ollamaUrl, { model: model.ollamaName || model.baseModel, messages: messages, temperature: model.temperature, signal: opts.signal, onToken: opts.onToken });
    } else if (model.provider === 'openai') {
      if (!model.baseModel) throw new Error('Für dieses Modell ist noch kein Modellname eingetragen (Modelle → Bearbeiten).');
      res = await A.openai.chat(model.endpoint || settings.openaiBase, model.apiKey || settings.openaiKey, { model: model.baseModel, messages: messages, temperature: model.temperature, signal: opts.signal, onToken: opts.onToken });
    } else if (model.provider === 'trainer') {
      var j = await A.trainer.chat(model.endpoint || settings.trainerUrl, { job: model.trainerJob || '', messages: messages, temperature: model.temperature, max_new_tokens: 400 });
      res = { text: j.text || '' };
      if (opts.onToken) opts.onToken(res.text, res.text);
    } else {
      throw new Error('Unbekannter Anbieter: ' + model.provider);
    }
    return { text: res.text, sources: sources, meta: { emergency: SK.engine.isEmergency(question), stats: res.stats } };
  };

  return A;
})();
