// 庭院：两番拜之间的等待空间。葡萄架下，倒一杯茶，掰一块馕，等下一番拜。
import { courtyardScene } from '../../ui/spaces-art.js';
import { ICONS, star8 } from '../../ui/art.js';
import { joinRoom, presenceEnabled } from '../../core/presence.js';
import { startFountain, stopAll } from '../../core/music.js';
import { skyPhase } from '../../core/prayer-times.js';
import { fmtHM, splitDuration } from '../../core/clock.js';
import { t } from '../../i18n/index.js';

const LINES = [
  '葡萄架下很安静，只有水池里的流水声。',
  '茶是刚沏的绿茶，茶碗只倒半碗，凉了再添——这是待客的老规矩。',
  '馕刚从馕坑里取出来，还烫手，芝麻的香气飘过来。',
  '长辈们坐在塔普昌上，铺着奶奶绣的苏扎尼，慢慢喝茶，不说话。',
  '离下一番拜还有一会儿，不着急。',
];

export function courtyardPage(ctx) {
  const live = presenceEnabled();
  let tea = 0;
  let bread = false;
  let sound = false;
  let line = 0;
  let room = null;
  let online = null;
  let el = null;
  let rot = null;

  const html = `
  <div class="page courtyard-page">
    <div class="page-head"><a class="back" href="#/masjid" aria-label="返回清真寺">${ICONS.back}</a><h1>庭院</h1></div>
    <section class="court-wrap" data-scene></section>
    <p class="court-line" data-line aria-live="polite">${LINES[0]}</p>
    <section class="card court-next" data-next></section>
    <div class="court-actions">
      <button class="btn btn-ghost" type="button" data-tea>倒茶</button>
      <button class="btn btn-ghost" type="button" data-bread>掰块馕</button>
      <button class="btn btn-ghost" type="button" data-sound aria-pressed="false">流水声</button>
    </div>
    <p class="note center" data-count></p>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} 在庭院里</h2>
      <p>这里是两番拜之间歇脚的地方。宣礼前 10 分钟，会请你进大殿。</p>
    </section>
  </div>`;

  function drawScene() {
    el.querySelector('[data-scene]').innerHTML = courtyardScene({ phase: skyPhase(ctx.sched.times, ctx.now), tea, bread });
  }
  function drawNext() {
    const s = ctx.sched;
    const left = s.nextTime - ctx.now;
    const { h, m } = splitDuration(left);
    const soon = left <= 10 * 60000;
    el.querySelector('[data-next]').innerHTML = `
      <p class="court-label">下一番</p>
      <p class="court-prayer">${t('prayer.' + s.next)} <span class="court-time">${fmtHM(s.nextTime)}</span></p>
      <p>${soon ? '宣礼快到了' : `还有 ${h ? h + ' 小时 ' : ''}${m} 分钟`}</p>
      ${soon ? `<a class="btn btn-primary btn-wide" href="#/masjid/hall">进大殿</a>` : ''}`;
  }
  function drawCount() {
    el.querySelector('[data-count]').textContent = live ? (online == null ? '' : `庭院里此刻 ${online} 人`) : '';
  }

  return {
    html,
    mount(root) {
      el = root;
      drawScene();
      drawNext();
      drawCount();
      el.querySelector('[data-tea]').addEventListener('click', (e) => {
        tea = 0;
        const start = performance.now();
        const step = (now) => {
          tea = Math.min(0.5, ((now - start) / 1400) * 0.5); // 只倒半碗
          if (el) drawScene();
          if (tea < 0.5 && el) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        e.currentTarget.textContent = '添茶';
        el.querySelector('[data-line]').textContent = LINES[1];
      });
      el.querySelector('[data-bread]').addEventListener('click', () => {
        bread = true;
        drawScene();
        el.querySelector('[data-line]').textContent = LINES[2];
      });
      el.querySelector('[data-sound]').addEventListener('click', (e) => {
        sound = !sound;
        if (sound) startFountain();
        else stopAll();
        e.currentTarget.setAttribute('aria-pressed', String(sound));
        e.currentTarget.textContent = sound ? '停止' : '流水声';
      });
      rot = setInterval(() => {
        line = (line + 1) % LINES.length;
        const n = el && el.querySelector('[data-line]');
        if (n) n.textContent = LINES[line];
      }, 12000);
      if (live)
        room = joinRoom('courtyard', {
          onState(m) {
            online = m.online;
            if (el) drawCount();
          },
        });
    },
    tick() {
      if (el && ctx.now.getUTCSeconds() === 0) drawNext();
    },
    unmount() {
      clearInterval(rot);
      stopAll();
      if (room) room.leave();
      el = null;
    },
  };
}
