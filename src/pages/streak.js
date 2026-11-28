// 我的坚持：连续天数、坚持称号、成就徽章、最近 8 周的打卡格子。只存在这台手机上。
import { streakStatus, MILESTONES, addDay, weekOf } from '../core/streak.js';
import { prayedDays } from '../core/prayed.js';
import { ymdKey } from '../core/clock.js';
import { ICONS, star8 } from '../ui/art.js';
import { titleName, topTitle, LAMP } from '../ui/streak-ui.js';
import { badgeList } from '../core/badges.js';
import { badgeTile } from '../ui/badge-ui.js';
import { t, L } from '../i18n/index.js';

export function streakPage(ctx) {
  const today = ymdKey(ctx.sched.today);
  const s = streakStatus(today);
  const n = s.alive ? s.cur : 0;
  const done = prayedDays();
  // 最近 8 周：每行一周（周一到周日）
  const start = addDay(weekOf(today), -7 * 7);
  const weeks = Array.from({ length: 8 }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = addDay(start, w * 7 + i);
      const st = d > today ? 'future' : done.has(d) || (d === today && s.today) ? 'done' : s.grace.includes(d) ? 'grace' : d === today ? 'today' : 'missed';
      return `<span class="cal-d cal-${st}" title="${d}"></span>`;
    }).join(''),
  );
  const badges = badgeList();
  const gotN = badges.filter((b) => b.got).length;
  const top = topTitle(s);
  const groups = ['prayer', 'learn', 'ramadan', 'together'];
  const html = `
  <div class="page streak-page">
    <div class="page-head"><a class="back" href="#/me" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('streak.pageTitle')}</h1></div>
    <section class="card streak-hero ${s.today ? 'is-lit' : ''}">
      <span class="streak-lamp hero-lamp ${s.today ? 'is-lit' : ''}">${LAMP}</span>
      <p class="streak-big" data-big data-count-up>${n}</p>
      <p>${n ? t('streak.days', { n }) : t('streak.zero')}${s.best ? ` · ${t('streak.best', { n: s.best })}` : ''}</p>
      ${top ? `<p class="streak-title">${titleName(top)}</p>` : ''}
      <p class="note" data-consistency></p>
    </section>
    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('streak.titlesTitle')}</h2>
      <ul class="titles">${MILESTONES.map((m) => {
        const got = s.titles.includes(m);
        return `<li class="title-item ${got ? 'is-got' : ''}"><span class="title-star">${star8(28)}</span>
          <span class="title-name">${titleName(m)}</span>
          <span class="title-sub">${got ? t('streak.gotAt', { n: m }) : t('streak.lockedLeft', { n: m - n })}</span></li>`;
      }).join('')}</ul>
    </section>
    <section class="card" data-badges>
      <h2 class="card-title">${star8(18)} ${t('badge.title')} <span class="badge-count">${gotN} / ${badges.length}</span></h2>
      <p class="note">${t('badge.sub')}</p>
      ${groups
        .map(
          (g) =>
            `<h3 class="badge-group">${t('badge.group.' + g)}</h3><ul class="badges">${badges.filter((b) => b.group === g).map(badgeTile).join('')}</ul>` +
            (g === 'ramadan' ? `<p class="note">${t('badge.fastNote')}</p>` : ''),
        )
        .join('')}
    </section>
    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('streak.calTitle')}</h2>
      <div class="cal-head">${[1, 2, 3, 4, 5, 6, 0].map((wd) => `<span>${t('weekShort.' + wd)}</span>`).join('')}</div>
      <div class="cal">${weeks.map((w) => `<div class="cal-w">${w}</div>`).join('')}</div>
      <p class="note">${t('streak.graceInfo')}</p>
    </section>
    <a class="card card-link circle-link" href="#/circle">
      <span class="athome-t">${t('circle.title')}</span>
      <span class="athome-s">${t('circle.linkSub')}</span>
    </a>
    <p class="note center">${t('streak.private')}</p>
  </div>`;
  return {
    html,
    mount(el) {
      // 数字从 0 跳到现在的天数（减少动态效果时直接显示）
      if (n > 1) import('../ui/cheer.js').then((m) => m.countUp(el.querySelector('[data-big]'), 0, n, 800)).catch(() => {});
      import('../content/hadith.js')
        .then(({ HADITH }) => {
          const p = el.querySelector('[data-consistency]');
          if (p) p.textContent = `${L(HADITH.b6464)} (${L(HADITH.b6464.src)})`;
        })
        .catch(() => {});
    },
  };
}
