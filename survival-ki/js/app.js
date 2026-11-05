/* Survival-KI Studio – App-Rahmen: Navigation, Ansichten, gemeinsame Bausteine, Verbindungsstatus */
var SK = (globalThis.SK = globalThis.SK || {});
SK.views = SK.views || {};

SK.app = (function () {
  var U = SK.util, I = SK.icons;
  var A = {};
  var NAV = [
    { id: 'start', label: 'Start', icon: 'home' },
    { id: 'modelle', label: 'Meine Modelle', icon: 'cpu', count: function () { return SK.store.models().length; } },
    { id: 'daten', label: 'Trainingsdaten', icon: 'database', count: function () { return SK.store.examples().length; } },
    { id: 'training', label: 'Training', icon: 'train' },
    { id: 'chat', label: 'Testen & Chat', icon: 'chat' },
    { id: 'pruefung', label: 'Prüfung', icon: 'clipboard' },
    { group: 'Mehr' },
    { id: 'einstellungen', label: 'Einstellungen', icon: 'settings' },
    { id: 'hilfe', label: 'Hilfe & Anleitung', icon: 'help' },
  ];
  var current = null, rendered = {};
  A.status = { ollama: null, ollamaModels: [], trainer: null, trainerInfo: null, sw: false, online: navigator.onLine };

  /* ---------- Start ---------- */
  A.start = function () {
    SK.store.load();
    applyTheme();
    U.$('#menu-open').innerHTML = I.get('menu');
    U.$('#top-chat').innerHTML = I.get('chat');
    renderNav();
    renderSideStatus();
    U.$('#menu-open').addEventListener('click', function () { toggleMenu(true); });
    window.addEventListener('hashchange', route);
    window.addEventListener('online', function () { A.status.online = true; renderSideStatus(); });
    window.addEventListener('offline', function () { A.status.online = false; renderSideStatus(); });
    SK.store.on('models', function () { renderNav(); refreshIf(['start', 'modelle']); });
    SK.store.on('dataset', function () { renderNav(); refreshIf(['start']); });
    SK.store.on('evals', function () { refreshIf(['start', 'modelle']); });
    SK.store.on('runs', function () { refreshIf(['start']); });
    SK.store.on('settings', function () { applyTheme(); });
    SK.store.on('storage-full', function () { U.toast('Der Speicher im Browser ist voll. Lösche alte Chats oder Trainingsläufe in den Einstellungen.', 'error'); });
    route();
    registerSW();
    checkConnections();
    setInterval(function () { if (!document.hidden) checkConnections(); }, 30000);
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); A.installPrompt = e; refreshIf(['start', 'einstellungen']); });
  };

  function applyTheme() {
    var t = SK.store.settings().theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  function renderNav() {
    var host = U.$('#nav-links');
    host.innerHTML = '';
    NAV.forEach(function (n) {
      if (n.group) { host.appendChild(U.el('div', { class: 'nav-label' }, n.group)); return; }
      var a = U.el('a', { href: '#' + n.id, 'aria-current': current === n.id ? 'page' : null, html: I.get(n.icon) });
      a.appendChild(U.el('span', null, n.label));
      if (n.count) a.appendChild(U.el('span', { class: 'count' }, U.fmtNum(n.count())));
      a.addEventListener('click', function () { toggleMenu(false); });
      host.appendChild(a);
    });
  }

  function toggleMenu(open) {
    var nav = U.$('#nav');
    var scrim = U.$('.scrim');
    if (open) {
      nav.classList.add('open');
      U.$('#menu-open').setAttribute('aria-expanded', 'true');
      if (!scrim) { scrim = U.el('div', { class: 'scrim' }); scrim.addEventListener('click', function () { toggleMenu(false); }); document.body.appendChild(scrim); }
      var first = nav.querySelector('a'); if (first) first.focus();
    } else {
      nav.classList.remove('open');
      U.$('#menu-open').setAttribute('aria-expanded', 'false');
      if (scrim) scrim.remove();
    }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && U.$('#nav').classList.contains('open')) toggleMenu(false); });

  function route() {
    var name = (location.hash || '#start').slice(1).split(/[?/]/)[0];
    if (!SK.views[name]) name = 'start';
    A.show(name);
  }

  A.show = function (name) {
    var prev = current;
    if (prev && SK.views[prev] && SK.views[prev].onHide) SK.views[prev].onHide();
    current = name;
    Object.keys(SK.views).forEach(function (v) { var el = U.$('#view-' + v); if (el) el.hidden = v !== name; });
    var view = SK.views[name], el = U.$('#view-' + name);
    if (!view.keep || !rendered[name]) { el.innerHTML = ''; view.render(el); rendered[name] = true; }
    if (view.onShow) view.onShow(el);
    document.title = (name === 'start' ? '' : view.title + ' · ') + 'Survival-KI Studio';
    renderNav();
    if (prev && prev !== name) { window.scrollTo(0, 0); U.$('#main').focus({ preventScroll: true }); }
  };

  A.go = function (name) {
    if (location.hash === '#' + name) A.show(name);
    else location.hash = name;
  };
  A.current = function () { return current; };

  function refreshIf(names) {
    if (names.indexOf(current) < 0) return;
    var view = SK.views[current];
    if (view.keep) { if (view.refresh) view.refresh(); return; }
    // nicht neu zeichnen, während jemand tippt
    var a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && U.$('#view-' + current).contains(a)) return;
    var el = U.$('#view-' + current);
    var y = window.scrollY;
    el.innerHTML = ''; view.render(el);
    window.scrollTo(0, y);
  }
  A.refresh = function () { refreshIf([current]); };

  /* ---------- Verbindungen ---------- */
  async function checkConnections() {
    var s = SK.store.settings();
    try {
      var models = await SK.ai.ollama.tags(s.ollamaUrl);
      A.status.ollama = true; A.status.ollamaModels = models;
    } catch (e) { A.status.ollama = false; A.status.ollamaModels = []; }
    try { A.status.trainerInfo = await SK.ai.trainer.info(s.trainerUrl); A.status.trainer = true; }
    catch (e) { A.status.trainer = false; A.status.trainerInfo = null; }
    renderSideStatus();
    if (A.onStatus) A.onStatus(A.status);
  }
  A.checkConnections = checkConnections;

  function renderSideStatus() {
    var host = U.$('#side-status');
    if (!host) return;
    var s = A.status, key = SK.store.settings().openaiKey;
    function line(on, text, title) {
      return U.el('div', { class: 'status-line', title: title || '' }, [U.el('span', { class: 'led ' + (on === true ? 'on' : on === false ? 'off' : '') }), U.el('span', null, text)]);
    }
    host.innerHTML = '';
    host.appendChild(line(true, 'Offline-KI bereit', 'Läuft immer, auch ohne Internet'));
    host.appendChild(line(s.ollama, s.ollama ? 'Ollama · ' + s.ollamaModels.length + ' Modelle' : 'Ollama nicht verbunden'));
    host.appendChild(line(s.trainer, s.trainer ? 'Lokaler Trainer verbunden' : 'Lokaler Trainer aus'));
    host.appendChild(line(!!key, key ? 'API-Schlüssel gesetzt' : 'Kein API-Schlüssel'));
    if (!s.online) host.appendChild(U.el('div', { class: 'status-line', html: I.get('offline') + '<span>Offline: Die Offline-KI funktioniert trotzdem.</span>' }));
  }

  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').then(function () { A.status.sw = true; }).catch(function () { A.status.sw = false; });
  }

  /* ---------- Gemeinsame Bausteine ---------- */
  A.modeName = function (id) { var m = SK.MODES.filter(function (x) { return x.id === id; })[0]; return m ? m.name : id; };
  A.catName = function (id) { var c = SK.CATEGORIES.filter(function (x) { return x.id === id; })[0]; return c ? c.name : id; };
  A.catMode = function (id) { var c = SK.CATEGORIES.filter(function (x) { return x.id === id; })[0]; return c ? c.modes[0] : ''; };

  A.modeChip = function (mode) { return U.el('span', { class: 'chip' }, [U.el('span', { class: 'dot ' + mode }), A.modeName(mode)]); };
  A.catChip = function (cat) { return U.el('span', { class: 'chip' }, [U.el('span', { class: 'dot ' + A.catMode(cat) }), A.catName(cat)]); };

  A.modelBadge = function (m) {
    var mode = (m.modes || [])[0] || 'blackout';
    var cls = m.modes && m.modes.length > 1 ? '' : ' mode-' + mode + '-bg';
    return U.el('span', { class: 'model-badge' + cls, html: I.get(m.icon || I.mode(mode)) });
  };

  A.statusPill = function (m) {
    var st = SK.store.modelStatus(m);
    if (m.provider !== 'offline') {
      var label = { ollama: 'Ollama', openai: 'Cloud-API', trainer: 'Lokaler Trainer' }[m.provider] || m.provider;
      return U.el('span', { class: 'pill pill-accent', html: I.get(m.provider === 'openai' ? 'cloud' : 'laptop') + label });
    }
    if (st.trained && st.stale) return U.el('span', { class: 'pill pill-warn', title: 'Die Trainingsdaten wurden geändert. Trainiere neu, damit die KI alles kennt.', html: I.get('refresh') + 'Neu trainieren' });
    if (st.trained) return U.el('span', { class: 'pill pill-ok', html: I.get('check') + 'Trainiert' });
    return U.el('span', { class: 'pill pill-neutral' }, 'Untrainiert');
  };

  A.gradeEl = function (score) {
    var g = SK.engine.grade(score);
    if (score === null || score === undefined) return U.el('span', { class: 'muted small' }, 'Noch keine Prüfung');
    return U.el('span', { class: 'grade' }, [U.el('b', null, U.fmtPct(score)), U.el('span', { class: 'muted small' }, g.name)]);
  };

  // Auswahlfeld für Modelle
  A.modelSelect = function (id, selected, onChange, filter) {
    var sel = U.el('select', { id: id });
    SK.store.models().filter(filter || function () { return true; }).forEach(function (m) {
      var o = U.el('option', { value: m.id }, m.name + ' · ' + SK.ai.providerLabel(m));
      if (m.id === selected) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { onChange(sel.value); });
    return sel;
  };

  A.field = function (label, control, hint) {
    var f = U.el('label', { class: 'field' }, [U.el('span', null, label), control]);
    if (hint) f.appendChild(U.el('span', { class: 'hint' }, hint));
    return f;
  };

  A.cmd = function (text) {
    var btn = U.el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Befehl kopieren', html: I.get('copy') });
    btn.addEventListener('click', function () { U.copy(text).then(function (ok) { U.toast(ok ? 'Kopiert' : 'Kopieren hat nicht geklappt, bitte markieren.', ok ? 'ok' : 'error'); }); });
    return U.el('div', { class: 'cmd' }, [U.el('code', null, text), btn]);
  };

  A.btn = function (label, icon, onClick, cls, attrs) {
    var b = U.el('button', Object.assign({ type: 'button', class: 'btn ' + (cls || '') }, attrs || {}), null);
    b.innerHTML = (icon ? I.get(icon) : '') + '<span>' + U.esc(label) + '</span>';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  };

  A.head = function (eyebrow, title, lede, actions) {
    var left = U.el('div', null, [U.el('span', { class: 'eyebrow' }, eyebrow), U.el('h1', { class: 'view-title' }, title)]);
    if (lede) left.appendChild(U.el('p', { class: 'lede' }, lede));
    var head = U.el('div', { class: 'view-head' }, [left]);
    if (actions && actions.length) head.appendChild(U.el('div', { class: 'actions' }, actions));
    return head;
  };

  A.callout = function (kind, icon, title, text) {
    var body = U.el('div', null, [title ? U.el('strong', null, title) : null]);
    if (typeof text === 'string') body.appendChild(U.el('span', null, text)); else if (text) body.appendChild(text);
    return U.el('div', { class: 'callout' + (kind ? ' callout-' + kind : ''), html: I.get(icon) }, [body]);
  };

  // Modell als „aktiv“ setzen und optional zu einer Ansicht springen
  A.useModel = function (id, view) {
    SK.store.setActiveModel(id);
    if (view) A.go(view);
  };

  return A;
})();
