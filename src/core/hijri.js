// 伊斯兰历（希吉拉历）
// 首选浏览器自带的乌姆古拉历法（Intl, islamic-umalqura）；老浏览器不支持时用算术历法推算。
// 两者都是天文/算术推算，塔吉克斯坦的实际日期以当地宗教机构宣布（见新月）为准，
// 因此设置里允许 ±1～2 天手动调整（hijriAdjust）。

export const HIJRI_MONTHS = [
  { zh: '穆哈兰姆月', ar: 'مُحَرَّم' },
  { zh: '色法尔月', ar: 'صَفَر' },
  { zh: '赖比尔·敖外鲁月', ar: 'رَبِيع الأَوَّل' },
  { zh: '赖比尔·阿赫尔月', ar: 'رَبِيع الآخِر' },
  { zh: '主马达·敖外鲁月', ar: 'جُمَادَى الأُولَى' },
  { zh: '主马达·阿赫尔月', ar: 'جُمَادَى الآخِرَة' },
  { zh: '赖哲卜月', ar: 'رَجَب' },
  { zh: '舍尔邦月', ar: 'شَعْبَان' },
  { zh: '赖买丹月（斋月）', ar: 'رَمَضَان' },
  { zh: '闪瓦鲁月', ar: 'شَوَّال' },
  { zh: '都尔喀尔德月', ar: 'ذُو القَعْدَة' },
  { zh: '都尔黑哲月', ar: 'ذُو الحِجَّة' },
];

let intlFmt = null;
try {
  const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  if (f.resolvedOptions().calendar === 'islamic-umalqura' && typeof f.formatToParts === 'function') intlFmt = f;
} catch (e) {
  intlFmt = null;
}

/** 算术伊斯兰历（民用历元），仅作后备 */
export function tabularHijri(date) {
  const jd = Math.floor(date.getTime() / 86400000 + 2440587.5 + 0.5);
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const m = Math.floor((24 * l) / 709);
  const d = l - Math.floor((709 * m) / 24);
  const y = 30 * n + j - 30;
  return { y, m, d };
}

/** 公历日期 {y,m,d} → 伊斯兰历 {y,m,d,source} */
export function toHijri(ymd, adjustDays = 0) {
  const date = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + (Number(adjustDays) || 0), 12));
  if (intlFmt) {
    const parts = {};
    for (const p of intlFmt.formatToParts(date)) parts[p.type] = p.value;
    const y = parseInt(parts.year || parts.relatedYear, 10);
    const m = parseInt(parts.month, 10);
    const d = parseInt(parts.day, 10);
    if (y && m && d) return { y, m, d, source: 'umalqura' };
  }
  return { ...tabularHijri(date), source: 'tabular' };
}
