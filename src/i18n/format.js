// 日期、时长的显示格式（按当前语言，格式写在语言文件里）
import { t } from './index.js';
import { HIJRI_MONTHS } from '../core/hijri.js';
import { splitDuration } from '../core/clock.js';

/** 公历日期：2026年12月18日 星期五 */
export function dateLine(d) {
  return t('date.full', { y: d.y, m: d.m, d: d.d, month: t('month.' + d.m), wd: t('week.' + d.wd) });
}

/** 公历短日期：12月18日（周五） */
export function dateShort(d) {
  return t('date.short', { y: d.y, m: d.m, d: d.d, month: t('month.' + d.m), wd: t('weekShort.' + d.wd) });
}

/** 伊斯兰历：伊斯兰历 1448 年 赖哲卜月 9 日 + 阿拉伯文月名 */
export function hijriLine(h) {
  return `${t('hijri.date', { y: h.y, month: t('hijri.month.' + h.m), d: h.d })}<span class="date-ar" lang="ar" dir="rtl">${HIJRI_MONTHS[h.m - 1].ar}</span>`;
}

/** 倒计时（HTML，数字加粗）：2 小时 13 分 / 42 分钟 / 6 分 59 秒 */
export function durHTML(ms, withSeconds = true) {
  const { h, m, s } = splitDuration(ms);
  if (h > 0) return `<b>${h}</b><small>${t('dur.h')}</small><b>${m}</b><small>${t('dur.m')}</small>`;
  if (m >= 10 || !withSeconds) return `<b>${m}</b><small>${t('dur.min')}</small>`;
  return `<b>${m}</b><small>${t('dur.m')}</small><b>${String(s).padStart(2, '0')}</b><small>${t('dur.s')}</small>`;
}

/** 倒计时（纯文字）：2 小时 13 分 / 13 分钟 */
export function durText(ms) {
  const { h, m } = splitDuration(ms);
  return h > 0 ? t('dur.textHM', { h, m }) : t('dur.textM', { m });
}

/** 城市名："我的位置"在某城市附近时显示为"我的位置（杜尚别附近）"，离得远就只写"我的位置" */
export function cityName(city) {
  if (!city) return '';
  if (city.id === 'here') return city.nearKm > 150 ? t('city.here') : t('city.hereNear', { name: t('city.' + city.near) });
  return t('city.' + city.id);
}
