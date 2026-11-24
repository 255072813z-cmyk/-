// 离线缓存：第一次打开后，没有网络也能打开网站、看礼拜时间（时间本来就在手机上计算）。
// 页面本身"先联网、失败再用缓存"，带哈希的静态文件"先用缓存"。天气等外站请求不缓存。
const CACHE = 'masjid-v2'; // 改了缓存规则就换个名字，旧缓存会被清掉
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './icon.svg', './manifest.webmanifest'])));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // 只有应用本身（/ 或 index.html）存成"首页"缓存；隐私政策等其他网页按自己的地址缓存，不能把首页顶掉
    const isApp = /\/(index\.html)?$/.test(url.pathname);
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(isApp ? './index.html' : req, copy));
          }
          return res;
        })
        .catch(() => (isApp ? caches.match('./index.html') : caches.match(req).then((hit) => hit || caches.match('./index.html')))),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
