// 礼拜大殿：可左右走动的全景。选一张垫子坐下，安静待一会儿；垫子坐满了就排队。
// 人数、哪些垫子有人，全部来自在线人数服务的真实数据；服务未启用时只有你自己。
import { hallPanorama, matPos } from '../../ui/spaces-art.js';
import { ICONS } from '../../ui/art.js';
import { joinRoom, presenceEnabled } from '../../core/presence.js';
import { skyPhase } from '../../core/prayer-times.js';
import { fmtHM } from '../../core/clock.js';
import { t } from '../../i18n/index.js';
import { durText } from '../../i18n/format.js';

const LOCAL_CAPACITY = 40;

export function hallPage(ctx) {
  const live = presenceEnabled();
  const st = { online: null, capacity: LOCAL_CAPACITY, taken: [], queue: 0, mine: null, queuePos: null, connected: false };
  let room = null;
  let el = null;
  let msg = '';

  const html = `
  <div class="page hall-page">
    <div class="page-head"><a class="back" href="#/masjid" aria-label="${t('common.back')}">${ICONS.back}</a>
      <h1>${t('hall.title')} <span class="ar-sm" lang="ar" dir="rtl">بَيْتُ الصَّلَاة</span></h1></div>
    <p class="hall-count" data-count aria-live="polite"></p>
    <div class="pano-wrap">
      <div class="pano" data-pano tabindex="0" aria-label="${t('hall.panoAria')}"></div>
      <div class="walk">
        <button class="btn btn-ghost btn-sm" type="button" data-walk="-1">← ${t('hall.left')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-walk="1">${t('hall.right')} →</button>
      </div>
    </div>
    <section class="card hall-panel" data-panel></section>
  </div>`;

  const mySpot = () => (st.mine == null ? null : matPos(st.mine));

  function drawPano() {
    const pano = el.querySelector('[data-pano]');
    const left = pano.scrollLeft;
    pano.innerHTML = hallPanorama({ capacity: st.capacity, taken: st.taken, mine: st.mine, phase: skyPhase(ctx.sched.times, ctx.now) });
    pano.scrollLeft = left;
    pano.querySelectorAll('.mat.is-free').forEach((g) => {
      const go = () => sit(+g.dataset.mat);
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  }

  function drawCount() {
    const n = el.querySelector('[data-count]');
    if (!live) n.textContent = t('hall.noLive');
    else if (!st.connected) n.textContent = t('hall.connecting');
    else n.textContent = t('hall.count', { n: st.online, seated: st.taken.length + (st.mine != null ? 1 : 0), free: st.capacity - st.taken.length - (st.mine != null ? 1 : 0) });
  }

  function drawPanel() {
    const p = el.querySelector('[data-panel]');
    const s = ctx.sched;
    const next = t('hall.next', { name: t('prayer.' + s.next), time: fmtHM(s.nextTime), left: durText(s.nextTime - ctx.now) });
    const spot = mySpot();
    const full = st.taken.length >= st.capacity && st.mine == null;
    if (spot) {
      p.className = 'card hall-panel is-sitting';
      p.innerHTML = `<p class="sit-title">${t('hall.sitting', { r: spot.r + 1, c: spot.c + 1 })}</p>
        <div class="breath" aria-hidden="true"></div>
        <p>${t('hall.sitText')}</p>
        <p class="note">${next}</p>
        <div class="step-btns"><a class="btn btn-ghost" href="#/tasbih">${t('hall.dhikr')}</a><button class="btn btn-ghost" type="button" data-stand>${t('hall.stand')}</button></div>`;
      p.querySelector('[data-stand]').addEventListener('click', stand);
    } else if (full) {
      p.className = 'card hall-panel is-full';
      p.innerHTML = st.queuePos
        ? `<p class="sit-title">${t('hall.queuePos', { n: st.queuePos })}</p><p>${t('hall.queueText')}</p><p class="note">${next}</p>
           <div class="step-btns"><a class="btn btn-ghost" href="#/masjid/courtyard">${t('hall.toCourtTea')}</a></div>`
        : `<p class="sit-title">${t('hall.full')}</p><p>${t('hall.fullText', { n: st.capacity })}</p><p class="note">${next}</p>
           <div class="step-btns"><button class="btn btn-primary" type="button" data-queue>${t('hall.queue')}</button><a class="btn btn-ghost" href="#/masjid/courtyard">${t('hall.toCourt')}</a></div>`;
      const q = p.querySelector('[data-queue]');
      if (q) q.addEventListener('click', () => room && room.queue());
    } else {
      p.className = 'card hall-panel';
      p.innerHTML = `<p class="sit-title">${msg || t('hall.pick')}</p><p>${t('hall.pickText')}</p><p class="note">${next}</p>`;
    }
  }

  function drawAll() {
    if (!el) return;
    drawPano();
    drawCount();
    drawPanel();
  }

  function sit(i) {
    msg = '';
    if (live) {
      if (room) room.sit(i);
    } else {
      st.mine = i;
      drawAll();
    }
  }
  function stand() {
    if (live) {
      if (room) room.stand();
    } else {
      st.mine = null;
      drawAll();
    }
  }

  function toast(text) {
    const layer = document.querySelector('.toast-layer');
    if (!layer) return;
    layer.innerHTML = `<div class="toast" role="status"><div class="toast-text"><strong>${text}</strong></div><div class="toast-actions"><button class="btn btn-ghost btn-sm" type="button" data-close>${t('common.close')}</button></div></div>`;
    layer.querySelector('[data-close]').addEventListener('click', () => (layer.innerHTML = ''));
  }

  return {
    html,
    mount(root) {
      el = root;
      drawAll();
      // 一进来，镜头对着米哈拉布
      const pano = el.querySelector('[data-pano]');
      pano.scrollLeft = (pano.scrollWidth - pano.clientWidth) / 2;
      el.querySelectorAll('[data-walk]').forEach((b) =>
        b.addEventListener('click', () => pano.scrollBy({ left: +b.dataset.walk * pano.clientWidth * 0.6, behavior: 'smooth' })),
      );
      if (live) {
        room = joinRoom('hall', {
          onStatus(s) {
            st.connected = s === 'open';
            drawCount();
          },
          onState(m) {
            st.connected = true;
            st.online = m.online;
            st.capacity = m.capacity;
            st.taken = m.taken.filter((x) => x !== m.you.mat);
            st.mine = m.you.mat;
            st.queuePos = m.you.queuePos;
            if (m.event === 'assigned' && st.mine != null) {
              const p = matPos(st.mine);
              toast(t('hall.yourTurn', { r: p.r + 1, c: p.c + 1 }));
            }
            if (m.event === 'error:taken') msg = t('hall.taken');
            drawAll();
          },
        });
      }
    },
    tick() {
      if (el && ctx.now.getUTCSeconds() === 0) drawPanel();
    },
    unmount() {
      if (room) room.leave();
      el = null;
    },
  };
}
