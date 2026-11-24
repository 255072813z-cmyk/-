// 坚持打卡的界面：首页卡片、解锁称号时的庆祝
import { t } from '../i18n/index.js';
import { streakStatus, nextTitle, weekCells } from '../core/streak.js';
import { prayedDays } from '../core/prayed.js';
import { star8 } from './art.js';

// 一盏灯：打卡后点亮（不用火焰，用清真寺里常见的吊灯）
const LAMP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5v3M8.5 6.5h7l1.5 3-2 9h-6l-2-9z"/><path d="M10 20.5h4"/><circle cx="12" cy="12" r="2.2" class="lamp-flame"/></svg>';

export const titleName = (m) => t('streak.t' + m);

/** 首页的打卡卡片 */
export function streakCard(todayKey) {
  const s = streakStatus(todayKey);
  const n = s.alive ? s.cur : 0;
  const next = nextTitle(n);
  const cells = weekCells(todayKey, prayedDays());
  return `<a class="card card-link streak-card ${s.today ? 'is-done' : ''}" href="#/streak" data-streak>
    <div class="streak-top">
      <span class="streak-lamp ${s.today ? 'is-lit' : ''}">${LAMP}</span>
      <span class="streak-n">${n ? t('streak.days', { n }) : t('streak.zero')}</span>
      <span class="streak-state">${s.today ? t('streak.doneToday') : ''}</span>
    </div>
    <ol class="streak-week" aria-label="${t('streak.week')}">${cells
      .map((c) => `<li class="sw sw-${c.st}"><span class="sw-d">${t('weekShort.' + c.wd)}</span><span class="sw-dot" aria-label="${t('streak.cell.' + c.st)}"></span></li>`)
      .join('')}</ol>
    <p class="streak-hint">${s.today ? (next ? t('streak.next', { n: next.left, title: titleName(next.at) }) : t('streak.allTitles')) : t('streak.hint')}</p>
  </a>`;
}

/** 打卡后的提示：解锁称号时弹出庆祝卡片；用了宽限、重新开始时轻声说一句 */
export function celebrate(res, toast) {
  if (!res) return;
  if (res.newTitle) {
    const box = document.createElement('div');
    box.className = 'celebrate';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `<div class="celebrate-card">
      <div class="celebrate-star">${star8(56)}</div>
      <p class="celebrate-k">${t('streak.unlocked')}</p>
      <h2>${titleName(res.newTitle)}</h2>
      <p>${t('streak.unlockedText', { n: res.cur })}</p>
      <p class="note" data-cele-hadith></p>
      <button type="button" class="btn btn-primary btn-wide" data-cele-ok>${t('streak.ok')}</button>
    </div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.querySelector('[data-cele-ok]').addEventListener('click', close);
    box.addEventListener('keydown', (e) => e.key === 'Escape' && close());
    box.querySelector('[data-cele-ok]').focus();
    if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
    // 一句圣训："真主最喜爱的善功，是能长久坚持的，哪怕很少。"（布哈里 6464）
    import('../content/hadith.js')
      .then(({ HADITH }) => import('../i18n/index.js').then(({ L }) => {
        const el = box.querySelector('[data-cele-hadith]');
        if (el) el.textContent = `${L(HADITH.b6464)} (${L(HADITH.b6464.src)})`;
      }))
      .catch(() => {});
    return;
  }
  if (res.usedGrace && res.usedGrace.length && toast) toast(t('streak.graceUsed'));
  else if (res.restartedFrom > 1 && toast) toast(t('streak.restart', { n: res.restartedFrom }));
}
