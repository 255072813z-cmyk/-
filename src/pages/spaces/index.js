// 清真寺：三道门——礼拜大殿、庭院、诗歌夜
import { gateScene } from '../../ui/spaces-art.js';
import { star8 } from '../../ui/art.js';
import { skyPhase } from '../../core/prayer-times.js';
import { fmtHM } from '../../core/clock.js';
import { fetchCounts, presenceEnabled } from '../../core/presence.js';
import { t } from '../../i18n/index.js';

export function poetryOpen(sched) {
  return sched.current === 'isha';
}

export function spacesPage(ctx) {
  const s = ctx.sched;
  const open = poetryOpen(s);
  const ishaToday = s.times.isha;
  const live = presenceEnabled();
  const html = `
  <div class="page spaces">
    <section class="gate-wrap">${gateScene({ phase: skyPhase(s.times, ctx.now) })}</section>
    <div class="r-status">
      <h1>${t('nav.masjid')} <span class="ar-sm" lang="ar" dir="rtl">المَسْجِد</span></h1>
      <p>${t('spaces.lead')}</p>
    </div>
    <div class="doors">
      <a class="card card-link door door-hall" href="#/masjid/hall">
        <span class="door-t">${t('hall.title')}</span>
        <span class="door-s">${t('spaces.hallSub')}</span>
        <span class="door-c" data-count="hall">${live ? '…' : ''}</span>
      </a>
      <a class="card card-link door door-court" href="#/masjid/courtyard">
        <span class="door-t">${t('court.title')}</span>
        <span class="door-s">${t('spaces.courtSub', { name: t('prayer.' + s.next), time: fmtHM(s.nextTime) })}</span>
        <span class="door-c" data-count="courtyard">${live ? '…' : ''}</span>
      </a>
      <a class="card card-link door door-poetry ${open ? '' : 'is-closed'}" href="#/masjid/poetry">
        <span class="door-t">${t('poetry.title')}</span>
        <span class="door-s">${t('spaces.poetrySub')} · ${open ? t('spaces.openNow') : t('poetry.opensAt', { time: fmtHM(ishaToday) })}</span>
        <span class="door-c" data-count="poetry">${live ? '…' : ''}</span>
      </a>
    </div>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} ${t('quran.aboutTitle')}</h2>
      <p>${live ? t('spaces.liveNote') : t('spaces.noLiveNote')} ${t('spaces.artNote')}</p>
      <p class="note">${t('spaces.quiet')}</p>
    </section>
  </div>`;
  return {
    html,
    mount(el) {
      if (!live) return;
      fetchCounts().then((c) => {
        if (!c) return;
        const set = (room, text) => {
          const n = el.querySelector(`[data-count="${room}"]`);
          if (n) n.textContent = text;
        };
        set('hall', t('spaces.hallCount', { n: c.hall.online, taken: c.hall.taken, cap: c.hall.capacity }));
        set('courtyard', t('spaces.count', { n: c.courtyard.online }));
        set('poetry', open ? t('spaces.count', { n: c.poetry.online }) : '');
      });
    },
  };
}
