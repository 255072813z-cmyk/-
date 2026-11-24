// 礼拜后赞念：33 遍一组，个人用，不联网、不排名、不计分。
import { TASBIH, TASBIH_100 } from '../../content/recitations.js';
import { load, save } from '../../core/storage.js';
import { star8 } from '../../ui/art.js';

export function tasbihPage() {
  let st = load('tasbih', { phase: 0, count: 0 }); // phase 0-2 三句，3 = 第 100 句
  if (!(st.phase >= 0 && st.phase <= 3)) st = { phase: 0, count: 0 };

  const html = `
  <div class="page tasbih">
    <h1 class="sr-only">礼拜后赞念</h1>
    <section class="card tasbih-card" data-box></section>
    <p class="note center">点大圆圈计数，不联网，不排名，只是你自己的记念。</p>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} 怎么念</h2>
      <p>礼完主命拜后，"赞真主清净"33 遍、"一切赞颂全归真主"33 遍、"真主至大"33 遍，最后念一遍认主独一的话，凑满 100。</p>
      <p class="src">出处：${TASBIH_100.src}</p>
    </section>
  </div>`;

  function draw(el) {
    const box = el.querySelector('[data-box]');
    if (st.phase === 3) {
      box.innerHTML = `
        <div class="tb-dots">${TASBIH.map(() => '<span class="on"></span>').join('')}</div>
        <p class="tb-label">最后一句，凑满 100</p>
        <p class="ar big" lang="ar" dir="rtl">${TASBIH_100.ar}</p>
        <p class="tr" lang="en">${TASBIH_100.tr}</p>
        <p class="zh">${TASBIH_100.zh}</p>
        <button class="btn btn-primary btn-wide" type="button" data-reset>念完了，重新开始</button>`;
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
      <p class="tb-label">第 ${st.phase + 1} 句，共 3 句</p>
      <button class="tb-tap" type="button" data-tap aria-label="计数：${cur.zh}，已念 ${st.count} 遍，共 ${cur.count} 遍">
        <svg viewBox="-100 -100 200 200" aria-hidden="true">
          <circle r="${R}" class="tb-track"/>
          <circle r="${R}" class="tb-ring" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - pct)}" transform="rotate(-90)"/>
          <g class="tb-star" transform="scale(5.2)"><rect x="-7.5" y="-7.5" width="15" height="15"/><rect x="-7.5" y="-7.5" width="15" height="15" transform="rotate(45)"/></g>
        </svg>
        <span class="tb-num"><b data-num>${st.count}</b><small>/ ${cur.count}</small></span>
      </button>
      <p class="ar big" lang="ar" dir="rtl">${cur.ar}</p>
      <p class="tr" lang="en">${cur.tr}</p>
      <p class="zh">${cur.zh}</p>
      <div class="step-btns">
        <button class="btn btn-ghost btn-sm" type="button" data-undo ${st.count === 0 ? 'disabled' : ''}>退一下</button>
        <button class="btn btn-ghost btn-sm" type="button" data-reset>重新开始</button>
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
