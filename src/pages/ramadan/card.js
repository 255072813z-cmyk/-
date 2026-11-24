// 首页上的斋月卡片（单独成模块，首页不必加载整个斋月页面）
import { ramadanStatus, fastPhase } from '../../core/ramadan.js';
import { fmtHM, ymdKey } from '../../core/clock.js';
import { fastLog } from '../../core/fasting.js';
import { t } from '../../i18n/index.js';
import { durText, dateShort } from '../../i18n/format.js';

/** 首页上用的斋月卡片：斋月中、或平时记了"今天我在封斋"时，显示封斋/开斋倒计时；斋月前显示还有几天 */
export function homeRamadanCard(ctx) {
  const st = ramadanStatus(ctx.sched.today, ctx.hijriAdjust);
  if (st.active) {
    const f = fastPhase(ctx.city, ctx.now, ctx.offsets);
    const left = t('card.left', { dur: durText(f.target - ctx.now) });
    const line =
      f.phase === 'fasting'
        ? t('card.fasting', { time: fmtHM(f.times.iftar), left })
        : f.phase === 'before'
          ? t('card.before', { time: fmtHM(f.times.sahurEnd), left })
          : t('card.after', { time: fmtHM(f.tomorrow.sahurEnd) });
    return `<a class="card card-link home-ramadan is-active" href="#/ramadan"><b>${t('fast.dayN', { n: st.day })}</b><span>${line}</span><span class="hr-go">→</span></a>`;
  }
  // 平时封副功斋、补斋的日子：开斋前在首页显示开斋时间
  if (fastLog()[ymdKey(ctx.sched.today)]) {
    const f = fastPhase(ctx.city, ctx.now, ctx.offsets);
    if (f.phase !== 'after') {
      const left = t('card.left', { dur: durText(f.target - ctx.now) });
      const line = f.phase === 'fasting' ? t('card.fasting', { time: fmtHM(f.times.iftar), left }) : t('card.before', { time: fmtHM(f.times.sahurEnd), left });
      return `<a class="card card-link home-ramadan is-active" href="#/ramadan"><b>${t('vf.homeFasting')}</b><span>${line}</span><span class="hr-go">→</span></a>`;
    }
  }
  if (!st.start || st.start.inDays > 120) return '';
  return `<a class="card card-link home-ramadan" href="#/ramadan"><b>${t('fast.daysLeft', { n: st.start.inDays })}</b><span>${t('card.startsOn', { date: dateShort(st.start) })}</span><span class="hr-go">→</span></a>`;
}

