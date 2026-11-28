// 真主的 99 个尊名：每天一个（放在最上面），下面是全部 99 个。
// "真主有九十九个尊名"见布哈里 2736、穆斯林 2677；名单按提尔密济 3507 的通行列表（数据见 src/content/names.js）。
import { NAMES } from '../../content/names.js';
import { ICONS, star8 } from '../../ui/art.js';
import { t, TR, getLang } from '../../i18n/index.js';

const mean = (x) => x.m[getLang()] || x.m.ru;

/** 今天是第几个：按日期轮流 */
export function nameOfDay(ymd) {
  const n = Math.floor(Date.UTC(ymd.y, ymd.m - 1, ymd.d) / 864e5);
  return ((n % NAMES.length) + NAMES.length) % NAMES.length;
}

export function namesPage(ctx) {
  const k = nameOfDay(ctx.sched.today);
  const today = NAMES[k];
  const tt = TR(today);
  const html = `
  <div class="page names">
    <div class="page-head"><a class="back" href="#/pray" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('names.title')}</h1></div>
    <p class="ph-sub">${t('names.sub')}</p>
    <section class="card name-today">
      <p class="name-today-k">${star8(16)} ${t('names.today', { n: k + 1 })}</p>
      <p class="name-ar" lang="ar" dir="rtl">${today.ar}</p>
      <p class="tr" lang="${tt.lang}">${tt.text}</p>
      <p class="name-m">${mean(today)}</p>
    </section>
    <h2 class="sec">${t('names.all')}</h2>
    <ol class="names-grid">
      ${NAMES.map((x, i) => {
        const tr = TR(x);
        return `<li class="name-cell ${i === k ? 'is-today' : ''}">
          <span class="name-n">${i + 1}</span>
          <span class="name-ar-sm" lang="ar" dir="rtl">${x.ar}</span>
          <span class="name-tr" lang="${tr.lang}">${tr.text}</span>
          <span class="name-mean">${mean(x)}</span>
        </li>`;
      }).join('')}
    </ol>
    <p class="note">${t('names.note')}</p>
  </div>`;
  return { html };
}
