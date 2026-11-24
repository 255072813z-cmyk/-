// 斋月：每天的封斋/开斋时间与倒计时、封斋打卡（只存本机）、节日倒计时、整月时间表。
// 斋月之外打开：显示"斋月还有几天"，以及斋月第一天的时间作参考。
import { ramadanStatus, fastPhase, fastTimes, holidays, SAHUR_MARGIN_MIN } from '../../core/ramadan.js';
import { fmtHM, addDays } from '../../core/clock.js';
import { load, save } from '../../core/storage.js';
import { ramadanScene, star8 } from '../../ui/art.js';
import { reciteCard } from '../../ui/recite.js';
import { t } from '../../i18n/index.js';
import { dateShort, durHTML, cityName } from '../../i18n/format.js';

const dur = (ms) => durHTML(ms, true);

export { homeRamadanCard } from './card.js';

function fastCard(ctx, st) {
  const f = fastPhase(ctx.city, ctx.now, ctx.offsets);
  const show = st.active ? f : { phase: 'preview', times: fastTimes(ctx.city, st.start, ctx.offsets) };
  const tt = show.phase === 'after' ? show.tomorrow : show.times;
  const head = t('fast.head.' + show.phase, { date: dateShort(st.start) });
  const countLabel = show.phase === 'preview' ? '' : t('fast.count.' + show.phase);
  const tomorrow = show.phase === 'after' ? t('home.tomorrow') + ' ' : '';
  return `<section class="card fast-card">
    <p class="fast-phase">${head}</p>
    ${countLabel ? `<p class="hero-count">${countLabel} <span class="count" data-fast-count>${dur(show.target - ctx.now)}</span></p>` : ''}
    <div class="fast-times">
      <div class="fast-time ${show.phase === 'before' || show.phase === 'after' ? 'is-next' : ''}">
        <span class="ft-label">${tomorrow}${t('fast.sahurEnd')}</span>
        <span class="ft-time">${fmtHM(tt.sahurEnd)}</span>
        <span class="ft-sub">${t('fast.dawn', { time: fmtHM(tt.dawn) })}</span>
      </div>
      <div class="fast-time ${show.phase === 'fasting' ? 'is-next' : ''}">
        <span class="ft-label">${tomorrow}${t('fast.iftar')}</span>
        <span class="ft-time">${fmtHM(tt.iftar)}</span>
        <span class="ft-sub">${t('prayer.sunset')}</span>
      </div>
    </div>
    <p class="fast-note">${t('fast.note', { n: SAHUR_MARGIN_MIN })}</p>
    <details class="method"><summary>${t('fast.iftarDua')}</summary>${reciteCard({ k: 'iftarDua' })}</details>
  </section>`;
}

function daysGrid(st, log) {
  const cells = [];
  for (let d = 1; d <= 30; d++) {
    const date = st.start ? addDays(st.start, d - 1) : null;
    const future = !st.active || d > st.day;
    const v = log[d];
    const cls = ['day', v === 'yes' ? 'is-yes' : v === 'no' ? 'is-no' : '', st.active && d === st.day ? 'is-today' : ''].join(' ');
    // 推算只有 29 天时，第 30 天是否封斋要看当地见月宣布
    const maybe = d > st.length;
    const lbl = v === 'yes' ? t('fast.yes') : v === 'no' ? t('fast.no') : maybe ? t('fast.moon') : date ? `${date.m}/${date.d}` : '';
    const aria = t('fast.dayAria', { d }) + (v === 'yes' ? t('fast.dayAriaYes') : v === 'no' ? t('fast.dayAriaNo') : '');
    cells.push(`<button type="button" class="${cls}" data-day="${d}" ${future ? 'disabled' : ''} aria-label="${aria}">${d}<small>${lbl}</small></button>`);
  }
  return cells.join('');
}

