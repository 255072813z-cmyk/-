// 匿名使用统计的格式（手机应用发送、后台服务接收共用）。
//
// 每台设备每个使用日一条（没网时先存在手机里，有网时补传），内容只有：
//   d 哪一天用了、v 应用版本、p 平台（web/android/ios）、l 界面语言、c 所选城市（"我的位置"只报最近的城市）、
//   iw 第一次打开是哪一周（周一的日期，用来算留存）、nw 是否第一次打开、src 从哪来（share 分享链接 / direct / app）、
//   ntf 是否开着提醒、fs 字号档位、ad 最近 7 天用了几天、
//   f 上一个使用日用到的功能（只有"用没用"）、pk 那天记了几番"已礼"、gd 那天跟着做完几次礼拜、fd 那是哪一天。
// 没有设备编号、没有具体时间、没有位置坐标；后台只把它们加进每天的总数，不保存单条记录，也不保存 IP。
// 本文件不能 import 任何东西。

export const PLATFORMS = ['web', 'android', 'ios'];
export const SOURCES = ['share', 'direct', 'app'];
export const STAT_LANGS = ['zh', 'tg', 'ru'];
export const FEATURES = ['home', 'pray', 'wudu', 'guide', 'qibla', 'tasbih', 'ramadan', 'tarawih', 'quran', 'masjid', 'hall', 'courtyard', 'poetry', 'settings', 'city', 'here'];
export const MAX_ERR_KINDS = 200; // 每天最多记多少种不同的错误

/** 地址（# 后面）→ 功能名 */
export function featureOf(path) {
  const p = String(path || '').replace(/^#?\/?/, '').split('/');
  if (!p[0]) return 'home';
  if (p[0] === 'pray') return p[1] === 'wudu' ? 'wudu' : p[1] === 'guide' ? (p[2] === 'tarawih' ? 'tarawih' : 'guide') : 'pray';
  if (p[0] === 'ramadan') return p[1] === 'tarawih' ? 'tarawih' : p[1] === 'quran' ? 'quran' : 'ramadan';
  if (p[0] === 'masjid') return ['hall', 'courtyard', 'poetry'].includes(p[1]) ? p[1] : 'masjid';
  return FEATURES.includes(p[0]) ? p[0] : null;
}

const isVer = (s) => typeof s === 'string' && /^\d{1,4}(\.\d{1,4}){0,2}$/.test(s);
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** 检查一条"某天用了"的上报；不合法返回 null。today = 服务器的今天（杜尚别日期） */
export function parseHit(raw, cityIds, today) {
  if (!raw || typeof raw !== 'object') return null;
  // 离线攒下的可以晚到：最多补 30 天前的；手机时区比杜尚别早时可能是"明天"
  const d = isDay(raw.d) && daysBetween(raw.d, today) <= 30 && daysBetween(raw.d, today) >= -1 ? raw.d : raw.d == null ? today : null;
  if (!d) return null;
  const hit = {
    d,
    v: isVer(raw.v) ? raw.v : 'other',
    p: PLATFORMS.includes(raw.p) ? raw.p : 'web',
    l: STAT_LANGS.includes(raw.l) ? raw.l : 'zh',
    c: cityIds.includes(raw.c) ? raw.c : 'other',
    iw: isDay(raw.iw) && raw.iw <= d && raw.iw >= '2026-01-01' ? raw.iw : null,
    nw: raw.nw === 1 ? 1 : 0,
    src: SOURCES.includes(raw.src) ? raw.src : null,
    ntf: raw.ntf === 1 ? 1 : raw.ntf === 0 ? 0 : null,
    fs: int(raw.fs, 0, 2),
    ad: int(raw.ad, 1, 7),
    f: [],
    fd: null,
    pk: null,
    gd: null,
  };
  if (isDay(raw.fd) && raw.fd < d && daysBetween(raw.fd, d) <= 30) {
    hit.fd = raw.fd;
    if (Array.isArray(raw.f)) hit.f = [...new Set(raw.f.filter((x) => FEATURES.includes(x)))].slice(0, FEATURES.length);
    hit.pk = int(raw.pk, 0, 5);
    hit.gd = int(raw.gd, 0, 50);
  }
  return hit;
}

/** 检查一条错误上报：只要简短的错误信息和出错位置 */
export function parseErr(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.m !== 'string') return null;
  const clean = (s, n) => String(s || '').replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, n).trim();
  const m = clean(raw.m, 160);
  if (!m) return null;
  return { v: isVer(raw.v) ? raw.v : 'other', p: PLATFORMS.includes(raw.p) ? raw.p : 'web', m, s: clean(raw.s, 80) };
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
}

