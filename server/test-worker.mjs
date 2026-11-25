// 用 Miniflare（Cloudflare 官方本地运行时 workerd）测试 server/worker.js：房间、防火墙、签名配置、匿名统计、管理后台。
// 用法（Miniflare 较大，不放进项目依赖）：npm i --no-save miniflare@3.20250718.3 && npm run test:server
import { Miniflare } from 'miniflare';
import { generateKeys, signBody, verifyEnvelope, sanitizeConfig } from '../shared/remote-config.js';
import { CITY_DATA } from '../src/content/cities-data.js';
import { weekOf } from '../shared/stats.js';
import { totpAt } from './totp.js';

const repo = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SITE = 'https://example.org';
const TOKEN = 'test-admin-token-0123456789abcdef';
const TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const keys = await generateKeys();
const other = await generateKeys();

const mf = new Miniflare({
  modules: true,
  scriptPath: repo + '/server/worker.js',
  modulesRoot: repo,
  modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
  compatibilityDate: '2025-06-01',
  durableObjects: { ROOMS: 'Room', HUB: 'Hub', CIRCLE: 'Circle' },
  bindings: { ALLOWED_ORIGINS: SITE, ADMIN_TOKEN: TOKEN, ADMIN_TOTP: TOTP, CONFIG_PUBLIC_KEY: JSON.stringify(keys.publicJwk) },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (path, init = {}) => mf.dispatchFetch('http://localhost' + path, init);
const asIp = (ip, init = {}) => ({ ...init, headers: { 'cf-connecting-ip': ip, ...(init.headers || {}) } });
let SESSION = '';
const adminH = (tok = SESSION, ip = '10.0.0.1', extra = {}) => ({ authorization: 'Bearer ' + tok, 'cf-connecting-ip': ip, ...extra });
const login = (pass, code, ip = '10.0.0.1') => get('/admin/api/login', { method: 'POST', headers: { authorization: 'Bearer ' + pass, 'cf-connecting-ip': ip, 'content-type': 'application/json' }, body: JSON.stringify({ totp: code }) });

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

// ---- 管理后台登录：口令 + 两步验证 ----
const code = await totpAt(TOTP, Math.floor(Date.now() / 30000));
ok('只有口令、没有 6 位数字不能登录', (await login(TOKEN, '000000', '10.0.0.7')).status === 401);
ok('6 位数字对、口令不对也不能登录', (await login('wrong-token-wrong-token-wrong', code, '10.0.0.8')).status === 401);
const lr = await login(TOKEN, code);
SESSION = (await lr.json()).session || '';
ok('口令 + 6 位数字可以登录，拿到 8 小时会话', lr.status === 200 && /^\d{13}\./.test(SESSION));
ok('光有口令不能直接调用后台接口', (await get('/admin/api/stats', { headers: adminH(TOKEN, '10.0.0.9') })).status === 401);
ok('伪造的会话不行', (await get('/admin/api/stats', { headers: adminH(String(Date.now() + 3600e3) + '.' + 'A'.repeat(43), '10.0.0.10') })).status === 401);

// ---- 远程配置 ----
ok('还没发布配置时 /config 204', (await get('/config')).status === 204);
const raw = {
  v: 1,
  issued: new Date(Date.now() - 3600e3).toISOString(),
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
const older = await signBody(JSON.stringify({ ...clean, issued: new Date(Date.now() - 2 * 864e5).toISOString() }), keys.privateJwk);
ok('旧配置不能覆盖新配置', (await put(older)).status === 409);
const future = await signBody(JSON.stringify({ ...clean, issued: new Date(Date.now() + 2 * 864e5).toISOString() }), keys.privateJwk);
ok('发布时间在未来的配置被拒绝（防止以后发不出去）', (await put(future)).status === 400);
const newIssued = new Date().toISOString();
const newer = await signBody(JSON.stringify({ ...clean, issued: newIssued, notices: [] }), keys.privateJwk);
ok('新配置可以覆盖', (await put(newer)).status === 200);
ok('发布后 /config 立即是新的', JSON.parse((await (await get('/config')).json()).body).notices.length === 0);
const hist = await (await get('/admin/api/history', { headers: adminH() })).json();
ok('保留发布历史', hist.length === 2 && hist[0].issued === newIssued);
ok('超大请求被拒绝', (await put({ body: 'x'.repeat(80000), sig: env1.sig })).status === 400);

// ---- 匿名统计 ----
const hit = (body, origin = SITE, ip = '10.1.0.1') =>
  get('/hit', asIp(ip, { method: 'POST', headers: { 'content-type': 'text/plain', Origin: origin }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() + 5 * 3600e3 - 864e5).toISOString().slice(0, 10);
ok('合法上报 204', (await hit({ v: '1.0.0', p: 'android', l: 'tg', c: 'moscow', f: ['qibla', 'tasbih', 'quran', 'qada', 'share', 'evil'], fd: yesterday })).status === 204);
ok('手机应用来源也接受（吉尔吉斯语、比什凯克）', (await hit({ v: '1.0.0', p: 'ios', l: 'ky', c: 'bishkek' }, 'capacitor://localhost')).status === 204);
ok('别的网站来源 403', (await hit({ v: '1.0.0' }, 'https://evil.example')).status === 403);
ok('乱码 400', (await hit('not json')).status === 400);
ok('超过 1KB 400', (await hit({ v: '1.0.0', pad: 'x'.repeat(2000) })).status === 400);
const err = await get('/err', asIp('10.1.0.2', { method: 'POST', headers: { Origin: SITE }, body: JSON.stringify({ v: '1.0.0', p: 'web', m: 'TypeError: x is undefined\u0000', s: 'home.js:12' }) }));
ok('错误报告 204', err.status === 204);
const stats = await (await get('/admin/api/stats?days=7', { headers: adminH() })).json();
const d0 = stats.days[today] || {};
const d1 = stats.days[yesterday] || {};
ok('今天 2 台设备', d0.n === 2, JSON.stringify(d0));
ok('平台、语言、城市分开计数（新语言、新城市也认）', d0.p.android === 1 && d0.p.ios === 1 && d0.l.tg === 1 && d0.l.ky === 1 && d0.c.moscow === 1 && d0.c.bishkek === 1, JSON.stringify([d0.l, d0.c]));
ok('功能记在前一天（读古兰经、补礼、分享这些新功能也记），不认识的功能丢掉', d1.fn === 1 && d1.f.qibla === 1 && d1.f.quran === 1 && d1.f.qada === 1 && d1.f.share === 1 && d1.f.evil === undefined, JSON.stringify(d1));
ok('错误信息去掉控制字符', Object.keys(d0.e || {}).some((k) => k.endsWith('TypeError: x is undefined')));
ok('统计里没有 IP 等个人信息', !JSON.stringify(stats).includes('10.1.0'));
ok('统计附带此刻在线人数', stats.rooms && stats.rooms.hall.online === 41);
// 离线攒下、晚几天才到的记录：记到它自己那一天；留存分组、新增来源、提醒比例
const iw = weekOf(yesterday);
ok('离线攒下的昨天的记录也收', (await hit({ d: yesterday, v: '1.0.0', p: 'android', l: 'tg', c: 'dushanbe', iw, nw: 1, src: 'share', ntf: 1, fs: 2, ad: 1 }, SITE, '10.1.0.3')).status === 204);
const old40 = new Date(Date.now() + 5 * 3600e3 - 40 * 864e5).toISOString().slice(0, 10);
ok('40 天前的记录不收', (await hit({ d: old40, v: '1.0.0' }, SITE, '10.1.0.3')).status === 400);
const st2 = await (await get('/admin/api/stats?days=7', { headers: adminH() })).json();
const y2 = st2.days[yesterday] || {};
ok('昨天：新增、来源、留存分组、提醒、字号都记上', y2.n === 1 && y2.nw === 1 && y2.src.share === 1 && y2.coh[iw] === 1 && y2.ntf === 1 && y2.ntfn === 1 && y2.fs['2'] === 1, JSON.stringify(y2));
ok('今天的数不受影响', st2.days[today].n === 2);

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
ok('别的来源不受影响', (await get('/admin/api/stats', { headers: adminH(SESSION, '10.3.0.1') })).status === 200);

// ---- 亲友圈 ----
const rnd = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => x.toString(16).padStart(2, '0')).join('');
const userA = { uid: rnd(16), secret: rnd(32) };
const userB = { uid: rnd(16), secret: rnd(32) };
const circ = async (op, body, ip = '10.5.0.1') => {
  const r = await get('/circle/' + op, { method: 'POST', headers: { Origin: SITE, 'cf-connecting-ip': ip }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const made = await circ('create', { ...userA, nick: '阿卜杜拉' });
const ccode = made.body && made.body.code;
ok('建一个亲友圈，拿到 10 位邀请码', made.status === 200 && /^[A-Z2-9]{10}$/.test(ccode || ''), JSON.stringify(made.body));
ok('网址做昵称不行', (await circ('join', { ...userB, code: ccode, nick: 'www.spam.ru' })).status === 400);
const joined = await circ('join', { ...userB, code: ccode, nick: 'Фарход' });
ok('用邀请码加入', joined.status === 200 && joined.body.members.length === 2);
ok('邀请码错了加不进去', (await circ('join', { uid: rnd(16), secret: rnd(32), code: 'ABCDEFGHJK', nick: 'x' })).status === 404);
const tday = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
ok('打卡：记下今天和连续天数', (await circ('checkin', { ...userB, code: ccode, day: tday, streak: 12 })).status === 200);
ok('日期离谱的打卡被拒', (await circ('checkin', { ...userB, code: ccode, day: '2020-01-01', streak: 1 })).status === 400);
const stA = await circ('state', { ...userA, code: ccode });
const bView = stA.body.members.find((m) => !m.me);
ok('亲友看到"今天打卡了"和连续天数', bView && bView.day === tday && bView.streak === 12 && bView.nick === 'Фарход');
ok('看不到对方的编号和密钥', !JSON.stringify(stA.body).includes(userB.uid) && !JSON.stringify(stA.body).includes(userB.secret));
ok('别人的密钥冒充不了', (await circ('state', { uid: userB.uid, secret: rnd(32), code: ccode })).status === 401);
await circ('hide', { ...userB, code: ccode, hide: true });
ok('隐藏后亲友看不到连续天数', (await circ('state', { ...userA, code: ccode })).body.members.find((m) => !m.me).streak === null);
ok('发预设提醒', (await circ('nudge', { ...userA, code: ccode, to: bView.mid, kind: 'remind' })).status === 200);
ok('不能发自定义文字', (await circ('nudge', { ...userA, code: ccode, to: bView.mid, kind: '加我微信' })).status === 400);
await circ('nudge', { ...userA, code: ccode, to: bView.mid, kind: 'dua' });
await circ('nudge', { ...userA, code: ccode, to: bView.mid, kind: 'salam' });
ok('一天给同一个人最多 3 条', (await circ('nudge', { ...userA, code: ccode, to: bView.mid, kind: 'congrats' })).status === 429);
await circ('checkin', { ...userB, code: ccode, day: tday, streak: 12, hide: true });
const stB = await circ('state', { ...userB, code: ccode });
ok('收到提醒（中间的打卡请求不会把它读掉），看过就清空', stB.body.inbox.length === 3 && stB.body.inbox[0].nick === '阿卜杜拉' && (await circ('state', { ...userB, code: ccode })).body.inbox.length === 0);
ok('不是圈主不能锁圈', (await circ('lock', { ...userB, code: ccode, locked: true })).status === 403);
ok('圈主可以锁圈', (await circ('lock', { ...userA, code: ccode, locked: true })).status === 200);
ok('锁了之后新人加不进来', (await circ('join', { uid: rnd(16), secret: rnd(32), code: ccode, nick: 'Новый' })).status === 403);
await circ('lock', { ...userA, code: ccode, locked: false });
let full = 0;
for (let i = 0; i < 19; i++) if ((await circ('join', { uid: rnd(16), secret: rnd(32), code: ccode, nick: 'm' + i }, '10.6.0.' + i)).status === 403) full++;
ok('一个圈最多 20 人', full === 1, `满员被拒 ${full} 次`);
ok('圈主移出成员', (await circ('remove', { ...userA, code: ccode, to: bView.mid })).status === 200 && (await circ('state', { ...userB, code: ccode })).status === 401);
ok('退出亲友圈', (await circ('leave', { ...userA, code: ccode })).status === 200);
ok('别的网站来源不能用亲友圈', (await get('/circle/state', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: JSON.stringify({ ...userA, code: ccode }) })).status === 403);

console.log(out.join('\n'));
console.log(process.exitCode ? '有失败项' : `全部 ${out.length} 项通过`);
await mf.dispose();
