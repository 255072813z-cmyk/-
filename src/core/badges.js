// 荣誉称号之二：成就徽章（坚持天数的称号见 streak.js）。
// 每个徽章都对应一件实实在在做到的事（学会小净、读完古兰经、斋月每天都封了……），
// 名字讲"做到了什么"，不评判信仰、不分高低；只存在这台手机上，不计分、不排名、不公开。
import { load, save } from './storage.js';
import { PRAYERS } from './prayer-times.js';

// group：prayer 礼拜 / learn 学习 / ramadan 斋月 / together 同行；need：要累计多少（天或次）
export const BADGES = [
  { id: 'firstPrayer', group: 'prayer' },
  { id: 'fiveDay', group: 'prayer' },
  { id: 'fiveWeek', group: 'prayer', need: 7 },
  { id: 'fajr7', group: 'prayer', need: 7 },
  { id: 'fajr30', group: 'prayer', need: 30 },
  { id: 'wudu', group: 'learn' },
  { id: 'guide1', group: 'learn' },
  { id: 'guide30', group: 'learn', need: 30 },
  { id: 'tasbih', group: 'learn' },
  { id: 'qada', group: 'learn' },
  { id: 'fast1', group: 'ramadan' },
  { id: 'fastAll', group: 'ramadan', need: 29 },
  { id: 'tarawih', group: 'ramadan' },
  { id: 'quran', group: 'ramadan' },
  { id: 'circle', group: 'together' },
  { id: 'share', group: 'together' },
];
const BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));
// 累计按"天"算的（同一天只算一次）和按"次"算的
const DAY_TALLY = { fiveWeek: 'five', fajr7: 'fajr', fajr30: 'fajr' };

function read() {
  const s = load('badges', null);
  const ok = s && typeof s === 'object' && !Array.isArray(s);
  const got = ok && s.got && typeof s.got === 'object' ? s.got : {};
  const days = ok && s.days && typeof s.days === 'object' ? s.days : {};
  const n = ok && s.n && typeof s.n === 'object' ? s.n : {};
  return {
    got: Object.fromEntries(Object.entries(got).filter(([k, v]) => BY_ID[k] && typeof v === 'string')),
    days: { five: Array.isArray(days.five) ? days.five.slice(-400) : [], fajr: Array.isArray(days.fajr) ? days.fajr.slice(-400) : [] },
    n: { guide: Number.isInteger(n.guide) && n.guide >= 0 ? n.guide : 0, fast: Number.isInteger(n.fast) && n.fast >= 0 && n.fast <= 30 ? n.fast : 0 },
  };
}

/** 解锁一个徽章；第一次解锁时返回它，否则返回 null（today 用当天日期，不用手机时钟的毫秒） */
export function award(id, today) {
  if (!BY_ID[id]) return null;
  const s = read();
  if (s.got[id]) return null;
  s.got[id] = today;
  save('badges', s);
  return BY_ID[id];
}

function tallyDay(s, kind, day) {
  if (!s.days[kind].includes(day)) s.days[kind] = [...s.days[kind], day].slice(-400);
}

/** 记下"已礼"之后：第一步、五番齐全、七天五番、晨起的人……返回新解锁的徽章 */
export function onPrayed(day, prayed) {
  const marked = PRAYERS.filter((p) => prayed[p]);
  if (!marked.length) return [];
  const s = read();
  if (marked.length === PRAYERS.length) tallyDay(s, 'five', day);
  if (prayed.fajr) tallyDay(s, 'fajr', day);
  save('badges', s);
  const ids = ['firstPrayer'];
  if (marked.length === PRAYERS.length) ids.push('fiveDay');
  for (const [id, kind] of Object.entries(DAY_TALLY)) if (s.days[kind].length >= BY_ID[id].need) ids.push(id);
  return ids.map((id) => award(id, day)).filter(Boolean);
}

/** 斋月记录变了：第一天封斋；一个斋月里记下 29 天（29 天的月份就是整月） */
export function onFast(day, log) {
  const yes = Math.min(30, Object.values(log || {}).filter((v) => v === 'yes').length);
  const s = read();
  s.n.fast = yes;
  save('badges', s);
  const ids = [];
  if (yes >= 1) ids.push('fast1');
  if (yes >= 29) ids.push('fastAll');
  return ids.map((id) => award(id, day)).filter(Boolean);
}

/** 跟着做完一次礼拜 */
export function onGuideDone(day) {
  const s = read();
  s.n.guide += 1;
  save('badges', s);
  const ids = ['guide1'];
  if (s.n.guide >= BY_ID.guide30.need) ids.push('guide30');
  return ids.map((id) => award(id, day)).filter(Boolean);
}

/** 给"荣誉称号"页用：每个徽章解锁了没有、进度 */
export function badgeList() {
  const s = read();
  const progress = { fiveWeek: s.days.five.length, fajr7: s.days.fajr.length, fajr30: s.days.fajr.length, guide30: s.n.guide, fastAll: s.n.fast };
  return BADGES.map((b) => ({ ...b, got: s.got[b.id] || null, have: b.need ? Math.min(b.need, progress[b.id] || 0) : null }));
}

export const badgeCount = () => Object.keys(read().got).length;
