/* Survival-KI Studio – Testen & Chat */
(function () {
  var U = SK.util, I = SK.icons, A = SK.app;
  var st = { mode: 'alle', busy: false, abort: null };
  var els = {};

  function model() { return SK.store.activeModel(); }
  function msgs() { var m = model(); return m ? SK.store.chat(m.id) : []; }
  function saveMsgs(list) { var m = model(); if (m) SK.store.setChat(m.id, list); }

  function showSource(id) {
    var e = SK.store.example(id);
    if (!e) return;
    U.modal(e.q, U.el('div', { class: 'stack' }, [A.catChip(e.c), U.el('div', { class: 'md', html: U.md(e.a) }),
      U.el('p', { class: 'small muted' }, 'Aus deinen Trainingsdaten. Bearbeiten kannst du es unter Trainingsdaten.')]), { wide: true });
  }

  function msgEl(msg, index) {
    var isUser = msg.role === 'user';
    var m = model();
    var av = U.el('span', { class: 'msg-av', html: I.get(isUser ? 'chat' : (m && m.icon) || 'shield') });
    var body = U.el('div', { class: 'msg-body' });
    if (!isUser && msg.meta && msg.meta.emergency) body.appendChild(U.el('div', { class: 'sos', role: 'alert', html: I.get('alert') + '<span>Notfall? Ruf sofort die 112 an (Polizei 110).</span>' }));
    var content = U.el('div', { class: 'md' + (msg.pending ? ' typing' : '') });
    if (isUser) content.textContent = msg.content; else content.innerHTML = U.md(msg.content || '');
    body.appendChild(content);
    if (!isUser && !msg.pending) {
      var foot = U.el('div', { class: 'msg-foot' });
      if (msg.sources && msg.sources.length) {
        var src = U.el('div', { class: 'src' }, [U.el('span', null, msg.meta && msg.meta.kind ? 'Aus deinen Trainingsdaten:' : 'Mitgeschicktes Wissen:')]);
        msg.sources.slice(0, msg.meta && msg.meta.kind === 'answer' ? 3 : 3).forEach(function (s, i) {
          var b = U.el('button', { type: 'button', title: 'Ansehen' }, (i === 0 && msg.meta && msg.meta.kind ? '✓ ' : '') + s.q);
          b.addEventListener('click', function () { if (i > 0 && msg.meta && msg.meta.kind) ask(s.q); else showSource(s.id); });
          src.appendChild(b);
        });
        foot.appendChild(src);
      }
      foot.appendChild(U.el('span', { class: 'grow' }));
      if (msg.meta && msg.meta.category && msg.meta.kind) foot.appendChild(A.catChip(msg.meta.category.id));
      var up = U.el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Gute Antwort', 'aria-pressed': String(msg.rating === 1), html: I.get('up') });
      var down = U.el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Schlechte Antwort', 'aria-pressed': String(msg.rating === -1), html: I.get('down') });
      function rate(v) { var list = msgs(); if (!list[index]) return; list[index].rating = list[index].rating === v ? 0 : v; saveMsgs(list); up.setAttribute('aria-pressed', String(list[index].rating === 1)); down.setAttribute('aria-pressed', String(list[index].rating === -1)); if (v === -1 && list[index].rating === -1) U.toast('Tipp: Speichere eine bessere Antwort als Trainingsbeispiel.'); }
      up.addEventListener('click', function () { rate(1); });
      down.addEventListener('click', function () { rate(-1); });
      var save = U.el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Als Trainingsbeispiel speichern', title: 'Als Trainingsbeispiel speichern', html: I.get('save') });
      save.addEventListener('click', function () {
        var list = msgs(), q = '';
        for (var i = index - 1; i >= 0; i--) if (list[i].role === 'user') { q = list[i].content; break; }
        SK.dataEdit({ id: null, q: q, a: msg.content, c: (msg.meta && msg.meta.category && msg.meta.category.id) || 'strom', alt: [], src: 'chat' });
      });
      var copy = U.el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Antwort kopieren', html: I.get('copy') });
      copy.addEventListener('click', function () { U.copy(U.plain(msg.content)).then(function (ok) { U.toast(ok ? 'Kopiert' : 'Kopieren nicht möglich'); }); });
      [up, down, save, copy].forEach(function (b) { foot.appendChild(b); });
      body.appendChild(foot);
    }
    if (msg.error) body.appendChild(A.callout('bad', 'alert', 'Fehler', msg.error));
    return U.el('div', { class: 'msg ' + (isUser ? 'user' : 'bot') }, [av, body]);
  }

  function drawMsgs() {
    var host = els.msgs;
    if (!host) return;
    host.innerHTML = '';
    var list = msgs(), m = model();
    if (!list.length) {
      var sugg = SK.engine.suggestions(st.mode === 'alle' ? m : Object.assign({}, m, { modes: [st.mode], categories: [] }), 4);
      var box = U.el('div', { class: 'stack' }, [
        U.el('div', { class: 'empty' }, [U.el('span', { html: I.get((m && m.icon) || 'shield') }), U.el('p', null, (m ? '„' + m.name + '“' : 'Die KI') + ' ist bereit. Stell eine Frage oder wähle ein Beispiel.')]),
      ]);
      var s = U.el('div', { class: 'suggest' });
      sugg.forEach(function (q) { var b = U.el('button', { type: 'button', html: I.get('chat') }); b.appendChild(U.el('span', null, q)); b.addEventListener('click', function () { ask(q); }); s.appendChild(b); });
      box.appendChild(s);
      host.appendChild(box);
      return;
    }
    list.forEach(function (msg, i) { host.appendChild(msgEl(msg, i)); });
  }

  async function ask(text) {
    var m = model();
    text = String(text || '').trim();
    if (!text || st.busy || !m) return;
    st.busy = true; setBusy(true);
    var list = msgs().slice();
    list.push({ role: 'user', content: text, at: Date.now() });
    var bot = { role: 'assistant', content: '', pending: true, at: Date.now() };
    list.push(bot);
    saveMsgs(list); drawMsgs();
    var botEl = els.msgs.lastChild, contentEl = botEl.querySelector('.md');
    scrollDown();
    st.abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    try {
      var history = list.slice(0, -1).filter(function (x) { return !x.error; }).map(function (x) { return { role: x.role, content: x.content }; });
      var res = await SK.ai.respond(m, history, {
        mode: st.mode, signal: st.abort && st.abort.signal,
        onToken: function (d, full) { contentEl.innerHTML = U.md(full); scrollDown(); },
      });
      bot.content = res.text || '(keine Antwort)';
      bot.sources = res.sources || [];
      var meta = res.meta || {};
      bot.meta = { emergency: !!meta.emergency, kind: meta.kind || null, category: meta.category || (bot.sources[0] ? { id: bot.sources[0].c } : null) };
    } catch (e) {
      bot.content = bot.content || '';
      bot.error = e.message;
    }
    bot.pending = false;
    var all = msgs(); all[all.length - 1] = bot; saveMsgs(all);
    drawMsgs(); scrollDown();
    st.busy = false; st.abort = null; setBusy(false);
    els.input.focus();
  }

  function setBusy(b) {
    els.send.hidden = b; els.stop.hidden = !b;
    els.input.disabled = false;
  }
  function scrollDown() { var last = els.msgs.lastChild; if (last && last.scrollIntoView) last.scrollIntoView({ block: 'end', behavior: 'smooth' }); }

  function exportChat() {
    var m = model(), list = msgs();
    var md = ['# Chat mit ' + m.name, '', 'Exportiert am ' + new Date().toLocaleString('de-DE'), ''];
    list.forEach(function (x) { md.push((x.role === 'user' ? '## Frage' : '## Antwort') , '', x.content, ''); });
    U.download('chat-' + U.slug(m.name) + '.md', md.join('\n'), 'text/markdown;charset=utf-8');
  }

  SK.views.chat = {
    title: 'Testen & Chat',
    keep: true,
    render: function (el) {
      var m = model();
      var sel = A.modelSelect('c-model', m && m.id, function (v) { SK.store.setActiveModel(v); drawInfo(); drawMsgs(); });
      var modes = U.el('div', { class: 'row', role: 'group', 'aria-label': 'Modus' });
      [{ id: 'alle', name: 'Alle' }].concat(SK.MODES).forEach(function (x) {
        var b = U.el('button', { type: 'button', class: 'chip', 'aria-pressed': String(st.mode === x.id), 'data-mode': x.id }, [x.id !== 'alle' ? U.el('span', { class: 'dot ' + x.id }) : null, x.name]);
        b.addEventListener('click', function () { st.mode = x.id; U.$$('.chip', modes).forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.mode === x.id)); }); if (!msgs().length) drawMsgs(); });
        modes.appendChild(b);
      });
      els.modes = modes;
      var clear = A.btn('Neuer Chat', 'refresh', function () {
        if (!msgs().length) return;
        U.confirm({ title: 'Chat leeren?', text: 'Der Verlauf mit diesem Modell wird gelöscht.', ok: 'Leeren', danger: true }).then(function (ok) { if (ok) { saveMsgs([]); drawMsgs(); } });
      }, 'btn-sm btn-ghost');
      var exp = A.btn('Exportieren', 'download', exportChat, 'btn-sm btn-ghost');
      els.info = U.el('p', { class: 'small muted' });
      var bar = U.el('div', { class: 'chat-bar' }, [A.field('Modell', sel), U.el('div', { class: 'stack-sm' }, [U.el('span', { class: 'label' }, 'Modus'), modes]), U.el('div', { class: 'actions' }, [clear, exp])]);
      els.msgs = U.el('div', { class: 'msgs', 'aria-live': 'polite' });
      els.input = U.el('textarea', { id: 'c-input', rows: 1, placeholder: 'Frag zum Beispiel: Wie lange hält Essen in der Gefriertruhe ohne Strom?', 'aria-label': 'Deine Frage' });
      els.send = A.btn('Senden', 'send', function () { var t = els.input.value; els.input.value = ''; autosize(); ask(t); }, 'btn-primary');
      els.stop = A.btn('Stopp', 'stop', function () { if (st.abort) st.abort.abort(); }, '', { hidden: true });
      els.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); els.send.click(); } });
      function autosize() { els.input.style.height = 'auto'; els.input.style.height = Math.min(180, els.input.scrollHeight) + 'px'; }
      els.input.addEventListener('input', autosize);
      var composer = U.el('form', { class: 'composer' }, [els.input, U.el('div', { class: 'row' }, [els.stop, els.send])]);
      composer.addEventListener('submit', function (e) { e.preventDefault(); els.send.click(); });
      el.appendChild(A.head('Testen', 'Chat mit deiner KI', null, []));
      el.appendChild(U.el('div', { class: 'chat-wrap' }, [U.el('div', { class: 'stack-sm' }, [bar, els.info]), els.msgs, composer]));
      function drawInfo() {
        var mm = model();
        if (!mm) { els.info.textContent = ''; return; }
        var st2 = SK.store.modelStatus(mm);
        var parts = [SK.ai.providerLabel(mm) + (mm.provider === 'ollama' ? ': ' + (mm.ollamaName || mm.baseModel) : mm.baseModel ? ': ' + mm.baseModel : '')];
        if (mm.provider === 'offline') parts.push(st2.trained ? (st2.stale ? 'trainiert, Daten seitdem geändert' : 'trainiert') : 'noch nicht trainiert (Training → Im Browser)');
        else parts.push(mm.rag !== false ? 'mit Wissen aus den Trainingsdaten' : 'ohne Trainingsdaten');
        parts.push(mm.strict !== false ? 'nur Fachgebiet' : 'auch andere Themen');
        els.info.textContent = parts.join(' · ');
      }
      els.drawInfo = drawInfo;
      drawInfo();
      drawMsgs();
    },
    onShow: function () {
      SK.views.chat.refresh();
      if (els.drawInfo) els.drawInfo();
      drawMsgs();
      if (els.modes) U.$$('.chip', els.modes).forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.mode === st.mode)); });
    },
    refresh: function () {
      var sel = U.$('#c-model'), m = model();
      if (sel) { var n = A.modelSelect('c-model', m && m.id, function (v) { SK.store.setActiveModel(v); els.drawInfo(); drawMsgs(); }); sel.replaceWith(n); }
      if (els.drawInfo) els.drawInfo();
    },
    setMode: function (mode) { st.mode = mode; },
    ask: ask,
  };
})();
