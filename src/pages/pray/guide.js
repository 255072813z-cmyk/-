// 跟着做礼拜：先选哪一部分（逊奈/主命/威特尔），再一步一步跟做。
// 画面上是一排人和你做同样的动作——在家礼拜，也像站在清真寺的班里。
import { PRAYER_INFO, buildSteps, unitLabel, AFTER_PRAYER, getPrayerInfo } from '../../content/prayers.js';
import { prayerRow, ICONS } from '../../ui/art.js';
import { reciteCard } from '../../ui/recite.js';
import { t } from '../../i18n/index.js';
import { PRAYERS } from '../../core/prayer-times.js';
import { ymdKey } from '../../core/clock.js';
import { togglePrayed, prayedOn } from '../../core/prayed.js';
import { markGuideDone } from '../../core/usage.js';
import { cheer } from '../../ui/cheer.js';
import { onPrayed, onGuideDone } from '../../core/badges.js';
import { softToast } from '../../core/reminder.js';

const unitName = (u) => t(...unitLabel(u).name);

/** 一步的文字：标题、怎么做、女士、提示 */
export function stepText(st) {
  const v = { ...st.vars };
  if (st.id === 'niyyah') {
    v.prayerName = t('prayer.' + v.prayer);
    v.kindName = t('kind.' + v.kind);
  }
  return {
    title: t(`step.${st.id}.title`, v),
    how: t(st.howKey || `step.${st.id}.how`, v),
    women: st.women ? t(`step.${st.id}.women`, v) : '',
    note: st.note ? t(`step.${st.id}.note`, v) : '',
  };
}

function chooser(ctx, prayerKey) {
  const info = getPrayerInfo(prayerKey);
  const isFri = prayerKey === 'dhuhr' && ctx.sched.today.wd === 5;
  const units = info.units
    .map((u) => {
      const l = unitLabel(u);
      return `<li><a class="card card-link unit lv-${l.level}" href="#/pray/guide/${prayerKey}/${u.id}">
        <span class="unit-name">${unitName(u)}</span><span class="unit-tag">${t(l.tag)}</span><span class="unit-go">${t('guide.start')}</span></a></li>`;
    })
    .join('');
  const total = info.units.reduce((a, u) => a + u.rakats, 0);
  return `
  <div class="page guide">
    <div class="page-head"><a class="back" href="#/pray" aria-label="${t('common.back')}">${ICONS.back}</a>
      <h1>${t('prayer.' + prayerKey)} <span class="ar-sm" lang="ar" dir="rtl">${info.ar}</span></h1></div>
    <section class="card row-card">${prayerRow('stand')}</section>
    <p class="lead">${t('guide.total', { prayer: t('prayer.' + prayerKey), n: total })}</p>
    ${isFri ? `<p class="note friday">${t('guide.friday')}</p>` : ''}
    <ol class="units">${units}</ol>
    <p class="note">${t('guide.levels')}</p>
    <div class="pick-grid small">${Object.keys(PRAYER_INFO)
      .map((p) => `<a class="pick ${p === prayerKey ? 'is-on' : ''}" href="#/pray/guide/${p}">${t('prayer.' + p)}</a>`)
      .join('')}</div>
  </div>`;
}

