// 离线缓存：第一次打开时就把整个应用（页面、脚本、样式、字体）预先存好，之后没有网络也能打开每一页、
// 看礼拜时间（时间本来就在手机上算）、自动定位（卫星定位不需要网络）。
// 古兰经各章经文比较大，不预先存，读到哪一章存哪一章（存在单独的缓存里，网站更新也不会丢）。
// 页面本身"先联网、失败再用缓存"；带哈希的静态文件"先用缓存"。天气等外站请求不缓存。
const BUILD = '__BUILD__'; // 构建时换成这一版的编号
const PRECACHE = []; /* __PRECACHE__ */ // 构建时换成这一版的文件清单
const APP = 'masjid-app-' + BUILD; // 应用文件：每一版一个，旧版的在新版装好后删掉
const DATA = 'masjid-data'; // 读过的古兰经章节等：一直保留

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(APP).then((c) =>
      // 一个一个存：某个文件这次没下载下来，不影响其他文件
      Promise.all(['./', './index.html', './icon.svg', './manifest.webmanifest', ...PRECACHE].map((u) => c.add(u).catch(() => {}))),
    ),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
const isData = (url) => /\/assets\/(ar|zh|tg|ru|uz|ky)-\d-[\w-]+\.js$/.test(url.pathname);
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
            caches.open(APP).then((c) => c.put(isApp ? './index.html' : req, copy));
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
            caches.open(isData(url) ? DATA : APP).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
