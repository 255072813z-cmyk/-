// 念词卡片：阿拉伯文原文 + 译音 + 中文意思 + 出处
import { R, surah } from '../content/recitations.js';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);

export function reciteCard(item) {
  if (item.surah) {
    const s = surah(item.surah);
    const ayahs = s.ayahs
      .map(
        (a) => `<div class="ayah">
          <p class="ar" lang="ar" dir="rtl">${a.ar} <span class="ayah-no">﴿${arNum(a.n)}﴾</span></p>
          <p class="tr" lang="en">${a.tr}</p>
          <p class="zh">${a.zh}</p></div>`,
      )
      .join('');
    return `<section class="recite recite-surah">
      <header class="recite-head"><span class="recite-name">${s.nameZh}</span><span class="ar-sm" lang="ar" dir="rtl">${s.nameAr}</span></header>
      ${ayahs}
      <p class="src">出处：${s.src}</p></section>`;
  }
  const r = R[item.k];
  if (!r) return '';
  const rep = item.repeat ? `<span class="repeat">念 ${item.repeat} 遍</span>` : '';
  const side = item.side ? `<span class="repeat">${item.side}</span>` : '';
  return `<section class="recite">
    ${rep || side ? `<header class="recite-head">${side}${rep}</header>` : ''}
    <p class="ar" lang="ar" dir="rtl">${r.ar}</p>
    <p class="tr" lang="en">${r.tr}</p>
    <p class="zh">${r.zh}</p>
    <p class="src">出处：${r.src}</p></section>`;
}
