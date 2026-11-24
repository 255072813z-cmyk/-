// 古兰经 30 天读完：每天 1 卷（朱兹），读完打勾。只存本机。
import { JUZ, SURAH_NAMES } from '../../content/juz.js';
import { ramadanStatus } from '../../core/ramadan.js';
import { load, save } from '../../core/storage.js';
import { ICONS, star8 } from '../../ui/art.js';
import { t } from '../../i18n/index.js';
import { ymdKey } from '../../core/clock.js';
import { earn } from '../../ui/cheer.js';

export function quranPage(ctx) {
  const st = ramadanStatus(ctx.sched.today, ctx.hijriAdjust);
  const key = 'quran:' + st.year;
  const todayJuz = st.active ? Math.min(30, st.day) : 0;

  const rows = (done) =>
    JUZ.map((j) => {
      const on = done.includes(j.n);
      const s = SURAH_NAMES[j.from.surah];
      const pages = j.pages[1] - j.pages[0] + 1;
      return `<li class="juz ${on ? 'is-done' : ''} ${j.n === todayJuz ? 'is-today' : ''}">
        <span class="juz-no">${j.n}</span>
        <span class="juz-main"><b>${t('quran.day', { n: j.n })}${j.n === todayJuz ? t('quran.today') : ''}</b>
          <span>${t('quran.from', { surah: j.from.surah, name: `<span lang="ar" dir="rtl">${s.ar}</span>`, ayah: j.from.ayah, p1: j.pages[0], p2: j.pages[1], n: pages })}</span></span>
        <input type="checkbox" data-juz="${j.n}" ${on ? 'checked' : ''} aria-label="${t('quran.doneAria', { n: j.n })}">
      </li>`;
    }).join('');

  const html = `
  <div class="page quran">
    <div class="page-head"><a class="back" href="#/ramadan" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('quran.title')}</h1></div>
    <section class="card">
      <p class="lead" data-q-summary></p>
      <p class="note">${t('quran.tip')}</p>
      <p class="note">${t('quran.pages')}</p>
    </section>
    <section class="card"><ol class="juz-list" data-juz-list></ol>
      <button type="button" class="btn btn-ghost btn-sm" data-q-reset>${t('quran.reset')}</button>
    </section>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} ${t('quran.aboutTitle')}</h2>
      <p>${t('quran.about')}</p>
      <p class="src">${t('quran.dataSrc')}</p>
    </section>
  </div>`;

  function draw(el) {
    const raw = load(key, []);
    const done = Array.isArray(raw) ? [...new Set(raw.filter((n) => Number.isInteger(n) && n >= 1 && n <= 30))] : [];
    el.querySelector('[data-juz-list]').innerHTML = rows(done);
    el.querySelector('[data-q-summary]').textContent =
      done.length >= 30 ? t('quran.allDone') : t('quran.progress', { n: done.length, left: 30 - done.length });
    el.querySelectorAll('[data-juz]').forEach((cb) =>
      cb.addEventListener('change', () => {
        const raw = load(key, []);
        const cur = (Array.isArray(raw) ? raw : []).filter((n) => Number.isInteger(n) && n !== +cb.dataset.juz);
        if (cb.checked) cur.push(+cb.dataset.juz);
        save(key, cur.sort((a, b) => a - b));
        draw(el);
        if (new Set(cur).size >= 30) earn('quran', ymdKey(ctx.sched.today));
        const again = el.querySelector(`[data-juz="${cb.dataset.juz}"]`);
        if (again) again.focus();
      }),
    );
  }
  return {
    html,
    mount(el) {
      draw(el);
      // 防止误触：要点两次才清空
      const reset = el.querySelector('[data-q-reset]');
      let armed = false;
      reset.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          reset.textContent = t('quran.confirm');
          setTimeout(() => {
            armed = false;
            reset.textContent = t('quran.reset');
          }, 4000);
          return;
        }
        armed = false;
        reset.textContent = t('quran.reset');
        save(key, []);
        draw(el);
      });
    },
  };
}
