// 动效的小工具：换页时内容依次浮现（按屏幕上从上到下的顺序）、重新播放某个动画。
// 系统开了"减少动态效果"时什么都不做。
export const calm = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};

let enterTimer = 0;
/** 换页：dir = 'right'（往里走）| 'left'（返回）| 'up'（换标签以外的情况） */
export function enterPage(app, dir = 'up') {
  if (!app || calm()) return;
  clearTimeout(enterTimer);
  app.classList.remove('is-enter', 'dir-right', 'dir-left');
  const items = [...app.querySelectorAll('.page > *:not(.col), .page > .col > *')].filter((e) => e.offsetParent !== null);
  // 按在屏幕上的位置排先后（首页两栏、用了 order 的也对）；屏幕以下的统一最后出来
  const vh = window.innerHeight || 800;
  items
    .map((e) => ({ e, top: e.getBoundingClientRect().top }))
    .sort((a, b) => a.top - b.top)
    .forEach(({ e, top }, i) => {
      e.classList.add('enter-i');
      // 依次浮现：最多错开 6 个，整页 400 毫秒内出齐（屏幕以下的不用等）
      e.style.setProperty('--i', String(top > vh ? 6 : Math.min(i, 6)));
    });
  void app.offsetWidth;
  app.classList.add('is-enter');
  // 大数字从 0 数上来（多邻国式），只改文字，不改大小位置
  app.querySelectorAll('[data-count-up]').forEach((e) => countUp(e));
  if (dir === 'right' || dir === 'left') app.classList.add('dir-' + dir);
  enterTimer = setTimeout(() => {
    app.classList.remove('is-enter', 'dir-right', 'dir-left');
    app.querySelectorAll('.enter-i').forEach((e) => e.classList.remove('enter-i'));
  }, 900);
}

/**
 * 更新倒计时：数字一位一位放，变了的那一位平滑地滚过去（旧数字往下滑出，新数字从上面滑进来）。
 * 只用 transform 和 opacity，不引起重排；内容没变就什么都不做。
 */
export function setCount(el, html) {
  if (!el) return;
  const box = document.createElement('span');
  box.innerHTML = html;
  const sig = box.textContent;
  if (el.dataset.v === sig) return;
  el.dataset.v = sig;
  const before = [...el.querySelectorAll('b')].map((b) => b.dataset.n);
  const still = calm();
  box.querySelectorAll('b').forEach((b, k) => {
    const val = b.textContent;
    const old = before[k];
    b.dataset.n = val;
    b.innerHTML = [...val]
      .map((ch, i) => {
        const o = old && old.length === val.length ? old[i] : undefined;
        return o !== undefined && o !== ch && !still
          ? `<span class="dg is-roll"><span class="dg-o">${o}</span><span class="dg-n">${ch}</span></span>`
          : `<span class="dg"><span class="dg-n">${ch}</span></span>`;
      })
      .join('');
  });
  el.innerHTML = box.innerHTML;
}

/** 重新播放一个动画（先拿掉类名、强制重排、再加上） */
export function replay(el, cls, other) {
  if (!el || calm()) return;
  if (other) el.classList.remove(other);
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** 数字从 0 数到现在的值（约 0.7 秒，先快后慢）；系统开了"减少动态效果"时直接显示 */
export function countUp(el, ms = 700) {
  const to = Number(el.textContent);
  if (!Number.isFinite(to) || to <= 1 || calm()) return;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}
