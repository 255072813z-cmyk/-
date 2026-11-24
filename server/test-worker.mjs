// 用 Miniflare（Cloudflare 官方本地运行时 workerd）测试 server/worker.js：房间、防火墙、签名配置、匿名统计、管理后台。
// 用法（Miniflare 较大，不放进项目依赖）：npm i --no-save miniflare@3.20250718.3 && npm run test:server
import { Miniflare } from 'miniflare';
import { generateKeys, signBody, verifyEnvelope, sanitizeConfig } from '../shared/remote-config.js';
import { CITY_DATA } from '../src/content/cities-data.js';

const repo = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SITE = 'https://example.org';
const TOKEN = 'test-admin-token-0123456789abcdef';
const keys = await generateKeys();
const other = await generateKeys();

const mf = new Miniflare({
  modules: true,
  scriptPath: repo + '/server/worker.js',
  modulesRoot: repo,
  modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
  compatibilityDate: '2025-06-01',
  durableObjects: { ROOMS: 'Room', HUB: 'Hub' },
  bindings: { ALLOWED_ORIGINS: SITE, ADMIN_TOKEN: TOKEN, CONFIG_PUBLIC_KEY: JSON.stringify(keys.publicJwk) },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (path, init = {}) => mf.dispatchFetch('http://localhost' + path, init);
const asIp = (ip, init = {}) => ({ ...init, headers: { 'cf-connecting-ip': ip, ...(init.headers || {}) } });
const adminH = (tok = TOKEN, ip = '10.0.0.1', extra = {}) => ({ authorization: 'Bearer ' + tok, 'cf-connecting-ip': ip, ...extra });

async function connect(room, origin = SITE) {
  const res = await get('/room/' + room, { headers: { Upgrade: 'websocket', Origin: origin } });
  const ws = res.webSocket;
  if (!ws) throw new Error('no websocket: ' + res.status);
  ws.accept();
  ws.send(JSON.stringify({ type: 'hello' }));
  const c = { ws, last: null, events: [], closed: null };
  ws.addEventListener('message', (e) => {
    if (e.data === 'pong') {
      c.pong = true;
      return;
    }
    c.last = JSON.parse(e.data);
    if (c.last.event) c.events.push(c.last.event);
  });
  ws.addEventListener('close', (e) => (c.closed = e.code));
  return c;
}
const out = [];
const ok = (name, cond, detail = '') => {
  out.push(`${cond ? '通过' : '失败'}  ${name} ${detail}`);
  if (!cond) process.exitCode = 1;
};

// ---- 房间 ----
ok('未知房间 404', (await get('/room/nope', { headers: { Upgrade: 'websocket', Origin: SITE } })).status === 404);
ok('非 WebSocket 请求 426', (await get('/room/hall', { headers: { Origin: SITE } })).status === 426);
ok('别的网站不能进房间 403', (await get('/room/hall', { headers: { Upgrade: 'websocket', Origin: 'https://evil.example' } })).status === 403);
const conns = [];
for (let i = 0; i < 42; i++) conns.push(await connect('hall', i % 2 ? SITE : 'capacitor://localhost'));
await sleep(300);
ok('42 人在线（网站和手机应用都能进）', conns[41].last && conns[41].last.online === 42, JSON.stringify(conns[41].last && conns[41].last.online));
for (let i = 0; i < 40; i++) conns[i].ws.send(JSON.stringify({ type: 'sit', mat: i }));
await sleep(400);
ok('40 张垫子坐满', conns[41].last.taken.length === 40);
conns[40].ws.send(JSON.stringify({ type: 'sit', mat: 5 }));
await sleep(200);
ok('有人的垫子坐不了', conns[40].events.includes('error:taken'));
conns[40].ws.send(JSON.stringify({ type: 'queue' }));
await sleep(100);
conns[41].ws.send(JSON.stringify({ type: 'queue' }));
await sleep(300);
ok('排队位置 1、2', conns[40].last.you.queuePos === 1 && conns[41].last.you.queuePos === 2);
conns[7].ws.send(JSON.stringify({ type: 'stand' }));
await sleep(300);
ok('有人起身，垫子给排第一的人', conns[40].last.you.mat === 7 && conns[40].events.includes('assigned'));
conns[3].ws.close(1000, 'bye');
await sleep(500);
ok('有人断线，垫子给下一位', conns[41].last.you.mat === 3 && conns[41].last.online === 41);
conns[0].ws.send('ping');
await sleep(200);
ok('ping 自动回 pong', conns[0].pong === true);
const c2 = await connect('courtyard');
await sleep(200);
ok('庭院单独计数', c2.last && c2.last.online === 1 && c2.last.capacity === 0);
const counts = await (await get('/counts')).json();
ok('只读人数 /counts', counts.hall.online === 41 && counts.courtyard.online === 1 && counts.poetry.online === 0 && counts.hall.taken === 40, JSON.stringify(counts));
// 刷屏：10 秒内发 30 条，连接被断开、垫子让出来
const flood = await connect('poetry');
await sleep(100);
for (let i = 0; i < 30; i++) flood.ws.send(JSON.stringify({ type: 'hello' }));
await sleep(400);
ok('刷消息的连接被断开', flood.closed === 1008, String(flood.closed));

// ---- 安全响应头 ----
const r404 = await get('/nope');
ok('未知地址 404', r404.status === 404);
ok('响应带安全头', r404.headers.get('x-content-type-options') === 'nosniff' && r404.headers.get('x-frame-options') === 'DENY' && r404.headers.get('referrer-policy') === 'no-referrer');

// ---- 远程配置 ----
ok('还没发布配置时 /config 204', (await get('/config')).status === 204);
const raw = {
  v: 1,
  issued: '2026-11-24T10:00:00.000Z',
  notices: [{ id: 'n1', level: 'info', text: { zh: '主麻日清真寺开放', ru: 'В пятницу мечеть открыта', tg: 'Рӯзи ҷумъа масҷид кушода аст' } }],
  cityOffsets: { dushanbe: { fajr: 0, dhuhr: 10, asr: 0, maghrib: 2, isha: 0, src: { zh: '测试来源' } }, nowhere: { dhuhr: 5, src: { zh: 'x' } } },
  hijri: { TJ: { adjust: 1, src: { zh: '测试' } } },
  flags: { presence: false },
  minVersion: '1.0.0',
  store: { android: 'https://play.google.com/store/apps/details?id=x', ios: 'https://evil.example/app' },
};
const clean = sanitizeConfig(raw, CITY_DATA.map((c) => c.id));
const env1 = await signBody(JSON.stringify(clean), keys.privateJwk);
const put = (envl, h = adminH()) => get('/admin/api/config', { method: 'PUT', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify(envl) });
ok('清洗：不认识的城市、非商店链接被去掉', !clean.cityOffsets.nowhere && clean.cityOffsets.dushanbe.dhuhr === 10 && !clean.store.ios && clean.store.android);
ok('没有口令不能发布', (await put(env1, { 'cf-connecting-ip': '10.0.0.9' })).status === 401);
ok('别的私钥签的不能发布', (await put(await signBody(JSON.stringify(clean), other.privateJwk))).status === 400);
ok('签名后被改过的不能发布', (await put({ body: env1.body.replace('测试来源', '篡改'), sig: env1.sig })).status === 400);
const p1 = await put(env1);
ok('正确签名可以发布', p1.status === 200, String(p1.status));
const got = await get('/config');
const gotEnv = await got.json();
const verified = await verifyEnvelope(gotEnv, keys.publicJwk);
ok('手机取到的配置能验过签名', !!verified && verified.cityOffsets.dushanbe.dhuhr === 10);
ok('换一把公钥就验不过', (await verifyEnvelope(gotEnv, other.publicJwk)) === null);
const older = await signBody(JSON.stringify({ ...clean, issued: '2026-11-01T00:00:00.000Z' }), keys.privateJwk);
ok('旧配置不能覆盖新配置', (await put(older)).status === 409);
const newer = await signBody(JSON.stringify({ ...clean, issued: '2026-11-25T00:00:00.000Z', notices: [] }), keys.privateJwk);
ok('新配置可以覆盖', (await put(newer)).status === 200);
ok('发布后 /config 立即是新的', JSON.parse((await (await get('/config')).json()).body).notices.length === 0);
const hist = await (await get('/admin/api/history', { headers: adminH() })).json();
ok('保留发布历史', hist.length === 2 && hist[0].issued === '2026-11-25T00:00:00.000Z');
ok('超大请求被拒绝', (await put({ body: 'x'.repeat(80000), sig: env1.sig })).status === 400);

// ---- 匿名统计 ----
const hit = (body, origin = SITE, ip = '10.1.0.1') =>
  get('/hit', asIp(ip, { method: 'POST', headers: { 'content-type': 'text/plain', Origin: origin }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() + 5 * 3600e3 - 864e5).toISOString().slice(0, 10);
ok('合法上报 204', (await hit({ v: '1.0.0', p: 'android', l: 'tg', c: 'moscow', f: ['qibla', 'tasbih', 'evil'], fd: yesterday })).status === 204);
ok('手机应用来源也接受', (await hit({ v: '1.0.0', p: 'ios', l: 'ru', c: 'dushanbe' }, 'capacitor://localhost')).status === 204);
ok('别的网站来源 403', (await hit({ v: '1.0.0' }, 'https://evil.example')).status === 403);
ok('乱码 400', (await hit('not json')).status === 400);
ok('超过 1KB 400', (await hit({ v: '1.0.0', pad: 'x'.repeat(2000) })).status === 400);
const err = await get('/err', asIp('10.1.0.2', { method: 'POST', headers: { Origin: SITE }, body: JSON.stringify({ v: '1.0.0', p: 'web', m: 'TypeError: x is undefined\u0000', s: 'home.js:12' }) }));
ok('错误报告 204', err.status === 204);
const stats = await (await get('/admin/api/stats?days=7', { headers: adminH() })).json();
const d0 = stats.days[today] || {};
const d1 = stats.days[yesterday] || {};
ok('今天 2 台设备', d0.n === 2, JSON.stringify(d0));
ok('平台、语言、城市分开计数', d0.p.android === 1 && d0.p.ios === 1 && d0.l.tg === 1 && d0.c.moscow === 1);
ok('功能记在前一天，不认识的功能丢掉', d1.fn === 1 && d1.f.qibla === 1 && d1.f.evil === undefined, JSON.stringify(d1));
ok('错误信息去掉控制字符', Object.keys(d0.e || {}).some((k) => k.endsWith('TypeError: x is undefined')));
ok('统计里没有 IP 等个人信息', !JSON.stringify(stats).includes('10.1.0'));
ok('统计附带此刻在线人数', stats.rooms && stats.rooms.hall.online === 41);
let blocked = 0;
for (let i = 0; i < 310; i++) if ((await hit({ v: '1.0.0' }, SITE, '10.9.9.9')).status === 429) blocked++;
ok('同一 IP 每分钟超过 300 次被限流', blocked >= 10, `${blocked} 次被拦`);

// ---- 管理后台 ----
const page = await get('/admin/');
ok('后台页面有严格的内容安全策略', page.status === 200 && /script-src 'self'/.test(page.headers.get('content-security-policy') || ''));
ok('/admin 跳到 /admin/', (await get('/admin', { redirect: 'manual' })).status === 301);
ok('后台脚本能取到', (await get('/admin/app.js')).status === 200 && (await get('/admin/remote-config.js')).status === 200);
let lockStatus = 0;
for (let i = 0; i < 6; i++) lockStatus = (await get('/admin/api/stats', { headers: adminH('wrong-token-wrong-token-wrong', '10.2.0.1') })).status;
ok('连续输错口令被锁', lockStatus === 429, String(lockStatus));
ok('锁住后口令对了也进不去', (await get('/admin/api/stats', { headers: adminH(TOKEN, '10.2.0.1') })).status === 429);
ok('别的来源不受影响', (await get('/admin/api/stats', { headers: adminH(TOKEN, '10.3.0.1') })).status === 200);

console.log(out.join('\n'));
console.log(process.exitCode ? '有失败项' : `全部 ${out.length} 项通过`);
await mf.dispose();
