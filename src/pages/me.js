// 我的（底部标签）：坚持和徽章、亲友圈、本月时间表、城市、提醒和设置、分享给亲友、隐私说明。
// 首页只放"今天要用的"，其余都收在这里，不让首页太乱。
import { streakStatus, MILESTONES } from '../core/streak.js';
import { badgeCount, BADGES } from '../core/badges.js';
import { myCircle } from '../core/circle.js';
import { shareText, shareLink } from '../core/share.js';
import { APP_VERSION } from '../core/api.js';
import { ymdKey } from '../core/clock.js';
import { LAMP, titleName, topTitle } from '../ui/streak-ui.js';
import { earn } from '../ui/cheer.js';
import { ICONS } from '../ui/art.js';
import { allProgress, readOn } from '../core/quran.js';
import { cityName } from '../i18n/format.js';
import { t } from '../i18n/index.js';

export function mePage(ctx) {
  const today = ymdKey(ctx.sched.today);
  const s = streakStatus(today);
  const n = s.alive ? s.cur : 0;
  const top = topTitle(s);
  const all = allProgress();
  const row = (href, icon, title, sub) =>
    `<a class="me-row" href="${href}"><span class="li-ico">${icon}</span><span class="me-t">${title}</span><span class="me-s">${sub}</span><span class="me-go" aria-hidden="true">›</span></a>`;
  const html = `
  <div class="page me">
    <header class="ph">
      <h1>${t('me.title')}</h1>
      <p class="ph-sub">${t('me.sub')}</p>
    </header>
    <a class="card card-link me-hero" href="#/streak">
      <span class="streak-lamp ${s.today ? 'is-lit' : ''}">${LAMP}</span>
      <span class="me-hero-main"><b>${n ? t('streak.days', { n }) : t('streak.zero')}</b>
        ${top ? `<span class="streak-title">${titleName(top)}</span>` : ''}
        <small>${t('me.badges', { a: badgeCount(), b: BADGES.length, c: s.titles.length, d: MILESTONES.length })}</small></span>
      <span class="me-go" aria-hidden="true">›</span>
    </a>
    <h2 class="sec">${t('me.secRecord')}</h2>
    <nav class="card me-list" aria-label="${t('me.secRecord')}">
      ${row('#/quran', ICONS.quran, t('me.quran'), t('me.quranSub', { n: readOn(today), all: all.read }))}
      ${row('#/circle', ICONS.rings, t('circle.title'), myCircle() ? t('me.circleIn') : t('circle.linkSub'))}
    </nav>
    <h2 class="sec">${t('me.secTools')}</h2>
    <nav class="card me-list" aria-label="${t('me.secTools')}">
      ${row('#/times', ICONS.calendar, t('me.times'), t('me.timesSub', { city: cityName(ctx.city) }))}
      ${row('#/city', ICONS.pin, t('me.city'), cityName(ctx.city))}
      ${row('#/settings', ICONS.settings, t('me.settings'), t('me.settingsSub'))}
    </nav>
    <h2 class="sec">${t('me.secMore')}</h2>
    <section class="card share-card">
      <p class="athome-t">${t('share.title')}</p>
      <p class="athome-s">${t('share.sub')}</p>
      <div class="step-btns"><button type="button" class="btn btn-primary btn-sm" data-share-app>${t('share.btn')}</button></div>
      <p class="note" data-share-msg aria-live="polite"></p>
    </section>
    <details class="card fold">
      <summary>${t('me.privacy')}</summary>
      <p class="privacy">${t('privacy')}</p>
      <a class="link-row" href="./privacy.html">${t('me.policy')} →</a>
    </details>
    <p class="note center">${t('app.name')} · ${t('me.version', { v: APP_VERSION })}</p>
  </div>`;
  return {
    html,
    mount(el) {
      const a = el.querySelector('[data-share-app]');
      a.addEventListener('click', async () => {
        const r = await shareText(t('share.msg', { app: t('app.name'), link: shareLink(ctx.remote) }).trim());
        const m = el.querySelector('[data-share-msg]');
        if (m) m.textContent = r === 'copied' ? t('times.copied') : r === 'failed' ? t('times.shareFailed') : '';
        if (r === 'shared' || r === 'copied') earn('share', today);
      });
    },
  };
}
