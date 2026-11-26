// 礼拜（底部标签）：去不了清真寺的日子，从这里开始——跟着做、小净、朝向、赞念、补礼。
// 在家礼拜的依据、和家人一起礼拜的说明折叠起来，需要时点开。
import { star8, ICONS } from '../../ui/art.js';
import { homeInterior } from '../../ui/art-scenes.js';
import { isWinter, loadHadith } from '../home.js';
import { PRAYER_INFO } from '../../content/prayers.js';
import { fmtHM } from '../../core/clock.js';
import { t, L } from '../../i18n/index.js';
import { adhkarCard } from '../../ui/adhkar-card.js';

export function hubPage(ctx) {
  const s = ctx.sched;
  const target = s.current || s.next;
  const name = t('prayer.' + target);
  const friday =
    s.today.wd === 5
      ? `<p class="note friday">${t('hub.friday')}</p>`
      : '';
  const tile = (href, icon, title, sub) =>
    `<a class="card card-link tool" href="${href}"><span class="tool-ico">${icon}</span><span class="tool-t">${title}</span><span class="tool-s">${sub}</span></a>`;
  const html = `
  <div class="page hub">
    <section class="interior-wrap">${homeInterior({ winter: isWinter(ctx) })}</section>
    <header class="ph">
      <h1>${t('hub.title')}</h1>
      <p class="ph-sub">${t('hub.lead')}</p>
    </header>
    ${friday}

    <a class="card card-link step-link is-main hub-main" href="#/pray/guide/${target}">
      <span class="step-t">${t('home.follow', { name })}</span>
      <span class="step-s">${s.current ? t('hub.nowIs', { name }) : t('hub.nextAt', { time: fmtHM(s.nextTime) })} · ${t('hub.everyStep')}</span></a>

    ${adhkarCard(ctx, true)}

    <h2 class="sec">${t('hub.secTools')}</h2>
    <div class="tools">
      ${tile('#/pray/wudu', ICONS.drop, t('hub.wudu'), t('hub.wuduSub'))}
      ${tile('#/qibla', ICONS.qibla, t('hub.qibla'), t('hub.qiblaSub'))}
      ${tile('#/tasbih', ICONS.tasbih, t('guide.tasbih'), t('hub.tasbihSub'))}
      ${tile('#/pray/qada', ICONS.qada, t('hub.qada'), t('hub.qadaSub'))}
    </div>

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

    <h2 class="sec">${t('hub.secMore')}</h2>
    <details class="card fold excuse-card">
      <summary>${t('hub.sickTitle')}</summary>
      <p>${t('hub.sickText')}</p>
      <p class="soft">${t('hub.together')}</p>
      <div data-excuse-hadith></div>
      <p class="note">${t('hub.sickNote')}</p>
    </details>

    <details class="card fold">
      <summary>${t('hub.family')}</summary>
      <p>${t('hub.familyText')}</p>
      <p class="note">${t('hub.madhab')}</p>
    </details>
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