export function ramadanPage(ctx) {
  const adj = ctx.hijriAdjust;
  const today = ctx.sched.today;
  const st = ramadanStatus(today, adj);
  const hol = holidays(today, adj);
  const logKey = 'fast:' + st.year;
  const log = load(logKey, {});
  const f = fastPhase(ctx.city, ctx.now, ctx.offsets);
  const iftarLit = st.active && f.phase === 'after';
  const todayYes = st.active && log[st.day] === 'yes';
  const city = cityName(ctx.city);

  const table = (() => {
    if (!st.start) return '';
    const rows = [];
    for (let d = 1; d <= st.length; d++) {
      const date = addDays(st.start, d - 1);
      const tt = fastTimes(ctx.city, date, ctx.offsets);
      rows.push(
        `<tr class="${st.active && d === st.day ? 'is-today' : ''}"><td>${d}</td><td>${date.m}/${date.d}</td><td>${fmtHM(tt.sahurEnd)}</td><td>${fmtHM(tt.iftar)}</td></tr>`,
      );
    }
    return `<div class="ttable-wrap"><table class="ttable"><thead><tr><th>${t('fast.colDay')}</th><th>${t('fast.colDate')}</th><th>${t('fast.sahurEnd')}</th><th>${t('fast.iftar')}</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  })();

  const holRow = (key, h) =>
    h
      ? `<div class="hol"><b>${t(key)}</b><span class="hol-days">${h.inDays === 0 ? t('fast.holToday') : t('fast.holIn', { n: h.inDays })}</span><span class="hol-date">${t('fast.estimated', { date: dateShort(h) })}</span></div>`
      : '';
  const checkLabel = (yes) => (yes ? t('fast.checkedToday') : t('fast.checkToday'));

  const html = `
  <div class="page ramadan">
    <section class="ramadan-wrap">${ramadanScene({ iftar: iftarLit })}</section>
    <div class="r-status">
      <h1>${st.active ? t('fast.dayN', { n: st.day }) : t('fast.daysLeft', { n: st.start ? st.start.inDays : '—' })} <span class="ar-sm" lang="ar" dir="rtl">رَمَضَان</span></h1>
      <p>${st.active ? t('fast.hijriToday', { y: st.year, d: st.day, city }) : t('fast.startsOn', { date: st.start ? dateShort(st.start) : '', y: st.year })}</p>
      <p class="local-note">${t('fast.datesNote')}</p>
    </div>

    <div class="r-grid">
      <div>
        ${st.start ? fastCard(ctx, st) : ''}
        <section class="card">
          <h2 class="card-title">${star8(18)} ${t('fast.logTitle')}</h2>
          ${
            st.active
              ? `<button type="button" class="btn ${todayYes ? 'btn-ghost checkin-btn is-done' : 'btn-primary checkin-btn'}" data-today>${checkLabel(todayYes)}</button>`
              : `<p class="note">${t('fast.logLater')}</p>`
          }
          <div class="days" data-days>${daysGrid(st, log)}</div>
          <div class="legend"><span><i class="ly"></i>${t('fast.yes')}</span><span><i class="ln"></i>${t('fast.legendNo')}</span><span>${t('fast.legendEdit')}</span></div>
          <p class="note">${t('fast.length')}</p>
          <p class="note">${t('fast.private')}</p>
        </section>
      </div>
      <div>
        <a class="card card-link r-link" href="#/ramadan/tarawih">
          <span class="r-link-t">${t('tarawih.title')}</span><span class="r-link-s">${t('fast.tarawihSub')}</span><span class="r-link-go">→</span></a>
        <a class="card card-link r-link" href="#/ramadan/quran">
          <span class="r-link-t">${t('quran.title')}</span><span class="r-link-s">${t('fast.quranSub')}</span><span class="r-link-go">→</span></a>
        <section class="card">
          <h2 class="card-title">${star8(18)} ${t('fast.holidays')}</h2>
          ${holRow('fast.fitr', hol.fitr)}
          ${holRow('fast.adha', hol.adha)}
          <p class="note">${t('fast.fitrNote')}</p>
        </section>
        <section class="card soft-card">
          <h2 class="card-title">${star8(18)} ${t('fast.lastTen')}</h2>
          <p>${t('fast.lastTenText')}</p>
          <p class="src">${t('common.source', { src: t('fast.lastTenSrc') })}</p>
        </section>
        ${
          table
            ? `<details class="card fold"><summary>${t('fast.tableTitle', { city })}</summary>${table}<p class="note">${t('fast.tableNote', { n: SAHUR_MARGIN_MIN })}</p></details>`
            : ''
        }
      </div>
    </div>
  </div>`;

  function redrawDays(el) {
    const cur = load(logKey, {});
    el.querySelector('[data-days]').innerHTML = daysGrid(st, cur);
    bindDays(el);
    const b = el.querySelector('[data-today]');
    if (b) {
      const yes = cur[st.day] === 'yes';
      b.className = `btn ${yes ? 'btn-ghost checkin-btn is-done' : 'btn-primary checkin-btn'}`;
      b.textContent = checkLabel(yes);
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
      const ff = fastPhase(c.city, c.now, c.offsets);
      if (ff.phase !== lastPhase) {
        lastPhase = ff.phase;
        c.rerender();
        return;
      }
      node.innerHTML = dur(ff.target - c.now);
    },
  };
}
