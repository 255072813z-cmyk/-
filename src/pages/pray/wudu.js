// 小净：图文，一步一步
import { WUDU_STEPS, WUDU_FACTS } from '../../content/wudu.js';
import { wuduFigure, ICONS, star8 } from '../../ui/art.js';
import { reciteCard } from '../../ui/recite.js';
import { load, save } from '../../core/storage.js';

const LEVEL = { fard: ['主命', 'lv-fard'], sunnah: ['圣行', 'lv-sunnah'], mustahab: ['可嘉', 'lv-opt'] };

export function wuduPage() {
  let i = Math.min(load('wudu:step', 0), WUDU_STEPS.length - 1);
  const html = `
  <div class="page wudu">
    <div class="page-head"><a class="back" href="#/pray" aria-label="返回在家礼拜">${ICONS.back}</a><h1>小净</h1></div>
    <div class="stepper card" data-stepper></div>
    <section class="card">
      <h2 class="card-title">${star8(18)} 必须做的四件事</h2>
      <p>${WUDU_FACTS.fard}</p>
    </section>
    <details class="card fold" open>
      <summary>冬天的方便</summary>
      <ul class="dots">${WUDU_FACTS.winter.map((x) => `<li>${x}</li>`).join('')}</ul>
    </details>
    <details class="card fold">
      <summary>哪些事会坏小净</summary>
      <ul class="dots">${WUDU_FACTS.breakers.map((x) => `<li>${x}</li>`).join('')}</ul>
      <p class="note">依哈乃斐学派。坏了小净，礼拜前要重新做。</p>
    </details>
  </div>`;

  function draw(el) {
    const st = WUDU_STEPS[i];
    const [lvName, lvCls] = LEVEL[st.level];
    const box = el.querySelector('[data-stepper]');
    box.innerHTML = `
      <div class="progress" aria-hidden="true"><span style="width:${((i + 1) / WUDU_STEPS.length) * 100}%"></span></div>
      <p class="step-count">第 ${i + 1} 步，共 ${WUDU_STEPS.length} 步</p>
      <div class="wudu-body">
        <div class="wudu-art">${wuduFigure(st.zone)}</div>
        <div class="wudu-text">
          <h2 class="step-title">${st.title}${st.count ? `<span class="times">${st.count === 1 ? '一次' : st.count + ' 遍'}</span>` : ''}</h2>
          <span class="level ${lvCls}">${lvName}</span>
          <p class="how">${st.how}</p>
          ${st.fardNote ? `<p class="note">${st.fardNote}</p>` : ''}
          ${st.note ? `<p class="note">${st.note}</p>` : ''}
        </div>
      </div>
      ${(st.items || []).map(reciteCard).join('')}
      <div class="step-btns">
        <button class="btn btn-ghost" type="button" data-prev ${i === 0 ? 'disabled' : ''}>上一步</button>
        ${
          i < WUDU_STEPS.length - 1
            ? '<button class="btn btn-primary" type="button" data-next>下一步</button>'
            : '<a class="btn btn-primary" href="#/pray" data-finish>小净完成</a>'
        }
      </div>`;
    box.querySelector('[data-prev]').addEventListener('click', () => go(el, -1));
    const nx = box.querySelector('[data-next]');
    if (nx) nx.addEventListener('click', () => go(el, 1));
    const fin = box.querySelector('[data-finish]');
    if (fin) fin.addEventListener('click', () => save('wudu:step', 0));
  }
  function go(el, d) {
    i = Math.max(0, Math.min(WUDU_STEPS.length - 1, i + d));
    save('wudu:step', i);
    draw(el);
    el.querySelector('[data-stepper]').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  return { html, mount: draw };
}
