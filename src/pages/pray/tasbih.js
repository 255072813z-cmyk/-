// 礼拜后赞念：33 遍一组，个人用，不联网、不排名、不计分。
import { TASBIH, TASBIH_100 } from '../../content/recitations.js';
import { load, save } from '../../core/storage.js';
import { star8 } from '../../ui/art.js';
import { t, L, TR } from '../../i18n/index.js';

export function tasbihPage() {
  let st = load('tasbih', { phase: 0, count: 0 }); // phase 0-2 三句，3 = 第 100 句
  if (!st || !Number.isInteger(st.phase) || st.phase < 0 || st.phase > 3 || !Number.isInteger(st.count) || st.count < 0 || st.count > 33) st = { phase: 0, count: 0 };

  const html = `
  <div class="page tasbih">
    <h1 class="sr-only">${t('guide.tasbih')}</h1>
    <section class="card tasbih-card" data-box></section>
    <p class="note center">${t('tasbih.hint')}</p>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} ${t('tasbih.howTitle')}</h2>
      <p>${t('tasbih.how')}</p>
      <p class="src">${t('common.source', { src: L(TASBIH_100.src) })}</p>
    </section>
  </div>`;

  function draw(el) {
    const box = el.querySelector('[data-box]');
    if (st.phase === 3) {
      box.innerHTML = `
        <div class="tb-dots">${TASBIH.map(() => '<span class="on"></span>').join('')}</div>
        <p class="tb-label">${t('tasbih.last')}</p>
        <p class="ar big" lang="ar" dir="rtl">${TASBIH_100.ar}</p>
        <p class="tr" lang="${TR(TASBIH_100).lang}">${TR(TASBIH_100).text}</p>
        <p class="zh">${L(TASBIH_100)}</p>
        <button class="btn btn-primary btn-wide" type="button" data-reset>${t('tasbih.again')}</button>`;
      box.querySelector('[data-reset]').addEventListener('click', () => {
        st = { phase: 0, count: 0 };
        save('tasbih', st);
        draw(el);
      });
      return;
    }
    const cur = TASBIH[st.phase];
    const pct = st.count / cur.count;
    const R = 92;
    const C = 2 * Math.PI * R;
    box.innerHTML = `
      <div class="tb-dots">${TASBIH.map((_, i) => `<span class="${i < st.phase ? 'on' : i === st.phase ? 'cur' : ''}"></span>`).join('')}</div>
      <p class="tb-label">${t('tasbih.phrase', { i: st.phase + 1, n: 3 })}</p>
      <button class="tb-tap" type="button" data-tap aria-label="${t('tasbih.aria', { text: L(cur), i: st.count, n: cur.count })}">
        <svg viewBox="-100 -100 200 200" aria-hidden="true">
          <circle r="${R}" class="tb-track"/>
          <circle r="${R}" class="tb-ring" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - pct)}" transform="rotate(-90)"/>
          <g class="tb-star" transform="scale(5.2)"><rect x="-7.5" y="-7.5" width="15" height="15"/><rect x="-7.5" y="-7.5" width="15" height="15" transform="rotate(45)"/></g>
        </svg>
        <span class="tb-num"><b data-num>${st.count}</b><small>/ ${cur.count}</small></span>
      </button>
      <p class="ar big" lang="ar" dir="rtl">${cur.ar}</p>
      <p class="tr" lang="${TR(cur).lang}">${TR(cur).text}</p>
      <p class="zh">${L(cur)}</p>
      <div class="step-btns">
        <button class="btn btn-ghost btn-sm" type="button" data-undo ${st.count === 0 ? 'disabled' : ''}>${t('tasbih.undo')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-reset>${t('tasbih.reset')}</button>
      </div>`;
    box.querySelector('[data-tap]').addEventListener('click', () => {
      st.count++;
      if (navigator.vibrate) navigator.vibrate(st.count >= cur.count ? [40, 60, 40] : 12);
      if (st.count >= cur.count) st = { phase: st.phase + 1, count: 0 };
      save('tasbih', st);
      draw(el);
      const tap = el.querySelector('[data-tap]');
      if (tap) tap.focus();
    });
    box.querySelector('[data-undo]').addEventListener('click', () => {
      st.count = Math.max(0, st.count - 1);
      save('tasbih', st);
      draw(el);
    });
    box.querySelector('[data-reset]').addEventListener('click', () => {
      st = { phase: 0, count: 0 };
      save('tasbih', st);
      draw(el);
    });
  }
  return { html, mount: draw };
}
