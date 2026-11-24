// 后台服务（Cloudflare Workers + Durable Objects，免费套餐可用）
//
// 对外接口（全部不需要、也不接受任何个人信息）：
//   GET  /counts              三个空间的在线人数（只读）
//   GET  /room/<房间>          进入房间（WebSocket）：大殿 hall / 庭院 courtyard / 诗歌夜 poetry
//   GET  /config              远程配置（管理员签过名的，手机上会再验一次签名）
//   POST /hit                 匿名使用统计：每台设备每天最多一次（见 shared/stats.js）
//   POST /err                 匿名错误报告：只有错误信息和出错位置
// 管理后台（需要管理口令）：
//   GET  /admin/              管理页面
//   GET  /admin/api/stats     统计数据
//   GET  /admin/api/history   最近发布过的配置
//   PUT  /admin/api/config    发布新配置（必须带有效签名）
//
// 防火墙（见 docs/后台与安全.md）：
//   - 每个 IP 按接口限流（Cloudflare 限流规则；本机测试时退回内存计数）。IP 只用于限流，不保存。
//   - 只接受本站网页和本应用发来的请求（ALLOWED_ORIGINS）；请求大小、字段、取值严格检查。
//   - 管理口令至少 24 位；同一来源连续输错 5 次锁 1 小时；全局 1 小时内输错 30 次全部锁住。
//   - 配置必须用管理员电脑上的私钥签名；服务端和手机各验一次；旧配置不能覆盖新配置。
//   - 所有响应带安全响应头；管理页面有严格的内容安全策略（只能加载自己的脚本）。
//
// 部署：cd server && npx wrangler deploy（步骤见 docs/后台与安全.md）
import { ROOMS, newSession, applyAction, removeSession, snapshotFor, parseMessage } from './room.js';
import { sanitizeConfig, verifyEnvelope } from '../shared/remote-config.js';
import { parseHit, parseErr, addHit, addErr, mergeDay, emptyDay } from '../shared/stats.js';
import { CITY_DATA } from '../src/content/cities-data.js';
import { ASSETS } from './admin-assets.js';
import { Circle, parseCircleReq, newCode, isCode } from './circle.js';
import { verifyTotp, makeSession, checkSession } from './totp.js';
export { Circle };

const CITY_IDS = CITY_DATA.map((c) => c.id);
// 手机应用（Capacitor）的页面来源；网站地址在 wrangler.toml 的 ALLOWED_ORIGINS 里填
const APP_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost'];

// 限流规则：每个 IP 每 60 秒最多多少次（与 wrangler.toml 里的 ratelimits 一致）。
// 塔吉克斯坦、俄罗斯的手机网络常常很多人共用一个 IP，所以公开接口给得宽一些。
const LIMITS = { RL_PUBLIC: 300, RL_ADMIN: 30 };
const RULES = { hit: 'RL_PUBLIC', err: 'RL_PUBLIC', config: 'RL_PUBLIC', counts: 'RL_PUBLIC', room: 'RL_PUBLIC', circle: 'RL_PUBLIC', admin: 'RL_ADMIN' };

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000',
  'permissions-policy': 'geolocation=(), camera=(), microphone=(), payment=()',
};
const ADMIN_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function respond(body, status = 200, extra = {}) {
  const headers = { ...SECURITY_HEADERS, ...extra };
  if (body != null && typeof body !== 'string') {
    body = JSON.stringify(body);
    headers['content-type'] = headers['content-type'] || 'application/json; charset=utf-8';
  }
  return new Response(body, { status, headers });
}

// ---- 限流 ----
const MEM = new Map(); // 本机测试用的内存计数（每个实例各算各的）
async function limited(env, kind, ip) {
  const binding = RULES[kind];
  const key = kind + ':' + ip;
  const rl = env[binding];
  if (rl && typeof rl.limit === 'function') {
    try {
      const { success } = await rl.limit({ key });
      return !success;
    } catch (e) {
      /* 限流服务出错时退回内存计数 */
    }
  }
  const now = Date.now();
  let e = MEM.get(key);
  if (!e || now - e.t > 60000) MEM.set(key, (e = { t: now, n: 0 }));
  e.n++;
  if (MEM.size > 10000) MEM.clear();
  return e.n > LIMITS[binding];
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}
/** 来源检查：没配置网站地址时（本机开发）不限制 */
function originOk(env, origin) {
  const list = allowedOrigins(env);
  if (!list.length) return true;
  return !!origin && (list.includes(origin) || APP_ORIGINS.includes(origin));
}
function cors(env, origin) {
  if (!origin) return {};
  return originOk(env, origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};
}

