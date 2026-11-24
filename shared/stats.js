// 匿名使用统计的格式（手机应用发送、后台服务接收共用）。
//
// 每台设备每天最多发一次，内容只有：
//   v 应用版本、p 平台（web/android/ios）、l 界面语言、c 所选城市（"我的位置"只报最近的城市）、
//   f 前一天用到的功能（只有"用没用"，没有次数和时间）、fd 那是哪一天。
// 没有设备编号、没有时间戳、没有位置坐标；后台只把它们加进当天的总数，不保存单条记录，也不保存 IP。
// 本文件不能 import 任何东西。

export const PLATFORMS = ['web', 'android', 'ios'];
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

/** 检查一条"今天用了"的上报；不合法返回 null */
export function parseHit(raw, cityIds, today) {
  if (!raw || typeof raw !== 'object') return null;
  const hit = {
    v: isVer(raw.v) ? raw.v : 'other',
    p: PLATFORMS.includes(raw.p) ? raw.p : 'web',
    l: STAT_LANGS.includes(raw.l) ? raw.l : 'zh',
    c: cityIds.includes(raw.c) ? raw.c : 'other',
    f: [],
    fd: null,
  };
  if (Array.isArray(raw.f) && isDay(raw.fd) && raw.fd < today && daysBetween(raw.fd, today) <= 7) {
    hit.f = [...new Set(raw.f.filter((x) => FEATURES.includes(x)))].slice(0, FEATURES.length);
    hit.fd = raw.fd;
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

export const emptyDay = () => ({ n: 0, p: {}, l: {}, c: {}, v: {}, fn: 0, f: {}, e: {} });
const inc = (o, k, by = 1) => {
  o[k] = (o[k] || 0) + by;
};

/** 把一条上报加进当天的总数（f 记到它所属的那一天） */
export function addHit(days, today, hit) {
  const d = (days[today] = days[today] || emptyDay());
  d.n++;
  inc(d.p, hit.p);
  inc(d.l, hit.l);
  inc(d.c, hit.c);
  inc(d.v, hit.v);
  if (hit.fd) {
    const fd = (days[hit.fd] = days[hit.fd] || emptyDay());
    fd.fn++;
    for (const f of hit.f) inc(fd.f, f);
  }
}

export function addErr(days, today, err) {
  const d = (days[today] = days[today] || emptyDay());
  const key = `${err.v}|${err.p}|${err.s}|${err.m}`;
  if (d.e[key] == null && Object.keys(d.e).length >= MAX_ERR_KINDS) return;
  inc(d.e, key);
}

/** 合并两天的数据（把内存里攒的加到已保存的上） */
export function mergeDay(a, b) {
  const out = a || emptyDay();
  out.n += b.n;
  out.fn += b.fn;
  for (const k of ['p', 'l', 'c', 'v', 'f', 'e']) {
    for (const [key, n] of Object.entries(b[k])) {
      if (k === 'e' && out.e[key] == null && Object.keys(out.e).length >= MAX_ERR_KINDS) continue;
      inc(out[k], key, n);
    }
  }
  return out;
}
