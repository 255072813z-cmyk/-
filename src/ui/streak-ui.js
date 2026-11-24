// 坚持打卡的界面：首页卡片（打卡、解锁时的动画见 cheer.js）
import { t } from '../i18n/index.js';
import { streakStatus, nextTitle, weekCells } from '../core/streak.js';
import { prayedDays } from '../core/prayed.js';

// 一盏灯：打卡后点亮（不用火焰，用清真寺里常见的吊灯）
export const LAMP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5v3M8.5 6.5h7l1.5 3-2 9h-6l-2-9z"/><path d="M10 20.5h4"/><circle cx="12" cy="12" r="2.2" class="lamp-flame"/></svg>';

export const titleName = (m) => t('streak.t' + m);

/** 已经得到的最高的坚持称号（断了也保留） */
export function topTitle(s) {
  return s.titles.length ? Math.max(...s.titles) : 0;
}

/** 首页的打卡卡片。fresh：刚刚打卡，灯亮起、今天的圆点弹一下 */
export function streakCard(todayKey, fresh = false) {
  const s = streakStatus(todayKey);
  const n = s.alive ? s.cur : 0;
  const next = nextTitle(n);
  const top = topTitle(s);
  const cells = weekCells(todayKey, prayedDays());
  return `<a class="card card-link streak-card ${s.today ? 'is-done' : ''} ${fresh ? 'is-new' : ''}" href="#/streak" data-streak>
    <div class="streak-top">
      <span class="streak-lamp ${s.today ? 'is-lit' : ''}">${LAMP}</span>
      <span class="streak-n">${n ? t('streak.days', { n }) : t('streak.zero')}</span>
      <span class="streak-state">${s.today ? t('streak.doneToday') : ''}</span>
    </div>
    ${top ? `<span class="streak-title">${titleName(top)}</span>` : ''}
    <ol class="streak-week" aria-label="${t('streak.week')}">${cells
      .map((c) => `<li class="sw sw-${c.st} ${c.day === todayKey ? 'is-today' : ''}"><span class="sw-d">${t('weekShort.' + c.wd)}</span><span class="sw-dot" aria-label="${t('streak.cell.' + c.st)}"></span></li>`)
      .join('')}</ol>
    <p class="streak-hint">${s.today ? (next ? t('streak.next', { n: next.left, title: titleName(next.at) }) : t('streak.allTitles')) : t('streak.hint')}</p>
  </a>`;
}
