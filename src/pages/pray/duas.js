// 生活中的祈祷词：吃饭、出门、睡觉、洁净、清真寺、天气、出行、与人相处、心里难受时、封斋。
// 阿拉伯文从圣训原文逐字截取，出处是标准编号（数据见 src/content/duas.js，生成脚本 scripts/data/build-duas.py）。
import { DUAS, DUA_CATS } from '../../content/duas.js';
import { ICONS } from '../../ui/art.js';
import { t, TR, getLang } from '../../i18n/index.js';

const pick = (o) => o[getLang()] || o.ru;

export function duasPage() {
  const groups = DUA_CATS.map((c) => ({ c, list: DUAS.filter((x) => x.cat === c) })).filter((g) => g.list.length);
  const html = `
  <div class="page duas">
    <div class="page-head"><a class="back" href="#/pray" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('duas.title')} <span class="ar-sm" lang="ar" dir="rtl">الأَدْعِيَة</span></h1></div>
    <p class="ph-sub">${t('duas.sub')}</p>
    <nav class="dua-cats" aria-label="${t('duas.title')}">
      ${groups.map((g) => `<button type="button" class="chip" data-jump="${g.c}">${t('duas.cat.' + g.c)}</button>`).join('')}
    </nav>
    ${groups
      .map(
        (g) => `<h2 class="sec" id="dua-${g.c}">${t('duas.cat.' + g.c)}</h2>
      ${g.list
        .map((x) => {
          const tr = TR(x);
          return `<article class="card dua">
          <h3 class="dua-t">${pick(x.title)}</h3>
          <p class="ar" lang="ar" dir="rtl">${x.ar}</p>
          <p class="tr" lang="${tr.lang}">${tr.text}</p>
          <p class="zh">${pick(x.mean)}</p>
          <p class="src">${t('common.source', { src: pick(x.src) })}</p>
        </article>`;
        })
        .join('')}`,
      )
      .join('')}
    <p class="note center">${t('duas.note')}</p>
  </div>`;
  return {
    html,
    mount(el) {
      el.querySelectorAll('[data-jump]').forEach((b) =>
        b.addEventListener('click', () => {
          const target = el.querySelector('#dua-' + b.dataset.jump);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }),
      );
    },
  };
}
