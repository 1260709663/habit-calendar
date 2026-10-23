/* 习惯打卡 · 训练日志 —— 离线缓存 Service Worker
 * 更新网页文件后，把下面的版本号 +1，用户下次联网打开就会换新缓存。
 */
const CACHE = 'habit-app-v1';
const ASSETS = [
  './index.html',
  './habit-calendar.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(event.request);
    const network = fetch(event.request).then((res) => {
      if (res && res.status === 200) cache.put(event.request, res.clone());
      return res;
    }).catch(async () => {
      if (hit) return hit;
      if (event.request.mode === 'navigate') {
        const page = await cache.match('./habit-calendar.html');
        if (page) return page;
      }
      return Response.error();
    });
    return hit || network;
  })());
});
