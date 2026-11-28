// 生成"每日一节"的数据：从应用里已有的古兰经原文和出版译本里，按精选的经节摘出来（不另外翻译）。
// 用法：node scripts/build-daily-ayah.mjs  →  src/content/daily-ayah.js
// 精选原则：意思完整、不需要上下文就能读懂的劝勉、祈祷、慰藉的经节；太长的不选。
// 译文里译者加的长注释（括号里超过 80 个字）不放进卡片，点"读这一章"在阅读页能看到全文和注释。
import { writeFileSync } from 'node:fs';
import { SURAHS } from '../src/content/quran/meta.js';

const PICK = [
  '2:152', '2:153', '2:156', '2:186', '2:201', '2:286', '3:8', '3:31', '3:133', '3:139', '3:173', '3:200',
  '4:28', '6:162', '7:23', '7:55', '8:46', '9:51', '10:57', '12:87', '13:28', '14:7', '14:40', '15:99',
  '16:97', '16:128', '17:24', '17:80', '18:10', '18:46', '20:114', '21:87', '21:89', '22:77', '23:118',
  '25:63', '25:74', '28:24', '29:45', '29:69', '31:17', '33:41', '35:15', '39:10', '39:53', '40:60',
  '41:30', '42:19', '47:7', '49:10', '49:13', '50:16', '51:56', '55:13', '57:4', '59:10', '64:11',
  '65:2', '65:3', '66:8', '67:2', '87:14', '93:5', '94:5', '94:6', '103:2', '112:1',
];
const LANGS = ['zh', 'tg', 'ru', 'uz', 'ky'];
const part = (s) => SURAHS[s - 1].part;
const cache = {};
async function verse(lang, s, a) {
  const key = `${lang}-${part(s)}`;
  if (!cache[key]) cache[key] = (await import(`../src/content/quran/${key}.js`)).default;
  const v = cache[key][String(s)][a - 1];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`missing ${lang} ${s}:${a}`);
  return v;
}
// 去掉译者的长注释（括号里超过 80 个字），留下经文本身的译文
const clean = (x) => x.replace(/\s*[(（][^()（）]{80,}[)）]/g, '').replace(/\s+/g, ' ').trim();

const out = [];
for (const ref of PICK) {
  const [s, a] = ref.split(':').map(Number);
  const m = SURAHS[s - 1];
  // n：五种语言的章名（首页不用再下载整张章名表）
  const item = { s, a, ar: await verse('ar', s, a), t: {}, n: Object.fromEntries(LANGS.map((l) => [l, m[l] || m.ru])) };
  for (const l of LANGS) item.t[l] = clean(await verse(l, s, a));
  const longest = Math.max(...LANGS.map((l) => item.t[l].length));
  if (longest > 420) {
    console.log('太长，不选', ref, longest);
    continue;
  }
  out.push(item);
}
writeFileSync(
  new URL('../src/content/daily-ayah.js', import.meta.url),
  `// 自动生成：node scripts/build-daily-ayah.mjs。请勿手改：经文和译文摘自 src/content/quran/（与古兰经页同一个出版译本）。\nexport const DAILY_AYAHS = ${JSON.stringify(out)};\n`,
);
console.log('每日一节：', out.length, '节');
