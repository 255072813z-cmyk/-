// 小净：图文，一步一步
import { WUDU_STEPS, WUDU_WINTER_COUNT, WUDU_BREAKER_COUNT } from '../../content/wudu.js';
import { wuduFigure, ICONS, star8 } from '../../ui/art.js';
import { reciteCard } from '../../ui/recite.js';
import { load, save } from '../../core/storage.js';
import { t } from '../../i18n/index.js';
import { ymdKey } from '../../core/clock.js';
import { earn } from '../../ui/cheer.js';

const LEVEL_CLS = { fard: 'lv-fard', sunnah: 'lv-sunnah', mustahab: 'lv-opt' };
const list = (prefix, n) => Array.from({ length: n }, (_, i) => `<li>${t(`${prefix}.${i + 1}`)}</li>`).join('');

export function wuduPage(ctx) {
  let i = Math.max(0, Math.min(Math.floor(Number(load('wudu:step', 0))) || 0, WUDU_STEPS.length - 1));
  const html = `
  <div class="page wudu">
    <div class="page-head"><a class="back" href="#/pray" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('wudu.title')}</h1></div>
    <div class="stepper card" data-stepper></div>
    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('wudu.fardTitle')}</h2>
      <p>${t('wudu.fardText')}</p>
    </section>
    <details class="card fold" open>
      <summary>${t('wudu.winterTitle')}</summary>
      <ul class="dots">${list('wudu.winter', WUDU_WINTER_COUNT)}</ul>
    </details>
    <details class="card fold">
      <summary>${t('wudu.breakerTitle')}</summary>
      <ul class="dots">${list('wudu.breaker', WUDU_BREAKER_COUNT)}</ul>
      <p class="note">${t('wudu.breakerNote')}</p>
    </details>
  </div>`;

  function draw(el) {
    const st = WUDU_STEPS[i];
    const box = el.querySelector('[data-stepper]');
    const times = st.count ? `<span class="times">${st.count === 1 ? t('common.once') : t('common.times', { n: st.count })}</span>` : '';
    box.innerHTML = `
      <div class="progress" aria-hidden="true"><span style="width:${((i + 1) / WUDU_STEPS.length) * 100}%"></span></div>
      <p class="step-count">${t('wudu.stepCount', { i: i + 1, n: WUDU_STEPS.length })}</p>
      <div class="wudu-body">
        <div class="wudu-art">${wuduFigure(st.zone)}</div>
        <div class="wudu-text">
          <h2 class="step-title">${t(`wudu.${st.id}.title`)}${times}</h2>
          <span class="level ${LEVEL_CLS[st.level]}">${t('wudu.level.' + st.level)}</span>
          <p class="how">${t(`wudu.${st.id}.how`)}</p>
          ${st.fard ? `<p class="note">${t(`wudu.${st.id}.fard`)}</p>` : ''}
          ${st.note ? `<p class="note">${t(`wudu.${st.id}.note`)}</p>` : ''}
        </div>
      </div>
      ${(st.items || []).map(reciteCard).join('')}
      <div class="step-btns">
        <button class="btn btn-ghost" type="button" data-prev ${i === 0 ? 'disabled' : ''}>${t('common.prev')}</button>
        ${
          i < WUDU_STEPS.length - 1
            ? `<button class="btn btn-primary" type="button" data-next>${t('common.next')}</button>`
            : `<a class="btn btn-primary" href="#/pray" data-finish>${t('wudu.finish')}</a>`
        }
      </div>`;
    box.querySelector('[data-prev]').addEventListener('click', () => go(el, -1));
    const nx = box.querySelector('[data-next]');
    if (nx) nx.addEventListener('click', () => go(el, 1));
    const fin = box.querySelector('[data-finish]');
    if (fin)
      fin.addEventListener('click', () => {
        save('wudu:step', 0);
        earn('wudu', ymdKey(ctx.sched.today));
      });
  }
  function go(el, d) {
    i = Math.max(0, Math.min(WUDU_STEPS.length - 1, i + d));
    save('wudu:step', i);
    draw(el);
    el.querySelector('[data-stepper]').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  return { html, mount: draw };
}
