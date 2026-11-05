/* Survival-KI Studio – Hilfsfunktionen (DOM, Text, Speicher, Dateien) */
var SK = (globalThis.SK = globalThis.SK || {});

SK.util = (function () {
  var U = {};

  /* ---------- DOM ---------- */
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // el('div', {class: 'x', onclick: fn}, [children]) – Kinder als Text werden sicher eingefügt
  U.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }
    if (children !== undefined && children !== null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  };

  U.esc = function (s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---------- Sicheres Mini-Markdown ----------
     Erst wird alles maskiert, dann werden wenige Formate erlaubt:
     Überschriften, Listen, **fett**, *kursiv*, `code`, ```Blöcke```, Links (nur http/https). */
  function inline(s) {
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, t, u) {
      return '<a href="' + u.replace(/"/g, '%22') + '" target="_blank" rel="noopener noreferrer">' + t + '</a>';
    });
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + codes[+i] + '</code>'; });
    return s;
  }

  U.md = function (text) {
    var lines = U.esc(text || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [], list = null, para = [], code = null;
    function flushPara() { if (para.length) { out.push('<p>' + inline(para.join('<br>')) + '</p>'); para = []; } }
    function flushList() { if (list) { out.push('<' + list.tag + '>' + list.items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; } }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (code !== null) {
        if (/^\s*```/.test(line)) { out.push('<pre><code>' + code.join('\n') + '</code></pre>'); code = null; }
        else code.push(line);
        continue;
      }
      if (/^\s*```/.test(line)) { flushPara(); flushList(); code = []; continue; }
      var h = /^\s*(#{1,4})\s+(.*)$/.exec(line);
      var ul = /^\s*[-*•]\s+(.*)$/.exec(line);
      var ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
      if (h) { flushPara(); flushList(); var lvl = Math.min(4, h[1].length + 2); out.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>'); }
      else if (ul) { flushPara(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(ul[1]); }
      else if (ol) { flushPara(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(ol[2]); }
      else if (/^\s*(---|\*\*\*)\s*$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); }
      else if (!line.trim()) { flushPara(); flushList(); }
      else { flushList(); para.push(line); }
    }
    if (code !== null) out.push('<pre><code>' + code.join('\n') + '</code></pre>');
    flushPara(); flushList();
    return out.join('');
  };

  // Markdown grob in Klartext umwandeln (für Exporte und Vorlesen)
  U.plain = function (text) {
    return String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
  };

  /* ---------- Text & Zahlen ---------- */
  U.normalize = function (s) {
    return String(s || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[áàâ]/g, 'a').replace(/[éèê]/g, 'e').replace(/[íìî]/g, 'i').replace(/[óòô]/g, 'o').replace(/[úùû]/g, 'u')
      .replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  };

  U.uid = function (prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  U.estimateTokens = function (text) { return Math.ceil(String(text || '').length / 3.6); };

  U.fmtNum = function (n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '–';
    return Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits === undefined ? 0 : digits, minimumFractionDigits: digits || 0 });
  };
  U.fmtPct = function (x, digits) { return x === null || x === undefined || isNaN(x) ? '–' : U.fmtNum(x * 100, digits || 0) + ' %'; };
  U.fmtDate = function (ts) {
    if (!ts) return '–';
    var d = new Date(ts);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };
  U.fmtDuration = function (sec) {
    if (sec === null || sec === undefined || !isFinite(sec)) return '–';
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + ' s';
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return m + ' min' + (s ? ' ' + s + ' s' : '');
    var h = Math.floor(m / 60);
    return h + ' h ' + (m % 60) + ' min';
  };
  U.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  U.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  U.debounce = function (fn, ms) {
    var t; return function () { var a = arguments, me = this; clearTimeout(t); t = setTimeout(function () { fn.apply(me, a); }, ms); };
  };
  U.slug = function (s) {
    return U.normalize(s).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'modell';
  };

  // Wiederholbarer Zufall (für Trainings-Aufteilung)
  U.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- Speicher (immer mit try/catch) ---------- */
  U.storage = {
    get: function (key, fallback) {
      try { var v = globalThis.localStorage && localStorage.getItem(key); return v === null || v === undefined ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove: function (key) { try { localStorage.removeItem(key); } catch (e) { /* egal */ } },
    keys: function (prefix) {
      var out = [];
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (!prefix || k.indexOf(prefix) === 0) out.push(k); } } catch (e) { /* egal */ }
      return out;
    },
  };

  /* ---------- Binärdaten ---------- */
  U.bytesToB64 = function (bytes) {
    var s = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  };
  U.b64ToBytes = function (b64) {
    var s = atob(b64), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  };
  U.utf8 = function (str) { return new TextEncoder().encode(str); };

  var CRC_TABLE = null;
  U.crc32 = function (bytes) {
    if (!CRC_TABLE) {
      CRC_TABLE = new Uint32Array(256);
      for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };

  // ZIP-Datei ohne Kompression (Methode "stored"), files: [{name, data: string|Uint8Array}]
  U.zip = function (files) {
    var parts = [], central = [], offset = 0;
    var now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (Math.floor(now.getSeconds() / 2));
    var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    files.forEach(function (f) {
      var name = U.utf8(f.name);
      var data = typeof f.data === 'string' ? U.utf8(f.data) : f.data;
      var crc = U.crc32(data);
      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true); local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, data);
      var cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true); cen.setUint16(12, dosTime, true); cen.setUint16(14, dosDate, true);
      cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true); cen.setUint16(30, 0, true); cen.setUint16(32, 0, true);
      cen.setUint16(34, 0, true); cen.setUint16(36, 0, true); cen.setUint32(38, f.exec ? (0o100755 << 16) >>> 0 : (0o100644 << 16) >>> 0, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cenSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
    var all = parts.concat(central, [new Uint8Array(end.buffer)]);
    var total = all.reduce(function (s, p) { return s + p.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  };

  /* ---------- Dateien ---------- */
  U.download = function (filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };

  U.readFile = function (file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = function () { reject(new Error('Datei konnte nicht gelesen werden.')); };
      r.readAsText(file);
    });
  };

  U.copy = function (text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    } catch (e) { /* weiter unten */ }
    return Promise.resolve(fallbackCopy(text));
  };
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  }

  /* ---------- Meldungen & Dialoge ---------- */
  U.toast = function (msg, kind) {
    var host = document.getElementById('toasts');
    if (!host) return;
    var t = U.el('div', { class: 'toast' + (kind ? ' toast-' + kind : ''), role: kind === 'error' ? 'alert' : 'status' }, msg);
    host.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, kind === 'error' ? 6000 : 3200);
    setTimeout(function () { t.remove(); }, kind === 'error' ? 6600 : 3800);
  };

  // Bestätigung im eigenen Dialog (window.confirm wird nicht benutzt)
  U.confirm = function (opts) {
    return new Promise(function (resolve) {
      var dlg = U.el('dialog', { class: 'dialog', 'aria-labelledby': 'cf-title' });
      var okBtn = U.el('button', { type: 'button', class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') }, opts.ok || 'OK');
      var cancelBtn = U.el('button', { type: 'button', class: 'btn' }, opts.cancel || 'Abbrechen');
      dlg.appendChild(U.el('div', { class: 'dialog-body' }, [
        U.el('h2', { id: 'cf-title', class: 'dialog-title' }, opts.title || 'Bist du sicher?'),
        opts.text ? U.el('p', { class: 'muted' }, opts.text) : null,
        U.el('div', { class: 'dialog-actions' }, [cancelBtn, okBtn]),
      ]));
      function done(v) { try { dlg.close(); } catch (e) { /* egal */ } dlg.remove(); resolve(v); }
      okBtn.addEventListener('click', function () { done(true); });
      cancelBtn.addEventListener('click', function () { done(false); });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); done(false); });
      document.body.appendChild(dlg);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      okBtn.focus();
    });
  };

  // Allgemeiner Dialog mit eigenem Inhalt; gibt {dialog, close} zurück
  U.modal = function (title, content, opts) {
    opts = opts || {};
    var dlg = U.el('dialog', { class: 'dialog' + (opts.wide ? ' dialog-wide' : ''), 'aria-label': title });
    var closeBtn = U.el('button', { type: 'button', class: 'icon-btn dialog-x', 'aria-label': 'Schließen', html: SK.icons ? SK.icons.get('x') : '×' });
    var body = U.el('div', { class: 'dialog-body' }, [
      U.el('div', { class: 'dialog-head' }, [U.el('h2', { class: 'dialog-title' }, title), closeBtn]),
      content,
    ]);
    dlg.appendChild(body);
    function close() { try { dlg.close(); } catch (e) { /* egal */ } dlg.remove(); if (opts.onClose) opts.onClose(); }
    closeBtn.addEventListener('click', close);
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    return { dialog: dlg, body: body, close: close };
  };

  return U;
})();
