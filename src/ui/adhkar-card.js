// 早晚记念的入口卡片：首页（早晨、傍晚该念的时候才出现，念完就收起）和"礼拜"页（一直在）
import { adhkarPart, adhkarProgress, ADHKAR_TOTAL } from '../core/adhkar.js';
import { ymdKey } from '../core/clock.js';
import { ICONS } from './art.js';
import { t } from '../i18n/index.js';

/** always：礼拜页一直显示；首页只在晨礼到晌礼、晡礼之后显示，念完就不显示 */
export function adhkarCard(ctx, always = false) {
  const s = ctx.sched;
  const part = adhkarPart(s, ctx.now);
  const day = ymdKey(s.today);
  const n = adhkarProgress(day, part).done.length;
  const total = ADHKAR_TOTAL[part];
  if (!always) {
    const T = s.times;
    const inTime = part === 'm' ? ctx.now >= T.fajr && ctx.now < T.dhuhr : ctx.now >= T.asr;
    if (!inTime || n >= total) return '';
  }
  const pct = Math.round((100 * n) / total);
  return `<a class="card card-link dk-link ${n >= total ? 'is-done' : ''}" href="#/adhkar/${part === 'm' ? 'morning' : 'evening'}">
    <span class="tool-ico">${ICONS.adhkar}</span>
    <span class="dk-link-t">${t(part === 'm' ? 'adhkar.homeM' : 'adhkar.homeE')}</span>
    <span class="dk-link-s">${n >= total ? t(part === 'm' ? 'adhkar.allDoneM' : 'adhkar.allDoneE') : t('adhkar.homeSub', { a: n, b: total })}</span>
    <span class="q-bar thin" aria-hidden="true"><i style="width:${pct}%"></i></span>
    <span class="r-link-go" aria-hidden="true">→</span>
  </a>`;
}
