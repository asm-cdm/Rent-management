/* ASM Common Service Worker - same file for ALL apps, no editing needed.
   Cache name is taken automatically from the app's own folder. */
const VERSION = 'v1';   // change v1 -> v2 only when you want to force a refresh
const FOLDER = new URL(self.registration.scope).pathname.split('/').filter(Boolean).pop() || 'root';
const PREFIX = 'asm-' + FOLDER + '-';
const CACHE = PREFIX + VERSION;

const CORE = ['./', './manifest.json', './favicon-192.png', './favicon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Never touch Google login / Drive calls
  if (url.hostname.indexOf('google') !== -1 || url.hostname.indexOf('gstatic') !== -1) return;

  // Pages: network first (updates arrive), cache as offline fallback
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return r;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (m) { return m || caches.match('./'); });
      })
    );
    return;
  }

  // Everything else (icons, PDF libraries): cache first, saved on first use
  e.respondWith(
    caches.match(req).then(function (m) {
      return m || fetch(req).then(function (r) {
        if (r && (r.ok || r.type === 'opaque')) {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return r;
      });
    })
  );
});
