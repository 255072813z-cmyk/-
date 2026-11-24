// 间歇拜（泰拉威）：哈乃斐学派 20 拜，每 2 拜一出拜，共 10 组；每 4 拜后坐下稍歇。
// 记录今晚礼了几组（只存本机）。
import { load, save } from '../../core/storage.js';
import { ymdKey, addDays } from '../../core/clock.js';
import { ICONS, star8 } from '../../ui/art.js';
import { t } from '../../i18n/index.js';
import { dateShort } from '../../i18n/format.js';

const SETS = 10;

export function tarawihPage(ctx) {
  // 夜里过了零点、还没到晨礼时，仍算"昨晚"
  const s = ctx.sched;
  const night = s.current === 'isha' && ctx.now < s.times.fajr ? addDays(s.today, -1) : s.today;
  const key = 'tarawih:' + ymdKey(night);
  let done = Math.max(0, Math.min(SETS, Math.floor(Number(load(key, 0))) || 0));

  const html = `
  <div class="page tarawih">
    <div class="page-head"><a class="back" href="#/ramadan" aria-label="${t('common.back')}">${ICONS.back}</a>
      <h1>${t('prayer.tarawih')} <span class="ar-sm" lang="ar" dir="rtl">التَّرَاوِيح</span></h1></div>
    <section class="card">
      <p class="step-count">${t('tarawih.tonight', { date: dateShort(night) })}</p>
      <div class="sets" data-sets></div>
      <p class="center" data-sets-text></p>
      <div class="step-btns">
        <a class="btn btn-primary" href="#/pray/guide/tarawih/set">${t('tarawih.follow')}</a>
        <button class="btn btn-ghost" type="button" data-add>${t('tarawih.add')}</button>
      </div>
      <div class="step-btns">
        <button class="btn btn-ghost btn-sm" type="button" data-undo>${t('tarawih.undo')}</button>
        <a class="btn btn-ghost btn-sm" href="#/pray/guide/isha/witr">${t('tarawih.witr')}</a>
      </div>
    </section>
    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('tarawih.howTitle')}</h2>
      <ul class="dots">${[1, 2, 3, 4, 5, 6].map((i) => `<li>${t('tarawih.how.' + i)}</li>`).join('')}</ul>
      <p class="note">${t('tarawih.madhab')}</p>
    </section>
  </div>`;

  function draw(el) {
    el.querySelector('[data-sets]').innerHTML = Array.from(
      { length: SETS },
      (_, i) => `<span class="set ${i < done ? 'is-done' : ''} ${i % 2 === 1 ? 'is-rest' : ''}" aria-hidden="true">${(i + 1) * 2}</span>`,
    ).join('');
    el.querySelector('[data-sets-text]').textContent =
      done >= SETS ? t('tarawih.allDone') : t('tarawih.progress', { n: done * 2, left: (SETS - done) * 2 }) + (done > 0 && done % 2 === 0 ? t('tarawih.rest') : '');
    el.querySelector('[data-add]').disabled = done >= SETS;
    el.querySelector('[data-undo]').disabled = done <= 0;
  }
  return {
    html,
    mount(el) {
      draw(el);
      el.querySelector('[data-add]').addEventListener('click', () => {
        done = Math.min(SETS, done + 1);
        save(key, done);
        draw(el);
      });
      el.querySelector('[data-undo]').addEventListener('click', () => {
        done = Math.max(0, done - 1);
        save(key, done);
        draw(el);
      });
    },
  };
}
