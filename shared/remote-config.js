// 远程配置：格式检查 + 签名验证。手机应用、后台服务、管理后台三处共用这一份代码。
//
// 为什么要签名：配置会推送到每一台手机（公告、官方时间校正等）。
// 即使后台服务或管理口令被人拿到，没有签名私钥也改不了手机上显示的内容。
// 私钥只在管理员自己的电脑上（管理后台在浏览器里本地签名，私钥不上传）。
//
// 本文件不能 import 任何东西（管理后台会原样加载它）。

export const LANGS = ['zh', 'tg', 'ru', 'uz', 'ky'];
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const FLAGS = ['masjid', 'presence', 'weather', 'stats'];
// 伊斯兰历按国家校正（各国宗教局公布的日期可能不同）
export const COUNTRIES = ['TJ', 'UZ', 'KG', 'RU', 'CN'];
export const LIMITS = { offsetMin: 30, hijri: 2, text: 400, notices: 3, body: 65536 };
// 应用商店链接只允许这些网址
export const STORE_HOSTS = { android: ['play.google.com', 'galaxystore.samsung.com', 'apps.samsung.com'], ios: ['apps.apple.com'] };

const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isVersion = (s) => typeof s === 'string' && /^\d{1,4}(\.\d{1,4}){0,2}$/.test(s);
const int = (v, lim) => (Number.isInteger(v) && Math.abs(v) <= lim ? v : null);

/** 多语言文字 {zh, tg, ru, uz, ky}：去掉空白和控制字符，限制长度 */
function text(o) {
  if (!isObj(o)) return null;
  const out = {};
  for (const l of LANGS) {
    if (typeof o[l] !== 'string') continue;
    // 去掉控制字符和双向文字控制符（防止显示错乱、伪装文字）
    const s = o[l].replace(/[\u0000-\u0008\u000B-\u001F\u007F‎‏‪-‮⁦-⁩]/g, '').trim();
    if (s) out[l] = s.slice(0, LIMITS.text);
  }
  return Object.keys(out).length ? out : null;
}

/** 比较版本号：'1.2.0' 与 '1.10' → -1 / 0 / 1 */
export function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * 清洗配置：只留下认识、合法的字段。整体格式不对时返回 null。
 * @param raw     解析后的 JSON
 * @param cityIds 合法的城市编号（官方时间校正只接受这些城市）
 */
export function sanitizeConfig(raw, cityIds = []) {
  if (!isObj(raw) || raw.v !== 1 || typeof raw.issued !== 'string' || !isFinite(Date.parse(raw.issued))) return null;
  // 发布时间统一成标准格式，前后比较才可靠（旧配置不能覆盖新配置）
  const out = { v: 1, issued: new Date(raw.issued).toISOString(), notices: [], cityOffsets: {}, hijri: {}, flags: {}, minVersion: null, store: {} };

  // 公告：最多 3 条；只有文字，不允许链接以外的任何格式（显示时一律当纯文字）
  for (const n of Array.isArray(raw.notices) ? raw.notices.slice(0, LIMITS.notices) : []) {
    if (!isObj(n) || typeof n.id !== 'string' || !/^[A-Za-z0-9-]{1,32}$/.test(n.id)) continue;
    const tx = text(n.text);
    if (!tx) continue;
    out.notices.push({ id: n.id, level: n.level === 'warn' ? 'warn' : 'info', text: tx, from: isDate(n.from) ? n.from : null, until: isDate(n.until) ? n.until : null });
  }

  // 官方时间校正：某城市各番拜在计算值上加减几分钟。必须写明来源，否则不用。
  if (isObj(raw.cityOffsets)) {
    for (const [id, o] of Object.entries(raw.cityOffsets)) {
      if (!cityIds.includes(id) || !isObj(o)) continue;
      const src = text(o.src);
      if (!src) continue;
      const v = {};
      let ok = true;
      for (const p of PRAYERS) {
        const m = int(o[p] == null ? 0 : o[p], LIMITS.offsetMin);
        if (m == null) ok = false;
        else v[p] = m;
      }
      if (ok) out.cityOffsets[id] = { ...v, src };
    }
  }

  // 伊斯兰历：按当地宣布整体调整 ±2 天（塔吉克斯坦、俄罗斯分别设置），必须写明来源
  for (const cc of COUNTRIES) {
    const h = isObj(raw.hijri) ? raw.hijri[cc] : null;
    if (!isObj(h)) continue;
    const a = int(h.adjust, LIMITS.hijri);
    const src = text(h.src);
    if (a != null && src) out.hijri[cc] = { adjust: a, src };
  }

  // 功能开关：出问题时可以远程临时关闭
  if (isObj(raw.flags)) for (const k of FLAGS) if (typeof raw.flags[k] === 'boolean') out.flags[k] = raw.flags[k];

  // 最低版本：低于它的应用提示去商店更新
  if (isVersion(raw.minVersion)) out.minVersion = raw.minVersion;
  for (const [plat, hosts] of Object.entries(STORE_HOSTS)) {
    const u = isObj(raw.store) ? raw.store[plat] : null;
    if (typeof u !== 'string') continue;
    try {
      const x = new URL(u);
      if (x.protocol === 'https:' && hosts.includes(x.hostname) && !x.username && !x.password) out.store[plat] = x.href;
    } catch (e) {
      /* 不是网址 */
    }
  }
  return out;
}

// ---- 签名（ECDSA P-256 + SHA-256，浏览器、Cloudflare、Node 都自带）----
const enc = new TextEncoder();
export function toB64(buf) {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
export function fromB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIG = { name: 'ECDSA', hash: 'SHA-256' };

/** 公钥：只取 x、y，避免带入多余字段 */
export function publicJwk(jwk) {
  if (!isObj(jwk) || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') return null;
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true };
}

/**
 * 验证签名包 { body: "<JSON 文字>", sig: "<base64>" }。
 * 通过时返回 JSON.parse(body)；签名不对、格式不对时返回 null。
 */
export async function verifyEnvelope(envelope, jwk) {
  const pub = publicJwk(jwk);
  if (!pub || !isObj(envelope) || typeof envelope.body !== 'string' || typeof envelope.sig !== 'string') return null;
  if (envelope.body.length > LIMITS.body || envelope.sig.length > 200) return null;
  try {
    const key = await crypto.subtle.importKey('jwk', pub, ALG, false, ['verify']);
    const ok = await crypto.subtle.verify(SIG, key, fromB64(envelope.sig), enc.encode(envelope.body));
    return ok ? JSON.parse(envelope.body) : null;
  } catch (e) {
    return null;
  }
}

/** 签名（只在管理后台和测试里用；私钥不离开管理员的电脑） */
export async function signBody(body, privateJwk) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, ALG, false, ['sign']);
  return { body, sig: toB64(await crypto.subtle.sign(SIG, key, enc.encode(body))) };
}

/** 生成一对新密钥（管理后台"生成密钥"用） */
export async function generateKeys() {
  const pair = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  return { privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey), publicJwk: publicJwk(await crypto.subtle.exportKey('jwk', pair.publicKey)) };
}