export const emptyDay = () => ({ n: 0, p: {}, l: {}, c: {}, v: {}, fn: 0, f: {}, e: {}, nw: 0, src: {}, coh: {}, ntf: 0, ntfn: 0, fs: {}, ad: {}, pk: {}, gd: 0 });
const KEYS = ['p', 'l', 'c', 'v', 'f', 'e', 'src', 'coh', 'fs', 'ad', 'pk'];
const NUMS = ['n', 'fn', 'nw', 'ntf', 'ntfn', 'gd'];
const inc = (o, k, by = 1) => {
  o[k] = (o[k] || 0) + by;
};

/** 把一条上报加进那一天的总数（f、pk、gd 记到它们所属的那一天） */
export function addHit(days, today, hit) {
  const day = hit.d || today;
  const d = (days[day] = { ...emptyDay(), ...(days[day] || {}) });
  d.n++;
  inc(d.p, hit.p);
  inc(d.l, hit.l);
  inc(d.c, hit.c);
  inc(d.v, hit.v);
  if (hit.nw) {
    d.nw++;
    if (hit.src) inc(d.src, hit.src);
  }
  if (hit.iw) inc(d.coh, hit.iw);
  if (hit.ntf != null) {
    d.ntfn++;
    d.ntf += hit.ntf;
  }
  if (hit.fs != null) inc(d.fs, String(hit.fs));
  if (hit.ad != null) inc(d.ad, String(hit.ad));
  if (hit.fd) {
    const fd = (days[hit.fd] = { ...emptyDay(), ...(days[hit.fd] || {}) });
    fd.fn++;
    for (const f of hit.f) inc(fd.f, f);
    if (hit.pk != null) inc(fd.pk, String(hit.pk));
    if (hit.gd != null) fd.gd += hit.gd;
  }
}

export function addErr(days, today, err) {
  const d = (days[today] = { ...emptyDay(), ...(days[today] || {}) });
  const key = `${err.v}|${err.p}|${err.s}|${err.m}`;
  if (d.e[key] == null && Object.keys(d.e).length >= MAX_ERR_KINDS) return;
  inc(d.e, key);
}

/** 合并两天的数据（把内存里攒的加到已保存的上） */
export function mergeDay(a, b) {
  const out = { ...emptyDay(), ...(a || {}) };
  for (const k of KEYS) out[k] = { ...(out[k] || {}) };
  for (const k of NUMS) out[k] = (out[k] || 0) + (b[k] || 0);
  for (const k of KEYS) {
    for (const [key, n] of Object.entries(b[k] || {})) {
      if (k === 'e' && out.e[key] == null && Object.keys(out.e).length >= MAX_ERR_KINDS) continue;
      inc(out[k], key, n);
    }
  }
  return out;
}

/** 某天所在那一周的周一（留存按"第一次打开的那一周"分组） */
export function weekOf(day) {
  const t = Date.parse(day + 'T00:00:00Z');
  const wd = (new Date(t).getUTCDay() + 6) % 7; // 周一 = 0
  return new Date(t - wd * 864e5).toISOString().slice(0, 10);
}
