/*
 * Survival-KI Studio – Diagramme (SVG)
 * Liniendiagramm mit Fadenkreuz-Tooltip, Legende und Endwert-Beschriftung; waagerechtes Balkendiagramm.
 * Farben kommen aus den CSS-Variablen, damit beide Farbschemata stimmen.
 */
var SK = (globalThis.SK = globalThis.SK || {});

SK.charts = (function () {
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  /*
   * opts: {series: [{name, color: 'var(--series-1)', points: [[x, y], …]}], yMin, yMax, yFormat(v), xLabel, height}
   */
  function line(host, opts) {
    host.innerHTML = '';
    host.classList.add('chart');
    var W = Math.max(280, host.clientWidth || 520), H = opts.height || 220;
    var m = { l: 46, r: 64, t: 14, b: 30 };
    var all = [];
    opts.series.forEach(function (se) { se.points.forEach(function (p) { all.push(p); }); });
    var xMax = Math.max(1, all.reduce(function (a, p) { return Math.max(a, p[0]); }, 1));
    var xMin = all.length ? all.reduce(function (a, p) { return Math.min(a, p[0]); }, Infinity) : 0;
    if (!isFinite(xMin) || xMin === xMax) xMin = Math.min(0, xMax - 1);
    var yMax = opts.yMax !== undefined ? opts.yMax : niceMax(all.reduce(function (a, p) { return Math.max(a, p[1]); }, 0) * 1.05);
    var yMin = opts.yMin !== undefined ? opts.yMin : 0;
    var fmt = opts.yFormat || function (v) { return String(Math.round(v * 100) / 100); };
    var X = function (x) { return m.l + (x - xMin) / (xMax - xMin || 1) * (W - m.l - m.r); };
    var Y = function (y) { return m.t + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - m.t - m.b); };

    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': opts.label || 'Diagramm' });
    host.appendChild(svg);
    // Gitter und Achsen
    for (var i = 0; i <= 4; i++) {
      var yv = yMin + (yMax - yMin) * i / 4, yy = Y(yv);
      s('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, class: i === 0 ? 'c-axis' : 'c-grid' }, svg);
      var t = s('text', { x: m.l - 8, y: yy + 4, 'text-anchor': 'end', class: 'c-tick' }, svg);
      t.textContent = fmt(yv);
    }
    var ticks = Math.min(6, Math.max(1, Math.round(xMax - xMin)));
    for (var j = 0; j <= ticks; j++) {
      var xv = Math.round(xMin + (xMax - xMin) * j / ticks), xx = X(xv);
      var tx = s('text', { x: xx, y: H - 10, 'text-anchor': 'middle', class: 'c-tick' }, svg);
      tx.textContent = String(xv);
    }
    if (opts.xLabel) { var xl = s('text', { x: W - m.r, y: H - 10, 'text-anchor': 'start', dx: 8, class: 'c-tick' }, svg); xl.textContent = opts.xLabel; }

    // Linien
    var ends = [];
    opts.series.forEach(function (se) {
      if (!se.points.length) return;
      var d = se.points.map(function (p, k) { return (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ');
      if (opts.area && opts.series.length === 1) {
        var last = se.points[se.points.length - 1], first = se.points[0];
        s('path', { d: d + ' L' + X(last[0]) + ' ' + Y(yMin) + ' L' + X(first[0]) + ' ' + Y(yMin) + ' Z', fill: se.color, 'fill-opacity': 0.1, stroke: 'none' }, svg);
      }
      s('path', { d: d, fill: 'none', stroke: se.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      var lp = se.points[se.points.length - 1];
      s('circle', { cx: X(lp[0]), cy: Y(lp[1]), r: 4, fill: se.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
      ends.push({ y: Y(lp[1]), text: fmt(lp[1]), se: se });
    });
    // Endwerte rechts, mit Abstand, falls zwei Linien nah beieinander enden
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var e = 1; e < ends.length; e++) if (ends[e].y - ends[e - 1].y < 14) ends[e].y = ends[e - 1].y + 14;
    ends.forEach(function (en) {
      var et = s('text', { x: W - m.r + 8, y: en.y + 4, class: 'c-end' }, svg);
      et.textContent = en.text;
    });

    // Fadenkreuz + Tooltip
    var cross = s('line', { y1: m.t, y2: H - m.b, class: 'c-cross', visibility: 'hidden' }, svg);
    var tip = document.createElement('div');
    tip.className = 'c-tip'; tip.hidden = true;
    host.appendChild(tip);
    var hit = s('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent', tabindex: 0 }, svg);
    function show(clientX) {
      var r = svg.getBoundingClientRect(), px = (clientX - r.left) * (W / r.width);
      var xv = xMin + (px - m.l) / (W - m.l - m.r) * (xMax - xMin);
      var best = null;
      opts.series.forEach(function (se) { se.points.forEach(function (p) { if (!best || Math.abs(p[0] - xv) < Math.abs(best - xv)) best = p[0]; }); });
      if (best === null) return;
      cross.setAttribute('x1', X(best)); cross.setAttribute('x2', X(best)); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = '';
      var head = document.createElement('div'); head.className = 'c-tip-h'; head.textContent = (opts.xName || 'x') + ' ' + best; tip.appendChild(head);
      opts.series.forEach(function (se) {
        var p = se.points.filter(function (q) { return q[0] === best; })[0];
        if (!p) return;
        var row = document.createElement('div'); row.className = 'c-tip-r';
        var key = document.createElement('span'); key.className = 'c-key'; key.style.background = se.color;
        var val = document.createElement('strong'); val.textContent = fmt(p[1]);
        var nm = document.createElement('span'); nm.textContent = se.name;
        row.appendChild(key); row.appendChild(val); row.appendChild(nm); tip.appendChild(row);
      });
      tip.hidden = false;
      var left = (X(best) / W) * r.width;
      tip.style.left = Math.min(r.width - 150, Math.max(0, left + 10)) + 'px';
    }
    hit.addEventListener('pointermove', function (ev) { show(ev.clientX); });
    hit.addEventListener('pointerleave', function () { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
    hit.addEventListener('focus', function () { var r = svg.getBoundingClientRect(); show(r.right - 1); });
    hit.addEventListener('blur', function () { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });

    // Legende
    if (opts.series.length > 1) {
      var lg = document.createElement('div'); lg.className = 'c-legend';
      opts.series.forEach(function (se) {
        var it = document.createElement('span'); it.className = 'c-leg';
        var k = document.createElement('span'); k.className = 'c-key'; k.style.background = se.color;
        it.appendChild(k); it.appendChild(document.createTextNode(se.name)); lg.appendChild(it);
      });
      host.insertBefore(lg, svg);
    }
  }

  /* items: [{label, value, sub}] – value 0..max */
  function bars(host, opts) {
    host.innerHTML = '';
    host.classList.add('chart');
    var items = opts.items || [];
    var max = opts.max || niceMax(items.reduce(function (a, i) { return Math.max(a, i.value); }, 0));
    var fmt = opts.format || function (v) { return String(v); };
    var list = document.createElement('div');
    list.className = 'hbars';
    items.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'hbar';
      row.tabIndex = 0;
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', it.label + ': ' + fmt(it.value));
      var lab = document.createElement('span'); lab.className = 'hbar-l'; lab.textContent = it.label;
      var track = document.createElement('span'); track.className = 'hbar-t';
      var fill = document.createElement('span'); fill.className = 'hbar-f';
      fill.style.width = Math.max(0, Math.min(100, it.value / max * 100)) + '%';
      if (it.color) fill.style.background = it.color;
      var val = document.createElement('span'); val.className = 'hbar-v'; val.textContent = fmt(it.value);
      track.appendChild(fill);
      row.appendChild(lab); row.appendChild(track); row.appendChild(val);
      if (it.sub) row.title = it.sub;
      list.appendChild(row);
    });
    host.appendChild(list);
  }

  // Neu zeichnen, wenn sich die Breite ändert
  function responsive(host, draw) {
    draw();
    if (typeof ResizeObserver === 'undefined') return;
    var w = host.clientWidth;
    var ro = new ResizeObserver(function () { if (Math.abs(host.clientWidth - w) > 8) { w = host.clientWidth; draw(); } });
    ro.observe(host);
    return ro;
  }

  return { line: line, bars: bars, responsive: responsive };
})();
