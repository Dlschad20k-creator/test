/* Survival-KI Studio – Hilfe & Anleitung */
(function () {
  var U = SK.util, I = SK.icons, A = SK.app;

  var FAQ = [
    ['Was bedeutet „eine KI trainieren“?',
      'Eine KI lernt aus Beispielen. Hier sind das Frage-Antwort-Paare zu Blackout, Survival und Apokalypse. Beim **Fine-Tuning** wird ein vorhandenes Sprachmodell (zum Beispiel Llama oder Qwen) mit diesen Beispielen weitertrainiert. Mit **LoRA** werden dabei nur kleine Zusatz-Gewichte gelernt, deshalb geht es auch auf einer kostenlosen Grafikkarte. Danach antwortet das Modell im Stil deiner Beispiele und kennt dein Fachwissen.'],
    ['Welche Trainings-Methode passt zu mir?',
      '- **Nur ausprobieren, sofort:** Im Browser trainieren (Offline-KI). Dauert Sekunden.\n- **Ein echtes Sprachmodell, schnell:** Ollama installieren und ein Sofortmodell erstellen. Dauert eine Minute.\n- **Das beste Ergebnis, kostenlos:** Google Colab mit dem fertigen Notebook. Echtes Fine-Tuning auf einer Grafikkarte.\n- **Eigene NVIDIA-Grafikkarte:** Lokaler Trainer mit Live-Anzeige hier auf der Seite.\n- **Ohne eigene Hardware, gegen Geld:** OpenAI-Fine-Tuning.'],
    ['Was ist Ollama und wie installiere ich es?',
      'Ollama ist ein kostenloses Programm, mit dem Sprachmodelle auf deinem eigenen Computer laufen, auch ganz ohne Internet.\n1. Auf **ollama.com** herunterladen und installieren (Windows, Mac, Linux).\n2. Ein Modell laden, zum Beispiel im Terminal: `ollama pull llama3.2:3b` (etwa 2 GB) oder `ollama pull qwen2.5:7b` (etwa 5 GB, besseres Deutsch).\n3. Hier unter **Meine Modelle → Vorhandenes Modell verbinden** übernehmen.\nFür 3B-Modelle reichen 8 GB Arbeitsspeicher, für 7B-Modelle eher 16 GB.'],
    ['Ollama wird nicht gefunden. Was tun?',
      'Prüfe zuerst, ob Ollama läuft (in der Taskleiste oder mit `ollama list` im Terminal). Wenn diese Seite **nicht** über localhost geöffnet ist (zum Beispiel über GitHub Pages), blockiert Ollama Anfragen fremder Webseiten. Erlaube die Seite mit der Umgebungsvariable `OLLAMA_ORIGINS` (die genauen Befehle stehen in den Einstellungen unter „Verbindung klappt nicht?“) und starte Ollama neu. Chrome fragt eventuell, ob die Seite auf Geräte im lokalen Netzwerk zugreifen darf. Erlaube das.'],
    ['Ich habe schon eigene Modelle. Wie nutze ich sie?',
      'Unter **Meine Modelle → Vorhandenes Modell verbinden** findest du alle Modelle aus Ollama oder von einem OpenAI-kompatiblen Server (OpenAI, LM Studio, OpenRouter, Groq, vLLM …). Jedes verbundene Modell bekommt automatisch den Survival-Systemprompt und zu jeder Frage passendes Wissen aus deinen Trainingsdaten. Du kannst es dann trainieren (Ollama-Sofortmodell, Colab, eigener PC) und in der Prüfung mit anderen vergleichen.'],
    ['Brauche ich eine Grafikkarte?',
      'Nein. Die Offline-KI, das Ollama-Sofortmodell und Google Colab gehen ohne eigene Grafikkarte. Nur für das Fine-Tuning auf dem eigenen PC ist eine NVIDIA-Grafikkarte sehr zu empfehlen (ab 6 GB für 3B-Modelle, ab 10 GB für 7B-Modelle mit QLoRA). Ohne Grafikkarte trainiert der lokale Trainer nur sehr kleine Modelle in vertretbarer Zeit.'],
    ['Was kostet das?',
      'Die Webseite, die Offline-KI, Ollama, Google Colab (kostenlose T4-GPU, mit Zeitlimit) und der lokale Trainer sind kostenlos. Nur OpenAI rechnet pro Trainings-Token ab. Die Schätzung im Training zeigt dir vorher, wie viele Token es ungefähr werden.'],
    ['Funktioniert die Seite bei einem Blackout?',
      'Ja, wenn du sie vorher einmal geöffnet hast. Die Seite speichert sich im Browser, und die Offline-KI braucht kein Internet. Füge die Seite am besten zum Startbildschirm hinzu. Ollama-Modelle laufen ebenfalls offline auf deinem Laptop, solange der Akku hält. Cloud-Modelle (OpenAI) brauchen Internet.'],
    ['Wie bewertet die Prüfung?',
      'Zu jeder Frage gibt es Kernpunkte, die eine gute Antwort nennen muss, zum Beispiel „Kohlenmonoxid“ und „nur im Freien“ beim Generator. Die Punkte sind der Anteil der genannten Kernpunkte. Sicherheitskritische Fragen zählen doppelt. Bei Fragen zu fremden Themen bekommt die KI nur Punkte, wenn sie ablehnt. Du kannst jede Bewertung von Hand auf „richtig“ oder „falsch“ setzen.'],
    ['Wie bekomme ich eine bessere Note?',
      '1. Mehr gute Trainingsbeispiele: eigene Erfahrungen, Checklisten, oder mit **Mit KI erweitern** neue schreiben lassen und prüfen.\n2. Bei Sprachmodellen „Wissen aus den Trainingsdaten mitgeben“ eingeschaltet lassen.\n3. Ein größeres Basismodell nehmen (7B statt 3B).\n4. Echtes Fine-Tuning in Colab mit 3 Epochen.\n5. Schlechte Antworten im Chat mit 👎 markieren und eine bessere als Trainingsbeispiel speichern.'],
    ['Sind meine Daten sicher?',
      'Alles bleibt in deinem Browser (localStorage). Diese Webseite hat keinen eigenen Server und sammelt nichts. Nur wenn du selbst eine Cloud-API nutzt, gehen deine Fragen an diesen Anbieter. Mit **Einstellungen → Sicherung herunterladen** sicherst du alles in einer Datei.'],
    ['Kann ich mich auf die Antworten verlassen?',
      'Die eingebauten Antworten folgen den Empfehlungen von BBK, Rotem Kreuz und Bundesamt für Strahlenschutz. Trotzdem gilt: Eine KI kann sich irren und ersetzt keine Rettungskräfte. Bei Lebensgefahr immer zuerst **112** anrufen und den Anweisungen der Behörden folgen. Ein echter Erste-Hilfe-Kurs ist durch nichts zu ersetzen.'],
  ];

  SK.views.hilfe = {
    title: 'Hilfe',
    render: function (el) {
      el.appendChild(A.head('Anleitung', 'Hilfe & Anleitung', 'Hier steht, wie alles funktioniert, von der ersten KI bis zum echten Fine-Tuning.', []));

      // Vergleich der Methoden
      var rows = [
        ['Im Browser', 'Sekunden', 'nichts', 'Offline-KI erkennt Themen und fremde Fragen'],
        ['Ollama-Sofortmodell', '1 Minute', 'Ollama', 'Sprachmodell mit Profi-Rolle und Beispielen'],
        ['Google Colab', '10–40 min', 'Google-Konto', 'echtes LoRA-Fine-Tuning, GGUF für Ollama'],
        ['Eigener PC', 'je nach GPU', 'Python, NVIDIA-GPU', 'echtes LoRA-Fine-Tuning, live verfolgbar'],
        ['OpenAI', '10–60 min', 'API-Schlüssel, Guthaben', 'Fine-Tuning in der Cloud'],
      ];
      var t = U.el('table', null, [U.el('thead', null, U.el('tr', null, ['Methode', 'Dauer', 'Brauchst du', 'Ergebnis'].map(function (h) { return U.el('th', null, h); })))]);
      var tb = U.el('tbody');
      rows.forEach(function (r) { tb.appendChild(U.el('tr', null, r.map(function (c, i) { return U.el('td', null, i === 0 ? U.el('b', null, c) : c); }))); });
      t.appendChild(tb);
      el.appendChild(U.el('section', { class: 'stack-sm' }, [U.el('h2', { class: 'section-title' }, 'Die Trainings-Methoden im Vergleich'), U.el('div', { class: 'table-wrap' }, [t])]));

      // FAQ
      var faq = U.el('section', { class: 'card', 'aria-labelledby': 'faq-title' }, [U.el('h2', { class: 'section-title', id: 'faq-title' }, 'Häufige Fragen')]);
      FAQ.forEach(function (f, i) {
        var d = U.el('details', { class: 'faq' }, [U.el('summary', { html: '<span>' + U.esc(f[0]) + '</span>' + I.get('chevron') }), U.el('div', { class: 'md', html: U.md(f[1]) })]);
        if (i === 0) d.open = true;
        faq.appendChild(d);
      });
      el.appendChild(faq);

      // Quellen
      el.appendChild(U.el('section', { class: 'card stack-sm' }, [
        U.el('h2', { class: 'card-title' }, 'Quellen & weiterführende Seiten'),
        U.el('ul', { class: 'md', style: 'margin:0' }, (SK.SOURCES || []).map(function (s) { return U.el('li', null, [U.el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name)]); })),
      ]));
      el.appendChild(A.callout('warn', 'alert', 'Im Notfall', 'Eine KI ersetzt keine Rettungskräfte. Bei Lebensgefahr sofort 112 anrufen (Polizei 110). Folge den Anweisungen von Behörden, Feuerwehr und Rettungsdienst.'));
    },
  };
})();
