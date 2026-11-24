// 亲友圈（自愿加入）：家人、同乡互相看到"今天打卡了没有"和连续天数，互相发预设的提醒和祝福。
//
// 不要手机号、不用注册：每台手机自己生成一个随机编号（uid）和一把随机密钥（secret），
// 服务器只存密钥的摘要；每次请求带上密钥，对得上才算本人。
// 存的只有：昵称、最后打卡的那一天、连续天数（可隐藏）、收到的预设提醒。不存礼了哪几番。
// 提醒只能从固定的几句里选，没法发任意文字（不会被用来骚扰、发广告）。

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易看错的 0 O 1 I
export const MAX_MEMBERS = 20;
export const NUDGES = ['remind', 'dua', 'salam', 'congrats'];
const NUDGE_PER_DAY = 3; // 同一个人一天最多给同一个人发 3 条
const INBOX_MAX = 20;
const INACTIVE_DAYS = 180; // 半年没打开的成员自动移出

export const isCode = (s) => typeof s === 'string' && s.length === 10 && [...s].every((c) => CODE_ALPHABET.includes(c));
const isUid = (s) => typeof s === 'string' && /^[0-9a-f]{32}$/.test(s);
const isSecret = (s) => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const dayMs = (d) => Date.parse(d + 'T00:00:00Z');

export function newCode() {
  const b = new Uint8Array(10);
  crypto.getRandomValues(b);
  return [...b].map((x) => CODE_ALPHABET[x % 32]).join('');
}

