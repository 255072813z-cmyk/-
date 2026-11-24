// 鼓励的动画（参考多邻国）：
// - 今天第一次打卡：底部弹出"又坚持了一天"——灯点亮、数字跳上去、本周今天的圆点亮起，3 秒后自己收起；
// - 解锁坚持称号或成就徽章：几何彩屑（八角星、菱形、圆点）落下，徽章弹出，轻微震动。
// 只用几何图形，没有人物和动物；系统开了"减少动态效果"时不放彩屑、不跳数字，只显示静态卡片。
import { t, L } from '../i18n/index.js';
import { weekCells } from '../core/streak.js';
import { prayedDays } from '../core/prayed.js';
import { star8 } from './art.js';
import { LAMP, titleName } from './streak-ui.js';
import { badgeIcon, badgeName, badgeHow } from './badge-ui.js';
import { award } from '../core/badges.js';

const calm = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};
const buzz = (p) => {
  try {
    if (navigator.vibrate) navigator.vibrate(p);
  } catch (e) {
    /* 有的浏览器不许震动 */
  }
};

/** 数字从 from 跳到 to（缓出），fmt 把数字变成显示的文字 */
export function countUp(el, from, to, ms = 700, fmt = String) {
  if (!el) return;
  if (calm() || from === to || typeof requestAnimationFrame !== 'function') {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    el.textContent = fmt(v);
    if (k < 1) requestAnimationFrame(step);
  };
  el.textContent = fmt(from);
  requestAnimationFrame(step);
}

/** 几何彩屑：从顶上落下，2.6 秒后自己清掉 */
export function confetti(host = document.body, n = 42) {
  if (calm()) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  const shapes = ['star', 'diamond', 'dot', 'bar'];
  const colors = ['var(--gold)', 'var(--green)', 'var(--lamp)', 'var(--green-2, #3f8f6f)'];
  let html = '';
  for (let i = 0; i < n; i++) {
    const sh = shapes[i % shapes.length];
    const style = [
      `left:${(Math.random() * 100).toFixed(1)}%`,
      `--dx:${(Math.random() * 120 - 60).toFixed(0)}px`,
      `--r:${(Math.random() * 720 - 360).toFixed(0)}deg`,
      `animation-duration:${(1.6 + Math.random() * 1).toFixed(2)}s`,
      `animation-delay:${(Math.random() * 0.35).toFixed(2)}s`,
      `color:${colors[i % colors.length]}`,
    ].join(';');
    html += `<i class="cf cf-${sh}" style="${style}">${sh === 'star' ? star8(14) : ''}</i>`;
  }
  layer.innerHTML = html;
  host.appendChild(layer);
  setTimeout(() => layer.remove(), 3200);
}

function overlay(cls, inner, label) {
  const box = document.createElement('div');
  box.className = cls;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', label);
  box.innerHTML = inner;
  document.body.appendChild(box);
  return box;
}

/** 今天第一次打卡：底部的"又坚持了一天" */
function streakSheet(res, todayKey, note) {
  document.querySelectorAll('.cheer-sheet').forEach((n) => n.remove());
  const from = res.restartedFrom || res.usedGrace.length ? 0 : Math.max(0, res.cur - 1);
  const cells = weekCells(todayKey, prayedDays());
  const box = overlay(
    'cheer-sheet',
    `<div class="cheer-card" data-cheer>
      <span class="cheer-lamp">${LAMP}</span>
      <div class="cheer-num"><b data-cheer-n>${from}</b><span>${t('streak.daysUnit', { n: res.cur })}</span></div>
      <p class="cheer-k">${t('streak.extended')}</p>
      <ol class="streak-week cheer-week">${cells
        .map((c) => `<li class="sw sw-${c.day === todayKey ? 'today' : c.st}" ${c.day === todayKey ? 'data-cheer-today' : ''}><span class="sw-d">${t('weekShort.' + c.wd)}</span><span class="sw-dot"></span></li>`)
        .join('')}</ol>
      ${note ? `<p class="note">${note}</p>` : ''}
      <button type="button" class="btn btn-primary btn-wide" data-cheer-ok>${t('streak.continue')}</button>
    </div>`,
    t('streak.extended'),
  );
  let timer = 0;
  const close = () => {
    clearTimeout(timer);
    box.classList.add('is-out');
    setTimeout(() => box.remove(), calm() ? 0 : 220);
  };
  box.addEventListener('click', (e) => {
    if (e.target === box || e.target.closest('[data-cheer-ok]')) close();
  });
  box.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  box.querySelector('[data-cheer-ok]').focus({ preventScroll: true });
  // 灯先亮，数字跳上去，今天的圆点最后亮起
  setTimeout(() => box.classList.add('is-lit'), calm() ? 0 : 150);
  setTimeout(() => countUp(box.querySelector('[data-cheer-n]'), from, res.cur, 650), calm() ? 0 : 300);
  setTimeout(() => {
    const d = box.querySelector('[data-cheer-today]');
    if (d) d.className = 'sw sw-done is-pop';
    buzz(25);
  }, calm() ? 0 : 900);
  timer = setTimeout(close, 3600);
  return box;
}

