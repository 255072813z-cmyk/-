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
      <h1>清真寺 <span class="ar-sm" lang="ar" dir="rtl">المَسْجِد</span></h1>
      <p>推开门，进来坐坐。没有聊天，没有喧哗。</p>
    </div>
    <div class="doors">
      <a class="card card-link door door-hall" href="#/masjid/hall">
        <span class="door-t">礼拜大殿</span>
        <span class="door-s">选一张垫子坐下，安静待一会儿</span>
        <span class="door-c" data-count="hall">${live ? '…' : ''}</span>
      </a>
      <a class="card card-link door door-court" href="#/masjid/courtyard">
        <span class="door-t">庭院</span>
        <span class="door-s">两番拜之间，喝杯茶，等下一番（${t('prayer.' + s.next)} ${fmtHM(s.nextTime)}）</span>
        <span class="door-c" data-count="courtyard">${live ? '…' : ''}</span>
      </a>
      <a class="card card-link door door-poetry ${open ? '' : 'is-closed'}" href="#/masjid/poetry">
        <span class="door-t">诗歌夜</span>
        <span class="door-s">沙什玛考姆的夜晚，鲁达基、鲁米、哈菲兹的诗 · ${open ? '现在开着' : `今晚宵礼（${fmtHM(ishaToday)}）后开放`}</span>
        <span class="door-c" data-count="poetry">${live ? '…' : ''}</span>
      </a>
    </div>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} 说明</h2>
      <p>${live ? '门上显示的是此刻真实在线的人数。' : '在线人数在网站正式上线、连接计数服务后显示。'}画里的人是插画。</p>
      <p class="note">这里不聊天、不评论、不排名；不用注册，不记录你是谁。</p>
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
        set('hall', `此刻 ${c.hall.online} 人 · 垫子 ${c.hall.taken}/${c.hall.capacity}`);
        set('courtyard', `此刻 ${c.courtyard.online} 人`);
        set('poetry', open ? `此刻 ${c.poetry.online} 人` : '');
      });
    },
  };
}