async function readLimited(request, max) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > max) return null;
  const buf = await request.arrayBuffer();
  if (buf.byteLength > max) return null;
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch (e) {
    return null;
  }
}

async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}
function sameBytes(a, b) {
  if (crypto.subtle.timingSafeEqual) return crypto.subtle.timingSafeEqual(a, b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a[i] ^ b[i];
  return d === 0;
}
const hex = (u8) => [...u8].map((x) => x.toString(16).padStart(2, '0')).join('');

/** 杜尚别日期（统计按这一天算） */
export function statDay(now = Date.now()) {
  return new Date(now + 5 * 3600e3).toISOString().slice(0, 10);
}

const hub = (env) => env.HUB.get(env.HUB.idFromName('hub'));
const hubCall = (env, path, body) =>
  hub(env).fetch('https://hub' + path, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });

async function roomCounts(env) {
  const out = {};
  for (const room of Object.keys(ROOMS)) {
    const r = await env.ROOMS.get(env.ROOMS.idFromName(room)).fetch('https://room/count/' + room);
    out[room] = await r.json();
  }
  return out;
}

async function admin(request, env, url, ip) {
  if (url.pathname === '/admin') return Response.redirect(url.origin + '/admin/', 301);
  const asset = ASSETS[url.pathname];
  if (asset && request.method === 'GET') return respond(asset.body, 200, { 'content-type': asset.type, 'content-security-policy': ADMIN_CSP, 'cache-control': 'no-store' });
  if (!url.pathname.startsWith('/admin/api/')) return respond('not found', 404);

  const want = env.ADMIN_TOKEN || '';
  // 两步验证是必须的：没有设置 ADMIN_TOTP 时后台不开放
  if (want.length < 24) return respond({ error: 'admin-not-configured' }, 503);
  if (!env.ADMIN_TOTP) return respond({ error: 'totp-not-configured' }, 503);
  const ipKey = hex(await sha256('masjid:' + ip)).slice(0, 16); // 只在内存里用来计数，不保存
  const lock = await (await hubCall(env, '/auth', { ip: ipKey })).json();
  if (lock.locked) return respond({ error: 'locked' }, 429, { 'retry-after': '3600' });
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const fail = async (error = 'unauthorized') => {
    await hubCall(env, '/auth', { ip: ipKey, fail: true });
    return respond({ error }, 401);
  };
  const serverKey = 'admin:' + want + ':' + env.ADMIN_TOTP; // 会话签名用；换口令或两步验证密钥后，旧会话全部失效

  // 登录：管理口令 + 手机验证器上的 6 位数字 → 8 小时的会话
  if (url.pathname === '/admin/api/login' && request.method === 'POST') {
    const body = await readLimited(request, 256);
    if (!sameBytes(await sha256(got), await sha256(want))) return fail();
    if (!(await verifyTotp(env.ADMIN_TOTP, body && body.totp))) return fail('bad-totp');
    return respond({ session: await makeSession(serverKey) }, 200, { 'cache-control': 'no-store' });
  }
  // 其余接口：只认登录后拿到的会话（光有口令不够）
  if (!(await checkSession(serverKey, got))) return fail();

  if (url.pathname === '/admin/api/stats' && request.method === 'GET') {
    const days = Math.min(400, Math.max(1, Number(url.searchParams.get('days')) || 30));
    const stats = await (await hubCall(env, '/stats', { days, today: statDay() })).json();
    return respond({ ...stats, rooms: await roomCounts(env), today: statDay() }, 200, { 'cache-control': 'no-store' });
  }
  if (url.pathname === '/admin/api/history' && request.method === 'GET') {
    return respond(await (await hubCall(env, '/history', {})).json(), 200, { 'cache-control': 'no-store' });
  }
  if (url.pathname === '/admin/api/config' && request.method === 'PUT') {
    let key = null;
    try {
      key = JSON.parse(env.CONFIG_PUBLIC_KEY || 'null');
    } catch (e) {
      key = null;
    }
    if (!key) return respond({ error: 'no-public-key' }, 503);
    const envelope = await readLimited(request, 70000);
    const raw = await verifyEnvelope(envelope, key);
    if (!raw) return respond({ error: 'bad-signature' }, 400);
    const cfg = sanitizeConfig(raw, CITY_IDS);
    if (!cfg) return respond({ error: 'bad-config' }, 400);
    // 发布时间不能在未来（否则以后的配置都发不出去）
    if (Date.parse(cfg.issued) > Date.now() + 10 * 60e3) return respond({ error: 'future' }, 400);
    const r = await hubCall(env, '/config', { envelope: { body: envelope.body, sig: envelope.sig }, issued: cfg.issued });
    if (r.status === 200) await caches.default.delete(new Request(url.origin + '/config')).catch(() => {});
    return respond(await r.json(), r.status);
  }
  return respond('not found', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const origin = request.headers.get('Origin');
    const path = url.pathname;

    if (path === '/admin' || path.startsWith('/admin/')) {
      if (await limited(env, 'admin', ip)) return respond({ error: 'too-many' }, 429, { 'retry-after': '60' });
      return admin(request, env, url, ip);
    }

    // 只读人数：GET /counts → {hall:{online,capacity,taken}, courtyard:{online}, poetry:{online}}（不进房间、不算人头）
    if (path === '/counts' && request.method === 'GET') {
      if (await limited(env, 'counts', ip)) return respond({ error: 'too-many' }, 429);
      return respond(await roomCounts(env), 200, { 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    }

    if (path === '/config' && request.method === 'GET') {
      if (await limited(env, 'config', ip)) return respond({ error: 'too-many' }, 429);
      const cacheKey = new Request(url.origin + '/config');
      const cached = await caches.default.match(cacheKey).catch(() => null);
      let body = cached ? await cached.text() : null;
      if (body == null) {
        const r = await hubCall(env, '/config');
        body = await r.text();
        await caches.default.put(cacheKey, new Response(body, { headers: { 'cache-control': 'public, max-age=300' } })).catch(() => {});
      }
      if (body === 'null') return respond(null, 204, { 'access-control-allow-origin': '*' });
      return respond(body, 200, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' });
    }

    if ((path === '/hit' || path === '/err') && request.method === 'POST') {
      const kind = path.slice(1);
      if (!originOk(env, origin)) return respond({ error: 'forbidden' }, 403);
      if (await limited(env, kind, ip)) return respond(null, 429, cors(env, origin));
      const raw = await readLimited(request, 1024);
      const today = statDay();
      const item = kind === 'hit' ? parseHit(raw, CITY_IDS, today) : parseErr(raw);
      if (!item) return respond(null, 400, cors(env, origin));
      await hubCall(env, '/' + kind, { today, item });
      return respond(null, 204, cors(env, origin));
    }

    // 亲友圈：POST /circle/<操作>
    const cm = path.match(/^\/circle\/(create|join|state|checkin|hide|rename|nudge|remove|lock|leave)$/);
    if (cm && request.method === 'POST') {
      if (!originOk(env, origin)) return respond({ error: 'forbidden' }, 403);
      if (await limited(env, 'circle', ip)) return respond({ error: 'too-many' }, 429, cors(env, origin));
      const today = statDay();
      const req = parseCircleReq(cm[1], await readLimited(request, 1024), today);
      if (!req) return respond({ error: 'bad' }, 400, cors(env, origin));
      // 新建：生成一个没被用过的邀请码
      if (req.op === 'create') {
        for (let i = 0; i < 5; i++) {
          req.code = newCode();
          const r = await env.CIRCLE.get(env.CIRCLE.idFromName(req.code)).fetch('https://circle/', { method: 'POST', body: JSON.stringify({ req, today }) });
          if (r.status !== 409) return respond(await r.text(), r.status, { 'content-type': 'application/json; charset=utf-8', ...cors(env, origin) });
        }
        return respond({ error: 'busy' }, 503, cors(env, origin));
      }
      if (!isCode(req.code)) return respond({ error: 'bad' }, 400, cors(env, origin));
      const r = await env.CIRCLE.get(env.CIRCLE.idFromName(req.code)).fetch('https://circle/', { method: 'POST', body: JSON.stringify({ req, today }) });
      return respond(await r.text(), r.status, { 'content-type': 'application/json; charset=utf-8', ...cors(env, origin) });
    }

    const m = path.match(/^\/room\/([a-z]+)$/);
    if (!m || !ROOMS[m[1]]) return respond('not found', 404);
    if (request.headers.get('Upgrade') !== 'websocket') return respond('expected websocket', 426);
    if (!originOk(env, origin)) return respond('forbidden', 403);
    if (await limited(env, 'room', ip)) return respond('too many', 429);
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(request);
  },
};

// 每个连接每 10 秒最多发 20 条消息，超过就断开（正常使用一分钟也就几条）
const MSG_LIMIT = { n: 20, ms: 10000 };

export class Room {
  constructor(state) {
    this.state = state;
    this.rate = new WeakMap();
    // 客户端每 25 秒发 "ping"，由平台直接回 "pong"，不唤醒房间
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const room = path.split('/').pop();
    const conf = ROOMS[room];
    if (path.startsWith('/count/')) {
      const list = this.entries().map((e) => e.s);
      return new Response(JSON.stringify({ online: list.length, capacity: conf.capacity, taken: list.filter((x) => x.mat != null).length }));
    }
    if (this.state.getWebSockets().length >= conf.maxOnline) return new Response('full', { status: 503 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ room, ...newSession(crypto.randomUUID()) });
    this.broadcast(room);
    return new Response(null, { status: 101, webSocket: client });
  }

  entries(exclude) {
    return this.state
      .getWebSockets()
      .filter((ws) => ws !== exclude)
      .map((ws) => ({ ws, s: ws.deserializeAttachment() }))
      .filter((e) => e.s);
  }

  persist(entries) {
    for (const { ws, s } of entries) ws.serializeAttachment(s);
  }

  tooFast(ws) {
    const now = Date.now();
    let r = this.rate.get(ws);
    if (!r || now - r.t > MSG_LIMIT.ms) this.rate.set(ws, (r = { t: now, n: 0 }));
    return ++r.n > MSG_LIMIT.n;
  }

  async webSocketMessage(ws, message) {
    if (this.tooFast(ws)) {
      try {
        ws.close(1008, 'too fast');
      } catch (e) {
        /* 已关闭 */
      }
      this.leave(ws);
      return;
    }
    const action = parseMessage(typeof message === 'string' ? message : '');
    const entries = this.entries();
    const mine = entries.find((e) => e.ws === ws);
    if (!action || !mine) return;
    const room = mine.s.room;
    const list = entries.map((e) => e.s);
    const res = applyAction(list, mine.s, action, ROOMS[room].capacity);
    this.persist(entries);
    const events = Object.fromEntries(res.assigned.map((id) => [id, 'assigned']));
    if (!res.ok) events[mine.s.id] = 'error:' + res.error;
    this.broadcast(room, events, entries);
  }

  async webSocketClose(ws) {
    this.leave(ws);
    try {
      ws.close(1000, 'bye');
    } catch (e) {
      /* 已关闭 */
    }
  }

  async webSocketError(ws) {
    this.leave(ws);
  }

  leave(ws) {
    const gone = ws.deserializeAttachment();
    if (!gone) return;
    try {
      ws.serializeAttachment(null); // 只处理一次（断开和出错可能都会通知）
    } catch (e) {
      /* 已关闭 */
    }
    const entries = this.entries(ws);
    const list = entries.map((e) => e.s);
    const assigned = removeSession(list, gone.id, ROOMS[gone.room].capacity);
    this.persist(entries);
    this.broadcast(gone.room, Object.fromEntries(assigned.map((id) => [id, 'assigned'])), entries);
  }

  broadcast(room, events = {}, entries = this.entries()) {
    const list = entries.map((e) => e.s);
    for (const { ws, s } of entries) {
      try {
        ws.send(JSON.stringify(snapshotFor(list, s, ROOMS[room].capacity, events[s.id])));
      } catch (e) {
        /* 对方已断开 */
      }
    }
  }
}

// ---- 中枢：远程配置 + 统计总数 + 管理口令锁定（全站只有一个实例）----
const KEEP_DAYS = 400; // 统计只保留约 13 个月
const KEEP_HISTORY = 10; // 保留最近 10 次发布的配置，便于查看和回退
const FAIL = { perIp: 5, perIpMs: 15 * 60e3, lockMs: 60 * 60e3, global: 30 };

export class Hub {
  constructor(state) {
    this.state = state;
    this.buf = {}; // 内存里攒着的统计，每 10 秒写一次存储（省写入次数）
    this.armed = false;
    this.fails = new Map(); // 只在内存里：IP 摘要 → 输错次数
    this.globalFails = { t: 0, n: 0 };
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const input = request.method === 'POST' ? await request.json() : null;
    const store = this.state.storage;
    switch (path) {
      case '/config':
        if (!input) {
          const cur = await store.get('config');
          return new Response(JSON.stringify(cur ? { body: cur.body, sig: cur.sig } : null));
        } else {
          const cur = await store.get('config');
          if (cur && !(input.issued > cur.issued)) return new Response(JSON.stringify({ error: 'stale', current: cur.issued }), { status: 409 });
          const rec = { body: input.envelope.body, sig: input.envelope.sig, issued: input.issued, at: new Date().toISOString() };
          await store.put('config', rec);
          await store.put('cfg:' + input.issued, rec);
          const old = [...(await store.list({ prefix: 'cfg:' })).keys()];
          if (old.length > KEEP_HISTORY) await store.delete(old.slice(0, old.length - KEEP_HISTORY));
          return new Response(JSON.stringify({ ok: true, issued: input.issued }));
        }
      case '/history': {
        const list = [...(await store.list({ prefix: 'cfg:', reverse: true })).values()];
        return new Response(JSON.stringify(list));
      }
      case '/hit':
        addHit(this.buf, input.today, input.item);
        this.arm();
        return new Response(null, { status: 204 });
      case '/err':
        addErr(this.buf, input.today, input.item);
        this.arm();
        return new Response(null, { status: 204 });
      case '/stats': {
        await this.flush();
        const from = new Date(Date.parse(input.today + 'T00:00:00Z') - (input.days - 1) * 864e5).toISOString().slice(0, 10);
        const rows = await store.list({ prefix: 'd:', start: 'd:' + from });
        const days = {};
        for (const [k, v] of rows) days[k.slice(2)] = v;
        return new Response(JSON.stringify({ days }));
      }
      case '/auth':
        return new Response(JSON.stringify(this.auth(input)));
      default:
        return new Response('not found', { status: 404 });
    }
  }

  auth({ ip, fail }) {
    const now = Date.now();
    if (now - this.globalFails.t > FAIL.lockMs) this.globalFails = { t: now, n: 0 };
    let f = this.fails.get(ip);
    if (f && f.until && now > f.until) f = null;
    if (f && !f.until && now - f.t > FAIL.perIpMs) f = null;
    if (fail) {
      f = f || { t: now, n: 0 };
      f.n++;
      if (f.n >= FAIL.perIp) f.until = now + FAIL.lockMs;
      this.fails.set(ip, f);
      this.globalFails.n++;
      if (this.fails.size > 5000) this.fails.clear();
    } else if (f) this.fails.set(ip, f);
    else this.fails.delete(ip);
    const locked = (f && f.until && now < f.until) || this.globalFails.n >= FAIL.global;
    return { locked: !!locked };
  }

  arm() {
    if (this.armed) return;
    this.armed = true;
    this.state.storage.setAlarm(Date.now() + 10000);
  }

  async alarm() {
    this.armed = false;
    await this.flush();
  }

  async flush() {
    const buf = this.buf;
    this.buf = {};
    const store = this.state.storage;
    for (const [day, add] of Object.entries(buf)) {
      const cur = (await store.get('d:' + day)) || emptyDay();
      await store.put('d:' + day, mergeDay(cur, add));
    }
    if (Object.keys(buf).length) {
      const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
      const old = [...(await store.list({ prefix: 'd:', end: 'd:' + cutoff })).keys()];
      if (old.length) await store.delete(old.slice(0, 128));
    }
  }
}