/** 解锁称号、徽章：彩屑 + 弹出的徽章 */
function unlockCard(res, badges) {
  document.querySelectorAll('.celebrate, .cheer-sheet').forEach((n) => n.remove());
  const title = res && res.newTitle;
  const head = title
    ? `<div class="cele-medal is-title"><span class="cele-rays"></span>${star8(64)}</div>
       <p class="celebrate-k">${t('streak.unlocked')}</p>
       <h2>${titleName(title)}</h2>
       <p class="cele-n"><b data-cele-n>0</b> ${t('streak.daysUnit', { n: res.cur })}</p>`
    : `<div class="cele-medal"><span class="cele-rays"></span>${badgeIcon(badges[0].id, 56)}</div>
       <p class="celebrate-k">${t(badges.length > 1 ? 'badge.unlockedN' : 'badge.unlocked', { n: badges.length })}</p>
       <h2>${badgeName(badges[0].id)}</h2>
       <p>${badgeHow(badges[0].id, badges[0].need)}</p>`;
  const rest = title ? badges : badges.slice(1);
  const box = overlay(
    'celebrate',
    `<div class="celebrate-card">
      ${head}
      ${rest.length ? `<ul class="cele-badges">${rest.map((b, i) => `<li style="animation-delay:${0.45 + i * 0.15}s"><span class="badge-medal">${badgeIcon(b.id, 26)}</span><span>${badgeName(b.id)}</span></li>`).join('')}</ul>` : ''}
      ${title ? '<p class="note" data-cele-hadith></p>' : ''}
      <button type="button" class="btn btn-primary btn-wide" data-cele-ok>${t('streak.ok')}</button>
    </div>`,
    title ? titleName(title) : badgeName(badges[0].id),
  );
  const close = () => box.remove();
  box.querySelector('[data-cele-ok]').addEventListener('click', close);
  box.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  box.querySelector('[data-cele-ok]').focus({ preventScroll: true });
  confetti(box);
  buzz([30, 60, 30, 60, 50]);
  if (title) {
    countUp(box.querySelector('[data-cele-n]'), 0, res.cur, 900);
    // 一句圣训："真主最喜爱的善功，是能长久坚持的，哪怕很少。"（布哈里 6464）
    import('../content/hadith.js')
      .then(({ HADITH }) => {
        const el = box.querySelector('[data-cele-hadith]');
        if (el) el.textContent = `${L(HADITH.b6464)} (${L(HADITH.b6464.src)})`;
      })
      .catch(() => {});
  }
  return box;
}

/** 做到了某件事：第一次时解锁徽章并庆祝 */
export function earn(id, todayKey) {
  const b = award(id, todayKey);
  if (b) cheer({ badges: [b] });
  return b;
}

/**
 * 打卡、做完某件事之后调用。
 * streak：checkIn() 的结果（可以没有）；badges：这次新解锁的徽章；todayKey：今天；toast：轻提示
 */
export function cheer({ streak = null, badges = [], todayKey = '' } = {}, toast) {
  if ((streak && streak.newTitle) || badges.length) return unlockCard(streak, badges);
  if (!streak) return null;
  const note = streak.usedGrace && streak.usedGrace.length ? t('streak.graceUsed') : streak.restartedFrom > 1 ? t('streak.restart', { n: streak.restartedFrom }) : '';
  if (streak.fresh && todayKey) return streakSheet(streak, todayKey, note);
  if (note && toast) toast(note);
  return null;
}
