// 在家礼拜（冬季模式的核心）：去不了清真寺的日子，从这里开始。
import { homeInterior, star8 } from '../../ui/art.js';
import { isWinter, loadHadith } from '../home.js';
import { PRAYER_INFO } from '../../content/prayers.js';
import { fmtHM } from '../../core/clock.js';
import { t, L } from '../../i18n/index.js';

export function hubPage(ctx) {
  const s = ctx.sched;
  const target = s.current || s.next;
  const name = t('prayer.' + target);
  const friday =
    s.today.wd === 5
      ? `<p class="note friday">${t('hub.friday')}</p>`
      : '';
  const html = `
  <div class="page hub">
    <section class="interior-wrap">${homeInterior({ winter: isWinter(ctx) })}</section>
    <section class="hub-intro">
      <h1>${t('hub.title')}</h1>
      <p>${t('hub.lead')}</p>
      <p class="soft">${t('hub.together')}</p>
      ${friday}
    </section>

    <ol class="steps-nav">
      <li><a class="card card-link step-link" href="#/pray/wudu">
        <span class="step-no">1</span><span class="step-t">${t('hub.wudu')}</span><span class="step-s">${t('hub.wuduSub')}</span></a></li>
      <li><a class="card card-link step-link" href="#/qibla">
        <span class="step-no">2</span><span class="step-t">${t('hub.qibla')}</span><span class="step-s">${t('hub.qiblaSub')}</span></a></li>
      <li><a class="card card-link step-link is-main" href="#/pray/guide/${target}">
        <span class="step-no">3</span><span class="step-t">${t('home.follow', { name })}</span>
        <span class="step-s">${s.current ? t('hub.nowIs', { name }) : t('hub.nextAt', { time: fmtHM(s.nextTime) })} · ${t('hub.everyStep')}</span></a></li>
      <li><a class="card card-link step-link" href="#/tasbih">
        <span class="step-no">4</span><span class="step-t">${t('guide.tasbih')}</span><span class="step-s">${t('hub.tasbihSub')}</span></a></li>
    </ol>

    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('hub.other')}</h2>
      <div class="pick-grid">
        ${Object.keys(PRAYER_INFO)
          .map(
            (p) =>
              `<a class="pick ${p === target ? 'is-on' : ''}" href="#/pray/guide/${p}"><span>${t('prayer.' + p)}</span><span class="ar-sm" lang="ar" dir="rtl">${PRAYER_INFO[p].ar}</span></a>`,
          )
          .join('')}
      </div>
    </section>

    <section class="card soft-card excuse-card">
      <h2 class="card-title">${star8(18)} ${t('hub.sickTitle')}</h2>
      <p>${t('hub.sickText')}</p>
      <div data-excuse-hadith></div>
      <p class="note">${t('hub.sickNote')}</p>
    </section>

    <a class="card card-link qada-link" href="#/pray/qada">
      <span class="athome-t">${t('hub.qada')}</span>
      <span class="athome-s">${t('hub.qadaSub')}</span>
    </a>

    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} ${t('hub.family')}</h2>
      <p>${t('hub.familyText')}</p>
      <p class="note">${t('hub.madhab')}</p>
    </section>
  </div>`;
  return {
    html,
    mount(el) {
      loadHadith().then(({ HADITH }) => {
        const box = el.querySelector('[data-excuse-hadith]');
        if (box)
          box.innerHTML = [HADITH.b2996, HADITH.b666]
            .map((h) => `<blockquote class="hadith-quote"><p class="hq-ar" lang="ar" dir="rtl">${h.ar}</p><p class="hq-text">${L(h)}</p><p class="hq-src">${t('common.source', { src: L(h.src) })}</p></blockquote>`)
            .join('');
      });
    },
  };
}
