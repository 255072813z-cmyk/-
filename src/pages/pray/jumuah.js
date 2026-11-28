// 主麻日：一周里最好的一天。列出主麻日的圣行（每条都有出处，编号已逐条核对），
// 星期五显示今天的晌礼时间，其他日子显示下一个主麻日还有几天；可以直接去读《山洞章》。
import { fmtHM, addDays } from '../../core/clock.js';
import { timesFor } from '../../core/prayer-times.js';
import { ICONS, star8 } from '../../ui/art.js';
import { t } from '../../i18n/index.js';
import { dateShort } from '../../i18n/format.js';

const ITEMS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];

export function jumuahPage(ctx) {
  const today = ctx.sched.today;
  const friday = today.wd === 5;
  const n = (5 - today.wd + 7) % 7 || 7; // 离下一个星期五几天
  const next = addDays(today, n);
  const dhuhr = fmtHM(friday ? ctx.sched.times.dhuhr : timesFor(ctx.city, next, ctx.offsets).dhuhr);
  const html = `
  <div class="page jm-page">
    <div class="page-head"><a class="back" href="#/pray" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('jm.title')} <span class="ar-sm" lang="ar" dir="rtl">الجُمُعَة</span></h1></div>
    <section class="card jm-hero ${friday ? 'is-today' : ''}">
      <p class="jm-sub">${t('jm.sub')}</p>
      <p class="jm-best">${t('jm.best')}</p>
      <p class="src">${t('common.source', { src: t('jm.bestSrc') })}</p>
      <p class="jm-when">${friday ? t('jm.todayLine', { time: dhuhr }) : t('jm.next', { date: dateShort(next), n })}</p>
      <a class="btn btn-primary btn-wide" href="#/quran/18">${ICONS.quran}${t('jm.kahf')}</a>
    </section>
    <h2 class="sec">${t('jm.secSunnah')}</h2>
    <ol class="jm-list">
      ${ITEMS.map(
        (k, i) => `<li class="card jm-item">
        <span class="jm-n" aria-hidden="true">${i + 1}</span>
        <div><h3 class="jm-t">${t('jm.' + k + 't')}</h3>
        <p>${t('jm.' + k)}</p>
        <p class="src">${t('common.source', { src: t('jm.' + k + 'src') })}</p></div>
      </li>`,
      ).join('')}
    </ol>
    <section class="card soft-card">
      <h2 class="card-title">${star8(16)} ${t('jm.whoT')}</h2>
      <p>${t('jm.who')}</p>
      <p class="src">${t('common.source', { src: t('jm.whoSrc') })}</p>
    </section>
  </div>`;
  return { html };
}
