/* Survival-KI Studio – Startseite */
(function () {
  var U = SK.util, I = SK.icons, A = SK.app;

  // Topografische Linien wie auf einer Lagekarte (nur Dekoration)
  function drawTopo(canvas) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    var css = getComputedStyle(document.documentElement);
    ctx.strokeStyle = css.getPropertyValue('--line').trim() || '#ccc';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    var rnd = U.rng(19);
    var centers = [{ x: w * 0.9, y: h * 0.2, s: 1 }];
    centers.forEach(function (c) {
      var phase = rnd() * 6;
      for (var r = 22; r < Math.max(w, h) * 0.85; r += 24) {
        ctx.beginPath();
        for (var a = 0; a <= Math.PI * 2 + 0.01; a += 0.06) {
          var wob = Math.sin(a * 3 + phase + r * 0.013) * r * 0.08 + Math.sin(a * 5 - r * 0.02) * r * 0.035;
          var rr = (r + wob) * c.s;
          var x = c.x + Math.cos(a) * rr * 1.25, y = c.y + Math.sin(a) * rr * 0.8;
          if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
  }

  function step(n, title, text, done, btn) {
    return U.el('li', { class: done ? 'done' : '' }, [
      U.el('span', { class: 'n', 'aria-hidden': 'true' }, done ? '✓' : String(n)),
      U.el('h3', null, title),
      U.el('p', null, text),
      btn,
    ]);
  }

  SK.views.start = {
    title: 'Start',
    render: function (el) {
      var st = SK.store, models = st.models(), ex = st.examples(), runs = st.runs(), evals = st.evals();
      var active = st.activeModel();
      var best = evals.reduce(function (b, e) { return Math.max(b, e.score); }, -1);
      var finishedRuns = runs.filter(function (r) { return r.status === 'fertig'; });

      // Kopf
      var hero = U.el('section', { class: 'hero', 'aria-labelledby': 'hero-title' });
      var topo = U.el('canvas', { class: 'topo', 'aria-hidden': 'true' });
      hero.appendChild(topo);
      var text = U.el('div', { class: 'hero-text' }, [
        U.el('span', { class: 'eyebrow' }, 'KI-Werkstatt für Krisenvorsorge'),
        U.el('h1', { id: 'hero-title', html: 'Deine KI.<br><span class="accent">Profi</span> für den Ernstfall.' }),
        U.el('p', { class: 'lede' }, 'Erstelle eigene KI-Modelle, die sich nur mit Blackout, Survival und Apokalypse auskennen. Trainiere sie direkt hier im Browser, mit Ollama auf deinem PC, kostenlos in Google Colab oder bei OpenAI, und prüfe mit ' + SK.BENCHMARK.length + ' Testfragen, ob sie wirklich Profi sind.'),
        U.el('div', { class: 'actions' }, [
          A.btn('Neue KI erstellen', 'plus', function () { A.go('modelle'); setTimeout(function () { SK.views.modelle.wizard(); }, 50); }, 'btn-primary btn-lg'),
          A.btn('Mit einer KI chatten', 'chat', function () { A.go('chat'); }, 'btn-lg'),
        ]),
      ]);
      hero.appendChild(text);

      // Aktives Modell
      if (active) {
        var stt = st.modelStatus(active);
        var card = U.el('div', { class: 'card model-card' }, [
          U.el('div', { class: 'row-between' }, [U.el('span', { class: 'label' }, 'Aktives Modell'), A.statusPill(active)]),
          U.el('div', { class: 'model-top' }, [A.modelBadge(active), U.el('div', { class: 'stack-sm' }, [
            U.el('div', { class: 'model-name' }, active.name),
            U.el('div', { class: 'model-meta' }, SK.ai.providerLabel(active).toUpperCase() + (active.baseModel ? ' · ' + active.baseModel : '') + ' · ' + SK.engine.modelCategories(active).length + ' THEMEN'),
          ])]),
          U.el('div', { class: 'mode-strip' }, (active.modes || []).map(A.modeChip)),
          U.el('dl', { class: 'facts' }, [
            U.el('dt', null, 'Prüfung'), U.el('dd', null, [A.gradeEl(stt.score)]),
            U.el('dt', null, 'Training'), U.el('dd', null, active.trained ? U.fmtDate(active.trained.at) : 'noch nicht'),
          ]),
          U.el('div', { class: 'actions' }, [
            A.btn('Chatten', 'chat', function () { A.go('chat'); }, 'btn-sm'),
            A.btn('Trainieren', 'train', function () { A.go('training'); }, 'btn-sm'),
            A.btn('Prüfen', 'clipboard', function () { A.go('pruefung'); }, 'btn-sm'),
          ]),
        ]);
        hero.appendChild(card);
      }
      el.appendChild(hero);
      requestAnimationFrame(function () { drawTopo(topo); });

      // Schritte
      var steps = U.el('section', { class: 'stack', 'aria-labelledby': 'steps-title' }, [
        U.el('h2', { class: 'section-title', id: 'steps-title' }, 'In vier Schritten zum Profi'),
        U.el('ol', { class: 'steps' }, [
          step(1, 'Modell erstellen', 'Wähle Spezialgebiet, Gehirn und Persönlichkeit. Vier fertige Modelle sind schon da.', models.some(function (m) { return !m.preset; }),
            A.btn('Modell erstellen', 'plus', function () { A.go('modelle'); setTimeout(function () { SK.views.modelle.wizard(); }, 50); }, 'btn-sm')),
          step(2, 'Daten prüfen', ex.length + ' Profi-Antworten sind eingebaut. Ergänze eigenes Wissen oder lass eine KI neue Beispiele schreiben.', st.datasetInfo().added > 0,
            A.btn('Trainingsdaten', 'database', function () { A.go('daten'); }, 'btn-sm')),
          step(3, 'Trainieren', 'Im Browser in Sekunden, als Ollama-Modell in einer Minute oder als echtes Fine-Tuning auf einer Grafikkarte.', finishedRuns.length > 0,
            A.btn('Training', 'train', function () { A.go('training'); }, 'btn-sm')),
          step(4, 'Prüfung bestehen', 'Ab 75 % ist deine KI ein Profi, ab 90 % Überlebens-Meister. Gefährliche Fehler zählen doppelt.', best >= 0.75,
            A.btn('Prüfung', 'clipboard', function () { A.go('pruefung'); }, 'btn-sm')),
        ]),
      ]);
      el.appendChild(steps);

      // Modi
      var modes = U.el('section', { class: 'stack', 'aria-labelledby': 'modes-title' }, [U.el('h2', { class: 'section-title', id: 'modes-title' }, 'Die drei Modi')]);
      var grid = U.el('div', { class: 'grid-3' });
      SK.MODES.forEach(function (m) {
        var cats = SK.CATEGORIES.filter(function (c) { return c.modes.indexOf(m.id) >= 0; });
        var n = ex.filter(function (e) { return cats.some(function (c) { return c.id === e.c; }); }).length;
        var qn = SK.BENCHMARK.filter(function (b) { return b.mode === m.id; }).length;
        grid.appendChild(U.el('article', { class: 'card mode-card' }, [
          U.el('span', { class: 'mode-icon mode-' + m.id + '-bg', html: I.get(I.mode(m.id)) }),
          U.el('h3', null, m.name),
          U.el('p', { class: 'muted' }, m.text),
          U.el('dl', { class: 'facts' }, [
            U.el('dt', null, 'Themen'), U.el('dd', null, String(cats.length)),
            U.el('dt', null, 'Trainingsbeispiele'), U.el('dd', null, U.fmtNum(n)),
            U.el('dt', null, 'Prüfungsfragen'), U.el('dd', null, String(qn)),
          ]),
          U.el('div', { class: 'actions' }, [A.btn('In diesem Modus fragen', 'chat', function () { SK.views.chat.setMode(m.id); A.go('chat'); }, 'btn-sm')]),
        ]));
      });
      modes.appendChild(grid);
      el.appendChild(modes);

      // Zahlen
      el.appendChild(U.el('section', { class: 'stats', 'aria-label': 'Überblick' }, [
        stat('Trainingsbeispiele', U.fmtNum(ex.length), st.datasetInfo().added ? st.datasetInfo().added + ' eigene' : 'alle eingebaut'),
        stat('Modelle', String(models.length), models.filter(function (m) { return m.provider !== 'offline'; }).length + ' mit Sprachmodell'),
        stat('Trainingsläufe', String(runs.length), finishedRuns.length + ' erfolgreich'),
        stat('Beste Prüfung', best >= 0 ? U.fmtPct(best) : '–', best >= 0 ? SK.engine.grade(best).name : 'noch keine'),
      ]));

      // Offline-Hinweis
      var off = U.el('div', null, [
        U.el('span', null, 'Einmal geöffnet, funktionieren die Seite und die Offline-KI auch ohne Internet und Strom im Haus, solange dein Handy oder Laptop Akku hat. '),
        U.el('span', null, 'Füge die Seite zum Startbildschirm hinzu, dann ist sie im Notfall sofort da.'),
      ]);
      var offCard = A.callout('', 'offline', 'Funktioniert auch im Blackout', off);
      if (A.installPrompt) {
        offCard.querySelector('div').appendChild(U.el('div', { class: 'actions' }, [A.btn('Als App installieren', 'install', function () {
          A.installPrompt.prompt();
          A.installPrompt.userChoice.then(function () { A.installPrompt = null; A.refresh(); });
        }, 'btn-sm')]));
      }
      el.appendChild(offCard);
      el.appendChild(U.el('p', { class: 'muted small' }, 'Wichtig: Eine KI ersetzt keine Rettungskräfte. Bei Lebensgefahr immer zuerst die 112 anrufen.'));
    },
  };

  function stat(label, value, sub) {
    return U.el('div', { class: 'stat' }, [U.el('span', { class: 'label' }, label), U.el('span', { class: 'stat-v' }, value), U.el('span', { class: 'stat-s' }, sub)]);
  }
})();
