// 念词卡片：阿拉伯文原文 + 译音 + 意思（当前语言）+ 出处
import { R, surah } from '../content/recitations.js';
import { t, L, TR } from '../i18n/index.js';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);

export function reciteCard(item) {
  if (item.surah) {
    const s = surah(item.surah);
    const ayahs = s.ayahs
      .map(
        (a) => `<div class="ayah">
          <p class="ar" lang="ar" dir="rtl">${a.ar} <span class="ayah-no">﴿${arNum(a.n)}﴾</span></p>
          <p class="tr" lang="${TR(a).lang}">${TR(a).text}</p>
          <p class="zh">${L(a)}</p></div>`,
      )
      .join('');
    return `<section class="recite recite-surah">
      <header class="recite-head"><span class="recite-name">${L(s.name)}</span><span class="ar-sm" lang="ar" dir="rtl">${s.nameAr}</span></header>
      ${ayahs}
      <p class="src">${t('common.source', { src: L(s.src) })}</p></section>`;
  }
  const r = R[item.k];
  if (!r) return '';
  const rep = item.repeat ? `<span class="repeat">${t('common.repeat', { n: item.repeat })}</span>` : '';
  const side = item.side ? `<span class="repeat">${t('side.' + item.side)}</span>` : '';
  return `<section class="recite">
    ${rep || side ? `<header class="recite-head">${side}${rep}</header>` : ''}
    <p class="ar" lang="ar" dir="rtl">${r.ar}</p>
    <p class="tr" lang="${TR(r).lang}">${TR(r).text}</p>
    <p class="zh">${L(r)}</p>
    <p class="src">${t('common.source', { src: L(r.src) })}</p></section>`;
}
