// 早晚记念的进度：今天早晨、傍晚各念到哪里（只存在这台手机上，不计分、不排名）。
// 内容在 content/adhkar.js（较大，按需下载）；这里只放首页也要用的小东西。
import { load, save } from './storage.js';

// 每组几条（和 content/adhkar.js 的 MORNING、EVENING 一致，tests 会核对）
export const ADHKAR_TOTAL = { m: 6, e: 6 };

/** 现在该念哪一组：晡礼之后到第二天晨礼之前是傍晚，其余是早晨 */
export function adhkarPart(sched, now) {
  const T = sched.times;
  return now >= T.asr || now < T.fajr ? 'e' : 'm';
}

function state(day) {
  const s = load('adhkar', null);
  const ok = s && s.day === day && s.m && s.e && Array.isArray(s.md) && Array.isArray(s.ed);
  return ok ? s : { day, m: {}, e: {}, md: [], ed: [] };
}

/** 某组每条念了几遍 {id: n}、念完了哪几条 [id] */
export function adhkarProgress(day, part) {
  const s = state(day);
  return { counts: { ...s[part] }, done: [...s[part + 'd']] };
}

/** 记下一条念了几遍；念满了就记为"念完"。整组念完时返回 true */
export function setAdhkarCount(day, part, id, n, target) {
  const s = state(day);
  s[part][id] = n;
  const d = s[part + 'd'];
  if (n >= target && !d.includes(id)) d.push(id);
  save('adhkar', s);
  const all = d.length >= ADHKAR_TOTAL[part];
  if (all) markDay(day, part);
  return all;
}

/** 这一组重新开始 */
export function resetAdhkar(day, part) {
  const s = state(day);
  s[part] = {};
  s[part + 'd'] = [];
  save('adhkar', s);
}

/** 念完过的日子：{ 'YYYY-MM-DD': 1 早晨 | 2 傍晚 | 3 都念了 }，最多留一年 */
export function adhkarDays() {
  const d = load('adhkarDays', {});
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
}
function markDay(day, part) {
  const d = adhkarDays();
  d[day] = (d[day] || 0) | (part === 'm' ? 1 : 2);
  const keep = Object.keys(d).sort().slice(-366);
  save('adhkarDays', Object.fromEntries(keep.map((k) => [k, d[k]])));
}
