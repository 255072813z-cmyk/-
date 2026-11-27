// 斋月以外的"封斋"页：全年都能用。
// - 今天：是不是圣行斋日、能不能封（两个节日和晒肉日不封）；封斋饭截止和开斋时间；"今天我在封斋"（副功斋/补斋），在封斋时显示开斋倒计时
// - 明天也封斋：排封斋饭和开斋提醒
// - 补斋：还要补几天，上一个斋月记了"没封"的可以一键加进来
// - 近期的圣行斋日（可设提醒）、下一个阿拉法日和阿舒拉日、依据
// - 斋月倒计时和第一天的时间、两个节日
import { fastPhase, fastTimes, holidays, SAHUR_MARGIN_MIN } from '../../core/ramadan.js';
import { fmtHM, addDays, ymdKey } from '../../core/clock.js';
import { toHijri } from '../../core/hijri.js';
import { forbiddenDay, sunnahReasons, upcomingSunnah, fastLog, setFast, oweDays, addOwe, ramadanMissed, importMissed, fastPlan, togglePlan, yearCount } from '../../core/fasting.js';
import { award } from '../../core/badges.js';
import { cheer } from '../../ui/cheer.js';
import { setCount } from '../../ui/motion.js';
import { star8 } from '../../ui/art.js';
import { ramadanScene } from '../../ui/art-scenes.js';
import { t } from '../../i18n/index.js';
import { dateShort, durHTML, cityName, hijriLine } from '../../i18n/format.js';

const why = (reasons) => reasons.map((r) => t('vf.r.' + r)).join(' · ');
const inDays = (n) => (n === 0 ? t('vf.in0') : n === 1 ? t('vf.in1') : t('vf.inN', { n }));

