// 时间工具：一律按城市的固定 UTC 偏移换算，不读取手机时区。
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

import { devParam } from './dev.js';

// 调试/演示：地址里加 ?now=2026-12-20T15:20 可以把时钟拨到杜尚别当地的这个时刻（之后照常走动）。只在本机和预览版生效。
let shift = 0;
try {
  const q = devParam('now');
  if (q) {
    const m = q.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (m) {
      const target = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 5 * HOUR;
      shift = target - Date.now();
    }
  }
} catch (e) {
  /* 非浏览器环境（测试）忽略 */
}

export function now() {
  return new Date(Date.now() + shift);
}

const pad = (n) => (n < 10 ? '0' : '') + n;

// 页面显示用的时区（当前所选城市的 UTC 偏移）。切换城市时由 main.js 设置。
let displayOffset = 5;
export function setDisplayOffset(h) {
  if (isFinite(h)) displayOffset = h;
}
export const getDisplayOffset = () => displayOffset;

/** 某一时刻在给定 UTC 偏移下的年月日时分秒（不给偏移时按当前所选城市） */
export function localParts(date, offsetH = displayOffset) {
  const d = new Date(date.getTime() + offsetH * HOUR);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes(),
    ss: d.getUTCSeconds(),
    wd: d.getUTCDay(),
  };
}

export function fmtHM(date, offsetH = displayOffset) {
  const p = localParts(date, offsetH);
  return pad(p.hh) + ':' + pad(p.mm);
}

export function addDays(ymd, n) {
  const t = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
}

export function ymdKey(ymd) {
  return `${ymd.y}-${pad(ymd.m)}-${pad(ymd.d)}`;
}

/** 把毫秒差拆成 时/分/秒 */
export function splitDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export { pad, HOUR, DAY };

// ---- 时区：避免歧义 ----
// 城市用固定的 UTC 偏移（塔吉克斯坦、乌兹别克斯坦、吉尔吉斯斯坦、俄罗斯、中国都没有夏令时）。
// "我的位置"另外记着手机的时区名（如 Europe/Berlin）：出门到有夏令时的地方，每一天按那一天的偏移算，月表、提醒都不会差一小时。

/** 手机现在的时区名（取不到返回 ''） */
export function deviceTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (e) {
    return '';
  }
}

/** 手机现在相对 UTC 的小时数（北京 8、杜尚别 5） */
export const deviceOffsetNow = () => -new Date().getTimezoneOffset() / 60;

const FMT = new Map();
/** 某个时区在某一时刻的 UTC 偏移（小时）；时区名不认识时返回 null */
export function tzOffsetAt(tz, date) {
  try {
    let f = FMT.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      FMT.set(tz, f);
    }
    const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000) / 60;
  } catch (e) {
    return null;
  }
}

/** 城市在某一时刻用的 UTC 偏移：记了时区名的（"我的位置"）按那一天算，其余用城市的固定偏移 */
export function offsetAt(city, date) {
  if (city && city.tz) {
    const o = tzOffsetAt(city.tz, date);
    if (o != null) return o;
  }
  return city ? city.utcOffset : displayOffset;
}

/** UTC 偏移写成 "UTC+5"、"UTC+5:30"、"UTC−3" */
export function utcLabel(h) {
  const sign = h < 0 ? '−' : '+';
  const a = Math.abs(h);
  const hh = Math.floor(a);
  const mm = Math.round((a - hh) * 60);
  return `UTC${sign}${hh}${mm ? ':' + pad(mm) : ''}`;
}
