// 斋月：每天的封斋/开斋时间与倒计时、封斋打卡（只存本机）、节日倒计时、整月时间表。
// 斋月之外打开：显示"斋月还有几天"，以及斋月第一天的时间作参考。
import { ramadanStatus, fastPhase, fastTimes, holidays, SAHUR_MARGIN_MIN } from '../../core/ramadan.js';
import { fmtHM, splitDuration, addDays } from '../../core/clock.js';
import { load, save } from '../../core/storage.js';
import { ramadanScene, star8 } from '../../ui/art.js';
import { reciteCard } from '../../ui/recite.js';
import { t } from '../../i18n/index.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const dateZh = (d) => `${d.y}年${d.m}月${d.d}日（周${WEEK[d.wd]}）`;

function dur(ms) {
  const { h, m, s } = splitDuration(ms);
  if (h > 0) return `<b>${h}</b><small>小时</small><b>${m}</b><small>分</small>`;
  return `<b>${m}</b><small>分</small><b>${String(s).padStart(2, '0')}</b><small>秒</small>`;
}

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

function fastCard(ctx, st) {
  const f = fastPhase(ctx.city, ctx.now, ctx.settings.offsets);
  const show = st.active ? f : { phase: 'preview', times: fastTimes(ctx.city, st.start, ctx.settings.offsets) };
  const tt = show.phase === 'after' ? show.tomorrow : show.times;
  const head = {
    before: '还可以吃封斋饭',
    fasting: '封斋中',
    after: '已开斋，愿真主接受',
    preview: `斋月第一天（${st.start.m}月${st.start.d}日）的时间`,
  }[show.phase];
  const countLabel = { before: '距停止吃喝还有', fasting: '距开斋还有', after: '距明天停止吃喝还有' }[show.phase];
  return `<section class="card fast-card">
    <p class="fast-phase">${head}</p>
    ${countLabel ? `<p class="hero-count">${countLabel} <span class="count" data-fast-count>${dur(show.target - ctx.now)}</span></p>` : ''}
    <div class="fast-times">
      <div class="fast-time ${show.phase === 'before' || show.phase === 'after' ? 'is-next' : ''}">
        <span class="ft-label">${show.phase === 'after' ? '明天' : ''}停止吃喝</span>
        <span class="ft-time">${fmtHM(tt.sahurEnd)}</span>
        <span class="ft-sub">黎明 ${fmtHM(tt.dawn)}</span>
      </div>
      <div class="fast-time ${show.phase === 'fasting' ? 'is-next' : ''}">
        <span class="ft-label">${show.phase === 'after' ? '明天' : ''}开斋</span>
        <span class="ft-time">${fmtHM(tt.iftar)}</span>
        <span class="ft-sub">日落</span>
      </div>
    </div>
    <p class="fast-note">封斋时间比天文黎明提前 ${SAHUR_MARGIN_MIN} 分钟，宁早勿晚。开斋按日落，当地清真寺习惯再等几分钟才宣礼。<b>以当地清真寺公布为准。</b></p>
    <details class="method"><summary>开斋时念</summary>${reciteCard({ k: 'iftarDua' })}</details>
  </section>`;
}

function daysGrid(st, today, log) {
  const n = 30;
  const cells = [];
  for (let d = 1; d <= n; d++) {
    const date = st.start ? addDays(st.start, d - 1) : null;
    const future = !st.active || d > st.day;
    const v = log[d];
    const cls = ['day', v === 'yes' ? 'is-yes' : v === 'no' ? 'is-no' : '', st.active && d === st.day ? 'is-today' : ''].join(' ');
    // 推算只有 29 天时，第 30 天是否封斋要看当地见月宣布
    const maybe = d > st.length;
    const lbl = v === 'yes' ? '封了' : v === 'no' ? '要补' : maybe ? '看新月' : date ? `${date.m}/${date.d}` : '';
    cells.push(
      `<button type="button" class="${cls}" data-day="${d}" ${future ? 'disabled' : ''} aria-label="斋月第 ${d} 天${v === 'yes' ? '，已封斋' : v === 'no' ? '，没封，要补' : ''}">${d}<small>${lbl}</small></button>`,
    );
  }
  return cells.join('');
}