/** 昵称：去掉控制字符、双向控制符和尖括号，不许网址，1–20 个字 */
export function cleanNick(s) {
  if (typeof s !== 'string') return null;
  const n = s
    .replace(/[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!n || [...n].length > 20 || /:\/\/|www\.|\.(com|ru|tj|org|net)\b/i.test(n)) return null;
  return n;
}

async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function sameStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** 检查请求格式；不对返回 null */
export function parseCircleReq(op, raw, today) {
  if (!raw || typeof raw !== 'object' || !isUid(raw.uid) || !isSecret(raw.secret)) return null;
  const r = { op, uid: raw.uid, secret: raw.secret };
  if (op !== 'create') {
    if (!isCode(raw.code)) return null;
    r.code = raw.code;
  }
  if (op === 'create' || op === 'join' || (op === 'rename' && raw.nick != null)) {
    r.nick = cleanNick(raw.nick);
    if (!r.nick) return null;
  }
  if (op === 'checkin') {
    // 手机的日期：杜尚别日期前后两天内（各地时区不同）
    if (!isDay(raw.day) || Math.abs(dayMs(raw.day) - dayMs(today)) > 2 * 864e5) return null;
    r.day = raw.day;
    r.streak = Number.isInteger(raw.streak) && raw.streak >= 0 && raw.streak <= 100000 ? raw.streak : 0;
  }
  if (op === 'checkin' || op === 'hide') r.hide = raw.hide === true;
  if (op === 'nudge') {
    if (!NUDGES.includes(raw.kind) || typeof raw.to !== 'string' || !/^[0-9a-f]{12}$/.test(raw.to)) return null;
    r.kind = raw.kind;
    r.to = raw.to;
  }
  if (op === 'remove') {
    if (typeof raw.to !== 'string' || !/^[0-9a-f]{12}$/.test(raw.to)) return null;
    r.to = raw.to;
  }
  if (op === 'lock') r.locked = raw.locked === true;
  return r;
}

/** 每个圈一个实例（按邀请码），只存这个圈的成员 */
export class Circle {
  constructor(state) {
    this.state = state;
  }

  async mid(code, uid) {
    return (await sha256hex(code + ':' + uid)).slice(0, 12);
  }

  async fetch(request) {
    const { req, today } = await request.json();
    this.code = req.code;
    const store = this.state.storage;
    const meta = await store.get('meta');
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });

    if (req.op === 'create') {
      if (meta) return reply({ error: 'exists' }, 409);
      await store.put('meta', { owner: req.uid, locked: false, created: today });
      await store.put('m:' + req.uid, { uid: req.uid, nick: req.nick, h: await sha256hex(req.secret), day: null, streak: 0, hide: false, seen: today });
      return reply(await this.view(req, today));
    }
    if (!meta) return reply({ error: 'no-circle' }, 404);
    const me = await store.get('m:' + req.uid);

    if (req.op === 'join') {
      if (me) {
        if (!sameStr(me.h, await sha256hex(req.secret))) return reply({ error: 'unauthorized' }, 401);
        return reply(await this.view(req, today));
      }
      if (meta.locked) return reply({ error: 'locked' }, 403);
      const count = (await store.list({ prefix: 'm:' })).size;
      if (count >= MAX_MEMBERS) return reply({ error: 'full' }, 403);
      await store.put('m:' + req.uid, { uid: req.uid, nick: req.nick, h: await sha256hex(req.secret), day: null, streak: 0, hide: false, seen: today });
      return reply(await this.view(req, today));
    }

    // 其余操作都要是圈里的人、密钥对得上
    if (!me || !sameStr(me.h, await sha256hex(req.secret))) return reply({ error: 'unauthorized' }, 401);
    me.seen = today;
    switch (req.op) {
      case 'state':
        break;
      case 'checkin':
        if (!me.day || req.day >= me.day) {
          me.day = req.day;
          me.streak = req.streak;
        }
        me.hide = req.hide;
        break;
      case 'hide':
        me.hide = req.hide;
        break;
      case 'rename':
        me.nick = req.nick;
        break;
      case 'nudge': {
        const target = await this.byMid(meta, req.to);
        if (!target || target.uid === me.uid) return reply({ error: 'no-member' }, 404);
        const sent = me.sent && me.sent.day === today ? me.sent : { day: today, n: {} };
        if ((sent.n[req.to] || 0) >= NUDGE_PER_DAY) return reply({ error: 'limit' }, 429);
        sent.n[req.to] = (sent.n[req.to] || 0) + 1;
        me.sent = sent;
        const inbox = ((await store.get('in:' + target.uid)) || []).slice(-(INBOX_MAX - 1));
        inbox.push({ from: await this.mid(req.code, me.uid), kind: req.kind, day: today });
        await store.put('in:' + target.uid, inbox);
        break;
      }
      case 'remove': {
        if (meta.owner !== me.uid) return reply({ error: 'forbidden' }, 403);
        const target = await this.byMid(meta, req.to);
        if (target && target.uid !== me.uid) await store.delete(['m:' + target.uid, 'in:' + target.uid]);
        break;
      }
      case 'lock':
        if (meta.owner !== me.uid) return reply({ error: 'forbidden' }, 403);
        meta.locked = req.locked;
        await store.put('meta', meta);
        break;
      case 'leave': {
        await store.delete(['m:' + me.uid, 'in:' + me.uid]);
        const rest = [...(await store.list({ prefix: 'm:' })).values()];
        if (!rest.length) await store.deleteAll();
        else if (meta.owner === me.uid) await store.put('meta', { ...meta, owner: rest[0].uid });
        return reply({ ok: true });
      }
      default:
        return reply({ error: 'bad' }, 400);
    }
    await store.put('m:' + me.uid, me);
    return reply(await this.view(req, today));
  }

  async byMid(meta, mid) {
    for (const m of (await this.state.storage.list({ prefix: 'm:' })).values()) if ((await this.mid(this.code, m.uid)) === mid) return m;
    return null;
  }

  /** 给本人看的圈：成员（昵称、最后打卡日、连续天数），以及收到的提醒（看过就清空） */
  async view(req, today) {
    this.code = req.code;
    const store = this.state.storage;
    const meta = await store.get('meta');
    const cut = new Date(dayMs(today) - INACTIVE_DAYS * 864e5).toISOString().slice(0, 10);
    const members = [];
    for (const m of (await store.list({ prefix: 'm:' })).values()) {
      if (m.seen && m.seen < cut && m.uid !== req.uid) {
        await store.delete(['m:' + m.uid, 'in:' + m.uid]);
        continue;
      }
      members.push({ mid: await this.mid(req.code, m.uid), nick: m.nick, day: m.day, streak: m.hide ? null : m.streak, me: m.uid === req.uid, owner: m.uid === meta.owner });
    }
    members.sort((a, b) => (a.me === b.me ? a.nick.localeCompare(b.nick) : a.me ? -1 : 1));
    // 收到的提醒只在"查看亲友圈"时取走（看过就清空）；打卡、发提醒等操作不动它，免得被别的请求"读掉"
    const inbox = req.op === 'state' ? (await store.get('in:' + req.uid)) || [] : [];
    if (inbox.length) await store.delete('in:' + req.uid);
    const names = Object.fromEntries(members.map((m) => [m.mid, m.nick]));
    return {
      code: req.code,
      locked: !!meta.locked,
      owner: meta.owner === req.uid,
      members,
      inbox: inbox.map((x) => ({ nick: names[x.from] || null, kind: x.kind, day: x.day })).filter((x) => x.nick),
    };
  }
}
