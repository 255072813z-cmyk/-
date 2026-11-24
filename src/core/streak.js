// 坚持打卡：记下任何一番"已礼"，今天就算打卡。
// - 连续天数：每天打卡 +1；断了从 1 重新开始，已解锁的称号保留。
// - 宽限日：每个自然周（周一到周日）自动宽限一天，偶尔忘了不至于前功尽弃（参考多邻国的"连胜保护"）。
// - 坚持称号：3、7、15、30、60、100、200、365 天各解锁一个。称号讲"坚持"，不评判信仰。
// 只存在这台手机上；不计分、不排名。加入亲友圈时，亲友只看到"今天打卡了没有"和连续天数（可隐藏）。
import { load, save } from './storage.js';

export const MILESTONES = [3, 7, 15, 30, 60, 100, 200, 365];
const DAY = 864e5;
const t = (d) => Date.parse(d + 'T00:00:00Z');
const key = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDay = (d, n) => key(t(d) + n * DAY);
const between = (a, b) => Math.round((t(b) - t(a)) / DAY);
/** 某天所在那一周的周一 */
export const weekOf = (d) => addDay(d, -((new Date(t(d)).getUTCDay() + 6) % 7));

const EMPTY = { cur: 0, best: 0, last: null, grace: [], titles: [], prev: 0 };

export function readStreak() {
  const s = load('streak', null);
  if (!s || typeof s !== 'object') return { ...EMPTY };
  const ok = (v) => Number.isInteger(v) && v >= 0 && v < 100000;
  return {
    cur: ok(s.cur) ? s.cur : 0,
    best: ok(s.best) ? s.best : 0,
    last: typeof s.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.last) ? s.last : null,
    grace: Array.isArray(s.grace) ? s.grace.filter((d) => typeof d === 'string').slice(-20) : [],
    titles: Array.isArray(s.titles) ? s.titles.filter((m) => MILESTONES.includes(m)) : [],
    prev: ok(s.prev) ? s.prev : 0,
  };
}

/** 从上次打卡到 today 之间漏掉的日子，能不能都用宽限日补上（每周最多一天） */
function bridge(s, today) {
  if (!s.last) return null;
  const gap = between(s.last, today);
  if (gap <= 1) return [];
  const missed = [];
  for (let i = 1; i < gap; i++) missed.push(addDay(s.last, i));
  const used = new Set(s.grace.map(weekOf));
  const take = [];
  for (const d of missed) {
    const w = weekOf(d);
    if (used.has(w)) return null; // 这一周的宽限已经用过
    used.add(w);
    take.push(d);
  }
  return take;
}

/**
 * 现在显示的连续天数（今天还没打卡时：昨天打了、或漏的日子能用宽限补上，就还连着）。
 * 返回 { cur, alive, today: 今天打了没有, graceNeeded: 今天打卡会用掉的宽限日 }
 */
export function streakStatus(today) {
  const s = readStreak();
  if (s.last === today) return { ...s, alive: true, today: true, graceNeeded: [] };
  const b = bridge(s, today);
  if (b) return { ...s, alive: s.cur > 0, today: false, graceNeeded: b };
  return { ...s, cur: 0, alive: false, today: false, graceNeeded: [] };
}

/**
 * 今天打卡。返回 { cur, best, newTitle, usedGrace, restartedFrom, fresh }
 * newTitle：这次刚解锁的称号天数（没有则 null）；fresh：今天第一次打卡（用来放"又坚持了一天"的动画）
 */
export function checkIn(today) {
  const s = readStreak();
  if (s.last === today) return { ...s, newTitle: null, usedGrace: [], restartedFrom: 0, fresh: false };
  if (s.last && s.last > today) return { ...s, newTitle: null, usedGrace: [], restartedFrom: 0, fresh: false }; // 手机日期往回调了：不动
  const b = bridge(s, today);
  let restartedFrom = 0;
  if (b) {
    s.cur += 1;
    s.grace = [...s.grace, ...b].slice(-20);
  } else {
    restartedFrom = s.cur;
    if (s.cur) s.prev = s.cur;
    s.cur = 1;
  }
  s.last = today;
  s.best = Math.max(s.best, s.cur);
  // 一次可能跨过几个称号（老用户升级时），全部记上，庆祝最高的那个
  const reached = MILESTONES.filter((m) => s.cur >= m && !s.titles.includes(m));
  s.titles = [...s.titles, ...reached];
  save('streak', s);
  return { ...s, newTitle: reached.length ? reached[reached.length - 1] : null, usedGrace: b || [], restartedFrom, fresh: true };
}

/** 下一个称号还差几天 */
export function nextTitle(cur) {
  const m = MILESTONES.find((x) => x > cur);
  return m ? { at: m, left: m - cur } : null;
}

/** 本周七天（周一到周日）的状态：done 打卡了 / grace 宽限 / missed 漏了 / today 今天还没打 / future */
export function weekCells(today, doneDays) {
  const s = readStreak();
  const mon = weekOf(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDay(mon, i);
    let st = 'future';
    // 还从没打过卡的新用户：之前的日子不算"漏了"，显示成空格，不让人一开始就泄气
    if (d < today) st = doneDays.has(d) ? 'done' : s.grace.includes(d) ? 'grace' : s.best ? 'missed' : 'future';
    else if (d === today) st = doneDays.has(d) || s.last === today ? 'done' : 'today';
    return { day: d, wd: (i + 1) % 7, st };
  });
}
