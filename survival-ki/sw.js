/* Survival-KI Studio – Service Worker: speichert die Seite, damit sie auch ohne Internet (Blackout!) läuft */
var CACHE = 'survival-ki-v1';
var FILES = [
  './', './index.html', './style.css', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './js/data.js', './js/util.js', './js/icons.js', './js/engine.js', './js/store.js', './js/providers.js', './js/export.js',
  './js/charts.js', './js/app.js', './js/views/start.js', './js/views/models.js', './js/views/data.js', './js/views/training.js',
  './js/views/chat.js', './js/views/eval.js', './js/views/settings.js', './js/views/help.js', './trainer/survival_trainer.py', './trainer/requirements.txt',
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !font) return; // Ollama, OpenAI usw. nie zwischenspeichern
  // Zuerst aus dem Speicher antworten, im Hintergrund aktualisieren
  e.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: sameOrigin }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
