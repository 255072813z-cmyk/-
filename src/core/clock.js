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
