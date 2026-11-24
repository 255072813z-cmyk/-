// 本月时间表：一整个月的五番拜时间，可以分享给家人（发到 Telegram、WhatsApp 等）或打印贴在墙上。
// 老人常常习惯看纸质的时间表；分享只用手机自带的分享功能，不经过我们的服务器。
import { timesFor, PRAYERS } from '../core/prayer-times.js';
import { fmtHM, addDays, ymdKey } from '../core/clock.js';
import { ICONS, star8 } from '../ui/art.js';
import { t } from '../i18n/index.js';
import { cityName } from '../i18n/format.js';

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** 某天的分享文字 */
export function dayText(ctx, ymd) {
  const T = timesFor(ctx.city, ymd, ctx.offsets);
  const lines = [`${cityName(ctx.city)} · ${t('date.short', { y: ymd.y, m: ymd.m, d: ymd.d, month: t('month.' + ymd.m), wd: t('weekShort.' + ymd.wd) })}`];
  for (const p of PRAYERS) {
    lines.push(`${t('prayer.' + p)} ${fmtHM(T[p])}`);
    if (p === 'fajr') lines.push(`${t('prayer.sunrise')} ${fmtHM(T.sunrise)}`);
  }
  lines.push(ctx.official ? t('times.shareNoteOfficial') : t('times.shareNote'));
  return lines.join('\n');
}

/** 用手机的分享功能；不支持时复制到剪贴板。返回 'shared' | 'copied' | 'failed' */
export async function shareText(text) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancel';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    return 'failed';
  }
}

export function timesPage(ctx, offset = 0) {
  const today = ctx.sched.today;
  let y = today.y;
  let m = today.m + (Number(offset) || 0);
  while (m > 12) (m -= 12), y++;
  while (m < 1) (m += 12), y--;
  const n = daysIn(y, m);
  const rows = [];
  for (let d = 1; d <= n; d++) {
    const ymd = addDays({ y, m, d }, 0);
    const T = timesFor(ctx.city, ymd, ctx.offsets);
    const isToday = ymdKey(ymd) === ymdKey(today);
    rows.push(`<tr class="${isToday ? 'is-today' : ''} ${ymd.wd === 5 ? 'is-fri' : ''}">
      <th scope="row">${d} <small>${t('weekShort.' + ymd.wd)}</small></th>
      <td>${fmtHM(T.fajr)}</td><td class="sun">${fmtHM(T.sunrise)}</td><td>${fmtHM(T.dhuhr)}</td><td>${fmtHM(T.asr)}</td><td>${fmtHM(T.maghrib)}</td><td>${fmtHM(T.isha)}</td></tr>`);
  }
  const off = Number(offset) || 0;
  const html = `
  <div class="page times-page">
    <div class="page-head"><a class="back" href="#/" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('times.title')}</h1></div>
    <p class="times-sub">${cityName(ctx.city)} · ${t('times.month', { y, month: t('monthName.' + m) })}</p>
    <div class="times-nav no-print">
      <a class="btn btn-ghost btn-sm" href="#/times/${off - 1}">← ${t('times.prev')}</a>
      ${off ? `<a class="btn btn-ghost btn-sm" href="#/times">${t('times.thisMonth')}</a>` : ''}
      <a class="btn btn-ghost btn-sm" href="#/times/${off + 1}">${t('times.next')} →</a>
    </div>
    <section class="card times-card">
      <table class="times-table">
        <thead><tr><th scope="col">${t('fast.colDay')}</th>${PRAYERS.flatMap((p) => (p === 'fajr' ? [p, 'sunrise'] : [p]))
          .map((p) => `<th scope="col" class="${p === 'sunrise' ? 'sun' : ''}">${t('prayer.' + p)}</th>`)
          .join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <p class="note">${ctx.official ? t('times.noteOfficial') : t('times.note')}</p>
    </section>
    <div class="step-btns no-print">
      <button type="button" class="btn btn-primary" data-share-today>${t('times.shareToday')}</button>
      <button type="button" class="btn btn-ghost" data-print>${t('times.print')}</button>
    </div>
    <p class="note center" data-share-msg aria-live="polite"></p>
  </div>`;
  return {
    html,
    mount(el) {
      const msg = el.querySelector('[data-share-msg]');
      el.querySelector('[data-share-today]').addEventListener('click', async () => {
        const r = await shareText(dayText(ctx, today));
        msg.textContent = r === 'copied' ? t('times.copied') : r === 'failed' ? t('times.shareFailed') : '';
      });
      el.querySelector('[data-print]').addEventListener('click', () => window.print());
      const cur = el.querySelector('.is-today');
      if (cur && !off) cur.scrollIntoView({ block: 'center' });
    },
  };
}
