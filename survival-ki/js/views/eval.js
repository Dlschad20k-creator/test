/* Survival-KI Studio – Prüfung: Ist deine KI ein Profi? */
(function () {
  var U = SK.util, I = SK.icons, A = SK.app;
  var st = { running: false, stop: false, selected: null, modes: { blackout: true, survival: true, apokalypse: true, abgrenzung: true }, showId: null };
  var root;

  function benchFor() { return SK.BENCHMARK.filter(function (b) { return st.modes[b.mode]; }); }

  function computeScore(results) {
    var total = 0, weight = 0, per = {};
    results.forEach(function (r) {
      var item = SK.BENCHMARK.filter(function (b) { return b.id === r.id; })[0];
      if (!item) return;
      var s = r.override === undefined || r.override === null ? r.score : r.override;
      var w = item.critical ? 2 : 1;
      total += s * w; weight += w;
      per[item.mode] = per[item.mode] || { s: 0, n: 0 }; per[item.mode].s += s; per[item.mode].n++;
    });
    var perMode = {};
    Object.keys(per).forEach(function (k) { perMode[k] = per[k].s / per[k].n; });
    return { score: weight ? total / weight : 0, perMode: perMode };
  }

  async function run(models) {
    if (st.running) return;
    st.running = true; st.stop = false;
    var items = benchFor();
    function ui() {
      var host = U.$('#ev-progress');
      if (host) host.hidden = false;
      return { bar: host && U.$('.progress > span', host), label: U.$('#ev-label') };
    }
    var total = items.length * models.length, done = 0, last = null;
    ui();
    for (var mi = 0; mi < models.length && !st.stop; mi++) {
      var m = models[mi], results = [];
      for (var i = 0; i < items.length && !st.stop; i++) {
        var item = items[i];
        var u = ui();
        if (u.label) u.label.textContent = m.name + ': Frage ' + (i + 1) + ' von ' + items.length + ' – ' + item.q;
        var text = '', meta = {};
        try {
          var res = await SK.ai.respond(m, [{ role: 'user', content: item.q }], {});
          text = res.text; meta = res.meta || {};
        } catch (e) {
          text = ''; meta = { error: e.message };
          if (e.network) { U.toast(e.message, 'error'); st.stop = true; }
        }
        var sc = SK.engine.scoreAnswer(item, text, meta);
        results.push({ id: item.id, score: sc.score, hits: sc.hits, misses: sc.misses, answer: text, error: meta.error });
        done++;
        var u2 = ui();
        if (u2.bar) u2.bar.style.width = Math.round(done / total * 100) + '%';
      }
      if (results.length) {
        var c = computeScore(results);
        last = SK.store.addEval({ modelId: m.id, modelName: m.name, score: c.score, perMode: c.perMode, results: results, kind: 'manual', provider: m.provider, partial: results.length < items.length });
      }
    }
    st.running = false;
    var ph = U.$('#ev-progress'); if (ph) ph.hidden = true;
    if (last) { st.showId = last.id; U.toast('Prüfung fertig: ' + U.fmtPct(last.score) + ' – ' + SK.engine.grade(last.score).name, 'ok'); }
    redraw();
  }

  function redraw() { if (root && A.current() === 'pruefung') { root.innerHTML = ''; SK.views.pruefung.render(root); } }

  function rankMeter(level) {
    var box = U.el('span', { class: 'rank-meter', 'aria-hidden': 'true' });
    for (var i = 1; i <= 4; i++) box.appendChild(U.el('span', { class: i <= level ? 'on' : '' }));
    return box;
  }

  function resultView(ev) {
    var g = SK.engine.grade(ev.score);
    var wrap = U.el('section', { class: 'card stack', 'aria-labelledby': 'ev-res-title' });
    wrap.appendChild(U.el('div', { class: 'row-between' }, [
      U.el('h2', { class: 'card-title', id: 'ev-res-title' }, 'Ergebnis von „' + ev.modelName + '“'),
      U.el('span', { class: 'small muted' }, U.fmtDate(ev.at) + (ev.kind === 'auto' ? ' · automatisch nach dem Training' : '') + (ev.partial ? ' · nicht vollständig' : '')),
    ]));
    wrap.appendChild(U.el('div', { class: 'score-hero' }, [
      U.el('div', { class: 'score-big' }, U.fmtPct(ev.score)),
      U.el('div', { class: 'stack-sm' }, [
        U.el('span', { class: 'rank' }, [g.name, rankMeter(g.level)]),
        U.el('p', { class: 'muted' }, g.level >= 4 ? 'Hervorragend. Diese KI kennt sich in Krisen richtig gut aus.' : g.level >= 3 ? 'Profi-Niveau. Ein paar Lücken lassen sich mit mehr Trainingsdaten schließen.' : g.level >= 2 ? 'Auf dem Weg. Trainiere mit mehr Daten oder einem größeren Modell.' : 'Noch Anfänger. Trainiere die KI oder gib ihr Wissen aus den Trainingsdaten mit.'),
      ]),
    ]));
    var bars = U.el('div');
    wrap.appendChild(U.el('div', { class: 'stack-sm' }, [U.el('h3', { class: 'card-title' }, 'Nach Modus'), bars]));
    var names = { blackout: 'Blackout', survival: 'Survival', apokalypse: 'Apokalypse', abgrenzung: 'Fremde Themen ablehnen' };
    SK.charts.bars(bars, { max: 1, items: Object.keys(ev.perMode).map(function (k) { return { label: names[k] || k, value: ev.perMode[k] }; }), format: function (v) { return U.fmtPct(v); } });

    // Tabelle
    var tw = U.el('div', { class: 'table-wrap' });
    var t = U.el('table');
    t.appendChild(U.el('thead', null, U.el('tr', null, [U.el('th', null, 'Frage'), U.el('th', null, 'Modus'), U.el('th', { class: 'num' }, 'Punkte'), U.el('th', null, 'Bewertung')])));
    var tb = U.el('tbody');
    ev.results.forEach(function (r) {
      var item = SK.BENCHMARK.filter(function (b) { return b.id === r.id; })[0];
      if (!item) return;
      var s = r.override === undefined || r.override === null ? r.score : r.override;
      var detail = U.el('details', null, [U.el('summary', { class: 'small', style: 'cursor:pointer' }, 'Antwort ansehen'), U.el('div', { class: 'md small inset', html: U.md(r.answer || (r.error ? 'Fehler: ' + r.error : '(leer)')) })]);
      var qCell = U.el('td', null, [U.el('div', { class: 'res-q' }, item.q), item.critical ? U.el('span', { class: 'pill pill-warn' }, 'sicherheitskritisch ×2') : null,
        r.misses && r.misses.length ? U.el('div', { class: 'res-miss' }, 'fehlt: ' + r.misses.join(', ')) : U.el('div', { class: 'res-hit' }, 'alle Kernpunkte genannt'), detail]);
      var ok = U.el('button', { type: 'button', class: 'btn btn-sm', 'aria-pressed': String(r.override === 1) }, 'richtig');
      var bad = U.el('button', { type: 'button', class: 'btn btn-sm', 'aria-pressed': String(r.override === 0) }, 'falsch');
      function setOv(v) {
        r.override = r.override === v ? null : v;
        var c = computeScore(ev.results); ev.score = c.score; ev.perMode = c.perMode;
        SK.store.save(); SK.store.emit('evals');
        redraw();
      }
      ok.addEventListener('click', function () { setOv(1); });
      bad.addEventListener('click', function () { setOv(0); });
      tb.appendChild(U.el('tr', null, [qCell, U.el('td', null, names[item.mode] || item.mode), U.el('td', { class: 'num' }, U.fmtPct(s)), U.el('td', null, U.el('div', { class: 'row' }, [ok, bad]))]));
    });
    t.appendChild(tb); tw.appendChild(t);
    wrap.appendChild(U.el('div', { class: 'stack-sm' }, [
      U.el('h3', { class: 'card-title' }, 'Alle Fragen'),
      U.el('p', { class: 'small muted' }, 'Die Bewertung prüft, ob wichtige Kernpunkte vorkommen. Wenn du anderer Meinung bist, setze „richtig“ oder „falsch“, das zählt dann.'),
      tw,
    ]));
    return wrap;
  }

  SK.views.pruefung = {
    title: 'Prüfung',
    render: function (el) {
      root = el;
      var models = SK.store.models(), active = SK.store.activeModel();
      if (!st.selected) { st.selected = {}; if (active) st.selected[active.id] = true; }
      var nCrit = SK.BENCHMARK.filter(function (b) { return b.critical; }).length, nOff = SK.BENCHMARK.filter(function (b) { return b.kind === 'abgrenzung'; }).length;
      el.appendChild(A.head('Prüfung', 'Ist deine KI ein Profi?',
        SK.BENCHMARK.length + ' Prüfungsfragen aus allen drei Modi. ' + nCrit + ' davon sind sicherheitskritisch und zählen doppelt (z. B. Kohlenmonoxid, Jodtabletten, Pilze). Bei ' + nOff + ' Fragen zu fremden Themen soll die KI höflich ablehnen. Ab 75 % ist sie Profi, ab 90 % Überlebens-Meister.', []));

      var pick = U.el('div', { class: 'stack-sm' });
      models.forEach(function (m) {
        var cb = U.el('input', { type: 'checkbox', id: 'ev-m-' + m.id }); cb.checked = !!st.selected[m.id];
        cb.addEventListener('change', function () { st.selected[m.id] = cb.checked; });
        var last = SK.store.lastEval(m.id);
        pick.appendChild(U.el('label', { class: 'check' }, [cb, U.el('span', null, [U.el('b', null, m.name), U.el('small', null, SK.ai.providerLabel(m) + (last ? ' · zuletzt ' + U.fmtPct(last.score) : ' · noch nicht geprüft'))])]));
      });
      var modeBox = U.el('div', { class: 'row' });
      [['blackout', 'Blackout'], ['survival', 'Survival'], ['apokalypse', 'Apokalypse'], ['abgrenzung', 'Fremde Themen']].forEach(function (x) {
        var b = U.el('button', { type: 'button', class: 'chip', 'aria-pressed': String(!!st.modes[x[0]]) }, [x[0] !== 'abgrenzung' ? U.el('span', { class: 'dot ' + x[0] }) : null, x[1] + ' · ' + SK.BENCHMARK.filter(function (q) { return q.mode === x[0]; }).length]);
        b.addEventListener('click', function () { st.modes[x[0]] = !st.modes[x[0]]; if (!Object.keys(st.modes).some(function (k) { return st.modes[k]; })) st.modes[x[0]] = true; b.setAttribute('aria-pressed', String(!!st.modes[x[0]])); });
        modeBox.appendChild(b);
      });
      var startBtn = A.btn(st.running ? 'Läuft …' : 'Prüfung starten', 'play', function () {
        var chosen = SK.store.models().filter(function (m) { return st.selected[m.id]; });
        if (!chosen.length) { U.toast('Wähle mindestens ein Modell.', 'error'); return; }
        run(chosen);
      }, 'btn-primary btn-lg', { disabled: st.running ? true : null });
      var stopBtn = A.btn('Abbrechen', 'stop', function () { st.stop = true; }, '');
      var prog = U.el('div', { id: 'ev-progress', class: 'stack-sm', hidden: !st.running }, [U.el('div', { class: 'progress' }, [U.el('span')]), U.el('p', { id: 'ev-label', class: 'small muted', 'aria-live': 'polite' }), U.el('div', { class: 'actions' }, [stopBtn])]);
      el.appendChild(U.el('div', { class: 'grid-2' }, [
        U.el('div', { class: 'card stack' }, [U.el('h3', { class: 'card-title' }, 'Welche Modelle prüfen?'), pick]),
        U.el('div', { class: 'card stack' }, [U.el('h3', { class: 'card-title' }, 'Welche Fragen?'), modeBox,
          U.el('p', { class: 'small muted' }, 'Die Offline-KI ist in einer Sekunde fertig. Sprachmodelle brauchen je nach Rechner einige Minuten.'),
          U.el('div', { class: 'actions' }, [startBtn]), prog]),
      ]));

      // Ergebnis
      var evs = SK.store.evals();
      var show = (st.showId && evs.filter(function (e) { return e.id === st.showId; })[0]) || (active && SK.store.lastEval(active.id)) || evs[0];
      if (show) el.appendChild(resultView(show));
      else el.appendChild(U.el('div', { class: 'card empty' }, [U.el('span', { html: I.get('clipboard') }), U.el('p', null, 'Noch keine Prüfung. Starte oben die erste.')]));

      // Vergleich
      var latest = models.map(function (m) { return { m: m, e: SK.store.lastEval(m.id) }; }).filter(function (x) { return x.e; });
      if (latest.length > 1) {
        var ch = U.el('div');
        el.appendChild(U.el('section', { class: 'card stack-sm' }, [U.el('h2', { class: 'card-title' }, 'Vergleich der Modelle'), U.el('p', { class: 'small muted' }, 'Letzte Prüfung je Modell'), ch]));
        SK.charts.bars(ch, { max: 1, items: latest.sort(function (a, b) { return b.e.score - a.e.score; }).map(function (x) { return { label: x.m.name, value: x.e.score, sub: SK.engine.grade(x.e.score).name }; }), format: function (v) { return U.fmtPct(v); } });
      }

      // Verlauf
      if (evs.length) {
        var list = U.el('div', { class: 'run-list' });
        evs.slice(0, 15).forEach(function (e) {
          var b = A.btn('Ansehen', null, function () { st.showId = e.id; redraw(); window.scrollTo(0, 0); }, 'btn-sm' + (show && show.id === e.id ? ' btn-primary' : ''));
          list.appendChild(U.el('div', { class: 'run' }, [U.el('span', { class: 'pill ' + (e.score >= 0.75 ? 'pill-ok' : e.score >= 0.55 ? 'pill-warn' : 'pill-bad') }, U.fmtPct(e.score)), U.el('div', null, [U.el('b', null, e.modelName), U.el('div', { class: 'small muted' }, U.fmtDate(e.at) + ' · ' + SK.engine.grade(e.score).name + (e.kind === 'auto' ? ' · nach Training' : ''))]), b]));
        });
        el.appendChild(U.el('section', { class: 'card stack-sm' }, [U.el('h2', { class: 'card-title' }, 'Bisherige Prüfungen'), list]));
      }
    },
  };
})();