export function fastingPage(ctx, st) {
  const adj = ctx.hijriAdjust;
  const today = ctx.sched.today;
  const todayKey = ymdKey(today);
  const tomorrow = addDays(today, 1);
  const tomorrowKey = ymdKey(tomorrow);
  const city = cityName(ctx.city);
  const h = toHijri(today, adj);
  const lastRamadan = h.m > 9 ? h.y : h.y - 1;
  const hol = holidays(today, adj);

  // ---- 今天 ----
  function todayCard() {
    const forbid = forbiddenDay(today, adj);
    if (forbid)
      return `<section class="card fast-card vf-forbid" data-vf-today>
        <p class="fast-phase">${t('vf.forbid.' + forbid)}</p>
        <p>${t('vf.forbidText')}</p>
        <p class="src">${t('common.source', { src: t('vf.forbidSrc') })}</p>
      </section>`;
    const f = fastPhase(ctx.city, ctx.now, ctx.offsets);
    const kind = fastLog()[todayKey] || null;
    const reasons = sunnahReasons(today, adj);
    const after = f.phase === 'after';
    const tt = after ? f.tomorrow : f.times;
    const tmForbid = forbiddenDay(tomorrow, adj);
    const tmReasons = sunnahReasons(tomorrow, adj);
    const planned = fastPlan(todayKey).includes(tomorrowKey);
    const count = kind && !after ? `<p class="hero-count">${t('fast.count.' + f.phase)} <span class="count" data-vf-count>${durHTML(f.target - ctx.now, true)}</span></p>` : '';
    return `<section class="card fast-card ${kind ? 'is-fasting' : ''}" data-vf-today>
      ${reasons.length ? `<p class="vf-sunnah">${star8(16)} ${t('vf.sunnahToday', { why: why(reasons) })}</p>` : ''}
      ${kind ? `<p class="fast-phase">${after ? t('fast.head.after') : t('fast.head.' + f.phase)}</p>` : ''}
      ${count}
      ${
        kind
          ? `<div class="vf-kind" role="group" aria-label="${t('vf.kind')}"><span>${t('vf.kind')}</span>
              ${['nafl', 'qada'].map((k) => `<button type="button" class="seg ${kind === k ? 'is-on' : ''}" data-vf-kind="${k}" aria-pressed="${kind === k}">${t('vf.kind.' + k)}</button>`).join('')}</div>
             <button type="button" class="btn btn-ghost btn-sm" data-vf-cancel>${t('vf.cancel')}</button>`
          : `<button type="button" class="btn btn-primary btn-wide checkin-btn" data-vf-fast>${after ? t('vf.didFast') : t('vf.imFasting')}</button>`
      }
      <p class="vf-times-h">${after ? t('vf.tomorrowTimes', { city }) : t('vf.todayTimes', { city })}</p>
      <div class="fast-times">
        <div class="fast-time"><span class="ft-label">${t('fast.sahurEnd')}</span><span class="ft-time">${fmtHM(tt.sahurEnd)}</span><span class="ft-sub">${t('fast.dawn', { time: fmtHM(tt.dawn) })}</span></div>
        <div class="fast-time ${kind && !after ? 'is-next' : ''}"><span class="ft-label">${t('fast.iftar')}</span><span class="ft-time">${fmtHM(tt.iftar)}</span><span class="ft-sub">${t('prayer.sunset')}</span></div>
      </div>
      ${
        tmForbid || toHijri(tomorrow, adj).m === 9
          ? ''
          : `<button type="button" class="btn ${planned ? 'btn-ghost is-done' : 'btn-ghost'} btn-wide vf-plan" data-vf-plan="${tomorrowKey}" aria-pressed="${planned}">${planned ? t('vf.plannedTomorrow') : t('vf.planTomorrow')}${tmReasons.length ? ` <small>(${why(tmReasons)})</small>` : ''}</button>`
      }
      <p class="note">${t('vf.niyyah')}</p>
      <p class="fast-note">${t('fast.note', { n: SAHUR_MARGIN_MIN })}</p>
    </section>`;
  }

  // ---- 补斋 ----
  function qadaCard() {
    const owe = oweDays();
    const missed = ramadanMissed(lastRamadan);
    return `<section class="card" data-vf-qada>
      <h2 class="card-title">${star8(18)} ${t('vf.qadaTitle')}</h2>
      <div class="vf-owe">
        <button type="button" class="btn-round" data-vf-owe="-1" aria-label="${t('vf.less')}" ${owe ? '' : 'disabled'}>−</button>
        <p class="lead" data-vf-owe-n>${owe ? t('vf.owe', { n: owe }) : t('vf.oweNone')}</p>
        <button type="button" class="btn-round" data-vf-owe="1" aria-label="${t('vf.more')}">+</button>
      </div>
      ${missed ? `<button type="button" class="btn btn-ghost btn-sm" data-vf-import>${t('vf.import', { n: missed })}</button>` : ''}
      <p class="note">${t('vf.qadaNote')}</p>
    </section>`;
  }

  function yearCard() {
    const c = yearCount(today.y);
    return `<section class="card" data-vf-year>
      <h2 class="card-title">${star8(18)} ${t('vf.yearTitle')}</h2>
      <p>${c.nafl || c.qada ? t('vf.year', { y: today.y, a: c.nafl, b: c.qada }) : t('vf.yearNone')}</p>
      <p class="note">${t('fast.private')}</p>
    </section>`;
  }

  // ---- 近期的圣行斋日 ----
  function upcomingCard() {
    const { list, special } = upcomingSunnah(addDays(today, 1), adj, 21);
    const plan = new Set(fastPlan(todayKey));
    const rows = list.slice(0, 7).map((d) => {
      const on = plan.has(d.key);
      return `<li class="vf-day"><span class="vf-date"><b>${dateShort(d)}</b><small>${inDays(d.inDays + 1)}</small></span>
        <span class="vf-why">${why(d.reasons)}</span>
        <button type="button" class="btn btn-ghost btn-sm ${on ? 'is-done' : ''}" data-vf-plan="${d.key}" aria-pressed="${on}">${on ? t('vf.reminded') : t('vf.remind')}</button></li>`;
    });
    const sp = special
      .map((d) => `<p class="vf-special"><b>${t('vf.nextSpecial', { name: t('vf.r.' + d.id), date: dateShort(d), n: d.inDays + 1 })}</b> ${t(d.id === 'ashura' ? 'vf.ashuraNote' : 'vf.arafahNote')}</p>`)
      .join('');
    return `<section class="card" data-vf-up>
      <h2 class="card-title">${star8(18)} ${t('vf.upTitle')}</h2>
      <ul class="vf-days">${rows.join('')}</ul>
      ${sp}
      <details class="method"><summary>${t('vf.whyTitle')}</summary>
        <ul class="dots">${['monthu', 'white', 'shawwal', 'arafah', 'ashura'].map((k) => `<li>${t('vf.src.' + k)}</li>`).join('')}</ul>
        <p class="note">${t('vf.src.note')}</p>
      </details>
    </section>`;
  }

  // ---- 斋月 ----
  const holRow = (key, d) =>
    d
      ? `<div class="hol"><b>${t(key)}</b><span class="hol-days">${d.inDays === 0 ? t('fast.holToday') : t('fast.holIn', { n: d.inDays })}</span><span class="hol-date">${t('fast.estimated', { date: dateShort(d) })}</span></div>`
      : '';
  function ramadanCard() {
    if (!st.start) return '';
    const ft = fastTimes(ctx.city, st.start, ctx.offsets);
    return `<section class="card" data-vf-ramadan>
      <h2 class="card-title">${star8(18)} ${t('fast.daysLeft', { n: st.start.inDays })}</h2>
      <p>${t('fast.startsOn', { date: dateShort(st.start), y: st.year })}</p>
      <div class="fast-times">
        <div class="fast-time"><span class="ft-label">${t('fast.sahurEnd')}</span><span class="ft-time">${fmtHM(ft.sahurEnd)}</span></div>
        <div class="fast-time"><span class="ft-label">${t('fast.iftar')}</span><span class="ft-time">${fmtHM(ft.iftar)}</span></div>
      </div>
      <p class="note">${t('fast.head.preview', { date: dateShort(st.start) })} · ${t('fast.datesNote')}</p>
      <p class="note">${t('vf.rLater')}</p>
      ${holRow('fast.fitr', hol.fitr)}
      ${holRow('fast.adha', hol.adha)}
      <p class="note">${t('fast.fitrNote')}</p>
    </section>`;
  }

  const html = `
  <div class="page ramadan fasting">
    <section class="ramadan-wrap">${ramadanScene({ iftar: false })}</section>
    <div class="ph">
      <h1>${t('vf.title')} <span class="ar-sm" lang="ar" dir="rtl">الصِّيَام</span></h1>
      <p class="ph-sub">${t('vf.sub')}</p>
      <p class="ph-date">${hijriLine(h)}</p>
      <p class="local-note">${t('fast.datesNote')}</p>
    </div>
    <div class="r-grid">
      <div>
        <div data-vf-today-wrap>${todayCard()}</div>
        <div data-vf-qada-wrap>${qadaCard()}</div>
        <div data-vf-year-wrap>${yearCard()}</div>
      </div>
      <div>
        <div data-vf-up-wrap>${upcomingCard()}</div>
        ${ramadanCard()}
        <a class="card card-link r-link" href="#/ramadan/quran">
          <span class="r-link-t">${t('quran.title')}</span><span class="r-link-s">${t('fast.quranSub')}</span><span class="r-link-go">→</span></a>
      </div>
    </div>
  </div>`;

  // 重画某一块并重新绑定按钮
  function redraw(el) {
    el.querySelector('[data-vf-today-wrap]').innerHTML = todayCard();
    el.querySelector('[data-vf-qada-wrap]').innerHTML = qadaCard();
    el.querySelector('[data-vf-year-wrap]').innerHTML = yearCard();
    el.querySelector('[data-vf-up-wrap]').innerHTML = upcomingCard();
    bind(el);
  }
  function bind(el) {
    const on = (sel, fn) => el.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => fn(b)));
    on('[data-vf-fast]', () => {
      // 有要补的斋时默认记为补斋，否则副功斋；可以再改
      const kind = oweDays() > 0 ? 'qada' : 'nafl';
      setFast(todayKey, kind);
      togglePlan(todayKey, true, todayKey); // 今天的开斋提醒
      if (navigator.vibrate) navigator.vibrate(20);
      redraw(el);
      const b = el.querySelector('[data-vf-today]');
      if (b) b.classList.add('is-pop');
      fastBadge(kind);
      ctx.resync();
    });
    on('[data-vf-kind]', (b) => {
      setFast(todayKey, b.dataset.vfKind);
      redraw(el);
      fastBadge(b.dataset.vfKind);
    });
    on('[data-vf-cancel]', () => {
      setFast(todayKey, null);
      togglePlan(todayKey, false, todayKey);
      redraw(el);
      ctx.resync();
    });
    on('[data-vf-plan]', (b) => {
      const was = b.getAttribute('aria-pressed') === 'true';
      togglePlan(b.dataset.vfPlan, !was, todayKey);
      if (!was && navigator.vibrate) navigator.vibrate(15);
      redraw(el);
      ctx.resync();
    });
    on('[data-vf-owe]', (b) => {
      addOwe(Number(b.dataset.vfOwe));
      redraw(el);
    });
    on('[data-vf-import]', () => {
      importMissed(lastRamadan);
      redraw(el);
    });
  }
  function fastBadge(kind) {
    const b = award(kind === 'qada' ? 'qadaFast' : 'naflFast', todayKey);
    if (b) cheer({ badges: [b] });
  }

  let lastPhase = fastPhase(ctx.city, ctx.now, ctx.offsets).phase;
  return {
    html,
    mount: bind,
    tick(c) {
      const ff = fastPhase(c.city, c.now, c.offsets);
      if (ff.phase !== lastPhase) {
        lastPhase = ff.phase;
        c.rerender();
        return;
      }
      const node = document.querySelector('[data-vf-count]');
      setCount(node, durHTML(ff.target - c.now, true));
    },
  };
}
