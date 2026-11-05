/* Survival-KI Studio – Einstellungen */
(function () {
  var U = SK.util, I = SK.icons, A = SK.app;

  function testRow(btnLabel, fn) {
    var out = U.el('span', { class: 'small', 'aria-live': 'polite' });
    var btn = A.btn(btnLabel, 'refresh', async function () {
      btn.disabled = true; out.textContent = 'Prüfe …'; out.className = 'small muted';
      try { out.textContent = await fn(); out.className = 'small res-hit'; }
      catch (e) { out.textContent = e.message; out.className = 'small res-miss'; }
      btn.disabled = false;
    }, 'btn-sm');
    return U.el('div', { class: 'row' }, [btn, out]);
  }

  SK.views.einstellungen = {
    title: 'Einstellungen',
    render: function (el) {
      var s = SK.store.settings();
      el.appendChild(A.head('System', 'Einstellungen', 'Verbindungen zu Sprachmodellen, Darstellung und deine Daten. Alles bleibt in diesem Browser gespeichert.', []));

      // Ollama
      var ollUrl = U.el('input', { type: 'url', id: 's-ollama', value: s.ollamaUrl });
      ollUrl.addEventListener('change', function () { SK.store.setSettings({ ollamaUrl: ollUrl.value.trim() || 'http://localhost:11434' }); });
      el.appendChild(U.el('section', { class: 'card stack' }, [
        U.el('div', { class: 'row-between' }, [U.el('h2', { class: 'card-title' }, 'Ollama (Modelle auf deinem PC)'), U.el('a', { href: 'https://ollama.com', target: '_blank', rel: 'noopener', class: 'small' }, 'ollama.com')]),
        A.field('Adresse', ollUrl, 'Standard: http://localhost:11434'),
        testRow('Verbindung testen', async function () {
          SK.store.setSettings({ ollamaUrl: ollUrl.value.trim() });
          var v = await SK.ai.ollama.version(ollUrl.value);
          var models = await SK.ai.ollama.tags(ollUrl.value);
          A.status.ollama = true; A.status.ollamaModels = models;
          return 'Verbunden: Ollama ' + v + ', ' + models.length + ' Modelle';
        }),
        U.el('details', null, [U.el('summary', { class: 'small', style: 'cursor:pointer' }, 'Verbindung klappt nicht?'), U.el('div', { class: 'stack-sm', style: 'margin-top:10px' }, [SK.ollamaHelp()])]),
      ]));

      // OpenAI-kompatibel
      var base = U.el('input', { type: 'url', id: 's-oa-base', value: s.openaiBase });
      var key = U.el('input', { type: 'password', id: 's-oa-key', value: s.openaiKey || '', autocomplete: 'off', placeholder: 'sk-…' });
      var remember = U.el('input', { type: 'checkbox', id: 's-remember' }); remember.checked = !!s.rememberKey;
      base.addEventListener('change', function () { SK.store.setSettings({ openaiBase: base.value.trim() || 'https://api.openai.com/v1' }); });
      key.addEventListener('change', function () { SK.store.setSettings({ openaiKey: key.value.trim() }); });
      remember.addEventListener('change', function () { SK.store.setSettings({ rememberKey: remember.checked }); SK.store.save(true); });
      el.appendChild(U.el('section', { class: 'card stack' }, [
        U.el('h2', { class: 'card-title' }, 'Cloud-API (OpenAI oder kompatibel)'),
        U.el('div', { class: 'form-grid' }, [A.field('Basis-URL', base, 'OpenAI: https://api.openai.com/v1 · LM Studio: http://localhost:1234/v1'), A.field('API-Schlüssel', key)]),
        U.el('label', { class: 'check' }, [remember, U.el('span', null, [U.el('b', null, 'Schlüssel auf diesem Gerät merken'), U.el('small', null, 'Sonst wird er beim Schließen des Tabs vergessen. Nutze das nur auf deinem eigenen Gerät.')])]),
        testRow('Verbindung testen', async function () {
          SK.store.setSettings({ openaiBase: base.value.trim(), openaiKey: key.value.trim() });
          var ms = await SK.ai.openai.models(base.value, key.value.trim());
          return 'Verbunden: ' + ms.length + ' Modelle verfügbar';
        }),
        A.callout('', 'alert', 'Sicherheit', 'Der Schlüssel wird nur von deinem Browser direkt an den Server geschickt, nie an diese Webseite. Teile Sicherungsdateien ruhig, der Schlüssel ist darin nicht enthalten.'),
      ]));

      // Trainer
      var tr = U.el('input', { type: 'url', id: 's-trainer', value: s.trainerUrl });
      tr.addEventListener('change', function () { SK.store.setSettings({ trainerUrl: tr.value.trim() || 'http://localhost:8765' }); });
      el.appendChild(U.el('section', { class: 'card stack' }, [
        U.el('h2', { class: 'card-title' }, 'Lokaler Trainer'),
        A.field('Adresse', tr, 'Standard: http://localhost:8765 (python survival_trainer.py serve)'),
        testRow('Verbindung testen', async function () {
          SK.store.setSettings({ trainerUrl: tr.value.trim() });
          var info = await SK.ai.trainer.info(tr.value);
          A.status.trainer = true; A.status.trainerInfo = info;
          return 'Verbunden: ' + (info.device === 'cuda' ? info.gpu + ' (' + info.vram_gb + ' GB)' : info.device === 'mps' ? info.gpu : 'nur Prozessor');
        }),
      ]));

      // Darstellung
      var theme = U.el('div', { class: 'row', role: 'radiogroup', 'aria-label': 'Farbschema' });
      [['system', 'Wie das Gerät'], ['light', 'Hell (Feldhandbuch)'], ['dark', 'Dunkel (Nachtmodus)']].forEach(function (t) {
        var b = U.el('button', { type: 'button', class: 'chip', role: 'radio', 'aria-pressed': String(s.theme === t[0]), 'aria-checked': String(s.theme === t[0]) }, t[1]);
        b.addEventListener('click', function () { SK.store.setSettings({ theme: t[0] }); U.$$('.chip', theme).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); x.setAttribute('aria-checked', String(x === b)); }); });
        theme.appendChild(b);
      });
      var offlineState = U.el('p', { class: 'small muted' }, location.protocol === 'file:' ? 'Als Datei geöffnet: Offline-Speicher ist nicht möglich. Öffne die Seite über GitHub Pages oder einen Webserver.' : ('serviceWorker' in navigator ? 'Die Seite wird für die Offline-Nutzung gespeichert.' : 'Dieser Browser unterstützt keinen Offline-Speicher.'));
      var install = A.installPrompt ? A.btn('Als App installieren', 'install', function () { A.installPrompt.prompt(); }, 'btn-sm') : null;
      el.appendChild(U.el('section', { class: 'card stack' }, [U.el('h2', { class: 'card-title' }, 'Darstellung & Offline'), theme, offlineState, install]));

      // Daten
      var fileIn = U.el('input', { type: 'file', accept: '.json,application/json', hidden: true, id: 's-backup-file' });
      fileIn.addEventListener('change', async function () {
        if (!fileIn.files[0]) return;
        try { SK.store.importAll(JSON.parse(await U.readFile(fileIn.files[0]))); U.toast('Sicherung geladen', 'ok'); A.go('start'); }
        catch (e) { U.toast(e.message || 'Datei konnte nicht gelesen werden.', 'error'); }
        fileIn.value = '';
      });
      var used = 0;
      U.storage.keys('ski.').forEach(function (k) { try { used += (localStorage.getItem(k) || '').length; } catch (e) { /* egal */ } });
      var info = SK.store.datasetInfo();
      el.appendChild(U.el('section', { class: 'card stack' }, [
        U.el('h2', { class: 'card-title' }, 'Deine Daten'),
        U.el('dl', { class: 'facts' }, [
          U.el('dt', null, 'Modelle'), U.el('dd', null, String(SK.store.models().length)),
          U.el('dt', null, 'Eigene Trainingsbeispiele'), U.el('dd', null, info.added + ' (' + info.edited + ' geändert, ' + info.removed + ' ausgeblendet)'),
          U.el('dt', null, 'Trainingsläufe / Prüfungen'), U.el('dd', null, SK.store.runs().length + ' / ' + SK.store.evals().length),
          U.el('dt', null, 'Belegter Speicher'), U.el('dd', null, '≈ ' + U.fmtNum(used / 1024, 0) + ' KB von etwa 5.000 KB'),
        ]),
        fileIn,
        U.el('div', { class: 'actions' }, [
          A.btn('Sicherung herunterladen', 'download', function () { U.download('survival-ki-sicherung-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(SK.store.exportAll()), 'application/json'); }, 'btn-primary'),
          A.btn('Sicherung laden', 'upload', function () { fileIn.click(); }),
          A.btn('Vorlagen-Modelle wiederherstellen', 'refresh', function () { SK.store.restorePresets(); U.toast('Vorlagen wiederhergestellt', 'ok'); }, 'btn-ghost'),
        ]),
        U.el('div', { class: 'actions' }, [
          A.btn('Trainingsdaten zurücksetzen', 'refresh', function () {
            U.confirm({ title: 'Trainingsdaten zurücksetzen?', text: 'Eigene Beispiele werden gelöscht und alle eingebauten wiederhergestellt.', ok: 'Zurücksetzen', danger: true }).then(function (ok) { if (ok) { SK.store.resetDataset(); U.toast('Zurückgesetzt'); A.refresh(); } });
          }, 'btn-danger'),
          A.btn('Alles löschen', 'trash', function () {
            U.confirm({ title: 'Wirklich alles löschen?', text: 'Modelle, eigene Trainingsdaten, Trainings, Prüfungen, Chats und Einstellungen werden gelöscht. Lade vorher eine Sicherung herunter, wenn du etwas behalten willst.', ok: 'Alles löschen', danger: true }).then(function (ok) { if (ok) { SK.store.resetAll(); U.toast('Alles gelöscht'); A.go('start'); } });
          }, 'btn-danger'),
        ]),
      ]));
    },
  };
})();
