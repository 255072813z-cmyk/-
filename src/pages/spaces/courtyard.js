// 庭院：两番拜之间的等待空间。葡萄架下，倒一杯茶，掰一块馕，等下一番拜。
import { courtyardScene } from '../../ui/spaces-art.js';
import { ICONS, star8 } from '../../ui/art.js';
import { joinRoom, presenceEnabled } from '../../core/presence.js';
import { startFountain, stopAll } from '../../core/music.js';
import { skyPhase } from '../../core/prayer-times.js';
import { fmtHM } from '../../core/clock.js';
import { t } from '../../i18n/index.js';
import { durText } from '../../i18n/format.js';

// 轮换的几句话（文字在语言文件 court.line.0…4）
const LINES = [0, 1, 2, 3, 4].map((i) => 'court.line.' + i);

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
    <div class="page-head"><a class="back" href="#/masjid" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('court.title')}</h1></div>
    <section class="court-wrap" data-scene></section>
    <p class="court-line" data-line aria-live="polite">${t(LINES[0])}</p>
    <section class="card court-next" data-next></section>
    <div class="court-actions">
      <button class="btn btn-ghost" type="button" data-tea>${t('court.tea')}</button>
      <button class="btn btn-ghost" type="button" data-bread>${t('court.bread')}</button>
      <button class="btn btn-ghost" type="button" data-sound aria-pressed="false">${t('court.water')}</button>
    </div>
    <p class="note center" data-count></p>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} ${t('court.aboutTitle')}</h2>
      <p>${t('court.about')}</p>
    </section>
  </div>`;

  function drawScene() {
    el.querySelector('[data-scene]').innerHTML = courtyardScene({ phase: skyPhase(ctx.sched.times, ctx.now), tea, bread });
  }
  function drawNext() {
    const s = ctx.sched;
    const left = s.nextTime - ctx.now;
    const soon = left <= 10 * 60000;
    el.querySelector('[data-next]').innerHTML = `
      <p class="court-label">${t('home.next')}</p>
      <p class="court-prayer">${t('prayer.' + s.next)} <span class="court-time">${fmtHM(s.nextTime)}</span></p>
      <p>${soon ? t('court.soon') : t('card.left', { dur: durText(left) })}</p>
      ${soon ? `<a class="btn btn-primary btn-wide" href="#/masjid/hall">${t('court.goHall')}</a>` : ''}`;
  }
  function drawCount() {
    el.querySelector('[data-count]').textContent = live ? (online == null ? '' : t('court.online', { n: online })) : '';
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
        e.currentTarget.textContent = t('court.teaMore');
        el.querySelector('[data-line]').textContent = t(LINES[1]);
      });
      el.querySelector('[data-bread]').addEventListener('click', () => {
        bread = true;
        drawScene();
        el.querySelector('[data-line]').textContent = t(LINES[2]);
      });
      el.querySelector('[data-sound]').addEventListener('click', (e) => {
        sound = !sound;
        if (sound) startFountain();
        else stopAll();
        e.currentTarget.setAttribute('aria-pressed', String(sound));
        e.currentTarget.textContent = sound ? t('court.stop') : t('court.water');
      });
      rot = setInterval(() => {
        line = (line + 1) % LINES.length;
        const n = el && el.querySelector('[data-line]');
        if (n) n.textContent = t(LINES[line]);
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
