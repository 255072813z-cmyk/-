// 古兰经：按章下载原文和当前语言的译文（数据分 8 块，打开哪一章只下载那一块；手机应用里本来就在本机）。
// 记住读到哪一节、字号和是否显示译文，只存在这台手机上。
import { load, save } from './storage.js';
import { SURAHS } from '../content/quran/meta.js';

const TR_LANG = { tg: 'tg', ru: 'ru', zh: 'zh' };

export { SURAHS };
export const surah = (n) => SURAHS[n - 1] || null;

/** 读一章：{ ar: [...], tr: [...] }，第 k 节是下标 k-1 */
export async function loadSurah(n, lang) {
  const s = surah(n);
  if (!s) throw new Error('no surah ' + n);
  const tl = TR_LANG[lang] || 'ru';
  const { FILES } = await import('./quran-files.js');
  const get = async (l) => (await FILES[`../content/quran/${l}-${s.part}.js`]()).default[n];
  const [ar, tr] = await Promise.all([get('ar'), get(tl)]);
  return { ar, tr };
}

/** 阿拉伯-印度数字（经节号码用） */
export const arNum = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// ---- 读到哪里、读了多少（只存在这台手机上，不计分、不排名） ----
const okKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
const okPos = (r) => r && Number.isInteger(r.s) && Number.isInteger(r.a) && surah(r.s) && r.a >= 1 && r.a <= surah(r.s).ayahs;

/** 上次读到哪里：{ s, a, t }（t = 记下的时间） */
export function lastRead() {
  const r = load('qread', null);
  return okPos(r) ? { s: r.s, a: r.a, t: Number(r.t) || 0 } : null;
}
/** 记下读到的位置；同时更新"最近读过"（每章一条，最新的在前） */
export function setLastRead(s, a, now = Date.now()) {
  if (!okPos({ s, a })) return;
  save('qread', { s, a, t: now });
  const hist = recentRead().filter((h) => h.s !== s);
  save('qhist', [{ s, a, t: now }, ...hist].slice(0, 8));
}
export function recentRead() {
  const raw = load('qhist', []);
  return Array.isArray(raw) ? raw.filter(okPos).map((h) => ({ s: h.s, a: h.a, t: Number(h.t) || 0 })) : [];
}
/** 某一章上次读到第几节（没读过 = 0） */
export const lastInSurah = (s) => (recentRead().find((h) => h.s === s) || { a: 0 }).a;

function progMap() {
  const raw = load('qprog', {});
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw))
    for (const [k, v] of Object.entries(raw)) {
      const su = surah(Number(k));
      if (su && Number.isInteger(v) && v > 0) out[k] = Math.min(v, su.ayahs);
    }
  return out;
}
function dayMap() {
  const raw = load('qdays', {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw).filter(([k, v]) => okKey(k) && Number.isInteger(v) && v > 0)) : {};
}

/**
 * 读了一节（在屏幕上停留了一会儿）：同一天同一节只算一次。
 * 记下这一章读到的最远一节、今天读了几节。返回 { newly, surahDone }
 */
export function markRead(s, a, dayKey) {
  const su = surah(s);
  if (!su || !okKey(dayKey) || !(a >= 1 && a <= su.ayahs)) return { newly: false, surahDone: false };
  const prog = progMap();
  const before = prog[s] || 0;
  prog[s] = Math.max(before, a);
  save('qprog', prog);
  let today = load('qtoday', null);
  if (!today || today.d !== dayKey || !Array.isArray(today.k)) today = { d: dayKey, k: [] };
  const key = s + ':' + a;
  let newly = false;
  if (!today.k.includes(key) && today.k.length < 3000) {
    today.k.push(key);
    save('qtoday', today);
    const days = dayMap();
    days[dayKey] = (days[dayKey] || 0) + 1;
    const keys = Object.keys(days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete days[k];
    save('qdays', days);
    newly = true;
  }
  return { newly, surahDone: before < su.ayahs && prog[s] >= su.ayahs };
}

/** 某一章：读到的最远一节、一共几节、读完没有 */
export function surahProgress(s) {
  const su = surah(s);
  const max = progMap()[s] || 0;
  return { max, total: su ? su.ayahs : 0, done: !!su && max >= su.ayahs };
}
/** 全部：读到过的节数（按每章最远一节算）、读完的章数 */
export function allProgress() {
  const prog = progMap();
  const read = Object.values(prog).reduce((a, b) => a + b, 0);
  const done = SURAHS.filter((x) => (prog[x.n] || 0) >= x.ayahs).length;
  return { read, total: 6236, done };
}
/** 某天读了几节 */
export const readOn = (dayKey) => dayMap()[dayKey] || 0;
/** 最近 n 天（含今天）每天读了几节：[{ day, n }]，最早的在前 */
export function readDays(todayKey, n = 7) {
  const days = dayMap();
  const t0 = Date.parse(todayKey + 'T00:00:00Z');
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(t0 - (n - 1 - i) * 864e5).toISOString().slice(0, 10);
    return { day: d, n: days[d] || 0 };
  });
}

// ---- 书签 ----
export function bookmarks() {
  const raw = load('qmarks', []);
  return Array.isArray(raw) ? raw.filter(okPos).map((b) => ({ s: b.s, a: b.a, t: Number(b.t) || 0 })).sort((x, y) => y.t - x.t) : [];
}
export const isMarked = (s, a) => bookmarks().some((b) => b.s === s && b.a === a);
/** 加上或去掉书签；返回加上后是不是有书签 */
export function toggleBookmark(s, a, now = Date.now()) {
  if (!okPos({ s, a })) return false;
  const list = bookmarks();
  const has = list.some((b) => b.s === s && b.a === a);
  save('qmarks', has ? list.filter((b) => !(b.s === s && b.a === a)) : [{ s, a, t: now }, ...list].slice(0, 100));
  return !has;
}

/** "几天前"：0 今天、1 昨天…（按本地日期） */
export function daysAgo(t, now = Date.now()) {
  if (!t) return null;
  const day = (x) => Math.floor((x - new Date(x).getTimezoneOffset() * 60000) / 864e5);
  return Math.max(0, day(now) - day(t));
}

// ---- 阅读设置：阿拉伯文字号（0–3）、显示译文 ----
export function readPrefs() {
  const p = load('qprefs', null);
  return {
    size: p && Number.isInteger(p.size) && p.size >= 0 && p.size <= 3 ? p.size : 1,
    tr: !(p && p.tr === false),
  };
}
export function setReadPrefs(next) {
  save('qprefs', { ...readPrefs(), ...next });
}

/** 章目录搜索：编号、三种语言的章名、阿拉伯文章名（不看符号） */
const bare = (s) => String(s).replace(/[ؐ-ًؚ-ٰٟۖ-ۭـٱ]/g, (c) => (c === 'ٱ' ? 'ا' : '')).toLowerCase();
export function searchSurahs(q) {
  const k = bare(q.trim());
  if (!k) return SURAHS;
  if (/^\d+$/.test(k)) return SURAHS.filter((s) => String(s.n).startsWith(k));
  return SURAHS.filter((s) => [s.zh, s.ru, s.tg, s.ar].some((x) => bare(x).includes(k)));
}

/** 常念的章节（快捷入口）：开端章、宝座经、雅辛、国权，以及礼拜里常念的几章短章 */
export const COMMON = [
  { s: 1 },
  { s: 2, a: 255, key: 'kursi' },
  { s: 36 },
  { s: 67 },
  { s: 112 },
  { s: 113 },
  { s: 114 },
  { s: 103 },
  { s: 108 },
  { s: 110 },
];
