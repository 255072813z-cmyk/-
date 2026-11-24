// 首页上的斋月卡片（单独成模块，首页不必加载整个斋月页面）
import { ramadanStatus, fastPhase } from '../../core/ramadan.js';
import { fmtHM, splitDuration } from '../../core/clock.js';

/** 首页上用的斋月卡片：斋月中显示封斋/开斋倒计时（放在首页最上面），斋月前显示还有几天 */
export function homeRamadanCard(ctx) {
  const st = ramadanStatus(ctx.sched.today, ctx.settings.hijriAdjust);
  if (st.active) {
    const f = fastPhase(ctx.city, ctx.now, ctx.settings.offsets);
    const { h, m } = splitDuration(f.target - ctx.now);
    const left = h > 0 ? `还有 ${h} 小时 ${m} 分` : `还有 ${m} 分钟`;
    const line =
      f.phase === 'fasting'
        ? `封斋中 · ${fmtHM(f.times.iftar)} 开斋 · ${left}`
        : f.phase === 'before'
          ? `封斋饭请在 ${fmtHM(f.times.sahurEnd)} 前吃完 · ${left}`
          : `已开斋 · 明天 ${fmtHM(f.tomorrow.sahurEnd)} 前吃完封斋饭`;
    return `<a class="card card-link home-ramadan is-active" href="#/ramadan"><b>斋月第 ${st.day} 天</b><span>${line}</span><span class="hr-go">→</span></a>`;
  }
  if (!st.start || st.start.inDays > 120) return '';
  return `<a class="card card-link home-ramadan" href="#/ramadan"><b>斋月还有 ${st.start.inDays} 天</b><span>推算 ${st.start.m}月${st.start.d}日开始，以当地清真寺公布为准</span><span class="hr-go">→</span></a>`;
}

