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

// ---- 读到哪里 ----
export function lastRead() {
  const r = load('qread', null);
  if (!r || !Number.isInteger(r.s) || !Number.isInteger(r.a)) return null;
  const s = surah(r.s);
  return s && r.a >= 1 && r.a <= s.ayahs ? { s: r.s, a: r.a } : null;
}
export function setLastRead(s, a) {
  save('qread', { s, a });
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