export function guidePage(ctx, prayerKey, unitId) {
  if (!getPrayerInfo(prayerKey)) prayerKey = ctx.sched.current || ctx.sched.next;
  if (!unitId) return { html: chooser(ctx, prayerKey) };
  const isTarawih = prayerKey === 'tarawih';

  const { steps, info, unit } = buildSteps(prayerKey, unitId);
  let i = 0;
  const next = info.units[info.units.indexOf(unit) + 1];
  const html = `
  <div class="page guide">
    <div class="page-head"><a class="back" href="${isTarawih ? '#/ramadan/tarawih' : '#/pray/guide/' + prayerKey}" aria-label="${t('common.back')}">${ICONS.back}</a>
      <h1>${t('prayer.' + prayerKey)} · ${unitName(unit)}</h1></div>
    <div data-stage></div>
  </div>`;

  function finishHTML() {
    return `<section class="card done-card">
      <p class="done-ar" lang="ar" dir="rtl">تَقَبَّلَ اللَّهُ</p>
      <h2>${t('guide.done')}</h2>
      <p>${t('guide.after')}</p>
      ${AFTER_PRAYER.map(reciteCard).join('')}
      <div class="step-btns">
        ${isTarawih ? `<a class="btn btn-primary" href="#/ramadan/tarawih">${t('guide.backTarawih')}</a>` : ''}
        ${!isTarawih && next ? `<a class="btn btn-primary" href="#/pray/guide/${prayerKey}/${next.id}">${t('guide.next', { unit: unitName(next) })}</a>` : ''}
        ${!isTarawih ? `<a class="btn ${next ? 'btn-ghost' : 'btn-primary'}" href="#/tasbih">${t('guide.tasbih')}</a>` : ''}
      </div>
      ${PRAYERS.includes(prayerKey) ? `<button class="btn btn-ghost btn-sm" type="button" data-mark>${prayedOn(ymdKey(ctx.sched.today))[prayerKey] ? t('guide.marked') : t('home.markPrayed', { name: t('prayer.' + prayerKey) })}</button>` : ''}
      <button class="btn btn-ghost btn-sm" type="button" data-restart>${t('guide.restart')}</button>
    </section>`;
  }

  function draw(el) {
    const stage = el.querySelector('[data-stage]');
    if (i >= steps.length) {
      stage.innerHTML = finishHTML();
      markGuideDone(ymdKey(ctx.sched.today));
      // 跟着做完：第一次、第 30 次各解锁一个徽章（泰拉威的一组不算一次完整的礼拜）
      if (!isTarawih) {
        const got = onGuideDone(ymdKey(ctx.sched.today));
        if (got.length) cheer({ badges: got });
      }
      const mark = stage.querySelector('[data-mark]');
      if (mark)
        mark.addEventListener('click', () => {
          const day = ymdKey(ctx.sched.today);
          const res = togglePrayed(day, prayerKey, true);
          mark.textContent = t('guide.marked');
          mark.disabled = true;
          if (res) {
            cheer({ streak: res, badges: onPrayed(day, prayedOn(day)), todayKey: day }, softToast);
            ctx.resync();
            import('../../core/circle.js').then((m) => m.syncCheckin(day)).catch(() => {});
          }
        });
      stage.querySelector('[data-restart]').addEventListener('click', () => {
        i = 0;
        draw(el);
      });
      return;
    }
    const st = steps[i];
    const tx = stepText(st);
    stage.innerHTML = `
      <section class="card stepper">
        <div class="progress" aria-hidden="true"><span style="width:${((i + 1) / steps.length) * 100}%"></span></div>
        <p class="step-count">${t('guide.count', { r: st.rakah, rn: unit.rakats, i: i + 1, sn: steps.length })}</p>
        <div class="row-stage posture-${st.posture}">${prayerRow(st.posture)}</div>
        <div class="step-head">
          <h2 class="step-title">${tx.title}</h2>
          <span class="ar-sm" lang="ar" dir="rtl">${st.ar}</span>
          <span class="posture-tag">${t('posture.' + st.posture)}</span>
        </div>
        <p class="how">${tx.how}</p>
        ${tx.women ? `<p class="note women">${tx.women}</p>` : ''}
        ${st.items.map(reciteCard).join('')}
        ${tx.note ? `<p class="note">${tx.note}</p>` : ''}
      </section>
      <div class="step-btns sticky">
        <button class="btn btn-ghost" type="button" data-prev ${i === 0 ? 'disabled' : ''}>${t('common.prev')}</button>
        <button class="btn btn-primary" type="button" data-next>${i === steps.length - 1 ? t('common.finish') : t('common.next')}</button>
      </div>`;
    stage.querySelector('[data-prev]').addEventListener('click', () => go(el, -1));
    stage.querySelector('[data-next]').addEventListener('click', () => go(el, 1));
  }
  function go(el, d) {
    i = Math.max(0, Math.min(steps.length, i + d));
    draw(el);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const onKey = (e) => {
    if (e.key === 'ArrowRight') go(document.getElementById('app'), 1);
    if (e.key === 'ArrowLeft') go(document.getElementById('app'), -1);
  };
  return {
    html,
    mount(el) {
      draw(el);
      window.addEventListener('keydown', onKey);
    },
    unmount() {
      window.removeEventListener('keydown', onKey);
    },
  };
}
