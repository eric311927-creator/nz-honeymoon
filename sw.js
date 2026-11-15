/* 紐西蘭蜜月網站離線快取
   - 網頁本體：先連網路拿最新版，4 秒內連不上就用上次存的版本
   - 字體、圖片、地圖程式庫、Firebase SDK：存過就直接用
   - 筆記資料庫、地圖圖磚、米其林頁面不快取（沒網路時筆記無法讀寫）
   改網站內容不用動這個檔；只有要強制清掉舊快取時才改 VERSION */
var VERSION = 'nz-v1';
var SHELL = [
  'xmasv5.html',
  'fonts/ChenYuluoyan-hero.woff2',
  'img/hero-bg-opt.jpg',
  'icon-180.png', 'icon-192.png', 'icon-512.png'
];
var STATIC_HOSTS = ['cdnjs.cloudflare.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function put(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(req, copy); });
  }
  return res;
}

function networkFirst(req, key) {
  return new Promise(function (resolve) {
    var settled = false;
    var fallback = function () {
      if (settled) return;
      caches.match(key, { ignoreSearch: true }).then(function (hit) {
        if (hit && !settled) { settled = true; resolve(hit); }
      });
    };
    var timer = setTimeout(fallback, 4000);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res.ok) put(key, res);
      if (!settled) { settled = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      caches.match(key, { ignoreSearch: true }).then(function (hit) {
        if (!settled) { settled = true; resolve(hit || Response.error()); }
      });
    });
  });
}

function cacheFirst(req) {
  return caches.match(req, { ignoreSearch: req.url.indexOf(self.location.origin) === 0 }).then(function (hit) {
    return hit || fetch(req).then(function (res) { return put(req, res); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var same = url.origin === self.location.origin;
  if (same && (req.mode === 'navigate' || /\.html$/.test(url.pathname))) {
    if (!/xmasv5\.html$/.test(url.pathname)) return;
    e.respondWith(networkFirst(req, 'xmasv5.html'));
    return;
  }
  if (same && /\.(woff2|jpg|png)$/.test(url.pathname)) { e.respondWith(cacheFirst(req)); return; }
  if (STATIC_HOSTS.indexOf(url.hostname) >= 0) { e.respondWith(cacheFirst(req)); return; }
});
