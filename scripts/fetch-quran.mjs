// 从 alquran.cloud 取古兰经原文（Tanzil 标准本 quran-simple）和马坚中文译本，生成 src/content/quran.js。
// 只在开发时运行一次：npm run quran（需要联网）。生成后请人工核对，不要手改生成的经文。
import { writeFileSync } from 'node:fs';

const SURAHS = [1, 103, 108, 112, 113];
// 阿拉伯文的符号（开口、叠音等）在不同数据里存储顺序可能不同，比较时先去掉符号只看字母
const bare = (s) => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\uFEFF]/g, '');
/** 去掉开头若干个"词"，按字母比较 */
function dropLeadingWords(text, wordsBare) {
  const words = text.split(/\s+/);
  const head = words.slice(0, wordsBare.length).map(bare);
  return head.join(' ') === wordsBare.join(' ') ? words.slice(wordsBare.length).join(' ') : text;
}
const BASMALA_BARE = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

// 马坚译文在数据源里有少量多余空格、半角标点和繁体字，这里只做排版清理，不改动词句
const tidyZh = (s) =>
  s
    .replace(/[　\s]+/g, '')
    .replace(/,/g, '，')
    .replace(/;/g, '；')
    .replace(/:/g, '：')
    .replace(/後/g, '后')
    .replace(/^\.+/, '');

async function get(path) {
  const r = await fetch('https://api.alquran.cloud/v1/' + path);
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return (await r.json()).data;
}

const out = {};
for (const n of SURAHS) {
  const [ar, zh] = await Promise.all([get(`surah/${n}/quran-simple`), get(`surah/${n}/zh.jian`)]);
  out[n] = {
    number: n,
    nameAr: ar.name.replace(/^سُورَةُ\s*/, ''),
    ayahs: ar.ayahs.map((a, i) => {
      let text = a.text.replace(/^﻿/, '').trim();
      // 第 1 章的第 1 节就是太斯米；其余各章的数据源把太斯米并在第 1 节开头，这里去掉
      if (n !== 1 && i === 0) {
        const t2 = dropLeadingWords(text, BASMALA_BARE);
        if (t2 === text) throw new Error('第 ' + n + ' 章开头没有找到太斯米，请人工检查');
        text = t2;
      }
      return { n: a.numberInSurah, ar: text, zh: tidyZh(zh.ayahs[i].text) };
    }),
  };
}
const [a201, z201] = await Promise.all([get('ayah/2:201/quran-simple'), get('ayah/2:201/zh.jian')]);
// 2:201 作为祈祷词时只念"我们的主啊……"一句，去掉经文开头的"他们中有人说"
const dua = dropLeadingWords(a201.text.trim(), ['ومنهم', 'من', 'يقول']);
if (!bare(dua).startsWith('ربنا')) throw new Error('2:201 处理失败');
const duaZh = tidyZh(z201.text).replace(/^.*?(我们的主啊)/, '$1');

const file = `// 自动生成：npm run quran（scripts/fetch-quran.mjs）。请勿手改经文。
// 阿拉伯文：Tanzil 古兰经标准文本（quran-simple），经 alquran.cloud 获取。
// 中文：马坚译本（中国社会科学出版社，1981），经 alquran.cloud 获取，仅做标点排版清理。
export const SURAHS = ${JSON.stringify(out, null, 2)};

export const RABBANA_201 = ${JSON.stringify({ ar: dua, zh: duaZh })};
`;
writeFileSync(new URL('../src/content/quran.js', import.meta.url), file);
console.log('ok', Object.keys(out).join(','));
