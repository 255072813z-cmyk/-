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
      e.style.setProperty('--i', String(top > vh ? Math.min(i, 8) : Math.min(i, 10)));
    });
  void app.offsetWidth;
  app.classList.add('is-enter');
  if (dir === 'right' || dir === 'left') app.classList.add('dir-' + dir);
  enterTimer = setTimeout(() => {
    app.classList.remove('is-enter', 'dir-right', 'dir-left');
    app.querySelectorAll('.enter-i').forEach((e) => e.classList.remove('enter-i'));
  }, 1300);
}

/** 更新倒计时：只让变了的数字落下来（数字放在 <b> 里） */
export function setCount(el, html) {
  if (!el) return;
  const before = [...el.querySelectorAll('b')].map((b) => b.textContent);
  el.innerHTML = html;
  if (!before.length) return;
  el.querySelectorAll('b').forEach((b, k) => before[k] !== undefined && before[k] !== b.textContent && b.classList.add('chg'));
}

/** 重新播放一个动画（先拿掉类名、强制重排、再加上） */
export function replay(el, cls, other) {
  if (!el || calm()) return;
  if (other) el.classList.remove(other);
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
