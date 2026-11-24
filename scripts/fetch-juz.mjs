// 生成 30 卷（朱兹）的起始位置：卷号、起始章节、在麦地那标准本（604 页）中的起止页。
// 数据来源 alquran.cloud（Tanzil）。只在开发时运行：npm run juz
import { writeFileSync } from 'node:fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(p) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch('https://api.alquran.cloud/v1/' + p);
    if (r.ok) {
      const j = await r.json();
      if (j && j.data) return j.data;
    }
    await sleep(1500 * (i + 1)); // 被限流时等一等再试
  }
  throw new Error('获取失败：' + p);
}
const meta = await get('meta');
const names = Object.fromEntries(meta.surahs.references.map((s) => [s.number, { ar: s.name.replace(/^سُورَةُ\s*/, ''), en: s.englishName }]));
const juz = [];
for (let n = 1; n <= 30; n++) {
  const d = await get(`juz/${n}/quran-simple`);
  await sleep(300);
  const first = d.ayahs[0];
  const last = d.ayahs[d.ayahs.length - 1];
  juz.push({
    n,
    from: { surah: first.surah.number, ayah: first.numberInSurah },
    to: { surah: last.surah.number, ayah: last.numberInSurah },
    pages: [first.page, last.page],
  });
}
const used = new Set(juz.flatMap((j) => [j.from.surah, j.to.surah]));
const surahNames = Object.fromEntries([...used].sort((a, b) => a - b).map((n) => [n, names[n]]));
writeFileSync(
  new URL('../src/content/juz.js', import.meta.url),
  `// 自动生成：npm run juz（scripts/fetch-juz.mjs）。请勿手改。
// 30 卷的起止章节与页码；页码按麦地那标准本（604 页）。数据来源：Tanzil，经 alquran.cloud 获取。
export const JUZ = ${JSON.stringify(juz)};
export const SURAH_NAMES = ${JSON.stringify(surahNames)};
`,
);
console.log(juz.map((j) => `${j.n}:${j.pages.join('-')}`).join(' '));