export function ramadanPage(ctx) {
  const adj = ctx.settings.hijriAdjust;
  const today = ctx.sched.today;
  const st = ramadanStatus(today, adj);
  const hol = holidays(today, adj);
  const logKey = 'fast:' + st.year;
  const log = load(logKey, {});
  const f = fastPhase(ctx.city, ctx.now, ctx.settings.offsets);
  const iftarLit = st.active && f.phase === 'after';
  const todayYes = st.active && log[st.day] === 'yes';

  const table = (() => {
    if (!st.start) return '';
    const rows = [];
    for (let d = 1; d <= st.length; d++) {
      const date = addDays(st.start, d - 1);
      const tt = fastTimes(ctx.city, date, ctx.settings.offsets);
      rows.push(
        `<tr class="${st.active && d === st.day ? 'is-today' : ''}"><td>${d}</td><td>${date.m}月${date.d}日</td><td>${fmtHM(tt.sahurEnd)}</td><td>${fmtHM(tt.iftar)}</td></tr>`,
      );
    }
    return `<div class="ttable-wrap"><table class="ttable"><thead><tr><th>天</th><th>日期</th><th>停止吃喝</th><th>开斋</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  })();

  const holRow = (name, h) =>
    h
      ? `<div class="hol"><b>${name}</b><span class="hol-days">${h.inDays === 0 ? '就是今天' : '还有 ' + h.inDays + ' 天'}</span><span class="hol-date">推算 ${dateZh(h)}</span></div>`
      : '';

  const html = `
  <div class="page ramadan">
    <section class="ramadan-wrap">${ramadanScene({ iftar: iftarLit })}</section>
    <div class="r-status">
      <h1>${st.active ? `斋月第 ${st.day} 天` : `斋月还有 ${st.start ? st.start.inDays : '—'} 天`} <span class="ar-sm" lang="ar" dir="rtl">رَمَضَان</span></h1>
      <p>${st.active ? `伊斯兰历 ${st.year} 年赖买丹月 ${st.day} 日 · ${t('city.' + ctx.city.id)}` : `推算 ${st.start ? dateZh(st.start) : ''} 开始（伊斯兰历 ${st.year} 年）`}</p>
      <p class="local-note">日期为天文推算，实际以当地清真寺公布为准</p>
    </div>

    <div class="r-grid">
      <div>
        ${st.start ? fastCard(ctx, st) : ''}
        <section class="card">
          <h2 class="card-title">${star8(18)} 封斋记录</h2>
          ${
            st.active
              ? `<button type="button" class="btn ${todayYes ? 'btn-ghost checkin-btn is-done' : 'btn-primary checkin-btn'}" data-today>${todayYes ? '今天已记下：封了斋' : '今天封了斋，记一下'}</button>`
              : '<p class="note">斋月开始后，每天可以在这里记下。</p>'
          }
          <div class="days" data-days>${daysGrid(st, today, log)}</div>
          <div class="legend"><span><i class="ly"></i>封了</span><span><i class="ln"></i>没封，以后要补</span><span>点日期可以改</span></div>
          <p class="note">斋月 29 天还是 30 天，以当地见月宣布为准。</p>
          <p class="note">只是你自己的记录，存在这台手机上：不计分，不排名，不公开。生病、出远门等原因没封的日子，斋月后要补上；拿不准的请教当地伊玛目。</p>
        </section>
      </div>
      <div>
        <a class="card card-link r-link" href="#/ramadan/tarawih">
          <span class="r-link-t">间歇拜（泰拉威）</span><span class="r-link-s">宵礼之后 20 拜，每 2 拜一组，跟着做、记组数</span><span class="r-link-go">→</span></a>
        <a class="card card-link r-link" href="#/ramadan/quran">
          <span class="r-link-t">古兰经 30 天读完</span><span class="r-link-s">每天 1 卷（约 20 页），读完打勾</span><span class="r-link-go">→</span></a>
        <section class="card">
          <h2 class="card-title">${star8(18)} 节日</h2>
          ${holRow('开斋节', hol.fitr)}
          ${holRow('古尔邦节', hol.adha)}
          <p class="note">开斋节礼拜之前要交开斋捐（菲图尔），数额以当地宗教机构公布为准。节日日期为推算，以当地宣布为准。</p>
        </section>
        <section class="card soft-card">
          <h2 class="card-title">${star8(18)} 最后十天</h2>
          <p>先知说："你们在斋月最后十天的单数夜里寻求盖德尔夜。"</p>
          <p class="src">出处：布哈里 2017</p>
        </section>
        ${
          table
            ? `<details class="card fold"><summary>整个斋月的时间表（${t('city.' + ctx.city.id)}）</summary>${table}<p class="note">停止吃喝 = 黎明前 ${SAHUR_MARGIN_MIN} 分钟；开斋 = 日落。以当地清真寺公布为准。</p></details>`
            : ''
        }
      </div>
    </div>
  </div>`;

  function redrawDays(el) {
    const cur = load(logKey, {});
    el.querySelector('[data-days]').innerHTML = daysGrid(st, today, cur);
    bindDays(el);
    const b = el.querySelector('[data-today]');
    if (b) {
      const yes = cur[st.day] === 'yes';
      b.className = `btn ${yes ? 'btn-ghost checkin-btn is-done' : 'btn-primary checkin-btn'}`;
      b.textContent = yes ? '今天已记下：封了斋' : '今天封了斋，记一下';
    }
  }
  function bindDays(el) {
    el.querySelectorAll('[data-day]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const cur = load(logKey, {});
        const d = btn.dataset.day;
        cur[d] = cur[d] === 'yes' ? 'no' : cur[d] === 'no' ? undefined : 'yes';
        if (!cur[d]) delete cur[d];
        save(logKey, cur);
        redrawDays(el);
      }),
    );
  }

  let lastPhase = f.phase;
  return {
    html,
    mount(el) {
      bindDays(el);
      const b = el.querySelector('[data-today]');
      if (b)
        b.addEventListener('click', () => {
          const cur = load(logKey, {});
          if (cur[st.day] === 'yes') delete cur[st.day];
          else cur[st.day] = 'yes';
          save(logKey, cur);
          redrawDays(el);
        });
    },
    tick(c) {
      const node = document.querySelector('[data-fast-count]');
      if (!node || !st.active) return;
      const ff = fastPhase(c.city, c.now, c.settings.offsets);
      if (ff.phase !== lastPhase) {
        lastPhase = ff.phase;
        c.rerender();
        return;
      }
      node.innerHTML = dur(ff.target - c.now);
    },
  };
}

