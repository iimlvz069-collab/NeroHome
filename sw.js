/* قسمة: the app shell opens without a connection; the page itself is always fetched fresh when online. */
var V = 'qisma-v6';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
var STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(V).then(function (c) {
      return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf('qisma-') === 0 && k !== V; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function keep(req, res) {
  if (res && (res.ok || res.type === 'opaque')) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(req, cp); }); }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // the page: network first, so a new version is never hidden behind an old copy
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) { return keep(req, res); }).catch(function () {
        return caches.match(req).then(function (m) { return m || caches.match('index.html') || caches.match('./'); });
      })
    );
    return;
  }
  // same-origin files (icons, manifest): cached copy first, refreshed in the background
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(function (m) {
        var net = fetch(req).then(function (res) { return keep(req, res); }).catch(function () { return m; });
        return m || net;
      })
    );
    return;
  }
  // fonts: cached after the first load
  if (STATIC_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(
      caches.match(req).then(function (m) { return m || fetch(req).then(function (res) { return keep(req, res); }); })
    );
  }
  // everything else (Firebase, Google APIs) goes straight to the network
});
